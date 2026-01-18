// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)

(function () {
  const DIST_KEY   = "sczn3_distance_yards";
  const TAPS_KEY   = "sczn3_taps_json";
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const VENDOR_BUY = "sczn3_vendor_buy_url";

  function $(id){ return document.getElementById(id); }

  const uploadBtn   = $("uploadBtn");
  const fileInput   = $("fileInput");
  const distanceInp = $("distanceYards");
  const clearBtn    = $("clearBtn");
  const resultsBtn  = $("resultsBtn");
  const statusText  = $("statusText");

  const tapBox      = $("tapBox");
  const targetImg   = $("targetImg");
  const tapLayer    = $("tapLayer");
  const tapsCountEl = $("tapsCount");
  const hintOverlay = $("hintOverlay");

  const vendorInput = $("vendorInput");
  const buyMoreBtn  = $("buyMoreBtn");

  // ===== state =====
  let taps = []; // {xNorm,yNorm}
  let imgReady = false;

  function status(msg){
    if (statusText) statusText.textContent = String(msg || "");
  }

  function setTapsCount(){
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clamp01(n){
    n = Number(n);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function getDistance(){
    const n = Number(distanceInp?.value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 100;
  }

  function persistDistance(){
    try { sessionStorage.setItem(DIST_KEY, String(getDistance())); } catch {}
  }

  function persistVendor(){
    const url = String(vendorInput?.value || "").trim();
    try {
      if (url) sessionStorage.setItem(VENDOR_BUY, url);
      else sessionStorage.removeItem(VENDOR_BUY);
    } catch {}
    updateBuyMoreBtn();
  }

  function updateBuyMoreBtn(){
    const url = (() => {
      try { return sessionStorage.getItem(VENDOR_BUY) || ""; } catch { return ""; }
    })();

    if (!buyMoreBtn) return;

    if (url){
      buyMoreBtn.href = url;
      buyMoreBtn.style.display = "inline-flex";
    } else {
      buyMoreBtn.style.display = "none";
    }
  }

  function renderDots(){
    if (!tapLayer) return;
    tapLayer.innerHTML = "";

    // overlay dots should NEVER steal touches
    tapLayer.style.pointerEvents = "none";

    taps.forEach(p => {
      const dot = document.createElement("div");
      dot.className = "tapDot";
      dot.style.left = (p.xNorm * 100) + "%";
      dot.style.top  = (p.yNorm * 100) + "%";
      tapLayer.appendChild(dot);
    });
  }

  function buildTapsJson(){
    // backend expects bull + holes
    return {
      bull: { x: 0.5, y: 0.5 },         // default bull = center of image
      holes: taps.map(p => ({ x: p.xNorm, y: p.yNorm }))
    };
  }

  function persistTaps(){
    try { sessionStorage.setItem(TAPS_KEY, JSON.stringify(buildTapsJson())); } catch {}
  }

  function persistPhoto(dataUrl){
    try { sessionStorage.setItem(PHOTO_KEY, dataUrl || ""); } catch {}
  }

  function resetTaps(){
    taps = [];
    setTapsCount();
    renderDots();
    persistTaps();
    status(imgReady ? "Tap bullet holes. Pinch-to-zoom for accuracy." : "Ready. Tap ADD PHOTO.");
  }

  function openPicker(){
    // iOS: clicking hidden file input is fine; accept=images will offer library
    if (fileInput) fileInput.click();
  }

  function onFilePicked(file){
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;

      targetImg.onload = () => {
        imgReady = true;
        if (hintOverlay) hintOverlay.style.display = "none";
        resetTaps();
        status("Photo loaded. Tap bullet holes. Pinch-to-zoom for accuracy.");
      };

      targetImg.src = dataUrl;
      persistPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function addTapFromEvent(evt){
    if (!imgReady) return;

    // Don’t interfere with pinch zoom
    // If multiple touches/pointers -> ignore (user is zooming)
    if (evt.touches && evt.touches.length > 1) return;

    const rect = tapBox.getBoundingClientRect();
    const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX);
    const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY);

    const x = (cx - rect.left) / rect.width;
    const y = (cy - rect.top) / rect.height;

    const xNorm = clamp01(x);
    const yNorm = clamp01(y);

    taps.push({ xNorm, yNorm });
    setTapsCount();
    renderDots();
    persistTaps();
  }

  function goResults(){
    persistDistance();
    persistVendor();
    // Always persist taps (even empty) so output.js can decide calmly
    persistTaps();
    window.location.href = `./output.html?v=${Date.now()}`;
  }

  // ===== init =====
  (function init(){
    // distance load
    try {
      const saved = sessionStorage.getItem(DIST_KEY);
      if (saved && distanceInp) distanceInp.value = String(saved);
    } catch {}

    // vendor load
    try {
      const v = sessionStorage.getItem(VENDOR_BUY) || "";
      if (vendorInput) vendorInput.value = v;
    } catch {}
    updateBuyMoreBtn();

    setTapsCount();
    status("Ready. Tap ADD PHOTO.");

    if (uploadBtn){
      uploadBtn.addEventListener("click", openPicker);
      uploadBtn.addEventListener("pointerdown", openPicker);
    }

    if (fileInput){
      fileInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        onFilePicked(f);
      });
    }

    if (distanceInp){
      distanceInp.addEventListener("input", persistDistance);
      distanceInp.addEventListener("change", persistDistance);
    }

    if (vendorInput){
      vendorInput.addEventListener("input", persistVendor);
      vendorInput.addEventListener("change", persistVendor);
    }

    if (clearBtn){
      clearBtn.addEventListener("click", resetTaps);
      clearBtn.addEventListener("pointerdown", resetTaps);
    }

    if (resultsBtn){
      resultsBtn.addEventListener("click", goResults);
      resultsBtn.addEventListener("pointerdown", goResults);
    }

    // tap capture
    if (tapBox){
      // Pointer events
      tapBox.addEventListener("pointerdown", (evt) => {
        // allow scroll if no image yet
        if (!imgReady) return;
        addTapFromEvent(evt);
      });

      // Touch fallback
      tapBox.addEventListener("touchstart", (evt) => {
        if (!imgReady) return;
        addTapFromEvent(evt);
      }, { passive: true });
    }

    // ensure tapsJson exists
    persistTaps();
  })();
})();
