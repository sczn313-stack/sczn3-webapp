// frontend_new/app.js
// Analyze (Auto POIB) v3
// - Finds bull center via strongest vertical + horizontal edge energy (crosshair)
// - Finds bullet holes via connected components on dark blobs with bull/crosshair exclusion
// - Estimates pixels-per-inch using autocorrelation of vertical edge projection (grid periodicity)
// - Outputs POIB in inches relative to bull, with convention locked:
//   Right = +X, Up = +Y
//   POIB is where the group is relative to bull
//   Backend computes correction = bull - POIB

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    apiStatus: $("apiStatus"),
    apiUrl: $("apiUrl"),
    debugText: $("debugText"),

    distanceYards: $("distanceYards"),
    clickValueMoa: $("clickValueMoa"),
    trueMoa: $("trueMoa"),

    photo: $("photo"),
    analyzeBtn: $("analyzeBtn"),
    calcBtn: $("calcBtn"),

    bullX: $("bullX"),
    bullY: $("bullY"),
    poibX: $("poibX"),
    poibY: $("poibY"),

    preview: $("preview"),

    windageDir: $("windageDir"),
    windageClicks: $("windageClicks"),
    windageMoa: $("windageMoa"),

    elevDir: $("elevDir"),
    elevClicks: $("elevClicks"),
    elevMoa: $("elevMoa"),

    dxIn: $("dxIn"),
    dyIn: $("dyIn"),
    moaX: $("moaX"),
    moaY: $("moaY"),
    clicksX: $("clicksX"),
    clicksY: $("clicksY"),
  };

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function setDebug(msg) {
    els.debugText.textContent = msg || "";
  }

  function setApiStatus(connected, urlText, extra) {
    if (!els.apiStatus) return;
    els.apiStatus.textContent = connected ? "CONNECTED" : "NOT CONNECTED";
    els.apiStatus.style.color = connected ? "#bfffc7" : "#ffb7b7";
    els.apiUrl.textContent = urlText || "";
    setDebug(extra || "");
  }

  async function checkApi() {
    try {
      els.apiStatus.textContent = "Checking…";
      els.apiStatus.style.color = "#e8eef6";
      els.apiUrl.textContent = "(backend url will show here)";
      setDebug("");

      if (!window.sczn3Api || !window.sczn3Api.getHealth) {
        setApiStatus(false, "(api.js not loaded)", "Missing window.sczn3Api.getHealth");
        return;
      }

      const health = await window.sczn3Api.getHealth();
      const base = window.sczn3Api.API_BASE || window.SCZN3_API_BASE || "(unknown)";
      setApiStatus(true, `${base} (health OK)`, JSON.stringify(health));
    } catch (e) {
      const base = (window.sczn3Api && window.sczn3Api.API_BASE) || window.SCZN3_API_BASE || "(unknown)";
      setApiStatus(false, `${base}`, String(e && e.message ? e.message : e));
    }
  }

  function clearResult() {
    els.windageDir.textContent = "—";
    els.windageClicks.textContent = "—";
    els.windageMoa.textContent = "—";
    els.elevDir.textContent = "—";
    els.elevClicks.textContent = "—";
    els.elevMoa.textContent = "—";
    els.dxIn.textContent = "—";
    els.dyIn.textContent = "—";
    els.moaX.textContent = "—";
    els.moaY.textContent = "—";
    els.clicksX.textContent = "—";
    els.clicksY.textContent = "—";
  }

  async function runCalc() {
    try {
      setDebug("");

      const distanceYards = Number(els.distanceYards.value);
      const clickValueMoa = Number(els.clickValueMoa.value);
      const trueMoa = String(els.trueMoa.value) === "true";

      const bull = { x: Number(els.bullX.value), y: Number(els.bullY.value) };
      const poib = { x: Number(els.poibX.value), y: Number(els.poibY.value) };

      const payload = { distanceYards, clickValueMoa, trueMoa, bull, poib };

      if (!window.sczn3Api || !window.sczn3Api.postCalc) {
        throw new Error("postCalc not available (api.js not loaded)");
      }

      const out = await window.sczn3Api.postCalc(payload);

      // Expected backend output fields (safe access)
      const wDir = out?.windage?.dir ?? out?.windageDir ?? "—";
      const wClicks = out?.windage?.clicks ?? out?.windageClicks ?? NaN;
      const wMoa = out?.windage?.moa ?? out?.windageMoa ?? NaN;

      const eDir = out?.elevation?.dir ?? out?.elevDir ?? "—";
      const eClicks = out?.elevation?.clicks ?? out?.elevClicks ?? NaN;
      const eMoa = out?.elevation?.moa ?? out?.elevMoa ?? NaN;

      const dxIn = out?.dxIn ?? out?.dx ?? out?.deltaX ?? NaN;
      const dyIn = out?.dyIn ?? out?.dy ?? out?.deltaY ?? NaN;

      const moaX = out?.moaX ?? NaN;
      const moaY = out?.moaY ?? NaN;
      const clicksX = out?.clicksX ?? NaN;
      const clicksY = out?.clicksY ?? NaN;

      els.windageDir.textContent = String(wDir).toUpperCase();
      els.windageClicks.textContent = fmt2(wClicks);
      els.windageMoa.textContent = fmt2(wMoa);

      els.elevDir.textContent = String(eDir).toUpperCase();
      els.elevClicks.textContent = fmt2(eClicks);
      els.elevMoa.textContent = fmt2(eMoa);

      els.dxIn.textContent = fmt2(dxIn);
      els.dyIn.textContent = fmt2(dyIn);
      els.moaX.textContent = fmt2(moaX);
      els.moaY.textContent = fmt2(moaY);
      els.clicksX.textContent = fmt2(clicksX);
      els.clicksY.textContent = fmt2(clicksY);
    } catch (e) {
      clearResult();
      setDebug(String(e && e.message ? e.message : e));
    }
  }

  // ---------- Image / Analyze helpers ----------
  function drawToCanvas(img) {
    const canvas = els.preview;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return { ctx, w, h };
  }

  function getGray(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const g = new Float32Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      g[p] = (0.2126 * r + 0.7152 * gg + 0.0722 * b);
    }
    return { gray: g, imageData: img };
  }

  function sobelEnergy(gray, w, h) {
    const e = new Float32Array(w * h);
    const idx = (x, y) => y * w + x;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const a00 = gray[idx(x - 1, y - 1)], a10 = gray[idx(x, y - 1)], a20 = gray[idx(x + 1, y - 1)];
        const a01 = gray[idx(x - 1, y)],     a11 = gray[idx(x, y)],     a21 = gray[idx(x + 1, y)];
        const a02 = gray[idx(x - 1, y + 1)], a12 = gray[idx(x, y + 1)], a22 = gray[idx(x + 1, y + 1)];

        const gx = (-1 * a00) + (1 * a20) + (-2 * a01) + (2 * a21) + (-1 * a02) + (1 * a22);
        const gy = (-1 * a00) + (-2 * a10) + (-1 * a20) + (1 * a02) + (2 * a12) + (1 * a22);

        e[idx(x, y)] = Math.abs(gx) + Math.abs(gy);
      }
    }
    return e;
  }

  function findCrosshair(energy, w, h) {
    // Strongest vertical line = max column sum of energy
    const col = new Float32Array(w);
    const row = new Float32Array(h);

    for (let y = 0; y < h; y++) {
      let rs = 0;
      const off = y * w;
      for (let x = 0; x < w; x++) {
        const v = energy[off + x];
        col[x] += v;
        rs += v;
      }
      row[y] = rs;
    }

    let bestX = 0, bestXV = -1;
    for (let x = 0; x < w; x++) {
      if (col[x] > bestXV) { bestXV = col[x]; bestX = x; }
    }

    let bestY = 0, bestYV = -1;
    for (let y = 0; y < h; y++) {
      if (row[y] > bestYV) { bestYV = row[y]; bestY = y; }
    }

    return { bullXpx: bestX, bullYpx: bestY, col, row };
  }

  function autocorrPeriod(signal, minLag, maxLag) {
    // signal: Float32Array
    // returns best lag in [minLag, maxLag]
    const n = signal.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += signal[i];
    mean /= n;

    // demean
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = signal[i] - mean;

    let bestLag = 0;
    let bestVal = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let v = 0;
      const limit = n - lag;
      for (let i = 0; i < limit; i++) v += s[i] * s[i + lag];
      if (v > bestVal) { bestVal = v; bestLag = lag; }
    }

    return { bestLag, bestVal };
  }

  function estimatePixelsPerInch(energy, w, h, bullXpx, bullYpx) {
    // Build a vertical-edge-ish projection by summing energy down rows
    // and exclude a band around the crosshair so it doesn't dominate.
    const proj = new Float32Array(w);
    const band = Math.max(8, Math.round(w * 0.01));

    for (let y = 0; y < h; y++) {
      const off = y * w;
      for (let x = 0; x < w; x++) {
        if (Math.abs(x - bullXpx) <= band) continue;
        proj[x] += energy[off + x];
      }
    }

    // Typical 1" grid period in photos is usually 30–220 px depending on scale.
    const { bestLag } = autocorrPeriod(proj, 20, Math.min(260, w - 5));

    // Fail-safe
    const ppi = (bestLag && bestLag > 0) ? bestLag : 100;
    return ppi;
  }

  function detectDarkBlobs(gray, w, h, bullXpx, bullYpx) {
    // Adaptive-ish threshold using mean - k*std (simple + stable)
    let mean = 0;
    for (let i = 0; i < gray.length; i++) mean += gray[i];
    mean /= gray.length;

    let varSum = 0;
    for (let i = 0; i < gray.length; i++) {
      const d = gray[i] - mean;
      varSum += d * d;
    }
    const std = Math.sqrt(varSum / gray.length);

    // Dark pixels are well below mean
    const thr = mean - 1.25 * std;

    const idx = (x, y) => y * w + x;

    // Exclusions: bull circle + crosshair band
    const crossBand = Math.max(10, Math.round(w * 0.012));
    const bullR = Math.max(18, Math.round(Math.min(w, h) * 0.04)); // excludes bull ring region

    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = idx(x, y);

        // exclude crosshair bands
        if (Math.abs(x - bullXpx) <= crossBand) continue;
        if (Math.abs(y - bullYpx) <= crossBand) continue;

        // exclude center bull circle region
        const dx = x - bullXpx;
        const dy = y - bullYpx;
        if ((dx * dx + dy * dy) <= (bullR * bullR)) continue;

        if (gray[p] < thr) mask[p] = 1;
      }
    }

    // Connected components (4-neighbor)
    const visited = new Uint8Array(w * h);
    const comps = [];

    const qx = new Int32Array(w * h);
    const qy = new Int32Array(w * h);

    for (let y0 = 0; y0 < h; y0++) {
      for (let x0 = 0; x0 < w; x0++) {
        const p0 = idx(x0, y0);
        if (!mask[p0] || visited[p0]) continue;

        let head = 0, tail = 0;
        qx[tail] = x0; qy[tail] = y0; tail++;
        visited[p0] = 1;

        let area = 0;
        let sumX = 0, sumY = 0;
        let minX = x0, maxX = x0, minY = y0, maxY = y0;

        while (head < tail) {
          const x = qx[head];
          const y = qy[head];
          head++;

          area++;
          sumX += x;
          sumY += y;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          // neighbors
          const n1 = (x > 0) ? idx(x - 1, y) : -1;
          const n2 = (x < w - 1) ? idx(x + 1, y) : -1;
          const n3 = (y > 0) ? idx(x, y - 1) : -1;
          const n4 = (y < h - 1) ? idx(x, y + 1) : -1;

          if (n1 >= 0 && mask[n1] && !visited[n1]) { visited[n1] = 1; qx[tail] = x - 1; qy[tail] = y; tail++; }
          if (n2 >= 0 && mask[n2] && !visited[n2]) { visited[n2] = 1; qx[tail] = x + 1; qy[tail] = y; tail++; }
          if (n3 >= 0 && mask[n3] && !visited[n3]) { visited[n3] = 1; qx[tail] = x; qy[tail] = y - 1; tail++; }
          if (n4 >= 0 && mask[n4] && !visited[n4]) { visited[n4] = 1; qx[tail] = x; qy[tail] = y + 1; tail++; }
        }

        // Filter blobs by size and aspect ratio to prefer hole-like marks
        const wBox = (maxX - minX + 1);
        const hBox = (maxY - minY + 1);
        const aspect = wBox / hBox;

        // These thresholds are intentionally broad (your photo can vary)
        if (area >= 20 && area <= 2500 && aspect > 0.35 && aspect < 2.8) {
          comps.push({
            cx: sumX / area,
            cy: sumY / area,
            area,
            minX, maxX, minY, maxY,
          });
        }
      }
    }

    // Keep only the most plausible (largest few) if too many
    comps.sort((a, b) => b.area - a.area);
    return comps.slice(0, 12);
  }

  function drawOverlay(ctx, w, h, bullXpx, bullYpx, comps) {
    // redraw image already on canvas, just overlay markers
    ctx.save();

    // bull cross marker
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.moveTo(bullXpx - 18, bullYpx);
    ctx.lineTo(bullXpx + 18, bullYpx);
    ctx.moveTo(bullXpx, bullYpx - 18);
    ctx.lineTo(bullXpx, bullYpx + 18);
    ctx.stroke();

    // bullet dots
    ctx.fillStyle = "rgba(255,0,0,0.9)";
    for (const c of comps) {
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  async function analyzeAuto() {
    try {
      setDebug("");
      clearResult();

      const file = els.photo.files && els.photo.files[0];
      if (!file) throw new Error("Choose a target photo first.");

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = URL.createObjectURL(file);

      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Could not load image"));
      });

      const { ctx, w, h } = drawToCanvas(img);
      const { gray } = getGray(ctx, w, h);

      const energy = sobelEnergy(gray, w, h);
      const cross = findCrosshair(energy, w, h);

      const bullXpx = cross.bullXpx;
      const bullYpx = cross.bullYpx;

      const ppi = estimatePixelsPerInch(energy, w, h, bullXpx, bullYpx);

      const comps = detectDarkBlobs(gray, w, h, bullXpx, bullYpx);

      if (comps.length === 0) {
        drawOverlay(ctx, w, h, bullXpx, bullYpx, comps);
        throw new Error("No bullet holes detected. If red dots are missing, the threshold needs tightening/loosening.");
      }

      // group center in pixels
      let sx = 0, sy = 0;
      for (const c of comps) { sx += c.cx; sy += c.cy; }
      const gx = sx / comps.length;
      const gy = sy / comps.length;

      // POIB in inches relative to bull, with Up = +Y
      // canvas y increases downward, so Up is (bullYpx - gy)
      const poibX = (gx - bullXpx) / ppi;         // Right + (group right of bull)
      const poibY = (bullYpx - gy) / ppi;         // Up + (group above bull)

      // Update fields
      els.bullX.value = fmt2(0);
      els.bullY.value = fmt2(0);
      els.poibX.value = fmt2(poibX);
      els.poibY.value = fmt2(poibY);

      drawOverlay(ctx, w, h, bullXpx, bullYpx, comps);

      // Auto-calc after analyze
      await runCalc();

      setDebug(`Detected holes: ${comps.length}\nPixels/inch estimate: ${Math.round(ppi)}\nGroup(px): (${gx.toFixed(1)}, ${gy.toFixed(1)})\nBull(px): (${bullXpx}, ${bullYpx})`);
    } catch (e) {
      setDebug(String(e && e.message ? e.message : e));
    }
  }

  function wire() {
    els.analyzeBtn.addEventListener("click", (e) => { e.preventDefault(); analyzeAuto(); });
    els.calcBtn.addEventListener("click", (e) => { e.preventDefault(); runCalc(); });

    // auto-recalc on settings/inputs change (manual flow)
    [
      "distanceYards",
      "clickValueMoa",
      "trueMoa",
      "bullX",
      "bullY",
      "poibX",
      "poibY",
    ].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => runCalc().catch(() => {}));
      el.addEventListener("input", () => runCalc().catch(() => {}));
    });

    checkApi();
  }

  wire();
})();
