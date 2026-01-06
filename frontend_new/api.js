// frontend_new/api.js
// Minimal helpers used by app.js

// If your backend is same-origin, leave API_BASE = "".
// If your backend is elsewhere, set: window.API_BASE = "https://YOUR-BACKEND.onrender.com";
const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

// True MOA conversion: 1 MOA = 1.047" at 100y
// clicks = MOA / 0.25
function clicksFromInches(inches, yards, clickValueMoa = 0.25) {
  const y = Number(yards) || 100;
  const inchPerMoa = 1.047 * (y / 100);
  const moa = inches / inchPerMoa;
  return moa / clickValueMoa;
}

async function postAnalyze(file, yards) {
  const url = `${API_BASE}/api/analyze`;

  const fd = new FormData();
  fd.append("image", file);
  fd.append("yards", String(Number(yards) || 100));

  const res = await fetch(url, { method: "POST", body: fd });
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

window.clicksFromInches = clicksFromInches;
window.postAnalyze = postAnalyze;
