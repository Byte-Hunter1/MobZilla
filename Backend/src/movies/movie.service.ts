import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { AppError } from "../lib/errors";
import { fetchByImdbId } from "./omdb.client";
import { ALL_FEATURED_IDS, FEATURED } from "./featuredIds";
import { MovieView } from "./types";

const MOVIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_TTL_SEC = 6 * 60 * 60;

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = await Promise.all(items.slice(i, i + limit).map(fn));
    out.push(...chunk);
  }
  return out;
}

export async function getMovie(imdbId: string): Promise<MovieView> {
  const cachedRedis = await redis.get(`movie:${imdbId}`);
  if (cachedRedis) return JSON.parse(cachedRedis) as MovieView;

  const cachedDb = await prisma.movieCache.findUnique({ where: { imdbId } });
  if (cachedDb && Date.now() - cachedDb.fetchedAt.getTime() < MOVIE_TTL_MS) {
    const movie = cachedDb.payload as MovieView;
    await redis.set(`movie:${imdbId}`, JSON.stringify(movie), "EX", LIST_TTL_SEC);
    return movie;
  }

  const movie = await fetchByImdbId(imdbId);
  if (!movie) throw new AppError(404, "OMDb has no record for that IMDb id", "NOT_FOUND");
  await prisma.movieCache.upsert({
    where: { imdbId },
    create: { imdbId, payload: movie },
    update: { payload: movie, fetchedAt: new Date() }
  });
  await redis.set(`movie:${imdbId}`, JSON.stringify(movie), "EX", LIST_TTL_SEC);
  return movie;
}

async function loadIds(ids: string[]) {
  const movies = await mapPool(ids, 4, async (id) => {
    try {
      return await getMovie(id);
    } catch {
      return null;
    }
  });
  return movies.filter((movie): movie is MovieView => Boolean(movie));
}

export async function getDiscovery() {
  const cached = await redis.get("discovery:v1");
  if (cached) return JSON.parse(cached) as Record<string, MovieView[]>;
  const payload = {
    trending: await loadIds(FEATURED.trending),
    popular_series: await loadIds(FEATURED.popular_series),
    hidden_gems: await loadIds(FEATURED.hidden_gems)
  };
  if (payload.trending.length + payload.popular_series.length + payload.hidden_gems.length === 0) {
    throw new AppError(502, "OMDb did not return the featured catalog", "OMDB_UNAVAILABLE");
  }
  await redis.set("discovery:v1", JSON.stringify(payload), "EX", LIST_TTL_SEC);
  return payload;
}

export async function getPosters() {
  const discovery = await getDiscovery();
  return discovery.trending.slice(0, 12).map((movie) => ({
    id: movie.imdbId,
    title: movie.title,
    posterUrl: movie.posterUrl
  }));
}

export async function getRandomMovie() {
  const id = ALL_FEATURED_IDS[Math.floor(Math.random() * ALL_FEATURED_IDS.length)];
  return getMovie(id);
}
