// sczn3-webapp/frontend_new/output.js
// FULL REPLACEMENT — Tap N Score + Backend Clicks (True MOA, 2 decimals)
//
// Requires output.html IDs:
// secIdText, targetThumb, distanceText, adjText,
// noDataBanner, resultsGrid,
// scoreText, elevClicksText, elevDirText, windClicksText, windDirText, tipText,
// debugBox (optional)
//
// Storage keys (from index.js):
// sczn3_targetPhoto_dataUrl
// sczn3_distance_yards
// sczn3_tap_points_json (optional for Tap N Score)

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ===== BACKEND BASE URL (REQUIRED) =====
  // Put your backend Render service URL here (the one that serves /api/analyze).
  // Example: const API_BASE = "https://sczn3-sec-backend-144.onrender.com";
  const API_BASE = "https://YOUR-BACKEND-SERVICE.onrender.com";

  // ---- Elements ----
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
  const yardsNum = Number(distance) || 100;

  setText(distanceText, yardsNum);
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
  if (!dataUrl || !targetThumb) {
    setText(tipText, "No target photo found. Go back and upload a photo first.");
    return;
  }

  // Show thumbnail
  targetThumb.src = dataUrl;

  // ---- Tap N Score (score from taps) ----
  // Pilot scoring:
  // - POIB = average of taps
  // - offsetPx = distance from POIB to image center (in pixels)
  // - score = max(0, 1000 - offsetPx)
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

    const offsetPx = Math.hypot(dx, dy);
    const score = Math.max(0, 1000 - offsetPx);

    return { has: true, count: c, score: Math.round(score) };
  }

  // Fill score after image loads (so naturalWidth exists)
  targetThumb.onload = () => {
    const tap = computeTapScore();
    if (tap.has) {
      setText(scoreText, String(tap.score));
      setText(tipText, `Tap N Score pilot — ${tap.count} shot(s) recorded.`);
      hide(noDataBanner);
      show(resultsGrid);
    } else {
      // leave banner until backend returns clicks (or user taps shots)
      setText(
        tipText,
        "No Tap N Score shots found yet. (If you’re testing taps: go back and tap the shots.)"
      );
    }
  };

  // ---- Backend analyze -> scope clicks ----
  async function postAnalyzeToBackend() {
    // Hard guard: if user forgot to set API_BASE
    if (!API_BASE || API_BASE.includes("YOUR-BACKEND-SERVICE")) {
      throw new Error("API_BASE not set");
    }

    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();

    // BACKEND expects field name "image"
    fd.append("image", blob, "target.jpg");

    const url = `${API_BASE.replace(/\/$/, "")}/api/analyze`;
    const res = await fetch(url, { method: "POST", body: fd });

    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function fillClicksFromBackend(data) {
    // Expected:
    // correction_in: { dx, dy }  (inches)
    // directions: { windage, elevation }
    const dx = Number(data?.correction_in?.dx);
    const dy = Number(data?.correction_in?.dy);

    const windDir = data?.directions?.windage || "";
    const elevDir = data?.directions?.elevation || "";

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;

    const windClicks = clicksFromInches(dx, yardsNum, 0.25);
    const elevClicks = clicksFromInches(dy, yardsNum, 0.25);

    // Always 2 decimals
    setText(windClicksText, f2(windClicks));
    setDir(windDirText, windDir);

    setText(elevClicksText, f2(elevClicks));
    setDir(elevDirText, elevDir);

    return true;
  }

  (async function () {
    try {
      const data = await postAnalyzeToBackend();

      // Show results area
      hide(noDataBanner);
      show(resultsGrid);

      const filled = fillClicksFromBackend(data);

      // Tip priority:
      // - If taps exist, keep Tap N Score tip
      // - Else add truthful backend note
      const currentTip = tipText ? String(tipText.textContent || "").trim() : "";
      if (!currentTip || currentTip === "—") {
        setText(tipText, "Pilot: directions are locked; clicks are True MOA.");
      }

      if (!filled) {
        setText(
          tipText,
          "Backend responded, but did not return correction inches. (Check backend response fields.)"
        );
      }

      // If you want to see backend payload on screen, uncomment:
      // debug("Backend data", data);
    } catch (err) {
      // If taps were enough to show results, keep them.
      // Otherwise keep banner and show an honest message.
      const tap = computeTapScore();
      if (tap.has) {
        hide(noDataBanner);
        show(resultsGrid);

        // clicks not available without backend
        setText(elevClicksText, "—");
        setDir(elevDirText, "");
        setText(windClicksText, "—");
        setDir(windDirText, "");

        // keep a truthful note
        setText(
          tipText,
          "Tap N Score pilot is working. Scope clicks will appear once the backend /api/analyze is reachable."
        );
      } else {
        show(noDataBanner);
        hide(resultsGrid);

        // Most common reason: frontend is static + API_BASE not set or CORS blocked
        if (!API_BASE || API_BASE.includes("YOUR-BACKEND-SERVICE")) {
          setText(
            tipText,
            "Set API_BASE in output.js to your backend Render URL, then refresh."
          );
        } else {
          setText(
            tipText,
            "Backend is not reachable yet (or CORS blocked). Confirm backend is live and allows requests from this frontend."
          );
        }

        // Optional on-screen debug
        // debug("Analyze failed", { message: String(err && err.message ? err.message : err) });
      }
    }
  })();
})();
