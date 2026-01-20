/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT)
   Fixes:
   - Prevents stray/ghost taps (outside image / on UI / on dots)
   - Prevents double-binding (no double counts)
   - Tap 1 = Bull (blue), Tap 2+ = Impacts (orange)
   - POIB = cyan (computed)
   - NO frontend direction logic: prints backend direction strings
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Required element IDs (must exist in index.html)
  const elImg = $("targetImg");           // <img>
  const elWrap = $("targetWrap");         // wrapper around img + overlay
  const elDots = $("dotsLayer");          // overlay layer (positioned over img)
  const elTapCount = $("tapCount");       // tap counter text
  const elClear = $("clearTapsBtn");      // clear button
  const elDistance = $("distanceYds");    // distance input
  const elTargetSel = $("targetSelect");  // optional; if not present, ok

  // Results fields (optional; if not present, ok)
  const elWindage = $("windageLine");
  const elElevation = $("elevationLine");

  // --- Backend URL (set this to your backend service)
  // If you already have a global or existing config, keep it.
  const BACKEND_CALC_URL =
    (window.SCNZ3_BACKEND_CALC_URL || window.BACKEND_CALC_URL || "").trim() ||
    "/api/calc";

  // --- State
  let bull = null;          // {x,y} in IMAGE PIXEL space (relative to displayed image)
  let impacts = [];         // [{x,y}, ...]
  let poib = null;          // computed from backend response
  let lastResult = null;

  // --- Tap mode rules
  // Tap #1 = bull, then impacts forever until Clear.
  function tapsTotal() {
    return (bull ? 1 : 0) + impacts.length;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(tapsTotal());
  }

  // --- Utility: get displayed image rect in page coordinates
  function getImgRect() {
    return elImg.getBoundingClientRect();
  }

  // Convert a pointer event to coordinates relative to the displayed image (0..w, 0..h)
  function getImagePointFromEvent(evt) {
    const r = getImgRect();
    const clientX = evt.clientX;
    const clientY = evt.clientY;

    const x = clientX - r.left;
    const y = clientY - r.top;

    // Inside check
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;

    return { x, y, w: r.width, h: r.height };
  }

  // Create a dot element
  function makeDot({ x, y, kind }) {
    const d = document.createElement("div");
    d.className = `dot dot-${kind}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.dataset.kind = kind;

    // IMPORTANT: prevent taps on dots from creating new taps
    d.style.pointerEvents = "auto";
    d.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    return d;
  }

  // Clear overlay dots/arrows
  function clearOverlay() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  // Draw bull + impacts + (optional) poib + arrow
  function redrawOverlay() {
    clearOverlay();

    // Ensure overlay matches image size
    const r = getImgRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;

    // --- Impacts (orange)
    for (const p of impacts) {
      elDots.appendChild(makeDot({ x: p.x, y: p.y, kind: "impact" }));
    }

    // --- Bull (blue)
    if (bull) {
      elDots.appendChild(makeDot({ x: bull.x, y: bull.y, kind: "bull" }));
    }

    // --- POIB (cyan)
    if (poib) {
      elDots.appendChild(makeDot({ x: poib.x, y: poib.y, kind: "poib" }));
    }

    // --- Arrow (POIB -> Bull)
    if (bull && poib) {
      drawArrow(poib, bull);
    }
  }

  // Arrow drawer (simple SVG overlay)
  function drawArrow(from, to) {
    const r = getImgRect();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "arrowSvg");
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

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 L8,3 L0,6 Z");
    path.setAttribute("fill", "rgba(80,200,255,0.95)");

    marker.appendChild(path);
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

  // --- Backend call (direction authority)
  async function computeResult() {
    if (!bull || impacts.length < 1) return;

    const distanceYds = Number(elDistance?.value || 100);

    // IMPORTANT: inchesPerPixel must come from your target profile.
    // For now, keep your existing system. If you already compute it elsewhere,
    // set window.INCHES_PER_PIXEL before calling.
    const inchesPerPixel =
      Number(window.INCHES_PER_PIXEL || window.inchesPerPixel || NaN);

    // If you don’t have this yet, stop — don’t guess scale.
    if (!Number.isFinite(inchesPerPixel) || inchesPerPixel <= 0) {
      console.warn("Missing inchesPerPixel. Set window.INCHES_PER_PIXEL for this target profile.");
      return;
    }

    const payload = {
      distanceYds,
      clickMoa: Number(window.CLICK_MOA || 0.25),
      inchesPerPixel,
      bull,
      impacts
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

    // Backend returns poib in its own payload
    poib = data.poib ? { x: data.poib.x, y: data.poib.y } : null;

    // Print EXACT backend strings (no frontend direction logic)
    if (elWindage && data.ui?.windage) elWindage.textContent = data.ui.windage;
    if (elElevation && data.ui?.elevation) elElevation.textContent = data.ui.elevation;

    redrawOverlay();
  }

  // --- Tap handler (single binding, strict filtering)
  function onPointerDown(evt) {
    // Only left click / primary touch
    if (evt.button != null && evt.button !== 0) return;

    // If user tapped a dot, ignore (dot handler stops propagation, but double-safety)
    if (evt.target && evt.target.classList && evt.target.classList.contains("dot")) return;

    const p = getImagePointFromEvent(evt);
    if (!p) {
      // Outside the image: IGNORE. This kills stray red markers.
      return;
    }

    // Record tap
    if (!bull) {
      bull = { x: p.x, y: p.y };
    } else {
      impacts.push({ x: p.x, y: p.y });
    }

    setTapCount();

    // Redraw immediately (bull + impacts). POIB/arrow after backend call.
    poib = null;
    redrawOverlay();

    // Compute from backend once we have at least 1 impact
    if (bull && impacts.length >= 1) {
      computeResult().catch((e) => console.warn("computeResult error:", e));
    }
  }

  function clearAll() {
    bull = null;
    impacts = [];
    poib = null;
    lastResult = null;
    setTapCount();
    clearOverlay();
    if (elWindage) elWindage.textContent = "";
    if (elElevation) elElevation.textContent = "";
  }

  // --- Ensure overlay always matches image size after load/resize
  function syncOverlaySize() {
    const r = getImgRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
    redrawOverlay();
  }

  // --- Init (prevent double-binding)
  // Remove any existing handler if hot reloaded / re-initialized
  elDots.removeEventListener("pointerdown", onPointerDown);
  elDots.addEventListener("pointerdown", onPointerDown, { passive: false });

  if (elClear) elClear.addEventListener("click", clearAll);

  if (elImg) {
    elImg.addEventListener("load", syncOverlaySize);
  }
  window.addEventListener("resize", syncOverlaySize);

  // --- Minimal dot styling injection (kills red rings)
  // If you already style dots in CSS, you can delete this block.
  (function injectDotCSS() {
    const css = `
      #dotsLayer { position:absolute; left:0; top:0; pointer-events:auto; }
      .dot { position:absolute; width:16px; height:16px; border-radius:50%;
             transform: translate(-50%, -50%); box-sizing:border-box; }
      .dot-impact { background: #f59a23; border: 4px solid #000; }
      .dot-poib   { background: #5de6ff; border: 4px solid #000; box-shadow: 0 0 10px rgba(93,230,255,0.6); }
      .dot-bull   { background: #0b5cff; border: 4px solid #fff; box-shadow: 0 0 0 2px #000 inset; }
      .arrowSvg { overflow: visible; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // Initial
  setTapCount();
  syncOverlaySize();
})();
