export default function SceneDetective({ scene }) {
  if (!scene) return null;

  return (
    <div className="scene-detective">
      <div className="sd-header">
        <span className="sd-badge">🔍 Scene Detective</span>
        {scene.timestamp && (
          <span className="sd-timestamp">
            <span className="sd-dot"></span>
            {scene.timestamp}
          </span>
        )}
      </div>

      <p className="sd-desc">{scene.description}</p>

      {scene.location && (
        <div className="sd-row">
          <span className="sd-label">📍 Location:</span>
          <span className="sd-value">{scene.location}</span>
        </div>
      )}

      {scene.characters && scene.characters.length > 0 && (
        <div className="sd-row">
          <span className="sd-label">🎭 Characters:</span>
          <div className="sd-tags">
            {scene.characters.map((c, i) => (
              <span className="sd-tag char-tag" key={i}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {scene.visualElements && scene.visualElements.length > 0 && (
        <div className="sd-row">
          <span className="sd-label">👁️ Visual Elements:</span>
          <div className="sd-tags">
            {scene.visualElements.map((v, i) => (
              <span className="sd-tag visual-tag" key={i}>{v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
