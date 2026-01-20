/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   DEBUG PROOF BUILD — if this runs, you WILL see the stamp and tap count moves.
   Build: PROOF_TNS_2026-01-20_E
============================================================ */

(() => {
  const BUILD = "PROOF_TNS_2026-01-20_E";
  const $ = (id) => document.getElementById(id);

  // Elements (from your HTML)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");

  let selectedFile = null;
  let objectUrl = null;
  let taps = [];

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

  // --- PROOF: this must show immediately if JS is live
  function bootStamp() {
    setInstruction(`${BUILD} • JS LOADED ✅  (Tap anywhere on screen)`);
    setTapCount();
  }

  // --- PROOF: tap ANYWHERE increments count
  function onAnyTap(ev) {
    // Don’t block scrolling; we just want proof
    taps.push({ t: Date.now() });
    setTapCount();
    setInstruction(`${BUILD} • TAP SEEN ✅  Count: ${taps.length}`);
  }

  // --- Normal file loading
  function onFileChange(e) {
    const f = e?.target?.files && e.target.files[0];
    if (!f) {
      selectedFile = null;
      cleanupUrl();
      if (elImg) elImg.removeAttribute("src");
      clearDots();
      hideTarget();
      setInstruction(`${BUILD} • No photo loaded.`);
      return;
    }

    selectedFile = f;
    cleanupUrl();
    objectUrl = URL.createObjectURL(f);

    if (elImg) {
      elImg.onload = () => {
        showTarget();
        setInstruction(`${BUILD} • Loaded image ✅  Now tap anywhere (proof) or on image (later).`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
      setInstruction(`${BUILD} • Loaded image ✅`);
    }
  }

  function onClear() {
    taps = [];
    setTapCount();
    clearDots();
    selectedFile = null;
    cleanupUrl();
    if (elFile) elFile.value = "";
    if (elImg) elImg.removeAttribute("src");
    hideTarget();
    setInstruction(`${BUILD} • Cleared.`);
  }

  function init() {
    bootStamp();

    // Wire proof listeners (capture + bubble, touch + click)
    document.addEventListener("touchstart", onAnyTap, { passive: true, capture: true });
    document.addEventListener("click", onAnyTap, true);

    if (elFile) elFile.addEventListener("change", onFileChange);
    if (elClear) elClear.addEventListener("click", onClear);

    hideTarget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
