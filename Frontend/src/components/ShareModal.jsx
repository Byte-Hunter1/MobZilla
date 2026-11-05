import { useState } from "react";

export default function ShareModal({ match, confidence, shareToken, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !match) return null;

  // Generate a shareable link that includes the movie id or title
  const origin = window.location.origin + window.location.pathname;
  const shareUrl = `${origin}?share=${encodeURIComponent(shareToken || match.imdbId || match.id)}`;
  const shareText = typeof confidence === "number"
    ? `I used Mobzilla to identify "${match.title}" (${match.year}) with ${confidence}% confidence.`
    : `Mobzilla movie details: "${match.title}" (${match.year}).`;

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement("input");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Mobzilla: Identified ${match.title}`,
          text: shareText,
          url: shareUrl
        });
      } catch {
        // user cancelled share
      }
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`Identified scene: ${match.title} (${match.year})`)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Result</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        <div className="modal-preview">
          {match.posterUrl && (
            <img className="modal-poster" src={match.posterUrl} alt={match.title} />
          )}
          <div>
            <h4>{match.title} {match.year ? `(${match.year})` : ""}</h4>
            {typeof confidence === "number" && <span className="tag">{confidence}% match</span>}
            <p className="modal-sub">{match.overview ? match.overview.slice(0, 110) + "..." : ""}</p>
          </div>
        </div>

        <div className="share-link-group">
          <input className="share-input" readOnly value={shareUrl} />
          <button className="copy-btn" onClick={copyToClipboard}>
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
        </div>

        <div className="social-grid">
          {typeof navigator !== "undefined" && navigator.share && (
            <button className="social-btn native-share-btn" onClick={handleNativeShare}>
              📱 Share via Device
            </button>
          )}
          <a className="social-btn x-btn" href={twitterUrl} target="_blank" rel="noopener noreferrer">
            𝕏 Share on X
          </a>
          <a className="social-btn wa-btn" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            💬 WhatsApp
          </a>
          <a className="social-btn tg-btn" href={telegramUrl} target="_blank" rel="noopener noreferrer">
            ✈️ Telegram
          </a>
          <a className="social-btn rd-btn" href={redditUrl} target="_blank" rel="noopener noreferrer">
            🔴 Reddit
          </a>
        </div>
      </div>
    </div>
  );
}
