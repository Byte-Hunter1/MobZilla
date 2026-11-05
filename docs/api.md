# MobZilla API Reference

Base URL: `http://localhost:4000/api/v1`

---

## 1. Authentication

All authenticated endpoints require an `Authorization: Bearer <token>` HTTP header.

### 1.1 Register
- **Path**: `POST /auth/register`
- **Rate Limit**: 10 requests / 15 minutes
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "name": "Jane Doe"
  }
  ```
- **Response** `(201 Created)`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "cm...uuid",
      "email": "user@example.com",
      "name": "Jane Doe"
    }
  }
  ```

### 1.2 Login
- **Path**: `POST /auth/login`
- **Rate Limit**: 20 requests / 15 minutes
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response** `(200 OK)`:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "cm...uuid",
      "email": "user@example.com",
      "name": "Jane Doe"
    }
  }
  ```

### 1.3 Current User
- **Path**: `GET /auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** `(200 OK)`:
  ```json
  {
    "user": {
      "id": "cm...uuid",
      "email": "user@example.com",
      "name": "Jane Doe"
    }
  }
  ```

---

## 2. Identification Pipeline

### 2.1 Upload Video Clip
- **Path**: `POST /identify/upload`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (MP4, MOV, WEBM, max 50 MB, <= 180s)
- **Response** `(202 Accepted)`:
  ```json
  {
    "jobId": "cm...uuid"
  }
  ```

### 2.2 Submit Video URL
- **Path**: `POST /identify/url`
- **Rate Limit**: 10 requests / hour
- **Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
  ```
- **Response** `(202 Accepted)`:
  ```json
  {
    "jobId": "cm...uuid"
  }
  ```

### 2.3 Poll Job Status
- **Path**: `GET /identify/status/:jobId`
- **Response** `(200 OK)`:
  ```json
  {
    "jobId": "cm...uuid",
    "status": "analyzing",
    "progress": 55,
    "stage": "Analyzing scene frames with Gemini",
    "error": null
  }
  ```

### 2.4 Get Identification Results
- **Path**: `GET /identify/results/:jobId`
- **Response** `(200 OK)`:
  ```json
  {
    "jobId": "cm...uuid",
    "status": "completed",
    "shareToken": "Abc123XyZ",
    "result": {
      "match": {
        "id": "tt1375666",
        "imdbId": "tt1375666",
        "title": "Inception",
        "year": "2010",
        "mediaType": "movie",
        "rating": 8.8,
        "posterUrl": "https://m.media-amazon.com/...",
        "overview": "A thief who steals corporate secrets...",
        "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
        "director": "Christopher Nolan",
        "genre": "Action, Sci-Fi",
        "streaming": [],
        "sceneDetective": {
          "description": "Zero gravity hotel corridor fight scene",
          "characters": ["Arthur"],
          "visualElements": ["Rotating hallway", "Floating debris"]
        },
        "recommendations": []
      },
      "confidence": 98,
      "reasoning": "Corridor fight matches Inception climax scene.",
      "alternatives": [],
      "sourceType": "file",
      "sourceUrl": null
    }
  }
  ```

---

## 3. Scene Search by Description

### 3.1 AI Description Search
- **Path**: `POST /search/description`
- **Rate Limit**: 20 requests / hour
- **Body**:
  ```json
  {
    "query": "A spinning top that keeps wobbling in a dream state"
  }
  ```
- **Response** `(200 OK)`: Returns full identification result structure.

---

## 4. Movie Catalog & Discovery

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/movies/discovery` | Returns curated lists: `trending`, `popular_series`, `hidden_gems` |
| `GET` | `/movies/discovery/random` | Returns a single random title from the curated catalog |
| `GET` | `/movies/posters` | Returns poster metadata for the 3D tunnel display |
| `GET` | `/movies/:imdbId` | Returns comprehensive movie details from OMDb |
| `GET` | `/movies/:imdbId/recommendations` | Returns 8 AI-curated and OMDb-verified recommendation titles |
| `GET` | `/movies/share/:token` | Resolves a public share token to view shared results |
| `GET` | `/movies/poster-proxy?url=...` | Proxies and caches external movie posters to avoid mixed-content issues |

---

## 5. Watchlist Management

Requires `Authorization: Bearer <token>`.

- `GET /watchlist`: List all user watchlist items.
- `POST /watchlist`: Add a movie (`{ "imdbId": "tt1375666", "status": "want" }`).
- `PATCH /watchlist/:imdbId`: Toggle status (`{ "status": "watched" }`).
- `DELETE /watchlist/:imdbId`: Remove item.

---

## 6. History Management

Requires `Authorization: Bearer <token>`.

- `GET /history`: Fetch up to 50 previous identification jobs for the authenticated user.
- `DELETE /history`: Clear user identification history.

---

## 7. System Health

- `GET /health`:
  ```json
  {
    "ok": true,
    "postgres": "up",
    "redis": "up"
  }
  ```
