// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// Tap-n-Score Upload + Tap capture.
// Stores a stable tapsJson with bull + holes so backend never gets NO_INPUT.

(function () {
  const DIST_KEY  = "sczn3_distance_yards";
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const TAPS_KEY  = "sczn3_taps_json";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  // Expected elements (match your index.html)
  const uploadBtn   = $("uploadBtn");     // big Upload button
  const fileInput   = $("fileInput");     // hidden <input type="file">
  const distanceInp = $("distanceYards"); // distance input
  const vendorInp   = $("vendorInput");   // optional vendor url input (can be absent)

  const statusEl    = $("statusText");    // small status text (can be absent)
  const tapsCountEl = $("tapsCount");     // shows "Taps: X" (can be absent)
  const clearBtn    = $("clearBtn");      // "Clear taps" (can be absent)
  const imgEl       = $("targetImg");     // <img> preview (must exist if tapping image)
  const tapLayer    = $("tapLayer");      // overlay div for tap markers (can be absent)

  const resultsBtn  = $("resultsBtn");    // "Press to see results"

  let holes = []; // array of {x,y} in IMAGE PIXELS

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
    saveTapsJson(); // keeps bull but empties holes
    status("Cleared taps.");
  }

  function drawTapMarker(clientX, clientY){
    if (!tapLayer) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    // Position relative to image container
    const rect = tapLayer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    tapLayer.appendChild(dot);
  }

  function getImagePixelXY(clientX, clientY){
    // Convert a click/touch point to image pixel coordinates
    const rect = imgEl.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top)  / rect.height;

    const nx = Math.max(0, Math.min(1, rx));
    const ny = Math.max(0, Math.min(1, ry));

    // naturalWidth/naturalHeight are real pixel dimensions of the image
    const px = nx * (imgEl.naturalWidth  || rect.width);
    const py = ny * (imgEl.naturalHeight || rect.height);
    return { x: px, y: py };
  }

  function currentBull(){
    // For Tap-n-Score, we default bull to image center (stable + no extra tap required)
    const w = imgEl.naturalWidth  || 0;
    const h = imgEl.naturalHeight || 0;
    if (w > 0 && h > 0) return { x: w / 2, y: h / 2 };
    // fallback if natural size not ready yet
    return { x: 0.5, y: 0.5, normalized: true };
  }

  function saveTapsJson(){
    if (!imgEl) return;
    const bull = currentBull();

    // If bull is normalized fallback, convert to pixels using displayed rect
    let bullPx = bull;
    if (bull && bull.normalized){
      const w = imgEl.naturalWidth  || 0;
      const h = imgEl.naturalHeight || 0;
      bullPx = { x: (w || 1) * bull.x, y: (h || 1) * bull.y };
    }

    const payload = {
      version: 1,
      image: {
        w: Number(imgEl.naturalWidth  || 0),
        h: Number(imgEl.naturalHeight || 0)
      },
      bull: {
        x: Number(bullPx.x || 0),
        y: Number(bullPx.y || 0)
      },
      holes: holes.map(p => ({ x: Number(p.x), y: Number(p.y) }))
    };

    try { sessionStorage.setItem(TAPS_KEY, JSON.stringify(payload)); } catch {}
  }

  async function onPickFile(file){
    if (!file) return;

    status("Loading photo…");
    holes = [];
    setTapsCount();
    if (tapLayer) tapLayer.innerHTML = "";

    saveDistance();
    setVendor();

    // Store thumbnail for receipt/saved
    const dataUrl = await fileToDataUrl(file);
    try { sessionStorage.setItem(PHOTO_KEY, dataUrl); } catch {}

    // Show preview
    imgEl.src = dataUrl;

    // Wait a tick so naturalWidth/Height populate
    imgEl.onload = () => {
      saveTapsJson(); // bull center + empty holes
      status("Photo loaded. Tap the holes (Tap-n-Score).");
    };
  }

  function ensureReadyForResults(){
    // Require at least 1 hole tap before results
    if (!holes.length){
      status("Tap at least 1 bullet hole, then press Results.");
      return false;
    }
    return true;
  }

  // ===== Bindings =====
  if (uploadBtn && fileInput){
    uploadBtn.addEventListener("click", () => fileInput.click());
    uploadBtn.addEventListener("touchstart", () => fileInput.click(), { passive: true });
  }

  if (fileInput){
    fileInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      await onPickFile(f);
    });
  }

  if (distanceInp){
    distanceInp.addEventListener("input", saveDistance);
    distanceInp.addEventListener("change", saveDistance);
    // init from session
    const prev = sessionStorage.getItem(DIST_KEY);
    if (prev && String(prev).trim()){
      distanceInp.value = String(prev);
    }
  }

  if (vendorInp){
    vendorInp.addEventListener("input", setVendor);
    vendorInp.addEventListener("change", setVendor);
  }

  if (clearBtn){
    clearBtn.addEventListener("click", clearTaps);
  }

  if (imgEl){
    const onTap = (clientX, clientY) => {
      if (!imgEl.src) return;

      const p = getImagePixelXY(clientX, clientY);
      holes.push(p);
      setTapsCount();
      drawTapMarker(clientX, clientY);
      saveTapsJson();
      status(`Taps: ${holes.length}`);
    };

    imgEl.addEventListener("click", (e) => {
      onTap(e.clientX, e.clientY);
    });

    imgEl.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      onTap(t.clientX, t.clientY);
    }, { passive: true });
  }

  if (resultsBtn){
    const go = () => {
      saveDistance();
      setVendor();
      saveTapsJson();
      if (!ensureReadyForResults()) return;
      window.location.href = `./output.html?v=${Date.now()}`;
    };
    resultsBtn.addEventListener("click", go);
    resultsBtn.addEventListener("touchstart", go, { passive: true });
  }

  // Initial state
  status("Ready. Tap UPLOAD.");
  setTapsCount();
})();
