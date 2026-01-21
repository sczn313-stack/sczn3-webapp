/* ============================================================
   sczn3-webapp/frontend_new/index.js  (FULL REPLACEMENT)

   Fixes / Features:
   - iOS Safari-safe file selection (stores File immediately)
   - Tap dots render correctly and stay aligned on resize/scroll
   - Ignores taps unless image is loaded AND tap is inside image
   - Computes POIB (average of taps) + aim point (image center)
   - Draws POIB dot + vector arrow to aim
   - Converts POIB shift to Inches + MOA + Clicks (two decimals)
     using a simple target profile (8.5x11 assumes full-page photo)
   - Works even if SCZN3_API is missing (no hard crash)

   REQUIRED HTML IDs (matches your current build):
     photoInput, targetImg, targetWrap, dotsLayer,
     tapCount, clearTapsBtn, instructionLine,
     distanceYds, vendorLink, targetSelect (optional)

   Optional (if present, will be used):
     clickValueMoa (input), resultsBox (div),
     analyzeBtn (button)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements (must exist)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elDistance = $("distanceYds");
  const elVendor = $("vendorLink");

  // --- Optional elements
  const elTargetSelect = $("targetSelect");      // optional
  const elClickValue = $("clickValueMoa");       // optional
  const elResults = $("resultsBox");             // optional
  const elAnalyze = $("analyzeBtn");             // optional

  // --- Guard: essential elements
  if (!elFile || !elImg || !elWrap || !elDots || !elTapCount || !elClear || !elInstruction || !elDistance) {
    alert("Missing required HTML IDs. Check index.html element IDs.");
    return;
  }

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // taps stored in IMAGE PIXELS (natural image coordinate space)
  // { xPx, yPx }
  let taps = [];

  // --- Target profiles (inches)
  // Assumption for 8.5x11: photo is of the full sheet (best-effort).
  // Add more profiles later as you qualify targets.
  const TARGETS = {
    "8.5x11": { label: "8.5×11 (Letter)", wIn: 8.5, hIn: 11.0 },
    "23x23":  { label: "23×23",          wIn: 23.0, hIn: 23.0 },
    "12x18":  { label: "12×18",          wIn: 12.0, hIn: 18.0 },
  };

  function getSelectedTargetKey() {
    if (!elTargetSelect) return "8.5x11";
    const v = (elTargetSelect.value || "").toLowerCase();
    if (v.includes("23")) return "23x23";
    if (v.includes("12") && v.includes("18")) return "12x18";
    return "8.5x11";
  }

  function getTargetProfile() {
    const key = getSelectedTargetKey();
    return TARGETS[key] || TARGETS["8.5x11"];
  }

  function clickValueMoa() {
    // default 0.25 MOA/click if not provided
    const raw = elClickValue ? Number(elClickValue.value) : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : 0.25;
  }

  function distanceYds() {
    const d = Number(elDistance.value);
    return Number.isFinite(d) && d > 0 ? d : 100;
  }

  function setInstruction(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function setTapCount() {
    elTapCount.textContent = String(taps.length);
  }

  function clearObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function resetAll(msg) {
    selectedFile = null;
    clearObjectUrl();
    elImg.removeAttribute("src");
    taps = [];
    clearDots();
    setTapCount();
    if (msg) setInstruction(msg);
    if (elResults) elResults.textContent = "";
  }

  // ------------------------------------------------------------
  // iOS-safe file selection
  // ------------------------------------------------------------

  function armReselectSameFileFix() {
    // Clear the file input BEFORE picker opens, so selecting same image triggers events
    const clearValue = () => { elFile.value = ""; };
    elFile.addEventListener("pointerdown", clearValue, { capture: true });
    elFile.addEventListener("touchstart", clearValue, { capture: true, passive: true });
    elFile.addEventListener("mousedown", clearValue, { capture: true });
    elFile.addEventListener("click", clearValue, { capture: true });
  }

  function onFilePickedFromEvent(e) {
    const file = e?.target?.files && e.target.files[0];

    // iOS Safari glitch: sometimes name appears but file object is missing
    if (!file) {
      resetAll("No photo loaded. Tap Choose File again (iOS picker can glitch).");
      return;
    }

    selectedFile = file;
    clearObjectUrl();
    objectUrl = URL.createObjectURL(file);

    // show image
    elImg.src = objectUrl;

    // reset taps
    taps = [];
    clearDots();
    setTapCount();

    setInstruction(`Loaded: ${file.name}. Tap on each bullet hole.`);
    if (elResults) elResults.textContent = "";
  }

  function onFileChange(e) { onFilePickedFromEvent(e); }
  function onFileInput(e) { onFilePickedFromEvent(e); }

  armReselectSameFileFix();
  elFile.addEventListener("change", onFileChange);
  elFile.addEventListener("input", onFileInput);

  // ------------------------------------------------------------
  // Tap capture
  // ------------------------------------------------------------

  function imageRect() {
    return elImg.getBoundingClientRect();
  }

  function wrapRect() {
    return elWrap.getBoundingClientRect();
  }

  function isImageReady() {
    return !!(elImg && elImg.src && elImg.naturalWidth > 0 && elImg.naturalHeight > 0);
  }

  function clientToImagePx(clientX, clientY) {
    const r = imageRect();

    // Tap must be inside the image box (guardrail)
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) {
      return null;
    }

    // Convert client px -> image displayed px
    const xDisp = clientX - r.left;
    const yDisp = clientY - r.top;

    // Convert displayed px -> natural image px
    const xPx = (xDisp / r.width) * elImg.naturalWidth;
    const yPx = (yDisp / r.height) * elImg.naturalHeight;

    return { xPx, yPx };
  }

  function addDotAtClient(clientX, clientY, className = "tapDot") {
    // Position dots relative to targetWrap (not viewport), so they don't drift
    const w = wrapRect();
    const left = clientX - w.left;
    const top = clientY - w.top;

    const dot = document.createElement("div");
    dot.className = className;
    dot.style.position = "absolute";
    dot.style.left = `${left}px`;
    dot.style.top = `${top}px`;
    dot.style.transform = "translate(-50%, -50%)";
    dot.style.width = "14px";
    dot.style.height = "14px";
    dot.style.borderRadius = "999px";
    dot.style.border = "2px solid rgba(0,0,0,0.85)";
    dot.style.background = "rgba(0, 200, 255, 0.95)";
    dot.style.pointerEvents = "none";
    dot.dataset.cx = String(clientX);
    dot.dataset.cy = String(clientY);

    elDots.appendChild(dot);
  }

  function redrawDotsFromStoredClient() {
    // When layout changes, we re-place dots by reusing stored client coords
    // NOTE: this preserves appearance but is best-effort; for perfect redraw, store percent-of-image
    const dots = Array.from(elDots.children);
    if (!dots.length) return;

    const w = wrapRect();
    for (const d of dots) {
      const cx = Number(d.dataset.cx);
      const cy = Number(d.dataset.cy);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      const left = cx - w.left;
      const top = cy - w.top;
      d.style.left = `${left}px`;
      d.style.top = `${top}px`;
    }
  }

  function handleTap(e) {
    if (!isImageReady()) return;

    // Use client coords (works for mouse/touch/pointer)
    const clientX = e.clientX;
    const clientY = e.clientY;

    const imgPt = clientToImagePx(clientX, clientY);
    if (!imgPt) return; // outside image

    taps.push(imgPt);
    setTapCount();
    addDotAtClient(clientX, clientY, "tapDot");

    // live update (optional)
    if (taps.length >= 1) {
      renderPOIBAndVector();
      renderNumbers();
    }
  }

  // Capture taps on wrap (so you can tap anywhere on the image area)
  elWrap.addEventListener("pointerdown", (e) => {
    // Prevent accidental text selection
    e.preventDefault();
    handleTap(e);
  });

  // ------------------------------------------------------------
  // POIB + Vector + Click math
  // ------------------------------------------------------------

  function meanPoint(points) {
    const n = points.length;
    if (!n) return null;
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.xPx; sy += p.yPx; }
    return { xPx: sx / n, yPx: sy / n };
  }

  function aimPoint() {
    // Default aim: center of the image (safe baseline for now)
    return { xPx: elImg.naturalWidth / 2, yPx: elImg.naturalHeight / 2 };
  }

  function pxToInches(dxPx, dyPx) {
    const t = getTargetProfile();

    // Best-effort: assume full sheet captured and image represents entire sheet
    const inPerPxX = t.wIn / elImg.naturalWidth;
    const inPerPxY = t.hIn / elImg.naturalHeight;

    const dxIn = dxPx * inPerPxX;
    const dyIn = dyPx * inPerPxY;

    return { dxIn, dyIn };
  }

  function inchesToMOA(inches, yds) {
    // 1 MOA at 100 yards = 1.047 inches
    // MOA = inches / (1.047 * (yds/100))
    const denom = 1.047 * (yds / 100);
    return denom ? (inches / denom) : 0;
  }

  function two(n) {
    // Always two decimals
    return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  function directionText(dxIn, dyIn) {
    // Coordinate truth:
    // - Right on target = positive dx
    // - Down on target = positive dy (because y grows downward in image coords)
    //
    // Scope correction needed is opposite of impact error:
    // - If POIB is RIGHT of aim, dial LEFT
    // - If POIB is LOW (down), dial UP

    const horiz = dxIn >= 0 ? "LEFT" : "RIGHT"; // reverse
    const vert  = dyIn >= 0 ? "UP"   : "DOWN";  // reverse (down -> up)

    return { horiz, vert };
  }

  function renderNumbers() {
    if (!elResults) return;

    const poib = meanPoint(taps);
    if (!poib) {
      elResults.textContent = "";
      return;
    }

    const aim = aimPoint();

    // Error vector (impact relative to aim)
    const dxPx = poib.xPx - aim.xPx;  // + = right
    const dyPx = poib.yPx - aim.yPx;  // + = down

    const { dxIn, dyIn } = pxToInches(dxPx, dyPx);

    const yds = distanceYds();
    const moaX = inchesToMOA(dxIn, yds);
    const moaY = inchesToMOA(dyIn, yds);

    const cv = clickValueMoa();
    const clicksX = moaX / cv;
    const clicksY = moaY / cv;

    const { horiz, vert } = directionText(dxIn, dyIn);

    // Display magnitudes as positive numbers with direction labels
    const absDxIn = Math.abs(dxIn);
    const absDyIn = Math.abs(dyIn);
    const absMoaX = Math.abs(moaX);
    const absMoaY = Math.abs(moaY);
    const absClicksX = Math.abs(clicksX);
    const absClicksY = Math.abs(clicksY);

    elResults.textContent =
`POIB (n=${taps.length})
Distance: ${yds} yds
Target: ${getTargetProfile().label}
Click value: ${cv} MOA/click

WINDAGE: ${two(absDxIn)} in → ${two(absMoaX)} MOA → ${two(absClicksX)} clicks ${horiz}
ELEVATION: ${two(absDyIn)} in → ${two(absMoaY)} MOA → ${two(absClicksY)} clicks ${vert}`;
  }

  function removeExistingOverlays() {
    // Remove previous POIB dot & vector
    const olds = Array.from(elDots.querySelectorAll(".poibDot, .poibLine, .aimDot"));
    olds.forEach((n) => n.remove());
  }

  function placeOverlayAtImagePx(xPx, yPx, className) {
    // Convert image px back to client coords using current image rect
    const r = imageRect();
    const xClient = r.left + (xPx / elImg.naturalWidth) * r.width;
    const yClient = r.top + (yPx / elImg.naturalHeight) * r.height;

    const w = wrapRect();
    const left = xClient - w.left;
    const top = yClient - w.top;

    const node = document.createElement("div");
    node.className = className;
    node.style.position = "absolute";
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.transform = "translate(-50%, -50%)";
    node.style.pointerEvents = "none";
    elDots.appendChild(node);

    return node;
  }

  function renderPOIBAndVector() {
    if (!isImageReady()) return;
    if (!taps.length) return;

    removeExistingOverlays();

    const poib = meanPoint(taps);
    const aim = aimPoint();

    // Aim dot (center)
    const aimDot = placeOverlayAtImagePx(aim.xPx, aim.yPx, "aimDot");
    aimDot.style.width = "14px";
    aimDot.style.height = "14px";
    aimDot.style.borderRadius = "999px";
    aimDot.style.border = "2px solid rgba(0,0,0,0.85)";
    aimDot.style.background = "rgba(255,255,255,0.9)";

    // POIB dot
    const poibDot = placeOverlayAtImagePx(poib.xPx, poib.yPx, "poibDot");
    poibDot.style.width = "18px";
    poibDot.style.height = "18px";
    poibDot.style.borderRadius = "999px";
    poibDot.style.border = "2px solid rgba(0,0,0,0.85)";
    poibDot.style.background = "rgba(0,255,200,0.95)";

    // Vector line POIB -> Aim (direction of correction visually)
    // Draw as a rotated div
    const r = imageRect();
    const w = wrapRect();

    const poibClientX = r.left + (poib.xPx / elImg.naturalWidth) * r.width;
    const poibClientY = r.top + (poib.yPx / elImg.naturalHeight) * r.height;
    const aimClientX  = r.left + (aim.xPx / elImg.naturalWidth) * r.width;
    const aimClientY  = r.top + (aim.yPx / elImg.naturalHeight) * r.height;

    const x1 = poibClientX - w.left;
    const y1 = poibClientY - w.top;
    const x2 = aimClientX - w.left;
    const y2 = aimClientY - w.top;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    const line = document.createElement("div");
    line.className = "poibLine";
    line.style.position = "absolute";
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.width = `${len}px`;
    line.style.height = "4px";
    line.style.transformOrigin = "0 50%";
    line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    line.style.borderRadius = "999px";
    line.style.background = "rgba(255,255,255,0.85)";
    line.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    line.style.pointerEvents = "none";
    elDots.appendChild(line);
  }

  // Keep overlays aligned after resize/orientation change
  window.addEventListener("resize", () => {
    redrawDotsFromStoredClient();
    if (taps.length) {
      renderPOIBAndVector();
    }
  });

  // ------------------------------------------------------------
  // Clear button
  // ------------------------------------------------------------
  elClear.addEventListener("click", () => {
    taps = [];
    clearDots();
    setTapCount();
    setInstruction(selectedFile ? "Cleared. Tap on each bullet hole." : "Add a photo to begin.");
    if (elResults) elResults.textContent = "";
  });

  // ------------------------------------------------------------
  // Analyze button (optional): if you later wire backend, this is ready
  // ------------------------------------------------------------
  async function tryBackendAnalyze() {
    const api = window.SCZN3_API;
    if (!api || !api.BASE_URL) {
      // No backend configured; just compute locally
      renderPOIBAndVector();
      renderNumbers();
      return;
    }

    // If you later add a backend endpoint, this is the payload you want:
    const payload = {
      distanceYds: distanceYds(),
      target: getSelectedTargetKey(),
      clickValueMoa: clickValueMoa(),
      taps: taps, // image-px coordinates
    };

    const url = api.URLS?.ANALYZE || (api.BASE_URL.replace(/\/+$/, "") + "/analyze");

    // You can switch to multipart upload later. For now, this is tap-only.
    const res = await api.fetchJSON(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res?.ok) {
      // fallback to local so user never gets blocked
      renderPOIBAndVector();
      renderNumbers();
      return;
    }

    // If backend returns SCZN3 results, display them (two decimals preferred)
    if (elResults) {
      elResults.textContent = JSON.stringify(res.data, null, 2);
    }
  }

  if (elAnalyze) {
    elAnalyze.addEventListener("click", () => {
      tryBackendAnalyze().catch(() => {
        renderPOIBAndVector();
        renderNumbers();
      });
    });
  }

  // ------------------------------------------------------------
  // Startup
  // ------------------------------------------------------------
  resetAll("Ready. Upload a photo.");
})();
