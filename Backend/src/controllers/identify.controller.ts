import fs from "fs/promises";
import { Request, Response } from "express";
import { AppError } from "../lib/errors";
import * as identification from "../services/identification.service";

export async function upload(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, "Choose an MP4, MOV, or WEBM video.", "VALIDATION_ERROR");
  try {
    const job = await identification.createFileJob(req.file, req.user?.id);
    res.status(202).json(job);
  } catch (error) {
    await fs.rm(req.file.path, { force: true });
    throw error;
  }
}

export async function url(req: Request, res: Response) {
  res.status(202).json(await identification.createUrlJob(req.body.url, req.user?.id));
}

export async function status(req: Request, res: Response) {
  res.json(await identification.getStatus(req.params.jobId));
}

export async function results(req: Request, res: Response) {
  res.json(await identification.getResults(req.params.jobId));
}
