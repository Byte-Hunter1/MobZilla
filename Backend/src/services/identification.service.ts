import crypto from "crypto";
import fs from "fs/promises";
import { analyzeFrames, analyzeText, analyzeYouTube } from "../ai/gemini.client";
import { DESCRIPTION_PROMPT, IDENTIFICATION_PROMPT, recommendationPrompt } from "../ai/prompts";
import { GeminiIdentification } from "../ai/schemas";
import { AppError, PermanentError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { findByTitle } from "../movies/omdb.client";
import { getMovie } from "../movies/movie.service";
import { MovieView } from "../movies/types";
import { extractFrames, formatTimestamps, probeVideo } from "../video/ffmpeg";
import { inspectUrl } from "../video/url";
import { enqueueIdentification } from "../queues/identify.queue";
import { GeminiCandidate, rankVerified } from "./ranking.service";
import { removeFile, storeVideo } from "./storage.service";

type JobRecord = {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  localPath: string | null;
  inputLabel: string | null;
};

function newShareToken() {
  return crypto.randomBytes(9).toString("base64url");
}

async function setJobProgress(jobId: string, status: string, progress: number, stage: string) {
  await prisma.identificationJob.update({
    where: { id: jobId },
    data: { status, progress, stage }
  });
}

async function verifyCandidates(
  analysis: GeminiIdentification,
  extraHints?: { inputLabel?: string | null }
) {
  const pairs: { candidate: GeminiCandidate; movie: MovieView }[] = [];

  for (const candidate of analysis.candidates) {
    const movie = await findByTitle(candidate.title, candidate.year, candidate.mediaType, {
      internationalTitle: candidate.internationalTitle,
      director: candidate.director,
      actors: analysis.scene.actors,
      imdbId: candidate.imdbId
    });
    if (movie) pairs.push({ candidate, movie });
  }

  // Forensic Check: If on-screen text overlays were detected (watermarks, logos, titles)
  if (analysis.scene.textOverlays && analysis.scene.textOverlays.length > 0) {
    for (const rawText of analysis.scene.textOverlays) {
      const text = rawText.trim();
      if (
        text.length >= 4 &&
        !/^(prime(\s*video)?|netflix|shorts?|youtube|subscribe|like|share|follow|tiktok|reels?|eros(\s*now)?|hotstar|hbo|disney(\+)?|warner(\s*bros)?|fox|paramount(\+)?|hulu|apple(\s*tv)?)$/i.test(
          text
        )
      ) {
        const alreadyMatched = pairs.some(
          (p) =>
            p.movie.title.toLowerCase().includes(text.toLowerCase()) ||
            p.candidate.title.toLowerCase().includes(text.toLowerCase())
        );
        if (!alreadyMatched) {
          const directMovie = await findByTitle(text, undefined, undefined, {
            actors: analysis.scene.actors
          });
          if (directMovie) {
            pairs.push({
              candidate: {
                title: text,
                confidence: 98,
                explanation: `Definitive on-screen title watermark detected in video: "${text}".`
              },
              movie: directMovie
            });
          }
        }
      }
    }
  }

  // Forensic Check: If file metadata or clip label contains title / year hints
  if (extraHints?.inputLabel) {
    const yearMatch = extraHints.inputLabel.match(/([a-zA-Z0-9\s':-]+?)\s*\(((?:19|20)\d\d)\)/);
    if (yearMatch) {
      const candidateTitle = yearMatch[1]
        .replace(/^(vidssave(\.com)?|download|video|clip|edit)[\s_.-]+/i, "")
        .replace(/^[_\s.-]+|[_\s.-]+$/g, "")
        .replace(/[_\s-]+edit$/i, "")
        .trim();
      const candidateYear = yearMatch[2];
      if (candidateTitle.length >= 3) {
        const alreadyMatched = pairs.some(
          (p) => p.movie.title.toLowerCase() === candidateTitle.toLowerCase()
        );
        if (!alreadyMatched) {
          const directMovie = await findByTitle(candidateTitle, candidateYear, undefined, {
            actors: analysis.scene.actors
          });
          if (directMovie) {
            pairs.push({
              candidate: {
                title: candidateTitle,
                year: candidateYear,
                confidence: 96,
                explanation: `Verified title "${candidateTitle} (${candidateYear})" identified in clip metadata.`
              },
              movie: directMovie
            });
          }
        }
      }
    }
  }

  return rankVerified(pairs, analysis.scene);
}

async function verifySimilar(analysis: GeminiIdentification, exclude: string[]) {
  const movies: MovieView[] = [];
  for (const item of analysis.similar) {
    const movie = await findByTitle(item.title, item.year, undefined, {
      internationalTitle: item.internationalTitle
    });
    if (!movie || exclude.includes(movie.imdbId) || movies.some((existing) => existing.imdbId === movie.imdbId)) {
      continue;
    }
    movies.push({ ...movie, explanation: item.explanation });
    if (movies.length === 4) break;
  }
  return movies;
}

function buildResult(
  ranked: { movie: MovieView; confidence: number; explanation: string }[],
  analysis: GeminiIdentification,
  similar: MovieView[],
  sourceType: string,
  sourceUrl: string | null,
  timestamp?: string,
  query?: string
) {
  const top = ranked[0];
  if (!top) {
    return {
      match: null,
      confidence: 0,
      reasoning: analysis.scene.description
        ? `${analysis.scene.description} None of the suggested titles could be verified with OMDb.`
        : "No suggested title could be verified with OMDb.",
      alternatives: [],
      sourceType,
      sourceUrl,
      query: query || null
    };
  }
  return {
    match: {
      ...top.movie,
      sceneDetective: {
        description: analysis.scene.description,
        timestamp,
        location: analysis.scene.location || undefined,
        characters: analysis.scene.characters,
        visualElements: analysis.scene.visualElements
      },
      recommendations: similar.filter((movie) => movie.imdbId !== top.movie.imdbId)
    },
    confidence: top.confidence,
    reasoning: top.explanation,
    alternatives: ranked.slice(1).map((item) => item.movie),
    sourceType,
    sourceUrl,
    query: query || null
  };
}

async function completeJob(jobId: string, result: unknown, localPath?: string | null) {
  const stored = localPath ? await storeVideo(localPath).catch(() => null) : null;
  await removeFile(localPath);
  await prisma.identificationJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 100,
      stage: "Completed",
      error: null,
      result: result as object,
      shareToken: newShareToken(),
      storageKey: stored?.key || null,
      localPath: null
    }
  });
}

async function remember(key: string, result: unknown) {
  await prisma.lookupCache.upsert({
    where: { key },
    create: { key, payload: result as object },
    update: { payload: result as object }
  });
}

export async function createFileJob(file: { originalname: string; path: string }, userId?: string) {
  const job = await prisma.identificationJob.create({
    data: {
      userId,
      sourceType: "file",
      status: "queued",
      progress: 5,
      stage: "Queued",
      inputLabel: file.originalname,
      localPath: file.path
    }
  });
  await enqueueIdentification(job.id);
  return { jobId: job.id };
}

export async function createUrlJob(url: string, userId?: string) {
  const inspected = inspectUrl(url);
  if (!inspected) {
    throw new AppError(400, "Paste a YouTube, YouTube Shorts, or Instagram Reel link.", "VALIDATION_ERROR");
  }
  if (inspected.platform === "instagram") {
    throw new AppError(
      422,
      "Instagram does not provide an authorized way to fetch Reel video. Upload the clip instead. Private Reels are not accessed.",
      "PLATFORM_RESTRICTED"
    );
  }
  const job = await prisma.identificationJob.create({
    data: {
      userId,
      sourceType: "link",
      status: "queued",
      progress: 5,
      stage: "Queued",
      inputLabel: inspected.url,
      sourceUrl: inspected.url
    }
  });
  await enqueueIdentification(job.id);
  return { jobId: job.id };
}

export async function getStatus(jobId: string) {
  const job = await prisma.identificationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError(404, "Identification job not found", "NOT_FOUND");
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error
  };
}

