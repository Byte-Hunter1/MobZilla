import { Request, Response } from "express";
import * as watchlist from "../services/watchlist.service";

export async function list(req: Request, res: Response) {
  res.json(await watchlist.listWatchlist(req.user!.id));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await watchlist.addWatchlist(req.user!.id, req.body.imdbId, req.body.status));
}

export async function update(req: Request, res: Response) {
  res.json(await watchlist.updateWatchlist(req.user!.id, req.params.imdbId, req.body.status));
}

export async function remove(req: Request, res: Response) {
  await watchlist.removeWatchlist(req.user!.id, req.params.imdbId);
  res.status(204).end();
}
