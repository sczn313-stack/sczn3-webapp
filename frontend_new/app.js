// frontend_new/app.js
(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    apiStatusText: $("apiStatusText"),
    apiBaseUrl: $("apiBaseUrl"),

    distanceYards: $("distanceYards"),
    clickValueMoa: $("clickValueMoa"),
    trueMoa: $("trueMoa"),

    bullX: $("bullX"),
    bullY: $("bullY"),
    poibX: $("poibX"),
    poibY: $("poibY"),

    calcBtn: $("calcBtn"),

    windage: $("windage"),
    elevation: $("elevation"),
    dx: $("dx"),
    dy: $("dy"),
  };

  function num(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function fmt2(x) {
    return Number(x).toFixed(2);
  }

  function inchesPerMoa(distanceYards, trueMoa) {
    // True MOA = 1.047" at 100y
    // Shooter MOA = 1.000" at 100y
    return (distanceYards / 100) * (trueMoa ? 1.047 : 1.0);
  }

  function localCalc(payload) {
    const dY = num(payload.distanceYards);
    const click = num(payload.clickValueMoa);
    const tmoa = !!payload.trueMoa;

    const bullX = num(payload.bull?.x);
    const bullY = num(payload.bull?.y);
    const poibX = num(payload.poib?.x);
    const poibY = num(payload.poib?.y);

    const dx = bullX - poibX;
    const dy = bullY - poibY;

    const wDir = dx > 0 ? "RIGHT" : dx < 0 ? "LEFT" : "NONE";
    const eDir = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE";

    const ipm = inchesPerMoa(dY, tmoa);

    const wMoa = Math.abs(dx) / ipm;
    const eMoa = Math.abs(dy) / ipm;

    const wClicks = click ? (wMoa / click) : 0;
    const eClicks = click ? (eMoa / click) : 0;

    return {
      dxIn: Math.abs(dx),
      dyIn: Math.abs(dy),
      windage: { direction: wDir, moa: wMoa, clicks: wClicks },
      elevation: { direction: eDir, moa: eMoa, clicks: eClicks },
    };
  }

  function renderResult(r) {
    els.windage.textContent =
      `${r.windage.direction} • ${fmt2(r.windage.clicks)} clicks • ${fmt2(r.windage.moa)} MOA`;
    els.elevation.textContent =
      `${r.elevation.direction} • ${fmt2(r.elevation.clicks)} clicks • ${fmt2(r.elevation.moa)} MOA`;
    els.dx.textContent = fmt2(r.dxIn);
    els.dy.textContent = fmt2(r.dyIn);
  }

  async function checkApi() {
    try {
      els.apiStatusText.textContent = "Checking…";
      els.apiBaseUrl.textContent = window.SCZN3_API_BASE || "(no backend url set)";

      const data = await window.getHealth();
      // if backend returns { ok: true } or similar
      els.apiStatusText.textContent = "CONNECTED ✅";
      els.apiBaseUrl.textContent = (window.SCZN3_API_BASE || "") + " (health OK)";
      return data;
    } catch (e) {
      els.apiStatusText.textContent = "NOT CONNECTED ❌";
      els.apiBaseUrl.textContent = String(e?.message || e);
      return null;
    }
  }

  async function runCalc() {
    const payload = {
      distanceYards: num(els.distanceYards.value),
      clickValueMoa: num(els.clickValueMoa.value),
      trueMoa: String(els.trueMoa.value).toUpperCase() === "ON" || els.trueMoa.value === "true",
      bull: { x: num(els.bullX.value), y: num(els.bullY.value) },
      poib: { x: num(els.poibX.value), y: num(els.poibY.value) },
    };

    // Try backend first, fall back to local calc if response schema differs or request fails
    try {
      const data = await window.postCalc(payload);

      // Accept multiple possible schemas
      const r =
        data?.result ||
        (data?.windage && data?.elevation ? data : null) ||
        (data?.windageDir || data?.elevationDir ? null : null);

      if (r && r.windage && r.elevation) {
        renderResult({
          dxIn: r.dxIn ?? r.dx ?? localCalc(payload).dxIn,
          dyIn: r.dyIn ?? r.dy ?? localCalc(payload).dyIn,
          windage: {
            direction: r.windage.direction || r.windage.dir || r.windage,
            moa: num(r.windage.moa),
            clicks: num(r.windage.clicks),
          },
          elevation: {
            direction: r.elevation.direction || r.elevation.dir || r.elevation,
            moa: num(r.elevation.moa),
            clicks: num(r.elevation.clicks),
          },
        });
        return;
      }

      // If backend returned an unexpected shape, do local calc so UI still works
      renderResult(localCalc(payload));
    } catch (e) {
      // Backend failed — still show correct math locally
      renderResult(localCalc(payload));
    }
  }

  // Wire events
  els.calcBtn.addEventListener("click", runCalc);

  // Auto re-calc when inputs change
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
    if (el) el.addEventListener("input", () => runCalc().catch(() => {}));
    if (el) el.addEventListener("change", () => runCalc().catch(() => {}));
  });

  // Start
  checkApi();
  runCalc().catch(() => {});
})();