export async function getResults(jobId: string) {
  const job = await prisma.identificationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError(404, "Identification job not found", "NOT_FOUND");
  if (job.status !== "completed") {
    throw new AppError(409, "Results are not ready yet", "NOT_READY");
  }
  return { jobId: job.id, status: job.status, shareToken: job.shareToken, result: job.result };
}

export async function getShare(token: string) {
  const job = await prisma.identificationJob.findUnique({ where: { shareToken: token } });
  if (!job?.result) throw new AppError(404, "Shared result not found", "NOT_FOUND");
  return { shareToken: job.shareToken, result: job.result };
}

export async function searchByDescription(query: string, userId?: string) {
  const key = `desc:v3:${crypto.createHash("sha256").update(query.toLowerCase()).digest("hex")}`;
  const cached = await redis.get(key);
  const result = cached ? JSON.parse(cached) : await buildDescriptionResult(query);
  if (!cached && result?.confidence >= 70) {
    await redis.set(key, JSON.stringify(result), "EX", 6 * 60 * 60);
  }
  if (userId) {
    await prisma.identificationJob.create({
      data: {
        userId,
        sourceType: "description",
        status: "completed",
        progress: 100,
        stage: "Completed",
        inputLabel: query,
        result,
        shareToken: newShareToken()
      }
    });
  }
  return result;
}

