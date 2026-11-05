import { Request, Response } from "express";
import { searchByDescription } from "../services/identification.service";

export async function description(req: Request, res: Response) {
  res.json(await searchByDescription(req.body.query, req.user?.id));
}
