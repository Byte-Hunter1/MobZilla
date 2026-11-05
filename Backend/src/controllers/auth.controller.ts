import { Request, Response } from "express";
import * as auth from "../services/auth.service";

export async function register(req: Request, res: Response) {
  res.status(201).json(await auth.register(req.body));
}

export async function login(req: Request, res: Response) {
  res.json(await auth.login(req.body));
}

export async function me(req: Request, res: Response) {
  res.json({ user: await auth.me(req.user!.id) });
}
