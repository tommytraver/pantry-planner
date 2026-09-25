import { useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import Pantry from "./Pantry";
import { clearToken, getToken, saveToken, setUnauthorizedHandler } from "./api";
import "./App.css";

function App() {
  const [token, setToken] = useState(getToken());

  useEffect(() => {
    // If any request comes back 401 (e.g. expired token), return to the login screen
    setUnauthorizedHandler(() => setToken(null));
  }, []);

  function handleLogin(newToken) {
    saveToken(newToken);
    setToken(newToken);
  }

  function handleLogout() {
    clearToken();
    setToken(null);
  }

  return token ? (
    <Pantry onLogout={handleLogout} />
  ) : (
    <AuthScreen onLogin={handleLogin} />
  );
}

export default App;