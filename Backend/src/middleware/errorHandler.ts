import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { log } from "../lib/logger";

function sendError(res: Response, status: number, message: string, code: string) {
  res.status(status).json({ error: { message, code } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    sendError(res, err.status, err.message, err.code);
    return;
  }
  if (err instanceof ZodError) {
    sendError(res, 400, err.issues.map((i) => i.message).join(" "), "VALIDATION_ERROR");
    return;
  }
  if (err instanceof Error && err.message.includes("Only MP4")) {
    sendError(res, 400, err.message, "VALIDATION_ERROR");
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Video must be 50 MB or smaller." : err.message;
    sendError(res, 400, message, "VALIDATION_ERROR");
    return;
  }
  log.error("unhandled error", { error: err instanceof Error ? err.message : "unknown" });
  sendError(res, 500, "Unexpected server error", "INTERNAL");
}
