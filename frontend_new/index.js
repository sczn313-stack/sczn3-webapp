// sczn3-webapp/frontend_new/index.js (FULL REPLACEMENT)
// Bull-first workflow:
//  - Tap #1 = bull (aim point)
//  - Tap #2+ = bullet holes
//  - "See results" appears only after bull + 2 holes (3 taps total)
//
// UX requirements implemented:
//  - Remove status text under header (we don't use it)
//  - Instruction line is hard-coded but ONLY shows after photo is loaded
//  - Green "See results" button is the ONLY CTA (no bottom button)
//  - Pinch hint shows after FIRST tap, then disappears when See results appears
//  - Vendor CTA appears in micro-slot once See results becomes available
//  - Two-finger pinch never creates taps (multi-touch guard)

(() => {
  // ===== Elements =====
  const uploadHeroBtn  = document.getElementById("uploadHeroBtn");
  const photoInput     = document.getElementById("photoInput");

  const distanceYdsEl  = document.getElementById("distanceYds");
  const clearTapsBtn   = document.getElementById("clearTapsBtn");
  const tapCountEl     = document.getElementById("tapCount");
  const microSlot      = document.getElementById("microSlot");

  const instructionLine= document.getElementById("instructionLine");
  const emptyHint      = document.getElementById("emptyHint");

  const targetWrap     = document.getElementById("targetWrap");
  const targetCanvas   = document.getElementById("targetCanvas");
  const targetImg      = document.getElementById("targetImg");
  const dotsLayer      = document.getElementById("dotsLayer");

  const vendorLinkEl   = document.getElementById("vendorLink");

  const resultsCard    = document.getElementById("resultsCard");
  const rDistance      = document.getElementById("rDistance");
  const rTapsUsed      = document.getElementById("rTapsUsed");
  const rWindage       = document.getElementById("rWindage");
  const rElevation     = document.getElementById("rElevation");
  const rScore         = document.getElementById("rScore");
  const rNote          = document.getElementById("rNote");

  // ===== State =====
  let hasImage = false;
  let bullTap = null;     // {x,y} normalized 0..1
  let holeTaps = [];      // [{x,y}] normalized

  // Rule: bull + 2 holes => show See results
  const MIN_HOLES_FOR_RESULTS = 2;

  // Multi-touch guard
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function totalTaps(){
    return (bullTap ? 1 : 0) + holeTaps.length;
  }

  function canShowResults(){
    return !!bullTap && holeTaps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setTapCount(){
    if (tapCountEl) tapCountEl.textContent = String(totalTaps());
  }

  // ===== Micro-slot rendering =====
  function clearMicroSlot(){
    microSlot.innerHTML = "";
  }

  function renderPinchHint(){
    clearMicroSlot();
    const div = document.createElement("div");
    div.className = "pinchHint";
    div.textContent = "Pinch to zoom";
    microSlot.appendChild(div);
  }

  function renderVendorCTAIfAny(){
    const link = String(vendorLinkEl?.value || "").trim();
    if (!link) return;

    const a = document.createElement("a");
    a.className = "vendorBuyBtn";
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    const icon = document.createElement("div");
    icon.className = "vendorIcon";
    icon.textContent = "🛒";

    const text = document.createElement("div");
    text.className = "vendorText";
    text.textContent = "Buy more targets like this";

    left.appendChild(icon);
    left.appendChild(text);

    const arrow = document.createElement("div");
    arrow.className = "vendorArrow";
    arrow.textContent = "›";

    a.appendChild(left);
    a.appendChild(arrow);

    microSlot.appendChild(a);
  }

  function renderSeeResultsButton(){
    clearMicroSlot();

    const btn = document.createElement("button");
    btn.className = "seeResultsHint";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);

    microSlot.appendChild(btn);

    // Vendor CTA appears in the same area once results are eligible
    renderVendorCTAIfAny();
  }

  function refreshMicroSlot(){
    if (!hasImage) {
      clearMicroSlot();
      return;
    }

    // Pinch hint only after first tap (bull)
    if (!bullTap) {
      clearMicroSlot();
      return;
    }

    // If results eligible, show green button + vendor CTA
    if (canShowResults()) {
      renderSeeResultsButton();
      return;
    }

    // Otherwise show pinch hint
    renderPinchHint();
  }

  // ===== Instruction visibility =====
  function showInstructionsOnImage(){
    if (instructionLine) instructionLine.style.display = "block";
    if (emptyHint) emptyHint.style.display = "none";
  }

  function hideInstructionsNoImage(){
    if (instructionLine) instructionLine.style.display = "none";
    if (emptyHint) emptyHint.style.display = "block";
  }

  // ===== Dots =====
  function clearDots(){
    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, kind){
    // dotsLayer covers the entire targetCanvas.
    // We compute relative to the visible targetImg box.
    const imgRect = targetImg.getBoundingClientRect();
    const layerRect = dotsLayer.getBoundingClientRect();

    const xPx = (imgRect.left - layerRect.left) + (normX * imgRect.width);
    const yPx = (imgRect.top  - layerRect.top ) + (normY * imgRect.height);

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;

    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearDots();
    if (!hasImage) return;

    if (bullTap) placeDot(bullTap.x, bullTap.y, "bull");
    for (const p of holeTaps) placeDot(p.x, p.y, "hole");
  }

  // ===== Reset =====
  function resetSession(){
    bullTap = null;
    holeTaps = [];
    setTapCount();
    clearDots();
    refreshMicroSlot();

    if (resultsCard) resultsCard.style.display = "none";
    if (rDistance) rDistance.textContent = "—";
    if (rTapsUsed) rTapsUsed.textContent = "—";
    if (rWindage) rWindage.textContent = "—";
    if (rElevation) rElevation.textContent = "—";
    if (rScore) rScore.textContent = "—";
    if (rNote) rNote.textContent = "—";
  }

  // ===== Upload: one button =====
  if (uploadHeroBtn && photoInput){
    uploadHeroBtn.addEventListener("click", () => {
      // allow re-select same file on iOS
      photoInput.value = "";
      photoInput.click();
    });
  }

  if (photoInput){
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")){
        alert("Please choose an image file.");
        return;
      }

      const url = URL.createObjectURL(file);

      targetImg.onload = () => {
        URL.revokeObjectURL(url);

        hasImage = true;
        if (targetWrap) targetWrap.style.display = "block";
        showInstructionsOnImage();

        // Store photo (optional, but keeps flow consistent)
        try {
          // Don't store huge base64; just mark that a photo exists
          sessionStorage.setItem("sczn3_has_photo", "1");
        } catch {}

        resetSession();
      };

      targetImg.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Could not load that photo.");
      };

      targetImg.src = url;
    });
  }

  // ===== Clear taps =====
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      if (!hasImage) return;
      resetSession();
    });
  }

  // ===== Multi-touch guard =====
  function touchState(e){
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 2) multiTouchActive = true;
    if (touches === 0 && multiTouchActive){
      // iOS often fires a "click" after pinch ends — block briefly
      suppressClicksUntil = nowMs() + 300;
      multiTouchActive = false;
    }
  }

  if (targetCanvas){
    targetCanvas.addEventListener("touchstart", touchState, { passive:true });
    targetCanvas.addEventListener("touchmove",  touchState, { passive:true });
    targetCanvas.addEventListener("touchend",   touchState, { passive:true });
    targetCanvas.addEventListener("touchcancel",touchState, { passive:true });

    // Click/tap capture
    targetCanvas.addEventListener("click", (e) => {
      if (!hasImage) return;
      if (multiTouchActive) return;
      if (nowMs() < suppressClicksUntil) return;

      // Only count taps that land on the image (not padding)
      const imgRect = targetImg.getBoundingClientRect();
      if (e.clientX < imgRect.left || e.clientX > imgRect.right) return;
      if (e.clientY < imgRect.top  || e.clientY > imgRect.bottom) return;

      const nx = clamp01((e.clientX - imgRect.left) / imgRect.width);
      const ny = clamp01((e.clientY - imgRect.top)  / imgRect.height);

      if (!bullTap){
        bullTap = { x:nx, y:ny };
      } else {
        holeTaps.push({ x:nx, y:ny });
      }

      setTapCount();
      rebuildDots();
      refreshMicroSlot();
    });
  }

  // Keep dots aligned on rotate/resize
  window.addEventListener("resize", () => rebuildDots());

  // Vendor input change can affect micro-slot CTA
  if (vendorLinkEl){
    vendorLinkEl.addEventListener("input", () => refreshMicroSlot());
    vendorLinkEl.addEventListener("change", () => refreshMicroSlot());
  }

  // ===== Results =====
  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (holeTaps.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = Number(distanceYdsEl?.value || 100);

    try{
      // visual feedback: hide button momentarily
      clearMicroSlot();
      const wait = document.createElement("div");
      wait.className = "pinchHint";
      wait.textContent = "Working…";
      microSlot.appendChild(wait);

      const payload = { distanceYds, bullTap, taps: holeTaps };
      const out = await window.tapscore(payload);

      // Show results (friendly, no JSON)
      if (resultsCard) resultsCard.style.display = "block";

      if (rDistance) rDistance.textContent = `${out.distanceYds || distanceYds} yds`;
      if (rTapsUsed) rTapsUsed.textContent = String(out.tapsCount || holeTaps.length);

      // Backend currently returns placeholders; still show direction note from delta.
      const dx = out?.delta?.x;
      const dy = out?.delta?.y;

      const windDir = (typeof dx === "number" && dx !== 0) ? (dx > 0 ? "RIGHT" : "LEFT") : "CENTER";
      const elevDir = (typeof dy === "number" && dy !== 0) ? (dy > 0 ? "UP" : "DOWN") : "CENTER";

      if (rWindage) rWindage.textContent = windDir;
      if (rElevation) rElevation.textContent = elevDir;

      if (rScore) rScore.textContent = "—";

      if (rNote) {
        rNote.textContent = `Move POIB to bull: ${windDir} + ${elevDir}`;
      }

      // After results: show vendor CTA in micro-slot (and keep clean)
      clearMicroSlot();
      renderVendorCTAIfAny();
    } catch(err){
      clearMicroSlot();
      refreshMicroSlot();
      alert("Network/server error. Try again.");
    }
  }

  // ===== Init =====
  hideInstructionsNoImage();
  resetSession();
  refreshMicroSlot();
  setTapCount();
})();
