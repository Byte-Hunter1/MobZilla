# Mobzilla

Upload a short clip or paste a public YouTube link. The backend samples a few frames with FFmpeg, asks Google Gemini what the scene might be, then keeps only titles that OMDb can verify.

The frontend is React, Vite, and the existing CSS. It no longer ships a local movie catalog or calls Gemini from the browser.

## What you need

- Node.js 20+
- Docker, for PostgreSQL and Redis
- A Gemini API key and an OMDb API key
- FFmpeg on your PATH, or Docker so the backend can run `jrottenberg/ffmpeg`

Instagram Reels are validated and then refused. Instagram does not offer an authorized way for this app to fetch Reel video. Upload the clip instead. Private YouTube videos are reported as inaccessible.

## Setup

```bash
docker compose up -d
cd Backend
cp .env.example .env
# fill in JWT_SECRET, GEMINI_API_KEY, and OMDB_API_KEY
npm install
npx prisma db push
npm run dev
```

Postgres is published on port 5433 so it does not collide with another local Postgres. The API listens on http://localhost:4000. `GET /api/v1/health` checks PostgreSQL and Redis.

```bash
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173. `Frontend/.env` should contain `VITE_API=http://localhost:4000/api/v1`.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | no | Create an account |
| POST | `/api/v1/auth/login` | no | Returns a JWT |
| GET | `/api/v1/auth/me` | yes | Current user |
| POST | `/api/v1/identify/upload` | optional | Multipart field `file`. Returns `{ jobId }` |
| POST | `/api/v1/identify/url` | optional | `{ url }` for public YouTube or Shorts |
| GET | `/api/v1/identify/status/:jobId` | no | Poll `status`, `progress`, and `stage` |
| GET | `/api/v1/identify/results/:jobId` | no | Finished identification |
| POST | `/api/v1/search/description` | optional | `{ query }` natural-language scene search |
| GET | `/api/v1/movies/:imdbId` | no | OMDb details |
| GET | `/api/v1/movies/:imdbId/recommendations` | no | Similar titles verified with OMDb |
| GET | `/api/v1/movies/posters` | no | Poster tunnel |
| GET | `/api/v1/movies/discovery` | no | Featured movies, series, and a smaller catalog |
| GET | `/api/v1/movies/discovery/random` | no | One catalog title |
| GET | `/api/v1/movies/share/:token` | no | Shared identification |
| GET | `/api/v1/watchlist` | yes | Personal list |
| POST | `/api/v1/watchlist` | yes | `{ imdbId, status? }` |
| PATCH | `/api/v1/watchlist/:imdbId` | yes | `{ status: "want" or "watched" }` |
| DELETE | `/api/v1/watchlist/:imdbId` | yes | Remove a title |
| GET | `/api/v1/history` | yes | Identification history |
| DELETE | `/api/v1/history` | yes | Clear history |

Upload and URL identification return immediately with a job id. The worker runs: probe and frame extraction, Gemini, OMDb verification, ranking. Repeat uploads of the same file and repeat YouTube videos reuse a stored result so Gemini is not called again.

Errors look like `{ "error": { "message": "...", "code": "VALIDATION_ERROR" } }`.

## Storage and limits

Accepted uploads are MP4, MOV, and WEBM, up to 50 MB and 180 seconds. Four frames or fewer are sent to Gemini, scaled to 512 pixels wide. Local video files are deleted after processing. Set Cloudinary or S3 variables in `.env` to keep a private copy.

Do not commit `.env`. Identification uses your Gemini quota. The default limit is 10 identification requests per IP per hour.

## Checks

```bash
cd Backend
npm run check
npm run smoke
```

`npm run check` tests ranking without calling Gemini. `npm run smoke` needs the API to be running. It registers a user, checks URL validation, saves a real OMDb title, and reads another title.
