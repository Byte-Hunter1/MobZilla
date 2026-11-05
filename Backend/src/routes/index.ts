import { Router } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { authRoutes } from "./auth.routes";
import { historyRoutes } from "./history.routes";
import { identifyRoutes } from "./identify.routes";
import { movieRoutes } from "./movies.routes";
import { searchRoutes } from "./search.routes";
import { watchlistRoutes } from "./watchlist.routes";

export const api = Router();

api.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  const pong = await redis.ping();
  res.json({ ok: true, postgres: "up", redis: pong === "PONG" ? "up" : "down" });
});

api.use("/auth", authRoutes);
api.use("/identify", identifyRoutes);
api.use("/search", searchRoutes);
api.use("/movies", movieRoutes);
api.use("/watchlist", watchlistRoutes);
api.use("/history", historyRoutes);
