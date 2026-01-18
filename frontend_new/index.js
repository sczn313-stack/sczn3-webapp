// frontend_new/index.js  (FULL CUT/PASTE REPLACEMENT)
// Goal: iOS-safe taps that ALWAYS drop visible dots on the image wrapper.
// Works with your current IDs:
// photoInput, targetImage, targetImageWrap, tapsCount, clearTapsBtn,
// seeResultsBtn, vendorInput, distanceInput, statusLine, emptyHint

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

  // ---- Storage keys (keep stable) ----
  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";
  const SS_TAPS  = "sczn3_taps_v1"; // array of {x,y} in IMAGE-NORMALIZED coords (0..1)

  // ---- State ----
  let taps = [];
  let imgRect = null;

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function updateCount() {
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clearDots() {
    if (!wrap) return;
    wrap.querySelectorAll(".tapDot").forEach((d) => d.remove());
  }

  function persist() {
    try {
      sessionStorage.setItem(SS_TAPS, JSON.stringify(taps));
    } catch {}
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(SS_TAPS);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) taps = arr.filter(p => typeof p?.x === "number" && typeof p?.y === "number");
    } catch {}
  }

  // Convert client tap -> (0..1, 0..1) relative to displayed image in wrapper
  function clientToNorm(clientX, clientY) {
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
    return { nx: x / r.width, ny: y / r.height, r };
  }

  function addDotAtClient(clientX, clientY) {
    if (!wrap || !img || !img.src) {
      setStatus("Add a photo first.");
      return;
    }

    const mapped = clientToNorm(clientX, clientY);
    if (!mapped) return;

    const { nx, ny, r } = mapped;

    // store normalized
    taps.push({ x: nx, y: ny });
    persist();
    updateCount();

    // render dot (absolute px in wrapper space)
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${nx * r.width}px`;
    dot.style.top  = `${ny * r.height}px`;
    wrap.appendChild(dot);

    setStatus(`Tap registered (${taps.length}).`);
  }

  function redrawDots() {
    if (!wrap || !img || !img.src) return;
    clearDots();
    const r = wrap.getBoundingClientRect();
    taps.forEach((p) => {
      const dot = document.createElement("div");
      dot.className = "tapDot";
      dot.style.left = `${p.x * r.width}px`;
      dot.style.top  = `${p.y * r.height}px`;
      wrap.appendChild(dot);
    });
  }

  // iOS: MUST use non-passive listener to call preventDefault()
  function onTouchStart(e) {
    if (!e || !e.touches || !e.touches[0]) return;
    e.preventDefault(); // critical
    const t = e.touches[0];
    addDotAtClient(t.clientX, t.clientY);
  }

  function onMouseDown(e) {
    // covers desktop
    addDotAtClient(e.clientX, e.clientY);
  }

  function onPointerDown(e) {
    // covers modern iOS + desktop if supported
    // preventDefault to stop scroll/zoom fighting taps
    try { e.preventDefault(); } catch {}
    addDotAtClient(e.clientX, e.clientY);
  }

  function bindTapSurface() {
    if (!wrap) return;

    // ensure wrapper is tappable
    wrap.style.display = "block";
    wrap.style.pointerEvents = "auto";

    // remove any old listeners (safe re-bind)
    wrap.onmousedown = null;
    wrap.onpointerdown = null;

    // pointer events first (best), then touch fallback
    wrap.addEventListener("pointerdown", onPointerDown, { passive: false });
    wrap.addEventListener("touchstart", onTouchStart, { passive: false });
    wrap.addEventListener("mousedown", onMouseDown, { passive: true });

    // redraw on resize/orientation
    window.addEventListener("resize", () => setTimeout(redrawDots, 0));
    window.addEventListener("orientationchange", () => setTimeout(redrawDots, 200));
  }

  function clearAllTaps() {
    taps = [];
    persist();
    updateCount();
    clearDots();
    setStatus("Taps cleared.");
  }

  function showPreview(dataUrl) {
    if (!img) return;
    img.src = dataUrl;

    if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";

    // Let layout paint, then redraw any restored taps
    setTimeout(() => {
      redrawDots();
      setStatus("Photo loaded. Tap bullet holes.");
    }, 0);
  }

  function handlePhotoChange() {
    if (!photoInput) return;

    const f = photoInput.files && photoInput.files[0];
    if (!f) {
      setStatus("No photo selected.");
      return;
    }
    if (!f.type || !f.type.startsWith("image/")) {
      setStatus("That file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      try { sessionStorage.setItem(SS_PHOTO, dataUrl); } catch {}
      showPreview(dataUrl);
    };
    reader.onerror = () => setStatus("Could not read that photo.");
    reader.readAsDataURL(f);
  }

  // ---- Init ----
  restore();
  updateCount();
  bindTapSurface();

  // restore photo if present
  try {
    const saved = sessionStorage.getItem(SS_PHOTO);
    if (saved && img) showPreview(saved);
  } catch {}

  if (photoInput) photoInput.addEventListener("change", handlePhotoChange);
  if (clearBtn) clearBtn.addEventListener("click", clearAllTaps);

  // OPTIONAL: make "See results" refuse to run with zero taps (prevents scary errors)
  if (seeResultsBtn) {
    seeResultsBtn.addEventListener("click", () => {
      if (!taps.length) {
        setStatus("Tap at least 1 hole first.");
        return;
      }
      setStatus("Analyzing…");
      // api.js should handle the actual call; we just ensure taps are saved
      persist();

      // If api.js exposes a function, call it safely; otherwise do nothing here.
      // (This avoids breaking your existing api.js wiring.)
      if (typeof window.sczn3Analyze === "function") {
        window.sczn3Analyze({
          distanceYds: Number(distanceInput?.value || 100),
          vendorLink: String(vendorInput?.value || ""),
          taps
        });
      }
    });
  }
})();
