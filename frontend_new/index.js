// frontend_new/index.js (FULL REPLACEMENT)
// Photo load fixed (ONE input). Bull-first workflow.
// See results appears only after bull + 2 holes (3 total taps).
// Multi-touch guard: 2-finger pinch never creates a tap.

(() => {
  const uploadHeroBtn = document.getElementById("uploadHeroBtn");
  const photoInput = document.getElementById("photoInput");
  const distanceYdsEl = document.getElementById("distanceYds");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const tapCountEl = document.getElementById("tapCount");
  const microSlot = document.getElementById("microSlot");

  const tapLine = document.getElementById("tapLine");
  const emptyHint = document.getElementById("emptyHint");

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
  let bullTap = null; // {x,y} normalized
  let taps = [];      // holes normalized

  // Multi-touch guard
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function canShowResults(){
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function setTapCount(){
    tapCountEl.textContent = String((bullTap ? 1 : 0) + taps.length);
  }

  function clearDots(){
    dotsLayer.innerHTML = "";
  }

  // IMPORTANT: dots are positioned in the *image coordinate space* by using the image's offset in the canvas
  function placeDot(normX, normY, kind){
    const imgRect = targetImg.getBoundingClientRect();
    const canvasRect = targetCanvas.getBoundingClientRect();

    const xPx = (imgRect.left - canvasRect.left) + (normX * imgRect.width);
    const yPx = (imgRect.top  - canvasRect.top)  + (normY * imgRect.height);

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
    for (const p of taps) placeDot(p.x, p.y, "hole");
  }

  function showPinchHint(){
    microSlot.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "pinchHint";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
  }

  function showResultsBtn(){
    microSlot.innerHTML = "";

    const btn = document.createElement("button");
    btn.className = "seeResultsHint";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);
    microSlot.appendChild(btn);

    // Vendor CTA appears once results is available (your sticky moment)
    const link = (vendorLinkEl.value || "").trim();
    if (link){
      const a = document.createElement("a");
      a.className = "vendorBuyBtn";
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `<span class="vendorText">Buy more targets like this</span><span class="vendorArrow">›</span>`;
      microSlot.appendChild(a);
    }
  }

  function refreshMicroSlot(){
    if (!hasImage){
      microSlot.innerHTML = "";
      return;
    }
    if (canShowResults()) showResultsBtn();
    else showPinchHint();
  }

  function resetSession(){
    bullTap = null;
    taps = [];
    resultsCard.style.display = "none";
    setTapCount();
    refreshMicroSlot();
    rebuildDots();
  }

  // ===== Photo picker (FIXED) =====
  uploadHeroBtn.addEventListener("click", () => {
    // clear value so picking same photo works on iOS
    photoInput.value = "";
    photoInput.click();
  });

  // iOS sometimes fires input instead of change reliably
  const onPick = () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);

    targetImg.onload = () => {
      URL.revokeObjectURL(url);

      hasImage = true;
      targetWrap.style.display = "block";
      emptyHint.style.display = "none";
      tapLine.style.display = "block";

      // store the photo for later screens if needed
      try { sessionStorage.setItem("sczn3_targetPhoto_fileName", file.name || "target.jpg"); } catch {}

      resetSession();
      // let iOS layout settle so dots line up
      setTimeout(rebuildDots, 50);
    };

    targetImg.onerror = () => {
      URL.revokeObjectURL(url);
      hasImage = false;
      targetWrap.style.display = "none";
      emptyHint.style.display = "block";
      tapLine.style.display = "none";
      resetSession();
    };

    targetImg.src = url;
  };

  photoInput.addEventListener("change", onPick);
  photoInput.addEventListener("input", onPick);

  clearTapsBtn.addEventListener("click", () => resetSession());

  // ===== Multi-touch guard (pinch zoom) =====
  function touchState(e){
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 2) {
      multiTouchActive = true;
    } else if (touches === 0) {
      if (multiTouchActive) suppressClicksUntil = nowMs() + 250;
      multiTouchActive = false;
    }
  }

  targetCanvas.addEventListener("touchstart", touchState, { passive: true });
  targetCanvas.addEventListener("touchmove", touchState, { passive: true });
  targetCanvas.addEventListener("touchend", touchState, { passive: true });
  targetCanvas.addEventListener("touchcancel", touchState, { passive: true });

  // ===== Tap capture (click only; touches become click unless suppressed) =====
  targetCanvas.addEventListener("click", (e) => {
    if (!hasImage) return;
    if (multiTouchActive) return;
    if (nowMs() < suppressClicksUntil) return;

    const imgRect = targetImg.getBoundingClientRect();
    if (imgRect.width <= 0 || imgRect.height <= 0) return;

    // If click is outside the actual image area, ignore it
    const cx = e.clientX;
    const cy = e.clientY;
    if (cx < imgRect.left || cx > imgRect.right || cy < imgRect.top || cy > imgRect.bottom) return;

    const nx = clamp01((cx - imgRect.left) / imgRect.width);
    const ny = clamp01((cy - imgRect.top) / imgRect.height);

    if (!bullTap) bullTap = { x: nx, y: ny };
    else taps.push({ x: nx, y: ny });

    setTapCount();
    rebuildDots();
    refreshMicroSlot();
  });

  window.addEventListener("resize", () => rebuildDots());

  async function onSeeResults(){
    if (!canShowResults()) return;

    const distanceYds = Number(distanceYdsEl.value || 100);

    try {
      const out = await window.tapscore({ distanceYds, bullTap, taps });

      resultsCard.style.display = "block";
      rDistance.textContent = `${out.distanceYds || distanceYds} yds`;
      rTapsUsed.textContent = String(out.tapsCount || taps.length);

      // Trust backend direction labels (prevents flip)
      rWindage.textContent = out.windage || (out.directions && out.directions.windage) || "—";
      rElevation.textContent = out.elevation || (out.directions && out.directions.elevation) || "—";
      rScore.textContent = out.score || "—";

      rNote.textContent = "Verified direction stage (click math comes next).";
      refreshMicroSlot();
    } catch {
      resultsCard.style.display = "none";
    }
  }

  // Init
  setTapCount();
  refreshMicroSlot();
})();
