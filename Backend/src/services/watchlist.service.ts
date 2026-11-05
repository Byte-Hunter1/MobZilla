import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { getMovie } from "../movies/movie.service";

function toCard(item: {
  imdbId: string;
  status: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  mediaType: string | null;
  rating: number | null;
  overview: string | null;
  createdAt: Date;
}) {
  return {
    id: item.imdbId,
    imdbId: item.imdbId,
    title: item.title,
    year: item.year || "",
    posterUrl: item.posterUrl,
    mediaType: item.mediaType || "movie",
    rating: item.rating,
    overview: item.overview || "",
    status: item.status,
    addedAt: item.createdAt.toISOString()
  };
}

export async function listWatchlist(userId: string) {
  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return items.map(toCard);
}

export async function addWatchlist(userId: string, imdbId: string, status: "want" | "watched" = "want") {
  const movie = await getMovie(imdbId);
  const item = await prisma.watchlistItem.upsert({
    where: { userId_imdbId: { userId, imdbId } },
    create: {
      userId,
      imdbId,
      status,
      title: movie.title,
      year: movie.year,
      posterUrl: movie.posterUrl,
      mediaType: movie.mediaType,
      rating: movie.rating,
      overview: movie.overview
    },
    update: { status }
  });
  return toCard(item);
}

export async function updateWatchlist(userId: string, imdbId: string, status: "want" | "watched") {
  const count = await prisma.watchlistItem.updateMany({
    where: { userId, imdbId },
    data: { status }
  });
  if (count.count === 0) throw new AppError(404, "That title is not on your watchlist", "NOT_FOUND");
  const item = await prisma.watchlistItem.findUnique({ where: { userId_imdbId: { userId, imdbId } } });
  return toCard(item!);
}

export async function removeWatchlist(userId: string, imdbId: string) {
  const count = await prisma.watchlistItem.deleteMany({ where: { userId, imdbId } });
  if (count.count === 0) throw new AppError(404, "That title is not on your watchlist", "NOT_FOUND");
}
