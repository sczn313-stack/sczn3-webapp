// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-stable tapping: use pointerdown on the IMAGE CONTAINER, not the <img>.
// Also supports overlay tap dots, without blocking taps.

(function () {
  const DIST_KEY  = "sczn3_distance_yards";
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const TAPS_KEY  = "sczn3_taps_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  // Expected IDs in index.html
  const uploadBtn   = $("uploadBtn");
  const fileInput   = $("fileInput");
  const distanceInp = $("distanceYards");
  const vendorInp   = $("vendorInput");

  const statusEl    = $("statusText");
  const tapsCountEl = $("tapsCount");
  const clearBtn    = $("clearBtn");

  const imgEl       = $("targetImg");
  const tapLayer    = $("tapLayer");     // overlay for dots (optional)
  const tapBox      = $("tapBox") || tapLayer?.parentElement || imgEl?.parentElement; // container

  const resultsBtn  = $("resultsBtn");

  let holes = []; // image pixel coords: {x,y}

  function status(msg){
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function setTapsCount(){
    if (tapsCountEl) tapsCountEl.textContent = String(holes.length);
  }

  function readDistance(){
    const n = Number(distanceInp && distanceInp.value);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function saveDistance(){
    try { sessionStorage.setItem(DIST_KEY, String(readDistance())); } catch {}
  }

  function setVendor(){
    if (!vendorInp) return;
    const v = String(vendorInp.value || "").trim();
    if (!v) return;
    try { sessionStorage.setItem(VENDOR_BUY, v); } catch {}
  }

  function safeJsonParse(s){ try { return JSON.parse(String(s||"")); } catch { return null; } }

  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed."));
      r.readAsDataURL(file);
    });
  }

  function clearTaps(){
    holes = [];
    setTapsCount();
    if (tapLayer) tapLayer.innerHTML = "";
    saveTapsJson();
    status("Cleared taps.");
  }

  function currentBull(){
    const w = imgEl?.naturalWidth  || 0;
    const h = imgEl?.naturalHeight || 0;
    if (w > 0 && h > 0) return { x: w / 2, y: h / 2 };
    return { x: 0, y: 0 };
  }

  function saveTapsJson(){
    if (!imgEl) return;

    const payload = {
      version: 1,
      image: {
        w: Number(imgEl.naturalWidth  || 0),
        h: Number(imgEl.naturalHeight || 0)
      },
      bull: currentBull(),
      holes: holes.map(p => ({ x: Number(p.x), y: Number(p.y) }))
    };

    try { sessionStorage.setItem(TAPS_KEY, JSON.stringify(payload)); } catch {}
  }

  function drawTapDot(xClient, yClient){
    if (!tapLayer) return;

    const rect = tapLayer.getBoundingClientRect();
    const x = xClient - rect.left;
    const y = yClient - rect.top;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    tapLayer.appendChild(dot);
  }

  function clientToImagePixels(xClient, yClient){
    // Use tapBox rect (more stable when overlays exist)
    const rect = (tapBox || imgEl).getBoundingClientRect();
    const rx = (xClient - rect.left) / rect.width;
    const ry = (yClient - rect.top)  / rect.height;

    const nx = Math.max(0, Math.min(1, rx));
    const ny = Math.max(0, Math.min(1, ry));

    const w = imgEl.naturalWidth  || rect.width;
    const h = imgEl.naturalHeight || rect.height;

    return { x: nx * w, y: ny * h };
  }

  async function onPickFile(file){
    if (!file || !imgEl) return;

    status("Loading photo…");
    clearTaps();

    saveDistance();
    setVendor();

    const dataUrl = await fileToDataUrl(file);
    try { sessionStorage.setItem(PHOTO_KEY, dataUrl); } catch {}

    imgEl.onload = () => {
      saveTapsJson();
      status("Photo loaded. Tap the holes (Tap-n-Score).");
    };
    imgEl.src = dataUrl;
  }

  function ensureReady(){
    if (!holes.length){
      status("Tap at least 1 bullet hole, then press Results.");
      return false;
    }
    return true;
  }

  // ===== Bindings =====

  // Upload
  if (uploadBtn && fileInput){
    uploadBtn.addEventListener("click", () => fileInput.click());
    uploadBtn.addEventListener("pointerdown", () => fileInput.click());
  }
  if (fileInput){
    fileInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) await onPickFile(f);
    });
  }

  // Distance init/bind
  if (distanceInp){
    const prev = sessionStorage.getItem(DIST_KEY);
    if (prev && String(prev).trim()) distanceInp.value = String(prev);
    distanceInp.addEventListener("input", saveDistance);
    distanceInp.addEventListener("change", saveDistance);
  }

  if (vendorInp){
    vendorInp.addEventListener("input", setVendor);
    vendorInp.addEventListener("change", setVendor);
  }

  if (clearBtn){
    clearBtn.addEventListener("click", clearTaps);
    clearBtn.addEventListener("pointerdown", clearTaps);
  }

  // **THE FIX**: listen for pointerdown on tapBox, not the image
  if (tapBox && imgEl){
    tapBox.addEventListener("pointerdown", (e) => {
      // Only allow tapping when an image is loaded
      if (!imgEl.src) return;

      // If user tapped on a button/input inside the box, ignore
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "button" || tag === "input" || tag === "a") return;

      const p = clientToImagePixels(e.clientX, e.clientY);
      holes.push(p);
      setTapsCount();
      drawTapDot(e.clientX, e.clientY);
      saveTapsJson();
      status(`Taps: ${holes.length}`);
    });
  }

  // Results
  if (resultsBtn){
    const go = () => {
      saveDistance();
      setVendor();
      saveTapsJson();
      if (!ensureReady()) return;
      window.location.href = `./output.html?v=${Date.now()}`;
    };
    resultsBtn.addEventListener("click", go);
    resultsBtn.addEventListener("pointerdown", go);
  }

  status("Ready. Tap UPLOAD.");
  setTapsCount();
})();
