import { useEffect, useRef, useState } from "react";
import { identify } from "../api.js";
import LinkInput from "./LinkInput.jsx";
import Result from "./Result.jsx";

export default function Upload({ onSave, saved, onRecordHistory, activeResult, onSelectResult }) {
  const [state, setState] = useState("idle"); // idle | scanning | done | error
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [statusText, setStatusText] = useState("Scanning scenes and matching titles…");
  const input = useRef(null);

  // Sync with activeResult if passed from parent (e.g., from History or Share URL)
  useEffect(() => {
    if (activeResult) {
      setData(activeResult);
      setState("done");
      setError("");
    }
  }, [activeResult]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function runFile(file) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file (MP4, MOV or WebM).");
      setState("error");
      return;
    }
    setError("");
    setPreview(URL.createObjectURL(file));
    setState("scanning");
    setStatusText("Analyzing keyframes and scene signatures…");

    try {
      const res = await identify(file, (status) => setStatusText(status.stage || "Scanning scenes and matching titles…"));
      setData(res);
      setState("done");

      if (onRecordHistory) {
        onRecordHistory({
          id: Date.now(),
          timestamp: new Date().toISOString(),
          sourceType: "file",
          query: file.name,
          match: res.match,
          confidence: res.confidence,
          reasoning: res.reasoning
        });
      }
    } catch (e) {
      setError(e.message || "Failed to identify this video clip.");
      setState("error");
    }
  }

  const handleLinkIdentified = (res, meta) => {
    setPreview(null);
    setData(res);
    setState("done");
    setError("");

    if (onRecordHistory) {
      onRecordHistory({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        sourceType: "link",
        query: meta.url,
        match: res.match,
        confidence: res.confidence,
        reasoning: res.reasoning
      });
    }
  };

  const handleStartScan = () => {
    setState("scanning");
    setStatusText("Fetching media stream and extracting frames…");
    setError("");
  };

  const handleReset = () => {
    setState("idle");
    setData(null);
    setError("");
    setPreview(null);
    if (onSelectResult) onSelectResult(null);
  };

  return (
    <div className="upload-container">
      {/* File Upload Drop Zone */}
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          runFile(e.dataTransfer.files[0]);
        }}
      >
        <span className="drop-icon">🎬</span>
        <strong>Choose a video clip</strong>
        <span>or drag it here · MP4, MOV, WebM · up to 50 MB</span>
        <input
          ref={input}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => runFile(e.target.files[0])}
        />
      </label>

      {/* 1- Link input section right below upload file */}
      <LinkInput
        onIdentified={handleLinkIdentified}
        onError={(msg) => {
          setError(msg);
          setState("error");
        }}
        onStartScan={handleStartScan}
        scanning={state === "scanning"}
      />

      {/* Output / Results section */}
      <div aria-live="polite" className="out" id="results-view">
        {preview && (
          <div className="video-preview-wrapper">
            <span className="preview-label">Uploaded Clip:</span>
            <video src={preview} controls muted autoPlay playsInline />
          </div>
        )}

        {state === "scanning" && (
          <div className="scanning-indicator">
            <div className="pulsing-radar"></div>
            <p className="scanning-text">{statusText}</p>
          </div>
        )}

        {state === "error" && (
          <div className="error-box">
            <p className="err">{error}</p>
            <button className="ghost retry-btn" onClick={handleReset}>Try again</button>
          </div>
        )}

        {state === "done" && data && (
          <>
            <div className="results-top-bar">
              <button className="ghost reset-btn" onClick={handleReset}>
                ← Identify Another Clip
              </button>
            </div>
            <Result
              data={data}
              onSave={onSave}
              saved={saved}
              onSelectAlternative={(altMovie) => {
                const enriched = {
                  match: altMovie,
                  confidence: 90,
                  reasoning: `Inspected alternative: ${altMovie.title}`,
                  alternatives: data.alternatives.filter((x) => x.id !== altMovie.id),
                  sourceType: data.sourceType
                };
                setData(enriched);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
