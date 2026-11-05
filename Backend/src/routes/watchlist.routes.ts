import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { imdbParamSchema, watchlistCreateSchema, watchlistPatchSchema } from "../validators/schemas";
import * as watchlist from "../controllers/watchlist.controller";

export const watchlistRoutes = Router();

watchlistRoutes.use(optionalAuth, requireAuth);
watchlistRoutes.get("/", asyncHandler(watchlist.list));
watchlistRoutes.post("/", validate(watchlistCreateSchema), asyncHandler(watchlist.create));
watchlistRoutes.patch("/:imdbId", validate(watchlistPatchSchema), asyncHandler(watchlist.update));
watchlistRoutes.delete("/:imdbId", validate(imdbParamSchema), asyncHandler(watchlist.remove));
