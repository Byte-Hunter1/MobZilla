import { useState } from "react";
import SceneDetective from "./SceneDetective.jsx";
import SimilarCarousel from "./SimilarCarousel.jsx";
import ShareModal from "./ShareModal.jsx";

function Card({ m, extra }) {
  return (
    <>
      {m.posterUrl ? (
        <img
          className="poster"
          src={m.posterUrl}
          alt={`${m.title} poster`}
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (m.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
              e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(m.posterUrl)}`;
            } else {
              e.target.style.display = "none";
              if (e.target.nextSibling) e.target.nextSibling.style.display = "grid";
            }
          }}
        />
      ) : null}
      <div className="poster" style={{ display: m.posterUrl ? "none" : "grid" }}>
        {m.title}
      </div>

      <div>
        {extra}
        <h3>{m.title} {m.year && `(${m.year})`}</h3>
        <p className="sub">{m.overview}</p>
        <dl>
          <dt>Type</dt><dd>{m.mediaType === "tv" ? "Series" : "Movie"}</dd>
          <dt>Rating</dt><dd>⭐ {m.rating} / 10</dd>
          {m.cast && m.cast.length > 0 && <><dt>Cast</dt><dd>{m.cast.join(", ")}</dd></>}
          <dt>Watch on</dt><dd>{m.streaming && m.streaming.length ? m.streaming.join(", ") : "Not provided by OMDb"}</dd>
        </dl>
      </div>
    </>
  );
}

export default function Result({ data, onSave, saved = [], onSelectAlternative }) {
  const [shareOpen, setShareOpen] = useState(false);

  const m = data?.match;
  if (!m) {
    return (
      <div className="result one">
        <div>
          <h3>No confident match</h3>
          <p className="sub">{data?.reasoning || "Try a longer clip with a clear face, dialogue or a well-known scene."}</p>
        </div>
      </div>
    );
  }

  const isSaved = saved.includes(m.id);

  return (
    <div className="result-container">
      <div className="result-main-card">
        <div className="result">
          <Card
            m={m}
            extra={
              <div className="result-tags">
                {typeof data.confidence === "number" && data.confidence > 0 && (
                  <span className="tag">{data.confidence}% match</span>
                )}
                {data.sourceType && (
                  <span className="source-tag">
                    {data.sourceType === "link" ? "🔗 Web Link" : data.sourceType === "description" ? "📝 Description" : "📁 Video Clip"}
                  </span>
                )}
              </div>
            }
          />
          <div className="row result-actions-bar">
            <button
              className={`main-save-btn ${isSaved ? "saved-btn" : ""}`}
              disabled={isSaved}
              onClick={() => onSave(m)}
            >
              {isSaved ? "✓ Saved to Watchlist" : "+ Save to Watchlist"}
            </button>
            <button
              className="ghost share-trigger-btn"
              onClick={() => setShareOpen(true)}
            >
              ↗ Share Result
            </button>
          </div>
        </div>

        {data.reasoning && (
          <div className="detection-reasoning">
            <strong>Detective note:</strong> {data.reasoning}
          </div>
        )}

        {/* Feature A: Scene Detective */}
        {m.sceneDetective && (
          <SceneDetective scene={m.sceneDetective} />
        )}

        {/* Feature B: Similar Movie Recommendations */}
        {m.recommendations && m.recommendations.length > 0 && (
          <SimilarCarousel
            items={m.recommendations}
            onSave={onSave}
            saved={saved}
            onSelect={onSelectAlternative}
          />
        )}
      </div>

      {/* Alternative matches */}
      {data.alternatives && data.alternatives.length > 0 && (
        <div className="alternatives-container">
          <h3 className="alt">Other possible matches</h3>
          <div className="alt-results-list">
            {data.alternatives.map((a) => {
              const aSaved = saved.includes(a.id);
              return (
                <div className="result small alt-row" key={a.id}>
                  <Card m={a} />
                  <div className="row alt-row-action">
                    <button
                      className="ghost"
                      disabled={aSaved}
                      onClick={() => onSave(a)}
                    >
                      {aSaved ? "Saved" : "+ Watchlist"}
                    </button>
                    {onSelectAlternative && (
                      <button
                        className="ghost"
                        onClick={() => onSelectAlternative(a)}
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature F: Share Modal */}
      <ShareModal
        match={m}
        confidence={data.confidence}
        shareToken={data.shareToken}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
