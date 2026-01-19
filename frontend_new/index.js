// frontend_new/index.js (FULL REPLACEMENT)
// Adds "Test backend" and shows real error text in Results.

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
  const resultsBox = document.getElementById("resultsBox"); // <pre id="resultsBox">

  let hasImage = false;
  let bullTap = null;
  let taps = [];

  let activeTouches = 0;
  let multiTouchActive = false;
  let suppressClicksUntil = 0;

  const MIN_HOLES_FOR_RESULTS = 2;

  function nowMs(){ return Date.now(); }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function canShowResults(){ return !!bullTap && taps.length >= MIN_HOLES_FOR_RESULTS; }

  function setResultsText(lines){
    resultsBox.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  }

  function clearResults(){
    setResultsText("{}");
  }

  function updateTapCount(){
    tapCountEl.textContent = String(taps.length + (bullTap ? 1 : 0));
  }

  function clearAllDots(){ dotsLayer.innerHTML = ""; }

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

  function setInstruction(){
    if (!hasImage) return (instructionLine.textContent = "Add a photo to begin.");
    if (!bullTap) return (instructionLine.textContent = "Tap bull first.");

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

  function setMicroHint(){
    microSlot.innerHTML = "";
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.flexWrap = "wrap";

    const pill = document.createElement("div");
    pill.className = "hintPill";
    pill.textContent = "Pinch to zoom";

    const testBtn = document.createElement("button");
    testBtn.className = "btn btnSecondary btnTight";
    testBtn.type = "button";
    testBtn.textContent = "Test backend";
    testBtn.addEventListener("click", onTestBackend);

    row.appendChild(pill);
    row.appendChild(testBtn);
    microSlot.appendChild(row);
  }

  function setMicroSeeResults(){
    microSlot.innerHTML = "";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.flexWrap = "wrap";

    const btn = document.createElement("button");
    btn.className = "btn btnGreen";
    btn.type = "button";
    btn.textContent = "See results";
    btn.addEventListener("click", onSeeResults);

    const testBtn = document.createElement("button");
    testBtn.className = "btn btnSecondary btnTight";
    testBtn.type = "button";
    testBtn.textContent = "Test backend";
    testBtn.addEventListener("click", onTestBackend);

    row.appendChild(btn);
    row.appendChild(testBtn);

    const link = (vendorLinkEl.value || "").trim();
    if (link) {
      const a = document.createElement("a");
      a.className = "vendorCta";
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Buy more targets like this";
      row.appendChild(a);
    }

    microSlot.appendChild(row);
  }

  function refreshMicroSlot(){
    if (!hasImage) return (microSlot.innerHTML = "");
    if (canShowResults()) setMicroSeeResults();
    else setMicroHint();
  }

  function resetSession(){
    bullTap = null;
    taps = [];
    updateTapCount();
    setInstruction();
    refreshMicroSlot();
    rebuildDots();
    clearResults();
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

  clearTapsBtn.addEventListener("click", resetSession);

  // Touch guard
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

  // Tap capture
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

  window.addEventListener("resize", rebuildDots);

  async function onTestBackend(){
    instructionLine.textContent = "Testing backend…";
    try {
      const out = await window.tapscorePing();
      instructionLine.textContent = "Backend OK.";
      setResultsText([
        "Backend test OK",
        `BACKEND_BASE: ${window.BACKEND_BASE || "(unknown)"}`,
        "",
        JSON.stringify(out, null, 2),
      ]);
    } catch (err) {
      instructionLine.textContent = "Backend test FAILED.";
      setResultsText([
        "Backend test FAILED",
        `BACKEND_BASE: ${window.BACKEND_BASE || "(unknown)"}`,
        "",
        String(err && err.message ? err.message : err),
      ]);
    }
  }

  async function onSeeResults(){
    if (!hasImage) return (instructionLine.textContent = "Add a photo first.");
    if (!bullTap) return (instructionLine.textContent = "Tap bull first.");
    if (taps.length < MIN_HOLES_FOR_RESULTS) return setInstruction();

    const distanceYds = Number(distanceYdsEl.value || 100);
    instructionLine.textContent = "Computing…";

    try {
      const payload = { distanceYds, bullTap, taps };
      const out = await window.tapscore(payload);

      // Show whatever backend returns (no silent failures)
      setResultsText([
        `Distance: ${out.distanceYds ?? distanceYds} yds`,
        `Taps used: ${out.tapsCount ?? taps.length}`,
        `Windage: ${out.windage ?? "(backend not set)"}`,
        `Elevation: ${out.elevation ?? "(backend not set)"}`,
        "",
        JSON.stringify(out, null, 2),
      ]);

      instructionLine.textContent = "Done.";
    } catch (err) {
      instructionLine.textContent = "Error — try again.";
      setResultsText([
        "tapscore FAILED",
        `BACKEND_BASE: ${window.BACKEND_BASE || "(unknown)"}`,
        "",
        String(err && err.message ? err.message : err),
        "",
        "Most common causes:",
        "• Wrong BACKEND_BASE URL",
        "• Backend not deployed / sleeping",
        "• CORS mis-match",
      ]);
    }
  }

  // Init
  refreshMicroSlot();
  updateTapCount();
  setInstruction();
  clearResults();
})();
