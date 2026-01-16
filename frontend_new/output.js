// sczn3-webapp/frontend_new/output.js
// SEC Output page logic for output.html
// - Shows thumbnail + distance
// - Shows Tap N Score (from sessionStorage taps)
// - Calls backend /api/analyze to fill True MOA clicks + directions
//
// Backend live:
//   https://sczn3-backend-new1.onrender.com

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ---- Elements (match your output.html that uses noDataBanner + resultsGrid) ----
  const secIdText = $("secIdText");

  const targetThumb = $("targetThumb");
  const distanceText = $("distanceText");
  const adjText = $("adjText");

  const noDataBanner = $("noDataBanner");
  const resultsGrid = $("resultsGrid");

  const scoreText = $("scoreText");
  const elevClicksText = $("elevClicksText");
  const elevDirText = $("elevDirText");
  const windClicksText = $("windClicksText");
  const windDirText = $("windDirText");
  const tipText = $("tipText");

  const debugBox = $("debugBox");

  // ---- Storage keys ----
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY = "sczn3_distance_yards";
  const TAPS_KEY = "sczn3_tap_points_json";

  // ---- Backend base ----
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  // ---- UI helpers ----
  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
  }
  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
  }
  function setText(el, value) {
    if (!el) return;
    el.textContent = value == null || value === "" ? "—" : String(value);
  }
  function setDir(el, dir) {
    if (!el) return;
    const d = String(dir || "").trim().toUpperCase();
    el.textContent = d ? d : "";
  }
  function f2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }
  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent =
      (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  // True MOA inches per MOA at given yards
  function moaInchesAtYards(yards) {
    const y = Number(yards) || 100;
    return 1.047 * (y / 100);
  }

  // 0.25 MOA per click default
  function clicksFromInches(inches, yards, moaPerClick = 0.25) {
    const inch = Math.abs(Number(inches) || 0);
    const moa = inch / moaInchesAtYards(yards);
    const clicks = moa / (Number(moaPerClick) || 0.25);
    return Number.isFinite(clicks) ? clicks : 0;
  }

  // dataURL -> Blob (FormData upload)
  function dataUrlToBlob(url) {
    const parts = String(url || "").split(",");
    if (parts.length < 2) return new Blob([], { type: "image/jpeg" });

    const header = parts[0];
    const base64 = parts[1];

    const mime = (header.match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bstr = atob(base64);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  // ---- SEC-ID ----
  if (secIdText) {
    const existing = sessionStorage.getItem("sczn3_sec_id");
    if (existing) {
      secIdText.textContent = "SEC-ID — " + existing;
    } else {
      const gen = Math.random().toString(16).slice(2, 8).toUpperCase();
      sessionStorage.setItem("sczn3_sec_id", gen);
      secIdText.textContent = "SEC-ID — " + gen;
    }
  }

  // ---- Load basics ----
  const dataUrl = sessionStorage.getItem(PHOTO_KEY);
  const distance = sessionStorage.getItem(DIST_KEY) || "100";

  setText(distanceText, distance);
  setText(adjText, "1/4 MOA per click");

  // Default UI state
  show(noDataBanner);
  hide(resultsGrid);
  setText(scoreText, "—");
  setText(elevClicksText, "—");
  setDir(elevDirText, "");
  setText(windClicksText, "—");
  setDir(windDirText, "");
  setText(tipText, "—");

  // If no photo, stop
  if (!dataUrl || !targetThumb) return;

  // Show thumbnail
  targetThumb.src = dataUrl;

  // ---- Tap N Score ----
  function computeTapScore() {
    const taps = safeJsonParse(sessionStorage.getItem(TAPS_KEY) || "");
    if (!Array.isArray(taps) || taps.length === 0) return { has: false };

    const w = targetThumb.naturalWidth || 1;
    const h = targetThumb.naturalHeight || 1;

    let sx = 0,
      sy = 0,
      c = 0;

    for (const p of taps) {
      const x = Number(p && p.x);
      const y = Number(p && p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sx += x;
      sy += y;
      c++;
    }

    if (c === 0) return { has: false };

    const poibX = sx / c;
    const poibY = sy / c;

    const cx = w / 2;
    const cy = h / 2;

    const dx = poibX - cx;
    const dy = poibY - cy;

    const offsetPx = Math.sqrt(dx * dx + dy * dy);
    const score = Math.max(0, 1000 - offsetPx);

    return { has: true, count: c, score: Math.round(score) };
  }

  // Fill score after image loads (naturalWidth exists)
  targetThumb.onload = () => {
    const tap = computeTapScore();
    if (tap.has) {
      setText(scoreText, String(tap.score));
      setText(tipText, `Tap N Score pilot — ${tap.count} shot(s) recorded.`);
      hide(noDataBanner);
      show(resultsGrid);
    } else {
      // no taps yet: keep banner until backend fills clicks
      setText(
        tipText,
        "No Tap N Score shots found yet. Go back and tap your shots on the image."
      );
    }
  };

  // ---- Backend analyze ----
  async function postAnalyze(endpoint) {
    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();
    fd.append("image", blob, "target.jpg"); // backend expects field: image

    const res = await fetch(endpoint, { method: "POST", body: fd });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function fillClicks(data) {
    // expects: correction_in: {dx, dy} inches
    //          directions: {windage, elevation}
    const dx = Number(data?.correction_in?.dx);
    const dy = Number(data?.correction_in?.dy);

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;

    const yards = Number(distance) || 100;

    const windClicks = clicksFromInches(dx, yards, 0.25);
    const elevClicks = clicksFromInches(dy, yards, 0.25);

    setText(windClicksText, f2(windClicks));
    setDir(windDirText, data?.directions?.windage || "");

    setText(elevClicksText, f2(elevClicks));
    setDir(elevDirText, data?.directions?.elevation || "");

    return true;
  }

  (async function () {
    // Try same-origin first, then your backend URL.
    // NOTE: If CORS is not enabled on backend, the 2nd call will be blocked.
    const endpoints = [
      "/api/analyze",
      "/analyze",
      BACKEND_BASE + "/api/analyze",
      BACKEND_BASE + "/analyze",
    ];

    for (const ep of endpoints) {
      try {
        const data = await postAnalyze(ep);

        const filled = fillClicks(data);
        if (filled) {
          hide(noDataBanner);
          show(resultsGrid);

          // Only override tip if we still have no useful tip
          if (tipText && (!tipText.textContent || tipText.textContent === "—")) {
            setText(tipText, "Pilot: directions locked • True MOA clicks.");
          }
          return;
        }
      } catch (err) {
        // try next endpoint
      }
    }

    // If we got here: backend not reachable or CORS blocked.
    // Keep Tap N Score if available; otherwise keep banner.
    const tap = computeTapScore();
    if (tap.has) {
      hide(noDataBanner);
      show(resultsGrid);
      setText(
        tipText,
        "Tap N Score pilot is working. Scope clicks will appear once /api/analyze is reachable (or CORS is enabled)."
      );
    } else {
      show(noDataBanner);
      hide(resultsGrid);
    }

    // If you want to SEE what happened, uncomment:
    // debug("Backend not reachable (or CORS blocked).", { tried: endpoints });
  })();
})();
