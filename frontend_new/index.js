// frontend_new/index.js (FULL REPLACEMENT)
// See Results appears only after: bull tap + 2 hole taps (3 total taps)

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

  const resultsCard = document.getElementById("resultsCard");
  const rDistance = document.getElementById("rDistance");
  const rTapsUsed = document.getElementById("rTapsUsed");
  const rWindage = document.getElementById("rWindage");
  const rElevation = document.getElementById("rElevation");
  const rScore = document.getElementById("rScore");
  const rNote = document.getElementById("rNote");

  // State
  let hasImage = false;
  let bullTap = null;         // {x,y} normalized
  let taps = [];              // bullet taps normalized

  // Multi-touch guard (2-finger pinch should never create taps)
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // RULE: require bull + N holes before showing See Results
  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 total taps

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setMicroHint() {
    microSlot.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "hintPill";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function setMicroSeeResults() {
    microSlot.innerHTML = "";

    const btn = document.createElement("button");
    btn.className = "btn btnGreen";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);

    microSlot.appendChild(btn);
    setMicroVendorCtaIfAny();
  }

  function setMicroVendorCtaIfAny() {
    const link = (vendorLinkEl.value || "").trim();
    if (!link) return;

    const a = document.createElement("a");
    a.className = "vendorCta";
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Buy more targets like this";

    microSlot.appendChild(a);
  }

  function refreshMicroSlot(){
    // Always show pinch hint until results are eligible
    if (!hasImage) {
      microSlot.innerHTML = "";
      return;
    }
    if (canShowResults()) {
      setMicroSeeResults();
    } else {
      setMicroHint();
    }
  }

  function updateTapCount(){
    tapCountEl.textContent = String(taps.length + (bullTap ? 1 : 0));
  }

  function clearAllDots(){
    dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, cls){
    const rect = targetImg.getBoundingClientRect();
    const imgW = rect.width;
    const imgH = rect.height;

    const xPx = normX * imgW;
    const yPx = normY * imgH;

    const dot = document.createElement("div");
    dot.className = `dot ${cls}`;
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;
    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearAllDots();
    if (!hasImage) return;
    if (bullTap) placeDot(bullTap.x, bullTap.y, "dotBull");
    for (const p of taps) placeDot(p.x, p.y, "dotHole");
  }

  function getNormalizedFromEvent(e){
    const r = targetImg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function setInstruction(){
    if (!hasImage) {
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }
    if (!bullTap) {
      instructionLine.textContent = "Tap bull first.";
      return;
    }

    const holesNeeded = Math.max(0, MIN_HOLES_FOR_RESULTS - taps.length);
    if (holesNeeded > 0) {
      instructionLine.textContent =
        holesNeeded === 1
          ? "Tap 1 more bullet hole to see results."
          : `Tap ${holesNeeded} more bullet holes to see results.`;
      return;
    }

    instructionLine.textContent = "Ready — tap See results.";
  }

  function resetSession(){
    bullTap = null;
    taps = [];
    resultsCard.style.display = "none";
    updateTapCount();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
  }

  // Upload (Safari-safe)
  uploadHeroBtn.addEventListener("click", () => {
    photoInput.value = "";
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      instructionLine.textContent = "Please choose an image file.";
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    targetImg.onload = () => {
      URL.revokeObjectURL(objectUrl);
      hasImage = true;
      targetWrap.style.display = "block";
      resetSession();
    };

    targetImg.src = objectUrl;
  });

  clearTapsBtn.addEventListener("click", () => {
    resetSession();
  });

  // Touch tracking
  function handleTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) {
        suppressClicksUntil = nowMs() + 250;
      }
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchmove", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchend", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", handleTouchState, { passive: true });

  // Tap handler
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    const p = getNormalizedFromEvent(e);

    if (!bullTap) {
      bullTap = p;
    } else {
      taps.push(p);
    }

    updateTapCount();
    rebuildDots();
    setInstruction();
    refreshMicroSlot();
  });

  window.addEventListener("resize", () => rebuildDots());

  async function onSeeResults(){
    if (!hasImage) {
      instructionLine.textContent = "Add a photo first.";
      return;
    }
    if (!bullTap) {
      instructionLine.textContent = "Tap bull first.";
      return;
    }
    if (taps.length < MIN_HOLES_FOR_RESULTS) {
      setInstruction();
      return;
    }

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      resultsCard.style.display = "block";
      rDistance.textContent = `${out.distanceYds} yds`;
      rTapsUsed.textContent = String(out.tapsCount);

      rWindage.textContent = out.windage && out.windage !== "--" ? out.windage : "Direction computed";
      rElevation.textContent = out.elevation && out.elevation !== "--" ? out.elevation : "Direction computed";
      rScore.textContent = out.score && out.score !== "--" ? out.score : "—";

      const dx = out.delta && typeof out.delta.x === "number" ? out.delta.x : 0;
      const dy = out.delta && typeof out.delta.y === "number" ? out.delta.y : 0;

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "UP" : (dy < 0 ? "DOWN" : "CENTER");

      rNote.textContent = `Move POIB to bull: ${windDir} + ${elevDir} (verification stage).`;

      instructionLine.textContent = "Done.";
      refreshMicroSlot();
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
      resultsCard.style.display = "none";
    }
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  setInstruction();
})();
