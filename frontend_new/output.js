// frontend_new/output.js
// Output page logic (SEC Output)
//
// Responsibilities:
// 1) Show target thumbnail from sessionStorage
// 2) POST image + yards to backend /api/analyze
// 3) Render Score / Clicks / Tip (+ optional wind/elev lines)

(function () {
  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (sel) => document.querySelector(sel);

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt;
  }

  function setHTML(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmt2(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  // ---------------------------
  // DOM targets (try multiple IDs so we don’t break)
  // ---------------------------
  const statusEl =
    byId("status") || byId("msg") || byId("message") || $(".status") || $(".msg");

  const thumbEl =
    byId("thumb") || byId("targetThumb") || byId("targetImage") || $(".thumb img");

  // These are the ones you *probably* have in your output.html:
  // SCORE / CLICKS / TIP display areas (we try a few options)
  const scoreEl =
    byId("score") || byId("scoreValue") || byId("scoreVal") || $(".scoreValue");

  const clicksEl =
    byId("clicks") || byId("clicksValue") || byId("clicksVal") || $(".clicksValue");

  const tipEl =
    byId("tip") || byId("tipValue") || byId("tipVal") || $(".tipValue");

  // Optional wind/elev line placeholders
  const windEl =
    byId("wind") || byId("windLine") || byId("windage") || $(".windLine");

  const elevEl =
    byId("elev") || byId("elevLine") || byId("elevation") || $(".elevLine");

  // Optional: a "Run" button if you have one (otherwise we auto-run)
  const runBtn = byId("runBtn") || byId("analyzeBtn") || byId("generateBtn");

  function setStatus(msg, isErr = false) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.style.color = isErr ? "#b00020" : "";
  }

  // ---------------------------
  // Load inputs from sessionStorage
  // ---------------------------
  const dataUrl = sessionStorage.getItem("SEC_TARGET_DATAURL") || "";
  const yards = toNum(sessionStorage.getItem("SEC_YARDS"), 100) || 100;

  if (thumbEl && dataUrl) {
    thumbEl.src = dataUrl;
    thumbEl.style.display = "block";
  }

  // ---------------------------
  // Convert DataURL to Blob (for FormData)
  // ---------------------------
  async function dataUrlToBlob(url) {
    const res = await fetch(url);
    return await res.blob();
  }

  // ---------------------------
  // Compute "pilot score" (offset-only) if backend doesn’t supply a score
  // (Uses inches offset from bull if provided)
  // ---------------------------
  function computePilotScore(offsetInches) {
    // Simple pilot scoring:
    // 100 points at dead center, subtract 10 points per inch, floor at 0
    // (You can replace later with Smart Score™)
    const raw = 100 - offsetInches * 10;
    return Math.max(0, Math.min(100, raw));
  }

  // ---------------------------
  // Render output
  // ---------------------------
  function renderResult(result) {
    // We support multiple possible backend response shapes.
    //
    // Preferred (example):
    // result = {
    //   poib: { x_in: -1.25, y_in: 0.75, dist_in: 1.46 },
    //   clicks: { wind: -5.00, elev: 3.00, unit: "clicks" },
    //   lines: { wind: "LEFT 5.00", elev: "UP 3.00" },
    //   tip: "..."
    //   score: 88.2
    // }

    const tip = result.tip || result.shooter_tip || result.message || "";

    // Pull POIB offsets if present
    const xIn =
      toNum(result?.poib?.x_in, NaN) ??
      toNum(result?.poib?.xIn, NaN) ??
      toNum(result?.x_in, NaN) ??
      toNum(result?.xIn, NaN);

    const yIn =
      toNum(result?.poib?.y_in, NaN) ??
      toNum(result?.poib?.yIn, NaN) ??
      toNum(result?.y_in, NaN) ??
      toNum(result?.yIn, NaN);

    const distIn =
      toNum(result?.poib?.dist_in, NaN) ??
      toNum(result?.poib?.distIn, NaN) ??
      toNum(result?.dist_in, NaN) ??
      toNum(result?.distIn, NaN);

    // Click values (support many keys)
    const windClicks =
      toNum(result?.clicks?.wind, NaN) ??
      toNum(result?.clicks?.windage, NaN) ??
      toNum(result?.wind_clicks, NaN) ??
      toNum(result?.windClicks, NaN);

    const elevClicks =
      toNum(result?.clicks?.elev, NaN) ??
      toNum(result?.clicks?.elevation, NaN) ??
      toNum(result?.elev_clicks, NaN) ??
      toNum(result?.elevClicks, NaN);

    // Wind/Elev lines if backend already produces them
    const windLine =
      result?.lines?.wind ||
      result?.wind_line ||
      result?.windLine ||
      (Number.isFinite(windClicks)
        ? (windClicks >= 0 ? "RIGHT " : "LEFT ") + fmt2(Math.abs(windClicks))
        : "");

    const elevLine =
      result?.lines?.elev ||
      result?.elev_line ||
      result?.elevLine ||
      (Number.isFinite(elevClicks)
        ? (elevClicks >= 0 ? "UP " : "DOWN ") + fmt2(Math.abs(elevClicks))
        : "");

    // Score (use backend score if supplied, else compute pilot score from distIn)
    let score =
      toNum(result?.score, NaN) ??
      toNum(result?.smartScore, NaN) ??
      toNum(result?.SmartScore, NaN);

    if (!Number.isFinite(score)) {
      const offset = Number.isFinite(distIn) ? distIn : 0;
      score = computePilotScore(offset);
    }

    // Write Score / Clicks / Tip
    if (scoreEl) setText(scoreEl, fmt2(score));
    if (clicksEl) {
      // Compact, readable, two decimals
      const w = Number.isFinite(windClicks) ? fmt2(windClicks) : "0.00";
      const e = Number.isFinite(elevClicks) ? fmt2(elevClicks) : "0.00";
      setText(clicksEl, `WIND ${w}  |  ELEV ${e}`);
    }
    if (tipEl) setText(tipEl, tip || "—");

    // Optional lines
    if (windEl) setText(windEl, windLine || "");
    if (elevEl) setText(elevEl, elevLine || "");

    // Save for debugging / persistence
    sessionStorage.setItem("SEC_RESULT_JSON", JSON.stringify(result || {}));
    sessionStorage.setItem("SEC_LAST_SCORE", fmt2(score));

    setStatus("Ready.");
  }

  // ---------------------------
  // Call backend
  // ---------------------------
  async function runAnalyze() {
    try {
      setStatus("Analyzing...");
      if (!dataUrl) {
        setStatus("No target photo found. Go back and upload.", true);
        return;
      }

      const blob = await dataUrlToBlob(dataUrl);

      const fd = new FormData();
      // backend should accept "targetPhoto" or "file" — we send both names safely
      fd.append("targetPhoto", blob, "target.jpg");
      fd.append("file", blob, "target.jpg");
      fd.append("yards", String(yards));

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatus(`Analyze failed (${res.status}). ${txt}`.trim(), true);
        return;
      }

      const result = await res.json();
      renderResult(result);
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err), true);
    }
  }

  // ---------------------------
  // Start
  // ---------------------------
  setStatus("");

  // If there’s a button, wire it. Otherwise auto-run immediately.
  if (runBtn) {
    runBtn.addEventListener("click", runAnalyze);
  } else {
    runAnalyze();
  }
})();
