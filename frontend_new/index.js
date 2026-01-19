// frontend_new/index.js (FULL REPLACEMENT)
// Safari-proof upload: FileReader first, objectURL fallback
// See Results appears only after: bull tap + 2 hole taps (3 total taps)

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
  const resultsBox = document.getElementById("resultsBox");

  // State
  let hasImage = false;
  let bullTap = null; // {x,y} normalized
  let taps = [];      // bullet taps normalized

  // Multi-touch guard (2-finger pinch should never create taps)
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // Require bull + N holes before showing See Results
  const MIN_HOLES_FOR_RESULTS = 2;

  // Track object URLs so we can revoke
  let lastObjectUrl = null;

  function nowMs() { return Date.now(); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function canShowResults() {
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
  }

  function clearResultsText() {
    if (!resultsBox) return;
    resultsBox.textContent = "{}";
  }

  function setResultsText(obj) {
    if (!resultsBox) return;
    try {
      resultsBox.textContent = JSON.stringify(obj, null, 2);
    } catch {
      resultsBox.textContent = "{}";
    }
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
    const link = (vendorLinkEl?.value || "").trim();
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

  function setInstruction(extra = "") {
    if (!hasImage) {
      instructionLine.textContent = "Add a photo to begin.";
      return;
    }
    if (!bullTap) {
      instructionLine.textContent = extra ? `Tap bull first. ${extra}` : "Tap bull first.";
      return;
    }

    const holesNeeded = Math.max(0, MIN_HOLES_FOR_RESULTS - taps.length);
    if (holesNeeded > 0) {
      instructionLine.textContent =
        holesNeeded === 1
          ? (extra ? `Tap 1 more bullet hole to see results. ${extra}` : "Tap 1 more bullet hole to see results.")
          : (extra ? `Tap ${holesNeeded} more bullet holes to see results. ${extra}` : `Tap ${holesNeeded} more bullet holes to see results.`);
      return;
    }

    instructionLine.textContent = extra ? `Ready — tap See results. ${extra}` : "Ready — tap See results.";
  }

  function resetSession() {
    bullTap = null;
    taps = [];
    updateTapCount();
    clearResultsText();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
  }

  function revokeLastObjectUrl() {
    if (lastObjectUrl) {
      try { URL.revokeObjectURL(lastObjectUrl); } catch {}
      lastObjectUrl = null;
    }
  }

  // Upload
  uploadHeroBtn.addEventListener("click", () => {
    photoInput.value = "";
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    const name = file.name || "photo";
    const type = file.type || "unknown";
    const kb = Math.round((file.size || 0) / 1024);

    // Don’t hard-block HEIC; iOS may give blank type sometimes.
    instructionLine.textContent = "Loading photo…";

    // Ensure we don’t keep old URLs around
    revokeLastObjectUrl();

    // When the image actually loads:
    targetImg.onload = () => {
      hasImage = true;
      targetWrap.style.display = "block";
      resetSession();
      // Show debug info in-line (helps instantly diagnose picker/file issues)
      setInstruction(`Loaded: ${name} • ${type} • ${kb}KB`);
    };

    targetImg.onerror = () => {
      hasImage = false;
      targetWrap.style.display = "none";
      setInstruction("Image failed to load. Try a screenshot image.");
    };

    // SAFARI-PROOF: FileReader first
    try {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is a data URL
        targetImg.src = String(reader.result || "");
      };
      reader.onerror = () => {
        // fallback to objectURL
        try {
          lastObjectUrl = URL.createObjectURL(file);
          targetImg.src = lastObjectUrl;
        } catch {
          setInstruction("Could not open this image. Try a screenshot image.");
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // fallback to objectURL
      try {
        lastObjectUrl = URL.createObjectURL(file);
        targetImg.src = lastObjectUrl;
      } catch {
        setInstruction("Could not open this image. Try a screenshot image.");
      }
    }
  });

  clearTapsBtn.addEventListener("click", () => {
    resetSession();
  });

  // Touch tracking (pinch guard)
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

  async function onSeeResults() {
    if (!hasImage) { setInstruction("Add a photo first."); return; }
    if (!bullTap) { setInstruction("Tap bull first."); return; }
    if (taps.length < MIN_HOLES_FOR_RESULTS) { setInstruction(); return; }

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };

      // Calls backend via api.js (window.tapscore)
      const out = await window.tapscore(payload);

      setResultsText(out);
      instructionLine.textContent = "Done.";
      refreshMicroSlot();
    } catch (err) {
      setResultsText({ error: "See results failed", detail: String(err && err.message ? err.message : err) });
      instructionLine.textContent = "Error — try again.";
    }
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  clearResultsText();
  setInstruction();
})();
