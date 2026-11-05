# MobZilla Architecture Documentation

MobZilla is an AI-powered cinematic scene identification platform that identifies movies, television shows, and miniseries from short video clips, YouTube/Shorts links, or natural language scene descriptions.

---

## 1. High-Level Architecture

```
                       +----------------------------+
                       |       React Client         |
                       | (Vite + Modern Responsive) |
                       +--------------+-------------+
                                      |
                              HTTP / REST API
                                      |
                       +--------------v-------------+
                       |    Express.js Gateway      |
                       |    (TypeScript, Helmet)    |
                       +-------+--------------+-----+
                               |              |
                      Enqueues |              | Queries
                               |              |
             +-----------------v----+     +---v----------------+
             |   BullMQ Job Queue   |     |   PostgreSQL DB    |
             |       (Redis)        |     |  (Prisma ORM 6.x)  |
             +-----------------+----+     +--------------------+
                               |
                        Workers Process
                               |
             +-----------------v--------------------+
             |         Identify Worker              |
             |                                      |
             |  1. FFmpeg Frame Extraction          |
             |  2. Gemini Multimodal Analysis       |
             |  3. OMDb Forensic Verification       |
             |  4. Weighted Confidence Ranking      |
             +--------------------------------------+
```

---

## 2. Core Components

### 2.1 Frontend (`Frontend/`)
- **Technology**: React 18, Vite 5, CSS3 Custom Properties.
- **Key Modules**:
  - `Tunnel.jsx`: Interactive 3D cinematic poster tunnel.
  - `Upload.jsx`: Drag-and-drop clip uploader with real-time video preview.
  - `LinkInput.jsx`: Instant YouTube / Shorts link resolver.
  - `SearchDescription.jsx`: Natural-language AI detective search.
  - `MovieDiscovery.jsx`: Curated trending, popular series, hidden gems, and randomizer.
  - `Watchlist.jsx`: Personal Want to Watch / Watched management.
  - `History.jsx`: Searchable identification logs with filter tags.
  - `ShareModal.jsx`: Multi-platform result sharing (Web Share, WhatsApp, Telegram, X, Reddit).

### 2.2 Backend API (`Backend/src/`)
- **Technology**: Node.js 20+, Express.js, TypeScript.
- **Middleware**:
  - `rateLimit.ts`: Redis-backed sliding-window rate limiters.
  - `auth.ts`: JWT bearer token validation.
  - `upload.ts`: Multer disk storage with MIME/extension validation.
  - `validate.ts`: Zod schema validation for request payloads.
  - `errorHandler.ts`: Centralized error normalization with distinct HTTP status codes.

### 2.3 Asynchronous Pipeline (`Backend/src/queues/` & `workers/`)
- **Queue**: BullMQ on Redis.
- **Concurrency**: Configurable parallel workers with exponential backoff retry.
- **Lifecycle**:
  1. `Queued` (5%): Job validated and enqueued.
  2. `Extracting` (20%): Probing video metadata and extracting representative keyframes via FFmpeg.
  3. `Analyzing` (55%): Gemini multimodal vision extracts visual clues, dialogue, cast faces, and text watermarks.
  4. `Verifying` (80%): Forensic verification of candidates against OMDb.
  5. `Completed` (100%): Weighted scoring, ranking, similar recommendations generation, and caching.

---

## 3. Forensic Identification & Ranking Pipeline

The ranking engine (`ranking.service.ts`) computes a weighted confidence score (0-100) based on multiple forensic signals:

1. **On-Screen Text & Watermark Verification (+35 / -25)**:
   - Detects channel logos, subtitle strings, and movie title watermarks in frames.
   - Boosts exact title matches and penalizes conflicting title overlays.
2. **Actor & Cast Cross-Validation (+20 per actor / -35 penalty)**:
   - Matches faces recognized by Gemini against official OMDb cast listings.
   - Severely penalizes candidates whose official cast contradicts detected actors.
3. **Year and Media Type Consistency**:
   - Compares release year and media type (`movie` vs `series`).
4. **Plot & Climax Correlation (+15)**:
   - Cross-references character names and plot climaxes against official overviews.

---

## 4. Multi-Tier Caching Strategy

```
Client Request
      │
      ├──> 1. Redis Cache (In-Memory, TTL 6h - 7d)
      │         └── Hits return instantly (< 5ms)
      │
      ├──> 2. PostgreSQL Lookup Cache (`LookupCache` table)
      │         └── File SHA-256 hash or YouTube video ID match
      │
      └──> 3. Execution Pipeline (Gemini + FFmpeg + OMDb)
                └── Stores results back to Redis & PostgreSQL
```

---

## 5. Deployment Architecture

- **Development**: Docker Compose manages PostgreSQL (5433) and Redis (6379), while `npm run dev` powers backend and frontend with hot reloading.
- **Production (`docker-compose.prod.yml`)**:
  - `postgres:16-alpine`: Persistent database volume.
  - `redis:7-alpine`: Persistent caching and queuing.
  - `backend`: Multi-stage Docker container running compiled TypeScript API & worker.
  - `frontend`: Multi-stage build served through Nginx with reverse proxy to the API.
