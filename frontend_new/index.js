// frontend_new/index.js (FULL REPLACEMENT)
// Bull-first workflow:
// Tap #1 = bull (aim point)
// Tap #2+ = bullet holes
// See Results appears only after bull + 2 holes (3 total taps)

(() => {
  // DOM
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const photoInput = document.getElementById("photoInput");

  const distanceYdsEl = document.getElementById("distanceYds");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const tapCountEl = document.getElementById("tapCount");

  const microSlot = document.getElementById("microSlot");

  const tapRuleLine = document.getElementById("tapRuleLine");
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
  const rNote = document.getElementById("rNote");

  // State
  let hasImage = false;
  let bullTap = null;   // {x,y} normalized
  let taps = [];        // hole taps normalized

  // Rules
  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 taps total

  // Multi-touch guard
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function totalTapsCount(){
    return (bullTap ? 1 : 0) + taps.length;
  }

  function updateTapCount(){
    tapCountEl.textContent = String(totalTapsCount());
  }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function clearDots(){
    dotsLayer.innerHTML = "";
  }

  function placeDot(normX, normY, cls){
    // Position relative to the image box
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

  function resetSession(){
    bullTap = null;
    taps = [];
    resultsCard.style.display = "none";
    updateTapCount();
    rebuildDots();
    refreshMicroSlot();
  }

  // Micro-slot behavior:
  // - shows NOTHING until target loaded
  // - after first tap (bull), show "Pinch to zoom"
  // - once bull + 2 holes, show "See results" (green) + Vendor CTA
  function refreshMicroSlot(){
    microSlot.innerHTML = "";

    if (!hasImage) return;

    // After first tap only (bull set, no holes yet): show pinch hint
    if (bullTap && taps.length === 0){
      const hint = document.createElement("div");
      hint.className = "hintPill";
      hint.textContent = "Pinch to zoom";
      microSlot.appendChild(hint);
      return;
    }

    // Once eligible: See results + vendor CTA
    if (canShowResults()){
      const btn = document.createElement("button");
      btn.className = "btn btnGreen";
      btn.type = "button";
      btn.textContent = "See results";
      btn.addEventListener("click", onSeeResults);
      microSlot.appendChild(btn);

      const link = String(vendorLinkEl.value || "").trim();
      if (link){
        const a = document.createElement("a");
        a.className = "vendorCta";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Buy more targets like this";
        microSlot.appendChild(a);
      }

      return;
    }

    // Otherwise: nothing (keep it clean)
  }

  // Convert click -> normalized using the IMAGE rect (not canvas rect)
  function getNormalizedFromClick(e){
    const r = targetImg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // Upload (iOS/Safari safe)
  uploadHeroBtn.addEventListener("click", () => {
    // Clear value so selecting same photo fires change on iOS
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
      tapRuleLine.style.display = "block"; // only now

      // Store a copy if you need later
      try {
        // NOTE: objectUrl isn't stable across reloads; leaving storage out keeps it simple
        sessionStorage.setItem("sczn3_distance_yards", String(distanceYdsEl.value || "100"));
      } catch {}

      resetSession();
    };

    targetImg.src = objectUrl;
  });

  // Clear taps
  clearTapsBtn.addEventListener("click", () => {
    resetSession();
  });

  // Multi-touch tracking (2-finger pinch should NOT create taps)
  function handleTouchState(e){
    activeTouches = e.touches ? e.touches.length : 0;

    if (activeTouches >= 2){
      multiTouchActive = true;
    } else if (activeTouches === 0){
      if (multiTouchActive){
        // After a pinch, ignore “ghost click” for a moment
        suppressClicksUntil = nowMs() + 350;
      }
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchmove", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchend", handleTouchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", handleTouchState, { passive: true });

  // Tap capture
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    // Only accept taps when clicking on/over the image area
    const imgRect = targetImg.getBoundingClientRect();
    if (
      e.clientX < imgRect.left || e.clientX > imgRect.right ||
      e.clientY < imgRect.top  || e.clientY > imgRect.bottom
    ) return;

    const p = getNormalizedFromClick(e);

    if (!bullTap){
      bullTap = p;
    } else {
      taps.push(p);
    }

    updateTapCount();
    rebuildDots();
    refreshMicroSlot();
  });

  window.addEventListener("resize", () => rebuildDots());

  // Results
  async function onSeeResults(){
    if (!canShowResults()) return;

    const distanceYds = Number(distanceYdsEl.value || 100);

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // IMPORTANT:
      // out.delta = bull - POIB
      // Browser Y axis: DOWN is positive.
      const dx = out?.delta?.x ?? 0;
      const dy = out?.delta?.y ?? 0;

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "DOWN"  : (dy < 0 ? "UP"   : "CENTER"); // ✅ FIXED

      resultsCard.style.display = "block";
      rDistance.textContent = `${distanceYds} yds`;
      rTapsUsed.textContent = String(out?.tapsCount ?? taps.length);

      // For now we show directions only (click math comes later with real scale)
      rWindage.textContent = windDir;
      rElevation.textContent = elevDir;

      rNote.textContent = `Move POIB to bull: ${windDir} + ${elevDir}`;

      // Keep microSlot showing Vendor CTA (already there) and button remains usable
      refreshMicroSlot();
    } catch (err) {
      resultsCard.style.display = "none";
    }
  }

  // Vendor link changes can affect CTA appearance
  vendorLinkEl.addEventListener("input", () => refreshMicroSlot());
  vendorLinkEl.addEventListener("change", () => refreshMicroSlot());

  // Init
  updateTapCount();
  refreshMicroSlot();
})();
