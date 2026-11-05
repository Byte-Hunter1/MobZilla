import { useMemo, useState } from "react";

export default function Watchlist({ list = [], onRemove, onToggleStatus }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'want' | 'watched'
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => list.filter((item) => {
    const itemStatus = item.status || "want";
    if (filter === "want" && itemStatus !== "want") return false;
    if (filter === "watched" && itemStatus !== "watched") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = (item.title || "").toLowerCase().includes(q);
      const yearMatch = (item.year || "").toString().includes(q);
      return titleMatch || yearMatch;
    }
    return true;
  }), [list, filter, search]);

  const wantCount = useMemo(() => list.filter((x) => (x.status || "want") === "want").length, [list]);
  const watchedCount = useMemo(() => list.filter((x) => x.status === "watched").length, [list]);

  if (!list.length) {
    return (
      <div className="wl-empty">
        <div className="wl-empty-icon">🍿</div>
        <p className="sub">Your watchlist is empty.</p>
        <p className="wl-empty-hint">Identify clips, paste links, or use Scene Search above and click "Save to Watchlist".</p>
      </div>
    );
  }

  return (
    <div className="wl-container">
      {/* Filter and search toolbar */}
      <div className="wl-toolbar">
        <div className="wl-tabs">
          <button
            className={`wl-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({list.length})
          </button>
          <button
            className={`wl-tab ${filter === "want" ? "active" : ""}`}
            onClick={() => setFilter("want")}
          >
            🔖 Want to Watch ({wantCount})
          </button>
          <button
            className={`wl-tab ${filter === "watched" ? "active" : ""}`}
            onClick={() => setFilter("watched")}
          >
            ✓ Watched ({watchedCount})
          </button>
        </div>

        <div className="wl-search-wrapper">
          <input
            type="text"
            className="wl-search-input"
            placeholder="Search watchlist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="wl-clear-search" onClick={() => setSearch("")}>×</button>
          )}
        </div>
      </div>

      {filteredList.length === 0 ? (
        <p className="sub wl-no-results">No movies match your filter or search query.</p>
      ) : (
        <ul className="wl-grid">
          {filteredList.map((m) => {
            const isWatched = m.status === "watched";
            return (
              <li className={`wl-card ${isWatched ? "is-watched" : ""}`} key={m.id}>
                <div className="wl-card-poster-wrap">
                  {m.posterUrl ? (
                    <img
                      className="wl-card-poster"
                      src={m.posterUrl}
                      alt={m.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (m.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                          e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(m.posterUrl)}`;
                        } else {
                          e.target.style.display = "none";
                        }
                      }}
                    />
                  ) : (
                    <div className="wl-card-poster fallback">{m.title}</div>
                  )}
                  <span className={`wl-status-badge ${isWatched ? "watched" : "want"}`}>
                    {isWatched ? "✓ Watched" : "🔖 Want to Watch"}
                  </span>
                </div>

                <div className="wl-card-content">
                  <div className="wl-card-title-group">
                    <h4 className="wl-card-title">{m.title}</h4>
                    {m.year && <span className="wl-card-year">({m.year})</span>}
                  </div>

                  {m.rating && <div className="wl-card-rating">⭐ {m.rating} / 10</div>}

                  <div className="wl-card-actions">
                    <button
                      className={`wl-toggle-btn ${isWatched ? "active" : ""}`}
                      onClick={() => onToggleStatus && onToggleStatus(m.id)}
                      title={isWatched ? "Mark as Want to Watch" : "Mark as Watched"}
                    >
                      {isWatched ? "Mark Unwatched" : "✓ Mark Watched"}
                    </button>
                    <button
                      className="ghost wl-remove-btn"
                      onClick={() => onRemove(m.id)}
                      title="Remove from watchlist"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
