/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)
   Build: TNS_POIB_VECTOR_CLICKS_SEC_2026-01-20_B

   Flow:
   1) Upload photo
   2) FIRST TAP = Bull (blue)
   3) Next taps = Impacts (red)
   4) POIB dot (cyan) = average of impacts
   5) Vector arrow shows POIB → Bull (correction path)
   6) Click math:
      - correction = bull - POIB
      - True MOA: 1 MOA = 1.047" @100y scaled by distance
      - clicks = MOA / 0.25
      - 2 decimals everywhere
   7) Optional: Download SEC PNG (if button exists)

   Works with your current HTML:
   - photoInput, targetImg, dotsLayer, vectorLayer
   - tapCount, clearTapsBtn, instructionLine
   - targetWrap, targetCanvas
   - distanceYds, targetSize (optional)
   - resultsCard + rDistance/rTapsUsed/rWindage/rElevation/rNote (optional)
   - downloadSecBtn (optional)

============================================================ */

(() => {
  const BUILD = "TNS_POIB_VECTOR_CLICKS_SEC_2026-01-20_B";
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elVector = $("vectorLayer");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elCanvas = $("targetCanvas");

  const elDistance = $("distanceYds");
  const elTargetSize = $("targetSize"); // optional

  const elResults = $("resultsCard"); // optional
  const elRDistance = $("rDistance");
  const elRTapsUsed = $("rTapsUsed");
  const elRWindage = $("rWindage");
  const elRElevation = $("rElevation");
  const elRNote = $("rNote");

  const elDownloadSec = $("downloadSecBtn"); // optional

  // State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;      // {nx, ny} first tap
  let impacts = [];     // [{nx, ny}, ...] remaining taps

  // Duplicate-event guard
  let lastTapAt = 0;

  // Target physical sizes (inches)
  const TARGET_SIZES = {
    "8.5x11": { w: 8.50, h: 11.00 },
    "23x23":  { w: 23.00, h: 23.00 },
    "23x35":  { w: 23.00, h: 35.00 },
  };

  const CLICK_MOA = 0.25;

  // ---------- helpers ----------
  function fmt2(n) {
    return Number.isFinite(n) ? n.toFixed(2) : "—";
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function setInstruction(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function showTarget() {
    if (elWrap) elWrap.style.display = "block";
  }

  function hideTarget() {
    if (elWrap) elWrap.style.display = "none";
  }

  function setTapCount() {
    const total = (bull ? 1 : 0) + impacts.length;
    if (elTapCount) elTapCount.textContent = String(total);
  }

  function cleanupUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clearOverlays() {
    if (elDots) elDots.innerHTML = "";
    if (elVector) elVector.innerHTML = "";
  }

  function hideResults() {
    if (elResults) elResults.style.display = "none";
    if (elRDistance) elRDistance.textContent = "—";
    if (elRTapsUsed) elRTapsUsed.textContent = "—";
    if (elRWindage) elRWindage.textContent = "—";
    if (elRElevation) elRElevation.textContent = "—";
    if (elRNote) elRNote.textContent = "—";
  }

  function showResults() {
    if (elResults) elResults.style.display = "block";
  }

  function updateDownloadState() {
    if (!elDownloadSec) return;
    const ok = !!bull && impacts.length >= 1 && !!elImg?.src;
    elDownloadSec.disabled = !ok;
  }

  function getDistanceYds() {
    const v = Number(elDistance?.value || 100);
    return Number.isFinite(v) && v > 0 ? v : 100;
  }

  function getTargetInches() {
    const key = elTargetSize?.value || "8.5x11";
    return TARGET_SIZES[key] || TARGET_SIZES["8.5x11"];
  }

  function getClientXY(ev) {
    const t = ev.touches && ev.touches[0];
    return {
      x: t ? t.clientX : ev.clientX,
      y: t ? t.clientY : ev.clientY
    };
  }

  // ---------- dot + arrow drawing ----------
  function dotEl(className, nx, ny) {
    const d = document.createElement("div");
    d.className = className;
    d.style.left = `${(clamp01(nx) * 100).toFixed(6)}%`;
    d.style.top  = `${(clamp01(ny) * 100).toFixed(6)}%`;
    return d;
  }

  function computePoib() {
    if (impacts.length < 1) return null;
    let sx = 0, sy = 0;
    for (const t of impacts) { sx += t.nx; sy += t.ny; }
    return { nx: sx / impacts.length, ny: sy / impacts.length };
  }

  // SVG arrow uses fixed viewBox so we don't depend on clientWidth/Height
  function drawVectorArrow(fromNx, fromNy, toNx, toNy) {
    if (!elVector) return;

    const x1 = clamp01(fromNx) * 1000;
    const y1 = clamp01(fromNy) * 1000;
    const x2 = clamp01(toNx) * 1000;
    const y2 = clamp01(toNy) * 1000;

    elVector.setAttribute("viewBox", "0 0 1000 1000");
    elVector.setAttribute("preserveAspectRatio", "none");
    elVector.innerHTML = `
      <defs>
        <marker id="arrowHead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L10,6 L0,12 Z" fill="rgba(100,210,255,0.95)"></path>
        </marker>
      </defs>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
            stroke="rgba(100,210,255,0.95)"
            stroke-width="10"
            stroke-linecap="round"
            marker-end="url(#arrowHead)"/>
    `;
  }

  function redrawAll() {
    if (!elDots) return;

    clearOverlays();

    // Bull (first tap)
    if (bull) elDots.appendChild(dotEl("dot dotBull", bull.nx, bull.ny));

    // Impacts
    for (const t of impacts) elDots.appendChild(dotEl("dot", t.nx, t.ny));

    // POIB + arrow + results
    const poib = computePoib();
    if (bull && poib) {
      elDots.appendChild(dotEl("dot dotPoib", poib.nx, poib.ny));
      drawVectorArrow(poib.nx, poib.ny, bull.nx, bull.ny);
      computeAndRenderResults(poib);
    } else {
      hideResults();
      if (elVector) elVector.innerHTML = "";
    }

    updateDownloadState();
  }

  // ---------- click math + results ----------
  function computeAndRenderResults(poib) {
    const dist = getDistanceYds();
    const { w: wIn, h: hIn } = getTargetInches();

    // Canonical: correction = bull - POIB
    const dNx = bull.nx - poib.nx;
    const dNy = bull.ny - poib.ny;

    const dXIn = dNx * wIn;
    const dYIn = dNy * hIn;

    // True MOA inch-per-MOA at distance
    const inchPerMoa = 1.047 * (dist / 100.0);

    const windMoa = dXIn / inchPerMoa;
    const elevMoa = dYIn / inchPerMoa;

    const windClicks = windMoa / CLICK_MOA;
    const elevClicks = elevMoa / CLICK_MOA;

    const windDir = dXIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dYIn >= 0 ? "UP" : "DOWN";

    const windText = `${fmt2(Math.abs(dXIn))}" ${windDir} • ${fmt2(Math.abs(windMoa))} MOA • ${fmt2(Math.abs(windClicks))} clicks ${windDir}`;
    const elevText = `${fmt2(Math.abs(dYIn))}" ${elevDir} • ${fmt2(Math.abs(elevMoa))} MOA • ${fmt2(Math.abs(elevClicks))} clicks ${elevDir}`;

    if (elRDistance) elRDistance.textContent = `${fmt2(dist)} yds`;
    if (elRTapsUsed) elRTapsUsed.textContent = `${impacts.length}`;
    if (elRWindage) elRWindage.textContent = windText;
    if (elRElevation) elRElevation.textContent = elevText;

    if (elRNote) {
      elRNote.textContent =
        `Bull = first tap (blue). POIB = average of impacts (cyan). Arrow shows correction path POIB → Bull.`;
    }

    if (elResults) showResults();
  }

  // ---------- SEC export (PNG) ----------
  function drawSecToCanvas() {
    if (!bull || impacts.length < 1 || !elImg?.src) return null;

    const poib = computePoib();
    if (!poib) return null;

    const dist = getDistanceYds();
    const { w: wIn, h: hIn } = getTargetInches();

    const dNx = bull.nx - poib.nx;
    const dNy = bull.ny - poib.ny;
    const dXIn = dNx * wIn;
    const dYIn = dNy * hIn;

    const inchPerMoa = 1.047 * (dist / 100.0);
    const windMoa = dXIn / inchPerMoa;
    const elevMoa = dYIn / inchPerMoa;
    const windClicks = windMoa / CLICK_MOA;
    const elevClicks = elevMoa / CLICK_MOA;

    const windDir = dXIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dYIn >= 0 ? "UP" : "DOWN";

    // Canvas size (simple, reliable)
    const W = 1080;
    const H = 1350;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial";
    ctx.fillText("TAP-N-SCORE™", 60, 90);

    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.font = "bold 30px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial";
    ctx.fillText(`Distance: ${dist.toFixed(2)} yds`, 60, 140);
    ctx.fillText(`Impacts: ${impacts.length}`, 60, 180);

    // Corrections
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 34px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial";
    ctx.fillText(`Windage: ${Math.abs(windClicks).toFixed(2)} clicks ${windDir}  (${Math.abs(windMoa).toFixed(2)} MOA)`, 60, 250);
    ctx.fillText(`Elevation: ${Math.abs(elevClicks).toFixed(2)} clicks ${elevDir}  (${Math.abs(elevMoa).toFixed(2)} MOA)`, 60, 300);

    // Image panel
    const pad = 60;
    const imgTop = 360;
    const panelW = W - pad * 2;
    const panelH = Math.round(panelW * 0.62);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(pad, imgTop, panelW, panelH);

    // Draw photo (contain)
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const scale = Math.min(panelW / iw, panelH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = pad + (panelW - dw) / 2;
    const dy = imgTop + (panelH - dh) / 2;

    ctx.drawImage(elImg, dx, dy, dw, dh);

    // Map normalized coords into drawn-image coords
    function map(nx, ny) {
      return { x: dx + clamp01(nx) * dw, y: dy + clamp01(ny) * dh };
    }

    // Draw helper dot
    function drawDot(x, y, r, fill) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    // Arrow POIB -> Bull
    const p = map(poib.nx, poib.ny);
    const b = map(bull.nx, bull.ny);

    ctx.strokeStyle = "rgba(100,210,255,0.95)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Arrow head
    const ang = Math.atan2(b.y - p.y, b.x - p.x);
    const ah = 18;
    ctx.fillStyle = "rgba(100,210,255,0.95)";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - ah * Math.cos(ang - 0.5), b.y - ah * Math.sin(ang - 0.5));
    ctx.lineTo(b.x - ah * Math.cos(ang + 0.5), b.y - ah * Math.sin(ang + 0.5));
    ctx.closePath();
    ctx.fill();

    // Impacts (red)
    for (const t of impacts) {
      const pt = map(t.nx, t.ny);
      drawDot(pt.x, pt.y, 10, "#ff3b30");
    }

    // POIB (cyan) and Bull (blue)
    drawDot(p.x, p.y, 12, "#64d2ff");
    drawDot(b.x, b.y, 12, "#0a84ff");

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 22px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial";
    ctx.fillText(`Build: ${BUILD}`, 60, H - 60);

    return canvas;
  }

  function downloadSecPng() {
    const c = drawSecToCanvas();
    if (!c) return;

    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `SEC_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- tap capture ----------
  function recordNormalizedTap(clientX, clientY) {
    if (!selectedFile || !objectUrl || !elImg || !elImg.src) {
      setInstruction(`${BUILD} • Add a photo to begin.`);
      return;
    }

    const imgRect = elImg.getBoundingClientRect();
    const localX = clientX - imgRect.left;
    const localY = clientY - imgRect.top;

    if (localX < 0 || localY < 0 || localX > imgRect.width || localY > imgRect.height) return;

    const nx = imgRect.width ? (localX / imgRect.width) : 0;
    const ny = imgRect.height ? (localY / imgRect.height) : 0;

    if (!bull) {
      bull = { nx, ny };
      setInstruction(`${BUILD} • Bull set (blue). Now tap impacts (red).`);
    } else {
      impacts.push({ nx, ny });
      setInstruction(`${BUILD} • Impact recorded: ${impacts.length}`);
    }

    setTapCount();
    redrawAll();
  }

  function onPointerDown(ev) {
    const now = Date.now();
    if (now - lastTapAt < 250) return;
    lastTapAt = now;

    try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
    const { x, y } = getClientXY(ev);
    recordNormalizedTap(x, y);
  }

  function onTouchStartFallback(ev) {
    const now = Date.now();
    if (now - lastTapAt < 250) return;
    lastTapAt = now;

    try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
    const { x, y } = getClientXY(ev);
    recordNormalizedTap(x, y);
  }

  function bindTapSurface(el) {
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("touchstart", onTouchStartFallback, { passive: false });
  }

  // ---------- file handling ----------
  function onFileChange(e) {
    const f = e?.target?.files && e.target.files[0];

    if (!f) {
      selectedFile = null;
      cleanupUrl();
      if (elImg) elImg.removeAttribute("src");

      bull = null;
      impacts = [];
      setTapCount();
      clearOverlays();
      hideResults();
      hideTarget();
      updateDownloadState();

      setInstruction(`${BUILD} • No photo loaded. Tap Upload target photo again.`);
      return;
    }

    selectedFile = f;
    cleanupUrl();
    objectUrl = URL.createObjectURL(f);

    // Reset taps for new image
    bull = null;
    impacts = [];
    setTapCount();
    clearOverlays();
    hideResults();
    updateDownloadState();

    if (elImg) {
      elImg.onload = () => {
        showTarget();
        setInstruction(`${BUILD} • Loaded: ${f.name}. FIRST tap = Bull (blue). Next taps = impacts (red).`);
      };
      elImg.onerror = () => {
        setInstruction(`${BUILD} • Image failed to load. Pick again.`);
      };
      elImg.src = objectUrl;
    } else {
      showTarget();
      setInstruction(`${BUILD} • Loaded: ${f.name}.`);
    }
  }

  function onClear() {
    // Clear everything including file
    bull = null;
    impacts = [];
    setTapCount();
    clearOverlays();
    hideResults();

    if (elFile) elFile.value = "";
    selectedFile = null;
    cleanupUrl();
    if (elImg) elImg.removeAttribute("src");
    hideTarget();

    updateDownloadState();
    setInstruction(`${BUILD} • Add a photo to begin.`);
  }

  function init() {
    setInstruction(`${BUILD} • Ready. Add a photo to begin.`);
    setTapCount();
    clearOverlays();
    hideResults();
    hideTarget();
    updateDownloadState();

    if (elFile) elFile.addEventListener("change", onFileChange);
    if (elClear) elClear.addEventListener("click", onClear);
    if (elDownloadSec) elDownloadSec.addEventListener("click", downloadSecPng);

    // Tap bindings
    bindTapSurface(elCanvas);
    bindTapSurface(elImg);

    // Recompute visuals if distance/target changes
    const recompute = () => {
      if (bull && impacts.length >= 1) redrawAll();
      updateDownloadState();
    };
    if (elDistance) elDistance.addEventListener("input", recompute);
    if (elTargetSize) elTargetSize.addEventListener("change", recompute);

    // Resize/orientation: redraw arrow (dots are % so fine, but arrow uses SVG viewBox anyway)
    const onResize = () => {
      if (bull && impacts.length >= 1) redrawAll();
    };
    window.addEventListener("resize", () => requestAnimationFrame(onResize));
    window.addEventListener("orientationchange", () => requestAnimationFrame(onResize));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
