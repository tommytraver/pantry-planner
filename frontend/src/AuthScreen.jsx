import { useState } from "react";
import { API_URL } from "./api";

async function postJson(path, body) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        const res = await postJson("/auth/signup", { email, password });
        if (res.status === 409) throw new Error("That email is already registered.");
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

  return (
    <main className="app">
      <h1>{isSignup ? "Create account" : "Log in"}</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder={isSignup ? "Password (8+ characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : isSignup ? "Sign up" : "Log in"}
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