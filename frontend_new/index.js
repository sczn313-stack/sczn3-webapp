// frontend_new/index.js  (FULL CUT/PASTE REPLACEMENT — PINCH-ZOOM ENABLED)
// Goal:
// - Allow 2-finger pinch/zoom for accuracy
// - Keep 1-finger taps working + showing dots
// - Dots stay aligned even when zoomed (we store taps as normalized 0..1 coords)

(() => {
  const photoInput     = document.getElementById("photoInput");
  const img            = document.getElementById("targetImage");
  const wrap           = document.getElementById("targetImageWrap");
  const tapsCountEl    = document.getElementById("tapsCount");
  const clearBtn       = document.getElementById("clearTapsBtn");
  const statusLine     = document.getElementById("statusLine");
  const emptyHint      = document.getElementById("emptyHint");

  const distanceInput  = document.getElementById("distanceInput");
  const vendorInput    = document.getElementById("vendorInput");
  const seeResultsBtn  = document.getElementById("seeResultsBtn");

  // ---- Storage keys ----
  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";
  const SS_TAPS  = "sczn3_taps_v1"; // [{x,y}] normalized 0..1

  // ---- State ----
  let taps = [];

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = String(msg || "");
  }

  function updateCount() {
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function persist() {
    try { sessionStorage.setItem(SS_TAPS, JSON.stringify(taps)); } catch {}
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(SS_TAPS) || "[]";
      const arr = safeJsonParse(raw);
      if (Array.isArray(arr)) taps = arr.filter(p => typeof p?.x === "number" && typeof p?.y === "number");
    } catch {}
  }

  function clearDots() {
    if (!wrap) return;
    wrap.querySelectorAll(".tapDot").forEach((d) => d.remove());
  }

  function addDot(nx, ny) {
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${nx * r.width}px`;
    dot.style.top  = `${ny * r.height}px`;
    wrap.appendChild(dot);
  }

  function redrawDots() {
    if (!wrap || !img || !img.src) return;
    clearDots();
    taps.forEach(p => addDot(p.x, p.y));
  }

  function clearAllTaps() {
    taps = [];
    persist();
    updateCount();
    clearDots();
    setStatus("Taps cleared.");
  }

  // Convert client -> normalized 0..1 relative to wrapper
  function clientToNorm(clientX, clientY) {
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
    return { nx: x / r.width, ny: y / r.height };
  }

  function registerTap(clientX, clientY) {
    if (!img || !img.src) {
      setStatus("Add a photo first.");
      return;
    }
    const m = clientToNorm(clientX, clientY);
    if (!m) return;

    taps.push({ x: m.nx, y: m.ny });
    persist();
    updateCount();
    addDot(m.nx, m.ny);
    setStatus(`Tap registered (${taps.length}).`);
  }

  // ---- Photo ----
  function showPreview(dataUrl) {
    if (!img) return;
    img.src = dataUrl;
    if (emptyHint) emptyHint.textContent = "Photo loaded. Pinch-zoom for precision, then tap holes.";
    setTimeout(() => {
      redrawDots();
      setStatus("Photo loaded. Pinch-zoom for precision, then tap holes.");
    }, 0);
  }

  function handlePhotoChange() {
    const f = photoInput?.files?.[0];
    if (!f) { setStatus("No photo selected."); return; }
    if (!f.type || !f.type.startsWith("image/")) { setStatus("That file is not an image."); return; }

    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || "");
      try { sessionStorage.setItem(SS_PHOTO, dataUrl); } catch {}
      showPreview(dataUrl);
      clearAllTaps(); // new photo = new taps
      setStatus("Photo loaded. Pinch-zoom, then tap holes.");
    };
    r.onerror = () => setStatus("Could not read that photo.");
    r.readAsDataURL(f);
  }

  // ---- Pinch-zoom friendly tap logic ----
  // KEY IDEA:
  // - Allow default browser pinch-zoom (2 fingers) by NOT blanket-preventDefault on multi-touch.
  // - For 1-finger taps, we preventDefault to stop scroll and register tap.
  function onTouchStart(e) {
    if (!e || !e.touches) return;

    // 2+ fingers = let Safari pinch-zoom / pan do its thing
    if (e.touches.length >= 2) return;

    // 1 finger = treat as tap
    const t = e.touches[0];
    if (!t) return;

    e.preventDefault(); // stop scroll hijacking single taps
    registerTap(t.clientX, t.clientY);
  }

  function onPointerDown(e) {
    // If it's a touch pointer with multi-touch pinch, Safari may not send pointer events for both.
    // This handler is best for desktop + some iOS cases.
    // Avoid blocking gestures: only handle primary pointer.
    try {
      if (e && typeof e.isPrimary === "boolean" && !e.isPrimary) return;
      // If user is in a pinch gesture, pointerType may be "touch" but Safari won't mark isPrimary reliably.
      // We'll still allow tap registration.
      e.preventDefault();
    } catch {}
    registerTap(e.clientX, e.clientY);
  }

  function bindTapSurface() {
    if (!wrap) return;

    // IMPORTANT: allow pinch zoom => DO NOT set touch-action:none
    // We'll rely on JS to only preventDefault for 1-finger taps.
    wrap.style.touchAction = "pinch-zoom"; // allows pinch in supporting browsers
    wrap.style.webkitUserSelect = "none";
    wrap.style.userSelect = "none";

    // Touch (iOS)
    wrap.addEventListener("touchstart", onTouchStart, { passive: false });

    // Pointer (desktop + some mobile)
    wrap.addEventListener("pointerdown", onPointerDown, { passive: false });

    // Redraw dots if layout changes
    window.addEventListener("resize", () => setTimeout(redrawDots, 0));
    window.addEventListener("orientationchange", () => setTimeout(redrawDots, 200));
  }

  // ---- See results ----
  function onSeeResults() {
    if (!taps.length) {
      setStatus("Tap at least 1 hole first.");
      return;
    }
    setStatus("Analyzing…");
    persist();

    if (typeof window.sczn3Analyze === "function") {
      window.sczn3Analyze({
        distanceYds: Number(distanceInput?.value || 100),
        vendorLink: String(vendorInput?.value || ""),
        taps
      });
    } else {
      setStatus("Analyze function not loaded.");
    }
  }

  // ---- Init ----
  restore();
  updateCount();
  bindTapSurface();

  // restore photo if present
  try {
    const saved = sessionStorage.getItem(SS_PHOTO);
    if (saved) showPreview(saved);
  } catch {}

  if (photoInput) photoInput.addEventListener("change", handlePhotoChange);
  if (clearBtn) clearBtn.addEventListener("click", clearAllTaps);
  if (seeResultsBtn) seeResultsBtn.addEventListener("click", onSeeResults);

  setStatus("Ready. Tap ADD PHOTO.");
})();
