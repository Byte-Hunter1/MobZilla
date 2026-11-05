import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { uploadVideo } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { jobParamSchema, urlSchema } from "../validators/schemas";
import * as identify from "../controllers/identify.controller";

export const identifyRoutes = Router();

identifyRoutes.post(
  "/upload",
  optionalAuth,
  rateLimit("identify", 10, 60 * 60),
  uploadVideo.single("file"),
  asyncHandler(identify.upload)
);
identifyRoutes.post("/url", optionalAuth, rateLimit("identify", 10, 60 * 60), validate(urlSchema), asyncHandler(identify.url));
identifyRoutes.get("/status/:jobId", validate(jobParamSchema), asyncHandler(identify.status));
identifyRoutes.get("/results/:jobId", validate(jobParamSchema), asyncHandler(identify.results));
