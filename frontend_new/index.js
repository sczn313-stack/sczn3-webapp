// frontend_new/index.js (FULL REPLACEMENT)
// Bull-first workflow:
//  - Tap #1 = bull (aim point)
//  - Tap #2+ = bullet holes
// See Results appears only after 3 taps total (bull + 2 holes)
// Pinch zoom allowed; 2-finger pinch will NOT create taps.

(() => {
  // ===== Elements =====
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

  const resultsCard    = document.getElementById("resultsCard");
  const resultsBox     = document.getElementById("resultsBox");

  // ===== Guards =====
  if (!uploadHeroBtn || !photoInput || !targetImg || !targetCanvas || !dotsLayer) {
    // If DOM is missing, fail silently (prevents hard crash on deploy).
    return;
  }

  // ===== Rules =====
  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 taps total

  // ===== State =====
  let hasImage = false;
  let bullTap = null;      // {x,y} normalized 0..1 relative to image
  let holeTaps = [];       // [{x,y}, ...] normalized

  // Pointer/touch suppression to prevent pinch creating taps
  const activePointers = new Set();
  let suppressTapUntilMs = 0;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function totalTaps(){
    return (bullTap ? 1 : 0) + holeTaps.length;
  }

  function canShowResults(){
    return !!bullTap && holeTaps.length >= MIN_HOLES_FOR_RESULTS;
  }

  // ===== UI Helpers =====
  function setTapCount(){
    if (tapCountEl) tapCountEl.textContent = String(totalTaps());
  }

  function hideInstructionUntilPhoto(){
    // Instruction line should NOT be applicable until a target exists
    if (!instructionLine) return;
    if (!hasImage) {
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }
    // Hard-wired instruction (no word "Target")
    instructionLine.textContent = "Tap bullseye or aim point 1st — then tap bullet holes.";
  }

  function clearDots(){
    dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, kind){
    // Place dot over the image precisely, even if image is centered with margins
    const imgRect = targetImg.getBoundingClientRect();
    const layerRect = dotsLayer.getBoundingClientRect();

    const xPx = (imgRect.left - layerRect.left) + (normX * imgRect.width);
    const yPx = (imgRect.top  - layerRect.top ) + (normY * imgRect.height);

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind; // bull/hole
    dot.style.left = `${xPx}px`;
    dot.style.top  = `${yPx}px`;
    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearDots();
    if (!hasImage) return;
    if (bullTap) placeDot(bullTap.x, bullTap.y, "bull");
    for (const p of holeTaps) placeDot(p.x, p.y, "hole");
  }

  function renderMicroSlot(){
    if (!microSlot) return;
    microSlot.innerHTML = "";

    if (!hasImage) return;

    // After first tap, show pinch hint briefly (until results eligible)
    const showPinchHint = !!bullTap && !canShowResults();

    if (showPinchHint){
      const pill = document.createElement("div");
      pill.className = "pinchHint";
      pill.textContent = "Pinch to zoom";
      microSlot.appendChild(pill);
      return;
    }

    if (canShowResults()){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seeResultsHint";
      btn.textContent = "See results";
      btn.addEventListener("click", onSeeResults);
      microSlot.appendChild(btn);

      // Vendor CTA appears when See results appears (if vendor link provided)
      const link = (vendorLinkEl && vendorLinkEl.value ? String(vendorLinkEl.value).trim() : "");
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
    }
  }

  function resetSession(){
    bullTap = null;
    holeTaps = [];
    setTapCount();
    rebuildDots();
    renderMicroSlot();
    hideInstructionUntilPhoto();

    // hide results until computed
    if (resultsCard) resultsCard.style.display = "none";
    if (resultsBox) resultsBox.textContent = "";
  }

  // ===== Upload wiring (Hero -> hidden input) =====
  uploadHeroBtn.addEventListener("click", () => {
    // Allow Camera / Photo Library / Files — no capture attribute on input
    photoInput.value = "";
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")){
      // keep it minimal
      return;
    }

    // Use object URL for speed & reliability
    const url = URL.createObjectURL(file);

    targetImg.onload = () => {
      try { URL.revokeObjectURL(url); } catch {}
      hasImage = true;
      if (targetWrap) targetWrap.style.display = "block";
      resetSession();
    };

    targetImg.onerror = () => {
      try { URL.revokeObjectURL(url); } catch {}
      hasImage = false;
      if (targetWrap) targetWrap.style.display = "none";
      resetSession();
    };

    targetImg.src = url;
  });

  // ===== Clear taps =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => resetSession());
  }

  // ===== Multi-touch suppression (pinch-safe) =====
  // We do NOT block pinch zoom. We just ignore taps when 2+ pointers are active,
  // and suppress a short window after pinch ends (prevents "ghost tap").
  function updateSuppression(){
    if (activePointers.size >= 2){
      // Pinch in progress: ignore taps
      return;
    }
    // When pinch ends (going from 2->1 or 2->0), iOS can fire a click.
    // suppress taps for a beat.
    suppressTapUntilMs = nowMs() + 300;
  }

  targetCanvas.addEventListener("pointerdown", (e) => {
    if (!hasImage) return;
    activePointers.add(e.pointerId);
  });

  targetCanvas.addEventListener("pointerup", (e) => {
    if (!hasImage) return;
    const before = activePointers.size;
    activePointers.delete(e.pointerId);
    if (before >= 2) updateSuppression();
  });

  targetCanvas.addEventListener("pointercancel", (e) => {
    if (!hasImage) return;
    const before = activePointers.size;
    activePointers.delete(e.pointerId);
    if (before >= 2) updateSuppression();
  });

  // ===== Tap capture (click) =====
  // We capture taps relative to the IMAGE rect (not canvas) so zoom/center is safe.
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;

    // If pinch active, or just ended, ignore
    if (activePointers.size >= 2) return;
    if (nowMs() < suppressTapUntilMs) return;

    const imgRect = targetImg.getBoundingClientRect();
    const x = (e.clientX - imgRect.left) / imgRect.width;
    const y = (e.clientY - imgRect.top)  / imgRect.height;

    // must be inside the image
    if (x < 0 || y < 0 || x > 1 || y > 1) return;

    const p = { x: clamp01(x), y: clamp01(y) };

    if (!bullTap) bullTap = p;
    else holeTaps.push(p);

    setTapCount();
    rebuildDots();
    renderMicroSlot();
    hideInstructionUntilPhoto();
  });

  // When layout changes (rotate, zoom UI chrome), re-place dots
  window.addEventListener("resize", () => rebuildDots());

  // ===== Results =====
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (holeTaps.length < MIN_HOLES_FOR_RESULTS) return;

    // Friendly output (NO JSON dump)
    const distanceYds = Number(distanceYdsEl && distanceYdsEl.value ? distanceYdsEl.value : 100) || 100;

    if (resultsCard) resultsCard.style.display = "block";
    if (resultsBox) resultsBox.textContent = "Computing…";

    try{
      const payload = { distanceYds, bullTap, taps: holeTaps };
      const out = await window.tapscore(payload);

      // Delta = bull - POIB (normalized)
      const dx = out && out.delta && typeof out.delta.x === "number" ? out.delta.x : 0;
      const dy = out && out.delta && typeof out.delta.y === "number" ? out.delta.y : 0;

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "UP"    : (dy < 0 ? "DOWN" : "CENTER");

      const lines = [
        `Distance: ${distanceYds} yds`,
        `Taps used: ${out && out.tapsCount ? out.tapsCount : holeTaps.length}`,
        ``,
        `Move POIB to bull: ${windDir} + ${elevDir}`,
      ];

      if (resultsBox) resultsBox.textContent = lines.join("\n");
    } catch (err){
      if (resultsBox) resultsBox.textContent = "Error. Try again.";
    }
  }

  // ===== Vendor link changes should update microSlot once eligible =====
  if (vendorLinkEl){
    vendorLinkEl.addEventListener("input", () => renderMicroSlot());
    vendorLinkEl.addEventListener("change", () => renderMicroSlot());
  }

  // ===== Init =====
  (function init(){
    // Start with target hidden + no instruction applicable
    hasImage = false;
    if (targetWrap) targetWrap.style.display = "none";
    resetSession();
  })();

})();
