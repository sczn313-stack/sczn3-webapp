// frontend_new/index.js (FULL REPLACEMENT)
// Tap-n-Score — bull first, then holes
// - See Results appears only after: bull + 2 holes (3 total taps)
// - Multi-touch guard: pinch/2-finger NEVER creates taps
// - Direction/click display comes from BACKEND (single source of truth)

(() => {
  // ===== DOM =====
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const photoInput = document.getElementById("photoInput");

  const distanceYdsEl = document.getElementById("distanceYds");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const tapCountEl = document.getElementById("tapCount");
  const microSlot = document.getElementById("microSlot");

  const instructionLine = document.getElementById("instructionLine");
  const targetWrap = document.getElementById("targetWrap");
  const targetCanvas = document.getElementById("targetCanvas");
  const targetImg = document.getElementById("targetImg");
  const dotsLayer = document.getElementById("dotsLayer");

  const vendorLinkEl = document.getElementById("vendorLink");

  // Results (in your current HTML you have <pre id="resultsBox">)
  const resultsBox = document.getElementById("resultsBox");

  // ===== STATE =====
  let hasImage = false;
  let bullTap = null; // normalized {x,y}
  let holes = [];    // normalized hole taps [{x,y},...]

  // Multi-touch guard
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // Require bull + 2 holes (3 taps total)
  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, Number(v))); }

  function totalTaps(){
    return (bullTap ? 1 : 0) + holes.length;
  }

  function canShowResults(){
    return !!bullTap && holes.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setTapCount(){
    if (tapCountEl) tapCountEl.textContent = String(totalTaps());
  }

  function setInstruction(){
    if (!instructionLine) return;

    if (!hasImage){
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }

    // Only show this line when target is present (per your request)
    if (!bullTap){
      instructionLine.textContent = "Tap bull first — then tap bullet holes.";
      return;
    }

    const remaining = Math.max(0, MIN_HOLES_FOR_RESULTS - holes.length);
    if (remaining > 0){
      instructionLine.textContent =
        remaining === 1
          ? "Tap 1 more bullet hole to unlock results."
          : `Tap ${remaining} more bullet holes to unlock results.`;
      return;
    }

    instructionLine.textContent = "Ready — tap See results.";
  }

  // ===== DOTS =====
  function clearDots(){
    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function dotPx(normX, normY){
    const r = targetImg.getBoundingClientRect();
    return { x: normX * r.width, y: normY * r.height };
  }

  function addDot(normX, normY, kind){
    if (!dotsLayer) return;
    const p = dotPx(normX, normY);

    const d = document.createElement("div");
    d.className = "tapDot";
    d.dataset.kind = kind;
    d.style.left = `${p.x}px`;
    d.style.top = `${p.y}px`;
    dotsLayer.appendChild(d);
  }

  function rebuildDots(){
    clearDots();
    if (!hasImage) return;
    if (bullTap) addDot(bullTap.x, bullTap.y, "bull");
    for (const h of holes) addDot(h.x, h.y, "hole");
  }

  // Keep dots aligned when the image size changes
  window.addEventListener("resize", rebuildDots);

  // ===== MICRO SLOT =====
  function renderMicroSlot(){
    if (!microSlot) return;
    microSlot.innerHTML = "";

    if (!hasImage) return;

    // Show pinch hint after first tap only, then disappear (your “progressive quietness”)
    if (totalTaps() === 1 && !canShowResults()){
      const hint = document.createElement("div");
      hint.className = "pinchHint";
      hint.textContent = "Pinch to zoom";
      microSlot.appendChild(hint);
      return;
    }

    // Show See Results only when eligible (bull + 2 holes)
    if (canShowResults()){
      const btn = document.createElement("button");
      btn.className = "seeResultsHint";
      btn.type = "button";
      btn.textContent = "See results";
      btn.addEventListener("click", onSeeResults);
      microSlot.appendChild(btn);

      // Vendor CTA appears only once See Results is available (your request)
      const link = String(vendorLinkEl?.value || "").trim();
      if (link){
        const a = document.createElement("a");
        a.className = "vendorBuyBtn";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.innerHTML = `
          <span class="vendorIcon">🛒</span>
          <span class="vendorText">Buy more targets like this</span>
          <span class="vendorArrow">›</span>
        `;
        microSlot.appendChild(a);
      }
      return;
    }

    // Otherwise nothing (clean)
  }

  // ===== SESSION RESET =====
  function resetSession(){
    bullTap = null;
    holes = [];
    setTapCount();
    setInstruction();
    rebuildDots();
    renderMicroSlot();
    if (resultsBox) resultsBox.textContent = "{}";
  }

  // ===== UPLOAD (ONE BUTTON) =====
  if (uploadHeroBtn && photoInput){
    uploadHeroBtn.addEventListener("click", () => {
      // iOS needs this to re-select same image
      photoInput.value = "";
      photoInput.click();
    });

    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")){
        if (instructionLine) instructionLine.textContent = "Please choose an image file.";
        return;
      }

      const objectUrl = URL.createObjectURL(file);

      targetImg.onload = () => {
        try { URL.revokeObjectURL(objectUrl); } catch {}
        hasImage = true;
        if (targetWrap) targetWrap.style.display = "block";
        resetSession();
      };

      targetImg.onerror = () => {
        hasImage = false;
        if (targetWrap) targetWrap.style.display = "none";
        if (instructionLine) instructionLine.textContent = "Could not load that photo. Try again.";
        resetSession();
      };

      targetImg.src = objectUrl;
    });
  }

  // ===== CLEAR =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => resetSession());
  }

  // ===== MULTI-TOUCH GUARD =====
  function trackTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2){
      multiTouchActive = true;
    } else if (activeTouches === 0){
      if (multiTouchActive){
        suppressClicksUntil = nowMs() + 300; // swallow the “first tap” after pinch
      }
      multiTouchActive = false;
    }
  }

  if (targetCanvas){
    targetCanvas.addEventListener("touchstart", trackTouchState, { passive: true });
    targetCanvas.addEventListener("touchmove", trackTouchState, { passive: true });
    targetCanvas.addEventListener("touchend", trackTouchState, { passive: true });
    targetCanvas.addEventListener("touchcancel", trackTouchState, { passive: true });
  }

  // ===== TAP CAPTURE =====
  function normFromEvent(e){
    const r = targetImg.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    return { x: clamp01(nx), y: clamp01(ny) };
  }

  if (targetCanvas){
    targetCanvas.addEventListener("click", (e) => {
      if (!hasImage) return;
      if (multiTouchActive) return;
      if (nowMs() < suppressClicksUntil) return;

      const p = normFromEvent(e);

      if (!bullTap){
        bullTap = p;
      } else {
        holes.push(p);
      }

      setTapCount();
      rebuildDots();
      setInstruction();
      renderMicroSlot();
    });
  }

  // ===== RESULTS (single source of truth: backend) =====
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (holes.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = Number(distanceYdsEl?.value || 100);

    if (instructionLine) instructionLine.textContent = "Computing…";

    try{
      if (typeof window.tapscore !== "function"){
        throw new Error("tapscore() missing (api.js not loaded).");
      }

      const payload = {
        distanceYds,
        bullTap,
        taps: holes,      // backend expects "taps"
        // Optional if you want explicit scale control:
        // targetWIn: 8.5, targetHIn: 11, moaPerClick: 0.25
      };

      const out = await window.tapscore(payload);

      // Display ONLY what backend returns (prevents frontend flipping directions)
      if (resultsBox){
        // Keep it simple for now (no “JSON blob” vibe can be styled later)
        const wind = `${out?.clicks?.windage || "--"} ${out?.directions?.windage || ""}`.trim();
        const elev = `${out?.clicks?.elevation || "--"} ${out?.directions?.elevation || ""}`.trim();
        const dx = out?.correction_in?.dx;
        const dy = out?.correction_in?.dy;

        resultsBox.textContent = JSON.stringify({
          distanceYds: out.distanceYds,
          tapsUsed: out.tapsCount,
          windage: wind,
          elevation: elev,
          correction_in: { dx, dy }, // dx right+, dy up+
          score: out.score
        }, null, 2);
      }

      if (instructionLine) instructionLine.textContent = "Done.";
      renderMicroSlot();
    } catch(err){
      if (instructionLine) instructionLine.textContent = "Error — try again.";
      if (resultsBox) resultsBox.textContent = "{}";
    }
  }

  // ===== INIT =====
  setTapCount();
  setInstruction();
  renderMicroSlot();
})();
