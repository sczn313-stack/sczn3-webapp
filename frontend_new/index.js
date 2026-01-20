/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Build: TNS_SINGLE_TAP_DOTS_2026-01-20_G

   Fixes:
   - Counts incrementing by 2 (eliminates duplicate touch/click firing)
   - Dots not visible (aligns dotsLayer to image using offset geometry)
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

  // Duplicate-event guard
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

  // Align dotsLayer EXACTLY over the rendered image (iOS-safe)
  function syncOverlayToImage() {
    if (!elDots || !elImg || !elCanvas) return;

    // Ensure overlay uses same offset parent as image (targetCanvas)
    // We rely on CSS: .targetCanvas { position: relative; }
    const left = elImg.offsetLeft;
    const top = elImg.offsetTop;
    const w = elImg.offsetWidth;
    const h = elImg.offsetHeight;

    elDots.style.position = "absolute";
    elDots.style.left = `${left}px`;
    elDots.style.top = `${top}px`;
    elDots.style.width = `${w}px`;
    elDots.style.height = `${h}px`;

    // Force visibility above the image
    elDots.style.zIndex = "999";
    elDots.style.pointerEvents = "none";
  }

  function drawDot(nx, ny) {
    if (!elDots) return;

    const w = elDots.clientWidth;
    const h = elDots.clientHeight;

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${nx * w}px`;
    dot.style.top = `${ny * h}px`;
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
          syncOverlayToImage();
          setInstruction(`${BUILD} • Loaded: ${f.name}. Tap ON the image to place dots.`);
        });
      };
      elImg.onerror = () => {
        setInstruction(`${BUILD} • Image failed to load. Pick again.`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
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

    // Keep overlay aligned (orientation/zoom can change layout)
    syncOverlayToImage();

    const imgRect = elImg.getBoundingClientRect();
    const localX = clientX - imgRect.left;
    const localY = clientY - imgRect.top;

    if (localX < 0 || localY < 0 || localX > imgRect.width || localY > imgRect.height) {
      return; // ignore taps outside the image
    }

    const nx = imgRect.width ? localX / imgRect.width : 0;
    const ny = imgRect.height ? localY / imgRect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    drawDot(nx, ny);
    setInstruction(`${BUILD} • Tap recorded: ${taps.length}`);
  }

  // SINGLE tap handler (prevents double count)
  function onPointerDown(ev) {
    // Debounce duplicates (iOS can fire extra events very close together)
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

  // Fallback for older browsers that don’t support Pointer Events well
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

    // Prefer pointer events only (prevents the touch+click double fire)
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

    if (elFile) elFile.addEventListener("change", onFileChange);
    if (elClear) elClear.addEventListener("click", onClear);

    // Bind taps to the wrapper and the image (either one will catch it)
    bindTapSurface(elCanvas);
    bindTapSurface(elImg);

    // Resync on resize/orientation changes
    window.addEventListener("resize", () => requestAnimationFrame(syncOverlayToImage));
    window.addEventListener("orientationchange", () => requestAnimationFrame(syncOverlayToImage));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
