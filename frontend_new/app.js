// frontend_new/app.js
// Analyze (Auto POIB) v2:
// - Finds bull center via strongest vertical + horizontal lines (crosshair)
// - Finds bullet holes via connected components with shape filters
// - Estimates scale using grid periodicity (autocorrelation) so inches are not tiny
// - Outputs POIB in inches relative to bull (Bull forced to 0,0)
// Convention locked:
//   Right = +X, Up = +Y
//   POIB is where the group is relative to bull
//   Correction is bull - POIB (handled by backend)

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    apiStatus: $("apiStatus"),
    apiUrl: $("apiUrl"),
    distanceYards: $("distanceYards"),
    clickValueMoa: $("clickValueMoa"),
    trueMoa: $("trueMoa"),
    bullX: $("bullX"),
    bullY: $("bullY"),
    poibX: $("poibX"),
    poibY: $("poibY"),
    photo: $("photo"),
    analyzeBtn: $("analyzeBtn"),
    calcBtn: $("calcBtn"),
    preview: $("preview"),
    debugText: $("debugText"),

    // results
    windageDir: $("windageDir"),
    windageClicks: $("windageClicks"),
    windageMoa: $("windageMoa"),
    elevDir: $("elevDir"),
    elevClicks: $("elevClicks"),
    elevMoa: $("elevMoa"),
    dxIn: $("dxIn"),
    dyIn: $("dyIn"),
  };

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function setStatus(connected, urlText, extraText) {
    if (!els.apiStatus) return;
    els.apiStatus.textContent = connected ? "CONNECTED" : "NOT CONNECTED";
    els.apiStatus.className = connected ? "ok" : "bad";
    if (els.apiUrl) els.apiUrl.textContent = urlText || "";
    if (els.debugText && extraText) els.debugText.textContent = extraText;
  }

  async function checkApi() {
    try {
      if (!window.getHealth) throw new Error("getHealth not found (api.js not loaded)");
      const data = await window.getHealth();
      const base = (window.SCZN3_API_BASE || window.API_BASE || "").toString();
      setStatus(true, `${base} (health OK)`, "");
      return true;
    } catch (e) {
      const base = (window.SCZN3_API_BASE || window.API_BASE || "").toString();
      setStatus(false, base ? `${base} (health failed)` : "(no backend url detected)", String(e && e.message ? e.message : e));
      return false;
    }
  }

  function readInputs() {
    const distanceYards = Number(els.distanceYards?.value ?? 100);
    const clickValueMoa = Number(els.clickValueMoa?.value ?? 0.25);
    const trueMoa = String(els.trueMoa?.value ?? "ON").toUpperCase() === "ON";

    const bull = {
      x: Number(els.bullX?.value ?? 0),
      y: Number(els.bullY?.value ?? 0),
    };

    const poib = {
      x: Number(els.poibX?.value ?? 0),
      y: Number(els.poibY?.value ?? 0),
    };

    return { distanceYards, clickValueMoa, trueMoa, bull, poib };
  }

  function renderResult(r) {
    // Expect backend to return something like:
    // {
    //   dxIn, dyIn,
    //   windageDir, windageClicks, windageMoa,
    //   elevationDir, elevationClicks, elevationMoa
    // }
    if (!r || typeof r !== "object") return;

    if (els.windageDir) els.windageDir.textContent = String(r.windageDir || "");
    if (els.windageClicks) els.windageClicks.textContent = fmt2(r.windageClicks);
    if (els.windageMoa) els.windageMoa.textContent = fmt2(r.windageMoa);

    if (els.elevDir) els.elevDir.textContent = String(r.elevationDir || r.elevDir || "");
    if (els.elevClicks) els.elevClicks.textContent = fmt2(r.elevationClicks ?? r.elevClicks);
    if (els.elevMoa) els.elevMoa.textContent = fmt2(r.elevationMoa ?? r.elevMoa);

    if (els.dxIn) els.dxIn.textContent = fmt2(r.dxIn);
    if (els.dyIn) els.dyIn.textContent = fmt2(r.dyIn);
  }

  async function runCalc() {
    const ok = await checkApi();
    if (!ok) return;

    const { distanceYards, clickValueMoa, trueMoa, bull, poib } = readInputs();

    try {
      if (!window.postCalc) throw new Error("postCalc not found (api.js not loaded)");
      const payload = { distanceYards, clickValueMoa, trueMoa, bull, poib };
      const r = await window.postCalc(payload);
      renderResult(r);
      if (els.debugText) els.debugText.textContent = "";
    } catch (e) {
      if (els.debugText) els.debugText.textContent = `Calc error: ${String(e && e.message ? e.message : e)}`;
    }
  }

  // ---------- Image analysis helpers ----------

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  function drawToCanvasScaled(img, canvas, maxW, maxH) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    let scale = 1;
    if (w > maxW) scale = Math.min(scale, maxW / w);
    if (h > maxH) scale = Math.min(scale, maxH / h);

    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    return ctx;
  }

  function makeDarkMask(imgData, w, h, thresh) {
    const data = imgData.data;
    const mask = new Uint8Array(w * h);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // luminance
      const y = (0.299 * r + 0.587 * g + 0.114 * b);
      mask[p] = (y < thresh) ? 1 : 0;
    }
    return mask;
  }

  function projectionSums(mask, w, h, x0, x1, y0, y1) {
    const col = new Float64Array(w);
    const row = new Float64Array(h);

    const xx0 = Math.max(0, x0 | 0);
    const xx1 = Math.min(w, x1 | 0);
    const yy0 = Math.max(0, y0 | 0);
    const yy1 = Math.min(h, y1 | 0);

    for (let y = yy0; y < yy1; y++) {
      let base = y * w;
      for (let x = xx0; x < xx1; x++) {
        if (mask[base + x]) {
          col[x] += 1;
          row[y] += 1;
        }
      }
    }
    return { col, row };
  }

  function argMaxInRange(arr, start, end) {
    let bestI = start;
    let bestV = -Infinity;
    for (let i = start; i < end; i++) {
      const v = arr[i];
      if (v > bestV) {
        bestV = v;
        bestI = i;
      }
    }
    return bestI;
  }

  // Autocorrelation to estimate grid periodicity
  function bestLagAutocorr(arr, minLag, maxLag) {
    const n = arr.length;
    // mean center
    let mean = 0;
    for (let i = 0; i < n; i++) mean += arr[i];
    mean /= n;

    // precompute centered
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = arr[i] - mean;

    let bestLag = minLag;
    let bestScore = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      // normalized-ish dot product
      for (let i = 0; i < n - lag; i++) {
        s += a[i] * a[i + lag];
      }
      if (s > bestScore) {
        bestScore = s;
        bestLag = lag;
      }
    }
    return bestLag;
  }

  function estimatePixelsPerInch(mask, w, h) {
    // Use central band to avoid borders
    const x0 = Math.round(w * 0.15), x1 = Math.round(w * 0.85);
    const y0 = Math.round(h * 0.20), y1 = Math.round(h * 0.80);

    const { col, row } = projectionSums(mask, w, h, x0, x1, y0, y1);

    // Use reasonable lag search window
    const lagX = bestLagAutocorr(col, 8, 80);
    const lagY = bestLagAutocorr(row, 8, 80);

    // If lag is small, assume it's the minor grid and multiply by 4.
    const pxPerInX = (lagX < 30) ? (lagX * 4) : lagX;
    const pxPerInY = (lagY < 30) ? (lagY * 4) : lagY;

    // Blend + clamp
    let pxPerIn = (pxPerInX + pxPerInY) / 2;
    if (!Number.isFinite(pxPerIn) || pxPerIn < 30) pxPerIn = 80; // safe fallback
    if (pxPerIn > 250) pxPerIn = 120; // prevent insane scale

    return pxPerIn;
  }

  function zeroBand(mask, w, h, xCenter, yCenter, bandPx) {
    const b = Math.max(2, bandPx | 0);
    const x0 = Math.max(0, xCenter - b), x1 = Math.min(w, xCenter + b);
    const y0 = Math.max(0, yCenter - b), y1 = Math.min(h, yCenter + b);

    // vertical band
    for (let y = 0; y < h; y++) {
      const base = y * w;
      for (let x = x0; x < x1; x++) mask[base + x] = 0;
    }

    // horizontal band
    for (let y = y0; y < y1; y++) {
      const base = y * w;
      for (let x = 0; x < w; x++) mask[base + x] = 0;
    }
  }

  function zeroCircle(mask, w, h, cx, cy, r) {
    const rr = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));

    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const base = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= rr) mask[base + x] = 0;
      }
    }
  }

  function findComponents(mask, w, h, bullX, bullY, pxPerIn) {
    const visited = new Uint8Array(w * h);
    const comps = [];

    const edgePad = 6;
    const excludeR = pxPerIn * 0.9; // exclude bull ring area

    // stack arrays for flood fill (faster than push/pop objects)
    const stackX = new Int32Array(w * h > 300000 ? 300000 : (w * h));
    const stackY = new Int32Array(w * h > 300000 ? 300000 : (w * h));

    for (let y = 0; y < h; y++) {
      const base = y * w;
      for (let x = 0; x < w; x++) {
        const p = base + x;
        if (!mask[p] || visited[p]) continue;

        // flood fill
        let sp = 0;
        stackX[sp] = x;
        stackY[sp] = y;
        sp++;

        visited[p] = 1;

        let area = 0;
        let sumX = 0, sumY = 0;
        let minX = x, maxX = x, minY = y, maxY = y;

        while (sp > 0) {
          sp--;
          const cx = stackX[sp];
          const cy = stackY[sp];
          area++;
          sumX += cx;
          sumY += cy;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 8-neighbors
          for (let ny = cy - 1; ny <= cy + 1; ny++) {
            if (ny < 0 || ny >= h) continue;
            const nbase = ny * w;
            for (let nx = cx - 1; nx <= cx + 1; nx++) {
              if (nx < 0 || nx >= w) continue;
              const np = nbase + nx;
              if (!mask[np] || visited[np]) continue;
              visited[np] = 1;

              if (sp < stackX.length) {
                stackX[sp] = nx;
                stackY[sp] = ny;
                sp++;
              }
            }
          }
        }

        // component stats
        const compCx = sumX / area;
        const compCy = sumY / area;
        const bw = (maxX - minX + 1);
        const bh = (maxY - minY + 1);
        const aspect = Math.max(bw / bh, bh / bw);

        // Filters:
        // - area: hole blobs only (grid lines are huge)
        // - aspect: holes ~ roundish, grid fragments are long
        // - not near edge
        // - not near bull
        if (area < 40 || area > 6000) continue;
        if (aspect > 3.0) continue;
        if (minX < edgePad || minY < edgePad || maxX > (w - edgePad) || maxY > (h - edgePad)) continue;

        const dx = compCx - bullX;
        const dy = compCy - bullY;
        if (dx * dx + dy * dy < excludeR * excludeR) continue;

        comps.push({
          area,
          cx: compCx,
          cy: compCy,
          minX, minY, maxX, maxY,
          bw, bh
        });
      }
    }

    return comps;
  }

  function clusterCentroid(comps, pxPerIn) {
    if (!comps.length) return null;

    // Sort by area, keep top chunk
    const top = comps.slice().sort((a, b) => b.area - a.area).slice(0, 20);

    // Median center (robust)
    const xs = top.map(c => c.cx).sort((a, b) => a - b);
    const ys = top.map(c => c.cy).sort((a, b) => a - b);
    const mx = xs[Math.floor(xs.length / 2)];
    const my = ys[Math.floor(ys.length / 2)];

    // Keep those within ~3 inches of median
    const r = pxPerIn * 3.0;
    const r2 = r * r;
    const kept = top.filter(c => {
      const dx = c.cx - mx;
      const dy = c.cy - my;
      return (dx * dx + dy * dy) <= r2;
    });

    if (!kept.length) return null;

    // Area-weighted centroid
    let A = 0, sx = 0, sy = 0;
    for (const c of kept) {
      A += c.area;
      sx += c.area * c.cx;
      sy += c.area * c.cy;
    }
    return { cx: sx / A, cy: sy / A, kept };
  }

  function drawDots(ctx, comps, color) {
    ctx.save();
    ctx.fillStyle = color || "red";
    for (const c of comps) {
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCross(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
    ctx.restore();
  }

  async function analyzeAutoPOIB() {
    const ok = await checkApi();
    if (!ok) return;

    const file = els.photo?.files?.[0];
    if (!file) {
      if (els.debugText) els.debugText.textContent = "Pick a target photo first.";
      return;
    }

    try {
      const img = await loadImageFromFile(file);

      // Draw scaled image to preview canvas (keeps analysis fast)
      const ctx = drawToCanvasScaled(img, els.preview, 1100, 1400);
      const w = els.preview.width;
      const h = els.preview.height;

      const imgData = ctx.getImageData(0, 0, w, h);

      // 1) Make dark pixel mask
      const mask = makeDarkMask(imgData, w, h, 135);

      // 2) Estimate pixels per inch using grid periodicity
      const pxPerIn = estimatePixelsPerInch(mask, w, h);

      // 3) Find bull center via strongest vertical/horizontal lines in central region
      const x0 = Math.round(w * 0.20), x1 = Math.round(w * 0.80);
      const y0 = Math.round(h * 0.20), y1 = Math.round(h * 0.80);
      const { col, row } = projectionSums(mask, w, h, x0, x1, y0, y1);

      const bullX = argMaxInRange(col, x0, x1);
      const bullY = argMaxInRange(row, y0, y1);

      // 4) Remove crosshair bands + bull ring area from mask so we keep only holes
      const bandPx = Math.max(6, Math.round(pxPerIn * 0.18)); // ~0.18 inch
      zeroBand(mask, w, h, bullX, bullY, bandPx);

      const bullR = Math.max(20, Math.round(pxPerIn * 0.75)); // ~0.75 inch
      zeroCircle(mask, w, h, bullX, bullY, bullR);

      // 5) Connected components to find hole blobs
      const comps = findComponents(mask, w, h, bullX, bullY, pxPerIn);

      if (!comps.length) {
        if (els.debugText) els.debugText.textContent = "No hole components found. Try a clearer photo or different lighting.";
        // still draw bull cross for debugging
        drawCross(ctx, bullX, bullY);
        return;
      }

      // 6) Cluster centroid (robust)
      const cluster = clusterCentroid(comps, pxPerIn);
      if (!cluster) {
        if (els.debugText) els.debugText.textContent = "Holes detected, but cluster selection failed. Try a clearer photo.";
        drawCross(ctx, bullX, bullY);
        return;
      }

      // 7) Convert to inches relative to bull
      const dxPx = cluster.cx - bullX;      // + right
      const dyPx = cluster.cy - bullY;      // + down
      const poibX = dxPx / pxPerIn;         // + right
      const poibY = -dyPx / pxPerIn;        // + up (invert canvas Y)

      // Force bull to 0,0 for this test workflow
      if (els.bullX) els.bullX.value = "0.00";
      if (els.bullY) els.bullY.value = "0.00";

      if (els.poibX) els.poibX.value = fmt2(poibX);
      if (els.poibY) els.poibY.value = fmt2(poibY);

      // 8) Draw debug marks: bull center + detected holes
      // Red dots = kept hole blobs
      // Lime cross = bull center
      drawDots(ctx, cluster.kept, "red");
      drawCross(ctx, bullX, bullY);

      // 9) Auto-calc after analyze
      await runCalc();

      if (els.debugText) {
        els.debugText.textContent =
          `Analyze OK. px/in≈${fmt2(pxPerIn)} | POIB≈(${fmt2(poibX)}, ${fmt2(poibY)})`;
      }
    } catch (e) {
      if (els.debugText) els.debugText.textContent = `Analyze error: ${String(e && e.message ? e.message : e)}`;
    }
  }

  // ---------- Wire up ----------
  function wire() {
    if (els.calcBtn) {
      els.calcBtn.addEventListener("click", () => runCalc());
    }
    if (els.analyzeBtn) {
      els.analyzeBtn.addEventListener("click", () => analyzeAutoPOIB());
    }

    // Auto-recalc when settings change
    const ids = ["distanceYards", "clickValueMoa", "trueMoa", "bullX", "bullY", "poibX", "poibY"];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => runCalc());
      el.addEventListener("input", () => {
        // keep it responsive without spamming
        clearTimeout(el.__t);
        el.__t = setTimeout(() => runCalc(), 200);
      });
    });

    checkApi().then(() => runCalc()).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
