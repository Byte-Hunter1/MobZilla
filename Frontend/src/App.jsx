import { useCallback, useEffect, useState } from "react";
import Tunnel from "./components/Tunnel.jsx";
import Upload from "./components/Upload.jsx";
import Watchlist from "./components/Watchlist.jsx";
import SearchDescription from "./components/SearchDescription.jsx";
import MovieDiscovery from "./components/MovieDiscovery.jsx";
import History from "./components/History.jsx";
import AuthModal from "./components/AuthModal.jsx";
import {
  addWatchlist,
  clearHistory as clearHistoryApi,
  currentUser,
  getHistory,
  getMovie,
  getPosters,
  getRecommendations,
  getShare,
  getToken,
  getWatchlist,
  removeWatchlist,
  setSession,
  updateWatchlist
} from "./api.js";

const FEATURES = [
  ["Scene Detective", "Analyzes sampled frames, visible clues, characters, and the setting."],
  ["AI Scene Search", "Forgot the movie name? Describe what happened in plain words and track it down."],
  ["Similar Recommendations", "Related titles are suggested, then checked against OMDb before they are shown."],
  ["YouTube Support", "Paste a public YouTube or Shorts link. Instagram Reels need to be uploaded as a file."],
  ["Personal Watchlist", "Sign in to keep Want to Watch and Watched lists."],
  ["Share Results", "Share a result link, or post it to X, WhatsApp, Telegram, and Reddit."]
];

export default function App() {
  const [posters, setPosters] = useState([]);
  const [list, setList] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeResult, setActiveResult] = useState(null);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState("");

  async function refreshAccount() {
    if (!getToken()) {
      setUser(null);
      setList([]);
      setHistory([]);
      return;
    }
    const [account, watchlist, past] = await Promise.all([currentUser(), getWatchlist(), getHistory()]);
    setUser(account);
    setList(watchlist);
    setHistory(past);
  }

  useEffect(() => {
    getPosters().then(setPosters).catch(() => setPosters([]));
    refreshAccount().catch(() => {
      setSession(null);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (!shareId) return;
    const load = shareId.startsWith("tt") ? getMovie(shareId).then((movie) => ({
      match: movie,
      confidence: null,
      reasoning: "Opened from a shared movie link. Details come from OMDb.",
      alternatives: [],
      sourceType: "link"
    })) : getShare(shareId).then((payload) => payload.result);
    load.then((result) => {
      setActiveResult(result);
      setTimeout(() => document.getElementById("try")?.scrollIntoView({ behavior: "smooth" }), 600);
    }).catch(() => setNotice("That shared link could not be loaded."));
  }, []);

  const requireUser = useCallback(() => {
    if (user) return true;
    setAuthOpen(true);
    setNotice("Sign in to save titles and keep history.");
    return false;
  }, [user]);

  const save = useCallback(async (movie) => {
    if (!requireUser()) return;
    const imdbId = movie.imdbId || movie.id;
    const saved = await addWatchlist(imdbId);
    setList((current) => current.some((item) => item.id === saved.id) ? current : [saved, ...current]);
  }, [requireUser]);

  const toggleStatus = useCallback(async (id) => {
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    const status = item.status === "watched" ? "want" : "watched";
    const updated = await updateWatchlist(id, status);
    setList((current) => current.map((entry) => (entry.id === id ? updated : entry)));
  }, [list]);

  const remove = useCallback(async (id) => {
    await removeWatchlist(id);
    setList((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const reloadHistory = useCallback(() => {
    if (!getToken()) return;
    getHistory().then(setHistory).catch(() => { });
  }, []);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Clear your identification history?")) return;
    await clearHistoryApi();
    setHistory([]);
  }, []);

  const handleRevisitHistory = useCallback((item) => {
    setActiveResult({
      match: item.match,
      confidence: item.confidence,
      reasoning: item.reasoning,
      alternatives: item.alternatives || [],
      sourceType: item.sourceType,
      query: item.query,
      shareToken: item.shareToken
    });
    document.getElementById("try")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleInspectMovie = useCallback(async (movie) => {
    const imdbId = movie.imdbId || movie.id;
    const [details, recs] = await Promise.all([
      getMovie(imdbId),
      getRecommendations(imdbId).catch(() => ({ recommendations: [] }))
    ]);
    setActiveResult({
      match: { ...details, recommendations: recs.recommendations || [] },
      confidence: null,
      reasoning: "Catalog details verified with OMDb.",
      alternatives: [],
      sourceType: "description"
    });
    document.getElementById("try")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <>
      <nav className="site-nav">
        <a className="logo" href="#top">
          Mob<b>zilla</b>
        </a>
        <div className="nav-links">
          <a href="#try">Identify</a>
          <a href="#search">AI Search</a>
          <a href="#discovery">Discover</a>
          <a href="#history">
            History {history.length > 0 && <span className="nav-count">({history.length})</span>}
          </a>
          <a href="#watchlist">
            Watchlist {list.length > 0 && <span className="nav-count">({list.length})</span>}
          </a>
        </div>
        {user ? (
          <button className="pill" onClick={() => { setSession(null); setUser(null); setList([]); setHistory([]); }}>
            Sign out
          </button>
        ) : (
          <button className="pill" onClick={() => setAuthOpen(true)}>Sign in</button>
        )}
      </nav>

      <Tunnel posters={posters} />

      <section className="pad" id="try">
        <h2>Drop a clip. Get the title.</h2>
        <p className="sub">
          Upload a short MP4, MOV, or WEBM clip, or paste a public YouTube link. Mobzilla samples a few frames, asks Gemini, then checks the titles with OMDb.
        </p>
        {notice && <p className="err">{notice}</p>}
        {user && <p className="sub nav-user">Signed in as {user.email}</p>}
        <Upload
          onSave={save}
          saved={list.map((item) => item.id)}
          onRecordHistory={reloadHistory}
          activeResult={activeResult}
          onSelectResult={setActiveResult}
        />
      </section>

      <section className="pad" id="search">
        <SearchDescription
          onSave={save}
          saved={list.map((item) => item.id)}
          onSelectMovie={handleInspectMovie}
          onSearched={reloadHistory}
        />
      </section>

      <section className="pad" id="discovery">
        <MovieDiscovery
          onSave={save}
          saved={list.map((item) => item.id)}
          onAnalyzeMovie={handleInspectMovie}
        />
      </section>

      <section className="pad" id="history">
        <h2>Identification History</h2>
        <p className="sub">Revisit clips, YouTube links, and scene searches saved to your account.</p>
        <History history={history} onRevisit={handleRevisitHistory} onClear={user ? clearHistory : undefined} />
      </section>

      <section className="pad" id="watchlist">
        <h2>Your Watchlist</h2>
        <p className="sub">Titles you want to watch or have already seen. Stored on your account.</p>
        <Watchlist list={list} onRemove={remove} onToggleStatus={toggleStatus} />
      </section>

      <section className="pad">
        <h2>More than a name</h2>
        <p className="sub">Identifications include the visible scene, verified titles, and similar movies.</p>
        <div className="feats">
          {FEATURES.map(([title, description]) => (
            <div className="feat" key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <p>Mobzilla · Find a movie from a clip, a public YouTube link, or a scene description.</p>
        <p className="footer-sub">MobZilla@2026</p>
      </footer>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={(result) => {
            setSession(result.token);
            setUser(result.user);
            setAuthOpen(false);
            setNotice("");
            refreshAccount().catch(() => { });
          }}
        />
      )}
    </>
  );
}
