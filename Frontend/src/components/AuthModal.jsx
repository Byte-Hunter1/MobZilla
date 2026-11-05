import { useState } from "react";
import { login, register } from "../api.js";

export default function AuthModal({ mode, onClose, onSuccess }) {
  const [tab, setTab] = useState(mode || "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = tab === "register"
        ? await register({ email, password, name: name || undefined })
        : await login({ email, password });
      onSuccess(result);
    } catch (err) {
      setError(err.message || "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{tab === "register" ? "Create account" : "Sign in"}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {tab === "register" && (
            <input className="share-input" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          )}
          <input className="share-input" type="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="share-input" type="password" required minLength={8} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="err">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : tab === "register" ? "Create account" : "Sign in"}</button>
        </form>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setTab(tab === "login" ? "register" : "login");
            setError("");
          }}
        >
          {tab === "login" ? "Need an account?" : "Already have an account?"}
        </button>
      </div>
    </div>
  );
}
