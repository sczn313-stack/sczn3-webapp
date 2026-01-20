/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — TAP → BACKEND → POIB/ARROW/CLICKS
   Guarantees:
   - Frontend NEVER decides correction direction (backend is authority)
   - inchesPerPixel derived from target physical inches / displayed pixels
   - Bull / Impacts / POIB visually distinct (shape + ring, not just color)
   - Arrow shows POIB → Bull path
   - iOS-safe image loading + overlay sizing
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required elements (must exist)
  const elFile = $("photoInput");
  const elImg  = $("targetImg");
  const elDots = $("dotsLayer");

  // ---- Optional UI
  const elTapCount   = $("tapCount");
  const elClear      = $("clearTapsBtn");
  const elDistance   = $("distanceYds");
  const elTargetSel  = $("targetSelect") || $("target"); // supports either id
  const elResultsBox = $("resultsBox") || $("results");  // optional wrapper

  // Result line elements (optional; if missing we’ll still show strings in banner)
  const elWindLine = $("windageLine");
  const elElevLine = $("elevationLine");

  const elWrap = $("targetWrap") || elImg?.parentElement;

  if (!elFile || !elImg || !elDots) return;

  // ============================================================
  // API BASE
  // - Can be set without redeploy by using:
  //   ?api=https://YOUR-BACKEND.onrender.com
  // - Or via localStorage key: SCZN3_API_BASE
  // ============================================================
  function getApiBase() {
    const qp = new URLSearchParams(location.search);
    const fromQuery = qp.get("api");
    if (fromQuery) {
      localStorage.setItem("SCZN3_API_BASE", fromQuery);
      return fromQuery.replace(/\/+$/, "");
    }
    const fromLS = localStorage.getItem("SCZN3_API_BASE");
    if (fromLS) return fromLS.replace(/\/+$/, "");
    // Fallback: same origin (works if you reverse-proxy; otherwise set ?api=...)
    return location.origin.replace(/\/+$/, "");
  }

  // ============================================================
  // TARGET PROFILES (physical inches)
  // Add more anytime — frontend will compute inchesPerPixel from displayed size.
  // ============================================================
  const TARGETS = {
    "8.5x11": { wIn: 8.5, hIn: 11 },
    "letter": { wIn: 8.5, hIn: 11 },
    "23x23":  { wIn: 23,  hIn: 23 },
    "12x18":  { wIn: 12,  hIn: 18 },
    "19x25":  { wIn: 19,  hIn: 25 }
  };

  function currentTargetKey() {
    const v = (elTargetSel && elTargetSel.value) ? String(elTargetSel.value) : "8.5x11";
    return v;
  }

  function currentTargetProfile() {
    const k = currentTargetKey();
    return TARGETS[k] || TARGETS["8.5x11"];
  }

  // ============================================================
  // Banner (debug/status)
  // ============================================================
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

  // ============================================================
  // State
  // bull: first tap
  // impacts: remaining taps
  // poib: backend-computed
  // ============================================================
  let bull = null;          // {x,y} in DISPLAY pixels (relative to image box)
  let impacts = [];         // [{x,y},...]
  let poib = null;          // {x,y} from backend (display pixels)
  let lastCalc = null;      // backend response

  // Prevent iOS double-fire on file input (change + input)
  let lastFileSig = "";

  function tapCount() {
    return (bull ? 1 : 0) + impacts.length;
  }

  function setTapCountUI() {
    if (elTapCount) elTapCount.textContent = String(tapCount());
  }

  // ============================================================
  // Overlay: use SVG so we can draw circles + arrow cleanly.
  // dotsLayer can be a div; we’ll inject a single SVG child.
  // ============================================================
  let svg = null;

  function ensureSvg() {
    if (svg && svg.parentElement === elDots) return svg;

    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.display = "block";
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.pointerEvents = "none"; // taps handled on wrapper; SVG is display-only

    elDots.appendChild(svg);
    return svg;
  }

  function clearOverlay() {
    ensureSvg();
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function syncOverlaySize() {
    const r = elImg.getBoundingClientRect();

    // Make wrapper and layers visible/stacked correctly
    elImg.style.display = "block";
    elImg.style.visibility = "visible";
    elImg.style.opacity = "1";
    elImg.style.width = "100%";
    elImg.style.height = "auto";
    elImg.style.maxWidth = "100%";
    elImg.style.position = "relative";
    elImg.style.zIndex = "1";

    if (elWrap) {
      elWrap.style.position = "relative";
      elWrap.style.display = "block";
      elWrap.style.visibility = "visible";
      elWrap.style.opacity = "1";
    }

    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.zIndex = "5";
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
    elDots.style.pointerEvents = "none";

    ensureSvg();
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  }

  // ============================================================
  // Marker styles (distinct by shape + ring)
  // ============================================================
  function drawCircle({ x, y, r, fill, stroke, strokeW }) {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", String(x));
    c.setAttribute("cy", String(y));
    c.setAttribute("r", String(r));
    c.setAttribute("fill", fill);
    c.setAttribute("stroke", stroke);
    c.setAttribute("stroke-width", String(strokeW));
    svg.appendChild(c);
  }

  function drawBull(p) {
    // Bull: dark center + thick white ring (very obvious)
    drawCircle({ x: p.x, y: p.y, r: 9,  fill: "#111", stroke: "#fff", strokeW: 4 });
    drawCircle({ x: p.x, y: p.y, r: 2.5, fill: "#fff", stroke: "#fff", strokeW: 0 });
  }

  function drawImpact(p) {
    // Impact: orange + black ring
    drawCircle({ x: p.x, y: p.y, r: 7.5, fill: "#ff9a2e", stroke: "#000", strokeW: 3 });
  }

  function drawPoib(p) {
    // POIB: cyan + thick black ring
    drawCircle({ x: p.x, y: p.y, r: 8.5, fill: "#4bd3ff", stroke: "#000", strokeW: 4 });
    drawCircle({ x: p.x, y: p.y, r: 2.5, fill: "#000", stroke: "#000", strokeW: 0 });
  }

  function drawArrow(from, to) {
    // Arrow line + head
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke", "#4bd3ff");
    line.setAttribute("stroke-width", "6");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);

    // Arrowhead
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const headLen = 22;
    const baseX = to.x - ux * headLen;
    const baseY = to.y - uy * headLen;

    // perpendicular
    const px = -uy;
    const py = ux;

    const wing = 12;
    const p1 = { x: to.x, y: to.y };
    const p2 = { x: baseX + px * wing, y: baseY + py * wing };
    const p3 = { x: baseX - px * wing, y: baseY - py * wing };

    const tri = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tri.setAttribute("d", `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`);
    tri.setAttribute("fill", "rgba(75,211,255,0.9)");
    tri.setAttribute("stroke", "rgba(0,0,0,0.35)");
    tri.setAttribute("stroke-width", "1");
    svg.appendChild(tri);
  }

  function redrawOverlay() {
    syncOverlaySize();
    clearOverlay();

    // Impacts first
    for (const p of impacts) drawImpact(p);

    // POIB if available
    if (poib) drawPoib(poib);

    // Arrow POIB -> Bull if both exist
    if (poib && bull) drawArrow(poib, bull);

    // Bull last (topmost)
    if (bull) drawBull(bull);

    setTapCountUI();
  }

  // ============================================================
  // Coordinates: convert pointer event to DISPLAY pixel coords
  // relative to the displayed image rect (not natural image pixels).
  // Backend expects consistent space — we use display space everywhere.
  // ============================================================
  function eventToImageXY(evt) {
    const r = elImg.getBoundingClientRect();
    const x = evt.clientX - r.left;
    const y = evt.clientY - r.top;
    // clamp within bounds
    const cx = Math.max(0, Math.min(r.width, x));
    const cy = Math.max(0, Math.min(r.height, y));
    return { x: cx, y: cy };
  }

  // ============================================================
  // inchesPerPixel computed from target physical width and displayed width
  // This is NOT guessing — physical inches come from target profile.
  // ============================================================
  function computeInchesPerPixel() {
    const r = elImg.getBoundingClientRect();
    const t = currentTargetProfile();
    const wPx = r.width || 0;
    if (!wPx) return NaN;
    return t.wIn / wPx;
  }

  // ============================================================
  // Backend call: /api/calc
  // ============================================================
  async function callBackendCalc() {
    if (!bull || impacts.length < 1) return;

    const distanceYds = elDistance ? Number(elDistance.value) : 100;
    const inchesPerPixel = computeInchesPerPixel();

    if (!Number.isFinite(inchesPerPixel) || inchesPerPixel <= 0) {
      setBanner("Scale error: inchesPerPixel not computable (image not sized yet).");
      return;
    }

    const API_BASE = getApiBase();
    const url = `${API_BASE}/api/calc`;

    const payload = {
      distanceYds,
      clickMoa: 0.25, // keep default; you can later wire a UI for 0.1 / 0.25 etc.
      inchesPerPixel,
      bull: { x: bull.x, y: bull.y },
      impacts: impacts.map(p => ({ x: p.x, y: p.y }))
    };

    setBanner(`Calculating… (${url})`);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data || data.ok !== true) {
        setBanner(`Backend error: ${data?.error || resp.statusText || "unknown"}`);
        return;
      }

      lastCalc = data;
      poib = data.poib ? { x: data.poib.x, y: data.poib.y } : null;

      // UI output (backend is authority)
      const w = data.ui?.windage || "";
      const e = data.ui?.elevation || "";

      if (elWindLine) elWindLine.textContent = w;
      if (elElevLine) elElevLine.textContent = e;

      // If your UI doesn’t have dedicated fields, show in banner
      if (!elWindLine && !elElevLine) {
        setBanner(`${w} | ${e}`);
      } else {
        setBanner("Backend OK. Directions are backend-authoritative.");
      }

      redrawOverlay();
    } catch (err) {
      setBanner(`Network error calling backend: ${String(err?.message || err)}`);
    }
  }

  // ============================================================
  // Tap handling: first tap sets Bull, remaining taps are Impacts
  // We attach to wrapper if possible; otherwise attach to image.
  // ============================================================
  function onTap(evt) {
    // only if an image is loaded
    if (!elImg.src) return;

    // don’t allow scrolling/zooming to eat taps
    evt.preventDefault?.();
    evt.stopPropagation?.();

    const p = eventToImageXY(evt);

    if (!bull) {
      bull = p;
      poib = null;
      lastCalc = null;
      redrawOverlay();
      setBanner("Bull set. Now tap impacts.");
      return;
    }

    impacts.push(p);
    redrawOverlay();

    // After every impact tap, recalc
    callBackendCalc();
  }

  // Pointer events (works on iOS Safari)
  const tapSurface = elWrap || elImg;

  // Make sure surface actually accepts pointer events
  tapSurface.style.touchAction = "none";

  // Use pointerdown only to avoid double fires
  tapSurface.addEventListener("pointerdown", (evt) => {
    // Ignore if tap is outside the image bounds (ex: wrapper padding)
    const r = elImg.getBoundingClientRect();
    const inside =
      evt.clientX >= r.left && evt.clientX <= r.right &&
      evt.clientY >= r.top  && evt.clientY <= r.bottom;
    if (!inside) return;

    onTap(evt);
  }, { passive: false });

  // ============================================================
  // Clear
  // ============================================================
  function clearAll() {
    bull = null;
    impacts = [];
    poib = null;
    lastCalc = null;
    setTapCountUI();
    clearOverlay();

    if (elWindLine) elWindLine.textContent = "";
    if (elElevLine) elElevLine.textContent = "";

    setBanner("Cleared. Tap bull first.");
  }

  if (elClear) elClear.addEventListener("click", clearAll);

  // ============================================================
  // Image loading (FileReader, iOS-safe) + forced visibility
  // ============================================================
  function loadFileToImg(file) {
    if (!file) return;

    // Dedup file input double-fire
    const sig = `${file.name}|${file.size}|${file.lastModified}`;
    if (sig === lastFileSig) return;
    lastFileSig = sig;

    clearAll();
    setBanner(`Loading image… ${file.name || "(photo)"} (${Math.round(file.size / 1024)} KB)`);

    const reader = new FileReader();
    reader.onerror = () => setBanner("FileReader error.");
    reader.onload = () => {
      elImg.onload = () => {
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
      setBanner(`${evtName}: no file.`);
      return;
    }
    loadFileToImg(f);
  }

  elFile.addEventListener("change", () => handlePick("change"));
  elFile.addEventListener("input",  () => handlePick("input"));

  // Resize keeps overlay aligned
  window.addEventListener("resize", () => {
    if (!elImg.src) return;
    redrawOverlay();
  });

  // If target dropdown changes, re-run calc (scale changes with selected target profile)
  if (elTargetSel) {
    elTargetSel.addEventListener("change", () => {
      if (!elImg.src) return;
      // recompute scale & recalc if we have data
      redrawOverlay();
      callBackendCalc();
      setBanner(`Target profile: ${currentTargetKey()}`);
    });
  }

  // Init
  setTapCountUI();
  setBanner("Ready. Upload a photo.");
})();
