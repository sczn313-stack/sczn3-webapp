(() => {
  // ===========
  // CONFIG
  // ===========
  // If your backend is on another Render service, set it here.
  // Otherwise it will default to same-origin.
  const API_BASE = (window.SZN3_API_BASE || "").trim() || "";

  // ===========
  // DOM
  // ===========
  const apiStatus = document.getElementById("apiStatus");
  const apiUrlLabel = document.getElementById("apiUrlLabel");

  const distanceYardsEl = document.getElementById("distanceYards");
  const moaPerClickEl = document.getElementById("moaPerClick");
  const moaModeEl = document.getElementById("moaMode");

  const bullXEl = document.getElementById("bullX");
  const bullYEl = document.getElementById("bullY");
  const poibXEl = document.getElementById("poibX");
  const poibYEl = document.getElementById("poibY");

  const fileInput = document.getElementById("fileInput");
  const fileName = document.getElementById("fileName");
  const previewImg = document.getElementById("previewImg");

  const analyzeBtn = document.getElementById("analyzeBtn");
  const calcBtn = document.getElementById("calcBtn");

  const debugBox = document.getElementById("debugBox");

  const windDirEl = document.getElementById("windDir");
  const elevDirEl = document.getElementById("elevDir");
  const dxInEl = document.getElementById("dxIn");
  const dyInEl = document.getElementById("dyIn");
  const dxMoaEl = document.getElementById("dxMoa");
  const dyMoaEl = document.getElementById("dyMoa");
  const dxClicksEl = document.getElementById("dxClicks");
  const dyClicksEl = document.getElementById("dyClicks");

  // ===========
  // HELPERS
  // ===========
  const n = (v, fallback = 0) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  };

  // 2-decimal everywhere (lock)
  const f2 = (v) => (Math.round(n(v) * 100) / 100).toFixed(2);

  // True MOA uses 1.047" at 100y; Shooter MOA uses 1.000" at 100y
  function inchesPerMOAAtDistance(distanceYards, moaMode) {
    const baseAt100 = moaMode === "true" ? 1.047 : 1.0;
    return baseAt100 * (distanceYards / 100);
  }

  // ===========
  // LOCK #1: Pixels -> Inches (flip Y exactly once)
  // target coords: +X right, +Y up
  // ===========
  function pixelsToInchesTargetCoords(groupX_px, groupY_px, bullX_px, bullY_px, ppi) {
    const gx = n(groupX_px);
    const gy = n(groupY_px);
    const bx = n(bullX_px);
    const by = n(bullY_px);
    const p = n(ppi);

    if (!(p > 0)) return { poibX_in: 0, poibY_in: 0 };

    const poibX_in = (gx - bx) / p;
    const poibY_in = (by - gy) / p; // ✅ Y FLIP LOCK (ONLY PLACE Y FLIPS)

    return { poibX_in, poibY_in };
  }

  // ===========
  // LOCK #2: correction = bull - POIB (move POIB to bull)
  // ===========
  function computeCorrection(bullX_in, bullY_in, poibX_in, poibY_in) {
    const dx = n(bullX_in) - n(poibX_in);
    const dy = n(bullY_in) - n(poibY_in);

    // Directions (locked)
    const windageDirection = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "NONE";
    const elevationDirection = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE";

    return { dx, dy, windageDirection, elevationDirection };
  }

  // ===========
  // UI OUTPUT
  // ===========
  function setDebug(obj) {
    if (!debugBox) return;
    debugBox.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function renderResults(corr) {
    const distanceYards = n(distanceYardsEl?.value, 100);
    const moaPerClick = n(moaPerClickEl?.value, 0.25);
    const moaMode = moaModeEl?.value || "true";

    const inPerMOA = inchesPerMOAAtDistance(distanceYards, moaMode);

    const windMOA = Math.abs(corr.dx) / inPerMOA;
    const elevMOA = Math.abs(corr.dy) / inPerMOA;

    const windClicks = moaPerClick > 0 ? windMOA / moaPerClick : 0;
    const elevClicks = moaPerClick > 0 ? elevMOA / moaPerClick : 0;

    windDirEl.textContent = corr.windageDirection;
    elevDirEl.textContent = corr.elevationDirection;

    dxInEl.textContent = f2(Math.abs(corr.dx));
    dyInEl.textContent = f2(Math.abs(corr.dy));

    dxMoaEl.textContent = f2(windMOA);
    dyMoaEl.textContent = f2(elevMOA);

    dxClicksEl.textContent = f2(windClicks);
    dyClicksEl.textContent = f2(elevClicks);
  }

  // ===========
  // API
  // ===========
  async function apiHealthCheck() {
    const url = (API_BASE || window.location.origin).replace(/\/$/, "") + "/health";
    if (apiUrlLabel) apiUrlLabel.textContent = url;

    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("Health not OK");
      if (apiStatus) {
        apiStatus.textContent = "LIVE";
        apiStatus.classList.add("good");
        apiStatus.classList.remove("bad");
      }
    } catch {
      if (apiStatus) {
        apiStatus.textContent = "NO API";
        apiStatus.classList.add("bad");
        apiStatus.classList.remove("good");
      }
      setDebug("API health check failed. If your backend is separate, set window.SZN3_API_BASE in index.html before app.js.");
    }
  }

  async function analyzeAutoPOIB(file) {
    const base = (API_BASE || window.location.origin).replace(/\/$/, "");
    const candidates = [
      base + "/analyze",
      base + "/api/analyze",
      base + "/analyze-auto",
      base + "/api/analyze-auto",
    ];

    const form = new FormData();
    form.append("image", file);

    let lastErr = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: "POST", body: form });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { url, data };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Analyze failed");
  }

  // ===========
  // EVENTS
  // ===========
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (fileName) fileName.textContent = file.name;

    const url = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = url;
      previewImg.style.display = "block";
    }
  });

  calcBtn?.addEventListener("click", () => {
    const bullX = n(bullXEl?.value);
    const bullY = n(bullYEl?.value);
    const poibX = n(poibXEl?.value);
    const poibY = n(poibYEl?.value);

    const corr = computeCorrection(bullX, bullY, poibX, poibY);
    renderResults(corr);

    setDebug({
      mode: "MANUAL",
      lock_1: "pixels->inches flips Y once: poibY_in = (bullY_px - groupY_px)/ppi",
      lock_2: "correction = bull - POIB",
      bull_in: { x: bullX, y: bullY },
      poib_in: { x: poibX, y: poibY },
      correction_in: { dx: corr.dx, dy: corr.dy },
      directions: { windage: corr.windageDirection, elevation: corr.elevationDirection },
    });
  });

  analyzeBtn?.addEventListener("click", async () => {
    const file = fileInput?.files && fileInput.files[0];
    if (!file) {
      setDebug("Pick a photo first.");
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing…";

    try {
      const { url, data } = await analyzeAutoPOIB(file);

      // Pull out POIB inches in a robust way.
      let poibX_in = null;
      let poibY_in = null;

      // Case A: explicit inches
      if (data?.poib_in && (data.poib_in.x != null) && (data.poib_in.y != null)) {
        poibX_in = n(data.poib_in.x);
        poibY_in = n(data.poib_in.y);
      } else if (data?.poibX_in != null && data?.poibY_in != null) {
        poibX_in = n(data.poibX_in);
        poibY_in = n(data.poibY_in);
      } else if (data?.poib && data.poib.x != null && data.poib.y != null) {
        poibX_in = n(data.poib.x);
        poibY_in = n(data.poib.y);
      }

      // Case B/C: pixel centers + ppi (convert and LOCK Y flip here)
      if (poibX_in == null || poibY_in == null) {
        const groupX =
          data?.group_px?.x ?? data?.groupPx?.[0] ?? data?.group?.x ?? data?.group?.[0];
        const groupY =
          data?.group_px?.y ?? data?.groupPx?.[1] ?? data?.group?.y ?? data?.group?.[1];

        const bullX =
          data?.bull_px?.x ?? data?.bullPx?.[0] ?? data?.bull?.x ?? data?.bull?.[0];
        const bullY =
          data?.bull_px?.y ?? data?.bullPx?.[1] ?? data?.bull?.y ?? data?.bull?.[1];

        const ppi = data?.ppi ?? data?.pixelsPerInch ?? data?.pixels_per_inch ?? data?.ppi_estimate;

        const conv = pixelsToInchesTargetCoords(groupX, groupY, bullX, bullY, ppi);
        poibX_in = conv.poibX_in;
        poibY_in = conv.poibY_in;
      }

      // Write POIB back to UI
      if (poibXEl) poibXEl.value = f2(poibX_in);
      if (poibYEl) poibYEl.value = f2(poibY_in);

      // Compute correction from current bull + POIB
      const bullX_in = n(bullXEl?.value);
      const bullY_in = n(bullYEl?.value);

      const corr = computeCorrection(bullX_in, bullY_in, poibX_in, poibY_in);
      renderResults(corr);

      setDebug({
        mode: "AUTO",
        analyze_endpoint_used: url,
        lock_1: "POIB inches are target coords (+X right, +Y up)",
        lock_2: "pixels->inches uses poibY_in = (bullY_px - groupY_px)/ppi",
        lock_3: "correction = bull - POIB",
        bull_in: { x: bullX_in, y: bullY_in },
        poib_in: { x: poibX_in, y: poibY_in },
        correction_in: { dx: corr.dx, dy: corr.dy },
        directions: { windage: corr.windageDirection, elevation: corr.elevationDirection },
        raw_response: data,
      });
    } catch (e) {
      setDebug(`Analyze failed.\n${String(e)}`);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze (Auto POIB)";
    }
  });

  // ===========
  // INIT
  // ===========
  apiHealthCheck();
})();
