// sczn3-webapp/frontend_new/output.js
(() => {
  const $ = (id) => document.getElementById(id);

  // ===== DEMO OVERRIDE (manual dx/dy) =====
  const FORCE_DEMO = true;
  const DEMO_DX = "-2.00";
  const DEMO_DY = "-3.00";

  // ===== STORAGE KEYS (must match index.js) =====
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

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

  const debugBox = $("debugBox");

  function debug(msg, obj) {
    console.log(msg, obj || "");
    if (debugBox) {
      debugBox.classList.remove("hidden");
      debugBox.style.whiteSpace = "pre-wrap";
      debugBox.textContent = msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    }
  }

  function safeJsonParse(str){
    try { return JSON.parse(str); } catch { return null; }
  }

  function loadTaps(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
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

  if (!imgData) {
    debug(
      "NO PHOTO FOUND IN sessionStorage.\n\nFix:\n1) Open the FRONTEND URL\n2) Upload photo\n3) Press PRESS TO SEE (don’t open output.html directly / don’t open in a new tab)."
    );
    return;
  }

  if (thumb) thumb.src = imgData;

  if (thumb) {
    thumb.onload = () => analyzeBackend(imgData, yards);
    thumb.onerror = () => debug("Thumbnail failed to load. Bad dataUrl?");
  } else {
    analyzeBackend(imgData, yards);
  }

  async function analyzeBackend(dataUrl, yards) {
    try {
      const blob = await dataUrlToBlob(dataUrl);

      const fd = new FormData();
      fd.append("image", blob, "target.jpg");
      fd.append("distanceYards", String(yards));
      fd.append("moaPerClick", "0.25");

      // ✅ SEND TAPS (Tap N Score)
      const taps = loadTaps();
      fd.append("taps", JSON.stringify(taps));

      // Optional manual override (for quick testing)
      if (FORCE_DEMO) {
        fd.append("dx", DEMO_DX);
        fd.append("dy", DEMO_DY);
      }

      const res = await fetch(ANALYZE_URL, { method: "POST", body: fd });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        debug(`Analyze failed: HTTP ${res.status}`, t ? { body: t } : null);
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data || data.ok !== true) {
        debug("Analyze returned bad JSON:", data);
        return;
      }

      const ci = data.correction_in || {};
      const dx = Number(ci.dx ?? 0);
      const dy = Number(ci.dy ?? 0);

      // Click math (True MOA, 0.25 MOA/click)
      const inchPerMOA = 1.047 * (yards / 100);
      const clicks = (inches) => (Math.abs(inches) / inchPerMOA / 0.25).toFixed(2);

      if (elevClicks) elevClicks.textContent = clicks(dy);
      if (windClicks) windClicks.textContent = clicks(dx);

      if (elevDir) elevDir.textContent = data.directions?.elevation || (dy === 0 ? "" : (dy > 0 ? "UP" : "DOWN"));
      if (windDir) windDir.textContent = data.directions?.windage || (dx === 0 ? "" : (dx > 0 ? "RIGHT" : "LEFT"));

      if (scoreText) scoreText.textContent = String(data.score ?? "—");

      // Show something useful even while we’re still pixel-based
      const tapsCount = Array.isArray(taps) ? taps.length : 0;
      if (tipText) {
        tipText.textContent =
          String(data.tip ?? "") ||
          (tapsCount ? `Taps sent: ${tapsCount}.` : "No taps yet — tap your shots on the image.");
      }

      if (noData) noData.classList.add("hidden");
      if (results) results.classList.remove("hidden");
    } catch (err) {
      debug("Analyze exception:", { error: String(err) });
    }
  }

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
