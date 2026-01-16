// sczn3-webapp/frontend_new/output.js
// Output page logic for output.html
//
// Shows:
// - Target thumbnail (from sessionStorage)
// - Distance (yards)
// - Tap & Score (score based on tap cluster distance from image center)
// - Scope Clicks (from backend /api/analyze when available)
// - Tip
//
// IMPORTANT:
// - Backend field name for image upload is "image" (per your backend_new/server.js)
// - Directions come from backend; frontend displays them (does not reinterpret)

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ---- Elements (match your output.html) ----
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

  // ---- Storage keys (must match index.js) ----
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY = "sczn3_distance_yards";
  const TAPS_KEY = "sczn3_tap_points_json";

  // ---- Helpers ----
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

  // True MOA inches per MOA at given yards
  function moaInchesAtYards(yards) {
    const y = Number(yards) || 100;
    return 1.047 * (y / 100);
  }

  // 0.25 MOA per click (pilot default)
  function clicksFromInches(inches, yards, moaPerClick = 0.25) {
    const inch = Math.abs(Number(inches) || 0);
    const moa = inch / moaInchesAtYards(yards);
    const clicks = moa / (Number(moaPerClick) || 0.25);
    return Number.isFinite(clicks) ? clicks : 0;
  }

  // Converts dataURL -> Blob (for FormData upload)
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

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent =
      (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  // ---- SEC-ID (simple + stable for session) ----
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

  // If no photo, stop
  if (!dataUrl || !targetThumb) {
    show(noDataBanner);
    hide(resultsGrid);
    setText(scoreText, "—");
    setText(tipText, "—");
    return;
  }

  // Show thumbnail
  targetThumb.src = dataUrl;

  // Default UI state
  show(noDataBanner);
  hide(resultsGrid);
  setText(scoreText, "—");
  setText(elevClicksText, "—");
  setDir(elevDirText, "");
  setText(windClicksText, "—");
  setDir(windDirText, "");
  setText(tipText, "—");

  // ---- Tap & Score (score from taps) ----
  // Pilot scoring:
  // - Compute POIB (avg of taps)
  // - Compute offset distance in pixels to image center
  // - Score = max(0, 1000 - offsetPx) (simple, intuitive, fast)
  // NOTE: This is a pilot score (not a competition/verified score).
  function computeTapScore() {
    const taps = safeJsonParse(sessionStorage.getItem(TAPS_KEY) || "");
    if (!Array.isArray(taps) || taps.length === 0) {
      return { has: false };
    }

    // Use NATURAL pixel dimensions if available after image loads
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

    // Simple pilot score (higher is better)
    const score = Math.max(0, 1000 - offsetPx);

    return {
      has: true,
      count: c,
      score: Math.round(score),
      offsetPx: offsetPx,
    };
  }

  // Fill score immediately (after image loads so naturalWidth exists)
  targetThumb.onload = () => {
    const tap = computeTapScore();
    if (tap.has) {
      setText(scoreText, String(tap.score));
      // Helpful pilot tip (non-verified)
      setText(
        tipText,
        `Tap & Score pilot: ${tap.count} shot(s) recorded. Smaller offset wins.`
      );
    } else {
      setText(scoreText, "—");
      setText(
        tipText,
        "No Tap & Score shots found yet. Go back and tap your shots on the thumbnail."
      );
    }
  };

  // ---- Backend analyze -> scope clicks (optional but preferred) ----
  async function postAnalyzeToBackend(endpoint) {
    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();

    // BACKEND expects: field name "image"
    fd.append("image", blob, "target.jpg");

    const res = await fetch(endpoint, { method: "POST", body: fd });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function fillClicksFromBackend(data) {
    // Expected from your LOCK backend:
    // correction_in: {dx, dy}  (inches)
    // directions: {windage, elevation}
    const dx = Number(data?.correction_in?.dx);
    const dy = Number(data?.correction_in?.dy);

    const windDir = data?.directions?.windage || "";
    const elevDir = data?.directions?.elevation || "";

    // If dx/dy missing, don't fill clicks
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;

    const yards = Number(distance) || 100;

    const windClicks = clicksFromInches(dx, yards, 0.25);
    const elevClicks = clicksFromInches(dy, yards, 0.25);

    // Always 2 decimals
    setText(windClicksText, f2(windClicks));
    setDir(windDirText, windDir);

    setText(elevClicksText, f2(elevClicks));
    setDir(elevDirText, elevDir);

    return true;
  }

  (async function () {
    // Try these endpoints (Render may host backend on another origin later;
    // for now this is same-origin safe)
    const endpoints = ["/api/analyze", "/analyze"];

    for (const ep of endpoints) {
      try {
        const data = await postAnalyzeToBackend(ep);

        const ok = !!data?.ok;
        const filled = fillClicksFromBackend(data);

        // If backend works, show results grid
        hide(noDataBanner);
        show(resultsGrid);

        // If score wasn't set yet (image not loaded), keep what we have
        // Tip: add a clear, honest pilot note
        if (filled && ok) {
          // Keep existing tip if taps exist; otherwise set a basic one
          const currentTip = (tipText && tipText.textContent) ? tipText.textContent : "";
          if (!currentTip || currentTip === "—") {
            setText(tipText, "Pilot: directions are locked; clicks are True MOA.");
          }
        }

        // Uncomment if you want debug always visible:
        // debug("Backend data", data);

        return;
      } catch (err) {
        // try next endpoint
      }
    }

    // No backend found: still show score if taps exist
    const tap = computeTapScore();
    if (tap.has) {
      hide(noDataBanner);
      show(resultsGrid);

      // Clicks unknown without backend inches
      setText(elevClicksText, "—");
      setDir(elevDirText, "");
      setText(windClicksText, "—");
      setDir(windDirText, "");

      // Keep a truthful tip
      setText(
        tipText,
        "Tap & Score pilot is working. Scope clicks will appear once the backend /api/analyze is reachable."
      );
    } else {
      // Keep banner visible (no data)
      show(noDataBanner);
      hide(resultsGrid);
    }
  })();
})();
