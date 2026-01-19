// frontend_new/index.js (FULL REPLACEMENT)
// Layout: Distance + Clicks above CTA. No "Upload" header.
// See Results appears only after bull + 2 hole taps (3 total taps).
// Multi-touch pinch will NOT create taps.

(() => {
  // Elements
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const photoInput = document.getElementById("photoInput");

  const distanceYdsEl = document.getElementById("distanceYds");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const tapCountEl = document.getElementById("tapCount");

  const windClicksEl = document.getElementById("windClicks");
  const elevClicksEl = document.getElementById("elevClicks");

  const microSlot = document.getElementById("microSlot");

  const targetHeader = document.getElementById("targetHeader");
  const emptyLine = document.getElementById("emptyLine");
  const targetWrap = document.getElementById("targetWrap");
  const targetCanvas = document.getElementById("targetCanvas");
  const targetImg = document.getElementById("targetImg");
  const dotsLayer = document.getElementById("dotsLayer");

  const vendorLinkEl = document.getElementById("vendorLink");

  const resultsCard = document.getElementById("resultsCard");
  const resultsBox = document.getElementById("resultsBox");

  // State
  let hasImage = false;
  let bullTap = null;         // {x,y} normalized
  let taps = [];              // hole taps normalized

  // Multi-touch guard
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // Require bull + 2 holes = 3 taps total
  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function totalTaps(){
    return taps.length + (bullTap ? 1 : 0);
  }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setClickBoxes(windText, elevText){
    windClicksEl.textContent = windText || "—";
    elevClicksEl.textContent = elevText || "—";
  }

  function setMicroEmpty(){
    microSlot.innerHTML = "";
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
    btn.className = "btnGreen";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    const link = (vendorLinkEl.value || "").trim();
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
    if (!hasImage) return setMicroEmpty();

    // Only show pinch hint after bull is placed (your “progressive quietness”)
    if (!bullTap) return setMicroEmpty();

    if (canShowResults()) setMicroSeeResults();
    else setMicroHint();
  }

  function updateTapCount(){
    tapCountEl.textContent = String(totalTaps());
  }

  function clearAllDots(){
    dotsLayer.innerHTML = "";
  }

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

  function resetSession(){
    bullTap = null;
    taps = [];
    updateTapCount();
    rebuildDots();
    refreshMicroSlot();

    // clear click boxes until results
    setClickBoxes("—", "—");

    // hide results
    if (resultsCard) resultsCard.style.display = "none";
    if (resultsBox) resultsBox.textContent = "{}";
  }

  // Upload hero -> file picker (Safari-safe)
  uploadHeroBtn.addEventListener("click", () => {
    photoInput.value = "";
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) return;

    const objectUrl = URL.createObjectURL(file);

    targetImg.onload = () => {
      URL.revokeObjectURL(objectUrl);

      hasImage = true;
      targetWrap.style.display = "block";
      emptyLine.style.display = "none";
      targetHeader.style.display = "block";

      resetSession();
    };

    targetImg.src = objectUrl;
  });

  // Clear taps
  clearTapsBtn.addEventListener("click", () => {
    if (!hasImage) return;
    resetSession();
  });

  // Touch tracking (pinch should not create taps)
  function handleTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) suppressClicksUntil = nowMs() + 260;
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchmove", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchend", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", handleTouchState, { passive: true });

  // Tap handler (click)
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    const p = getNormalizedFromEvent(e);

    if (!bullTap) bullTap = p;
    else taps.push(p);

    updateTapCount();
    rebuildDots();
    refreshMicroSlot();
  });

  window.addEventListener("resize", () => rebuildDots());

  async function onSeeResults(){
    if (!hasImage) return;
    if (!bullTap) return;
    if (taps.length < MIN_HOLES_FOR_RESULTS) return;

    const distanceYds = Number(distanceYdsEl.value || 100);

    try{
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Show result JSON (temporary, until we swap to shooter-language)
      if (resultsBox) resultsBox.textContent = JSON.stringify(out, null, 2);
      if (resultsCard) resultsCard.style.display = "block";

      // If backend returns clicks/directions later, we’ll show them here.
      // For now, show a simple directional placeholder from delta.
      const dx = out?.delta?.x;
      const dy = out?.delta?.y;

      const windDir = (typeof dx === "number")
        ? (dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "CENTER")
        : "—";

      const elevDir = (typeof dy === "number")
        ? (dy > 0 ? "UP" : dy < 0 ? "DOWN" : "CENTER")
        : "—";

      setClickBoxes(windDir, elevDir);

      // After results are shown, keep vendor CTA in the micro slot
      refreshMicroSlot();
    } catch {
      // if backend errors, keep UI clean (no spam)
      if (resultsCard) resultsCard.style.display = "none";
      setClickBoxes("—", "—");
    }
  }

  // Init view
  setClickBoxes("—", "—");
  setMicroEmpty();
})();
