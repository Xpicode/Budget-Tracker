// The only way the client talks to the server (used by sync.js and the Account page).
// Throws an Error carrying .status and the server's message, so callers can react to 401.
// The web app shares an address with the API. The Android build sets VITE_API_URL to the server's address.
const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.fields?.map((f) => f.message).join(' ') || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
