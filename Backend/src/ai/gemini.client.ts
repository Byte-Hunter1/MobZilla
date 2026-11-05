import fs from "fs/promises";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { GeminiIdentification, geminiIdentificationSchema } from "./schemas";

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { file_uri: string } };

const responseSchema = {
  type: "OBJECT",
  required: ["scene", "candidates"],
  properties: {
    scene: {
      type: "OBJECT",
      required: ["description"],
      properties: {
        description: { type: "STRING" },
        location: { type: "STRING" },
        characters: { type: "ARRAY", items: { type: "STRING" } },
        actors: { type: "ARRAY", items: { type: "STRING" } },
        textOverlays: { type: "ARRAY", items: { type: "STRING" } },
        visualElements: { type: "ARRAY", items: { type: "STRING" } }
      }
    },
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["title", "confidence", "explanation"],
        properties: {
          title: { type: "STRING" },
          internationalTitle: { type: "STRING" },
          year: { type: "STRING" },
          director: { type: "STRING" },
          mediaType: { type: "STRING" },
          imdbId: { type: "STRING" },
          confidence: { type: "NUMBER" },
          explanation: { type: "STRING" }
        }
      }
    },
    similar: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["title", "explanation"],
        properties: {
          title: { type: "STRING" },
          internationalTitle: { type: "STRING" },
          year: { type: "STRING" },
          explanation: { type: "STRING" }
        }
      }
    }
  }
};

function normalizeConfidence(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  const scaled = score > 0 && score <= 1 ? score * 100 : score > 1 && score <= 10 ? score * 10 : score;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeGemini(raw: unknown) {
  const value = (raw && typeof raw === "object" ? raw : {}) as {
    scene?: {
      description?: string;
      location?: string;
      characters?: string[];
      actors?: string[];
      textOverlays?: string[];
      visualElements?: string[];
    };
    candidates?: Record<string, unknown>[];
    similar?: Record<string, unknown>[];
  };
  const media = (input: unknown) => {
    const text = String(input || "").toLowerCase();
    if (text.includes("series") || text === "tv") return "series";
    if (text.includes("movie")) return "movie";
    return undefined;
  };
  return {
    scene: {
      description: value.scene?.description || "",
      location: value.scene?.location || "",
      characters: value.scene?.characters || [],
      actors: value.scene?.actors || [],
      textOverlays: value.scene?.textOverlays || [],
      visualElements: value.scene?.visualElements || []
    },
    candidates: (value.candidates || []).slice(0, 8).map((candidate) => ({
      title: String(candidate.title || ""),
      internationalTitle: String(candidate.internationalTitle || ""),
      year: candidate.year ? String(candidate.year) : "",
      director: String(candidate.director || ""),
      mediaType: media(candidate.mediaType),
      imdbId: String(candidate.imdbId || ""),
      confidence: normalizeConfidence(candidate.confidence),
      explanation: String(candidate.explanation || "")
    })),
    similar: (value.similar || []).slice(0, 8).map((item) => ({
      title: String(item.title || ""),
      internationalTitle: String(item.internationalTitle || ""),
      year: item.year ? String(item.year) : "",
      explanation: String(item.explanation || "")
    }))
  };
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini did not return JSON");
  return JSON.parse(trimmed.slice(start, end + 1));
}

// Ordered by reliability, active quota availability, and vision intelligence
const fallbackModels = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest"
];

function modelOrder() {
  const configured = env.GEMINI_MODEL;
  const list = [configured, ...fallbackModels.filter((model) => model !== configured)];
  return Array.from(new Set(list));
}

async function requestModel(model: string, parts: Part[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema
      }
    }),
    signal: AbortSignal.timeout(90000)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  return { response, payload };
}

export async function analyzeWithGemini(parts: Part[]): Promise<GeminiIdentification> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "Gemini is not configured", "GEMINI_UNAVAILABLE");
  }
  let lastError = "Gemini request failed";
  for (const model of modelOrder()) {
    try {
      const { response, payload } = await requestModel(model, parts);
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        lastError = payload.error?.message || `${model} returned ${response.status}`;
        continue;
      }
      if (!response.ok) {
        lastError = payload.error?.message || `Model ${model} failed with ${response.status}`;
        continue;
      }
      const text =
        payload.candidates?.[0]?.content?.parts
          ?.filter((part) => part.text && !part.thought)
          .map((part) => part.text)
          .join("") || "";
      const parsed = geminiIdentificationSchema.safeParse(normalizeGemini(extractJson(text)));
      if (!parsed.success) {
        lastError = `Gemini response schema parsing failed: ${parsed.error.message}`;
        continue;
      }
      return parsed.data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Request failed";
    }
  }
  throw new AppError(502, lastError, "GEMINI_UNAVAILABLE");
}

