import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { descriptionSchema } from "../validators/schemas";
import * as search from "../controllers/search.controller";

export const searchRoutes = Router();

searchRoutes.post(
  "/description",
  optionalAuth,
  rateLimit("search", 20, 60 * 60),
  validate(descriptionSchema),
  asyncHandler(search.description)
);
