// sczn3-webapp/frontend_new/index.js
// FULL FILE REPLACEMENT
// iOS-safe Tap-n-Score tapping:
// - wrapper receives taps (image pointer-events none)
// - preventDefault only for single-finger taps (keeps pinch zoom)
// - click + pointer + touch support
// - exposes taps in a stable way for your existing analyze call

(function () {
  function $(id){ return document.getElementById(id); }

  const imageWrap    = $("targetImageWrap");
  const imageEl      = $("targetImage");
  const tapsCountEl  = $("tapsCount");      // optional
  const clearBtn     = $("clearTapsBtn");   // optional

  // If your "See results" button exists here, keep it:
  const seeBtn       = $("seeResultsBtn");  // optional
  const statusEl     = $("statusLine");     // optional

  // ===== Tap storage (kept global-compatible) =====
  let taps = [];
  window.taps = taps; // for any legacy code expecting window.taps

  function status(msg){
    if (statusEl) statusEl.textContent = String(msg || "");
  }

  function updateCount(){
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function rectForWrap(){
    if (!imageWrap) return null;
    return imageWrap.getBoundingClientRect();
  }

  function clamp(n, min, max){
    return Math.max(min, Math.min(max, n));
  }

  function addMarker(x, y){
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    imageWrap.appendChild(dot);
  }

  function clearMarkers(){
    if (!imageWrap) return;
    imageWrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function pushTap(clientX, clientY){
    if (!imageWrap) return;

    const rect = rectForWrap();
    if (!rect) return;

    // position inside wrapper
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // bounds check
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    // clamp just in case
    x = clamp(x, 0, rect.width);
    y = clamp(y, 0, rect.height);

    // Also store normalized coords (robust across resizes)
    const nx = rect.width  ? (x / rect.width)  : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    taps.push({ x, y, nx, ny });
    window.taps = taps; // keep in sync

    addMarker(x, y);
    updateCount();
  }

  // ===== Event handlers =====
  function onTouchStart(e){
    // allow pinch zoom (multi-touch)
    if (!e.touches || e.touches.length !== 1) return;

    // for single tap, stop the "ghost click"/scroll
    e.preventDefault();

    const t = e.touches[0];
    pushTap(t.clientX, t.clientY);
  }

  function onClick(e){
    // Click fallback (desktop / some iOS cases)
    pushTap(e.clientX, e.clientY);
  }

  function onPointerDown(e){
    // Pointer events work well on modern iOS
    // Only handle primary pointer to avoid weirdness
    if (e.isPrimary === false) return;
    // If it's touch pointer, we can prevent default to avoid double events
    // but do NOT block pinch (pointer pinch is different) — safe to leave alone
    pushTap(e.clientX, e.clientY);
  }

  function clearTaps(){
    taps = [];
    window.taps = taps;
    clearMarkers();
    updateCount();
    status("Cleared.");
  }

  // ===== Bind reliably =====
  function bind(){
    if (!imageWrap){
      // If the page loads before the DOM area exists, retry once
      setTimeout(bind, 50);
      return;
    }

    // Make sure wrapper can receive events
    imageWrap.style.pointerEvents = "auto";
    if (imageEl) imageEl.style.pointerEvents = "none";

    // IMPORTANT: touchstart must be passive:false to allow preventDefault
    imageWrap.addEventListener("touchstart", onTouchStart, { passive: false });

    // Also bind click + pointer for maximum reliability
    imageWrap.addEventListener("click", onClick);
    imageWrap.addEventListener("pointerdown", onPointerDown);

    if (clearBtn){
      clearBtn.addEventListener("click", clearTaps);
      clearBtn.addEventListener("touchstart", (e) => { e.preventDefault(); clearTaps(); }, { passive: false });
    }

    updateCount();
    status("Ready. Add a photo, then tap bullet holes.");
  }

  // ===== OPTIONAL: if you need to block backend calls when no taps =====
  // (This prevents scary red error screens.)
  function guardNoTaps(){
    if (!taps || taps.length === 0){
      alert("Tap at least 1 bullet hole before results.");
      return false;
    }
    return true;
  }

  if (seeBtn){
    seeBtn.addEventListener("click", (e) => {
      if (!guardNoTaps()){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Let your existing pipeline run.
      // (We are only guarding the empty case here.)
    });
  }

  // ===== INIT =====
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
