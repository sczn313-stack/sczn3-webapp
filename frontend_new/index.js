/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — iOS LOAD + FORCE SHOW IMAGE
   Fixes:
   - FileReader load confirmed (your banner shows it)
   - Forces #targetImg to be visible + sized
   - Ensures dotsLayer sits ON TOP of the image
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg  = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");

  // Optional wrappers/messages (if they exist in your HTML)
  const elWrap = $("targetWrap");          // common in your builds
  const elHint = $("instructionLine");     // sometimes used
  const elAddPhotoLine = $("addPhotoLine"); // if you have a “Add a photo” element

  if (!elFile || !elImg || !elDots) return;

  // ---- status banner
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

  // ---- state
  let bull = null;
  let impacts = [];

  function setTapCount() {
    const n = (bull ? 1 : 0) + impacts.length;
    if (elTapCount) elTapCount.textContent = String(n);
  }

  function clearOverlay() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function clearAll() {
    bull = null;
    impacts = [];
    setTapCount();
    clearOverlay();
  }

  if (elClear) elClear.addEventListener("click", clearAll);

  // ---- FORCE VISIBILITY & LAYER ORDER (this is the fix)
  function forceShowImage() {
    // If image was hidden by CSS, override it
    elImg.style.display = "block";
    elImg.style.visibility = "visible";
    elImg.style.opacity = "1";

    // Make sure it actually takes space
    elImg.style.width = "100%";
    elImg.style.height = "auto";
    elImg.style.maxWidth = "100%";

    // Ensure stacking context: image below, dots above
    elImg.style.position = "relative";
    elImg.style.zIndex = "1";

    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.zIndex = "5";
    elDots.style.pointerEvents = "auto";

    // If you have a wrapper, ensure it’s visible
    if (elWrap) {
      elWrap.style.display = "block";
      elWrap.style.visibility = "visible";
      elWrap.style.opacity = "1";
      elWrap.style.position = "relative";
    }

    // Hide “Add a photo…” type message if present
    if (elHint) elHint.textContent = "";
    if (elAddPhotoLine) elAddPhotoLine.style.display = "none";
  }

  function syncOverlaySize() {
    const r = elImg.getBoundingClientRect();
    // dotsLayer should match the displayed image box
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  // ---- load file via FileReader (proven working)
  function loadFileToImg(file) {
    if (!file) return;

    setBanner(`Got file: ${file.name || "(no name)"} • ${Math.round(file.size / 1024)} KB`);
    clearAll();

    const reader = new FileReader();
    reader.onerror = () => setBanner("FileReader error.");
    reader.onload = () => {
      setBanner("FileReader OK. Setting src…");

      elImg.onload = () => {
        forceShowImage();
        syncOverlaySize();
        setBanner("Image loaded (FileReader).");
      };

      elImg.onerror = () => setBanner("Image failed to load.");

      elImg.src = String(reader.result || "");
    };

    reader.readAsDataURL(file);
  }

  function handlePick(evtName) {
    setBanner(`${evtName} fired.`);
    const f = elFile.files && elFile.files[0];
    if (!f) {
      setBanner("No file found on input.");
      return;
    }
    loadFileToImg(f);
  }

  // Listen to both events (iOS)
  elFile.addEventListener("change", () => handlePick("change"));
  elFile.addEventListener("input",  () => handlePick("input"));

  // Keep overlay aligned
  window.addEventListener("resize", () => {
    syncOverlaySize();
  });

  // Init
  setTapCount();
  setBanner("Ready. Upload a photo.");
})();
