// sczn3-webapp/frontend_new/output.js (FULL REPLACEMENT)
// Runs backend analyze using image + tapsJson{bull,holes}.

(function () {
  const PHOTO_KEY   = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY    = "sczn3_targetPhoto_fileName";
  const DIST_KEY    = "sczn3_distance_yards";
  const TAPS_KEY    = "sczn3_taps_json";

  const LAST_KEY    = "sczn3_last_result_json";
  const VENDOR_BUY  = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const statusEl = $("status");
  const scoreEl  = $("score");
  const windEl   = $("wind");
  const elevEl   = $("elev");
  const distEl   = $("dist");
  const poibEl   = $("poib");
  const rawEl    = $("raw");

  const backBtn   = $("backBtn");
  const savedBtn  = $("savedBtn");
  const receiptBtn= $("receiptBtn");
  const buyMoreBtn= $("buyMoreBtn");

  function status(msg){
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function setVendorBuyLink(){
    const url = sessionStorage.getItem(VENDOR_BUY);
    if (buyMoreBtn && url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "block";
    }
  }

  function dataUrlToFile(dataUrl, filename){
    const arr = String(dataUrl || "").split(",");
    const mimeMatch = arr[0] && arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1] || "");
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename || "target.jpg", { type: mime });
  }

  function fmt2(x){
    const n = Number(x);
    if (!Number.isFinite(n)) return "--";
    return n.toFixed(2);
  }

  function setText(el, v){
    if (!el) return;
    el.textContent = String(v);
  }

  function renderFromBackend(payload){
    // Expecting backend returns clicks + directions + maybe poib + score
    const data = payload && payload.data ? payload.data : payload;

    const score = (data && typeof data.score !== "undefined") ? data.score : "--";

    const clicksWind = data?.clicks?.windage;
    const clicksElev = data?.clicks?.elevation;

    const dirWind = data?.directions?.windage || "";
    const dirElev = data?.directions?.elevation || "";

    const windText = (clicksWind !== undefined && clicksWind !== null)
      ? `${fmt2(clicksWind)} ${dirWind}`.trim()
      : "--";

    const elevText = (clicksElev !== undefined && clicksElev !== null)
      ? `${fmt2(clicksElev)} ${dirElev}`.trim()
      : "--";

    const poib = data?.poib || data?.POIB || data?.centroid || null;
    const poibText = poib && typeof poib === "object"
      ? `${fmt2(poib.x)} , ${fmt2(poib.y)}`
      : (typeof poib === "string" ? poib : "--");

    setText(scoreEl, score);
    setText(windEl,  windText);
    setText(elevEl,  elevText);

    const dist = sessionStorage.getItem(DIST_KEY) || "100";
    setText(distEl, `${dist} yds`);
    setText(poibEl, poibText);

    // Persist “last result” for receipt.js
    const last = {
      score,
      clicks: { windage: clicksWind, elevation: clicksElev },
      directions: { windage: dirWind, elevation: dirElev },
      poib
    };
    sessionStorage.setItem(LAST_KEY, JSON.stringify(last));

    if (rawEl){
      rawEl.textContent = JSON.stringify(data, null, 2);
    }
  }

  async function run(){
    setVendorBuyLink();

    const photoDataUrl = sessionStorage.getItem(PHOTO_KEY) || "";
    const fileName = sessionStorage.getItem(FILE_KEY) || "target.jpg";
    const dist = Number(sessionStorage.getItem(DIST_KEY) || 100);

    const taps = safeJsonParse(sessionStorage.getItem(TAPS_KEY) || "");
    if (!photoDataUrl){
      status("No photo found. Go back and upload.");
      if (rawEl) rawEl.textContent = "";
      return;
    }
    if (!taps || !taps.bull || !Array.isArray(taps.holes) || taps.holes.length < 1){
      status("Missing taps. Tap bull first, then holes.");
      if (rawEl) rawEl.textContent = JSON.stringify({ ok:false, error:"Missing tapsJson bull+holes" }, null, 2);
      return;
    }

    let file;
    try{
      file = dataUrlToFile(photoDataUrl, fileName);
    } catch {
      status("Could not prepare image file.");
      return;
    }

    status("Analyzing…");

    try{
      const res = await window.SEC_API.analyzeTarget({
        file,
        distanceYards: dist,
        tapsJson: taps
      });

      // Normalize where backend returned payload lives
      renderFromBackend(res);
      status("Done.");
    } catch (err){
      const msg = String(err && err.message ? err.message : err);
      status("Analyze failed.");
      if (rawEl) rawEl.textContent = msg;
    }
  }

  if (backBtn){
    backBtn.addEventListener("click", () => window.location.href = "./index.html?v=" + Date.now());
  }
  if (savedBtn){
    savedBtn.addEventListener("click", () => window.location.href = "./saved.html?v=" + Date.now());
  }
  if (receiptBtn){
    receiptBtn.addEventListener("click", () => window.location.href = "./receipt.html?v=" + Date.now());
  }

  run();
})();
