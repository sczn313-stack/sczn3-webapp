// frontend_new/output.js
// Output page logic for output.html (the one you pasted)
//
// Works in BOTH modes:
// A) Tap-demo mode (demo.html): results exist in sessionStorage -> show immediately
// B) Upload-photo mode (index.html): if results exist -> show; otherwise show "no data"

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ---- Elements (match output.html) ----
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

  // ---- Storage keys (must match index/demo) ----
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY   = "sczn3_distance_yards";
  const RESULT_KEY = "sczn3_sec_results_json";

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
    el.textContent = value == null ? "—" : String(value);
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function setDir(el, dir) {
    if (!el) return;
    const d = (dir || "").toString().trim();
    el.textContent = d ? d : "";
  }

  function setClicks(value, valueEl, dir, dirEl) {
    // value can be "4.25" or "4.25 UP" or { clicks:"4.25", dir:"UP" }
    if (value && typeof value === "object") {
      setText(valueEl, value.clicks ?? value.value ?? "—");
      setDir(dirEl, value.dir ?? "");
      return;
    }

    const s = (value == null ? "" : String(value)).trim();
    if (!s) {
      setText(valueEl, "—");
      setDir(dirEl, "");
      return;
    }

    const parts = s.split(/\s+/);
    if (parts.length >= 2) {
      setText(valueEl, parts[0]);
      setDir(dirEl, parts.slice(1).join(" "));
    } else {
      setText(valueEl, s);
      setDir(dirEl, dir || "");
    }
  }

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent = (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  // ---- SEC ID (simple + stable per session) ----
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

  // ---- Load basics (photo/thumbnail + distance) ----
  const dataUrl = sessionStorage.getItem(PHOTO_KEY);
  const distance = sessionStorage.getItem(DIST_KEY) || "100";

  setText(distanceText, distance);
  setText(adjText, "1/4 MOA per click");

  if (dataUrl && targetThumb) targetThumb.src = dataUrl;

  // ---- If results exist (tap demo OR cached), show them ----
  const cached = safeJsonParse(sessionStorage.getItem(RESULT_KEY) || "");
  if (cached) {
    hide(noDataBanner);
    show(resultsGrid);

    setText(scoreText, cached.score ?? cached.smartScore ?? "—");

    const elevVal =
      cached.elevation ?? cached.elev ?? cached.elevClicks ?? cached.elev_clicks ?? null;
    const windVal =
      cached.windage ?? cached.wind ?? cached.windClicks ?? cached.wind_clicks ?? null;

    setClicks(elevVal, elevClicksText, cached.elevDir, elevDirText);
    setClicks(windVal, windClicksText, cached.windDir, windDirText);

    setText(tipText, cached.tip ?? cached.message ?? "—");

    // Optional debug if you ever want to show it
    // debug("Results (cached)", cached);
    return;
  }

  // No results exist yet -> show banner
  show(noDataBanner);
  hide(resultsGrid);

  // If no thumbnail, they probably landed here wrong
  if (!dataUrl) {
    setText(scoreText, "—");
    setClicks(null, elevClicksText, "", elevDirText);
    setClicks(null, windClicksText, "", windDirText);
    setText(tipText, "—");
    return;
  }
})();
