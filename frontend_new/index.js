/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT)
   Purpose:
   - iOS photo load (FileReader)
   - Tap bull (first tap) + impacts (next taps)
   - Draw dots ON TOP of the image
   - Compute inchesPerPixel from selected target size + displayed image size
   - Call backend /api/calc and show REAL error messages
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Required IDs
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");

  // --- Optional IDs (if present in your HTML)
  const elWrap = $("targetWrap");           // wrapper around image + dots
  const elInstruction = $("instructionLine");
  const elAddPhotoLine = $("addPhotoLine");
  const elDistance = $("distanceYds");      // input
  const elTarget = $("targetSelect") || $("target"); // select (either id)
  const elResults = $("resultsBox") || $("results") || $("resultsPanel");

  if (!elFile || !elImg || !elDots) return;

  // ============================================================
  // Banner / Status line (bottom)
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
  banner.style.background = "rgba(0,0,0,0.78)";
  banner.style.color = "white";
  banner.style.border = "1px solid rgba(255,255,255,0.12)";
  banner.textContent = "Ready.";
  document.body.appendChild(banner);

  const setBanner = (t) => (banner.textContent = t);

  // ============================================================
  // State
  // ============================================================
  let bull = null;      // {x,y} in DISPLAY coords
  let impacts = [];     // array of {x,y} in DISPLAY coords

  // ============================================================
  // Utilities
  // ============================================================
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getDistanceYds() {
    const n = Number(elDistance?.value);
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  // Map your target dropdown values -> physical inches
  // Add more as needed.
  function getTargetPhysicalInches() {
    const raw = String(elTarget?.value || "").toLowerCase();

    // Common possibilities: "8.5x11 (letter)", "letter", "23x23", etc.
    if (raw.includes("8.5") && raw.includes("11")) return { w: 8.5, h: 11 };
    if (raw.includes("letter")) return { w: 8.5, h: 11 };
    if (raw.includes("23") && raw.includes("23")) return { w: 23, h: 23 };
    if (raw.includes("12") && raw.includes("18")) return { w: 12, h: 18 };
    if (raw.includes("19") && raw.includes("25")) return { w: 19, h: 25 };

    // Default to Letter if unknown
    return { w: 8.5, h: 11 };
  }

  // Decide whether the loaded photo is landscape or portrait,
  // then orient the physical dimensions to match that.
  function getOrientedPhysicalInches() {
    const phys = getTargetPhysicalInches();
    const isLandscape = elImg.naturalWidth > elImg.naturalHeight;

    // If image is landscape, ensure w >= h
    if (isLandscape && phys.w < phys.h) return { w: phys.h, h: phys.w };
    // If image is portrait, ensure h >= w
    if (!isLandscape && phys.h < phys.w) return { w: phys.h, h: phys.w };

    return phys;
  }

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
    setTapCount();
    clearOverlay();
    setBanner("Cleared.");
    if (elResults) elResults.textContent = "";
  }

  if (elClear) elClear.addEventListener("click", clearAll);

  // ============================================================
  // FORCE VISIBILITY & LAYER ORDER
  // ============================================================
  function forceShowImage() {
    elImg.style.display = "block";
    elImg.style.visibility = "visible";
    elImg.style.opacity = "1";
    elImg.style.width = "100%";
    elImg.style.height = "auto";
    elImg.style.maxWidth = "100%";
    elImg.style.position = "relative";
    elImg.style.zIndex = "1";

    if (elWrap) {
      elWrap.style.display = "block";
      elWrap.style.visibility = "visible";
      elWrap.style.opacity = "1";
      elWrap.style.position = "relative";
    }

    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.zIndex = "5";
    elDots.style.pointerEvents = "auto";

    if (elInstruction) elInstruction.textContent = "";
    if (elAddPhotoLine) elAddPhotoLine.style.display = "none";
  }

  function syncOverlaySize() {
    const r = elImg.getBoundingClientRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  // ============================================================
  // Tap -> display-space coords
  // ============================================================
  function eventToImageXY(ev) {
    const r = elImg.getBoundingClientRect();
    const x = clamp(ev.clientX - r.left, 0, r.width);
    const y = clamp(ev.clientY - r.top, 0, r.height);
    return { x, y, w: r.width, h: r.height };
  }

  function drawDot(x, y, kind) {
    const d = document.createElement("div");
    d.style.position = "absolute";
    d.style.width = "14px";
    d.style.height = "14px";
    d.style.borderRadius = "50%";
    d.style.transform = "translate(-50%, -50%)";
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;

    if (kind === "bull") {
      d.style.background = "rgba(0,140,255,0.95)";
      d.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.7)";
    } else {
      d.style.background = "rgba(0,255,255,0.92)";
      d.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.35)";
    }

    elDots.appendChild(d);
  }

  // ============================================================
  // inchesPerPixel calculation (single value required by backend)
  // We compute both X and Y scale and use the average.
  // ============================================================
  function computeInchesPerPixel(displayW, displayH) {
    const phys = getOrientedPhysicalInches();

    const xInPerPx = phys.w / displayW;
    const yInPerPx = phys.h / displayH;

    const avg = (xInPerPx + yInPerPx) / 2;

    // If wildly mismatched, warn (photo not well-aligned/cropped)
    const diffPct = Math.abs(xInPerPx - yInPerPx) / Math.max(xInPerPx, yInPerPx);
    if (diffPct > 0.08) {
      setBanner(
        `Scale warning: X vs Y differ ${(diffPct * 100).toFixed(0)}%. Photo may be cropped/skewed.`
      );
    }

    return avg;
  }

  // ============================================================
  // Backend call + results render
  // ============================================================
  async function runBackendCalc() {
    if (!bull || impacts.length < 1) return;

    if (!window.SCZN3_API || typeof window.SCZN3_API.calc !== "function") {
      setBanner("API not loaded (SCZN3_API missing). Check api.js is included before index.js.");
      return;
    }

    const r = elImg.getBoundingClientRect();
    const inchesPerPixel = computeInchesPerPixel(r.width, r.height);

    const payload = {
      distanceYds: getDistanceYds(),
      clickMoa: 0.25,
      inchesPerPixel,
      bull: { x: bull.x, y: bull.y },
      impacts: impacts.map((p) => ({ x: p.x, y: p.y })),
    };

    try {
      setBanner(`Calling backend… (${window.SCZN3_API.backendBase})`);
      const out = await window.SCZN3_API.calc(payload);

      const w = out?.ui?.windage || "—";
      const e = out?.ui?.elevation || "—";
      setBanner("Backend OK.");

      if (elResults) {
        elResults.textContent =
          `Distance: ${out.distanceYds.toFixed(2)} yds\n` +
          `Windage: ${w}\n` +
          `Elevation: ${e}\n` +
          `Taps Used: ${1 + impacts.length}`;
      }
    } catch (err) {
      // ✅ This is the important part: show the REAL backend error text
      const msg = String(err?.message || err || "Unknown error");
      setBanner(`Backend error: ${msg}`);
      if (elResults) elResults.textContent = `Backend error:\n${msg}`;
    }
  }

  // ============================================================
  // Tap handler (on dots layer)
  // ============================================================
  function onTap(ev) {
    // Ignore taps if no image loaded yet
    if (!elImg.src) return;

    const { x, y } = eventToImageXY(ev);

    if (!bull) {
      bull = { x, y };
      drawDot(x, y, "bull");
      setBanner("Bull set (blue). Now tap impacts (cyan).");
    } else {
      impacts.push({ x, y });
      drawDot(x, y, "impact");
      setBanner(`Impact recorded: ${impacts.length}`);
    }

    setTapCount();

    // Auto-run backend once we have bull + at least 1 impact
    runBackendCalc();
  }

  elDots.addEventListener("click", onTap);
  elDots.addEventListener("touchend", (e) => {
    // Convert touchend -> click-ish
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const t = e.changedTouches[0];
    onTap({ clientX: t.clientX, clientY: t.clientY });
  });

  // ============================================================
  // Photo load (FileReader)
  // ============================================================
  function loadFileToImg(file) {
    if (!file) return;

    setBanner(`Got file: ${file.name || "(no name)"} • ${Math.round(file.size / 1024)} KB`);
    clearAll();

    const reader = new FileReader();
    reader.onerror = () => setBanner("FileReader error.");
    reader.onload = () => {
      setBanner("FileReader OK. Setting src…");

      elImg.onload = () => {
        forceShowImage();
        syncOverlaySize();
        setBanner("Image loaded (FileReader). Tap to set Bull.");
      };

      elImg.onerror = () => setBanner("Image failed to load.");

      elImg.src = String(reader.result || "");
    };

    reader.readAsDataURL(file);
  }

  function handlePick(evtName) {
    setBanner(`${evtName} fired.`);
    const f = elFile.files && elFile.files[0];
    if (!f) {
      setBanner("No file found on input.");
      return;
    }
    loadFileToImg(f);
  }

  elFile.addEventListener("change", () => handlePick("change"));
  elFile.addEventListener("input", () => handlePick("input"));

  window.addEventListener("resize", () => {
    syncOverlaySize();
  });

  // Init
  setTapCount();
  setBanner("Ready. Upload a photo.");
})();
