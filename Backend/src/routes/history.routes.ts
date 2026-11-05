import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import * as history from "../controllers/history.controller";

export const historyRoutes = Router();

historyRoutes.use(optionalAuth, requireAuth);
historyRoutes.get("/", asyncHandler(history.list));
historyRoutes.delete("/", asyncHandler(history.clear));
