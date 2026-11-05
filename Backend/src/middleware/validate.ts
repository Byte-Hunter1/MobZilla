import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../lib/errors";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(" ");
      return next(new AppError(400, message, "VALIDATION_ERROR"));
    }
    const data = parsed.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) req.body = data.body;
    if (data.query !== undefined) req.query = data.query as Request["query"];
    if (data.params !== undefined) req.params = data.params as Request["params"];
    next();
  };
}
