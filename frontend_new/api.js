// frontend_new/api.js

// Set this to your REAL backend URL (NO < > brackets).
// Example: https://sczn3-webapp-444.onrender.com
const API_BASE = "https://YOUR-BACKEND-ONRENDER-URL-HERE";

// We’ll try common endpoints in order.
const ENDPOINTS = ["/analyze", "/api/analyze", "/v1/analyze"];

function assertApiBase() {
  if (
    !API_BASE ||
    API_BASE.includes("<") ||
    API_BASE.includes(">") ||
    API_BASE.includes("YOUR-BACKEND")
  ) {
    throw new Error(
      "API_BASE not set. Open frontend_new/api.js and set API_BASE to your backend URL (no < >)."
    );
  }
  return API_BASE.replace(/\/+$/, "");
}

async function postForm(url, formData) {
  const res = await fetch(url, { method: "POST", body: formData });

  // Parse JSON if possible (even on errors)
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}

export async function analyzeImage(file) {
  if (!file) throw new Error("No file provided");

  const base = assertApiBase();

  const form = new FormData();
  // Support either backend field name
  form.append("image", file, file.name);
  form.append("file", file, file.name);

  let lastErr = null;

  for (const path of ENDPOINTS) {
    try {
      return await postForm(`${base}${path}`, form);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Analyze failed");
}
