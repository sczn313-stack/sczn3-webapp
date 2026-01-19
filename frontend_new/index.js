// sczn3-webapp/frontend_new/index.js (FULL REPLACEMENT)
// Tap-n-Score™
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// Results button appears only after bull + 2 holes (3 taps total).
// Direction truth comes ONLY from backend (prevents frontend flips).
// Multi-touch guard: 2-finger pinch will NOT create taps.

(() => {
  // ===== DOM =====
  const uploadHeroBtn  = document.getElementById("uploadHeroBtn");
  const photoInput     = document.getElementById("photoInput");
  const distanceYdsEl  = document.getElementById("distanceYds");
  const clearTapsBtn   = document.getElementById("clearTapsBtn");
  const tapCountEl     = document.getElementById("tapCount");
  const microSlot      = document.getElementById("microSlot");

  const instructionLine= document.getElementById("instructionLine");
  const targetWrap     = document.getElementById("targetWrap");
  const targetCanvas   = document.getElementById("targetCanvas");
  const targetImg      = document.getElementById("targetImg");
  const dotsLayer      = document.getElementById("dotsLayer");

  const vendorLinkEl   = document.getElementById("vendorLink");

  // Results card (must exist)
  const resultsCard = document.getElementById("resultsCard");
  const rDistance   = document.getElementById("rDistance");
  const rTapsUsed   = document.getElementById("rTapsUsed");
  const rWindage    = document.getElementById("rWindage");
  const rElevation  = document.getElementById("rElevation");
  const rScore      = document.getElementById("rScore");
  const rNote       = document.getElementById("rNote");

  // ===== Guards =====
  if (!uploadHeroBtn || !photoInput || !targetImg || !targetCanvas || !dotsLayer || !instructionLine || !microSlot) {
    // Fail silently (keeps page from blowing up)
    return;
  }

  // ===== State =====
  let hasImage = false;

  let bullTap = null;   // {x,y} normalized in 0..1 relative to displayed image
  let taps = [];        // hole taps [{x,y}...]

  // 2-finger pinch guard
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 taps total

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function totalTapCount(){
    return (bullTap ? 1 : 0) + taps.length;
  }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setTapCountUI(){
    if (tapCountEl) tapCountEl.textContent = String(totalTapCount());
  }

  // ===== Micro-slot UI =====
  function clearMicroSlot(){
    microSlot.innerHTML = "";
  }

  function showPinchHint(){
    clearMicroSlot();
    const pill = document.createElement("div");
    pill.className = "pinchHint";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function showSeeResultsButton(){
    clearMicroSlot();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seeResultsHint"; // green style from your CSS
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    // Vendor CTA (only after See Results appears)
    const link = (vendorLinkEl && vendorLinkEl.value ? String(vendorLinkEl.value).trim() : "");
    if (link) {
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
  }

  function refreshMicroSlot(){
    if (!hasImage) {
      clearMicroSlot();
      return;
    }
    if (canShowResults()) showSeeResultsButton();
    else showPinchHint();
  }

  // ===== Instruction line =====
  function setInstruction(){
    // MUST NOT show tap instructions until a photo exists
    if (!hasImage) {
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }

    // Your requested hardcoded vibe (no word “Target” in it)
    if (!bullTap) {
      instructionLine.textContent = "Tap bullseye or aim point 1st — then tap bullet holes.";
      return;
    }

    const holesNeeded = Math.max(0, MIN_HOLES_FOR_RESULTS - taps.length);
    if (holesNeeded > 0) {
      instructionLine.textContent =
        holesNeeded === 1
          ? "Tap 1 more bullet hole."
          : `Tap ${holesNeeded} more bullet holes.`;
      return;
    }

    instructionLine.textContent = "Ready.";
  }

  // ===== Dots =====
  function clearDots(){
    dotsLayer.innerHTML = "";
  }

  // Place dot using targetImg’s displayed rect (keeps overlay aligned)
  function placeDot(normX, normY, kind){
    const rect = targetImg.getBoundingClientRect();
    const xPx = normX * rect.width;
    const yPx = normY * rect.height;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;

    // dotsLayer is absolute inset:0 over targetCanvas. We need dot positions inside image box.
    // targetCanvas centers the image; easiest is to position relative to the image itself:
    // We'll offset by image position within the canvas.
    const imgRect = rect;
    const canvasRect = targetCanvas.getBoundingClientRect();

    const offsetLeft = imgRect.left - canvasRect.left;
    const offsetTop  = imgRect.top  - canvasRect.top;

    dot.style.left = `${offsetLeft + xPx}px`;
    dot.style.top  = `${offsetTop  + yPx}px`;

    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearDots();
    if (!hasImage) return;

    if (bullTap) placeDot(bullTap.x, bullTap.y, "bull");
    taps.forEach(p => placeDot(p.x, p.y, "hole"));
  }

  // ===== Session reset =====
  function resetSession(){
    bullTap = null;
    taps = [];
    setTapCountUI();
    rebuildDots();
    refreshMicroSlot();
    setInstruction();

    if (resultsCard) resultsCard.style.display = "none";
  }

  // ===== Upload wiring =====
  uploadHeroBtn.addEventListener("click", () => {
    // iOS: reset value so picking same image works
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

    // objectURL is fastest on iOS Safari
    const objectUrl = URL.createObjectURL(file);

    targetImg.onload = () => {
      try { URL.revokeObjectURL(objectUrl); } catch {}

      hasImage = true;
      if (targetWrap) targetWrap.style.display = "block";

      // store photo for later steps if needed
      try {
        // If you later need dataURL, do it then. For now, keep it lean.
        sessionStorage.setItem("sczn3_has_photo", "1");
      } catch {}

      resetSession();
    };

    targetImg.onerror = () => {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      instructionLine.textContent = "Photo failed to load. Try again.";
    };

    targetImg.src = objectUrl;
  });

  // ===== Clear taps =====
  if (clearTapsBtn) {
    clearTapsBtn.addEventListener("click", resetSession);
  }

  // ===== Multi-touch guard =====
  function touchState(e){
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 2) {
      multiTouchActive = true;
      return;
    }
    // when pinch ends, suppress the very next click (ghost tap)
    if (touches === 0 && multiTouchActive) {
      suppressClicksUntil = nowMs() + 300;
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", touchState, { passive: true });
  targetCanvas.addEventListener("touchmove",  touchState, { passive: true });
  targetCanvas.addEventListener("touchend",   touchState, { passive: true });
  targetCanvas.addEventListener("touchcancel",touchState, { passive: true });

  // ===== Tap capture =====
  function getNormalizedFromClick(e){
    const rect = targetImg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    // Only accept taps that fall INSIDE the image bounds
    const rect = targetImg.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }

    const p = getNormalizedFromClick(e);

    if (!bullTap) bullTap = p;
    else taps.push(p);

    setTapCountUI();
    rebuildDots();
    refreshMicroSlot();
    setInstruction();
  });

  window.addEventListener("resize", rebuildDots);

  // ===== Results =====
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (taps.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = Number(distanceYdsEl && distanceYdsEl.value ? distanceYdsEl.value : 100);

    // Must exist
    if (typeof window.tapscore !== "function") {
      instructionLine.textContent = "Backend not connected.";
      return;
    }

    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Use backend truth ONLY
      const wind = out && out.directions ? out.directions.windage : "";
      const elev = out && out.directions ? out.directions.elevation : "";

      if (resultsCard) resultsCard.style.display = "block";
      if (rDistance) rDistance.textContent = `${out.distanceYds || distanceYds} yds`;
      if (rTapsUsed) rTapsUsed.textContent = String(out.tapsCount || taps.length);

      if (rWindage) rWindage.textContent = wind || "—";
      if (rElevation) rElevation.textContent = elev || "—";

      if (rScore) rScore.textContent = (out.score && out.score !== "--") ? String(out.score) : "—";

      if (rNote) {
        rNote.textContent =
          wind && elev
            ? `Move POIB to bull: ${wind} + ${elev}.`
            : "Move POIB to bull (direction pending).";
      }

      instructionLine.textContent = "Done.";
      refreshMicroSlot();
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
      if (resultsCard) resultsCard.style.display = "none";
    }
  }

  // ===== Init =====
  // Start clean: no pinch hint until photo exists
  refreshMicroSlot();
  setTapCountUI();
  setInstruction();
})();
