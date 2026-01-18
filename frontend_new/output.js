// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Results screen. Calm inline handling. No scary crash screen.

(function () {
  const DIST_KEY  = "sczn3_distance_yards";
  const LAST_KEY  = "sczn3_last_result_json";
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const VENDOR_BUY= "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }
  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  const backBtn    = $("backBtn");
  const savedBtn   = $("savedBtn");
  const receiptBtn = $("receiptBtn");
  const buyMoreBtn = $("buyMoreBtn");

  const statusLine = $("statusLine");
  const scoreEl    = $("scoreEl");
  const windEl     = $("windEl");
  const elevEl     = $("elevEl");
  const distEl     = $("distEl");
  const poibEl     = $("poibEl");

  const debugBox   = $("debugBox"); // optional

  function status(msg){
    if (statusLine) statusLine.textContent = String(msg || "");
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function readLast(){
    const raw = sessionStorage.getItem(LAST_KEY) || "";
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function two(n){
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "--";
  }

  function render(){
    setVendorBuyLink();

    const dist = Number(sessionStorage.getItem(DIST_KEY) || 100);
    if (distEl) distEl.textContent = `${dist} yds`;

    const last = readLast();

    if (!last || typeof last !== "object") {
      status("No results yet. Go back and run a session.");
      if (scoreEl) scoreEl.textContent = "--";
      if (windEl) windEl.textContent = "--";
      if (elevEl) elevEl.textContent = "--";
      if (poibEl) poibEl.textContent = "--";
      return;
    }

    // If backend sends error-like payload, show calm message
    const ok = (typeof last.ok === "boolean") ? last.ok : true;
    if (ok === false) {
      const msg = last?.error?.message || "Analyze failed. Tap holes and try again.";
      status(msg);

      if (scoreEl) scoreEl.textContent = "--";
      if (windEl) windEl.textContent = "--";
      if (elevEl) elevEl.textContent = "--";
      if (poibEl) poibEl.textContent = "--";

      if (debugBox) debugBox.textContent = JSON.stringify(last, null, 2);
      return;
    }

    status("Results ready.");

    // Score
    if (scoreEl) scoreEl.textContent = (typeof last.score !== "undefined") ? String(last.score) : "--";

    // Clicks + directions (always two decimals when numeric)
    const w = last?.clicks?.windage;
    const e = last?.clicks?.elevation;
    const wd = last?.directions?.windage || "";
    const ed = last?.directions?.elevation || "";

    if (windEl) windEl.textContent = `${two(w)} ${wd}`.trim() || "--";
    if (elevEl) elevEl.textContent = `${two(e)} ${ed}`.trim() || "--";

    // POIB if present
    const poib = last?.poib || last?.POIB || last?.centroid;
    if (poibEl) {
      if (poib && typeof poib === "object") {
        const x = (typeof poib.x !== "undefined") ? two(poib.x) : "--";
        const y = (typeof poib.y !== "undefined") ? two(poib.y) : "--";
        poibEl.textContent = `${x}, ${y}`;
      } else {
        poibEl.textContent = "--";
      }
    }

    if (debugBox) debugBox.textContent = "";
  }

  // ===== INIT =====
  (function init(){
    render();

    if (backBtn) backBtn.addEventListener("click", () => window.location.href = `./index.html?v=${Date.now()}`);
    if (savedBtn) savedBtn.addEventListener("click", () => window.location.href = `./saved.html?v=${Date.now()}`);
    if (receiptBtn) receiptBtn.addEventListener("click", () => window.location.href = `./receipt.html?v=${Date.now()}`);
  })();
})();
