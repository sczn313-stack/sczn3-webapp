/* ============================================================================
   Tap-n-Score — index.js (FULL REPLACEMENT)
   Uses your actual HTML IDs from index.html:

   Upload:
     #photoInput

   Target:
     #targetWrap
     #targetCanvas
     #targetImg
     #dotsLayer
     #instructionLine

   Controls:
     #tapCount
     #clearTapsBtn
     #distanceYds
     #vendorLink

   NOTE:
   - This file focuses on: upload -> show target -> tap dots -> count -> clear
   - Analyze/calibration modes can be layered on top after taps are stable.
============================================================================ */

(() => {
  const elPhotoInput = document.getElementById("photoInput");
  const elTargetWrap = document.getElementById("targetWrap");
  const elTargetCanvas = document.getElementById("targetCanvas");
  const elTargetImg = document.getElementById("targetImg");
  const elDotsLayer = document.getElementById("dotsLayer");
  const elInstruction = document.getElementById("instructionLine");
  const elTapCount = document.getElementById("tapCount");
  const elClear = document.getElementById("clearTapsBtn");

  // Optional
  const elDistance = document.getElementById("distanceYds");
  const elVendor = document.getElementById("vendorLink");

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // {nx, ny} normalized 0..1 relative to displayed image

  // ----------------------------
  // Helpers
  // ----------------------------
  const setInstruction = (msg) => { if (elInstruction) elInstruction.textContent = msg; };
  const setTapCount = () => { if (elTapCount) elTapCount.textContent = String(taps.length); };

  function cleanupObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch(_) {}
      objectUrl = null;
    }
  }

  function clearDots() {
    if (elDotsLayer) elDotsLayer.innerHTML = "";
  }

  function addDotAt(nx, ny) {
    if (!elDotsLayer || !elTargetImg) return;

    // Position within the rendered image box (not natural image size)
    const rect = elTargetImg.getBoundingClientRect();
    const x = rect.width * nx;
    const y = rect.height * ny;

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    elDotsLayer.appendChild(dot);
  }

  // ----------------------------
  // Shield: prevent picker from opening when tapping target
  // (Even if some CSS overlay leaks, we stop it here too)
  // ----------------------------
  function shieldTargetFromUpload() {
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    [elTargetCanvas, elTargetImg].forEach((el) => {
      if (!el) return;
      el.addEventListener("click", stop, true);
      el.addEventListener("pointerdown", stop, true);
      el.addEventListener("touchstart", stop, { capture: true, passive: false });
    });
  }

  // ----------------------------
  // Upload handling (iOS-safe)
  // ----------------------------
  function showTarget() {
    if (elTargetWrap) elTargetWrap.style.display = "block";
  }

  function hideTarget() {
    if (elTargetWrap) elTargetWrap.style.display = "none";
  }

  function loadFile(file) {
    selectedFile = file;

    cleanupObjectUrl();
    objectUrl = URL.createObjectURL(file);

    // Show image
    if (elTargetImg) elTargetImg.src = objectUrl;

    // Reset taps for new photo
    taps = [];
    setTapCount();
    clearDots();

    showTarget();
    setInstruction(`Loaded: ${file.name} (${Math.round(file.size / 1024)} KB). Tap to mark points.`);
  }

  function onPick(e) {
    const file = e?.target?.files && e.target.files[0];

    if (!file) {
      setInstruction("No photo loaded. Tap Upload target photo and select again.");
      return;
    }

    loadFile(file);
  }

  // iOS: selecting same file twice often won’t fire change unless we clear value
  function enableSameFileReselect() {
    if (!elPhotoInput) return;
    const clearVal = () => { try { elPhotoInput.value = ""; } catch(_) {} };
    elPhotoInput.addEventListener("click", clearVal);
    elPhotoInput.addEventListener("pointerdown", clearVal);
    elPhotoInput.addEventListener("touchstart", clearVal, { passive: true });
  }

  // ----------------------------
  // Tap capture
  // ----------------------------
  function getClientXY(evt) {
    if (evt.touches && evt.touches[0]) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    return { x: evt.clientX, y: evt.clientY };
  }

  function onTap(evt) {
    if (!selectedFile || !elTargetImg) {
      setInstruction("Add a photo to begin.");
      return;
    }

    // IMPORTANT: stop picker + stop scroll
    evt.preventDefault();
    evt.stopPropagation();

    const { x, y } = getClientXY(evt);
    const rect = elTargetImg.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;

    const nx = rect.width ? localX / rect.width : 0;
    const ny = rect.height ? localY / rect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    addDotAt(nx, ny);
  }

  function wireTapListeners() {
    if (!elTargetImg) return;

    // Use the IMAGE as the tap surface (dotsLayer is pointer-events:none)
    elTargetImg.addEventListener("touchstart", onTap, { passive: false });
    elTargetImg.addEventListener("click", onTap);
    elTargetImg.addEventListener("pointerdown", onTap);
  }

  // ----------------------------
  // Clear
  // ----------------------------
  function onClear() {
    taps = [];
    setTapCount();
    clearDots();

    selectedFile = null;
    cleanupObjectUrl();

    if (elTargetImg) elTargetImg.src = "";
    hideTarget();

    setInstruction("Add a photo to begin.");
  }

  // ----------------------------
  // Boot
  // ----------------------------
  function init() {
    setTapCount();
    hideTarget();
    setInstruction("Add a photo to begin.");

    if (!elPhotoInput) {
      console.warn("Missing #photoInput — upload will not work.");
      return;
    }

    // Upload events
    elPhotoInput.addEventListener("change", onPick);
    elPhotoInput.addEventListener("input", onPick); // iOS sometimes prefers this

    enableSameFileReselect();

    // Taps
    shieldTargetFromUpload();
    wireTapListeners();

    // Clear
    if (elClear) elClear.addEventListener("click", onClear);

    // Optional cleanup/sanity
    if (elDistance && !elDistance.value) elDistance.value = "100";
    if (elVendor) elVendor.addEventListener("blur", () => { elVendor.value = (elVendor.value || "").trim(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
