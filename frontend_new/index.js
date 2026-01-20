/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Build: TNS_SINGLE_TAP_DOTS_2026-01-20_G

   Fixes:
   - Counts incrementing by 2 (eliminates duplicate touch/click firing)
   - Dots not visible (renders dots on overlay using % positioning)
   - iOS-safe tap capture (pointerdown + touchstart fallback + debounce)

   REQUIRED CSS (minimum):
   - #targetCanvas { position: relative; }
   - #dotsLayer { position:absolute; inset:0; z-index:999; pointer-events:none; }
   - .dot { position:absolute; width/height/background; transform:translate(-50%,-50%); }
============================================================ */

(() => {
  const BUILD = "TNS_SINGLE_TAP_DOTS_2026-01-20_G";
  const $ = (id) => document.getElementById(id);

  // Elements (match your HTML)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elCanvas = $("targetCanvas"); // wrapper around img + dots

  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // { nx, ny } normalized 0..1 within image box

  // Duplicate-event guard (iOS can fire touch + pointer)
  let lastTapAt = 0;

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

  // Keep overlay covering the image area (CSS does most of the work).
  // This function just ensures the overlay is above and present.
  function syncOverlayBasics() {
    if (!elDots) return;
    elDots.style.zIndex = "999";
    elDots.style.pointerEvents = "none";
  }

  // ============================================================
  // FULL REPLACEMENT: drawDot()
  // - Uses % positioning so dots stay aligned on resize/rotate
  // - Centers dot on tap point (CSS should translate -50%,-50%)
  // ============================================================
  function drawDot(nx, ny) {
    if (!elDots) return;

    // Clamp to 0..1 just in case
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${(cx * 100).toFixed(6)}%`;
    dot.style.top  = `${(cy * 100).toFixed(6)}%`;

    elDots.appendChild(dot);
  }

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
      setInstruction(`${BUILD} • No photo loaded. Tap Upload target photo again.`);
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
        requestAnimationFrame(() => {
          syncOverlayBasics();
          setInstruction(`${BUILD} • Loaded: ${f.name}. Tap ON the image to place dots.`);
        });
      };
      elImg.onerror = () => {
        setInstruction(`${BUILD} • Image failed to load. Pick again.`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
      syncOverlayBasics();
      setInstruction(`${BUILD} • Loaded: ${f.name}.`);
    }
  }

  function getClientXY(ev) {
    const t = ev.touches && ev.touches[0];
    return {
      x: t ? t.clientX : ev.clientX,
      y: t ? t.clientY : ev.clientY
    };
  }

  function recordTapFromClientXY(clientX, clientY) {
    if (!selectedFile || !objectUrl || !elImg || !elImg.src) {
      setInstruction(`${BUILD} • Add a photo to begin.`);
      return;
    }

    syncOverlayBasics();

    // Normalize to the IMAGE box (not the wrapper)
    const imgRect = elImg.getBoundingClientRect();
    const localX = clientX - imgRect.left;
    const localY = clientY - imgRect.top;

    // Ignore taps outside the image
    if (localX < 0 || localY < 0 || localX > imgRect.width || localY > imgRect.height) return;

    const nx = imgRect.width ? localX / imgRect.width : 0;
    const ny = imgRect.height ? localY / imgRect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    drawDot(nx, ny);
    setInstruction(`${BUILD} • Tap recorded: ${taps.length}`);
  }

  // SINGLE tap handler (prevents double count)
  function onPointerDown(ev) {
    const now = Date.now();
    if (now - lastTapAt < 250) return;
    lastTapAt = now;

    try {
      ev.preventDefault();
      ev.stopPropagation();
    } catch (_) {}

    const { x, y } = getClientXY(ev);
    recordTapFromClientXY(x, y);
  }

  // Fallback for older browsers (touchstart only, no click)
  function onTouchStartFallback(ev) {
    const now = Date.now();
    if (now - lastTapAt < 250) return;
    lastTapAt = now;

    try {
      ev.preventDefault();
      ev.stopPropagation();
    } catch (_) {}

    const { x, y } = getClientXY(ev);
    recordTapFromClientXY(x, y);
  }

  function bindTapSurface(el) {
    if (!el) return;

    // Prefer pointer events (avoids touch+click double fire)
    el.addEventListener("pointerdown", onPointerDown);

    // Fallback: touchstart ONLY (no click)
    el.addEventListener("touchstart", onTouchStartFallback, { passive: false });
  }

  function onClear() {
    taps = [];
    setTapCount();
    clearDots();

    if (elFile) elFile.value = "";

    selectedFile = null;
    cleanupUrl();
    if (elImg) elImg.removeAttribute("src");

    hideTarget();
    setInstruction(`${BUILD} • Add a photo to begin.`);
  }

  function init() {
    setInstruction(`${BUILD} • Ready. Add a photo to begin.`);
    setTapCount();
    clearDots();
    hideTarget();
    syncOverlayBasics();

    if (elFile) elFile.addEventListener("change", onFileChange);
    if (elClear) elClear.addEventListener("click", onClear);

    // Bind taps to wrapper and image (either one will catch it)
    bindTapSurface(elCanvas);
    bindTapSurface(elImg);

    // Resync on resize/orientation changes (dots are % so no redraw needed)
    window.addEventListener("resize", () => requestAnimationFrame(syncOverlayBasics));
    window.addEventListener("orientationchange", () => requestAnimationFrame(syncOverlayBasics));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
