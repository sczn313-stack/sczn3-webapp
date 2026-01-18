// sczn3-webapp/frontend_new/output.js (FULL FILE REPLACEMENT)
// Results page: runs analysis using stored photo (dataURL) + distance,
// stores LAST result for receipt.js, and routes to receipt.html.

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY  = "sczn3_targetPhoto_fileName";
  const DIST_KEY  = "sczn3_distance_yards";
  const TAPS_KEY  = "sczn3_tap_points_json";

  const LAST_KEY  = "sczn3_last_result_json";
  const VENDOR_BUY= "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const backBtn    = $("backBtn");
  const savedBtn   = $("savedBtn");
  const receiptBtn = $("receiptBtn");
  const buyMoreBtn = $("buyMoreBtn");

  const subLine    = $("subLine");
  const miniStatus = $("miniStatus");

  const scoreVal = $("scoreVal");
  const windVal  = $("windVal");
  const elevVal  = $("elevVal");
  const distVal  = $("distVal");
  const poibVal  = $("poibVal");
  const warnBox  = $("warnBox");

  function status(msg){
    if (miniStatus) miniStatus.textContent = String(msg || "");
  }

  function setSub(msg){
    if (subLine) subLine.textContent = String(msg || "");
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-block";
    }
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function getDistance(){
    const v = sessionStorage.getItem(DIST_KEY);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getTaps(){
    const raw = sessionStorage.getItem(TAPS_KEY) || "[]";
    const arr = safeJsonParse(raw);
    return Array.isArray(arr) ? arr : [];
  }

  // dataURL -> File
  async function dataUrlToFile(dataUrl, fileName){
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const name = fileName || "target.jpg";
    const type = blob.type || "image/jpeg";
    return new File([blob], name, { type });
  }

  function fmt2(x){
    const n = Number(x);
    return Number.isFinite(n) ? n.toFixed(2) : String(x ?? "--");
  }

  function normalizeResult(raw){
    // Supports various backend shapes while ensuring receipt.js can read:
    //   result.clicks.windage / elevation
    //   result.directions.windage / elevation
    //   result.score
    //   result.poib (optional)

    const r = raw && typeof raw === "object" ? raw : {};

    // Try common places
    const clicks = r.clicks || r.corrections || r.adjustments || {};
    const directions = r.directions || r.dir || {};

    const windClicks = clicks.windage ?? clicks.wind ?? clicks.w ?? r.windageClicks ?? r.windage ?? "--";
    const elevClicks = clicks.elevation ?? clicks.elev ?? clicks.e ?? r.elevationClicks ?? r.elevation ?? "--";

    const windDir = directions.windage ?? directions.wind ?? directions.w ?? r.windageDir ?? r.windage_direction ?? "";
    const elevDir = directions.elevation ?? directions.elev ?? directions.e ?? r.elevDir ?? r.elevation_direction ?? "";

    const score = (typeof r.score !== "undefined") ? r.score : (typeof r.smartScore !== "undefined" ? r.smartScore : "--");

    // POIB support (stringify a helpful compact value)
    const poib =
      r.poib ??
      r.POIB ??
      (r.poib_in ? `X ${fmt2(r.poib_in.x)} in, Y ${fmt2(r.poib_in.y)} in` : null) ??
      (r.poibIn ? `X ${fmt2(r.poibIn.x)} in, Y ${fmt2(r.poibIn.y)} in` : null) ??
      (r.offset_in ? `X ${fmt2(r.offset_in.x)} in, Y ${fmt2(r.offset_in.y)} in` : null) ??
      null;

    return {
      score,
      clicks: {
        windage: windClicks,
        elevation: elevClicks
      },
      directions: {
        windage: windDir,
        elevation: elevDir
      },
      poib: poib || "--",
      _raw: r
    };
  }

  function paint(result, distance){
    const wind = `${fmt2(result.clicks.windage)} ${String(result.directions.windage || "").trim()}`.trim();
    const elev = `${fmt2(result.clicks.elevation)} ${String(result.directions.elevation || "").trim()}`.trim();

    if (scoreVal) scoreVal.textContent = String(result.score ?? "--");
    if (windVal)  windVal.textContent  = wind || "--";
    if (elevVal)  elevVal.textContent  = elev || "--";
    if (distVal)  distVal.textContent  = `${Number(distance)} yds`;
    if (poibVal)  poibVal.textContent  = String(result.poib ?? "--");

    // optional warning from backend
    const warn =
      result._raw?.warning ||
      result._raw?.warnings ||
      result._raw?.message ||
      "";

    if (warnBox){
      warnBox.textContent = warn ? String(warn) : "";
    }
  }

  function enableReceipt(){
    if (!receiptBtn) return;
    receiptBtn.disabled = false;
    receiptBtn.style.opacity = "1";
  }

  async function run(){
    setVendorBuyLink();

    const distance = getDistance();
    if (distVal) distVal.textContent = `${Number(distance)} yds`;

    const dataUrl = sessionStorage.getItem(PHOTO_KEY) || "";
    const fileName = sessionStorage.getItem(FILE_KEY) || "target.jpg";

    if (!dataUrl){
      setSub("No photo found.");
      status("ERROR: No photo in session. Go back and upload.");
      return;
    }

    setSub("Analyzing…");
    status("Sending to backend…");

    // backend base (same rule as api.js)
    const backendBase =
      sessionStorage.getItem("sczn3_backend_base") ||
      "https://sczn3-backend-new1.onrender.com";

    try{
      const file = await dataUrlToFile(dataUrl, fileName);

      // We include taps for future use (backend can ignore if not supported)
      const taps = getTaps();

      const fd = new FormData();
      fd.append("image", file, file.name || "target.jpg");
      fd.append("distanceYards", String(distance));
      fd.append("taps_json", JSON.stringify(taps));

      const res = await fetch(`${backendBase}/api/analyze`, {
        method: "POST",
        body: fd
      });

      if (!res.ok){
        const txt = await res.text().catch(()=> "");
        setSub("Analyze failed.");
        status(`Backend analyze failed (${res.status}).`);
        if (warnBox) warnBox.textContent = txt ? String(txt).slice(0, 240) : "";
        return;
      }

      const raw = await res.json();
      const normalized = normalizeResult(raw);

      // Store what receipt.js expects
      sessionStorage.setItem(LAST_KEY, JSON.stringify(normalized));

      paint(normalized, distance);
      setSub("Results ready.");
      status("Tap Receipt to add setup details, then Save/Export.");

      enableReceipt();
    } catch (err){
      setSub("Analyze error.");
      status(`ERROR: ${String(err && err.message ? err.message : err)}`);
    }
  }

  // ===== NAV =====
  if (backBtn){
    backBtn.addEventListener("click", () => {
      window.location.href = `./index.html?v=${Date.now()}`;
    });
  }

  if (savedBtn){
    savedBtn.addEventListener("click", () => {
      window.location.href = `./saved.html?v=${Date.now()}`;
    });
  }

  if (receiptBtn){
    const goReceipt = () => {
      // Receipt page reads LAST_KEY from sessionStorage
      window.location.href = `./receipt.html?v=${Date.now()}`;
    };
    receiptBtn.addEventListener("click", goReceipt);
    receiptBtn.addEventListener("touchstart", goReceipt, { passive:true });
  }

  run();
})();
