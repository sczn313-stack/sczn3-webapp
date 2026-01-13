// api.js
// Set your backend URL here (Render web service / API)
const API_BASE =
  window.API_BASE ||
  "https://YOUR-BACKEND-URL-HERE"; // <-- paste your backend base URL

async function postAnalyzeTarget({ file, yards }) {
  // Adjust endpoint name to match your backend
  // Example: /api/analyze  or /analyze  etc.
  const url = `${API_BASE}/api/analyze`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("yards", String(yards || 100));

  const res = await fetch(url, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || "Request failed"}`);
  }

  return res.json();
}
