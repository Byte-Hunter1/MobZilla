import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { MovieView } from "./types";

type OmdbPayload = {
  Response?: string;
  Error?: string;
  Title?: string;
  Year?: string;
  imdbID?: string;
  Type?: string;
  Poster?: string;
  Plot?: string;
  imdbRating?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
};

type OmdbSearchPayload = {
  Response?: string;
  Error?: string;
  Search?: {
    Title: string;
    Year: string;
    imdbID: string;
    Type: string;
    Poster: string;
  }[];
  totalResults?: string;
};

export type FindOptions = {
  internationalTitle?: string;
  director?: string;
  actors?: string[];
  imdbId?: string;
};

function clean(value?: string) {
  if (!value || value === "N/A") return "";
  return value;
}

function cleanPoster(poster?: string) {
  if (!poster || poster === "N/A") return null;
  return poster.replace(/^http:\/\//i, "https://");
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/\s*\((19|20)\d\d\)/g, "") // remove (2023), (1999)
    .replace(/\s*\((movie|film|series|tv series)\)/gi, "")
    .replace(/^(the\s+movie\s+|film\s+)/i, "")
    .trim();
}

export function mapOmdb(payload: OmdbPayload): MovieView | null {
  if (payload.Response === "False" || !payload.imdbID || !payload.Title) return null;
  const rating = Number(payload.imdbRating);
  return {
    id: payload.imdbID,
    imdbId: payload.imdbID,
    title: payload.Title,
    year: clean(payload.Year),
    mediaType: payload.Type === "series" ? "tv" : "movie",
    rating: Number.isFinite(rating) ? rating : null,
    posterUrl: cleanPoster(payload.Poster),
    overview: clean(payload.Plot),
    cast: clean(payload.Actors)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
    director: clean(payload.Director),
    genre: clean(payload.Genre),
    streaming: []
  };
}

async function omdb<T = OmdbPayload>(params: Record<string, string>): Promise<T> {
  if (!env.OMDB_API_KEY) {
    throw new AppError(503, "OMDb is not configured", "OMDB_UNAVAILABLE");
  }
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", env.OMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new AppError(502, "OMDb request failed", "OMDB_UNAVAILABLE");
  }
  return (await response.json()) as T;
}

export async function fetchByImdbId(imdbId: string) {
  return mapOmdb(await omdb({ i: imdbId, plot: "short" }));
}

