// frontend_new/app.js
// Analyze (Auto POIB) v4
// - Forces a visible preview area
// - Shows selected image immediately (before Analyze)
// - ROI masking to ignore labels/rulers
// - Stronger hole filtering
// - Direction + Δ locked to bull − POIB

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    apiStatus: $("apiStatus"),
    apiUrl: $("apiUrl"),
    debugText: $("debugText"),

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

  // ---------- Utilities ----------
  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function setDebug(lines) {
    if (!els.debugText) return;
    els.debugText.textContent = (lines || []).join("\n");
  }

  function getNum(inputEl, fallback = 0) {
    if (!inputEl) return fallback;
    const v = Number(String(inputEl.value ?? "").trim());
    return Number.isFinite(v) ? v : fallback;
  }

  function setVal(inputEl, v) {
    if (!inputEl) return;
    inputEl.value = fmt2(v);
  }

  function clampInt(v, lo, hi) {
    const x = v | 0;
    if (x < lo) return lo;
    if (x > hi) return hi;
    return x;
  }

  function getSettings() {
    const distanceYards = getNum(els.distanceYards, 100);
    const clickValueMoa = getNum(els.clickValueMoa, 0.25);
    const trueMoa = String(els.trueMoa?.value ?? "ON").toUpperCase() === "ON";
    return { distanceYards, clickValueMoa, trueMoa };
  }

  function inchesPerMOA(distanceYards, trueMoa) {
    const base = trueMoa ? 1.047 : 1.0;
    return base * (distanceYards / 100);
  }

  function computeCorrectionFromInputs() {
    const bullX = getNum(els.bullX, 0);
    const bullY = getNum(els.bullY, 0);
    const poibX = getNum(els.poibX, 0);
    const poibY = getNum(els.poibY, 0);

    const dx = bullX - poibX;
    const dy = bullY - poibY;
    return { bullX, bullY, poibX, poibY, dx, dy };
  }

  function dirX(dx) {
    if (dx > 0) return "RIGHT";
    if (dx < 0) return "LEFT";
    return "CENTER";
  }

  function dirY(dy) {
    if (dy > 0) return "UP";
    if (dy < 0) return "DOWN";
    return "CENTER";
  }

  function renderDirectionsAndDeltas() {
    const { dx, dy } = computeCorrectionFromInputs();
    if (els.windageDir) els.windageDir.textContent = dirX(dx);
    if (els.elevDir) els.elevDir.textContent = dirY(dy);
    if (els.dxIn) els.dxIn.textContent = fmt2(Math.abs(dx));
    if (els.dyIn) els.dyIn.textContent = fmt2(Math.abs(dy));
  }

  function renderMOAandClicksFallback() {
    const { dx, dy } = computeCorrectionFromInputs();
    const { distanceYards, clickValueMoa, trueMoa } = getSettings();
    const inPerMoa = inchesPerMOA(distanceYards, trueMoa);

    const moaX = Math.abs(dx) / inPerMoa;
    const moaY = Math.abs(dy) / inPerMoa;

    const clicksX = moaX / clickValueMoa;
    const clicksY = moaY / clickValueMoa;

    if (els.moaX) els.moaX.textContent = fmt2(moaX);
    if (els.moaY) els.moaY.textContent = fmt2(moaY);
    if (els.clicksX) els.clicksX.textContent = fmt2(clicksX);
    if (els.clicksY) els.clicksY.textContent = fmt2(clicksY);

    if (els.windageMoa) els.windageMoa.textContent = fmt2(moaX);
    if (els.elevMoa) els.elevMoa.textContent = fmt2(moaY);
    if (els.windageClicks) els.windageClicks.textContent = fmt2(clicksX);
    if (els.elevClicks) els.elevClicks.textContent = fmt2(clicksY);
  }

  function renderFromApiResponse(resp) {
    const pick = (obj, paths) => {
      for (const p of paths) {
        const parts = p.split(".");
        let cur = obj;
        let ok = true;
        for (const k of parts) {
          if (cur && Object.prototype.hasOwnProperty.call(cur, k)) cur = cur[k];
          else {
            ok = false;
            break;
          }
        }
        if (ok && cur !== undefined && cur !== null) return cur;
      }
      return undefined;
    };

    const windClicks = pick(resp, ["windage.clicks", "windageClicks", "clicksX", "clicks_x", "xClicks"]);
    const elevClicks = pick(resp, ["elevation.clicks", "elevClicks", "elevationClicks", "clicksY", "clicks_y", "yClicks"]);
    const windMoa = pick(resp, ["windage.moa", "windageMoa", "moaX", "moa_x", "xMoa"]);
    const elevMoa = pick(resp, ["elevation.moa", "elevMoa", "elevationMoa", "moaY", "moa_y", "yMoa"]);

    if (windClicks !== undefined && els.windageClicks) els.windageClicks.textContent = fmt2(windClicks);
    if (elevClicks !== undefined && els.elevClicks) els.elevClicks.textContent = fmt2(elevClicks);
    if (windMoa !== undefined && els.windageMoa) els.windageMoa.textContent = fmt2(windMoa);
    if (elevMoa !== undefined && els.elevMoa) els.elevMoa.textContent = fmt2(elevMoa);

    if (els.moaX && windMoa !== undefined) els.moaX.textContent = fmt2(windMoa);
    if (els.moaY && elevMoa !== undefined) els.moaY.textContent = fmt2(elevMoa);
    if (els.clicksX && windClicks !== undefined) els.clicksX.textContent = fmt2(windClicks);
    if (els.clicksY && elevClicks !== undefined) els.clicksY.textContent = fmt2(elevClicks);
  }

  function setApiStatus(connected, urlText, extraLines) {
    if (els.apiStatus) els.apiStatus.textContent = connected ? "CONNECTED" : "NOT CONNECTED";
    if (els.apiStatus) els.apiStatus.className = connected ? "ok" : "bad";
    if (els.apiUrl) els.apiUrl.textContent = urlText || "";
    setDebug(extraLines || []);
  }

  async function checkApi() {
    if (typeof window.getHealth !== "function") {
      setApiStatus(false, "", ["Missing window.getHealth(). Make sure api.js is loaded before app.js."]);
      return;
    }
    try {
      await window.getHealth();
      const base = window.SCZN3_API_BASE || window.API_BASE || "(base unknown)";
      setApiStatus(true, `${base} (health OK)`, []);
      return true;
    } catch (e) {
      setApiStatus(false, "", [`Health failed: ${String(e?.message || e)}`]);
      return false;
    }
  }

  async function runCalc() {
    renderDirectionsAndDeltas();
    renderMOAandClicksFallback();

    if (typeof window.postCalc !== "function") {
      setDebug(["Missing window.postCalc(). Make sure api.js is loaded before app.js."]);
      return;
    }

    const { distanceYards, clickValueMoa, trueMoa } = getSettings();
    const { bullX, bullY, poibX, poibY } = computeCorrectionFromInputs();

    const payload = {
      distanceYards,
      clickValueMoa,
      trueMoa,
      bull: { x: bullX, y: bullY },
      poib: { x: poibX, y: poibY },
    };

    try {
      const resp = await window.postCalc(payload);
      renderFromApiResponse(resp || {});
    } catch (e) {
      setDebug([`Calc failed: ${String(e?.message || e)}`]);
    }
  }

  // ---------- Preview helpers (fix “no image shown”) ----------
  function ensurePreviewDiv() {
    if (els.preview) return els.preview;

    const div = document.createElement("div");
    div.id = "preview";
    div.style.minHeight = "320px";
    div.style.border = "2px solid #ddd";
    div.style.borderRadius = "10px";
    div.style.padding = "8px";
    div.style.marginTop = "12px";

    document.body.appendChild(div);
    els.preview = div;
    return div;
  }

  function ensureCanvas() {
    const preview = ensurePreviewDiv();
    let c = preview.querySelector("canvas");
    if (!c) {
      c = document.createElement("canvas");
      c.style.width = "100%";
      c.style.height = "auto";
      c.style.display = "block";
      preview.innerHTML = "";
      preview.appendChild(c);
    }
    return c;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function showSelectedImage() {
    const file = els.photo?.files?.[0];
    if (!file) return;

    const canvas = ensureCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = await loadImageFromFile(file);

    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    setDebug(["Image loaded. Tap Analyze (Auto POIB)."]);
  }

  function toGrayscale(imgData) {
    const { data, width, height } = imgData;
    const g = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      g[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0;
    }
    return g;
  }

  function computeROI(w, h) {
    const topCut = Math.round(h * 0.12);
    const botCut = Math.round(h * 0.12);
    const leftCut = Math.round(w * 0.06);
    const rightCut = Math.round(w * 0.06);

    const x1 = clampInt(leftCut, 0, w - 1);
    const x2 = clampInt(w - 1 - rightCut, 0, w - 1);
    const y1 = clampInt(topCut, 0, h - 1);
    const y2 = clampInt(h - 1 - botCut, 0, h - 1);

    return { x1, y1, x2, y2, w: Math.max(1, x2 - x1 + 1), h: Math.max(1, y2 - y1 + 1) };
  }

  function projectionPeaksROI(gray, w, h, roi) {
    const thr = 150;
    const projX = new Float32Array(roi.w);
    const projY = new Float32Array(roi.h);

    for (let yy = 0; yy < roi.h; yy++) {
      const y = roi.y1 + yy;
      const rowOff = y * w;
      for (let xx = 0; xx < roi.w; xx++) {
        const x = roi.x1 + xx;
        const v = gray[rowOff + x];
        if (v < thr) {
          projX[xx] += 1;
          projY[yy] += 1;
        }
      }
    }

    const argmax = (arr) => {
      let bestI = 0,
        bestV = -1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > bestV) {
          bestV = arr[i];
          bestI = i;
        }
      }
      return bestI;
    };

    const x0 = roi.x1 + argmax(projX);
    const y0 = roi.y1 + argmax(projY);
    return { projX, projY, x0, y0 };
  }

  function pickLinePositions(proj, minDist, topN) {
    const candidates = [];
    for (let i = 2; i < proj.length - 2; i++) {
      const v = proj[i];
      if (v > proj[i - 1] && v >= proj[i + 1] && v > proj[i - 2] && v >= proj[i + 2]) {
        candidates.push({ i, v });
      }
    }
    candidates.sort((a, b) => b.v - a.v);

    const picked = [];
    for (const c of candidates) {
      if (picked.length >= topN) break;
      if (picked.every((p) => Math.abs(p - c.i) >= minDist)) picked.push(c.i);
    }
    picked.sort((a, b) => a - b);
    return picked;
  }

  function estimatePixelsPerInchFromROI(projX, projY) {
    const minDist = Math.max(20, Math.round(Math.min(projX.length, projY.length) * 0.04));
    const xs = pickLinePositions(projX, minDist, 60);
    const ys = pickLinePositions(projY, minDist, 60);

    const diffs = (list) => {
      const d = [];
      for (let i = 1; i < list.length; i++) d.push(list[i] - list[i - 1]);
      return d.filter((x) => x >= 40 && x <= 220);
    };

    const median = (arr) => {
      if (!arr.length) return null;
      const a = [...arr].sort((a, b) => a - b);
      const mid = (a.length / 2) | 0;
      return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    };

    const dx = median(diffs(xs)) || 100;
    const dy = median(diffs(ys)) || 100;
    return (dx + dy) / 2;
  }

  function connectedComponents(gray, w, h, roi) {
    const thr = 110;
    const mask = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      const inY = y >= roi.y1 && y <= roi.y2;
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        const inROI = inY && x >= roi.x1 && x <= roi.x2;
        const idx = rowOff + x;
        mask[idx] = inROI && gray[idx] < thr ? 1 : 0;
      }
    }

    const visited = new Uint8Array(w * h);
    const comps = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];

    for (let y = roi.y1; y <= roi.y2; y++) {
      for (let x = roi.x1; x <= roi.x2; x++) {
        const idx = y * w + x;
        if (!mask[idx] || visited[idx]) continue;

        const qx = [x],
          qy = [y];
        visited[idx] = 1;

        let minX = x,
          maxX = x,
          minY = y,
          maxY = y,
          area = 0,
          sumX = 0,
          sumY = 0;

        while (qx.length) {
          const cx = qx.pop();
          const cy = qy.pop();
          area++;
          sumX += cx;
          sumY += cy;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (const [dx, dy] of dirs) {
            const nx = cx + dx,
              ny = cy + dy;
            if (nx < roi.x1 || nx > roi.x2 || ny < roi.y1 || ny > roi.y2) continue;
            const nidx = ny * w + nx;
            if (mask[nidx] && !visited[nidx]) {
              visited[nidx] = 1;
              qx.push(nx);
              qy.push(ny);
            }
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        comps.push({ area, minX, minY, maxX, maxY, cx: sumX / area, cy: sumY / area, bw, bh });
      }
    }

    return comps;
  }

  function filterHoleCandidates(comps, ppi) {
    const minD = Math.max(6, Math.round(ppi * 0.06));
    const maxD = Math.max(16, Math.round(ppi * 0.32));

    const minArea = Math.max(30, Math.round(minD * minD * 0.35));
    const maxArea = Math.max(400, Math.round(maxD * maxD * 0.9));

    const out = [];
    for (const c of comps) {
      if (c.area < minArea || c.area > maxArea) continue;
      if (c.bw < minD || c.bh < minD) continue;
      if (c.bw > maxD || c.bh > maxD) continue;

      const ar = c.bw / c.bh;
      if (ar > 2.6 || ar < 1 / 2.6) continue;

      const fill = c.area / (c.bw * c.bh);
      if (fill < 0.22) continue;

      out.push(c);
    }

    if (out.length > 10) {
      const mx = out.reduce((s, c) => s + c.cx, 0) / out.length;
      const my = out.reduce((s, c) => s + c.cy, 0) / out.length;
      out.sort((a, b) => (a.cx - mx) ** 2 + (a.cy - my) ** 2 - ((b.cx - mx) ** 2 + (b.cy - my) ** 2));
      return out.slice(0, 10);
    }

    return out;
  }

  async function analyzeAutoPOIB() {
    const file = els.photo?.files?.[0];
    if (!file) {
      setDebug(["Choose a target photo first."]);
      return;
    }

    const canvas = ensureCanvas();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = await loadImageFromFile(file);

    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const gray = toGrayscale(imgData);

    const roi = computeROI(w, h);
    const { projX, projY, x0, y0 } = projectionPeaksROI(gray, w, h, roi);
    const ppi = estimatePixelsPerInchFromROI(projX, projY);

    const comps = connectedComponents(gray, w, h, roi);
    const holes = filterHoleCandidates(comps, ppi);

    if (!holes.length) {
      setDebug([
        "No hole candidates found inside ROI.",
        `ROI: x=${roi.x1}-${roi.x2}, y=${roi.y1}-${roi.y2}`,
        `ppi=${Math.round(ppi)}`,
      ]);
      return;
    }

    const gx = holes.reduce((s, c) => s + c.cx, 0) / holes.length;
    const gy = holes.reduce((s, c) => s + c.cy, 0) / holes.length;

    const poibX = (gx - x0) / ppi;
    const poibY = (y0 - gy) / ppi;

    // redraw + overlays
    ctx.drawImage(img, 0, 0, w, h);
    ctx.lineWidth = 2;

    // ROI outline
    ctx.strokeStyle = "rgba(0, 180, 255, 0.35)";
    ctx.strokeRect(roi.x1, roi.y1, roi.w, roi.h);

    // bull (cyan)
    ctx.strokeStyle = "rgba(0,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x0, y0, 10, 0, Math.PI * 2);
    ctx.stroke();

    // holes (red)
    ctx.fillStyle = "rgba(255,0,0,0.85)";
    for (const c of holes) {
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // group center (red ring)
    ctx.strokeStyle = "rgba(255,0,0,0.95)";
    ctx.beginPath();
    ctx.arc(gx, gy, 9, 0, Math.PI * 2);
    ctx.stroke();

    setVal(els.poibX, poibX);
    setVal(els.poibY, poibY);

    setVal(els.bullX, 0);
    setVal(els.bullY, 0);

    setDebug([
      `Detected holes: ${holes.length}`,
      `Pixels/inch estimate: ${Math.round(ppi)}`,
      `Group(px): (${gx.toFixed(1)}, ${gy.toFixed(1)})`,
      `Bull(px): (${x0.toFixed(0)}, ${y0.toFixed(0)})`,
      `POIB(in): (${poibX.toFixed(2)}, ${poibY.toFixed(2)})`,
      `ROI: x=${roi.x1}-${roi.x2}, y=${roi.y1}-${roi.y2}`,
    ]);

    renderDirectionsAndDeltas();
    renderMOAandClicksFallback();
    await runCalc();
  }

  // ---------- Wiring ----------
  function addAutoUpdate(id) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => {
      renderDirectionsAndDeltas();
      renderMOAandClicksFallback();
    });
    el.addEventListener("input", () => {
      renderDirectionsAndDeltas();
      renderMOAandClicksFallback();
    });
  }

  ["distanceYards", "clickValueMoa", "trueMoa", "bullX", "bullY", "poibX", "poibY"].forEach(addAutoUpdate);

  if (els.photo) {
    els.photo.addEventListener("change", () => {
      showSelectedImage().catch((e) => setDebug([`Preview failed: ${String(e?.message || e)}`]));
    });
  }

  if (els.analyzeBtn) {
    els.analyzeBtn.addEventListener("click", () => {
      analyzeAutoPOIB().catch((e) => setDebug([`Analyze failed: ${String(e?.message || e)}`]));
    });
  }

  if (els.calcBtn) {
    els.calcBtn.addEventListener("click", () => {
      runCalc().catch((e) => setDebug([`Calc failed: ${String(e?.message || e)}`]));
    });
  }

  renderDirectionsAndDeltas();
  renderMOAandClicksFallback();
  checkApi();
})();
