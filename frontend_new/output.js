// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Results screen: guard + analyze.
// Prevents scary backend 422 by refusing to call backend if tapsJson missing.

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const LAST_KEY   = "sczn3_last_result_json";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const TAPS_KEY   = "sczn3_taps_json";

  function $(id){ return document.getElementById(id); }

  const backBtn    = $("backBtn");
  const savedBtn   = $("savedBtn");
  const receiptBtn = $("receiptBtn");

  const statusEl   = $("miniStatus") || $("status") || $("inlineStatus");

  // display fields (optional if your HTML has them)
  const scoreEl = $("scoreVal");
  const windEl  = $("windVal");
  const elevEl  = $("elevVal");
  const distEl  = $("distVal");
  const poibEl  = $("poibVal");
  const rawEl   = $("rawJson");

  function status(msg){
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function getDistance(){
    const n = Number(sessionStorage.getItem(DIST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getPhotoDataUrl(){
    return sessionStorage.getItem(PHOTO_KEY) || "";
  }

  function getTapsJson(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  function renderResult(model){
    // model is whatever backend returns
    // We attempt to populate common fields if elements exist
    const score = model?.score ?? model?.smartScore ?? "--";

    const clicksW = model?.clicks?.windage ?? model?.clicks_windage ?? "--";
    const clicksE = model?.clicks?.elevation ?? model?.clicks_elevation ?? "--";
    const dirW    = model?.directions?.windage ?? model?.windageDir ?? "";
    const dirE    = model?.directions?.elevation ?? model?.elevDir ?? "";
    const poib    = model?.poib ?? model?.POIB ?? "--";

    if (scoreEl) scoreEl.textContent = String(score);
    if (windEl)  windEl.textContent  = `${clicksW} ${dirW}`.trim() || "--";
    if (elevEl)  elevEl.textContent  = `${clicksE} ${dirE}`.trim() || "--";
    if (distEl)  distEl.textContent  = `${getDistance()} yds`;
    if (poibEl)  poibEl.textContent  = String(poib);

    if (rawEl) rawEl.textContent = JSON.stringify(model, null, 2);
  }

  async function analyze(){
    // Fender Plug: require tapsJson
    const tapsJson = getTapsJson();
    if (!tapsJson || !Array.isArray(tapsJson.holes) || tapsJson.holes.length < 1){
      status("No taps found for this session. Go back and tap the holes, then try again.");
      // Do NOT call backend
      return;
    }

    // We do NOT have the original File here (static site), so we send the photo as a Blob
    const photoDataUrl = getPhotoDataUrl();
    if (!photoDataUrl){
      status("No photo found. Go back and upload a target photo.");
      return;
    }

    status("Analyzing…");

    try{
      const file = await dataUrlToFile(photoDataUrl, "target.jpg");

      const out = await window.SEC_API.analyzeTarget({
        file,
        distanceYards: getDistance(),
        tapsJson
      });

      // Save last result for Receipt / Saved flows
      sessionStorage.setItem(LAST_KEY, JSON.stringify(out.data || {}));

      // Render
      renderResult(out.data || {});
      status("Results ready.");
    } catch (err){
      const msg = (err && err.message) ? err.message : String(err || "Analyze failed.");
      status(msg);
      if (rawEl) rawEl.textContent = msg;
    }
  }

  async function dataUrlToFile(dataUrl, filename){
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  }

  // INIT
  (function init(){
    // If you want: show distance immediately if element exists
    if (distEl) distEl.textContent = `${getDistance()} yds`;

    // Kick analysis on load
    analyze();
  })();

  // Nav buttons
  if (backBtn) backBtn.addEventListener("click", () => window.location.href = `./index.html?v=${Date.now()}`);
  if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = `./saved.html?v=${Date.now()}`);
  if (receiptBtn) receiptBtn.addEventListener("click", () => window.location.href = `./receipt.html?v=${Date.now()}`);
})();
