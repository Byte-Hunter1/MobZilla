import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { env, storageRoot } from "../config/env";
import { PermanentError } from "../lib/errors";

type Probe = { duration: number; format: string; hasVideo: boolean };

function run(command: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function commandExists(command: string) {
  const result = await run("which", [command]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
  return result.code === 0 && result.stdout.trim().length > 0;
}

async function dockerAvailable() {
  const result = await run("docker", ["info"]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
  return result.code === 0;
}

function assertFormat(format: string) {
  const value = format.toLowerCase();
  const ok = value.includes("mp4") || value.includes("mov") || value.includes("webm") || value.includes("matroska");
  if (!ok) throw new PermanentError("Only MP4, MOV, and WEBM videos can be identified.");
}

async function probeLocal(filePath: string): Promise<Probe> {
  const result = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath
  ]);
  if (result.code !== 0) throw new PermanentError("Could not read this video.");
  return parseProbe(result.stdout);
}

async function probeDocker(filePath: string): Promise<Probe> {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  const result = await run("docker", [
    "run",
    "--rm",
    "--entrypoint",
    "ffprobe",
    "-v",
    `${dir}:/work`,
    "jrottenberg/ffmpeg:6.1-alpine",
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    `/work/${name}`
  ]);
  if (result.code !== 0) throw new PermanentError("Could not read this video.");
  return parseProbe(result.stdout);
}

function parseProbe(stdout: string): Probe {
  const payload = JSON.parse(stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: { codec_type?: string }[];
  };
  const duration = Number(payload.format?.duration || 0);
  return {
    duration,
    format: payload.format?.format_name || "",
    hasVideo: Boolean(payload.streams?.some((stream) => stream.codec_type === "video"))
  };
}

export async function probeVideo(filePath: string) {
  const probe = (await commandExists("ffprobe")) ? await probeLocal(filePath) : await probeWithFallback(filePath);
  if (!probe.hasVideo) throw new PermanentError("This file does not contain a video stream.");
  assertFormat(probe.format);
  if (!Number.isFinite(probe.duration) || probe.duration < 0.4) {
    throw new PermanentError("The clip is too short to identify.");
  }
  if (probe.duration > env.MAX_DURATION_SECONDS) {
    throw new PermanentError(`Clips must be ${env.MAX_DURATION_SECONDS} seconds or shorter.`);
  }
  return probe;
}

async function probeWithFallback(filePath: string) {
  if (await dockerAvailable()) return probeDocker(filePath);
  throw new PermanentError("FFmpeg is not available on this machine.");
}

function sampleTimes(duration: number) {
  const maxFrames = env.GEMINI_MAX_FRAMES || 6;
  let points: number[];
  if (duration <= 3) {
    points = [0.35, 0.7];
  } else if (duration <= 6) {
    points = [0.2, 0.5, 0.8];
  } else if (duration <= 15) {
    points = [0.12, 0.32, 0.52, 0.72, 0.88];
  } else {
    points = [0.1, 0.25, 0.42, 0.58, 0.75, 0.9];
  }
  const count = Math.min(points.length, maxFrames);
  const selectedPoints = points.slice(0, count);
  return selectedPoints.map((point) => Math.max(0, Math.min(duration - 0.1, duration * point)));
}

async function extractLocal(filePath: string, times: number[], directory: string) {
  const frames: string[] = [];
  for (let index = 0; index < times.length; index++) {
    const frame = path.join(directory, `frame-${index}.jpg`);
    const t = times[index];
    const fastSeek = Math.max(0, t - 2);
    const slowSeek = t - fastSeek;
    const result = await run("ffmpeg", [
      "-y",
      "-ss",
      fastSeek.toFixed(2),
      "-i",
      filePath,
      "-ss",
      slowSeek.toFixed(2),
      "-frames:v",
      "1",
      "-vf",
      "scale='min(1024,iw)':-2",
      "-q:v",
      "2",
      frame
    ]);
    if (result.code !== 0) throw new PermanentError("Could not extract frames from this video.");
    frames.push(frame);
  }
  return frames;
}

async function extractDocker(filePath: string, times: number[], directory: string) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  const frames: string[] = [];
  for (let index = 0; index < times.length; index++) {
    const frameName = `frame-${index}.jpg`;
    const t = times[index];
    const fastSeek = Math.max(0, t - 2);
    const slowSeek = t - fastSeek;
    const result = await run("docker", [
      "run",
      "--rm",
      "-v",
      `${dir}:/work`,
      "-v",
      `${directory}:/frames`,
      "jrottenberg/ffmpeg:6.1-alpine",
      "-y",
      "-ss",
      fastSeek.toFixed(2),
      "-i",
      `/work/${name}`,
      "-ss",
      slowSeek.toFixed(2),
      "-frames:v",
      "1",
      "-vf",
      "scale='min(1024,iw)':-2",
      "-q:v",
      "2",
      `/frames/${frameName}`
    ]);
    if (result.code !== 0) throw new PermanentError("Could not extract frames from this video.");
    frames.push(path.join(directory, frameName));
  }
  return frames;
}

export async function extractFrames(filePath: string, duration: number) {
  const times = sampleTimes(duration);
  const directory = await fs.mkdtemp(path.join(storageRoot, "frames-"));
  const frames = (await commandExists("ffmpeg"))
    ? await extractLocal(filePath, times, directory)
    : await extractDocker(filePath, times, directory);
  return { frames, directory, timestamps: times };
}

export function formatTimestamps(times: number[]) {
  return times
    .map((time) => {
      const total = Math.round(time);
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return `${minutes}:${String(seconds).padStart(2, "0")}`;
    })
    .join(", ");
}
