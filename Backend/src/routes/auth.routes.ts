import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validators/schemas";
import * as auth from "../controllers/auth.controller";

export const authRoutes = Router();

authRoutes.post("/register", rateLimit("register", 10, 15 * 60), validate(registerSchema), asyncHandler(auth.register));
authRoutes.post("/login", rateLimit("login", 20, 15 * 60), validate(loginSchema), asyncHandler(auth.login));
authRoutes.get("/me", optionalAuth, requireAuth, asyncHandler(auth.me));
