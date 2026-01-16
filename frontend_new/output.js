// ===== FULL REPLACEMENT: analyze() + helpers for output.js =====
// Drop this into your output.js and REMOVE your old analyze() function.
// It will POST to your Render backend instead of trying "/api/analyze" on the static site.

async function analyze() {
  const API_BASE = "https://sczn3-backend-new1.onrender.com";
  const endpoint = `${API_BASE}/api/analyze`;

  try {
    // imgData is your sessionStorage dataUrl string already loaded above in your file
    // Example: const imgData = sessionStorage.getItem(PHOTO);
    if (!imgData) return;

    // Convert the dataURL -> Blob
    const blob = await dataUrlToBlob(imgData);

    // Build multipart/form-data to match multer field name: "image"
    const fd = new FormData();
    fd.append("image", blob, "target.jpg");

    // POST to backend
    const res = await fetch(endpoint, {
      method: "POST",
      body: fd
    });

    // Helpful debug if backend errors
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.log("Analyze failed:", res.status, txt);
      return;
    }

    const data = await res.json().catch(() => null);

    // If backend is still placeholder, you'll see correction_in null
    if (!data || !data.correction_in || data.correction_in.dx == null || data.correction_in.dy == null) {
      console.log("Backend returned JSON but no correction_in found:", data);
      return;
    }

    // Click math (True MOA)
    const inchPerMOA = 1.047 * (yards / 100);
    const clicks = (inches) => (Math.abs(inches) / inchPerMOA / 0.25).toFixed(2);

    // Fill UI
    elevClicks.textContent = clicks(data.correction_in.dy);
    windClicks.textContent = clicks(data.correction_in.dx);

    elevDir.textContent = (data.directions && data.directions.elevation) ? data.directions.elevation : "";
    windDir.textContent = (data.directions && data.directions.windage) ? data.directions.windage : "";

    // Show results panel
    noData.classList.add("hidden");
    results.classList.remove("hidden");
  } catch (err) {
    console.log("Analyze exception:", err);
  }
}

// --- helper: dataURL -> Blob (works reliably on iOS Safari too)
async function dataUrlToBlob(dataUrl) {
  // fetch(dataUrl) works in modern browsers, but this is safest across iOS weirdness:
  const parts = String(dataUrl).split(",");
  if (parts.length < 2) throw new Error("Bad dataUrl");
  const header = parts[0];
  const base64 = parts[1];
  const mime = (header.match(/data:(.*?);base64/i) || [])[1] || "application/octet-stream";

  const binStr = atob(base64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);

  return new Blob([bytes], { type: mime });
}
