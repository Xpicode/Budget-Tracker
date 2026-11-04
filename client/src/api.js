// The only way the client talks to the server (used by sync.js and the Account page).
// Throws an Error carrying .status and the server's message, so callers can react to 401.
// The web app shares an address with the API. The Android build sets VITE_API_URL to the server's address.
const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api(path, { method = 'GET', body } = {}) {
  // An Android build without a server has nothing to call. TypeError is what fetch throws
  // when offline, so callers treat it the same way.
  if (!BASE && globalThis.Capacitor?.isNativePlatform()) throw new TypeError('No server address in this build');
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.fields?.map((f) => f.message).join(' ') || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  // A 200 that isn't JSON came from something other than the API (e.g. an HTML page).
  // Never report it as success, or sync would mark unsent rows as saved.
  if (data === null) throw new Error('The server sent an unexpected response');
  return data;
}
