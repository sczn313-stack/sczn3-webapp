// sczn3-webapp/frontend_new/output.js
(() => {
  const $ = (id) => document.getElementById(id);

  // Storage keys
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  // Optional: set this once in console if you want
  // sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com");
  const BACKEND_BASE =
    sessionStorage.getItem("sczn3_backend_base") ||
    "https://sczn3-backend-new1.onrender.com";

  // Elements (MUST match output.html)
  const secIdText      = $("secIdText");
  const targetThumb    = $("targetThumb");
  const distanceText   = $("distanceText");
  const adjText        = $("adjText");

  const noDataBanner   = $("noDataBanner");
  const resultsGrid    = $("resultsGrid");

  const scoreText      = $("scoreText");
  const elevClicksText = $("elevClicksText");
  const windClicksText = $("windClicksText");
  const elevDirText    = $("elevDirText");
  const windDirText    = $("windDirText");
  const tipText        = $("tipText");

  const debugBox       = $("debugBox");

  function showResults() {
    if (noDataBanner) noDataBanner.classList.add("hidden");
    if (resultsGrid)  resultsGrid.classList.remove("hidden");
  }

  function debug(msg) {
    if (!debugBox) return;
    debugBox.classList.remove("hidden");
    debugBox.style.whiteSpace = "pre-wrap";
    debugBox.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    debugBox.style.fontSize = "12px";
    debugBox.style.marginTop = "10px";
    debugBox.textContent = msg;
  }

  // -------- SEC ID --------
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2, 8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  if (secIdText) secIdText.textContent = `SEC-ID — ${sid}`;

  // -------- Base data --------
  const imgDataUrl = sessionStorage.getItem(PHOTO_KEY);
  const yards = Number(sessionStorage.getItem(DIST_KEY) || 100);

  if (distanceText) distanceText.textContent = String(yards);
  if (adjText) adjText.textContent = "1/4 MOA per click";

  if (!imgDataUrl) {
    debug("No target photo found in sessionStorage. Go back and upload again.");
    return;
  }

  if (targetThumb) targetThumb.src = imgDataUrl;

  // -------- Tap-N-Score (fast local result) --------
  function computeTapScoreWhenReady() {
    if (!targetThumb) return;

    targetThumb.onload = () => {
      try {
        const taps = JSON.parse(sessionStorage.getItem(TAPS_KEY) || "[]");
        if (!Array.isArray(taps) || taps.length === 0) {
          // No taps: do nothing (backend may still fill clicks)
          return;
        }

        const w = targetThumb.naturalWidth || 1;
        const h = targetThumb.naturalHeight || 1;

        let sx = 0, sy = 0;
        for (const p of taps) { sx += Number(p.x || 0); sy += Number(p.y || 0); }

        const px = sx / taps.length;
        const py = sy / taps.length;

        const cx = w / 2;
        const cy = h / 2;

        const dist = Math.hypot(px - cx, py - cy);
        const score = Math.max(0, Math.round(1000 - dist));

        if (scoreText) scoreText.textContent = String(score);
        if (tipText) tipText.textContent = `Tap N Score pilot — ${taps.length} shot(s) recorded.`;

        showResults();
      } catch (e) {
        debug("Tap score parse failed: " + String(e?.message || e));
      }
    };
  }

  computeTapScoreWhenReady();

  // -------- Backend analyze (clicks + directions) --------
  async function analyzeBackend() {
    try {
      // Convert dataUrl -> Blob
      const blob = await (await fetch(imgDataUrl)).blob();
      const fd = new FormData();
      fd.append("image", blob, "target.jpg");
      fd.append("distanceYards", String(yards));

      const url = `${BACKEND_BASE}/api/analyze`;
      const res = await fetch(url, { method: "POST", body: fd });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        debug(`Backend failed:\n${url}\nHTTP ${res.status}\n${t}`);
        return;
      }

      const data = await res.json();

      // Expecting: data.correction_in = { dx, dy } and data.directions = { windage, elevation }
      if (!data || !data.correction_in) {
        debug("Backend returned JSON but no correction_in found:\n" + JSON.stringify(data, null, 2));
        return;
      }

      const dx = Number(data.correction_in.dx || 0);
      const dy = Number(data.correction_in.dy || 0);

      // True MOA inches at distance
      const inchPerMOA = 1.047 * (yards / 100);
      const clicksFromInches = (v) => (Math.abs(v) / inchPerMOA / 0.25).toFixed(2);

      if (elevClicksText) elevClicksText.textContent = clicksFromInches(dy);
      if (windClicksText) windClicksText.textContent = clicksFromInches(dx);

      if (elevDirText) elevDirText.textContent = data?.directions?.elevation ? ` ${data.directions.elevation}` : "";
      if (windDirText) windDirText.textContent = data?.directions?.windage ? ` ${data.directions.windage}` : "";

      // If there were no taps, still show something useful
      if (tipText && (!tipText.textContent || tipText.textContent.trim() === "—")) {
        tipText.textContent = "Backend analysis complete.";
      }

      showResults();
    } catch (e) {
      debug("Backend analyze exception: " + String(e?.message || e));
    }
  }

  analyzeBackend();
})();
