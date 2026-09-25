export const API_URL = "http://localhost:8000";
const TOKEN_KEY = "pantry_token";

let handleUnauthorized = () => {};

export function setUnauthorizedHandler(fn) {
  handleUnauthorized = fn;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// fetch wrapper: attaches the token and logs out automatically on 401
export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  return res;
}