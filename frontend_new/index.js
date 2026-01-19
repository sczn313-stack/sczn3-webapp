// frontend_new/index.js (FULL REPLACEMENT)

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
  let bullTap = null;         // {x,y} normalized to image
  let taps = [];              // bullet taps normalized
  let firstTapDone = false;

  // Multi-touch guard (2-finger pinch should never create taps)
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  function nowMs(){ return Date.now(); }

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

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

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
    instructionLine.textContent = "Tap bullet holes. (Pinch to zoom anytime.)";
  }

  function resetSession(){
    bullTap = null;
    taps = [];
    firstTapDone = false;
    resultsCard.style.display = "none";
    updateTapCount();
    setInstruction();
    setMicroHint();
    rebuildDots();
  }

  // Upload (Safari-safe)
  uploadHeroBtn.addEventListener("click", () => {
    // Must be direct user gesture for iOS picker
    photoInput.value = ""; // allows re-select same file
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

      // Make overlay match the rendered image size
      // Dots layer is absolute; we re-build after load.
      hasImage = true;
      targetWrap.style.display = "block";
      resetSession();
    };

    targetImg.src = objectUrl;
  });

  // Clear taps
  clearTapsBtn.addEventListener("click", () => {
    resetSession();
  });

  // Touch tracking (two-finger protection)
  function handleTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) {
        // after a pinch ends, ignore stray click/tap for a moment
        suppressClicksUntil = nowMs() + 250;
      }
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchmove", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchend", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", handleTouchState, { passive: true });

  // Tap handler (single-finger only)
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    // First tap removes the hint and reveals See Results (clean)
    if (!firstTapDone) {
      firstTapDone = true;
      setMicroSeeResults();
    }

    const p = getNormalizedFromEvent(e);

    if (!bullTap) {
      bullTap = p;
    } else {
      taps.push(p);
    }

    updateTapCount();
    rebuildDots();
    setInstruction();
  });

  // Keep dots aligned on resize/orientation changes
  window.addEventListener("resize", () => rebuildDots());

  // See Results
  async function onSeeResults(){
    // Requirements
    if (!hasImage) {
      instructionLine.textContent = "Add a photo first.";
      return;
    }
    if (!bullTap) {
      instructionLine.textContent = "Tap bull first.";
      return;
    }
    if (taps.length < 1) {
      instructionLine.textContent = "Tap at least one bullet hole.";
      return;
    }

    const distanceYds = Number(distanceYdsEl.value || 100);

    // UI feedback
    instructionLine.textContent = "Computing…";

    try {
      const payload = {
        distanceYds,
        bullTap,
        taps,
        // imageDataUrl intentionally omitted (fast + clean)
      };

      const out = await window.tapscore(payload);

      // NO JSON. Translate to shooter-readable.
      resultsCard.style.display = "block";
      rDistance.textContent = `${out.distanceYds} yds`;
      rTapsUsed.textContent = String(out.tapsCount);

      // Placeholder labels until inches/clicks go live
      rWindage.textContent = out.windage && out.windage !== "--" ? out.windage : "Direction computed";
      rElevation.textContent = out.elevation && out.elevation !== "--" ? out.elevation : "Direction computed";
      rScore.textContent = out.score && out.score !== "--" ? out.score : "—";

      // Direction language from delta sign (bull - POIB)
      const dx = out.delta && typeof out.delta.x === "number" ? out.delta.x : 0;
      const dy = out.delta && typeof out.delta.y === "number" ? out.delta.y : 0;

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "UP" : (dy < 0 ? "DOWN" : "CENTER");

      rNote.textContent =
        `Move POIB to bull: ${windDir} + ${elevDir} (verification stage).`;

      instructionLine.textContent = "Done.";

      // Add vendor CTA (if link provided) in microSlot next to See Results
      setMicroSeeResults();
      setMicroVendorCtaIfAny();
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
      resultsCard.style.display = "none";
    }
  }

  // Init
  setMicroHint();
  updateTapCount();
  setInstruction();
})();
