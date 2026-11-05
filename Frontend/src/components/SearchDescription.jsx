import { useCallback, useState } from "react";
import { searchByDescription } from "../api.js";
import SceneDetective from "./SceneDetective.jsx";

const EXAMPLE_PROMPTS = [
  "A man was standing in the rain holding a red umbrella",
  "A rotating hotel hallway fight in zero gravity",
  "Two detectives find a mysterious cardboard box in a desert at sunset",
  "A spinning top that doesn't stop wobbling in a dream",
  "Astronauts travel through a giant wormhole near Saturn looking for habitable worlds",
  "Max levitating in a cemetery while listening to Kate Bush cassette tape"
];

export default function SearchDescription({ onSave, saved, onSelectMovie, onSearched }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = useCallback(async (textToSearch) => {
    const q = (textToSearch || query).trim();
    if (!q) {
      setError("Please describe a scene first.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const data = await searchByDescription(q);
      setResult(data);
      setLoading(false);
      if (onSearched) onSearched();
    } catch (err) {
      setError(err.message || "Failed to search scene by description.");
      setLoading(false);
    }
  }, [query, onSearched]);

  const handleChipClick = useCallback((prompt) => {
    setQuery(prompt);
    handleSearch(prompt);
  }, [handleSearch]);

  return (
    <div className="search-desc-container">
      <div className="search-desc-card">
        <div className="search-desc-header">
          <span className="search-desc-badge">AI SCENE SEARCH</span>
          <h3>Search Scene by Description</h3>
          <p className="sub">
            Remember what happened in the scene but don't have the video file? Describe it in natural language and let our AI detective identify the title.
          </p>
        </div>

        <form
          className="search-desc-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div className="desc-textarea-wrapper">
            <textarea
              className="desc-textarea"
              rows={3}
              placeholder='e.g. "I saw a movie where a man was standing in the rain holding a red umbrella."'
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError("");
              }}
              disabled={loading}
            />
            <button
              type="submit"
              className="desc-search-btn"
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner"></span> Searching…
                </span>
              ) : (
                "🔍 Ask AI Detective"
              )}
            </button>
          </div>
        </form>

        <div className="prompt-chips-section">
          <span className="chips-title">Try these scene descriptions:</span>
          <div className="prompt-chips">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="prompt-chip"
                onClick={() => handleChipClick(prompt)}
                disabled={loading}
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        {error && <p className="err">{error}</p>}

        {loading && (
          <div className="search-loading-state">
            <div className="pulsing-radar"></div>
            <p>Analyzing scene semantics, visual motifs, and script dialogue…</p>
          </div>
        )}

        {result && result.match && (
          <div className="desc-result-wrap">
            <div className="desc-result-banner">
              <span className="desc-result-tag">Top Match · {result.confidence}% Confidence</span>
              <p className="desc-result-reasoning">{result.reasoning}</p>
            </div>

            <div className="result desc-match-card">
              {result.match.posterUrl ? (
                <img
                  className="poster"
                  src={result.match.posterUrl}
                  alt={result.match.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (result.match.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                      e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(result.match.posterUrl)}`;
                    } else {
                      e.target.style.display = "none";
                    }
                  }}
                />
              ) : (
                <div className="poster">{result.match.title}</div>
              )}

              <div>
                <span className="tag">{result.match.mediaType === "tv" ? "Series" : "Movie"}</span>
                <h3>
                  {result.match.title} {result.match.year && `(${result.match.year})`}
                </h3>
                <p className="sub">{result.match.overview}</p>

                <dl>
                  <dt>Rating</dt>
                  <dd>⭐ {result.match.rating} / 10</dd>
                  {result.match.cast && result.match.cast.length > 0 && (
                    <>
                      <dt>Cast</dt>
                      <dd>{result.match.cast.join(", ")}</dd>
                    </>
                  )}
                  <dt>Watch on</dt>
                  <dd>
                    {result.match.streaming && result.match.streaming.length > 0
                      ? result.match.streaming.join(", ")
                      : "Not provided by OMDb"}
                  </dd>
                </dl>

                {result.match.sceneDetective && (
                  <SceneDetective scene={result.match.sceneDetective} />
                )}

                <div className="row desc-actions">
                  <button
                    className={saved.includes(result.match.id) ? "saved-btn" : ""}
                    disabled={saved.includes(result.match.id)}
                    onClick={() => onSave(result.match)}
                  >
                    {saved.includes(result.match.id) ? "✓ In Watchlist" : "+ Save to Watchlist"}
                  </button>
                  {onSelectMovie && (
                    <button
                      className="ghost"
                      onClick={() => onSelectMovie(result.match)}
                    >
                      Inspect Details
                    </button>
                  )}
                </div>
              </div>
            </div>

            {result.alternatives && result.alternatives.length > 0 && (
              <div className="alt-section">
                <h4 className="alt-title">Other Possible Scene Matches</h4>
                <div className="alt-grid">
                  {result.alternatives.map((alt) => (
                    <div className="alt-card" key={alt.id}>
                      {alt.posterUrl ? (
                        <img
                          className="alt-poster"
                          src={alt.posterUrl}
                          alt={alt.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (alt.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                              e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(alt.posterUrl)}`;
                            } else {
                              e.target.style.display = "none";
                            }
                          }}
                        />
                      ) : (
                        <div className="alt-poster-fallback">{alt.title}</div>
                      )}
                      <div className="alt-info">
                        <h5>{alt.title} {alt.year && `(${alt.year})`}</h5>
                        <p className="alt-desc">{alt.overview ? alt.overview.slice(0, 90) + "..." : ""}</p>
                        <button
                          className="ghost alt-save-btn"
                          disabled={saved.includes(alt.id)}
                          onClick={() => onSave(alt)}
                        >
                          {saved.includes(alt.id) ? "Saved" : "+ Watchlist"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
