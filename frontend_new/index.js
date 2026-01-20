/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — WORKING UPLOAD + BACKEND-AUTHORITY
   Fixes:
   - Photo upload reliably loads on iOS (File -> ObjectURL -> img.src)
   - Tap 1 = Bull (blue), Tap 2+ = Impacts (orange)
   - No ghost taps (outside-image ignored)
   - No double-binding
   - Backend is ONLY authority for correction directions
   - IMPORTANT: Converts screen-y (down) -> backend-y (up) before POST
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Must-exist IDs (match your existing HTML)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elDistance = $("distanceYds");
  const elTarget = $("targetSelect"); // ok if null

  // Optional result line IDs (if you have them)
  const elWindage = $("windageLine");
  const elElevation = $("elevationLine");

  if (!elFile || !elImg || !elDots) {
    console.warn("Missing required elements. Need: photoInput, targetImg, dotsLayer");
    return;
  }

  // ---- Backend endpoint (override with window.BACKEND_CALC_URL if needed)
  const BACKEND_CALC_URL =
    (window.BACKEND_CALC_URL || window.SCNZ3_BACKEND_CALC_URL || "").trim() || "/api/calc";

  // ---- State
  let objectUrl = null;
  let imgW = 0;
  let imgH = 0;

  // We keep taps in SCREEN coords for drawing:
  // screen: x right+, y down+
  let bull_screen = null;     // {x,y}
  let impacts_screen = [];    // [{x,y}, ...]

  // Backend uses MATH coords:
  // math: x right+, y up+
  // We'll convert screen <-> math using imgH.
  let poib_screen = null;     // {x,y} for drawing
  let lastResult = null;

  function setTapCount() {
    const n = (bull_screen ? 1 : 0) + impacts_screen.length;
    if (elTapCount) elTapCount.textContent = String(n);
  }

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

  function makeDot(x, y, kind) {
    const d = document.createElement("div");
    d.className = `dot dot-${kind}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    // Make dots NON-interactive so taps can't "hit" dots and double-register
    d.style.pointerEvents = "none";
    return d;
  }

  function drawArrow(from, to) {
    const r = getImgRect();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(r.width));
    svg.setAttribute("height", String(r.height));
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.pointerEvents = "none";

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowHead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");

    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M0,0 L8,3 L0,6 Z");
    p.setAttribute("fill", "rgba(80,200,255,0.95)");
    marker.appendChild(p);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke", "rgba(80,200,255,0.85)");
    line.setAttribute("stroke-width", "6");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("marker-end", "url(#arrowHead)");
    svg.appendChild(line);

    elDots.appendChild(svg);
  }

  function redraw() {
    clearOverlay();
    syncOverlaySize();

    // impacts (orange)
    for (const p of impacts_screen) elDots.appendChild(makeDot(p.x, p.y, "impact"));

    // bull (blue)
    if (bull_screen) elDots.appendChild(makeDot(bull_screen.x, bull_screen.y, "bull"));

    // poib (cyan)
    if (poib_screen) elDots.appendChild(makeDot(poib_screen.x, poib_screen.y, "poib"));

    // arrow POIB -> Bull
    if (bull_screen && poib_screen) drawArrow(poib_screen, bull_screen);
  }

  // Convert screen coords -> math coords (backend)
  function screenToMath(pt) {
    return { x: pt.x, y: imgH - pt.y };
  }
  // Convert math coords -> screen coords (display)
  function mathToScreen(pt) {
    return { x: pt.x, y: imgH - pt.y };
  }

  function eventToImagePoint(evt) {
    const r = getImgRect();
    const x = evt.clientX - r.left;
    const y = evt.clientY - r.top;

    // Ignore taps outside the image box (kills stray taps)
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;

    // Convert from displayed size -> natural image pixel space
    // IMPORTANT: your backend expects taps in the SAME space, so we normalize to NATURAL pixels.
    const nx = (x / r.width) * imgW;
    const ny = (y / r.height) * imgH;

    return { x: nx, y: ny };
  }

  async function callBackend() {
    if (!bull_screen || impacts_screen.length < 1) return;

    const distanceYds = Number(elDistance?.value || 100);
    const clickMoa = Number(window.CLICK_MOA || 0.25);

    // inchesPerPixel must come from your target profile (do not guess)
    // If you already set this elsewhere, keep it there.
    const inchesPerPixel = Number(window.INCHES_PER_PIXEL || window.inchesPerPixel || NaN);
    if (!Number.isFinite(inchesPerPixel) || inchesPerPixel <= 0) {
      console.warn("Missing inchesPerPixel (set window.INCHES_PER_PIXEL). Backend will not guess scale.");
      return;
    }

    // Convert to backend (math y-up) before sending
    const bull_math = screenToMath(bull_screen);
    const impacts_math = impacts_screen.map(screenToMath);

    const payload = {
      distanceYds,
      clickMoa,
      inchesPerPixel,
      bull: bull_math,
      impacts: impacts_math
    };

    const res = await fetch(BACKEND_CALC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    lastResult = data;

    if (!data?.ok) {
      console.warn("Backend calc failed:", data);
      return;
    }

    // Convert backend POIB (math) -> screen for drawing
    if (data.poib && Number.isFinite(data.poib.x) && Number.isFinite(data.poib.y)) {
      poib_screen = mathToScreen({ x: data.poib.x, y: data.poib.y });
    } else {
      poib_screen = null;
    }

    // FRONTEND DOES NOT DECIDE DIRECTIONS — print backend strings exactly
    if (elWindage && data.ui?.windage) elWindage.textContent = data.ui.windage;
    if (elElevation && data.ui?.elevation) elElevation.textContent = data.ui.elevation;

    redraw();
  }

  function clearAll() {
    bull_screen = null;
    impacts_screen = [];
    poib_screen = null;
    lastResult = null;
    setTapCount();
    clearOverlay();
    if (elWindage) elWindage.textContent = "";
    if (elElevation) elElevation.textContent = "";
  }

  // ---- Upload handling (iOS-safe)
  function onFileChange() {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    // reset taps for new image
    clearAll();

    // use ObjectURL (fast + iOS friendly)
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    // Setting src triggers load
    elImg.src = objectUrl;
  }

  elImg.addEventListener("load", () => {
    // natural pixel dimensions for correct tap scaling
    imgW = elImg.naturalWidth || 0;
    imgH = elImg.naturalHeight || 0;

    // If image didn't load, bail
    if (!imgW || !imgH) {
      console.warn("Image loaded but natural size is 0 — iOS may not have granted access.");
      return;
    }

    syncOverlaySize();
    redraw();

    // Do NOT revoke objectUrl here; iOS Safari can blank the image if revoked too early.
  });

  // ---- Tap handling (bind ONCE)
  function onPointerDown(evt) {
    const p = eventToImagePoint(evt);
    if (!p) return;

    if (!bull_screen) {
      bull_screen = p;
    } else {
      impacts_screen.push(p);
    }

    poib_screen = null; // will re-compute
    setTapCount();
    redraw();

    if (bull_screen && impacts_screen.length >= 1) {
      callBackend().catch((e) => console.warn("callBackend error:", e));
    }
  }

  // dotsLayer should be the tap surface
  elDots.removeEventListener("pointerdown", onPointerDown);
  elDots.addEventListener("pointerdown", onPointerDown, { passive: true });

  // Controls
  elFile.addEventListener("change", onFileChange);
  if (elClear) elClear.addEventListener("click", clearAll);

  window.addEventListener("resize", () => {
    syncOverlaySize();
    redraw();
  });

  // ---- Dot styling: high contrast (no red confusion)
  (function injectDotCSS() {
    const css = `
      .dot { position:absolute; width:18px; height:18px; border-radius:50%;
             transform: translate(-50%, -50%); box-sizing:border-box; }
      .dot-impact { background:#f59a23; border:4px solid #000; }
      .dot-poib   { background:#5de6ff; border:4px solid #000; box-shadow:0 0 10px rgba(93,230,255,0.6); }
      .dot-bull   { background:#0b5cff; border:4px solid #fff; box-shadow:0 0 0 2px #000 inset; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // Init UI
  setTapCount();
  syncOverlaySize();
})();
