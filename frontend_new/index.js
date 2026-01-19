// frontend_new/index.js (FULL REPLACEMENT)
// Bull-first: Tap 1 = bull/aim point. Tap 2+ = bullet holes.
// See results appears only after bull + 2 holes (3 total taps).
// Elevation direction locked: screen-Y is inverted (down on screen = negative UP).

(() => {
  // Elements
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

  const windageBox = document.getElementById("windageBox");
  const elevationBox = document.getElementById("elevationBox");

  const resultsCard = document.getElementById("resultsCard");
  const rDistance = document.getElementById("rDistance");
  const rTapsUsed = document.getElementById("rTapsUsed");
  const rWindage = document.getElementById("rWindage");
  const rElevation = document.getElementById("rElevation");
  const rNote = document.getElementById("rNote");

  // State
  let hasImage = false;
  let bullTap = null; // {x,y} normalized
  let taps = [];      // bullet taps normalized

  // Multi-touch guard (pinch zoom must NOT create taps)
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressUntil = 0;

  // Require bull + 2 holes
  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function setTapCount(){
    const total = (bullTap ? 1 : 0) + taps.length;
    if (tapCountEl) tapCountEl.textContent = String(total);
  }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setInstruction(){
    // ✅ Instruction line should NOT exist until photo is loaded
    if (!hasImage) {
      instructionLine.textContent = "";
      return;
    }
    // Hard-coded behavior per your request:
    instructionLine.textContent = "Tap bullseye or aim point 1st — then tap bullet holes.";
  }

  function setWindElevBoxes(w, e){
    if (windageBox) windageBox.textContent = w || "—";
    if (elevationBox) elevationBox.textContent = e || "—";
  }

  function clearDots(){
    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, kind){
    // place dot relative to the IMAGE (not the whole card)
    const rect = targetImg.getBoundingClientRect();
    const imgW = rect.width;
    const imgH = rect.height;

    const xPx = normX * imgW;
    const yPx = normY * imgH;

    const dot = document.createElement("div");
    dot.className = `dot ${kind === "bull" ? "dotBull" : "dotHole"}`;
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;
    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearDots();
    if (!hasImage) return;

    if (bullTap) placeDot(bullTap.x, bullTap.y, "bull");
    for (const p of taps) placeDot(p.x, p.y, "hole");
  }

  function resetSession(){
    bullTap = null;
    taps = [];
    setTapCount();
    setWindElevBoxes("—","—");
    if (resultsCard) resultsCard.style.display = "none";
    refreshMicroSlot();
    rebuildDots();
  }

  // Micro-slot UI
  function renderPinchHint(){
    microSlot.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "hintPill";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function renderSeeResultsBtn(){
    microSlot.innerHTML = "";

    const btn = document.createElement("button");
    btn.className = "btn btnGreen";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    // Vendor CTA appears in this same slot when results are eligible
    const link = (vendorLinkEl?.value || "").trim();
    if (link){
      const a = document.createElement("a");
      a.className = "vendorCta";
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Buy more targets like this";
      microSlot.appendChild(a);
    }
  }

  function refreshMicroSlot(){
    if (!hasImage){
      microSlot.innerHTML = "";
      return;
    }
    if (canShowResults()) renderSeeResultsBtn();
    else renderPinchHint();
  }

  // Upload (Safari-safe)
  if (uploadHeroBtn && photoInput){
    uploadHeroBtn.addEventListener("click", () => {
      // clear value so selecting same image again still fires "change"
      photoInput.value = "";
      photoInput.click();
    });

    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")){
        hasImage = false;
        targetWrap.style.display = "none";
        instructionLine.textContent = "";
        microSlot.innerHTML = "";
        return;
      }

      // Object URL is most reliable on iOS
      const objectUrl = URL.createObjectURL(file);

      targetImg.onload = () => {
        URL.revokeObjectURL(objectUrl);

        hasImage = true;
        targetWrap.style.display = "block";
        setInstruction();
        resetSession();
        refreshMicroSlot();
        rebuildDots();
      };

      targetImg.src = objectUrl;
    });
  }

  // Clear
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      if (!hasImage) return;
      resetSession();
    });
  }

  // Touch state (pinch guard)
  function touchState(e){
    activeTouches = e.touches ? e.touches.length : 0;

    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) {
        // prevent “pinch caused tap”
        suppressUntil = nowMs() + 300;
      }
      multiTouchActive = false;
    }
  }

  if (targetCanvas){
    targetCanvas.addEventListener("touchstart", touchState, { passive: true });
    targetCanvas.addEventListener("touchmove", touchState, { passive: true });
    targetCanvas.addEventListener("touchend", touchState, { passive: true });
    targetCanvas.addEventListener("touchcancel", touchState, { passive: true });

    // Use click (simple + stable), but guarded against multitouch/pinch
    targetCanvas.addEventListener("click", (e) => {
      if (!hasImage) return;
      if (multiTouchActive) return;
      if (nowMs() < suppressUntil) return;

      // Only count taps if they land on the image
      const r = targetImg.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return;

      const nx = clamp01((cx - r.left) / r.width);
      const ny = clamp01((cy - r.top) / r.height);

      if (!bullTap) {
        bullTap = { x: nx, y: ny };
      } else {
        taps.push({ x: nx, y: ny });
      }

      setTapCount();
      rebuildDots();
      refreshMicroSlot();
    });
  }

  window.addEventListener("resize", () => rebuildDots());

  // ✅ Results: clean + elevation locked
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (taps.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = Number(distanceYdsEl?.value || 100);

    try{
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Prefer backend delta if present
      const dxRaw = (out && out.delta && typeof out.delta.x === "number") ? out.delta.x : 0;
      const dyRaw = (out && out.delta && typeof out.delta.y === "number") ? out.delta.y : 0;

      // ✅ CRITICAL:
      // screen y increases DOWN. For true "UP/DOWN" labels, invert Y.
      const dx = dxRaw;       // right is positive (screen +x)
      const dy = -dyRaw;      // invert so UP is positive

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "UP" : (dy < 0 ? "DOWN" : "CENTER");

      // Update top boxes
      setWindElevBoxes(windDir, elevDir);

      // Results card (clean text)
      if (resultsCard) resultsCard.style.display = "block";
      if (rDistance) rDistance.textContent = `${distanceYds} yds`;
      if (rTapsUsed) rTapsUsed.textContent = String(taps.length);
      if (rWindage) rWindage.textContent = windDir;
      if (rElevation) rElevation.textContent = elevDir;

      if (rNote){
        rNote.textContent = `Move POIB to bull: ${windDir} + ${elevDir}.`;
      }

      refreshMicroSlot();
    } catch {
      // If backend fails, keep it calm (no noisy JSON)
      if (resultsCard) resultsCard.style.display = "none";
      setWindElevBoxes("—","—");
    }
  }

  // Init
  setInstruction();
  setTapCount();
  refreshMicroSlot();
  setWindElevBoxes("—","—");
})();
