/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — iOS FILE PICKER FIX
   Primary fix:
   - Listen to BOTH "change" and "input" on #photoInput
   - Load image via FileReader (most reliable on iOS Safari)
   - Fallback to ObjectURL if needed
   - Show on-screen status so we can see where it fails
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elDistance = $("distanceYds");

  if (!elFile || !elImg || !elDots) {
    console.warn("Missing required IDs: photoInput, targetImg, dotsLayer");
    return;
  }

  // ---------- tiny status banner (so we can see progress on iPad)
  const banner = document.createElement("div");
  banner.style.position = "fixed";
  banner.style.left = "10px";
  banner.style.right = "10px";
  banner.style.bottom = "10px";
  banner.style.zIndex = "999999";
  banner.style.padding = "10px 12px";
  banner.style.borderRadius = "10px";
  banner.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  banner.style.fontSize = "14px";
  banner.style.background = "rgba(0,0,0,0.75)";
  banner.style.color = "white";
  banner.style.border = "1px solid rgba(255,255,255,0.12)";
  banner.textContent = "Ready.";
  document.body.appendChild(banner);

  const setBanner = (t) => (banner.textContent = t);

  // Make sure input is usable on iOS
  // (doesn't hurt; helps some pickers)
  elFile.setAttribute("accept", "image/*");

  // ---------- overlay sizing
  function getImgRect() {
    return elImg.getBoundingClientRect();
  }
  function syncOverlaySize() {
    const r = getImgRect();
    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }
  function clearOverlay() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  // ---------- taps state (kept minimal here)
  let bull = null;
  let impacts = [];
  let objectUrl = null;

  function setTapCount() {
    const n = (bull ? 1 : 0) + impacts.length;
    if (elTapCount) elTapCount.textContent = String(n);
  }
  function clearAll() {
    bull = null;
    impacts = [];
    setTapCount();
    clearOverlay();
  }

  if (elClear) elClear.addEventListener("click", clearAll);

  // ---------- iOS-safe image load
  function loadFileToImg(file) {
    if (!file) return;

    setBanner(`Got file: ${file.name || "(no name)"} • ${Math.round(file.size / 1024)} KB`);

    // Reset taps when new image selected
    clearAll();

    // Some iOS cases fail on ObjectURL; FileReader is most reliable
    const reader = new FileReader();

    reader.onerror = () => {
      setBanner("FileReader error. Trying ObjectURL fallback…");

      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        elImg.onload = () => {
          setBanner("Image loaded (ObjectURL).");
          syncOverlaySize();
        };
        elImg.onerror = () => setBanner("Image failed to load (ObjectURL).");
        elImg.src = objectUrl;
        elImg.style.display = "block";
      } catch (e) {
        setBanner("ObjectURL fallback failed.");
        console.warn(e);
      }
    };

    reader.onload = () => {
      const dataUrl = reader.result;
      setBanner("FileReader OK. Setting image src…");

      elImg.onload = () => {
        setBanner("Image loaded (FileReader).");
        syncOverlaySize();
        // Important: do NOT clear src or revoke anything here
      };

      elImg.onerror = () => {
        setBanner("Image failed to load (FileReader).");
      };

      elImg.src = String(dataUrl || "");
      elImg.style.display = "block";
    };

    // Read as DataURL (most compatible)
    reader.readAsDataURL(file);
  }

  function pickFirstFileFromInput() {
    const f = elFile.files && elFile.files[0];
    if (!f) {
      setBanner("No file found on input (files[0] missing).");
      return null;
    }
    return f;
  }

  // Critical: listen to BOTH events
  function onFilePicked(evtName) {
    setBanner(`${evtName} fired. Checking elFile.files…`);
    const f = pickFirstFileFromInput();
    if (!f) return;
    loadFileToImg(f);
  }

  elFile.addEventListener("change", () => onFilePicked("change"));
  elFile.addEventListener("input", () => onFilePicked("input"));

  // In case your UI triggers click on a label/button that swaps nodes,
  // re-bind once after a tick (cheap insurance, no harm)
  setTimeout(() => {
    elFile.addEventListener("change", () => onFilePicked("change(rebind)"));
    elFile.addEventListener("input", () => onFilePicked("input(rebind)"));
  }, 0);

  // ---------- keep overlay aligned
  window.addEventListener("resize", () => {
    syncOverlaySize();
  });

  // Init
  setTapCount();
  syncOverlaySize();
  setBanner("Ready. Tap upload and pick a photo.");
})();
