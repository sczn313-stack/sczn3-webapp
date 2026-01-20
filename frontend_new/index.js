/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Build: TNS_DOTS_2026-01-20_F

   - Loads image reliably on iOS
   - Taps ONLY on the image area count
   - Places visible dots in dotsLayer (pixel-correct)
============================================================ */

(() => {
  const BUILD = "TNS_DOTS_2026-01-20_F";
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

  // --- Ensure dotsLayer matches the rendered image box
  function syncDotsLayerToImage() {
    if (!elDots || !elImg) return;

    // dotsLayer is absolutely positioned inside targetCanvas with padding.
    // We align it exactly to the image's rendered size & position.
    const imgRect = elImg.getBoundingClientRect();
    const canvasRect = elCanvas ? elCanvas.getBoundingClientRect() : null;

    if (!canvasRect) return;

    const left = imgRect.left - canvasRect.left;
    const top = imgRect.top - canvasRect.top;

    elDots.style.left = `${left}px`;
    elDots.style.top = `${top}px`;
    elDots.style.width = `${imgRect.width}px`;
    elDots.style.height = `${imgRect.height}px`;
    elDots.style.right = "auto";
    elDots.style.bottom = "auto";
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
        // wait 1 frame so layout is final, then sync overlay
        requestAnimationFrame(() => {
          syncDotsLayerToImage();
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

  // Taps only count if inside the image
  function onTapImage(ev) {
    if (!selectedFile || !objectUrl || !elImg || !elImg.src) {
      setInstruction(`${BUILD} • Add a photo to begin.`);
      return;
    }

    // Important on iOS: stop the tap from triggering other clickables
    try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}

    // Keep overlay aligned (orientation/zoom can move it)
    syncDotsLayerToImage();

    const { x, y } = getClientXY(ev);

    const imgRect = elImg.getBoundingClientRect();
    const localX = x - imgRect.left;
    const localY = y - imgRect.top;

    if (localX < 0 || localY < 0 || localX > imgRect.width || localY > imgRect.height) {
      // Tap outside image → ignore
      return;
    }

    const nx = imgRect.width ? localX / imgRect.width : 0;
    const ny = imgRect.height ? localY / imgRect.height : 0;

    taps.push({ nx, ny });
    setTapCount();
    drawDot(nx, ny);
    setInstruction(`${BUILD} • Tap recorded: ${taps.length}`);
  }

  function bindTap(el) {
    if (!el) return;
    el.addEventListener("touchstart", onTapImage, { passive: false });
    el.addEventListener("pointerdown", onTapImage);
    el.addEventListener("click", onTapImage);
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

    // Bind taps to the wrapper AND the image to be bulletproof
    bindTap(elCanvas);
    bindTap(elImg);

    // Resync overlay on resize/orientation
    window.addEventListener("resize", () => {
      requestAnimationFrame(syncDotsLayerToImage);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
