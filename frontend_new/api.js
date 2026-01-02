// frontend_new/api.js
export const API_BASE = "https://sczn3-webapp-213.onrender.com";

export async function health() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({ ok: true }));
}

export async function calc(payload) {
  const res = await fetch(`${API_BASE}/api/calc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${txt}`);
  }

  return res.json();
}
