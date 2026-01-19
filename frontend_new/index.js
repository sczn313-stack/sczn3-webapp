/* ============================================================================
  Tap-N-Score — FULL index.js (iOS-safe) + 1" calibration + POIB + 2-decimal clicks
  Workflow (simple + bulletproof):
    1) Upload photo
    2) Tap "Calibrate 1 inch" → tap TWO points that are exactly 1.00" apart on the grid
    3) Tap "Set Bull" → tap the exact bull/aim point center
    4) Tap your shot holes (3–7 ideal; more is OK)
    5) Tap "Analyze" → outputs POIB (inches) + MOA + clicks (two decimals) + directions

  Notes:
    - Uses iOS retry-read to prevent “filename but no file” glitches.
    - Outlier handling: if >7 shots, keeps the 7 closest to the initial centroid.
    - Direction truth:
        impacts RIGHT  -> dial LEFT
        impacts LEFT   -> dial RIGHT
        impacts HIGH   -> dial DOWN
        impacts LOW    -> dial UP
============================================================================ */

(() => {
  // ---------- helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const fileInput = qs('input[type="file"]');
  const clearBtn = qsa("button").find((b) => (b.textContent || "").trim().toLowerCase() === "clear");
  const distanceInput =
    qs("#distance") ||
    qsa("input").find((i) => (i.placeholder || "").toLowerCase().includes("distance"));

  // Find the "Add a photo to begin." pill so we can reuse that space for the image + overlay
  const statusHost = qsa("div, p, span")
    .find((el) => (el.textContent || "").trim() === "Add a photo to begin.");

  // If the app has a "Taps:" line already, reuse it; otherwise we’ll inject our own.
  let tapsLineEl = qsa("div, p, span").find((el) => (el.textContent || "").includes("Taps:"));

  // ---------- state ----------
  let selectedFile = null;
  let objectUrl = null;

  // Calibration / bull
  let pixelsPerInch = null; // computed from 2 taps that are 1" apart
  let bull = null;          // { xPx, yPx } in DISPLAY pixels

  // Shot taps (DISPLAY pixels)
  /** @type {{xPx:number,yPx:number}[]} */
  let shotTaps = [];

  // Modes
  const MODE = {
    SHOTS: "shots",
    CAL_1IN: "cal_1in",
    SET_BULL: "set_bull",
  };
  let mode = MODE.SHOTS;

  // For calibration taps
  /** @type {{xPx:number,yPx:number}[]} */
  let calTaps = [];

  // ---------- iOS file retry ----------
  async function getFileWithRetry(inputEl, delaysMs) {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      const f = inputEl?.files?.[0] || null;
      if (f) return f;
    }
    return null;
  }

  // ---------- UI build (image + overlay + buttons + results) ----------
  let wrapper, img, overlay, panel, resultsBox, instruction, tapsCounter;

  function setInstruction(text) {
    if (instruction) instruction.textContent = text;
  }

  function setTapsCount(n) {
    if (tapsCounter) tapsCounter.textContent = `Taps: ${n}`;
    if (tapsLineEl) tapsLineEl.textContent = `Taps: ${n}`;
  }

  function clearOverlay() {
    if (overlay) overlay.innerHTML = "";
  }

  function addDot(xPx, yPx, kind) {
    // kind: "shot" | "cal" | "bull"
    if (!overlay || !img) return;

    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.left = `${xPx - 6}px`;
    dot.style.top = `${yPx - 6}px`;
    dot.style.width = "12px";
    dot.style.height = "12px";
    dot.style.borderRadius = "999px";
    dot.style.pointerEvents = "none";

    if (kind === "bull") {
      dot.style.width = "14px";
      dot.style.height = "14px";
      dot.style.left = `${xPx - 7}px`;
      dot.style.top = `${yPx - 7}px`;
      dot.style.background = "rgba(0,255,120,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else if (kind === "cal") {
      dot.style.background = "rgba(80,160,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    } else {
      dot.style.background = "rgba(255,255,255,0.95)";
      dot.style.border = "2px solid rgba(0,0,0,0.65)";
    }

    overlay.appendChild(dot);
  }

  function redrawAllDots() {
    if (!img) return;
    clearOverlay();

    // calibration points
    calTaps.forEach((p) => addDot(p.xPx, p.yPx, "cal"));

    // bull
    if (bull) addDot(bull.xPx, bull.yPx, "bull");

    // shots
    shotTaps.forEach((p) => addDot(p.xPx, p.yPx, "shot"));
  }

  function ensureUI() {
    if (!statusHost) return;

    // Convert the pill area into our image/tap area
    statusHost.textContent = "";
    statusHost.style.position = "relative";
    statusHost.style.overflow = "hidden";

    wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.style.minHeight = "260px";
    wrapper.style.borderRadius = "16px";

    img = document.createElement("img");
    img.alt = "Target preview";
    img.style.display = "none";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.borderRadius = "16px";
    img.style.userSelect = "none";
    img.style.webkitUserSelect = "none";
    img.style.touchAction = "manipulation";

    overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.pointerEvents = "none";

    instruction = document.createElement("div");
    instruction.style.padding = "14px 16px";
    instruction.style.opacity = "0.9";
    instruction.style.fontSize = "18px";
    instruction.textContent = "Add a photo to begin.";

    wrapper.appendChild(instruction);
    wrapper.appendChild(img);
    wrapper.appendChild(overlay);
    statusHost.appendChild(wrapper);

    // Control panel (injected under the image area)
    panel = document.createElement("div");
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

    tapsCounter = document.createElement("div");
    tapsCounter.style.marginLeft = "4px";
    tapsCounter.style.opacity = "0.9";
    tapsCounter.textContent = "Taps: 0";

    resultsBox = document.createElement("div");
    resultsBox.style.marginTop = "12px";
    resultsBox.style.padding = "12px 14px";
    resultsBox.style.borderRadius = "14px";
    resultsBox.style.border = "1px solid rgba(255,255,255,0.12)";
    resultsBox.style.background = "rgba(255,255,255,0.06)";
    resultsBox.style.whiteSpace = "pre-wrap";
    resultsBox.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    resultsBox.style.fontSize = "13px";
    resultsBox.textContent = "";

    panel.appendChild(btnCal);
    panel.appendChild(btnBull);
    panel.appendChild(btnAnalyze);
    panel.appendChild(tapsCounter);

    // Insert panel + results under the statusHost container
    statusHost.parentElement?.appendChild(panel);
    statusHost.parentElement?.appendChild(resultsBox);

    // Button wiring
    btnCal.addEventListener("click", () => {
      if (!selectedFile) return;
      mode = MODE.CAL_1IN;
      calTaps = [];
      pixelsPerInch = null;
      resultsBox.textContent = "";
      redrawAllDots();
      setInstruction("Calibration: tap TWO grid points exactly 1.00\" apart.");
    });

    btnBull.addEventListener("click", () => {
      if (!selectedFile) return;
      mode = MODE.SET_BULL;
      resultsBox.textContent = "";
      setInstruction("Bull: tap the exact bull/aim point center.");
    });

    btnAnalyze.addEventListener("click", () => {
      resultsBox.textContent = analyze();
    });

    // Tap handler on wrapper (click + touch)
    const onTap = (e) => {
      if (!img || img.style.display === "none") return;

      const isTouch = e.touches && e.touches[0];
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      const rect = img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (rect.width <= 0 || rect.height <= 0) return;

      const xPx = clamp01(x / rect.width) * rect.width;
      const yPx = clamp01(y / rect.height) * rect.height;

      if (mode === MODE.CAL_1IN) {
        calTaps.push({ xPx, yPx });
        redrawAllDots();
        if (calTaps.length === 2) {
          const dx = calTaps[1].xPx - calTaps[0].xPx;
          const dy = calTaps[1].yPx - calTaps[0].yPx;
          const distPx = Math.hypot(dx, dy);
          pixelsPerInch = distPx / 1.0;

          mode = MODE.SHOTS;
          setInstruction(`Calibrated: ${pixelsPerInch.toFixed(2)} px/in. Now tap shots (or Set Bull).`);
        } else {
          setInstruction("Calibration: tap the SECOND point (1.00\" away).");
        }
        return;
      }

      if (mode === MODE.SET_BULL) {
        bull = { xPx, yPx };
        mode = MODE.SHOTS;
        redrawAllDots();
        setInstruction("Bull set. Tap your shot holes.");
        return;
      }

      // shots mode
      shotTaps.push({ xPx, yPx });
      addDot(xPx, yPx, "shot");
      setTapsCount(shotTaps.length);
    };

    wrapper.addEventListener("click", onTap);
    wrapper.addEventListener("touchstart", onTap, { passive: true });

    // Re-align dots on resize/orientation change
    const rerender = () => setTimeout(() => redrawAllDots(), 150);
    window.addEventListener("resize", rerender);
    window.addEventListener("orientationchange", rerender);
  }

  // ---------- file load ----------
  async function onFilePicked(e) {
    ensureUI();

    const file = await getFileWithRetry(e?.target, [0, 50, 250, 800]);
    if (!file) return;

    selectedFile = file;

    // reset everything
    calTaps = [];
    pixelsPerInch = null;
    bull = null;
    shotTaps = [];
    setTapsCount(0);
    if (resultsBox) resultsBox.textContent = "";
    mode = MODE.SHOTS;

    // show image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    instruction.textContent = "Loaded. Tap “Calibrate 1 inch” first.";
    img.src = objectUrl;
    img.style.display = "block";
    img.onload = () => {
      redrawAllDots();
    };
  }

  // ---------- clear ----------
  function hardClear() {
    selectedFile = null;

    if (fileInput) fileInput.value = "";
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
    if (resultsBox) resultsBox.textContent = "";

    if (img) {
      img.src = "";
      img.style.display = "none";
    }
    if (instruction) instruction.textContent = "Add a photo to begin.";
    clearOverlay();
  }

  // ---------- math (cluster + POIB + clicks) ----------
  function analyze() {
    if (!selectedFile) return "No photo.\n";
    if (!pixelsPerInch) return "Missing calibration.\nTap “Calibrate 1 inch”, then tap TWO points 1.00\" apart.\n";
    if (!bull) return "Missing bull.\nTap “Set Bull”, then tap the bull/aim point center.\n";
    if (shotTaps.length < 3) return "Need at least 3 shot taps.\n";

    // Distance (yards)
    const yards = Number(distanceInput?.value || 100);
    const yardsSafe = Number.isFinite(yards) && yards > 0 ? yards : 100;

    // Outlier handling: if >7 shots, keep 7 closest to initial centroid
    const maxShots = 7;
    const minShots = 3;

    const initial = centroid(shotTaps);
    const ranked = shotTaps
      .map((p) => ({ p, d: Math.hypot(p.xPx - initial.xPx, p.yPx - initial.yPx) }))
      .sort((a, b) => a.d - b.d);

    const kept = ranked.slice(0, Math.min(maxShots, ranked.length)).map((x) => x.p);
    if (kept.length < minShots) return "Not enough shots after filtering.\n";

    const poibPx = centroid(kept);

    // Offset from bull in inches (DISPLAY pixels / pixelsPerInch)
    const dxPx = poibPx.xPx - bull.xPx; // + right
    const dyPx = poibPx.yPx - bull.yPx; // + down (screen)

    const dxIn = dxPx / pixelsPerInch;
    const dyIn = dyPx / pixelsPerInch;

    // Convert inches to MOA
    // 1 MOA = 1.047" at 100 yards => at D yards, 1 MOA = 1.047 * (D/100)
    const inchesPerMOA = 1.047 * (yardsSafe / 100);
    const windMOA = dxIn / inchesPerMOA;
    const elevMOA = dyIn / inchesPerMOA;

    // Click value (default 1/4 MOA)
    const moaPerClick = 0.25;

    const windClicks = windMOA / moaPerClick;
    const elevClicks = elevMOA / moaPerClick;

    // Direction truth: dial opposite of impact offset
    const windDir = dxIn > 0 ? "LEFT" : dxIn < 0 ? "RIGHT" : "OK";
    const elevDir = dyIn > 0 ? "UP" : dyIn < 0 ? "DOWN" : "OK";

    // Magnitudes (two decimals always)
    const abs = (n) => Math.abs(n);

    const keptNote = kept.length !== shotTaps.length
      ? `Filtered: kept ${kept.length} of ${shotTaps.length} (closest cluster)\n`
      : "";

    return (
      keptNote +
      `Calibration: ${pixelsPerInch.toFixed(2)}
