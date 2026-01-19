// frontend_new/index.js (FULL REPLACEMENT)
// Shows results only after: bull tap + 2 hole taps (3 total taps)
// Direction lock: Top = Up, Right = Right (image Y is inverted)

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

  // NOTE: your current HTML in this thread uses <pre id="resultsBox">
  // but earlier code referenced resultsCard + rWindage/rElevation/etc.
  // We will write into resultsBox to match your posted index.html.
  const resultsBox = document.getElementById("resultsBox");

  // State
  let hasImage = false;
  let bullTap = null; // {x,y} normalized
  let taps = []; // hole taps normalized

  // Multi-touch guard
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 total taps total

  function nowMs() {
    return Date.now();
  }
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function canShowResults() {
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

  function refreshMicroSlot() {
    if (!hasImage) {
      microSlot.innerHTML = "";
      return;
    }
    if (canShowResults()) setMicroSeeResults();
    else setMicroHint();
  }

  function updateTapCount() {
    tapCountEl.textContent = String(taps.length + (bullTap ? 1 : 0));
  }

  function clearAllDots() {
    dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, cls) {
    const rect = targetImg.getBoundingClientRect();
    const xPx = normX * rect.width;
    const yPx = normY * rect.height;

    const dot = document.createElement("div");
    dot.className = `dot ${cls}`;
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;
    dotsLayer.appendChild(dot);
  }

  function rebuildDots() {
    clearAllDots();
    if (!hasImage) return;
    if (bullTap) placeDot(bullTap.x, bullTap.y, "dotBull");
    for (const p of taps) placeDot(p.x, p.y, "dotHole");
  }

  function getNormalizedFromEvent(e) {
    const r = targetImg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function setInstruction() {
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

  function resetSession() {
    bullTap = null;
    taps = [];
    updateTapCount();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
    if (resultsBox) resultsBox.textContent = "{}";
  }

  // Upload
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

  clearTapsBtn.addEventListener("click", () => resetSession());

  // Touch tracking (2-finger pinch should never create taps)
  function handleTouchState(e) {
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) suppressClicksUntil = nowMs() + 250;
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

    if (!bullTap) bullTap = p;
    else taps.push(p);

    updateTapCount();
    rebuildDots();
    setInstruction();
    refreshMicroSlot();
  });

  window.addEventListener("resize", () => rebuildDots());

  // ---- DIRECTION LOCK (Top=Up, Right=Right) ----
  // We compute direction from taps locally so we NEVER get flipped by backend.
  // - X: normal (math + screen): dx = bull.x - poib.x
  // - Y: image is inverted (smaller y is UP), so elevation direction is flipped:
  //   dy = bull.y - poib.y
  //   dy > 0 => POIB above bull => move DOWN
  //   dy < 0 => POIB below bull => move UP
  function computePoib(pts) {
    const sum = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  }

  function dirWindage(dx) {
    if (dx > 0) return "RIGHT";
    if (dx < 0) return "LEFT";
    return "CENTER";
  }

  function dirElevation_ImageInverted(dy) {
    if (dy > 0) return "DOWN";
    if (dy < 0) return "UP";
    return "CENTER";
  }

  async function onSeeResults() {
    if (!hasImage) return;
    if (!bullTap) return;
    if (taps.length < MIN_HOLES_FOR_RESULTS) {
      setInstruction();
      return;
    }

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    // Local truth computation (direction lock)
    const poib = computePoib(taps);
    const dx = bullTap.x - poib.x;
    const dy = bullTap.y - poib.y;

    const windageDir = dirWindage(dx);
    const elevationDir = dirElevation_ImageInverted(dy);

    // Call backend (still useful to confirm plumbing), but we will NOT trust it for direction.
    let backendOut = null;
    try {
      backendOut = await window.tapscore({ distanceYds, bullTap, taps });
    } catch (e) {
      backendOut = { ok: false, error: String(e && e.message ? e.message : e) };
    }

    const out = {
      ok: true,
      distanceYds,
      tapsCount: taps.length,
      bullTap,
      poib,
      delta: { x: dx, y: dy }, // bull - POIB
      windage: windageDir,
      elevation: elevationDir,
      note: `Move POIB to bull: ${windageDir} + ${elevationDir}`,
      backend: backendOut,
    };

    if (resultsBox) resultsBox.textContent = JSON.stringify(out, null, 2);

    instructionLine.textContent = "Done.";
    refreshMicroSlot();
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  setInstruction();
})();
