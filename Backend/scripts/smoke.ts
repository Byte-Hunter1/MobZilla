const base = process.env.SMOKE_BASE || "http://localhost:4000/api/v1";

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data };
}

async function main() {
  const health = await request("/health");
  if (health.status !== 200 || !health.data.ok) throw new Error(`health failed ${health.status}`);

  const email = `smoke-${Date.now()}@example.com`;
  const registered = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", name: "Smoke" })
  });
  if (registered.status !== 201) throw new Error(`register failed ${JSON.stringify(registered.data)}`);
  const token = registered.data.token as string;

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123" })
  });
  if (login.status !== 200) throw new Error("login failed");

  const bad = await request("/identify/url", { method: "POST", body: JSON.stringify({ url: "https://example.com/video" }) });
  if (bad.status !== 400) throw new Error(`expected 400 for unsupported url, got ${bad.status}`);

  const reel = await request("/identify/url", {
    method: "POST",
    body: JSON.stringify({ url: "https://www.instagram.com/reel/ExampleReel/" })
  });
  if (reel.status !== 422) throw new Error(`expected 422 for instagram, got ${reel.status}`);

  const empty = await request("/watchlist", {}, token);
  if (empty.status !== 200 || !Array.isArray(empty.data) || empty.data.length !== 0) throw new Error("watchlist was not empty");

  const added = await request("/watchlist", { method: "POST", body: JSON.stringify({ imdbId: "tt1375666" }) }, token);
  if (added.status !== 201 || added.data.imdbId !== "tt1375666" || !added.data.title) {
    throw new Error(`watchlist add failed ${JSON.stringify(added.data)}`);
  }

  const patched = await request("/watchlist/tt1375666", { method: "PATCH", body: JSON.stringify({ status: "watched" }) }, token);
  if (patched.status !== 200 || patched.data.status !== "watched") throw new Error("watchlist patch failed");

  const removed = await request("/watchlist/tt1375666", { method: "DELETE" }, token);
  if (removed.status !== 204) throw new Error("watchlist delete failed");

  const movie = await request("/movies/tt0111161");
  if (movie.status !== 200 || movie.data.imdbId !== "tt0111161" || !movie.data.title) {
    throw new Error(`movie lookup failed ${JSON.stringify(movie.data)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    health: health.data,
    watchlistTitle: added.data.title,
    movieTitle: movie.data.title
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
