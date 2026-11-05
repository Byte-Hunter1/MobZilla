import { useMemo, useState } from "react";

export default function History({ history = [], onRevisit, onClear }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'file' | 'link' | 'description'
  const [search, setSearch] = useState("");

  const filteredHistory = useMemo(() => history.filter((item) => {
    if (filter !== "all" && item.sourceType !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = (item.match?.title || "").toLowerCase().includes(q);
      const queryMatch = (item.query || "").toLowerCase().includes(q);
      const reasonMatch = (item.reasoning || "").toLowerCase().includes(q);
      return titleMatch || queryMatch || reasonMatch;
    }
    return true;
  }), [history, filter, search]);

  const getSourceBadge = (type) => {
    switch (type) {
      case "link":
        return { label: "🔗 Social Link", color: "var(--pink)" };
      case "description":
        return { label: "📝 Description", color: "var(--sun)" };
      default:
        return { label: "📁 Video Clip", color: "#2bd9a8" };
    }
  };

  const formatDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  if (!history.length) {
    return (
      <div className="history-empty">
        <p className="sub">No clips or scenes identified yet.</p>
        <p className="history-hint">Your identification history will appear here so you can easily revisit any scene analysis.</p>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-toolbar">
        <div className="history-tabs">
          <button
            className={`history-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({history.length})
          </button>
          <button
            className={`history-tab ${filter === "file" ? "active" : ""}`}
            onClick={() => setFilter("file")}
          >
            📁 Clips ({history.filter((h) => h.sourceType === "file").length})
          </button>
          <button
            className={`history-tab ${filter === "link" ? "active" : ""}`}
            onClick={() => setFilter("link")}
          >
            🔗 Links ({history.filter((h) => h.sourceType === "link").length})
          </button>
          <button
            className={`history-tab ${filter === "description" ? "active" : ""}`}
            onClick={() => setFilter("description")}
          >
            📝 Text ({history.filter((h) => h.sourceType === "description").length})
          </button>
        </div>

        <div className="history-right-tools">
          <div className="history-search-wrap">
            <input
              type="text"
              className="history-search-input"
              placeholder="Filter history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="history-clear-search" onClick={() => setSearch("")}>×</button>
            )}
          </div>
          {onClear && (
            <button className="ghost history-clear-all" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <p className="sub history-no-match">No history records match your search or filter.</p>
      ) : (
        <div className="history-list">
          {filteredHistory.map((item, idx) => {
            const badge = getSourceBadge(item.sourceType);
            const m = item.match;
            return (
              <div className="history-item" key={item.id || idx}>
                <div className="history-poster-wrap">
                  {m?.posterUrl ? (
                    <img
                      className="history-poster"
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
                    <div className="history-poster fallback">{m?.title || "Film"}</div>
                  )}
                </div>

                <div className="history-details">
                  <div className="history-top-row">
                    <span className="history-source-badge" style={{ borderColor: badge.color, color: badge.color }}>
                      {badge.label}
                    </span>
                    <span className="history-time">{formatDate(item.timestamp)}</span>
                    {item.confidence && (
                      <span className="history-conf">{item.confidence}% Match</span>
                    )}
                  </div>

                  <h4 className="history-title">
                    {m ? `${m.title} ${m.year ? `(${m.year})` : ""}` : "Unmatched Scene"}
                  </h4>

                  {item.query && (
                    <p className="history-query">
                      <strong>Input:</strong> "{item.query}"
                    </p>
                  )}

                  {m?.sceneDetective?.description && (
                    <p className="history-scene-desc">
                      {m.sceneDetective.description.slice(0, 115)}...
                    </p>
                  )}
                </div>

                <div className="history-actions">
                  <button
                    className="history-revisit-btn"
                    onClick={() => onRevisit && onRevisit(item)}
                  >
                    View Result →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
