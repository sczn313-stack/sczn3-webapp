// sczn3-webapp/frontend_new/output.js  (FULL REPLACEMENT)
// Results screen with TOP action row (no micro-scroll).
// Routes to Receipt Builder BEFORE saving.

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const LAST_KEY   = "sczn3_last_result_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const backBtn = $("backBtn");
  const savedBtn = $("savedBtn");
  const buildReceiptBtn = $("buildReceiptBtn");
  const newBtn = $("newBtn");

  const scoreVal = $("scoreVal");
  const windVal = $("windVal");
  const elevVal = $("elevVal");
  const distVal = $("distVal");

  const miniStatus = $("miniStatus");
  const buyMoreBtn = $("buyMoreBtn");

  function status(msg){
    if (miniStatus) miniStatus.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function getDistance(){
    const v = sessionStorage.getItem(DIST_KEY);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function loadLastResult(){
    const raw = sessionStorage.getItem(LAST_KEY) || "";
    const obj = safeJsonParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  function render(){
    setVendorBuyLink();

    const dist = getDistance();
    if (distVal) distVal.textContent = `${dist} yds`;

    const last = loadLastResult();
    if (!last){
      status("No results found. Go back and run a session.");
      if (scoreVal) scoreVal.textContent = "—";
      if (windVal) windVal.textContent = "—";
      if (elevVal) elevVal.textContent = "—";
      return;
    }

    const score = (typeof last.score !== "undefined") ? String(last.score) : "—";
    const wClicks = last?.clicks?.windage ?? "—";
    const eClicks = last?.clicks?.elevation ?? "—";
    const wDir = last?.directions?.windage ?? "";
    const eDir = last?.directions?.elevation ?? "";

    if (scoreVal) scoreVal.textContent = score;
    if (windVal) windVal.textContent = `${wClicks} ${wDir}`.trim();
    if (elevVal) elevVal.textContent = `${eClicks} ${eDir}`.trim();

    status(last.tip || "Results ready.");
  }

  render();

  if (backBtn){
    backBtn.addEventListener("click", () => window.location.href = "./index.html");
  }

  if (savedBtn){
    savedBtn.addEventListener("click", () => window.location.href = "./saved.html");
  }

  if (newBtn){
    newBtn.addEventListener("click", () => window.location.href = "./index.html");
  }

  if (buildReceiptBtn){
    buildReceiptBtn.addEventListener("click", () => window.location.href = "./receipt.html");
  }
})();
