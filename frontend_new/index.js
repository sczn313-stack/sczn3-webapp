/* ============================================================================
   Tap-n-Score — index.js (FULL REPLACEMENT)
   Fix: taps not appearing on iOS Safari

   IDs used (must exist in HTML):
     #photoInput
     #targetWrap
     #targetCanvas
     #targetImg
     #dotsLayer
     #instructionLine
     #tapCount
     #clearTapsBtn
     #distanceYds (optional)
     #vendorLink (optional)
============================================================================ */

(() => {
  const elPhotoInput  = document.getElementById("photoInput");
  const elTargetWrap  = document.getElementById("targetWrap");
  const elTargetCanvas= document.getElementById("targetCanvas");
  const elTargetImg   = document.getElementById("targetImg");
  const elDotsLayer   = document.getElementById("dotsLayer");
  const elInstruction = document.getElementById("instructionLine");
  const elTapCount    = document.getElementById("tapCount");
  const elClear       = document.getElementById("clearTapsBtn");

  const elDistance    = document.getElementById("distanceYds");
  const elVendor      = document.getElementById("vendorLink");

  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // { nx, ny } normalized to displayed image box (0..1)
  let imageReady = false;

  const setInstruction = (msg) => { if (elInstruction) elInstruction.textContent = msg; };
  const setTapCount = () => { if (elTapCount) elTapCount.textContent = String(taps.length); };

  function cleanupObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch(_) {}
      objectUrl = null;
    }
  }

  function showTarget() {
    if (elTargetWrap) elTargetWrap.style.display = "block";
  }

  function hideTarget() {
    if (elTargetWrap) elTargetWrap.style.display = "none";
  }

  function clearDots() {
    if (elDotsLayer) elDotsLayer.innerHTML = "";
  }

  function addDot(nx, ny) {
    if (!elDotsLayer || !elTargetImg) return;

    const rect = elTargetImg.getBoundingClientRect();
    const x = rect.width * nx;
    const y = rect.height * ny;

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    elDotsLayer.appendChild(dot);
  }

  function loadFile(file) {
    selectedFile = file;
    imageReady = false;

    cleanupObjectUrl();
    objectUrl = URL.createObjectURL(file);

    // Reset taps
    taps = [];
    setTapCount();
    clearDots();

    if (elTargetImg) {
      elTargetImg.onload = () => {
        imageReady = true;
        // Ensure dots layer is aligned to the image box
        setInstruction(`Loaded: ${file.name}. Tap on the target to add dots.`);
      };
      elTargetImg.onerror = () => {
        imageReady = false;
        setInstruction("Image failed to load. Try selecting the photo again.");
      };
      elTargetImg.src = objectUrl;
    }

    showTarget();
    setInstruction(`Loading: ${file.name}...`);
  }

  function onPick(e) {
    const file = e?.target?.files && e.target.files[0];
    if (!file) {
      setInstruction("No photo loaded. Tap Upload target photo and select again.");
      return;
    }
    loadFile(file);
  }

  // iOS: selecting same file again won’t always fire change unless value is cleared
  function enableSameFileReselect() {
    if (!elPhotoInput) return;
    const clearVal = () => { try { elPhotoInput.value = ""; } catch(_) {} };
    elPhotoInput.addEventListener("click", clearVal);
    elPhotoInput.addEventListener("touchstart", clearVal, { passive: true });
  }

  function getClientXY(evt) {
    if (evt.touches && evt.touches[0]) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    return { x: evt.clientX, y: evt.clientY };
  }

  function onTap(evt) {
    // If the file overlay is still leaking, your tap will never reach this handler.
    // So if this runs, we KNOW the overlay is not blocking taps.
    evt.preventDefault();

    if (!selectedFile) {
      setInstruction("Add a photo to begin.");
      return;
    }
    if (!imageReady) {
      setInstruction("Image still loading… try again in a second.");
      return;
    }
    if (!elTargetImg) return;

    const { x, y } = getClientXY(evt);

    // Normalize taps to the rendered IMAGE box (best for dot placement)
    const imgRect = elTargetImg.getBoundingClientRect();
    const localX = x - imgRect.left;
    const localY = y - imgRect.top;

    // Only accept taps inside the image area
    if (localX < 0 || localY < 0 || localX > imgRect.width || localY > imgRect.height) {
      setInstruction("Tap inside the target image.");
      return;
    }

    const nx = imgRect.width  ? localX / imgRect.width  : 0;
    const ny = imgRect.height ? localY / imgRect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    addDot(nx, ny);

    setInstruction(`Tap recorded: ${taps.length}`);
  }

  function wireTapListeners() {
    if (!elTargetCanvas) return;

    // Tap on the wrapper (works reliably on iOS)
    elTargetCanvas.addEventListener("touchstart", onTap, { passive: false });
    elTargetCanvas.addEventListener("click", onTap);
    elTargetCanvas.addEventListener("pointerdown", onTap);
  }

  function onClear() {
    taps = [];
    setTapCount();
    clearDots();

    selectedFile = null;
    imageReady = false;
    cleanupObjectUrl();

    if (elTargetImg) elTargetImg.src = "";
    hideTarget();
    setInstruction("Add a photo to begin.");
  }

  function init() {
    setTapCount();
    hideTarget();
    setInstruction("Add a photo to begin.");

    if (!elPhotoInput) {
      console.warn("Missing #photoInput");
      return;
    }

    elPhotoInput.addEventListener("change", onPick);
    elPhotoInput.addEventListener("input", onPick); // helps some iOS cases
    enableSameFileReselect();

    wireTapListeners();

    if (elClear) elClear.addEventListener("click", onClear);

    if (elDistance && !elDistance.value) elDistance.value = "100";
    if (elVendor) elVendor.addEventListener("blur", () => {
      elVendor.value = (elVendor.value || "").trim();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