async function searchOmdb(query: string, year?: string, type?: string): Promise<OmdbSearchPayload> {
  return omdb<OmdbSearchPayload>({
    s: query,
    ...(year ? { y: year.slice(0, 4) } : {}),
    ...(type ? { type } : {})
  });
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildAttempts(cleanTitle: string, year4?: string, typeParam?: string): Record<string, string>[] {
  const attempts: Record<string, string>[] = [];
  if (year4 && typeParam) attempts.push({ t: cleanTitle, y: year4, type: typeParam });
  if (year4) attempts.push({ t: cleanTitle, y: year4 });
  if (typeParam) attempts.push({ t: cleanTitle, type: typeParam });
  attempts.push({ t: cleanTitle });
  return attempts;
}

async function tryOmdbAttempts(
  attempts: Record<string, string>[],
  onFound?: (movie: MovieView) => void
): Promise<MovieView | null> {
  for (const params of attempts) {
    try {
      const movie = mapOmdb(await omdb({ ...params, plot: "short" }));
      if (movie) {
        onFound?.(movie);
        return movie;
      }
    } catch {
      // continue
    }
  }
  return null;
}

export async function findByTitle(
  title: string,
  year?: string,
  mediaType?: "movie" | "series",
  options?: FindOptions
): Promise<MovieView | null> {
  const cleanTitle = sanitizeTitle(title);
  const typeParam = mediaType === "series" ? "series" : mediaType === "movie" ? "movie" : "";
  const year4 = year ? year.slice(0, 4) : undefined;

  // 1. If an IMDb ID was provided, verify it strictly before trusting it
  if (options?.imdbId && /^tt\d{6,}$/.test(options.imdbId)) {
    try {
      const byId = await fetchByImdbId(options.imdbId);
      if (byId) {
        const yearMatch = !year4 || Math.abs(Number(byId.year.slice(0, 4)) - Number(year4)) <= 1;
        const normByIdTitle = normalizeStr(byId.title);
        const normCandTitle = normalizeStr(cleanTitle);
        const normIntl = normalizeStr(options?.internationalTitle || "");
        const titleMatch =
          (normCandTitle && (normByIdTitle.includes(normCandTitle) || normCandTitle.includes(normByIdTitle))) ||
          (normIntl && (normByIdTitle.includes(normIntl) || normIntl.includes(normByIdTitle)));
        const dirMatch =
          options?.director && normalizeStr(byId.director).includes(normalizeStr(options.director));

        // Only accept if year matches AND (title matches OR director matches)
        if (yearMatch && (titleMatch || dirMatch)) {
          if (cleanTitle && !normByIdTitle.includes(normCandTitle)) {
            byId.title = `${cleanTitle} (${byId.title})`;
          }
          return byId;
        }
      }
    } catch {
      // Continue to title lookups
    }
  }

  // 2. Try International / Alternate Title exact lookup if provided (e.g., "Husband Material" for "Manmarziyaan")
  if (options?.internationalTitle && options.internationalTitle.trim().length > 0) {
    const intlClean = sanitizeTitle(options.internationalTitle);
    const result = await tryOmdbAttempts(buildAttempts(intlClean, year4, typeParam), (movie) => {
      if (cleanTitle && normalizeStr(cleanTitle) !== normalizeStr(movie.title)) {
        movie.title = `${cleanTitle} (${movie.title})`;
      }
    });
    if (result) return result;
  }

  // 3. Try Canonical Title exact lookup (with clean title, with/without year, with/without type)
  const canonical = await tryOmdbAttempts(buildAttempts(cleanTitle, year4, typeParam));
  if (canonical) return canonical;

  // 4. Fuzzy OMDb Search endpoint fallback (s=cleanTitle)
  const searchQueries: string[] = [];
  if (options?.internationalTitle) searchQueries.push(sanitizeTitle(options.internationalTitle));
  if (cleanTitle) searchQueries.push(cleanTitle);

  for (const q of searchQueries) {
    try {
      const searchRes = await searchOmdb(q, year4, typeParam);
      if (searchRes.Response === "True" && searchRes.Search && searchRes.Search.length > 0) {
        for (const candidate of searchRes.Search.slice(0, 3)) {
          const detailed = await fetchByImdbId(candidate.imdbID);
          if (!detailed) continue;

          // Check if director or any actor matches our forensic clues
          const normCast = detailed.cast.map(normalizeStr);
          const actorMatches = options?.actors?.some((a) =>
            normCast.some((c) => c.includes(normalizeStr(a)) || normalizeStr(a).includes(c))
          );
          const directorMatches =
            options?.director && normalizeStr(detailed.director).includes(normalizeStr(options.director));

          if (actorMatches || directorMatches) {
            if (cleanTitle && !normalizeStr(detailed.title).includes(normalizeStr(cleanTitle))) {
              detailed.title = `${cleanTitle} (${detailed.title})`;
            }
            return detailed;
          }
        }

        // If no actor check was specified or no specific actor matched, use top search result if year aligns
        const top = await fetchByImdbId(searchRes.Search[0].imdbID);
        if (top) {
          const topYear = top.year.slice(0, 4);
          if (!year4 || Math.abs(Number(topYear) - Number(year4)) <= 2) {
            if (cleanTitle && !normalizeStr(top.title).includes(normalizeStr(cleanTitle))) {
              top.title = `${cleanTitle} (${top.title})`;
            }
            return top;
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return null;
}
