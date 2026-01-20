/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Version: TNS_JS_2026-01-20_D

   Fixes:
   - Proves deployment (prints version in instructionLine)
   - Reliable tap capture on iOS (touchstart + pointerdown + click, passive:false)
   - Always increments tapCount and draws dots into dotsLayer
============================================================ */

(() => {
  const VERSION = "TNS_JS_2026-01-20_D";
  const $ = (id) => document.getElementById(id);

  // --- HTML IDs (must exist)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elCanvas = $("targetCanvas");
  const elDistance = $("distanceYds");
  const elVendor = $("vendorLink");

  // --- State
  let selectedFile = null;
  let objectUrl = null;
  let taps = [];

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

  function cleanupUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  // --- File load
  function onFileChange(e) {
    const f = e?.target?.files && e.target.files[0];

    if (!f) {
      selectedFile = null;
      cleanupUrl();
      if (elImg) elImg.removeAttribute("src");

      taps = [];
      setTapCount();
      clearDots();
      hideTarget();
      setInstruction(`${VERSION} • No photo loaded. Tap Upload target photo again.`);
      return;
    }

    selectedFile = f;
    cleanupUrl();
    objectUrl = URL.createObjectURL(f);

    taps = [];
    setTapCount();
    clearDots();

    if (elImg) {
      elImg.onload = () => {
        showTarget();
        setInstruction(`${VERSION} • Loaded: ${f.name} (${Math.round(f.size / 1024)} KB). Tap the target.`);
      };
      elImg.onerror = () => {
        setInstruction(`${VERSION} • Image failed to load. Pick again.`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
      setInstruction(`${VERSION} • Loaded: ${f.name}. Tap the target.`);
    }
  }

  // --- Tap handling
  function getClientXY(ev) {
    const t = ev.touches && ev.touches[0];
    return {
      x: t ? t.clientX : ev.clientX,
      y: t ? t.clientY : ev.clientY
    };
  }

  function addDotAtClientPoint(clientX, clientY) {
    if (!elDots) return;

    const rect = elDots.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Only accept taps inside dotsLayer
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const nx = rect.width ? x / rect.width : 0;
    const ny = rect.height ? y / rect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    setInstruction(`${VERSION} • Tap recorded: ${taps.length}`);

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${nx * rect.width}px`;
    dot.style.top = `${ny * rect.height}px`;
    elDots.appendChild(dot);
  }

  function onTap(ev) {
    // Make sure this handler is actually allowed to run on iOS
    try {
      ev.preventDefault();
      ev.stopPropagation();
    } catch (_) {}

    if (!selectedFile || !objectUrl || !elImg || !elImg.src) {
      setInstruction(`${VERSION} • Add a photo to begin.`);
      return;
    }

    const { x, y } = getClientXY(ev);
    addDotAtClientPoint(x, y);
  }

  function bindTap(el) {
    if (!el) return;

    // iOS: touchstart must be passive:false if we want consistent control
    el.addEventListener("touchstart", onTap, { passive: false });
    el.addEventListener("pointerdown", onTap); // modern iOS supports pointer events
    el.addEventListener("click", onTap);
  }

  // --- Clear
  function onClear() {
    taps = [];
    setTapCount();
    clearDots();

    if (elFile) elFile.value = "";

    selectedFile = null;
    cleanupUrl();

    if (elImg) elImg.removeAttribute("src");
    hideTarget();
    setInstruction(`${VERSION} • Add a photo to begin.`);
  }

  // --- Boot
  function init() {
    // Version stamp = proves the new JS file is actually loaded
    setInstruction(`${VERSION} • Ready. Add a photo to begin.`);
    setTapCount();
    clearDots();
    hideTarget();

    if (elDistance && !elDistance.value) elDistance.value = "100";
    if (elVendor) elVendor.addEventListener("blur", () => {
      elVendor.value = (elVendor.value || "").trim();
    });

    if (elFile) elFile.addEventListener("change", onFileChange);

    if (elClear) elClear.addEventListener("click", onClear);

    // Bind taps to wrapper FIRST (most reliable), then image as fallback
    bindTap(elCanvas);
    bindTap(elImg);

    // IMPORTANT: dotsLayer should NOT block taps; if your CSS sets pointer-events:none, fine.
    // If your CSS accidentally blocks image taps, binding to elCanvas still works.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