export async function analyzeFrames(prompt: string, framePaths: string[]) {
  const parts: Part[] = [];
  for (const framePath of framePaths) {
    const data = (await fs.readFile(framePath)).toString("base64");
    parts.push({ inline_data: { mime_type: "image/jpeg", data } });
  }
  parts.push({ text: prompt });
  return analyzeWithGemini(parts);
}

export async function analyzeText(prompt: string) {
  return analyzeWithGemini([{ text: prompt }]);
}

async function fetchYouTubeMetadata(videoUrl: string): Promise<{ title?: string; author?: string; description?: string } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(6000) });
    let oembed: { title?: string; author_name?: string } = {};
    if (res.ok) {
      oembed = (await res.json()) as { title?: string; author_name?: string };
    }

    // Attempt to scrape page meta tags for copyright / movie attribution notes
    let description = "";
    try {
      const pageRes = await fetch(videoUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(5000)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
        if (descMatch && descMatch[1]) description = descMatch[1].slice(0, 300);
      }
    } catch {
      // Ignore html scrape failure
    }

    return {
      title: oembed.title,
      author: oembed.author_name,
      description
    };
  } catch {
    return null;
  }
}

async function fetchYouTubeFrames(videoId: string): Promise<Part[]> {
  const urls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hq1.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hq2.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hq3.jpg`
  ];

  const parts: Part[] = [];
  const seenSizes = new Set<number>();

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      // Skip empty or tiny placeholder error images (e.g. YouTube placeholder is < 1500 bytes)
      if (buffer.length < 2000) continue;
      // Skip duplicate resolution frames
      if (seenSizes.has(buffer.length)) continue;
      seenSizes.add(buffer.length);

      parts.push({
        inline_data: { mime_type: "image/jpeg", data: buffer.toString("base64") }
      });
      // Limit to 4 best unique frames
      if (parts.length >= 4) break;
    } catch {
      // Continue to next frame URL
    }
  }
  return parts;
}

export async function analyzeYouTube(prompt: string, videoUrl: string, videoId?: string) {
  const meta = await fetchYouTubeMetadata(videoUrl);
  const frameParts = videoId ? await fetchYouTubeFrames(videoId) : [];

  const contextNotes = [
    prompt,
    `Source: YouTube Short / Video Clip (${videoUrl})`,
    meta?.title ? `YouTube Clip Title: "${meta.title}"${meta.author ? ` (Channel: ${meta.author})` : ""}` : "",
    meta?.description ? `YouTube Description / Metadata: "${meta.description}"` : "",
    `CRITICAL INSTRUCTIONS FOR YOUTUBE SHORTS & CLIPS:`,
    `- YouTube Shorts titles and captions often contain viral clickbait, meme phrases, or song titles (e.g., 'Bro thought he was safe', 'Wait for the end', 'POV: sigma edit'). DO NOT mistake video titles or song names for the movie title.`,
    `- LOOK CAREFULLY AT ON-SCREEN WATERMARKS, STUDIO LOGOS, AND SUBTITLES (e.g. 'MANMARZIYAAN', 'EROS NOW', 'PRIME VIDEO', 'WARNER BROS', 'A24'). If a movie title watermark is visible on screen, THAT IS THE MOVIE.`,
    `- Base your identification strictly on visible actor faces, costumes, hairstyles, cinematography, and dialogue clues in the provided visual frames.`,
    `- Identify the real, officially released feature film, TV series, or miniseries that this scene is excerpted from.`
  ].filter(Boolean).join("\n\n");

  if (frameParts.length > 0) {
    return analyzeWithGemini([...frameParts, { text: contextNotes }]);
  }

  // Fallback to text + URL if frames could not be fetched
  return analyzeWithGemini([{ text: contextNotes }]);
}
