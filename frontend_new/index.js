// frontend_new/index.js (FULL REPLACEMENT)
// - No JSON display
// - Shooter-language directions (DIAL LEFT/RIGHT, DIAL UP/DOWN) + arrows
// - "Corrections move POI to bull" clarification
// - See Results appears only after: bull tap + 2 hole taps (3 total taps)

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

  // If your HTML still has <pre id="resultsBox">, we will reuse it as a plain-text results panel.
  const resultsBox = document.getElementById("resultsBox");

  // State
  let hasImage = false;
  let bullTap = null; // {x,y} normalized
  let taps = [];      // bullet taps normalized

  // Multi-touch guard (2-finger pinch should never create taps)
  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  // RULE: require bull + N holes before showing See Results
  const MIN_HOLES_FOR_RESULTS = 2; // bull + 2 holes = 3 total taps

  function nowMs() { return Date.now(); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function canShowResults() {
    return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS;
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

  // Micro-slot UI
  function setMicroHint() {
    microSlot.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "hintPill";
    pill.textContent = "Pinch to zoom";
    microSlot.appendChild(pill);
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

  function refreshMicroSlot() {
    if (!hasImage) {
      microSlot.innerHTML = "";
      return;
    }
    if (canShowResults()) setMicroSeeResults();
    else setMicroHint();
  }

  // Results formatting (no JSON)
  function fmt2(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  function arrowFor(dir) {
    if (dir === "LEFT") return "←";
    if (dir === "RIGHT") return "→";
    if (dir === "UP") return "↑";
    if (dir === "DOWN") return "↓";
    return "•";
  }

  function dialWord(axis, dir) {
    // axis: "WINDAGE" | "ELEVATION"
    if (axis === "WINDAGE") return `DIAL ${dir}`;
    if (axis === "ELEVATION") return `DIAL ${dir}`;
    return dir;
  }

  function setResultsText(lines) {
    if (!resultsBox) return;
    resultsBox.textContent = lines.join("\n");
  }

  function clearResultsText() {
    if (!resultsBox) return;
    resultsBox.textContent = "";
  }

  function resetSession() {
    bullTap = null;
    taps = [];
    updateTapCount();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
    clearResultsText();
  }

  // Upload (Safari-safe)
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

  clearTapsBtn.addEventListener("click", () => {
    resetSession();
  });

  // Touch tracking (pinch guard)
  function handleTouchState(e) {
    activeTouches = e.touches ? e.touches.length : 0;
    if (activeTouches >= 2) {
      multiTouchActive = true;
    } else if (activeTouches === 0) {
      if (multiTouchActive) {
        suppressClicksUntil = nowMs() + 250;
      }
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
    if (!hasImage) {
      instructionLine.textContent = "Add a photo first.";
      return;
    }
    if (!bullTap) {
      instructionLine.textContent = "Tap bull first.";
      return;
    }
    if (taps.length < MIN_HOLES_FOR_RESULTS) {
      setInstruction();
      return;
    }

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Expect backend returns:
      // out.distanceYds, out.tapsCount, out.delta:{x,y}, out.correction_in:{dx,dy} maybe,
      // and out.windage / out.elevation strings like "6.52 LEFT" etc.
      // We'll compute direction from delta if strings are missing.

      const dx = out && out.delta && typeof out.delta.x === "number" ? out.delta.x : 0;
      const dy = out && out.delta && typeof out.delta.y === "number" ? out.delta.y : 0;

      const windDir = dx > 0 ? "RIGHT" : (dx < 0 ? "LEFT" : "CENTER");
      const elevDir = dy > 0 ? "UP" : (dy < 0 ? "DOWN" : "CENTER");

      // Numbers (prefer backend inches if present)
      const cin = out && out.correction_in ? out.correction_in : null;
      const dxIn = cin && typeof cin.dx === "number" ? cin.dx : null;
      const dyIn = cin && typeof cin.dy === "number" ? cin.dy : null;

      const windAmt = out && typeof out.windage === "string" && out.windage.trim() ? out.windage.trim() : null;
      const elevAmt = out && typeof out.elevation === "string" && out.elevation.trim() ? out.elevation.trim() : null;

      // Build human output (NO JSON)
      const lines = [];

      lines.push(`Distance: ${out.distanceYds || distanceYds} yds`);
      lines.push(`Taps used: ${out.tapsCount || taps.length}`);

      // Windage line
      if (windDir === "CENTER") {
        lines.push(`Windage: • CENTER`);
      } else {
        // If backend already provides "6.52 LEFT", use it; otherwise fall back to dxIn if we have it
        const amtText = windAmt ? windAmt : (dxIn !== null ? `${fmt2(Math.abs(dxIn))} ${windDir}` : `${windDir}`);
        lines.push(`Windage: ${arrowFor(windDir)} ${dialWord("WINDAGE", windDir)}  (${amtText})`);
      }

      // Elevation line
      if (elevDir === "CENTER") {
        lines.push(`Elevation: • CENTER`);
      } else {
        const amtText = elevAmt ? elevAmt : (dyIn !== null ? `${fmt2(Math.abs(dyIn))} ${elevDir}` : `${elevDir}`);
        lines.push(`Elevation: ${arrowFor(elevDir)} ${dialWord("ELEVATION", elevDir)}  (${amtText})`);
      }

      lines.push("");
      lines.push("Corrections move POI to bull.");

      setResultsText(lines);

      instructionLine.textContent = "Done.";
      refreshMicroSlot();
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
      setResultsText(["Error computing results."]);
    }
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  setInstruction();
  clearResultsText();
})();
