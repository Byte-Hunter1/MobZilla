const BASE = import.meta.env.VITE_API || "/api/v1";

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("mz_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Request failed");
  }
  return data;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getToken() {
  return localStorage.getItem("mz_token");
}

export function setSession(token) {
  if (token) localStorage.setItem("mz_token", token);
  else localStorage.removeItem("mz_token");
}

export async function register(body) {
  return request("/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export async function login(body) {
  return request("/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export async function currentUser() {
  const data = await request("/auth/me");
  return data.user;
}

export const getPosters = () => request("/movies/posters");

export const getDiscovery = () => request("/movies/discovery");

export const getRandomMovie = () => request("/movies/discovery/random");

export const getMovie = (imdbId) => request(`/movies/${imdbId}`);

export const getRecommendations = (imdbId) => request(`/movies/${imdbId}/recommendations`);

export const getShare = (token) => request(`/movies/share/${token}`);

export const getWatchlist = () => request("/watchlist");

export const addWatchlist = (imdbId) => request("/watchlist", { method: "POST", body: JSON.stringify({ imdbId }) });

export const updateWatchlist = (imdbId, status) =>
  request(`/watchlist/${imdbId}`, { method: "PATCH", body: JSON.stringify({ status }) });

export const removeWatchlist = (imdbId) => request(`/watchlist/${imdbId}`, { method: "DELETE" });

export const getHistory = () => request("/history");

export const clearHistory = () => request("/history", { method: "DELETE" });

async function pollJob(jobId, onStatus) {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const status = await request(`/identify/status/${jobId}`);
    if (onStatus) onStatus(status);
    if (status.status === "completed") {
      const payload = await request(`/identify/results/${jobId}`);
      return { ...payload.result, shareToken: payload.shareToken };
    }
    if (status.status === "failed") throw new Error(status.error || "Identification failed");
    await delay(1500);
  }
  throw new Error("Identification is still running. Check History after you sign in.");
}

export async function identify(file, onStatus) {
  const body = new FormData();
  body.append("file", file);
  const created = await request("/identify/upload", { method: "POST", body });
  return pollJob(created.jobId, onStatus);
}

export async function identifyLink(url, onStatus) {
  const created = await request("/identify/url", { method: "POST", body: JSON.stringify({ url }) });
  return pollJob(created.jobId, onStatus);
}

export async function searchByDescription(query) {
  return request("/search/description", { method: "POST", body: JSON.stringify({ query }) });
}
