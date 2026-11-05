import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { api } from "./routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    })
  );

  const allowedOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/v1", api);
  app.use(errorHandler);
  return app;
}
