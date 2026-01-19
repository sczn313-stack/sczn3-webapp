// frontend_new/index.js  (FULL REPLACEMENT)
// Tap-n-Score™ — Bull-first workflow
// Tap #1 = bull/aim point
// Tap #2+ = bullet holes
//
// UI rules (per Ron):
// - Remove the old status/instructions under the logo (we don't use it)
// - Only show the hardcoded instruction line WHEN a target is loaded
// - Green "See results" box is the ONLY results trigger (no bottom button)
// - When results appear: instruction disappears, vendor CTA appears in the micro-slot
// - Allow pinch-zoom, but DISABLE taps while 2 fingers are on screen (no phantom tap)

(() => {
  // ===== Keys (optional; safe) =====
  const VENDOR_KEY = "sczn3_vendor_buy_url"; // optional later

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  // ===== DOM =====
  const uploadHeroBtn   = $("uploadHeroBtn");
  const photoInput      = $("photoInput");

  const distanceInput   = $("distanceYds");     // yards
  const tapCountEl      = $("tapCount");
  const clearTapsBtn    = $("clearTapsBtn");

  const microSlot       = $("microSlot");
  const instructionLine = $("instructionLine");

  const targetWrap      = $("targetWrap");
  const targetCanvas    = $("targetCanvas");
  const targetImg       = $("targetImg");
  const dotsLayer       = $("dotsLayer");

  const vendorLinkInput = $("vendorLink");
  const resultsBox      = $("resultsBox");

  // NOTE: statusLine exists in some HTML versions; we intentionally do NOT use it.
  // If it exists, we blank it to eliminate redundancy.
  const statusLine      = $("statusLine");

  function setTapCount(n){
    if (tapCountEl) tapCountEl.textContent = String(Number(n) || 0);
  }

  function hideStatusLine(){
    if (statusLine) statusLine.textContent = "";
  }

  function showInstructionIfHasTarget(){
    if (!instructionLine) return;
    if (hasPhotoLoaded()){
      instructionLine.textContent = "Tap Bullseye or Aim Point 1st. Then tap Bullet holes.";
    } else {
      instructionLine.textContent = "Add a photo to begin.";
    }
  }

  function hasPhotoLoaded(){
    return !!(targetImg && targetImg.src);
  }

  function showTargetArea(show){
    if (targetWrap) targetWrap.style.display = show ? "block" : "none";
  }

  function clearDots(){
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
  }

  function addDot(px, py, kind){
    if (!dotsLayer) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.dataset.kind = kind || "hole";
    d.style.left = `${px}px`;
    d.style.top  = `${py}px`;
    dotsLayer.appendChild(d);
  }

  // ===== Tap State =====
  let bullTap = null; // normalized {x,y} 0..1
  let holes = [];     // normalized hole taps
  let lastTapAt = 0;

  // ===== Pinch / Two-finger guard =====
  let twoFingerActive = false;
  let suppressTapsUntil = 0;

  function nowMs(){ return Date.now(); }

  // iOS: during pinch, touches can briefly report weird pointer sequences.
  // We'll suppress taps while 2 fingers are down, and for a short window after.
  function beginTwoFinger(){
    twoFingerActive = true;
    suppressTapsUntil = nowMs() + 250;
  }
  function endTwoFinger(){
    twoFingerActive = false;
    suppressTapsUntil = nowMs() + 250;
  }
  function tapsSuppressed(){
    return twoFingerActive || nowMs() < suppressTapsUntil;
  }

  // ===== Micro-slot rendering =====
  function clearMicroSlot(){
    if (!microSlot) return;
    microSlot.innerHTML = "";
  }

  function renderPinchHintOnce(){
    if (!microSlot) return;
    microSlot.innerHTML = `
      <div class="pinchHint">Pinch to zoom for accurate taps.</div>
    `;
  }

  function renderSeeResultsButton(){
    if (!microSlot) return;
    microSlot.innerHTML = `
      <button id="seeResultsHint" class="seeResultsHint" type="button" aria-label="See results">
        See results
      </button>
    `;
    const btn = $("seeResultsHint");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        doResults();
      });
    }
  }

  function renderVendorCTA(){
    if (!microSlot) return;

    // preferred source: explicit vendorLink input
    const url = String(vendorLinkInput?.value || "").trim()
      || sessionStorage.getItem(VENDOR_KEY) || "";

    if (!url) {
      microSlot.innerHTML = ""; // nothing if no vendor url
      return;
    }

    microSlot.innerHTML = `
      <a class="vendorBuyBtn" href="${escapeAttr(url)}" target="_blank" rel="noopener">
        <span class="vendorIcon">🛒</span>
        <span class="vendorText">Buy more targets like this</span>
        <span class="vendorArrow">›</span>
      </a>
    `;
  }

  function escapeAttr(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll('"',"&quot;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  // Show pinch hint after first tap (quiet), then replace with See results after at least 2 taps (bull+1 hole)
  function updateMicroSlot(){
    if (!hasPhotoLoaded()){
      clearMicroSlot();
      return;
    }

    const tapsTotal = (bullTap ? 1 : 0) + holes.length;

    // After results appear, micro slot is vendor CTA (handled elsewhere)
    // Here: pre-results state
    if (tapsTotal === 1){
      // After first tap only
      renderPinchHintOnce();
      return;
    }
    if (tapsTotal >= 2){
      // bull + >=1 hole
      renderSeeResultsButton();
      return;
    }

    clearMicroSlot();
  }

  // ===== Reset flow =====
  function resetSession(){
    bullTap = null;
    holes = [];
    clearDots();
    setTapCount(0);

    // keep results box visible but reset content
    if (resultsBox) resultsBox.textContent = "{}";

    // pre-results micro slot logic
    updateMicroSlot();

    showInstructionIfHasTarget();
  }

  // ===== Photo handling =====
  function openPicker(){
    if (!photoInput) return;
    // iOS: selecting the same image won't fire change unless you reset value
    photoInput.value = "";
    photoInput.click();
  }

  async function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed."));
      r.readAsDataURL(file);
    });
  }

  async function handlePickedFile(){
    hideStatusLine();

    const file = photoInput?.files?.[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")){
      alert("Please choose an image file.");
      return;
    }

    try{
      const dataUrl = await readFileAsDataURL(file);

      // Load image
      if (targetImg) {
        targetImg.onload = () => {
          showTargetArea(true);
          resetSession();
          // show instruction only after target is loaded
          showInstructionIfHasTarget();
        };
        targetImg.src = dataUrl;
      }

      // Store (optional for later)
      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

    } catch (e){
      alert("Photo load failed. Please try again.");
    }
  }

  // ===== Tap mapping =====
  function clientPointToNormalized(clientX, clientY){
    if (!targetCanvas) return null;

    const rect = targetCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const nx = rect.width ? (x / rect.width) : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    return { nx, ny, px: x, py: y };
  }

  function applyTap(nx, ny, px, py){
    // If bull not set => bull tap
    if (!bullTap){
      bullTap = { x: nx, y: ny };
      addDot(px, py, "bull");
      // Tap count display is HOLES count only
      setTapCount(0);
    } else {
      holes.push({ x: nx, y: ny });
      setTapCount(holes.length);
      addDot(px, py, "hole");
    }

    updateMicroSlot();
  }

  // ===== Results =====
  function getTargetSizeInches(){
    // For now we are 8.5x11 baseline. Later you can swap per target type.
    return { w: 8.5, h: 11.0 };
  }

  async function doResults(){
    hideStatusLine();

    if (!hasPhotoLoaded()){
      alert("Upload a target photo first.");
      return;
    }
    if (!bullTap){
      alert("Tap the bullseye / aim point first.");
      return;
    }
    if (holes.length < 1){
      alert("Tap at least one bullet hole.");
      return;
    }

    const distanceYds = Number(distanceInput?.value || 100);
    const vendorLink = String(vendorLinkInput?.value || "").trim();

    if (vendorLink){
      try { sessionStorage.setItem(VENDOR_KEY, vendorLink); } catch {}
    }

    const { w, h } = getTargetSizeInches();

    const payload = {
      distanceYds,
      moaPerClick: 0.25,
      targetWIn: w,
      targetHIn: h,
      bullTap,
      taps: holes,
      imageDataUrl: null
    };

    try{
      if (typeof window.tapscore !== "function") {
        throw new Error("Backend function missing. api.js did not load.");
      }

      // Replace micro slot with a quiet “working” hint (optional minimal)
      if (microSlot) {
        microSlot.innerHTML = `<div class="pinchHint">Working…</div>`;
      }

      const out = await window.tapscore(payload);

      // Write JSON
      if (resultsBox) resultsBox.textContent = JSON.stringify(out, null, 2);

      // Post-results behavior:
      // - instruction line disappears (clean)
      // - vendor CTA appears in micro slot
      if (instructionLine) instructionLine.textContent = "";
      renderVendorCTA();

    } catch (err){
      // Restore micro slot to See results so user can retry
      renderSeeResultsButton();
      const msg = String(err?.message || err || "Network error");
      alert(msg);
    }
  }

  // ===== Bind events =====
  // Upload hero triggers picker
  if (uploadHeroBtn){
    uploadHeroBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker();
    });
    uploadHeroBtn.addEventListener("touchstart", (e) => {
      // iOS: touchstart improves reliability
      e.preventDefault();
      openPicker();
    }, { passive: false });
  }

  if (photoInput){
    photoInput.addEventListener("change", handlePickedFile);
    photoInput.addEventListener("input", handlePickedFile);
  }

  // Clear taps
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resetSession();
    });
  }

  // Tap capture on target canvas (allows pinch-zoom on image, taps on canvas)
  if (targetCanvas){
    // Touch guard for pinch (2 fingers)
    targetCanvas.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2) beginTwoFinger();
    }, { passive: true });

    targetCanvas.addEventListener("touchend", (e) => {
      if (!e.touches || e.touches.length < 2) endTwoFinger();
    }, { passive: true });

    targetCanvas.addEventListener("touchcancel", () => {
      endTwoFinger();
    }, { passive: true });

    // Pointer tap (mouse + touch -> pointer)
    targetCanvas.addEventListener("pointerdown", (e) => {
      // If pinch/2-finger was active or just ended, DO NOT tap
      if (tapsSuppressed()) return;

      // Avoid double-fire
      const t = nowMs();
      if (t - lastTapAt < 60) return;
      lastTapAt = t;

      // Prevent scroll selection quirks on tap
      e.preventDefault();

      const p = clientPointToNormalized(e.clientX, e.clientY);
      if (!p) return;

      applyTap(p.nx, p.ny, p.px, p.py);
    }, { passive: false });
  }

  // ===== Init =====
  (function init(){
    hideStatusLine();

    showTargetArea(false);
    clearMicroSlot();
    showInstructionIfHasTarget();
    setTapCount(0);

    // If a vendor link was previously stored, restore it
    const prevVendor = sessionStorage.getItem(VENDOR_KEY);
    if (vendorLinkInput && prevVendor && !vendorLinkInput.value){
      vendorLinkInput.value = prevVendor;
    }
  })();
})();
