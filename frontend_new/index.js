/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT)
   - iOS-friendly image load (FileReader)
   - Tap capture: 1st tap = bull (blue), rest = impacts (orange)
   - Computes inchesPerPixel from target width inches / image naturalWidth
   - Calls backend /api/calc and prints backend direction strings
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required
  const elFile = $("photoInput");
  const elImg  = $("targetImg");
  const elDots = $("dotsLayer");

  // Common (optional but expected in your UI)
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elDistance = $("distanceYds");         // input
  const elTargetSel = $("targetSelect") || $("targetPreset") || $("targetSize"); // select (best-effort)
  const elResultsWind = $("windageLine") || $("windageOut") || $("windage");
  const elResultsElev = $("elevationLine") || $("elevationOut") || $("elevation");
  const elWrap = $("targetWrap");

  if (!elFile || !elImg || !elDots) return;

  // ====== CONFIG: set your backend base URL here
  const BACKEND_BASE = "https://sczn3-backend-new.onrender.com";

  // ---- banner
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

  // ---- state (stored in NATURAL IMAGE PIXELS)
  let bull = null;          // {x,y}
  let impacts = [];         // [{x,y}...]

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
    clearOverlay();
    setTapCount();
    writeResults("", "");
    setBanner("Cleared. Tap bull first, then impacts.");
  }

  if (elClear) elClear.addEventListener("click", clearAll);

  function writeResults(w, e) {
    if (elResultsWind) elResultsWind.textContent = w;
    if (elResultsElev) elResultsElev.textContent = e;
  }

  // ---- target profile (width inches) from dropdown text
  function getTargetWidthInches() {
    const v =
      (elTargetSel && (elTargetSel.value || elTargetSel.options?.[elTargetSel.selectedIndex]?.text)) ||
      "";

    const s = String(v).toLowerCase();

    // Add more profiles as needed
    if (s.includes("23") && s.includes("x") && s.includes("23")) return 23;
    if (s.includes("8.5") || s.includes("8½") || s.includes("letter") || s.includes("8.5x11")) return 8.5;
    if (s.includes("11x17")) return 11; // width in landscape-ish assumption; adjust if you use portrait logic
    if (s.includes("12x18")) return 12;

    // Safe default for your current dropdown showing "8.5×11 (Letter)"
    return 8.5;
  }

  // ---- force visibility / layering
  function forceShowImage() {
    elImg.style.display = "block";
    elImg.style.visibility = "visible";
    elImg.style.opacity = "1";
    elImg.style.width = "100%";
    elImg.style.height = "auto";
    elImg.style.maxWidth = "100%";
    elImg.style.position = "relative";
    elImg.style.zIndex = "1";

    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.zIndex = "5";
    elDots.style.pointerEvents = "auto";

    if (elWrap) {
      elWrap.style.display = "block";
      elWrap.style.visibility = "visible";
      elWrap.style.opacity = "1";
      elWrap.style.position = "relative";
    }
  }

  function syncOverlaySize() {
    const r = elImg.getBoundingClientRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  // ---- coordinate conversion
  function clientToNatural(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const nx = (clientX - r.left) * (elImg.naturalWidth / r.width);
    const ny = (clientY - r.top) * (elImg.naturalHeight / r.height);
    return { x: nx, y: ny };
  }

  function naturalToDisplay(n) {
    const r = elImg.getBoundingClientRect();
    const dx = n.x * (r.width / elImg.naturalWidth);
    const dy = n.y * (r.height / elImg.naturalHeight);
    return { x: dx, y: dy };
  }

  function drawDot(naturalPt, kind) {
    const p = naturalToDisplay(naturalPt);

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.width = "14px";
    dot.style.height = "14px";
    dot.style.borderRadius = "50%";
    dot.style.left = `${p.x - 7}px`;
    dot.style.top = `${p.y - 7}px`;

    // bull = blue, impacts = orange
    dot.style.background = kind === "bull" ? "rgba(0,160,255,0.95)" : "rgba(255,140,0,0.95)";
    dot.style.border = "2px solid rgba(255,255,255,0.9)";
    dot.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";

    elDots.appendChild(dot);
  }

  // ---- backend call
  async function callBackend() {
    if (!bull || impacts.length < 1) return;

    const distanceYds = Number(elDistance?.value || 100) || 100;
    const clickMoa = 0.25; // keep your default

    // inchesPerPixel derived from REAL target width / image naturalWidth
    const targetWidthIn = getTargetWidthInches();
    const inchesPerPixel = targetWidthIn / elImg.naturalWidth;

    const body = {
      distanceYds,
      clickMoa,
      inchesPerPixel,
      bull,
      impacts
    };

    try {
      const resp = await fetch(`${BACKEND_BASE}/api/calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data || data.ok !== true) {
        const msg = data?.error || `HTTP ${resp.status}`;
        setBanner(`Backend error: ${msg}`);
        return;
      }

      // Print backend authority strings exactly
      writeResults(data.ui?.windage || "", data.ui?.elevation || "");
      setBanner("Calc OK.");
    } catch (e) {
      setBanner(`Backend error: ${String(e?.message || e)}`);
    }
  }

  // ---- tap handler
  function onTap(ev) {
    if (!elImg.src) return;

    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;

    const n = clientToNatural(clientX, clientY);

    // Clamp to image bounds
    if (n.x < 0 || n.y < 0 || n.x > elImg.naturalWidth || n.y > elImg.naturalHeight) return;

    if (!bull) {
      bull = n;
      drawDot(n, "bull");
      setBanner("Bull set. Tap impacts.");
    } else {
      impacts.push(n);
      drawDot(n, "impact");
      setBanner(`Impact recorded: ${impacts.length}`);
    }

    setTapCount();
    callBackend();
  }

  // Ensure tap layer works
  elDots.addEventListener("click", onTap, { passive: true });
  elDots.addEventListener("touchstart", onTap, { passive: true });

  // ---- file load
  function loadFileToImg(file) {
    if (!file) return;

    clearAll();
    setBanner(`Got file: ${file.name || "(no name)"} • ${Math.round(file.size / 1024)} KB`);

    const reader = new FileReader();
    reader.onerror = () => setBanner("FileReader error.");
    reader.onload = () => {
      elImg.onload = () => {
        forceShowImage();
        syncOverlaySize();
        setBanner("Image loaded. Tap bull first.");
      };
      elImg.onerror = () => setBanner("Image failed to load.");
      elImg.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }

  function handlePick(evtName) {
    const f = elFile.files && elFile.files[0];
    if (!f) {
      setBanner(`${evtName}: No file found on input.`);
      return;
    }
    loadFileToImg(f);
  }

  elFile.addEventListener("change", () => handlePick("change"));
  elFile.addEventListener("input", () => handlePick("input"));

  window.addEventListener("resize", () => {
    syncOverlaySize();
    // re-render dots at new display size
    const savedBull = bull;
    const savedImpacts = impacts.slice();
    clearOverlay();
    if (savedBull) drawDot(savedBull, "bull");
    for (const p of savedImpacts) drawDot(p, "impact");
  });

  setTapCount();
  setBanner("Ready. Upload a photo.");
})();
