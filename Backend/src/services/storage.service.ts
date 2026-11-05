import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export type StoredObject = { key: string; url: string | null };

function cloudinaryReady() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function s3Ready() {
  return Boolean(env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

async function uploadCloudinary(localPath: string): Promise<StoredObject> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
    .digest("hex");
  const bytes = await fs.readFile(localPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), path.basename(localPath));
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  const payload = (await response.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || "Cloudinary upload failed");
  }
  return { key: payload.public_id || payload.secure_url, url: payload.secure_url };
}

async function uploadS3(localPath: string): Promise<StoredObject> {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
  });
  const key = `videos/${path.basename(localPath)}`;
  const body = await fs.readFile(localPath);
  await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: "video/mp4" }));
  const url = env.S3_PUBLIC_BASE_URL ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` : null;
  return { key, url };
}

export async function storeVideo(localPath: string): Promise<StoredObject | null> {
  if (cloudinaryReady()) return uploadCloudinary(localPath);
  if (s3Ready()) return uploadS3(localPath);
  return null;
}

export async function removeFile(filePath?: string | null) {
  if (!filePath) return;
  await fs.rm(filePath, { force: true });
}
