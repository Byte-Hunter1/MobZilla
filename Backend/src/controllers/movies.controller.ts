import { Request, Response } from "express";
import { getDiscovery, getMovie, getPosters, getRandomMovie } from "../movies/movie.service";
import { getShare, recommend } from "../services/identification.service";

export async function movie(req: Request, res: Response) {
  res.json(await getMovie(req.params.imdbId));
}

export async function recommendations(req: Request, res: Response) {
  res.json({ recommendations: await recommend(req.params.imdbId) });
}

export async function discovery(_req: Request, res: Response) {
  res.json(await getDiscovery());
}

export async function posters(_req: Request, res: Response) {
  res.json(await getPosters());
}

export async function random(_req: Request, res: Response) {
  res.json(await getRandomMovie());
}

export async function share(req: Request, res: Response) {
  res.json(await getShare(req.params.token));
}

export async function posterProxy(req: Request, res: Response) {
  const url = String(req.query.url || "");
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).end("Invalid image url");
    return;
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch {
    res.status(502).end();
  }
}
