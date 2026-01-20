(() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function showBanner() {
    const b = document.createElement("div");
    b.textContent = "INDEX.JS LOADED — vCALFIX-1";
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

  function findFileInput() { return qs('input[type="file"]'); }
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
    return qsa("div, p, span")
      .find((el) => (el.textContent || "").trim() === "Add a photo to begin.") || null;
  }

  async function getFileWithRetry(inputEl, delaysMs) {
    for (const d of delaysMs) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      const f = inputEl?.files?.[0] || null;
      if (f) return f;
    }
    return null;
  }

  // -------- state --------
  let selectedFile = null;
  let objectUrl = null;

  let pixelsPerInch = null;
  let bull = null;
  let calTaps = [];
  let shotTaps = [];

  const MODE = { SHOTS: "shots", CAL_1IN: "cal_1in", SET_BULL: "set_bull" };
  let mode = MODE.SHOTS;

  // -------- mounted ui --------
  let mounted = {
    wrapper: null,
    img: null,
    overlay: null,
    instruction: null,
    panel: null,
    results: null,
    tapsCounter: null,
    calCounter: null,
    btnCal: null,
    btnBull: null,
    btnAnalyze: null,
  };

  function isAlive() {
    return !!(mounted.wrapper && document.body.contains(mounted.wrapper));
  }

  function setInstruction(text) {
    if (mounted.instruction) mounted.instruction.textContent = text;
  }

  function setModeBadge() {
    // Make the instruction line always show the armed mode + calibration status
    if (!mounted.instruction) return;

    const calInfo = pixelsPerInch
      ? ` | Calibrated: ${pixelsPerInch.toFixed(2)} px/in`
      : ` | Cal: ${calTaps.length}/2`;

    const modeInfo =
      mode === MODE.CAL_1IN ? "MODE: CALIBRATE (tap 2 points 1.00\" apart)" :
      mode === MODE.SET_BULL ? "MODE: SET BULL (tap center)" :
      "MODE: SHOTS (tap holes)";

    mounted.instruction.textContent = `${modeInfo}${calInfo}`;
  }

  function setTapsCount(n) {
    const tapsLine = findTapsLine();
    if (tapsLine) tapsLine.textContent = `Taps: ${n}`;
    if (mounted.tapsCounter) mounted.tapsCounter.textContent = `Taps: ${n}`;
  }

  function setCalCount() {
    if (mounted.calCounter) {
      mounted.calCounter.textContent = pixelsPerInch
        ? `Cal: OK`
        : `Cal: ${calTaps.length}/2`;
    }
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

  function styleBtnActive(btn, active) {
    if (!btn) return;
    btn.style.background = active ? "rgba(0,180,120,0.35)" : "rgba(255,255,255,0.06)";
    btn.style.border = active ? "1px solid rgba(0,255,160,0.55)" : "1px solid rgba(255,255,255,0.15)";
  }

  function ensureUI() {
    if (isAlive()) return;

    const host = findAddPhotoPill() || (() => {
      const fi = findFileInput();
      const d = document.createElement("div");
      d.style.marginTop = "12px";
      (fi?.parentElement || document.body).appendChild(d);
      return d;
    })();

    host.textContent = "";
    host.style.position = "relative";
    host.style.overflow = "hidden";

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
    host.appendChild(wrapper);

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

    const calCounter = document.createElement("div");
    calCounter.style.opacity = "0.9";
    calCounter.textContent = "Cal: 0/2";

    panel.appendChild(btnCal);
    panel.appendChild(btnBull);
    panel.appendChild(btnAnalyze);
    panel.appendChild(tapsCounter);
    panel.appendChild(calCounter);

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

    host.appendChild(panel);
    host.appendChild(results);

    mounted = { wrapper, img, overlay, instruction, panel, results, tapsCounter, calCounter, btnCal, btnBull, btnAnalyze };

    // ---- tap capture (pointerdown + touchstart + click) ----
    const handleTapAtClient = (clientX, clientY) => {
      if (!mounted.img || mounted.img.style.display === "none") return;

      const rect = mounted.img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (rect.width <= 0 || rect.height <= 0) return;

      const xPx = clamp01(x / rect.width) * rect.width;
      const yPx = clamp01(y / rect.height) * rect.height;

      if (mode === MODE.CAL_1IN) {
        calTaps.push({ xPx, yPx });
        setCalCount();
        redrawDots();

        if (calTaps.length === 2) {
          const dx = calTaps[1].xPx - calTaps[0].xPx;
          const dy = calTaps[1].yPx - calTaps[0].yPx;
          const distPx = Math.hypot(dx, dy);

          pixelsPerInch = distPx; // because the distance is exactly 1 inch
          mode = MODE.SHOTS;

          styleBtnActive(btnCal, false);
          styleBtnActive(btnBull, false);

          setCalCount();
          setModeBadge();
        } else {
          setModeBadge();
        }
        return;
      }

      if (mode === MODE.SET_BULL) {
        bull = { xPx, yPx };
        mode = MODE.SHOTS;
        styleBtnActive(btnBull, false);
        setModeBadge();
        redrawDots();
        return;
      }

      shotTaps.push({ xPx, yPx });
      setTapsCount(shotTaps.length);
      addDot(xPx, yPx, "shot");
    };

    wrapper.addEventListener("pointerdown", (e) => {
      handleTapAtClient(e.clientX, e.clientY);
    });

    wrapper.addEventListener("touchstart", (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      handleTapAtClient(t.clientX, t.clientY);
    }, { passive: true });

    wrapper.addEventListener("click", (e) => {
      handleTapAtClient(e.clientX, e.clientY);
    });

    // Buttons
    btnCal.addEventListener("click", () => {
      if (!selectedFile) return;

      mode = MODE.CAL_1IN;
      calTaps = [];
      pixelsPerInch = null;
      setCalCount();

      styleBtnActive(btnCal, true);
      styleBtnActive(btnBull, false);

      if (mounted.results) mounted.results.textContent = "";
      redrawDots();
      setModeBadge();
    });

    btnBull.addEventListener("click", () => {
      if (!selectedFile) return;

      mode = MODE.SET_BULL;
      styleBtnActive(btnBull, true);
      styleBtnActive(btnCal, false);

      if (mounted.results) mounted.results.textContent = "";
      setModeBadge();
    });

    btnAnalyze.addEventListener("click", () => {
      if (mounted.results) mounted.results.textContent = analyze();
    });

    // Resize/orientation
    const rerender = () => setTimeout(() => redrawDots(), 150);
    window.addEventListener("resize", rerender);
    window.addEventListener("orientationchange", rerender);

    // Initialize badge text
    setCalCount();
    setModeBadge();
  }

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
    if (!pixelsPerInch) return "Missing calibration.\nTap “Calibrate 1 inch” then tap TWO points 1.00\" apart.\n";
    if (!bull) return "Missing bull.\nTap “Set Bull” then tap the bull center.\n";
    if (shotTaps.length < 3) return "Need at least 3 shot taps.\n";

    const initial = centroid(shotTaps);
    const ranked = shotTaps
      .map((p) => ({ p, d: Math.hypot(p.xPx - initial.xPx, p.yPx - initial.yPx) }))
      .sort((a, b) => a.d - b.d);
    const kept = ranked.slice(0, Math.min(7, ranked.length)).map((x) => x.p);

    const poibPx = centroid(kept);

    const dxPx = poibPx.xPx - bull.xPx; // + right
    const dyPx = poibPx.yPx - bull.yPx; // + down

    const dxIn = dxPx / pixelsPerInch;
    const dyIn = dyPx / pixelsPerInch;

    const inchesPerMOA = 1.047 * (yardsSafe / 100);

    const windMOA = dxIn / inchesPerMOA;
    const elevMOA = dyIn / inchesPerMOA;

    const moaPerClick = 0.25;
    const windClicks = windMOA / moaPerClick;
    const elevClicks = elevMOA / moaPerClick;

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

  async function onFilePicked(e) {
    ensureUI();
    const file = await getFileWithRetry(e?.target, [0, 50, 250, 800]);
    if (!file) return;

    selectedFile = file;

    // reset state
    pixelsPerInch = null;
    bull = null;
    calTaps = [];
    shotTaps = [];
    mode = MODE.SHOTS;
    setTapsCount(0);

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    ensureUI(); // re-check after picker close (DOM may have changed)
    mounted.img.src = objectUrl;
    mounted.img.style.display = "block";

    mounted.results.textContent = "";
    setCalCount();
    setModeBadge();

    mounted.img.onload = () => redrawDots();
  }

  function onClear() {
    const fi = findFileInput();
    if (fi) fi.value = "";

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
    clearOverlay();
    setCalCount();
    setModeBadge();
  }

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
