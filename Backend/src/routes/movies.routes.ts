import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { imdbParamSchema, shareParamSchema } from "../validators/schemas";
import * as movies from "../controllers/movies.controller";

export const movieRoutes = Router();

movieRoutes.get("/posters", asyncHandler(movies.posters));
movieRoutes.get("/poster-proxy", asyncHandler(movies.posterProxy));
movieRoutes.get("/discovery/random", asyncHandler(movies.random));
movieRoutes.get("/discovery", asyncHandler(movies.discovery));
movieRoutes.get("/share/:token", validate(shareParamSchema), asyncHandler(movies.share));
movieRoutes.get("/:imdbId/recommendations", rateLimit("recs", 30, 60 * 60), validate(imdbParamSchema), asyncHandler(movies.recommendations));
movieRoutes.get("/:imdbId", validate(imdbParamSchema), asyncHandler(movies.movie));
