// sczn3-webapp/frontend_new/output.js
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== STORAGE KEYS (must match index.js) =====
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";

  // ===== BACKEND (Render web service) =====
  const API_BASE = "https://sczn3-backend-new1.onrender.com";
  const ANALYZE_URL = `${API_BASE}/api/analyze`;

  // ===== DOM =====
  const secIdText     = $("secIdText");
  const thumb         = $("targetThumb");
  const distanceText  = $("distanceText");
  const adjText       = $("adjText");

  const noData   = $("noData");
  const results  = $("results");

  const scoreText   = $("scoreText");
  const elevClicks  = $("elevClicks");
  const windClicks  = $("windClicks");
  const elevDir     = $("elevDir");
  const windDir     = $("windDir");
  const tipText     = $("tipText");

  // Optional debug area (if you have it in output.html). If not, we fall back to console.
  const debugBox = $("debugBox");

  function debug(msg, obj) {
    console.log(msg, obj || "");
    if (debugBox) {
      debugBox.style.display = "block";
      debugBox.textContent =
        msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    }
  }

  // ===== SEC ID =====
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2, 8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  if (secIdText) secIdText.textContent = `SEC-ID — ${sid}`;

  // ===== LOAD STORED DATA =====
  const imgData = sessionStorage.getItem(PHOTO_KEY);
  const yards = Number(sessionStorage.getItem(DIST_KEY) || 100);

  if (distanceText) distanceText.textContent = String(yards);
  if (adjText) adjText.textContent = "1/4 MOA per click";

  // If missing image, show WHY (this is the exact problem in your screenshot)
  if (!imgData) {
    debug(
      "NO PHOTO FOUND IN sessionStorage.\n\nFix:\n1) Open the FRONTEND URL (sczn3-frontend-new.onrender.com)\n2) Upload photo\n3) Press PRESS TO SEE (do NOT open output.html on the backend domain)."
    );
    // keep the "no results found" visible
    return;
  }

  // ===== SHOW IMAGE =====
  if (thumb) thumb.src = imgData;

  // Ensure analyze runs AFTER the image is loaded
  if (thumb) {
    thumb.onload = () => {
      // You can keep your Tap N Score logic here if you want.
      // For now, just analyze with backend:
      analyzeBackend(imgData, yards);
    };
    thumb.onerror = () => debug("Thumbnail failed to load. Bad dataUrl?");
  } else {
    // If no thumb element, still attempt analyze
    analyzeBackend(imgData, yards);
  }

  async function analyzeBackend(dataUrl, yards) {
    try {
      const blob = await dataUrlToBlob(dataUrl);

      const fd = new FormData();
      fd.append("image", blob, "target.jpg");

      const res = await fetch(ANALYZE_URL, { method: "POST", body: fd });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        debug(`Analyze failed: HTTP ${res.status}`, t ? { body: t } : null);
        return;
      }

      const data = await res.json().catch(() => null);

      // Backend placeholder case:
      if (!data || !data.correction_in) {
        debug("Backend returned JSON but correction_in is missing (backend is still placeholder).", data);
        return;
      }

      const { dx, dy } = data.correction_in;

      // Click math (True MOA, 0.25 MOA/click)
      const inchPerMOA = 1.047 * (yards / 100);
      const clicks = (inches) => (Math.abs(inches) / inchPerMOA / 0.25).toFixed(2);

      if (elevClicks) elevClicks.textContent = clicks(dy);
      if (windClicks) windClicks.textContent = clicks(dx);

      if (elevDir) elevDir.textContent = data.directions?.elevation || "";
      if (windDir) windDir.textContent = data.directions?.windage || "";

      if (tipText) tipText.textContent = "Backend analyze OK.";

      // show results
      if (noData) noData.classList.add("hidden");
      if (results) results.classList.remove("hidden");
    } catch (err) {
      debug("Analyze exception:", { error: String(err) });
    }
  }

  // iOS-safe dataURL -> Blob
  async function dataUrlToBlob(dataUrl) {
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
})();
