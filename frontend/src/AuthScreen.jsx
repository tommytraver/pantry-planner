import { useEffect, useState } from "react";
import { API_URL } from "./api";

async function postJson(path, body) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverAwake, setServerAwake] = useState(false);
  const [slowWake, setSlowWake] = useState(false);

  const isSignup = mode === "signup";

  // Free hosting sleeps when idle: ping the server so it starts waking up,
  // and tell the user if it's taking a while
  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowWake(true);
    }, 1500);

    async function ping() {
      for (let attempt = 0; attempt < 12 && !cancelled; attempt++) {
        try {
          const res = await fetch(`${API_URL}/health`);
          if (res.ok) {
            if (!cancelled) setServerAwake(true);
            return;
          }
        } catch {
          // Server still starting; try again shortly
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    ping();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        const res = await postJson("/auth/signup", { email, password });
        if (res.status === 409) throw new Error("That email is already registered. Log in instead.");
        if (!res.ok)
          throw new Error("Use a valid email and a password of at least 8 characters.");
      }

      const res = await postJson("/auth/login", { email, password });
      if (!res.ok) throw new Error("Incorrect email or password.");
      const data = await res.json();
      onLogin(data.access_token);
    } catch (err) {
      setError(err instanceof TypeError ? "Can't reach the server." : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startDemo() {
    setError("");
    setLoading(true);
    try {
      const res = await postJson("/auth/demo");
      if (!res.ok) throw new Error("Couldn't start the demo. Try again.");
      const data = await res.json();
      onLogin(data.access_token);
    } catch (err) {
      setError(err instanceof TypeError ? "Can't reach the server." : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <h1>Pantry Planner</h1>
      <p className="auth-tagline">Turn what's in your kitchen into high-protein meals.</p>

      {!serverAwake && slowWake && (
        <p className="status wake-notice">
          Waking up the server. Free hosting sleeps when idle, so the first load can take up to a
          minute.
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="field"
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          aria-label="Password"
          placeholder={isSignup ? "Password, 8+ characters" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading
            ? isSignup
              ? "Creating account..."
              : "Logging in..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={startDemo} disabled={loading}>
          Try the demo, no account needed
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <button
        className="link-button"
        onClick={() => {
          setMode(isSignup ? "login" : "signup");
          setError("");
        }}
      >
        {isSignup ? "Have an account? Log in" : "New here? Create an account"}
      </button>
    </main>
  );
}

export default AuthScreen;