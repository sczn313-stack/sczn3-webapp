// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// Upload + Tap UI. Stores tapsJson (bull + holes) in sessionStorage for backend.
// Fender plug: never call backend unless taps exist.

(function () {
  const DIST_KEY  = "sczn3_distance_yards";
  const LAST_KEY  = "sczn3_last_result_json";
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const VENDOR_BUY= "sczn3_vendor_buy_url";
  const TAPS_KEY  = "sczn3_taps_json";

  function $(id){ return document.getElementById(id); }

  // These IDs must exist in your index.html:
  // uploadBtn, distanceInput, vendorInput (optional), statusLine (optional),
  // imgEl (the displayed target image), tapsCount (optional),
  // clearTapsBtn (optional), goResultsBtn (the "Press to see results" button)
  const uploadBtn    = $("uploadBtn");
  const distanceInput= $("distanceInput");
  const vendorInput  = $("vendorInput");
  const statusLine   = $("statusLine");

  const imgEl        = $("imgEl");
  const tapsCount    = $("tapsCount");
  const clearTapsBtn = $("clearTapsBtn");
  const goResultsBtn = $("goResultsBtn");

  // Internal state
  let currentFile = null;
  let tapHoles = []; // [{x,y}] in natural image coords
  let bull = null;   // {x,y} in natural image coords

  function status(msg){
    if (statusLine) statusLine.textContent = String(msg || "");
  }

  function setDistance(v){
    const n = Number(v);
    const dist = Number.isFinite(n) && n > 0 ? n : 100;
    sessionStorage.setItem(DIST_KEY, String(dist));
    if (distanceInput) distanceInput.value = String(dist);
  }

  function setVendor(url){
    const u = String(url || "").trim();
    if (u) sessionStorage.setItem(VENDOR_BUY, u);
    else sessionStorage.removeItem(VENDOR_BUY);
  }

  function updateTapsUI(){
    if (tapsCount) tapsCount.textContent = String(tapHoles.length);
  }

  function clearTaps(){
    tapHoles = [];
    bull = null;
    sessionStorage.removeItem(TAPS_KEY);
    updateTapsUI();
    status("Ready. Tap holes.");
  }

  function storeTaps(){
    if (!bull) return;
    const payload = { bull, holes: tapHoles.slice(0) };
    sessionStorage.setItem(TAPS_KEY, JSON.stringify(payload));
  }

  function naturalPointFromEvent(ev){
    if (!imgEl) return null;

    const rect = imgEl.getBoundingClientRect();
    const clientX = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    const clientY = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;

    const xDisp = clientX - rect.left;
    const yDisp = clientY - rect.top;

    // Outside image area? ignore
    if (xDisp < 0 || yDisp < 0 || xDisp > rect.width || yDisp > rect.height) return null;

    const nw = imgEl.naturalWidth || rect.width;
    const nh = imgEl.naturalHeight || rect.height;

    const xNat = (xDisp / rect.width) * nw;
    const yNat = (yDisp / rect.height) * nh;

    return { x: xNat, y: yNat };
  }

  function ensureBull(){
    if (!imgEl) return;
    if (bull) return;

    // Fender plug bull: image center in natural coords
    const nw = imgEl.naturalWidth || 0;
    const nh = imgEl.naturalHeight || 0;
    if (nw > 0 && nh > 0) bull = { x: nw / 2, y: nh / 2 };
  }

  async function onPickFile(file){
    if (!file) return;

    currentFile = file;

    // Store photo for receipt
    const dataUrl = await fileToDataUrl(file);
    sessionStorage.setItem(PHOTO_KEY, dataUrl);

    // Reset taps
    clearTaps();

    // Show image
    if (imgEl) {
      imgEl.src = dataUrl;
      imgEl.onload = () => {
        ensureBull();
        status("Photo loaded. Tap the holes (Tap-n-Score).");
      };
    }

    status("Photo loaded. Tap the holes (Tap-n-Score).");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed."));
      r.readAsDataURL(file);
    });
  }

  function openPicker(){
    // iOS friendly: create a hidden input each time
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.capture = "environment";
    inp.style.display = "none";
    document.body.appendChild(inp);

    inp.addEventListener("change", async () => {
      const file = inp.files && inp.files[0];
      inp.remove();
      if (file) await onPickFile(file);
    });

    inp.click();
  }

  function onTap(ev){
    if (!currentFile || !imgEl || !imgEl.src) {
      status("Upload a target photo first.");
      return;
    }

    // DO NOT prevent default => allow pinch zoom behavior on iOS
    const p = naturalPointFromEvent(ev);
    if (!p) return;

    ensureBull();

    tapHoles.push(p);
    storeTaps();
    updateTapsUI();
    status(`Taps: ${tapHoles.length}. Tap more holes or press Results.`);
  }

  async function goResults(){
    // Fender plug: no taps => no backend call
    if (tapHoles.length === 0) {
      status("Tap at least one hole before results.");
      return;
    }
    if (!currentFile) {
      status("Upload a target photo first.");
      return;
    }

    // Clear last (fresh run)
    sessionStorage.removeItem(LAST_KEY);

    // Persist distance + vendor
    setDistance(distanceInput ? distanceInput.value : 100);
    if (vendorInput) setVendor(vendorInput.value);

    // Call backend with tapsJson
    status("Analyzing…");

    try {
      const tapsJson = (function(){
        try { return JSON.parse(sessionStorage.getItem(TAPS_KEY) || ""); } catch { return null; }
      })();

      const out = await window.SEC_API.analyzeTarget({
        file: currentFile,
        distanceYards: Number(sessionStorage.getItem(DIST_KEY) || 100),
        tapsJson
      });

      // Store full result for output.html
      sessionStorage.setItem(LAST_KEY, JSON.stringify(out.data || {}));

      // Navigate (cache-bust)
      window.location.href = `./output.html?v=${Date.now()}`;
    } catch (e) {
      // Calm inline error (no scary screen)
      const msg = String(e && e.message ? e.message : e);
      status(msg || "Analyze failed.");
    }
  }

  // ===== INIT =====
  (function init(){
    // Defaults
    setDistance(sessionStorage.getItem(DIST_KEY) || 100);
    if (vendorInput) vendorInput.value = sessionStorage.getItem(VENDOR_BUY) || "";

    updateTapsUI();
    status("Ready. Tap UPLOAD.");

    if (uploadBtn) {
      uploadBtn.addEventListener("click", openPicker);
      uploadBtn.addEventListener("touchstart", openPicker, { passive: true });
    }

    if (distanceInput) {
      distanceInput.addEventListener("change", () => setDistance(distanceInput.value));
      distanceInput.addEventListener("input", () => setDistance(distanceInput.value));
    }

    if (vendorInput) {
      vendorInput.addEventListener("change", () => setVendor(vendorInput.value));
      vendorInput.addEventListener("input", () => setVendor(vendorInput.value));
    }

    if (clearTapsBtn) {
      clearTapsBtn.addEventListener("click", clearTaps);
      clearTapsBtn.addEventListener("touchstart", clearTaps, { passive: true });
    }

    if (imgEl) {
      imgEl.addEventListener("click", onTap);
      imgEl.addEventListener("touchstart", onTap, { passive: true });
    }

    if (goResultsBtn) {
      goResultsBtn.addEventListener("click", goResults);
      goResultsBtn.addEventListener("touchstart", goResults, { passive: true });
    }
  })();
})();
