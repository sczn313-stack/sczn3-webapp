// frontend_new/index.js (FULL REPLACEMENT)
// Tap-n-Score — LOCKED directions (Top=Up, Right=Right) + iOS pinch-safe
// See Results appears only after: bull tap + 2 hole taps (3 total taps)

(() => {
  // ===== Elements (must match index.html IDs) =====
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

  // Results box (NO JSON display)
  const resultsBox = document.getElementById("resultsBox");

  // ===== State =====
  let hasImage = false;
  let bullTap = null; // normalized {x,y}
  let taps = [];      // normalized hole taps

  // Multi-touch guard (2-finger pinch should never create taps)
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // Require bull + N holes before showing See Results
  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 total taps

  // ===== Utilities =====
  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function n(v, fb=0){ const x = Number(v); return Number.isFinite(x) ? x : fb; }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function updateTapCount(){
    const total = taps.length + (bullTap ? 1 : 0);
    if (tapCountEl) tapCountEl.textContent = String(total);
  }

  function clearAllDots(){
    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, kind){
    if (!dotsLayer || !targetImg) return;

    // dotsLayer is positioned over targetCanvas; use targetImg rect for accurate px mapping
    const rect = targetImg.getBoundingClientRect();
    const xPx = normX * rect.width;
    const yPx = normY * rect.height;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;

    // dotsLayer is inset:0 inside targetCanvas; translate relative to image top-left.
    // We need the dot's position relative to dotsLayer, not viewport.
    // Compute image offset inside the canvas:
    const canvasRect = targetCanvas.getBoundingClientRect();
    const offsetX = rect.left - canvasRect.left;
    const offsetY = rect.top - canvasRect.top;

    dot.style.left = `${offsetX + xPx}px`;
    dot.style.top  = `${offsetY + yPx}px`;

    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearAllDots();
    if (!hasImage) return;
    if (bullTap) placeDot(bullTap.x, bullTap.y, "bull");
    for (const p of taps) placeDot(p.x, p.y, "hole");
  }

  function setInstruction(){
    // You asked to hard-wire it on that anchor line only when a target exists.
    if (!instructionLine) return;

    if (!hasImage){
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }

    // No "Target" word (per your request)
    instructionLine.textContent = "Tap bullseye / aim point 1st — then tap bullet holes.";
  }

  // ===== MicroSlot UI (Pinch hint -> See results + vendor CTA) =====
  function clearMicroSlot(){
    if (microSlot) microSlot.innerHTML = "";
  }

  function setMicroPinchHint(){
    clearMicroSlot();
    if (!microSlot) return;

    const pill = document.createElement("div");
    pill.className = "pinchHint";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function setMicroSeeResults(){
    clearMicroSlot();
    if (!microSlot) return;

    const btn = document.createElement("button");
    btn.className = "seeResultsHint";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    // Vendor CTA (only after See results appears)
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
  }

  function refreshMicroSlot(){
    if (!hasImage){
      clearMicroSlot();
      return;
    }
    if (canShowResults()){
      setMicroSeeResults();
    } else {
      // show pinch hint only after at least one tap (you suggested that),
      // but we’ll keep it simple: show pinch hint whenever target exists but results not ready.
      setMicroPinchHint();
    }
  }

  // ===== Session reset =====
  function resetSession(){
    bullTap = null;
    taps = [];
    updateTapCount();
    rebuildDots();
    setInstruction();
    refreshMicroSlot();

    // Results should start empty / hidden (no JSON)
    if (resultsBox) resultsBox.textContent = "";
  }

  // ===== Upload wiring (one hero button -> photoInput) =====
  if (uploadHeroBtn && photoInput){
    uploadHeroBtn.addEventListener("click", () => {
      photoInput.value = ""; // allow re-pick same photo on iOS
      photoInput.click();
    });
  }

  if (photoInput){
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
        resetSession(); // new photo = fresh taps
      };

      targetImg.onerror = () => {
        try { URL.revokeObjectURL(objectUrl); } catch {}
        hasImage = false;
        if (targetWrap) targetWrap.style.display = "none";
        if (instructionLine) instructionLine.textContent = "Photo failed to load. Try again.";
        resetSession();
      };

      targetImg.src = objectUrl;
    });
  }

  // ===== Clear taps button =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", resetSession);
  }

  // ===== Two-finger pinch guard =====
  function onTouchStart(e){
    if (!e.touches) return;
    if (e.touches.length >= 2){
      multiTouchActive = true;
    }
  }
  function onTouchEnd(e){
    if (!e.touches) return;
    if (e.touches.length === 0){
      if (multiTouchActive){
        suppressClicksUntil = nowMs() + 300; // block the “ghost click” after pinch
      }
      multiTouchActive = false;
    }
  }
  function onTouchMove(e){
    if (!e.touches) return;
    if (e.touches.length >= 2){
      multiTouchActive = true;
    }
  }

  if (targetCanvas){
    targetCanvas.addEventListener("touchstart", onTouchStart, { passive: true });
    targetCanvas.addEventListener("touchmove",  onTouchMove,  { passive: true });
    targetCanvas.addEventListener("touchend",   onTouchEnd,   { passive: true });
    targetCanvas.addEventListener("touchcancel",onTouchEnd,   { passive: true });
  }

  // ===== Tap capture =====
  function getNormalizedFromEvent(e){
    const r = targetImg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  if (targetCanvas){
    targetCanvas.addEventListener("click", (e) => {
      if (!hasImage) return;
      if (multiTouchActive) return;
      if (nowMs() < suppressClicksUntil) return;

      // Only accept taps that land ON the image rectangle
      const r = targetImg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;

      const p = getNormalizedFromEvent(e);

      if (!bullTap){
        bullTap = p;
      } else {
        taps.push(p);
      }

      updateTapCount();
      rebuildDots();
      setInstruction();
      refreshMicroSlot();
    });
  }

  // Rebuild dots on resize/orientation change
  window.addEventListener("resize", () => rebuildDots());

  // ===== Direction logic (FULL LOCK) =====
  // Canonical correction direction:
  //   dx = bull.x - poib.x  -> dx>0 RIGHT, dx<0 LEFT
  //   dy = bull.y - poib.y  BUT y grows DOWN in images -> dy>0 means bull is LOWER -> move DOWN
  function directionsFromDeltaImage(dx, dy){
    const windage = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
    const elevation = dy > 0 ? "DOWN" : (dy < 0 ? "UP" : "CENTER");
    return { windage, elevation };
  }

  // ===== See Results (called from green box) =====
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (taps.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = n(distanceYdsEl?.value, 100);

    // Quiet progression: once See Results is tapped, hide instruction & micro slot,
    // then show vendor CTA after results (keeps it clean).
    if (instructionLine) instructionLine.style.display = "none";
    clearMicroSlot();

    try{
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Use backend delta if present; otherwise compute from bull/poib
      const dx = (out && out.delta && typeof out.delta.x === "number")
        ? out.delta.x
        : (out.bullTap.x - out.poib.x);

      const dy = (out && out.delta && typeof out.delta.y === "number")
        ? out.delta.y
        : (out.bullTap.y - out.poib.y);

      const dirs = directionsFromDeltaImage(dx, dy);

      // Show simple shooter-facing result text (NO JSON)
      if (resultsBox){
        resultsBox.textContent =
`Windage:  ${dirs.windage}
Elevation: ${dirs.elevation}

Taps used: ${out.tapsCount ?? taps.length}
Distance:  ${distanceYds} yds`;
      }

      // After results, show vendor CTA in the micro slot
      // (and we do NOT bring back the instruction line)
      setMicroSeeResults(); // this re-adds green button + CTA; you can remove button later if you want
    } catch (e){
      // Restore minimal UI if error
      if (instructionLine){
        instructionLine.style.display = "block";
        instructionLine.textContent = "Error — try again.";
      }
      refreshMicroSlot();
    }
  }

  // ===== Init =====
  // Hide target until photo exists
  if (targetWrap) targetWrap.style.display = "none";
  setInstruction();
  updateTapCount();
  refreshMicroSlot();
})();
