/* ============================================================================
  Tap-N-Score — FULL index.js (RE-RENDER PROOF)
  Fixes:
    - iOS file picker timing issues (retry-read)
    - DOM re-render replacing the “Add a photo to begin.” element
    - Ensures photo area always mounts and shows the image

  Includes:
    - Photo display + tap dots
    - 1-inch calibration mode + set-bull mode + analyze output
    - 2-decimal outputs

  IMPORTANT:
    This script does NOT assume stable DOM references. It re-finds mount points
    on every key action.
============================================================================ */

(() => {
  // ----------------------------
  // Proof banner (so we KNOW this file is running)
  // ----------------------------
  function showBanner() {
    const b = document.createElement("div");
    b.textContent = "INDEX.JS LOADED — vRENDERPROOF-1";
    b.style.position = "fixed";
    b.style.left = "10px";
    b.style.right = "10px";
    b.style.bottom = "10px";
    b.style.zIndex = "999999";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "10px";
    b.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    b.style.fontSize = "14px";
    b.style.background = "rgba(0,140,0,0.85)";
    b.style.color = "white";
    b.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
    document.body.appendChild(b);
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function findFileInput() {
    return qs('input[type="file"]');
  }

  function findClearButton() {
    return qsa("button").find((b) => (b.textContent || "").trim().toLowerCase() === "clear") || null;
  }

  function findDistanceInput() {
    return qs("#distance") || qsa("input").find((i) => (i.placeholder || "").toLowerCase().includes("distance")) || null;
  }

  function findTapsLine() {
    return qsa("div, p, span").find((el) => (el.textContent || "").includes("Taps:")) || null;
  }

  function findAddPhotoPill() {
    // Re-find every time (this is the key fix)
    return qsa("div, p, span")
      .find((el) => (el.textContent || "").trim() === "Add a photo to begin.") || null;
  }

  // ----------------------------
  // iOS file retry
  // ----------------------------
  async function getFileWithRetry(inputEl, delaysMs) {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      const f = inputEl?.files?.[0] || null;
      if (f) return f;
    }
    return null;
  }

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let objectUrl = null;

  let pixelsPerInch = null;
  let bull = null; // {xPx,yPx} in DISPLAY pixels
  let calTaps = []; // [{xPx,yPx}]
  let shotTaps = []; // [{xPx,yPx}]

  const MODE = { SHOTS: "shots", CAL_1IN: "cal_1in", SET_BULL: "set_bull" };
  let mode = MODE.SHOTS;

  // ----------------------------
  // Mounted UI references (can become invalid if DOM re-renders)
  // So we validate them before using.
  // ----------------------------
  let mounted = {
    host: null,
    wrapper: null,
    img: null,
    overlay: null,
    instruction: null,
    panel: null,
    results: null,
    tapsCounter: null,
    btnCal: null,
    btnBull: null,
    btnAnalyze: null,
  };

  function isMountedAlive() {
    // host can be replaced; wrapper must still be in DOM
    return !!(mounted.wrapper && document.body.contains(mounted.wrapper));
  }

  function setInstruction(text) {
    if (mounted.instruction) mounted.instruction.textContent = text;
  }

  function setTapsCount(n) {
    const tapsLine = findTapsLine();
    if (tapsLine) tapsLine.textContent = `Taps: ${n}`;
    if (mounted.tapsCounter) mounted.tapsCounter.textContent = `Taps: ${n}`;
  }

  function clearOverlay() {
    if (mounted.overlay) mounted.overlay.innerHTML = "";
  }

  function addDot(xPx, yPx, kind) {
    if (!mounted.overlay) return;

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.pointerEvents = "none";
    dot.style.borderRadius = "999px";

    if (kind === "bull") {
      dot.style.width = "14px";
      dot.style.height = "14px";
      dot.style.left = `${xPx - 7}px`;
      dot.style.top = `${yPx - 7}px`;
      dot.style.background = "rgba(0,255,120,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else if (kind === "cal") {
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.left = `${xPx - 6}px`;
      dot.style.top = `${yPx - 6}px`;
      dot.style.background = "rgba(80,160,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else {
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.left = `${xPx - 6}px`;
      dot.style.top = `${yPx - 6}px`;
      dot.style.background = "rgba(255,255,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    }

    mounted.overlay.appendChild(dot);
  }

  function redrawDots() {
    if (!mounted.img || mounted.img.style.display === "none") return;

    clearOverlay();
    calTaps.forEach((p) => addDot(p.xPx, p.yPx, "cal"));
    if (bull) addDot(bull.xPx, bull.yPx, "bull");
    shotTaps.forEach((p) => addDot(p.xPx, p.yPx, "shot"));
  }

  // ----------------------------
  // Build / rebuild UI
  // ----------------------------
  function ensureUI() {
    // If our mounted UI got wiped, rebuild it
    if (isMountedAlive()) return;

    const host = findAddPhotoPill();

    // If the pill isn't found (rare), mount under the file input area
    let mountPoint = host;
    if (!mountPoint) {
      const fi = findFileInput();
      if (fi && fi.parentElement) {
        mountPoint = document.createElement("div");
        mountPoint.style.marginTop = "12px";
        fi.parentElement.appendChild(mountPoint);
      } else {
        mountPoint = document.createElement("div");
        document.body.appendChild(mountPoint);
      }
    }

    // Clear host and prepare it as container
    mountPoint.textContent = "";
    mountPoint.style.position = "relative";
    mountPoint.style.overflow = "hidden";

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.style.minHeight = "260px";
    wrapper.style.borderRadius = "16px";

    const instruction = document.createElement("div");
    instruction.style.padding = "14px 16px";
    instruction.style.opacity = "0.9";
    instruction.style.fontSize = "18px";
    instruction.textContent = "Add a photo to begin.";

    const img = document.createElement("img");
    img.alt = "Target preview";
    img.style.display = "none";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.borderRadius = "16px";
    img.style.userSelect = "none";
    img.style.webkitUserSelect = "none";
    img.style.touchAction = "manipulation";

    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.pointerEvents = "none";

    wrapper.appendChild(instruction);
    wrapper.appendChild(img);
    wrapper.appendChild(overlay);
    mountPoint.appendChild(wrapper);

    const panel = document.createElement("div");
    panel.style.marginTop = "12px";
    panel.style.display = "flex";
    panel.style.gap = "10px";
    panel.style.flexWrap = "wrap";
    panel.style.alignItems = "center";

    const mkBtn = (label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.padding = "10px 14px";
      b.style.borderRadius = "14px";
      b.style.border = "1px solid rgba(255,255,255,0.15)";
      b.style.background = "rgba(255,255,255,0.06)";
      b.style.color = "white";
      return b;
    };

    const btnCal = mkBtn("Calibrate 1 inch");
    const btnBull = mkBtn("Set Bull");
    const btnAnalyze = mkBtn("Analyze");

    const tapsCounter = document.createElement("div");
    tapsCounter.style.opacity = "0.9";
    tapsCounter.textContent = "Taps: 0";

    panel.appendChild(btnCal);
    panel.appendChild(btnBull);
    panel.appendChild(btnAnalyze);
    panel.appendChild(tapsCounter);

    const results = document.createElement("div");
    results.style.marginTop = "12px";
    results.style.padding = "12px 14px";
    results.style.borderRadius = "14px";
    results.style.border = "1px solid rgba(255,255,255,0.12)";
    results.style.background = "rgba(255,255,255,0.06)";
    results.style.whiteSpace = "pre-wrap";
    results.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    results.style.fontSize = "13px";
    results.textContent = "";

    // Put controls + results immediately after mountPoint (not fragile parentElement stuff)
    mountPoint.appendChild(panel);
    mountPoint.appendChild(results);

    // Save references
    mounted = { host: mountPoint, wrapper, img, overlay, instruction, panel, results, tapsCounter, btnCal, btnBull, btnAnalyze };

    // Tap handler
    const onTap = (e) => {
      if (!mounted.img || mounted.img.style.display === "none") return;

      const isTouch = e.touches && e.touches[0];
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      const rect = mounted.img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (rect.width <= 0 || rect.height <= 0) return;

      const xPx = clamp01(x / rect.width) * rect.width;
      const yPx = clamp01(y / rect.height) * rect.height;

      if (mode === MODE.CAL_1IN) {
        calTaps.push({ xPx, yPx });
        redrawDots();

        if (calTaps.length === 1) {
          setInstruction('Calibration: tap the SECOND point (exactly 1.00" away).');
          return;
        }

        if (calTaps.length === 2) {
          const dx = calTaps[1].xPx - calTaps[0].xPx;
          const dy = calTaps[1].yPx - calTaps[0].yPx;
          const distPx = Math.hypot(dx, dy);
          pixelsPerInch = distPx; // because distance is exactly 1.00"
          mode = MODE.SHOTS;
          setInstruction(`Calibrated: ${pixelsPerInch.toFixed(2)} px/in. Now tap shots (or Set Bull).`);
        }
        return;
      }

      if (mode === MODE.SET_BULL) {
        bull = { xPx, yPx };
        mode = MODE.SHOTS;
        redrawDots();
        setInstruction("Bull set. Tap your shot holes.");
        return;
      }

      shotTaps.push({ xPx, yPx });
      addDot(xPx, yPx, "shot");
      setTapsCount(shotTaps.length);
    };

    wrapper.addEventListener("click", onTap);
    wrapper.addEventListener("touchstart", onTap, { passive: true });

    // Buttons
    btnCal.addEventListener("click", () => {
      if (!selectedFile) return;
      mode = MODE.CAL_1IN;
      calTaps = [];
      pixelsPerInch = null;
      results.textContent = "";
      redrawDots();
      setInstruction('Calibration: tap TWO points exactly 1.00" apart.');
    });

    btnBull.addEventListener("click", () => {
      if (!selectedFile) return;
      mode = MODE.SET_BULL;
      results.textContent = "";
      setInstruction("Bull: tap the exact bull/aim point center.");
    });

    btnAnalyze.addEventListener("click", () => {
      results.textContent = analyze();
    });

    // Resize/orientation: just redraw dots
    const rerender = () => setTimeout(() => redrawDots(), 150);
    window.addEventListener("resize", rerender);
    window.addEventListener("orientationchange", rerender);
  }

  // ----------------------------
  // Analyze math
  // ----------------------------
  function centroid(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.xPx; sy += p.yPx; }
    return { xPx: sx / points.length, yPx: sy / points.length };
  }

  function analyze() {
    const distanceEl = findDistanceInput();
    const yards = Number(distanceEl?.value || 100);
    const yardsSafe = Number.isFinite(yards) && yards > 0 ? yards : 100;

    if (!selectedFile) return "No photo.\n";
    if (!pixelsPerInch) return "Missing calibration.\nTap “Calibrate 1 inch”, then tap TWO points 1.00\" apart.\n";
    if (!bull) return "Missing bull.\nTap “Set Bull”, then tap the bull/aim point center.\n";
    if (shotTaps.length < 3) return "Need at least 3 shot taps.\n";

    // If >7 taps, keep the 7 closest to initial centroid (simple cluster keep)
    const initial = centroid(shotTaps);
    const ranked = shotTaps
      .map((p) => ({ p, d: Math.hypot(p.xPx - initial.xPx, p.yPx - initial.yPx) }))
      .sort((a, b) => a.d - b.d);
    const kept = ranked.slice(0, Math.min(7, ranked.length)).map((x) => x.p);

    const poibPx = centroid(kept);

    // Offsets from bull (in display px)
    const dxPx = poibPx.xPx - bull.xPx; // + right
    const dyPx = poibPx.yPx - bull.yPx; // + down

    // Convert px → inches using pixelsPerInch
    const dxIn = dxPx / pixelsPerInch;
    const dyIn = dyPx / pixelsPerInch;

    // Inches per MOA at distance
    const inchesPerMOA = 1.047 * (yardsSafe / 100);

    const windMOA = dxIn / inchesPerMOA;
    const elevMOA = dyIn / inchesPerMOA;

    const moaPerClick = 0.25;
    const windClicks = windMOA / moaPerClick;
    const elevClicks = elevMOA / moaPerClick;

    // Dial opposite of impact offset
    const windDir = dxIn > 0 ? "LEFT" : dxIn < 0 ? "RIGHT" : "OK";
    const elevDir = dyIn > 0 ? "UP" : dyIn < 0 ? "DOWN" : "OK";

    const abs = (n) => Math.abs(n);

    return (
      `Calibration: ${pixelsPerInch.toFixed(2)} px/in\n` +
      `Distance: ${yardsSafe.toFixed(0)} yd\n` +
      `Shots used: ${kept.length} (of ${shotTaps.length})\n\n` +

      `POIB offset (inches)\n` +
      `  Wind: ${dxIn.toFixed(2)} in\n` +
      `  Elev: ${(-dyIn).toFixed(2)} in\n\n` +

      `Correction (dial)\n` +
      `  Wind: ${abs(windMOA).toFixed(2)} MOA = ${abs(windClicks).toFixed(2)} clicks → ${windDir}\n` +
      `  Elev: ${abs(elevMOA).toFixed(2)} MOA = ${abs(elevClicks).toFixed(2)} clicks → ${elevDir}\n`
    );
  }

  // ----------------------------
  // File pick handler
  // ----------------------------
  async function onFilePicked(e) {
    ensureUI();

    const file = await getFileWithRetry(e?.target, [0, 50, 250, 800]);
    if (!file) return;

    selectedFile = file;

    // Reset state on new file
    pixelsPerInch = null;
    bull = null;
    calTaps = [];
    shotTaps = [];
    mode = MODE.SHOTS;
    setTapsCount(0);
    if (mounted.results) mounted.results.textContent = "";

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    // Show image
    ensureUI(); // in case a re-render happened while picker was open
    mounted.img.src = objectUrl;
    mounted.img.style.display = "block";
    setInstruction('Loaded. Tap “Calibrate 1 inch” first.');

    mounted.img.onload = () => redrawDots();
  }

  function onClear() {
    const fileInput = findFileInput();
    if (fileInput) fileInput.value = "";

    selectedFile = null;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    pixelsPerInch = null;
    bull = null;
    calTaps = [];
    shotTaps = [];
    mode = MODE.SHOTS;
    setTapsCount(0);

    if (mounted.results) mounted.results.textContent = "";
    if (mounted.img) {
      mounted.img.src = "";
      mounted.img.style.display = "none";
    }
    if (mounted.instruction) mounted.instruction.textContent = "Add a photo to begin.";
    clearOverlay();
  }

  // ----------------------------
  // Boot
  // ----------------------------
  function init() {
    showBanner();
    ensureUI();
    setTapsCount(0);

    const fi = findFileInput();
    if (fi) {
      fi.addEventListener("change", onFilePicked);
      fi.addEventListener("input", onFilePicked);
    }

    const cb = findClearButton();
    if (cb) cb.addEventListener("click", onClear);
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  } catch (err) {
    // If anything blows up, show it on screen
    const pre = document.createElement("pre");
    pre.textContent = `index.js crash:\n${String(err?.stack || err)}`;
    pre.style.position = "fixed";
    pre.style.left = "10px";
    pre.style.right = "10px";
    pre.style.top = "10px";
    pre.style.zIndex = "999999";
    pre.style.padding = "10px";
    pre.style.background = "rgba(200,0,0,0.85)";
    pre.style.color = "white";
    pre.style.whiteSpace = "pre-wrap";
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(pre));
  }
})();
