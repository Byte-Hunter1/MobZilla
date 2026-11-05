import { MovieView } from "../movies/types";

export type GeminiCandidate = {
  title: string;
  internationalTitle?: string;
  year?: string;
  director?: string;
  mediaType?: "movie" | "series";
  imdbId?: string;
  confidence: number;
  explanation: string;
};

export type SceneContext = {
  description: string;
  location?: string;
  characters?: string[];
  actors?: string[];
  textOverlays?: string[];
  visualElements?: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreCandidate(candidate: GeminiCandidate, movie: MovieView, scene?: SceneContext) {
  let score = clamp(candidate.confidence, 0, 100);

  const left = norm(candidate.title);
  const right = norm(movie.title);
  const intl = norm(candidate.internationalTitle || "");

  // Year consistency
  const hintedYear = (candidate.year || "").slice(0, 4);
  const movieYear = (movie.year || "").slice(0, 4);
  if (hintedYear && movieYear) {
    const diff = Math.abs(Number(hintedYear) - Number(movieYear));
    if (diff === 0) score += 5;
    else if (diff <= 1) score += 2;
    else if (diff > 5) score -= 15;
  }

  // Media type consistency
  if (candidate.mediaType === "series" && movie.mediaType === "tv") score += 3;
  else if (candidate.mediaType === "movie" && movie.mediaType === "movie") score += 3;
  else if (candidate.mediaType && movie.mediaType && candidate.mediaType !== (movie.mediaType === "tv" ? "series" : "movie")) {
    score -= 10;
  }

  // Title correlation
  if (left && right && !right.includes(left) && !left.includes(right)) {
    if (!intl || (!right.includes(intl) && !intl.includes(right))) {
      score -= 15;
    }
  }

  // Forensic Check 1: On-Screen Text Overlays & Watermarks (Highest reliability)
  if (scene?.textOverlays && scene.textOverlays.length > 0) {
    const overlayTexts = scene.textOverlays.map(norm).filter(Boolean);
    const titleMatch = overlayTexts.some((text) =>
      (left && (text.includes(left) || left.includes(text))) ||
      (right && (text.includes(right) || right.includes(text))) ||
      (intl && (text.includes(intl) || intl.includes(text)))
    );

    if (titleMatch) {
      score += 35; // Definitive on-screen confirmation
    } else {
      // If the overlay contains a title-like word (e.g. 5+ letters) that contradicts this movie, penalize
      const hasContradictingTitle = overlayTexts.some(
        (text) =>
          text.length >= 6 &&
          !text.includes("prime") &&
          !text.includes("netflix") &&
          !text.includes("video") &&
          !text.includes("subscribe") &&
          !text.includes("short") &&
          !left.includes(text) &&
          !right.includes(text)
      );
      if (hasContradictingTitle) {
        score -= 25;
      }
    }
  }

  // Forensic Check 2: Visible Actors cross-checked against Movie Cast
  if (scene?.actors && scene.actors.length > 0) {
    const movieCastNorm = (movie.cast || []).map(norm);
    let matchingActorsCount = 0;

    for (const actor of scene.actors) {
      const aNorm = norm(actor);
      if (aNorm.length < 3) continue;
      if (movieCastNorm.some((c) => c.includes(aNorm) || aNorm.includes(c))) {
        matchingActorsCount++;
      }
    }

    if (matchingActorsCount > 0) {
      score += matchingActorsCount * 20; // Massive confirmation for verified cast
    } else if (movieCastNorm.length > 0 && scene.actors.length >= 1) {
      // The scene clearly shows actor X, but movie cast has completely different people!
      score -= 35;
    }
  }

  // Forensic Check 3: Characters & Plot Summary
  if (scene?.characters && scene.characters.length > 0) {
    const overviewNorm = norm(movie.overview || "");
    const charMatch = scene.characters.some((c) => {
      const cNorm = norm(c);
      return cNorm.length >= 3 && overviewNorm.includes(cNorm);
    });
    if (charMatch) score += 15;
  }

  // Forensic Check 4: Director alignment
  if (candidate.director && movie.director) {
    const dirCand = norm(candidate.director);
    const dirMovie = norm(movie.director);
    if (dirCand && dirMovie && (dirCand.includes(dirMovie) || dirMovie.includes(dirCand))) {
      score += 10;
    }
  }

  return clamp(Math.round(score), 1, 99);
}

export function rankVerified(
  items: { candidate: GeminiCandidate; movie: MovieView }[],
  scene?: SceneContext
) {
  const seen = new Set<string>();
  return items
    .map((item) => ({
      movie: item.movie,
      confidence: scoreCandidate(item.candidate, item.movie, scene),
      explanation: item.candidate.explanation
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .filter((item) => {
      if (seen.has(item.movie.imdbId)) return false;
      seen.add(item.movie.imdbId);
      return true;
    })
    .slice(0, 5);
}
