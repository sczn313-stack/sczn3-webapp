/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Fixes:
   - iOS Safari "file chosen but not loaded" (stores File immediately)
   - Tap dots visible + correctly positioned on top of image
   - Prevents phantom tap layer issues by using dotsLayer coords
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- HTML IDs (must exist)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elDistance = $("distanceYds");
  const elVendor = $("vendorLink");

  // --- State
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // { nx, ny } normalized (0..1)

  // --- UI helpers
  function setInstruction(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(taps.length);
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function showTarget() {
    if (elWrap) elWrap.style.display = "block";
  }

  function hideTarget() {
    if (elWrap) elWrap.style.display = "none";
  }

  // --- File load (iOS safe)
  function onFileChange(e) {
    const f = e?.target?.files && e.target.files[0];

    if (!f) {
      selectedFile = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;

      if (elImg) elImg.removeAttribute("src");
      taps = [];
      setTapCount();
      clearDots();
      hideTarget();
      setInstruction("No photo loaded. Tap Upload target photo again.");
      return;
    }

    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    if (elImg) {
      elImg.onload = () => {
        // after image dimensions settle
        showTarget();
        setInstruction(`Loaded: ${f.name} (${Math.round(f.size / 1024)} KB)`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
      setInstruction(`Loaded: ${f.name}`);
    }

    taps = [];
    setTapCount();
    clearDots();
  }

  // --- Tap handling
  function addDotAtClientPoint(clientX, clientY) {
    if (!elDots || !elImg) return;

    // Use dotsLayer rect as the coordinate system (most reliable)
    const rect = elDots.getBoundingClientRect();

    // Tap must land inside the dotsLayer box
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return; // ignore taps outside image box
    }

    // Normalized
    const nx = rect.width ? x / rect.width : 0;
    const ny = rect.height ? y / rect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    setInstruction(`Tap recorded: ${taps.length}`);

    // Draw dot
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${nx * rect.width}px`;
    dot.style.top = `${ny * rect.height}px`;
    elDots.appendChild(dot);
  }

  function onTap(ev) {
    // only allow taps when an image is truly loaded
    if (!selectedFile || !objectUrl || !elImg?.src) {
      setInstruction("Add a photo to begin.");
      return;
    }

    const t = ev.touches && ev.touches[0];
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    addDotAtClientPoint(clientX, clientY);
  }

  // --- Clear
  function onClear() {
    taps = [];
    setTapCount();
    clearDots();

    // clear input value so iOS allows re-picking same image
    if (elFile) elFile.value = "";

    selectedFile = null;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;

    if (elImg) elImg.removeAttribute("src");
    hideTarget();
    setInstruction("Add a photo to begin.");
  }

  // --- Boot
  function init() {
    // Defaults
    if (elDistance && !elDistance.value) elDistance.value = "100";
    if (elVendor) elVendor.value = (elVendor.value || "").trim();

    setTapCount();
    clearDots();
    hideTarget();
    setInstruction("Add a photo to begin.");

    // Events
    if (elFile) elFile.addEventListener("change", onFileChange);

    if (elClear) elClear.addEventListener("click", onClear);

    // IMPORTANT:
    // Attach taps to the IMAGE and the DOTS layer so it always works.
    // Use {passive:true} for iOS smoothness.
    if (elImg) {
      elImg.addEventListener("touchstart", onTap, { passive: true });
      elImg.addEventListener("click", onTap);
    }
    if (elDots) {
      elDots.addEventListener("touchstart", onTap, { passive: true });
      elDots.addEventListener("click", onTap);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
