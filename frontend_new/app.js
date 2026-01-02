// frontend_new/app.js
// Analyze (Auto POIB) v3 + ROI masking to ignore grid labels/rulers + stronger hole filtering
// - Convention locked:
//   Right = +X, Up = +Y
//   POIB is where the group is relative to bull
//   Correction is bull - POIB (dx = bullX - poibX, dy = bullY - poibY)
// - Outputs: inches only + two decimals

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    // status
    apiStatus: $("apiStatus"),
    apiUrl: $("apiUrl"),
    debugText: $("debugText"),

    // settings
    distanceYards: $("distanceYards"),
    clickValueMoa: $("clickValueMoa"),
    trueMoa: $("trueMoa"),

    // inputs
    bullX: $("bullX"),
    bullY: $("bullY"),
    poibX: $("poibX"),
    poibY: $("poibY"),

    // photo + actions
    photo: $("photo"),
    analyzeBtn: $("analyzeBtn"),
    calcBtn: $("calcBtn"),
    preview: $("preview"),

    // results
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

  // ---------------------------
  // Formatting + basic helpers
  // ---------------------------
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

    // correction (move POIB to bull)
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
      const h = await window.getHealth();
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

  // ---------------------------
  // Analyze (Auto POIB)
  // ---------------------------
  function ensureCanvas() {
    if (!els.preview) return null;
    let c = els.preview.querySelector("canvas");
    if (!c) {
      c = document.createElement("canvas");
      c.style.width = "100%";
      c.style.height = "auto";
      c.style.display = "block";
      els.preview.innerHTML = "";
      els.preview.appendChild(c);
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

  function toGrayscale(imgData) {
    const { data, width, height } = imgData;
    const g = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      g[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0;
    }
    return g;
  }

  // ROI mask to ignore top letters, bottom numbers, and side rulers.
  // These percentages are tuned for your 8.5x11 grid template.
  function computeROI(w, h) {
    const topCut = Math.round(h * 0.12);
    const botCut = Math.round(h * 0.12);
    const leftCut = Math.round(w * 0.06);
    const rightCut = Math.round(w * 0.06);

    const x1 = clampInt(leftCut, 0, w - 1);
    const x2 = clampInt(w - 1 - rightCut, 0, w - 1);
    const y1 = clampInt(topCut, 0, h - 1);
    const y2 = clampInt(h - 1 - botCut, 0, h - 1);

    return {
      x1,
      y1,
      x2,
      y2,
      w: Math.max(1, x2 - x1 + 1),
      h: Math.max(1, y2 - y1 + 1),
    };
  }

  function projectionPeaksROI(gray, w, h, roi) {
    // Count dark pixels per column/row INSIDE ROI only
    const thr = 150;

    const rw = roi.w;
    const rh = roi.h;

    const projX = new Float32Array(rw);
    const projY = new Float32Array(rh);

    for (let yy = 0; yy < rh; yy++) {
      const y = roi.y1 + yy;
      const rowOff = y * w;
      for (let xx = 0; xx < rw; xx++) {
        const x = roi.x1 + xx;
        const v = gray[rowOff + x];
        if (v < thr) {
          projX[xx] += 1;
          projY[yy] += 1;
        }
      }
    }

    const argmax = (arr) => {
      let bestI = 0;
      let bestV = -1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > bestV) {
          bestV = arr[i];
          bestI = i;
        }
      }
      return { idx: bestI, val: bestV };
    };

    const xLocal = argmax(projX).idx;
    const yLocal = argmax(projY).idx;

    return {
      projX,
      projY,
      x0: roi.x1 + xLocal,
      y0: roi.y1 + yLocal,
      xLocal,
      yLocal,
      rw,
      rh,
    };
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
    // spacing between strong grid line peaks inside ROI
    const minDist = Math.max(20, Math.round(Math.min(projX.length, projY.length) * 0.04));

    const xs = pickLinePositions(projX, minDist, 60);
    const ys = pickLinePositions(projY, minDist, 60);

    const median = (arr) => {
      if (!arr.length) return null;
      const a = [...arr].sort((a, b) => a - b);
      const mid = (a.length / 2) | 0;
      return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    };

    function diffs(list) {
      const d = [];
      for (let i = 1; i < list.length; i++) d.push(list[i] - list[i - 1]);
      // plausible 1" spacing range (scaled)
      return d.filter((x) => x >= 40 && x <= 220);
    }

    const dx = median(diffs(xs));
    const dy = median(diffs(ys));

    const fallback = 100;
    const ppi = (Number(dx) || fallback) * 0.5 + (Number(dy) || fallback) * 0.5;
    return ppi;
  }

  function connectedComponents(gray, w, h, roi) {
    // threshold dark blobs INSIDE ROI only
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

        const qx = [x];
        const qy = [y];
        visited[idx] = 1;

        let minX = x,
          maxX = x,
          minY = y,
          maxY = y;
        let area = 0;
        let sumX = 0,
          sumY = 0;

        while (qx.length) {
          const cx = qx.pop();
          const cy = qy.pop();
          const cidx = cy * w + cx;

          area++;
          sumX += cx;
          sumY += cy;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
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

        comps.push({
          area,
          minX,
          minY,
          maxX,
          maxY,
          cx: sumX / area,
          cy: sumY / area,
          bw,
          bh,
        });
      }
    }

    return comps;
  }

  function filterHoleCandidates(comps, ppi) {
    // Dynamic sizing tied to pixels/inch so we don't accept label strokes.
    // These ranges are conservative for typical phone photos of paper holes.
    const minD = Math.max(6, Math.round(ppi * 0.06));  // ~0.06"
    const maxD = Math.max(16, Math.round(ppi * 0.32)); // ~0.32"

    const minArea = Math.max(30, Math.round((minD * minD) * 0.35));
    const maxArea = Math.max(400, Math.round((maxD * maxD) * 0.90));

    const out = [];

    for (const c of comps) {
      // size gates
      if (c.area < minArea) continue;
      if (c.area > maxArea) continue;

      if (c.bw < minD || c.bh < minD) continue;
      if (c.bw > maxD || c.bh > maxD) continue;

      // reject long thin strokes (numbers/letters)
      const ar = c.bw / c.bh;
      if (ar > 2.6 || ar < 1 / 2.6) continue;

      // fill ratio: text strokes have low fill inside bbox; holes are denser
      const fill = c.area / (c.bw * c.bh);
      if (fill < 0.22) continue;

      out.push(c);
    }

    // If we still have a bunch (text got through), keep densest cluster:
    // pick up to 10 closest to the median center.
    if (out.length > 10) {
      const mx = out.reduce((s, c) => s + c.cx, 0) / out.length;
      const my = out.reduce((s, c) => s + c.cy, 0) / out.length;
      out.sort((a, b) => ((a.cx - mx) ** 2 + (a.cy - my) ** 2) - ((b.cx - mx) ** 2 + (b.cy - my) ** 2));
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
    if (!canvas) {
      setDebug(["Missing preview container/canvas."]);
      return;
    }

    const img = await loadImageFromFile(file);

    // scale to manageable size
    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const gray = toGrayscale(imgData);

    // ROI that excludes labels/rulers
    const roi = computeROI(w, h);

    // bull center via strongest vertical + horizontal lines INSIDE ROI
    const { projX, projY, x0, y0 } = projectionPeaksROI(gray, w, h, roi);

    // pixels per inch estimate INSIDE ROI
    const ppi = estimatePixelsPerInchFromROI(projX, projY);

    // find hole blobs INSIDE ROI
    const comps = connectedComponents(gray, w, h, roi);
    const holes = filterHoleCandidates(comps, ppi);

    if (!holes.length) {
      setDebug([
        "No hole candidates found inside ROI.",
        `ROI: x=${roi.x1}-${roi.x2}, y=${roi.y1}-${roi.y2}`,
        `ppi=${Math.round(ppi)}`,
        "Try: brighter photo, higher contrast, avoid glare.",
      ]);
      return;
    }

    // group center (px)
    const gx = holes.reduce((s, c) => s + c.cx, 0) / holes.length;
    const gy = holes.reduce((s, c) => s + c.cy, 0) / holes.length;

    // POIB in inches relative to bull; Up is +Y, but image y goes down
    const poibX = (gx - x0) / ppi;
    const poibY = (y0 - gy) / ppi;

    // draw overlays
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

    // update fields (two decimals)
    setVal(els.poibX, poibX);
    setVal(els.poibY, poibY);

    // lock bull to 0/0 (your flow)
    setVal(els.bullX, 0);
    setVal(els.bullY, 0);

    // debug lines
    const lines = [
      `Detected holes: ${holes.length}`,
      `Pixels/inch estimate: ${Math.round(ppi)}`,
      `Group(px): (${gx.toFixed(1)}, ${gy.toFixed(1)})`,
      `Bull(px): (${x0.toFixed(0)}, ${y0.toFixed(0)})`,
      `POIB(in): (${poibX.toFixed(2)}, ${poibY.toFixed(2)})`,
      `ROI: x=${roi.x1}-${roi.x2}, y=${roi.y1}-${roi.y2}`,
    ];
    setDebug(lines);

    // after analyze, show direction + deltas immediately + calc
    renderDirectionsAndDeltas();
    renderMOAandClicksFallback();
    await runCalc();
  }

  // ---------------------------
  // Wire events
  // ---------------------------
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

  if (els.analyzeBtn) {
    els.analyzeBtn.addEventListener("click", async () => {
      try {
        await analyzeAutoPOIB();
      } catch (e) {
        setDebug([`Analyze failed: ${String(e?.message || e)}`]);
      }
    });
  }

  if (els.calcBtn) {
    els.calcBtn.addEventListener("click", async () => {
      try {
        await runCalc();
      } catch (e) {
        setDebug([`Calc failed: ${String(e?.message || e)}`]);
      }
    });
  }

  // First render + API check
  renderDirectionsAndDeltas();
  renderMOAandClicksFallback();
  checkApi();
})();
