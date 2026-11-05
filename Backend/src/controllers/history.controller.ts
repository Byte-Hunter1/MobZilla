import { Request, Response } from "express";
import * as history from "../services/history.service";

export async function list(req: Request, res: Response) {
  res.json(await history.listHistory(req.user!.id));
}

export async function clear(req: Request, res: Response) {
  await history.clearHistory(req.user!.id);
  res.status(204).end();
}
