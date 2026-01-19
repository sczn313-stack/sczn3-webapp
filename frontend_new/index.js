// frontend_new/index.js (FULL REPLACEMENT)
// One-button Upload Hero -> camera / library / files
// Bull-first workflow:
//   Tap #1 = bull/aim point
//   Tap #2+ = bullet holes
//
// UX rules:
// - No instruction text under brand (we don't use statusLine at all)
// - Hard-coded tap header line appears ONLY when a photo is loaded
// - Micro-slot behavior:
//    • after photo load: show nothing
//    • after first bull tap: briefly show "Pinch to zoom" (then fades)
//    • after bull tap: show Green "See results" button
//    • if vendor link exists: show Vendor CTA alongside See results
// - Two-finger pinch should NOT create taps (multitouch suppression)

(() => {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const VENDOR_KEY= "sczn3_vendor_buy_url";
  const LAST_KEY  = "sczn3_last_result_json";

  function $(id){ return document.getElementById(id); }

  const uploadHeroBtn = $("uploadHeroBtn");
  const photoInput    = $("photoInput");

  const distanceYds   = $("distanceYds");
  const tapCountEl    = $("tapCount");
  const clearTapsBtn  = $("clearTapsBtn");

  const microSlot     = $("microSlot");

  const tapHeaderLine = $("tapHeaderLine");
  const targetWrap    = $("targetWrap");
  const targetImg     = $("targetImg");
  const dotsLayer     = $("dotsLayer");

  const vendorLink    = $("vendorLink");

  const resultsCard   = $("resultsCard");
  const resultsText   = $("resultsText");

  // --- state ---
  let bullTap = null; // {x,y} normalized 0..1
  let holes   = [];   // [{x,y} normalized]
  let pinchHintTimer = null;

  // multitouch suppression
  let multiTouchActive = false;

  function setTapCount(n){
    if (tapCountEl) tapCountEl.textContent = String(Number(n) || 0);
  }

  function clearDots(){
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
  }

  function dotHTML(px, py, kind){
    const k = kind === "bull" ? "bull" : "hole";
    return `<div class="tapDot" data-kind="${k}" style="left:${px}px; top:${py}px;"></div>`;
  }

  function addDot(px, py, kind){
    if (!dotsLayer) return;
    dotsLayer.insertAdjacentHTML("beforeend", dotHTML(px, py, kind));
  }

  function resetSession(){
    bullTap = null;
    holes = [];
    clearDots();
    setTapCount(0);

    // clear results view (no JSON)
    if (resultsCard) resultsCard.style.display = "none";
    if (resultsText) resultsText.textContent = "";

    // micro-slot cleared until first tap
    renderMicroSlot();
  }

  function showPhoto(dataUrl){
    if (!targetImg || !targetWrap) return;

    targetImg.src = dataUrl;
    targetWrap.style.display = "block";

    if (tapHeaderLine) tapHeaderLine.style.display = "block";

    // ensure overlay aligns
    if (dotsLayer) dotsLayer.innerHTML = "";

    // store
    try { sessionStorage.setItem(PHOTO_KEY, dataUrl); } catch {}

    // new photo = new tap session
    resetSession();

    // keep distance
    try { sessionStorage.setItem(DIST_KEY, String(distanceYds?.value || "100")); } catch {}
  }

  function openPicker(){
    if (!photoInput) return;
    // iOS: selecting same file won't fire change unless cleared
    photoInput.value = "";
    photoInput.click();
  }

  // Upload hero behavior
  if (uploadHeroBtn){
    uploadHeroBtn.addEventListener("click", (e) => { e.preventDefault(); openPicker(); });
    uploadHeroBtn.addEventListener("touchstart", (e) => { e.preventDefault(); openPicker(); }, { passive:false });
  }

  // Photo input change
  if (photoInput){
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")){
        alert("Please choose an image file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (!dataUrl) return;
        showPhoto(dataUrl);
      };
      reader.onerror = () => alert("Could not read that photo.");
      reader.readAsDataURL(file);
    });
  }

  // Distance persistence
  function saveDistance(){
    try { sessionStorage.setItem(DIST_KEY, String(distanceYds?.value || "100")); } catch {}
  }
  if (distanceYds){
    // load
    const saved = sessionStorage.getItem(DIST_KEY);
    if (saved) distanceYds.value = saved;

    distanceYds.addEventListener("input", saveDistance);
    distanceYds.addEventListener("change", saveDistance);
  }

  // Vendor link persistence
  function saveVendor(){
    const url = String(vendorLink?.value || "").trim();
    try {
      if (url) sessionStorage.setItem(VENDOR_KEY, url);
      else sessionStorage.removeItem(VENDOR_KEY);
    } catch {}
    renderMicroSlot();
  }
  if (vendorLink){
    const savedV = sessionStorage.getItem(VENDOR_KEY);
    if (savedV) vendorLink.value = savedV;

    vendorLink.addEventListener("input", saveVendor);
    vendorLink.addEventListener("change", saveVendor);
  }

  // Micro-slot rendering
  function renderMicroSlot(){
    if (!microSlot) return;

    // no photo => nothing
    const hasPhoto = !!(targetImg && targetImg.src);
    if (!hasPhoto){
      microSlot.innerHTML = "";
      return;
    }

    const hasBull = !!bullTap;
    const hasHoles = holes.length > 0;
    const vendorUrl = (sessionStorage.getItem(VENDOR_KEY) || "").trim();

    // After bull tap, show See Results + optional vendor CTA.
    // Pinch hint shows briefly right after the bull tap (timer inserts it, then clears itself).
    if (hasBull){
      const seeBtn = `
        <button id="seeResultsBtn" class="seeResultsHint" type="button">
          See results
        </button>
      `;

      const vendorBtn = vendorUrl ? `
        <a class="vendorBuyBtn" href="${escapeAttr(vendorUrl)}" target="_blank" rel="noopener">
          <span class="vendorIcon">🛒</span>
          <span class="vendorText">Buy more targets like this</span>
          <span class="vendorArrow">›</span>
        </a>
      ` : "";

      // stack on mobile nicely
      microSlot.style.flexDirection = "column";
      microSlot.style.alignItems = "stretch";
      microSlot.innerHTML = `
        ${seeBtn}
        ${vendorBtn}
      `;

      // bind See Results
      const btn = document.getElementById("seeResultsBtn");
      if (btn){
        btn.addEventListener("click", () => doResults());
        btn.addEventListener("touchstart", (e) => { e.preventDefault(); doResults(); }, { passive:false });
      }
      return;
    }

    // Photo exists but no bull yet => micro slot stays empty (clean)
    microSlot.innerHTML = "";
  }

  function escapeAttr(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll('"',"&quot;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  function showPinchHintBrief(){
    if (!microSlot) return;

    // show pinch hint ONLY briefly, and ONLY right after the first tap
    microSlot.style.flexDirection = "column";
    microSlot.style.alignItems = "stretch";
    microSlot.innerHTML = `<div class="pinchHint">Pinch to zoom for precise taps</div>`;

    if (pinchHintTimer) clearTimeout(pinchHintTimer);
    pinchHintTimer = setTimeout(() => {
      pinchHintTimer = null;
      renderMicroSlot();
    }, 1200);
  }

  // Tap mapping: client point -> normalized (0..1) within rendered image box
  function clientToNorm(clientX, clientY){
    if (!targetWrap) return null;

    const rect = targetWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const nx = rect.width ? (x / rect.width) : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    return { nx, ny, px:x, py:y };
  }

  // Multi-touch suppression
  function bindMultitouchGuards(el){
    if (!el) return;

    el.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2){
        multiTouchActive = true;
        // do NOT preventDefault here; allow pinch zoom
        return;
      }
    }, { passive:true });

    el.addEventListener("touchend", (e) => {
      const n = (e.touches && e.touches.length) ? e.touches.length : 0;
      if (n < 2) multiTouchActive = false;
    }, { passive:true });

    el.addEventListener("touchcancel", () => {
      multiTouchActive = false;
    }, { passive:true });
  }

  // Tap capture
  function onTapPoint(clientX, clientY){
    if (!targetImg || !targetImg.src) return;
    if (multiTouchActive) return;

    const p = clientToNorm(clientX, clientY);
    if (!p) return;

    // first tap = bull
    if (!bullTap){
      bullTap = { x: p.nx, y: p.ny };
      addDot(p.px, p.py, "bull");

      // brief pinch hint, then micro-slot becomes See Results (+ vendor)
      showPinchHintBrief();

      // after bull tap, micro-slot will become See Results
      // but we allow the pinch hint to show first
      return;
    }

    // next taps = holes
    holes.push({ x: p.nx, y: p.ny });
    setTapCount(holes.length);
    addDot(p.px, p.py, "hole");

    // ensure micro-slot shows See Results after first tap
    if (!pinchHintTimer) renderMicroSlot();
  }

  // Pointer + touch (safe)
  function bindTapHandlers(){
    if (!targetWrap) return;

    // allow pinch zoom on image; we only listen for taps
    bindMultitouchGuards(targetWrap);

    targetWrap.addEventListener("pointerdown", (e) => {
      // pointerdown fires even during pinch sometimes — multiTouchActive guards this
      if (multiTouchActive) return;
      // prevent scroll/select on single tap
      e.preventDefault();
      onTapPoint(e.clientX, e.clientY);
    });

    // also explicit click for desktop
    targetWrap.addEventListener("click", (e) => {
      onTapPoint(e.clientX, e.clientY);
    });
  }

  bindTapHandlers();

  // Clear taps
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => resetSession());
    clearTapsBtn.addEventListener("touchstart", (e) => { e.preventDefault(); resetSession(); }, { passive:false });
  }

  // Results (clean text only)
  async function doResults(){
    try{
      if (!targetImg || !targetImg.src){
        alert("Upload a target photo first.");
        return;
      }
      if (!bullTap){
        alert("Tap the bullseye / aim point first.");
        return;
      }
      if (holes.length < 1){
        alert("Tap at least one bullet hole after the bullseye.");
        return;
      }

      const dist = Number(distanceYds?.value || 100);
      const vendorUrl = String(vendorLink?.value || "").trim();

      // Keep session storage updated
      saveDistance();
      try{
        if (vendorUrl) sessionStorage.setItem(VENDOR_KEY, vendorUrl);
        else sessionStorage.removeItem(VENDOR_KEY);
      } catch {}

      // Call backend
      if (typeof window.tapscore !== "function"){
        throw new Error("Backend function missing (api.js not loaded).");
      }

      const payload = {
        distanceYds: dist,
        vendorLink: vendorUrl,
        bullTap,
        taps: holes,
        imageDataUrl: null
      };

      const out = await window.tapscore(payload);

      // Store raw in session (for later pages if needed)
      try { sessionStorage.setItem(LAST_KEY, JSON.stringify(out || {})); } catch {}

      // Render CLEAN summary (no JSON)
      const dx = out?.delta?.x;
      const dy = out?.delta?.y;

      const summary = [
        `Distance: ${Number.isFinite(dist) ? dist : 100} yds`,
        `Taps: ${holes.length}`,
        ``,
        `Bull tap: (${fmt3(bullTap.x)}, ${fmt3(bullTap.y)})`,
        `POIB: (${fmt3(out?.poib?.x)}, ${fmt3(out?.poib?.y)})`,
        ``,
        `Delta (bull − POIB):`,
        `  X: ${fmt3(dx)}   Y: ${fmt3(dy)}`,
        ``,
        `Next: Click outputs will replace this summary once scale is locked.`
      ].join("\n");

      if (resultsCard) resultsCard.style.display = "block";
      if (resultsText) {
        resultsText.style.whiteSpace = "pre-wrap";
        resultsText.textContent = summary;
      }

      // micro-slot stays (See results + vendor CTA)
      renderMicroSlot();

    } catch (err){
      const msg = String(err?.message || err || "Error");
      alert(msg);
    }
  }

  function fmt3(v){
    const n = Number(v);
    if (!Number.isFinite(n)) return "--";
    return (Math.round(n * 1000) / 1000).toFixed(3);
  }

  // Boot: restore photo if present
  (function init(){
    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto){
      // show photo + header line, reset session for safety
      if (tapHeaderLine) tapHeaderLine.style.display = "block";
      if (targetWrap) targetWrap.style.display = "block";
      if (targetImg) targetImg.src = savedPhoto;
      resetSession();
      renderMicroSlot();
    } else {
      if (tapHeaderLine) tapHeaderLine.style.display = "none";
      if (targetWrap) targetWrap.style.display = "none";
      if (microSlot) microSlot.innerHTML = "";
      setTapCount(0);
    }
  })();

})();
