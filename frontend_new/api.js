// frontend_new/api.js
const API_BASE = "https://sczn3-backend-new1.onrender.com";

function timeoutFetch(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export async function pingBackend() {
  const r = await timeoutFetch(`${API_BASE}/health`, { method: "GET" }, 8000);
  if (!r.ok) throw new Error(`health not ok: ${r.status}`);
  return r.json();
}

export async function analyzeTapScore(payload) {
  // payload should be SMALL: taps + distance only
  const r = await timeoutFetch(
    `${API_BASE}/tapscore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    12000
  );

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`tapscore ${r.status}: ${txt}`);
  }
  return r.json();
}
