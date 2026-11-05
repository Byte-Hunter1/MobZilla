import { useState } from "react";
import { identifyLink } from "../api.js";

const SAMPLES = [
  { label: "💣 Oppenheimer Trinity", url: "https://www.youtube.com/watch?v=tK0IDmSYYGk" },
  { label: "☕ Inception Dream", url: "https://www.youtube.com/watch?v=YoHD9XEInc0" },
  { label: "🕶️ Matrix Red Pill", url: "https://www.youtube.com/watch?v=zE7PKRjrid4" },
  { label: "⏳ Interstellar Docking", url: "https://www.youtube.com/watch?v=a3lcGnMhvsA" }
];

export default function LinkInput({ onIdentified, onError, onStartScan, scanning }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const detectPlatform = (val) => {
    if (!val) return null;
    const v = val.toLowerCase();
    if (v.includes("youtube.com") || v.includes("youtu.be")) return { name: "YouTube", icon: "▶️", color: "#ff3d81" };
    if (v.includes("instagram.com/reel") || v.includes("instagram.com/p")) return { name: "Instagram Reel", icon: "📸", color: "#e1306c" };
    if (v.includes("tiktok.com")) return { name: "TikTok", icon: "🎵", color: "#2bd9a8" };
    return { name: "Web Video", icon: "🔗", color: "#ffd23f" };
  };

  const getYoutubeThumb = (val) => {
    try {
      if (!val) return null;
      let vid = null;
      if (val.includes("youtu.be/")) {
        vid = val.split("youtu.be/")[1]?.split(/[?#]/)[0];
      } else if (val.includes("youtube.com/watch")) {
        const urlObj = new URL(val);
        vid = urlObj.searchParams.get("v");
      } else if (val.includes("youtube.com/shorts/")) {
        vid = val.split("youtube.com/shorts/")[1]?.split(/[?#]/)[0];
      }
      return vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setErrorMsg("Please paste a valid YouTube, Reel or video link.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    if (onStartScan) onStartScan();

    try {
      const result = await identifyLink(url.trim());
      setLoading(false);
      if (onIdentified) {
        onIdentified(result, { type: "link", url: url.trim(), thumb: getYoutubeThumb(url) });
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to identify link.");
      if (onError) onError(err.message);
    }
  };

  const platform = detectPlatform(url);
  const ytThumb = getYoutubeThumb(url);

  return (
    <div className="link-section">
      <div className="link-section-header">
        <div className="link-title-wrap">
          <span className="link-badge">NEW</span>
          <h3 className="link-title">Or paste a YouTube or Reel link</h3>
        </div>
        <p className="link-sub">Found a viral reel, TikTok, or YouTube clip? Paste the link to detect the scene instantly.</p>
      </div>

      <form className="link-form" onSubmit={handleSubmit}>
        <div className="link-input-wrapper">
          <span className="link-platform-icon">{platform ? platform.icon : "🔗"}</span>
          <input
            type="url"
            className="link-input"
            placeholder="Paste YouTube, Shorts, Instagram Reel, or TikTok link..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            disabled={loading || scanning}
          />
          {url && (
            <button
              type="button"
              className="link-clear-btn"
              onClick={() => { setUrl(""); setErrorMsg(""); }}
              title="Clear input"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="submit"
          className="link-submit-btn"
          disabled={loading || scanning || !url.trim()}
        >
          {loading ? (
            <span className="btn-loading">
              <span className="spinner"></span> Analyzing…
            </span>
          ) : (
            "Identify Scene"
          )}
        </button>
      </form>

      {/* Instant video thumbnail preview if YouTube */}
      {ytThumb && (
        <div className="link-thumb-preview">
          <img src={ytThumb} alt="Link thumbnail preview" />
          <div className="thumb-overlay">
            <span className="platform-tag" style={{ background: platform.color }}>
              {platform.name}
            </span>
            <span className="thumb-status">Ready for Scene Detective analysis</span>
          </div>
        </div>
      )}

      {/* Preset sample links */}
      <div className="link-samples">
        <span className="sample-label">Quick test samples:</span>
        <div className="sample-chips">
          {SAMPLES.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="sample-chip"
              onClick={() => {
                setUrl(sample.url);
                setErrorMsg("");
              }}
              disabled={loading || scanning}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <p className="err link-err">{errorMsg}</p>}
    </div>
  );
}
