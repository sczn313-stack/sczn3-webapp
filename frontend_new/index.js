/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — SAFE + AUTO-DETECT
   Fixes:
   - Target/photo preview always loads (file input -> img src)
   - Auto-detects element IDs so it won’t crash if IDs differ
   - No ghost taps (outside image ignored; taps on dots ignored)
   - No double-binding
   - Tap #1 = Bull, Tap #2+ = Impacts
   - Backend is sole direction authority (frontend prints backend strings)
============================================================ */

(() => {
  // ---------- helpers
  const byId = (id) => (id ? document.getElementById(id) : null);

  function pickFirstId(ids) {
    for (const id of ids) {
      const el = byId(id);
      if (el) return el;
    }
    return null;
  }

  function pickFirstSelector(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ---------- auto-detect core elements
  // IMG (preview target/photo)
  const elImg =
    pickFirstId(["targetImg", "photoImg", "previewImg", "imagePreview", "targetImage"]) ||
    pickFirstSelector(["img#targetImg", "img#preview", "img.preview", "img"]);

  // WRAP (positioning container for img + overlay)
  const elWrap =
    pickFirstId(["targetWrap", "imgWrap", "imageWrap", "previewWrap", "canvasWrap"]) ||
    (elImg ? elImg.parentElement : null);

  // OVERLAY layer (absolute positioned)
  let elDots =
    pickFirstId(["dotsLayer", "tapLayer", "overlay", "overlayLayer", "marksLayer"]);

  // If overlay div doesn’t exist, create one (so your target still shows)
  if (!elDots && elWrap) {
    elWrap.style.position = elWrap.style.position || "relative";
    elDots = document.createElement("div");
    elDots.id = "dotsLayer";
    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.right = "0";
    elDots.style.bottom = "0";
    elDots.style.pointerEvents = "auto";
    elWrap.appendChild(elDots);
  }

  // FILE INPUT (so photo selection loads)
  const elFile =
    pickFirstId(["photoInput", "fileInput", "imageInput", "uploadInput"]) ||
    pickFirstSelector(['input[type="file"]']);

  // UI elements (optional)
  const elTapCount = pickFirstId(["tapCount", "tapsCount", "tapCounter"]);
  const elClear = pickFirstId(["clearTapsBtn", "clearBtn", "btnClear"]);
  const elDistance = pickFirstId(["distanceYds", "distance", "yards"]);
  const elWindage = pickFirstId(["windageLine", "windageText", "windage"]);
  const elElevation = pickFirstId(["elevationLine", "elevationText", "elevation"]);

  // If we can’t find the image container, don’t hard crash — but tell you why.
  if (!elImg || !elWrap || !elDots) {
    console.warn("Missing required elements:", {
      elImg: !!elImg,
      elWrap: !!elWrap,
      elDots: !!elDots
    });
    // Still return without breaking the page completely
    return;
  }

  // ---------- backend calc endpoint
  const BACKEND_CALC_URL =
    (window.SCNZ3_BACKEND_CALC_URL || window.BACKEND_CALC_URL || "").trim() ||
    "/api/calc";

  // ---------- state
  let objectUrl = null;
  let bull = null;
  let impacts = [];
  let poib = null;
  let lastResult = null;

  function tapsTotal() {
    return (bull ? 1 : 0) + impacts.length;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(tapsTotal());
  }

  function getImgRect() {
    return elImg.getBoundingClientRect();
  }

  function clearOverlay() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function makeDot({ x, y, kind }) {
    const d = document.createElement("div");
    d.className = `dot dot-${kind}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.dataset.kind = kind;

    // prevent dot taps from creating taps
    d.style.pointerEvents = "auto";
    d.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    return d;
  }

  function syncOverlaySize() {
    const r = getImgRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

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

  function redrawOverlay() {
    clearOverlay();
    syncOverlaySize();

    // impacts first
    for (const p of impacts) elDots.appendChild(makeDot({ x: p.x, y: p.y, kind: "impact" }));

    // bull
    if (bull) elDots.appendChild(makeDot({ x: bull.x, y: bull.y, kind: "bull" }));

    // poib
    if (poib) elDots.appendChild(makeDot({ x: poib.x, y: poib.y, kind: "poib" }));

    // arrow poib -> bull
    if (bull && poib) drawArrow(poib, bull);
  }

  function getImagePointFromEvent(evt) {
    const r = getImgRect();
    const x = evt.clientX - r.left;
    const y = evt.clientY - r.top;

    // ignore taps outside image
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;

    return { x, y };
  }

  async function computeResult() {
    if (!bull || impacts.length < 1) return;

    const distanceYds = Number(elDistance?.value || 100);

    // must be provided by your target profile layer
    const inchesPerPixel = Number(window.INCHES_PER_PIXEL || window.inchesPerPixel || NaN);
    if (!Number.isFinite(inchesPerPixel) || inchesPerPixel <= 0) {
      console.warn("Missing inchesPerPixel. Set window.INCHES_PER_PIXEL for this target.");
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

    poib = data.poib ? { x: data.poib.x, y: data.poib.y } : null;

    // print backend strings exactly
    if (elWindage && data.ui?.windage) elWindage.textContent = data.ui.windage;
    if (elElevation && data.ui?.elevation) elElevation.textContent = data.ui.elevation;

    redrawOverlay();
  }

  function onPointerDown(evt) {
    // ignore if tap is on a dot (double safety)
    if (evt.target?.classList?.contains("dot")) return;

    const p = getImagePointFromEvent(evt);
    if (!p) return; // ignore outside-image taps (kills ghost taps)

    if (!bull) bull = { x: p.x, y: p.y };
    else impacts.push({ x: p.x, y: p.y });

    poib = null;
    setTapCount();
    redrawOverlay();

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

  // ---------- file input -> load into img
  function onFileChange() {
    const f = elFile?.files?.[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.src = objectUrl;

    // reset taps when new image loads
    clearAll();
  }

  // ---------- bind once (no double counts)
  elDots.removeEventListener("pointerdown", onPointerDown);
  elDots.addEventListener("pointerdown", onPointerDown, { passive: true });

  if (elClear) elClear.addEventListener("click", clearAll);
  if (elFile) elFile.addEventListener("change", onFileChange);

  elImg.addEventListener("load", () => {
    syncOverlaySize();
    redrawOverlay();
  });

  window.addEventListener("resize", () => {
    syncOverlaySize();
    redrawOverlay();
  });

  // ---------- dot styling (no red rings)
  (function injectDotCSS() {
    const css = `
      .dot { position:absolute; width:16px; height:16px; border-radius:50%;
             transform: translate(-50%, -50%); box-sizing:border-box; }
      .dot-impact { background:#f59a23; border:4px solid #000; }
      .dot-poib   { background:#5de6ff; border:4px solid #000; box-shadow:0 0 10px rgba(93,230,255,0.6); }
      .dot-bull   { background:#0b5cff; border:4px solid #fff; box-shadow:0 0 0 2px #000 inset; }
      .arrowSvg { overflow: visible; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // initial
  setTapCount();
  syncOverlaySize();
})();
