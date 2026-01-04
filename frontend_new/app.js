// frontend_new/app.js
// Analyze (Auto POIB) v3 — TechDude 3-ROI support (no HTML changes required)
// - Convention locked:
//   Right = +X, Up = +Y
//   POIB is where the group is relative to bull
//   Correction is bull - POIB (dx = bullX - poibX, dy = bullY - poibY)
// - Adds TechDude mode (HEAD/CHEST/PELVIS ROI selection) + ROI-cropped analysis
// - Keeps existing calc + render behavior

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

    // results (these IDs must exist in your HTML; if some don't, we skip)
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
  // TechDude Mode (3 ROIs)
  // ---------------------------
  const QS = new URLSearchParams(window.location.search || "");
  const SRC = String(QS.get("src") || "").toLowerCase();
  const SKU = String(QS.get("sku") || "").toUpperCase();

  const TECHDUDE_MODE =
    SRC.includes("techdude") || SKU === "BAKER_TECHDUDE" || SRC.includes("baker-techdude");

  // Normalized ROI boxes (padded) — works best when the full target is framed consistently.
  // x0,y0,x1,y1 are fractions of the full image width/height.
  const TECHDUDE_ROIS = {
    HEAD:   { x0: 0.4104, y0: 0.1198, x1: 0.5737, y1: 0.1967, label: "ROI 1 — HEAD"   },
    CHEST:  { x0: 0.3696, y0: 0.3785, x1: 0.6156, y1: 0.5629, label: "ROI 2 — CHEST"  },
    PELVIS: { x0: 0.3299, y0: 0.7439, x1: 0.6474, y1: 0.9371, label: "ROI 3 — PELVIS" },
  };

  let selectedROI = null; // "HEAD" | "CHEST" | "PELVIS" | null

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

  // ---------------------------
  // ROI UI injection (no HTML changes needed)
  // ---------------------------
  function ensureRoiUI() {
    if (!TECHDUDE_MODE) return;

    const host = els.preview || document.body;
    if (!host) return;

    if (document.getElementById("roiBar")) return; // already exists

    const bar = document.createElement("div");
    bar.id = "roiBar";
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.gap = "10px";
    bar.style.alignItems = "center";
    bar.style.padding = "10px 0";

    const title = document.createElement("div");
    title.textContent = "Technical Dude — Select ROI:";
    title.style.fontWeight = "700";
    title.style.marginRight = "10px";
    bar.appendChild(title);

    const mkBtn = (key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = TECHDUDE_ROIS[key].label;
      b.dataset.roi = key;
      b.style.padding = "8px 12px";
      b.style.borderRadius = "10px";
      b.style.border = "1px solid #444";
      b.style.background = "#fff";
      b.style.cursor = "pointer";
      b.addEventListener("click", () => {
        selectedROI = key;
        // visual highlight
        Array.from(bar.querySelectorAll("button[data-roi]")).forEach((x) => {
          x.style.background = x.dataset.roi === key ? "#e8f0ff" : "#fff";
          x.style.borderColor = x.dataset.roi === key ? "#2b5cff" : "#444";
        });
        updateAnalyzeLock();
        setDebug([`ROI selected: ${TECHDUDE_ROIS[key].label}`]);
      });
      return b;
    };

    bar.appendChild(mkBtn("HEAD"));
    bar.appendChild(mkBtn("CHEST"));
    bar.appendChild(mkBtn("PELVIS"));

    const note = document.createElement("div");
    note.id = "roiNote";
    note.style.fontSize = "12px";
    note.style.opacity = "0.8";
    note.style.marginLeft = "10px";
    note.textContent = "Tip: Fill the frame with the full target for best ROI alignment.";
    bar.appendChild(note);

    // Insert bar BEFORE preview (so it sits above the canvas)
    if (els.preview && els.preview.parentNode) {
      els.preview.parentNode.insertBefore(bar, els.preview);
    } else {
      host.insertBefore(bar, host.firstChild);
    }
  }

  function updateAnalyzeLock() {
    if (!els.analyzeBtn) return;
    if (!TECHDUDE_MODE) {
      els.analyzeBtn.disabled = false;
      els.analyzeBtn.style.opacity = "1";
      return;
    }
    const ok = !!selectedROI;
    els.analyzeBtn.disabled = !ok;
    els.analyzeBtn.style.opacity = ok ? "1" : "0.5";
  }

  // ---------------------------
  // Analyze (Auto POIB) — image -> POIB (inches)
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

  function projectionPeaks(gray, w, h) {
    const thr = 150;
    const projX = new Float32Array(w);
    const projY = new Float32Array(h);

    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        const v = gray[rowOff + x];
        if (v < thr) {
          projX[x] += 1;
          projY[y] += 1;
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

    const x0 = argmax(projX).idx;
    const y0 = argmax(projY).idx;
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

  function estimatePixelsPerInch(projX, projY) {
    const xs = pickLinePositions(projX, 40, 40);
    const ys = pickLinePositions(projY, 40, 40);

    const median = (arr) => {
      if (!arr.length) return null;
      const a = [...arr].sort((a, b) => a - b);
      const mid = (a.length / 2) | 0;
      return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
    };

    function diffs(list) {
      const d = [];
      for (let i = 1; i < list.length; i++) d.push(list[i] - list[i - 1]);
      return d.filter((x) => x >= 50 && x <= 200);
    }

    const dx = median(diffs(xs)) || 100;
    const dy = median(diffs(ys)) || 100;
    return (dx + dy) / 2;
  }

  function connectedComponents(gray, w, h) {
    const thr = 110;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = gray[i] < thr ? 1 : 0;

    const visited = new Uint8Array(w * h);
    const comps = [];

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!mask[idx] || visited[idx]) continue;

        const qx = [x];
        const qy = [y];
        visited[idx] = 1;

        let minX = x, maxX = x, minY = y, maxY = y;
        let area = 0;
        let sumX = 0, sumY = 0;

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
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
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
          minX, minY, maxX, maxY,
          cx: sumX / area,
          cy: sumY / area,
          bw, bh,
        });
      }
    }

    return comps;
  }

  function filterHoleCandidates(comps, w, h, bullX, bullY) {
    const out = [];
    for (const c of comps) {
      if (c.area > 6000) continue;     // reject huge areas
      const ar = c.bw / c.bh;
      if (ar > 8 || ar < 1 / 8) continue; // line-ish
      if (c.area < 25) continue;       // tiny specks
      if (c.bw > 140 || c.bh > 140) continue;

      const dx = c.cx - bullX;
      const dy = c.cy - bullY;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > Math.min(w, h) * 0.60) continue;

      out.push(c);
    }

    if (out.length > 30) {
      const mx = out.reduce((s, c) => s + c.cx, 0) / out.length;
      const my = out.reduce((s, c) => s + c.cy, 0) / out.length;
      out.sort((a, b) => {
        const da = (a.cx - mx) ** 2 + (a.cy - my) ** 2;
        const db = (b.cx - mx) ** 2 + (b.cy - my) ** 2;
        return da - db;
      });
      return out.slice(0, 30);
    }

    return out;
  }

  function getRoiPxBounds(w, h) {
    if (!TECHDUDE_MODE) return null;
    if (!selectedROI) return null;

    const r = TECHDUDE_ROIS[selectedROI];
    const x0 = Math.max(0, Math.min(w - 1, Math.round(r.x0 * w)));
    const y0 = Math.max(0, Math.min(h - 1, Math.round(r.y0 * h)));
    const x1 = Math.max(0, Math.min(w, Math.round(r.x1 * w)));
    const y1 = Math.max(0, Math.min(h, Math.round(r.y1 * h)));
    const rw = Math.max(1, x1 - x0);
    const rh = Math.max(1, y1 - y0);
    return { x0, y0, x1, y1, rw, rh, label: r.label };
  }

  async function analyzeAutoPOIB() {
    if (TECHDUDE_MODE && !selectedROI) {
      setDebug(["Select an ROI first (HEAD / CHEST / PELVIS)."]);
      return;
    }

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

    // Full image data
    const full = ctx.getImageData(0, 0, w, h);
    const grayFull = toGrayscale(full);

    // ROI crop if in TechDude mode
    const roi = getRoiPxBounds(w, h);

    let workImgData = full;
    let gray = grayFull;
    let ox = 0, oy = 0; // offsets to map ROI coords back to full image
    let ww = w, hh = h;

    if (roi) {
      workImgData = ctx.getImageData(roi.x0, roi.y0, roi.rw, roi.rh);
      gray = toGrayscale(workImgData);
      ox = roi.x0;
      oy = roi.y0;
      ww = roi.rw;
      hh = roi.rh;
    }

    // Bull center within work area
    const { projX, projY, x0, y0 } = projectionPeaks(gray, ww, hh);

    // Pixels per inch estimate — run on work area (good enough for pilot)
    const ppi = estimatePixelsPerInch(projX, projY);

    // Hole blobs within work area
    const comps = connectedComponents(gray, ww, hh);
    const holesLocal = filterHoleCandidates(comps, ww, hh, x0, y0);

    if (!holesLocal.length) {
      setDebug([
        "No hole candidates found.",
        TECHDUDE_MODE ? "Tip: Use a clearer photo and ensure your hits are inside the selected ROI." : "Try a clearer photo (more contrast).",
      ]);
      return;
    }

    // Group centroid (local pixels)
    const gxL = holesLocal.reduce((s, c) => s + c.cx, 0) / holesLocal.length;
    const gyL = holesLocal.reduce((s, c) => s + c.cy, 0) / holesLocal.length;

    // Convert bull/centroid back to FULL-image coords for drawing
    const bullXpx = x0 + ox;
    const bullYpx = y0 + oy;
    const gx = gxL + ox;
    const gy = gyL + oy;

    // POIB in inches relative to bull; Up is +Y, but image y goes down
    const poibX = (gxL - x0) / ppi;
    const poibY = (y0 - gyL) / ppi;

    // Draw overlays
    ctx.drawImage(img, 0, 0, w, h);
    ctx.lineWidth = 2;

    // ROI rectangle (if used)
    if (roi) {
      ctx.strokeStyle = "rgba(0,120,255,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeRect(roi.x0, roi.y0, roi.rw, roi.rh);
    }

    // bull
    ctx.strokeStyle = "rgba(0,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bullXpx, bullYpx, 10, 0, Math.PI * 2);
    ctx.stroke();

    // holes (map local -> full)
    ctx.fillStyle = "rgba(255,0,0,0.85)";
    for (const c of holesLocal) {
      ctx.beginPath();
      ctx.arc(c.cx + ox, c.cy + oy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // group center
    ctx.strokeStyle = "rgba(255,0,0,0.95)";
    ctx.beginPath();
    ctx.arc(gx, gy, 9, 0, Math.PI * 2);
    ctx.stroke();

    // Update fields (two decimals)
    setVal(els.poibX, poibX);
    setVal(els.poibY, poibY);

    // Lock bull to 0/0 for your flow
    setVal(els.bullX, 0);
    setVal(els.bullY, 0);

    const lines = [
      TECHDUDE_MODE ? `Mode: TECHDUDE (${roi ? roi.label : "ROI n/a"})` : "Mode: STANDARD",
      `Detected holes: ${holesLocal.length}`,
      `Pixels/inch estimate: ${Math.round(ppi)}`,
      `Group(px): (${gx.toFixed(1)}, ${gy.toFixed(1)})`,
      `Bull(px): (${bullXpx.toFixed(0)}, ${bullYpx.toFixed(0)})`,
      `POIB(in): (${poibX.toFixed(2)}, ${poibY.toFixed(2)})`,
    ];
    setDebug(lines);

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

  // Init
  ensureRoiUI();
  updateAnalyzeLock();
  renderDirectionsAndDeltas();
  renderMOAandClicksFallback();
  checkApi();
})();
