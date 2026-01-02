// frontend_new/api.js
export async function calc({ yards, clickValue, trueMoa, bullX, bullY, poibX, poibY }) {
  // Put your backend URL here after it's live, example:
  // const BASE = "https://sczn3-webapp-213.onrender.com";
  const BASE = "";

  const res = await fetch(`${BASE}/api/calc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yards, clickValue, trueMoa, bullX, bullY, poibX, poibY })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}
