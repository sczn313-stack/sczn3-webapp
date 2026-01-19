// frontend_new/index.js (FULL REPLACEMENT)
// Layout version: stats ABOVE CTA, no "Upload" header text.
// Rules:
// - See Results appears only after: bull tap + 2 hole taps (3 total taps)
// - Direction truth lock: RIGHT=RIGHT, LEFT=LEFT, TOP=UP, BOTTOM=DOWN
//   (Backend already flips Y into dyUp; frontend also computes safely if needed.)

(() => {
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
  const resultsBox = document.getElementById("resultsBox");

  const windageReadout = document.getElementById("windageReadout");
  const elevationReadout = document.getElementById("elevationReadout");

  let hasImage = false;
  let bullTap = null; // {x,y} normalized
  let taps = [];      // bullet taps normalized

  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setWindElev(w, e){
    windageReadout.textContent = w || "—";
    elevationReadout.textContent = e || "—";
  }

  function setMicroHint(){
    microSlot.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "hintPill";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function setMicroSeeResults(){
    microSlot.innerHTML = "";

    const btn = document.createElement("button");
    btn.className = "btn btnGreen";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    const link = (vendorLinkEl.value || "").trim();
    if (link) {
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
    if (!hasImage) { microSlot.innerHTML = ""; return; }
    if (canShowResults()) setMicroSeeResults();
    else setMicroHint();
  }

  function updateTapCount(){
    tapCountEl.textContent = String(taps.length + (bullTap ? 1 : 0));
  }

  function clearDots(){ dotsLayer.innerHTML = ""; }

  function placeDot(normX, normY, cls){
    const rect = targetImg.getBoundingClientRect();
    const xPx = normX * rect.width;
    const yPx = normY * rect.height;

    const dot = document.createElement("div");
    dot.className = `dot ${cls}`;
    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;
    dotsLayer.appendChild(dot);
  }

  function rebuildDots(){
    clearDots();
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
    if (!hasImage) { instructionLine.textContent = "Add a photo to begin."; return; }
    if (!bullTap) { instructionLine.textContent = "Tap bullseye or aim point first."; return; }

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
    resultsBox.textContent = "{}";
    setWindElev("—", "—");
    updateTapCount();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
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

  function handleTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) multiTouchActive = true;
    else if (activeTouches === 0) {
      if (multiTouchActive) suppressClicksUntil = nowMs() + 250;
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchmove", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchend", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", handleTouchState, { passive: true });

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

  function dirFromDx(dx){
    if (dx > 0) return "RIGHT";
    if (dx < 0) return "LEFT";
    return "CENTER";
  }

  // dyUp convention: + = UP, - = DOWN
  function dirFromDyUp(dyUp){
    if (dyUp > 0) return "UP";
    if (dyUp < 0) return "DOWN";
    return "CENTER";
  }

  async function onSeeResults(){
    if (!hasImage) { instructionLine.textContent = "Add a photo first."; return; }
    if (!bullTap) { instructionLine.textContent = "Tap bullseye first."; return; }
    if (taps.length < MIN_HOLES_FOR_RESULTS) { setInstruction(); return; }

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Prefer backend truth (already Y-flipped)
      let dx = 0;
      let dyUp = 0;

      if (out && out.delta && typeof out.delta.dx === "number") dx = out.delta.dx;
      if (out && out.delta && typeof out.delta.dyUp === "number") dyUp = out.delta.dyUp;

      // Fallback if backend ever changes:
      if (!out || !out.delta) {
        // POIB average
        const sum = taps.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x:0, y:0 });
        const poib = { x: sum.x / taps.length, y: sum.y / taps.length };
        dx = bullTap.x - poib.x;

        // screenDy = bullY - poibY (down positive), dyUp flips it
        dyUp = -(bullTap.y - poib.y);
      }

      const windDir = dirFromDx(dx);
      const elevDir = dirFromDyUp(dyUp);

      // Show dial directions (move POIB to bull)
      setWindElev(
        windDir === "CENTER" ? "CENTER" : `DIAL ${windDir}`,
        elevDir === "CENTER" ? "CENTER" : `DIAL ${elevDir}`
      );

      // Results box (simple, readable)
      const lines = [];
      lines.push(`Distance: ${distanceYds} yds`);
      lines.push(`Taps used: ${taps.length}`);
      lines.push(`Windage: ${windDir === "CENTER" ? "• CENTER" : (windDir === "LEFT" ? "← DIAL LEFT" : "→ DIAL RIGHT")}`);
      lines.push(`Elevation: ${elevDir === "CENTER" ? "• CENTER" : (elevDir === "DOWN" ? "↓ DIAL DOWN" : "↑ DIAL UP")}`);
      lines.push("");
      lines.push("Corrections move POI to bull.");
      resultsBox.textContent = lines.join("\n");

      instructionLine.textContent = "Done.";
      refreshMicroSlot();
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
    }
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  setInstruction();
  setWindElev("—", "—");
})();
