import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { redis } from "../lib/redis";

export function rateLimit(prefix: string, limit: number, windowSec: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = `rl:${prefix}:${req.ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      if (count > limit) {
        return next(new AppError(429, "Too many requests. Try again later.", "RATE_LIMITED"));
      }
      next();
    } catch {
      next(new AppError(503, "Rate limiter is unavailable", "REDIS_UNAVAILABLE"));
    }
  };
}
