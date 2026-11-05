import fs from "fs";
import path from "path";
import multer from "multer";
import { env, storageRoot } from "../config/env";

const uploadDir = path.join(storageRoot, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set([".mp4", ".mov", ".webm"]);

export const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ["video/mp4", "video/quicktime", "video/webm"].includes(file.mimetype) || file.mimetype === "application/octet-stream";
    if (!allowed.has(ext) || !mimeOk) {
      cb(new Error("Only MP4, MOV, and WEBM videos are accepted."));
      return;
    }
    cb(null, true);
  }
});
