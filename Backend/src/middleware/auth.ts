import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

type TokenPayload = { sub: string; email: string };

function readToken(req: Request) {
  const header = req.header("authorization") || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = { id: payload.sub, email: payload.email };
  } catch {
    return next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError(401, "Sign in required", "UNAUTHORIZED"));
  next();
}
