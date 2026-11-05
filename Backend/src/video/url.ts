export type Platform = "youtube" | "instagram";

export function inspectUrl(raw: string): { platform: Platform; url: string; videoId?: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const videoId = parsed.pathname.split("/").filter(Boolean)[0];
    if (!videoId) return null;
    return { platform: "youtube", url: `https://www.youtube.com/watch?v=${videoId}`, videoId };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const shortId = parsed.pathname.match(/^\/shorts\/([\w-]{6,})/)?.[1];
    const watchId = parsed.searchParams.get("v");
    const videoId = shortId || watchId;
    if (!videoId || !/^[\w-]{6,}$/.test(videoId)) return null;
    return { platform: "youtube", url: parsed.toString(), videoId };
  }

  if (host === "instagram.com" && /^\/(reel|reels)\/[\w-]+\/?$/.test(parsed.pathname)) {
    return { platform: "instagram", url: parsed.toString() };
  }

  return null;
}
