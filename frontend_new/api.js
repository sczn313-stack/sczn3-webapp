// frontend_new/api.js
// API base (set to your Render backend URL later)
const API_BASE = ""; // example: "https://YOUR-BACKEND.onrender.com"

function apiUrl(path) {
  if (!API_BASE) throw new Error("API_BASE not set in api.js");
  return API_BASE.replace(/\/$/, "") + path;
}

// POST /analyze with form-data { image }
export async function analyzeImage(file) {
  const fd = new FormData();
  fd.append("image", file);

  const res = await fetch(apiUrl("/analyze"), {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Analyze failed (${res.status}): ${txt || res.statusText}`);
  }

  return await res.json();
}
