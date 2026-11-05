import { useCallback, useEffect, useRef, useState } from "react";
import { getDiscovery, getRandomMovie } from "../api.js";

export default function MovieDiscovery({ onSave, saved = [], onAnalyzeMovie }) {
  const [activeTab, setActiveTab] = useState("trending"); // 'trending' | 'popular_series' | 'hidden_gems' | 'random'
  const [catalog, setCatalog] = useState({ trending: [], popular_series: [], hidden_gems: [] });
  const [randomPick, setRandomPick] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    getDiscovery().then(setCatalog).catch((err) => setError(err.message || "Could not load movies"));
  }, []);

  const handleRollRandom = useCallback(async () => {
    setIsRolling(true);
    setError("");
    const pool = [...catalog.trending, ...catalog.popular_series, ...catalog.hidden_gems];
    let counter = 0;
    const interval = setInterval(() => {
      if (pool.length) setRandomPick(pool[counter % pool.length]);
      counter++;
      if (counter > 8) clearInterval(interval);
    }, 90);
    try {
      const movie = await getRandomMovie();
      setTimeout(() => {
        setRandomPick(movie);
        setIsRolling(false);
      }, 900);
    } catch (err) {
      clearInterval(interval);
      setIsRolling(false);
      setError(err.message || "Could not load a random title");
    }
  }, [catalog]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === "random" && !randomPick) {
      handleRollRandom();
    }
  }, [randomPick, handleRollRandom]);

  const scroll = useCallback((direction) => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -340 : 340;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, []);

  const currentList = catalog[activeTab] || catalog.trending;

  return (
    <div className="discovery-section">
      <div className="discovery-header">
        <div>
          <h2>Movie Discovery</h2>
          <p className="sub">Explore top-rated cinema, trending series, overlooked gems, or roll for a surprise.</p>
        </div>

        <div className="discovery-tabs">
          <button
            className={`disc-tab ${activeTab === "trending" ? "active" : ""}`}
            onClick={() => handleTabChange("trending")}
          >
            Featured Movies
          </button>
          <button
            className={`disc-tab ${activeTab === "popular_series" ? "active" : ""}`}
            onClick={() => handleTabChange("popular_series")}
          >
            📺 Popular TV Series
          </button>
          <button
            className={`disc-tab ${activeTab === "hidden_gems" ? "active" : ""}`}
            onClick={() => handleTabChange("hidden_gems")}
          >
            💎 Hidden Gems
          </button>
          <button
            className={`disc-tab random-tab ${activeTab === "random" ? "active" : ""}`}
            onClick={() => handleTabChange("random")}
          >
            🎲 Random Discovery
          </button>
        </div>
      </div>

      {activeTab === "random" ? (
        <div className="random-discovery-box">
          <div className="random-dice-bar">
            <div>
              <h3>Feeling adventurous?</h3>
              <p className="sub">Let the cinematic dice decide what masterpiece you explore next.</p>
            </div>
            <button
              className={`roll-dice-btn ${isRolling ? "rolling" : ""}`}
              onClick={handleRollRandom}
              disabled={isRolling}
            >
              🎲 {isRolling ? "Rolling Vault…" : "Roll the Dice!"}
            </button>
          </div>

          {randomPick && (
            <div className={`result random-movie-card ${isRolling ? "fade-in" : ""}`}>
              {randomPick.posterUrl ? (
                <img
                  className="poster"
                  src={randomPick.posterUrl}
                  alt={randomPick.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (randomPick.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                      e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(randomPick.posterUrl)}`;
                    } else {
                      e.target.style.display = "none";
                    }
                  }}
                />
              ) : (
                <div className="poster">{randomPick.title}</div>
              )}

              <div>
                <span className="tag">
                  {randomPick.mediaType === "tv" ? "Series" : "Movie"} · ⭐ {randomPick.rating}
                </span>
                <h3>{randomPick.title} {randomPick.year && `(${randomPick.year})`}</h3>
                <p className="sub">{randomPick.overview}</p>

                <dl>
                  {randomPick.cast && (
                    <>
                      <dt>Starring</dt>
                      <dd>{randomPick.cast.slice(0, 4).join(", ")}</dd>
                    </>
                  )}
                  <dt>Stream on</dt>
                  <dd>{randomPick.streaming && randomPick.streaming.length ? randomPick.streaming.join(", ") : "Not provided by OMDb"}</dd>
                </dl>

                {randomPick.sceneDetective && (
                  <div className="random-scene-hint">
                    <strong>Iconic Scene:</strong> {randomPick.sceneDetective.description}
                  </div>
                )}

                <div className="row random-actions">
                  <button
                    disabled={saved.includes(randomPick.id)}
                    onClick={() => onSave(randomPick)}
                  >
                    {saved.includes(randomPick.id) ? "✓ In Watchlist" : "+ Save to Watchlist"}
                  </button>
                  {onAnalyzeMovie && (
                    <button
                      className="ghost"
                      onClick={() => onAnalyzeMovie(randomPick)}
                    >
                      🔍 View Scene Detective
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="discovery-carousel-container">
          {error && <p className="err">{error}</p>}
          {!error && currentList.length === 0 && <p className="sub">Loading titles from OMDb…</p>}
          <div className="discovery-nav-arrows">
            <button className="carousel-btn" onClick={() => scroll("left")} aria-label="Scroll left">‹</button>
            <button className="carousel-btn" onClick={() => scroll("right")} aria-label="Scroll right">›</button>
          </div>

          <div className="discovery-carousel-track" ref={scrollRef}>
            {currentList.map((movie) => {
              const isSaved = saved.includes(movie.id);
              return (
                <div className="discovery-card" key={movie.id}>
                  <div className="discovery-poster-wrap">
                    {movie.posterUrl ? (
                      <img
                        className="discovery-poster"
                        src={movie.posterUrl}
                        alt={movie.title}
                        referrerPolicy="no-referrer"
                        loading="eager"
                        onError={(e) => {
                          if (movie.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                            e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(movie.posterUrl)}`;
                          } else {
                            e.target.style.display = "none";
                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div className="discovery-poster-fallback" style={{ display: movie.posterUrl ? "none" : "flex" }}>
                      <span>{movie.title}</span>
                    </div>
                    <span className="discovery-rating">⭐ {movie.rating}</span>
                    <span className="discovery-type">{movie.mediaType === "tv" ? "Series" : "Movie"}</span>
                  </div>

                  <div className="discovery-info">
                    <h4 className="discovery-title" title={movie.title}>
                      {movie.title} {movie.year ? `(${movie.year})` : ""}
                    </h4>
                    <p className="discovery-overview">
                      {movie.overview ? movie.overview.slice(0, 95) + "..." : ""}
                    </p>

                    <div className="discovery-actions">
                      <button
                        className={`disc-save-btn ${isSaved ? "saved" : ""}`}
                        disabled={isSaved}
                        onClick={() => onSave(movie)}
                      >
                        {isSaved ? "✓ Saved" : "+ Watchlist"}
                      </button>
                      {onAnalyzeMovie && (
                        <button
                          className="ghost disc-inspect-btn"
                          onClick={() => onAnalyzeMovie(movie)}
                        >
                          Scene
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
