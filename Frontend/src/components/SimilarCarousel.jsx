import { useRef } from "react";

export default function SimilarCarousel({ items = [], onSave, saved = [], onSelect }) {
  const scrollRef = useRef(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -280 : 280;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="similar-section">
      <div className="similar-header">
        <div>
          <h4 className="similar-title">Similar Recommendations</h4>
          <p className="similar-sub">Titles sharing narrative themes, cinematography, and atmosphere</p>
        </div>
        <div className="carousel-nav">
          <button className="carousel-btn" onClick={() => scroll("left")} aria-label="Scroll left">‹</button>
          <button className="carousel-btn" onClick={() => scroll("right")} aria-label="Scroll right">›</button>
        </div>
      </div>

      <div className="carousel-track" ref={scrollRef}>
        {items.map((item) => {
          const isSaved = saved.includes(item.id);
          return (
            <div className="carousel-card" key={item.id}>
              <div className="carousel-poster-wrap">
                {item.posterUrl ? (
                  <img
                    className="carousel-poster"
                    src={item.posterUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    loading="eager"
                    onError={(e) => {
                      if (item.posterUrl && !e.target.src.includes("/movies/poster-proxy")) {
                        e.target.src = `/api/v1/movies/poster-proxy?url=${encodeURIComponent(item.posterUrl)}`;
                      } else {
                        e.target.style.display = "none";
                        if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div className="carousel-poster-fallback" style={{ display: item.posterUrl ? "none" : "flex" }}>
                  <span>{item.title}</span>
                </div>
                {item.rating && <span className="carousel-rating">⭐ {item.rating}</span>}
                {item.mediaType && <span className="carousel-type">{item.mediaType === "tv" ? "Series" : "Movie"}</span>}
              </div>

              <div className="carousel-info">
                <h5 className="carousel-name" title={item.title}>
                  {item.title} {item.year ? `(${item.year})` : ""}
                </h5>
                {item.explanation && (
                  <p className="carousel-exp">
                    <strong>Why:</strong> {item.explanation}
                  </p>
                )}
                <div className="carousel-actions">
                  <button
                    className={`carousel-save-btn ${isSaved ? "saved" : ""}`}
                    disabled={isSaved}
                    onClick={() => onSave && onSave(item)}
                  >
                    {isSaved ? "✓ Saved" : "+ Watchlist"}
                  </button>
                  {onSelect && (
                    <button className="carousel-ghost-btn" onClick={() => onSelect(item)}>
                      Inspect
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