async function buildDescriptionResult(query: string) {
  const analysis = await analyzeText(`${DESCRIPTION_PROMPT}\n\nViewer description: ${query}`);
  const ranked = await verifyCandidates(analysis);
  const similar = await verifySimilar(analysis, ranked.map((item) => item.movie.imdbId));
  return buildResult(ranked, analysis, similar, "description", null, undefined, query);
}

export async function recommend(imdbId: string) {
  const cacheKey = `recs:v2:${imdbId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as MovieView[];
  const movie = await getMovie(imdbId);
  const analysis = await analyzeText(recommendationPrompt(movie));
  const similar = await verifySimilar(analysis, [imdbId]);
  if (similar.length > 0) {
    await redis.set(cacheKey, JSON.stringify(similar), "EX", 7 * 24 * 60 * 60);
  }
  return similar;
}

export async function processIdentificationJob(jobId: string) {
  const job = await prisma.identificationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "completed") return;
  try {
    if (job.sourceType === "link") await processUrl(job);
    else if (job.sourceType === "file") await processFile(job);
    else throw new PermanentError("This job cannot be processed.");
  } catch (error) {
    const permanent = error instanceof PermanentError;
    const invalid = error instanceof AppError && error.code === "GEMINI_INVALID";
    if (permanent || invalid) {
      await prisma.identificationJob.update({
        where: { id: jobId },
        data: { status: "failed", error: (error as Error).message, stage: "Failed", progress: 100, localPath: null }
      });
      await removeFile(job.localPath);
      throw new PermanentError((error as Error).message);
    }
    throw error;
  }
}

async function processUrl(job: JobRecord) {
  const inspected = inspectUrl(job.sourceUrl || "");
  if (!inspected || inspected.platform !== "youtube" || !inspected.videoId) {
    throw new PermanentError("This link is not a public YouTube video.");
  }
  const cacheKey = `yt:${inspected.videoId}`;
  const cached = await prisma.lookupCache.findUnique({ where: { key: cacheKey } });
  if (cached) {
    await completeJob(job.id, cached.payload);
    return;
  }
  await setJobProgress(job.id, "analyzing", 45, "Analyzing visual frames & metadata");
  let analysis: GeminiIdentification;
  try {
    analysis = await analyzeYouTube(IDENTIFICATION_PROMPT, inspected.url, inspected.videoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube video could not be read";
    if (/permission|private|not found|unavailable|invalid|access/i.test(message)) {
      throw new PermanentError("This video is private or inaccessible.");
    }
    throw error;
  }
  await setJobProgress(job.id, "verifying", 75, "Verifying cast & scene forensics with OMDb");
  const ranked = await verifyCandidates(analysis, { inputLabel: inspected.url });
  const similar = await verifySimilar(analysis, ranked.map((item) => item.movie.imdbId));
  const result = buildResult(ranked, analysis, similar, "link", inspected.url);

  // Cache verified high-confidence results
  if (result.confidence >= 65) {
    await remember(cacheKey, result);
  }

  await completeJob(job.id, result);
}

function buildClipPrompt(inputLabel: string | null) {
  return [
    IDENTIFICATION_PROMPT,
    "Source: Uploaded Video Clip",
    inputLabel ? `Uploaded File Name / Metadata: "${inputLabel}"` : "",
    "CRITICAL INSTRUCTIONS FOR UPLOADED VIDEO CLIPS & FAN EDITS:",
    "- The clip is frequently a fan edit, Reel, TikTok, YouTube Short, or downloaded excerpt.",
    `- CAREFULLY inspect the uploaded file name for clues: it frequently contains real movie/series titles (e.g. "Obsession", "Manmarziyaan"), release years (e.g. 2026), actor or celebrity names (e.g. "Inde Navarrette", "Michael Johnston"), character names, or scene clues. Distinguish these from site watermarks, download tags, or editor handles (e.g., 'vidssave.com', 'edit', '480P', 'chrmbchrmb').`,
    "- CAREFULLY examine all provided visual frames: identify real actor faces, hair styles, costumes, badges/patches on shirts, props, set design, and cinematography.",
    "- LOOK CAREFULLY AT ON-SCREEN WATERMARKS, STUDIO LOGOS, SUBTITLES, OR TEXT OVERLAYS. If a movie title watermark or logo is present, transcribe it exactly into 'textOverlays'.",
    "- Base your identification strictly on visible actor faces, costumes, hairstyles, cinematography, and dialogue clues in the provided visual frames.",
    "- Identify the real, officially released feature film, TV series, or miniseries that this scene is excerpted from."
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function processFile(job: JobRecord) {
  if (!job.localPath) throw new PermanentError("The uploaded video is missing.");
  await setJobProgress(job.id, "extracting", 20, "Reading video metadata");
  const file = await fs.readFile(job.localPath);
  const hash = crypto.createHash("sha256").update(file).digest("hex");
  const probe = await probeVideo(job.localPath);
  const cacheKey = `file:${hash}`;
  const cached = await prisma.lookupCache.findUnique({ where: { key: cacheKey } });
  if (cached) {
    await completeJob(job.id, cached.payload, job.localPath);
    return;
  }
  const extracted = await extractFrames(job.localPath, probe.duration);
  try {
    await setJobProgress(job.id, "analyzing", 55, "Analyzing scene frames with Gemini");
    const clipPrompt = buildClipPrompt(job.inputLabel);

    const analysis = await analyzeFrames(clipPrompt, extracted.frames);
    await setJobProgress(job.id, "verifying", 80, "Verifying cast & scene forensics with OMDb");
    const ranked = await verifyCandidates(analysis, { inputLabel: job.inputLabel });
    const similar = await verifySimilar(analysis, ranked.map((item) => item.movie.imdbId));
    const result = buildResult(
      ranked,
      analysis,
      similar,
      "file",
      null,
      `Sampled at ${formatTimestamps(extracted.timestamps)}`
    );

    if (result.confidence >= 65) {
      await remember(cacheKey, result);
    }

    await completeJob(job.id, result, job.localPath);
  } finally {
    await fs.rm(extracted.directory, { recursive: true, force: true });
  }
}
