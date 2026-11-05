import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  OMDB_API_KEY: z.string().default(""),
  FFMPEG_API_KEY: z.string().default(""),
  FFMPEG_API_URL: z.string().default(""),
  MAX_UPLOAD_MB: z.coerce.number().default(50),
  MAX_DURATION_SECONDS: z.coerce.number().default(180),
  GEMINI_MAX_FRAMES: z.coerce.number().min(2).max(12).default(6),
  STORAGE_DIR: z.string().default("storage"),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  S3_BUCKET: z.string().default(""),
  S3_REGION: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_ENDPOINT: z.string().default(""),
  S3_PUBLIC_BASE_URL: z.string().default("")
});

export const env = schema.parse(process.env);

export const storageRoot = path.resolve(__dirname, "../../", env.STORAGE_DIR);
