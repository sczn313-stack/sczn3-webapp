(() => {
  const $ = (id) => document.getElementById(id);

  const PHOTO = "sczn3_targetPhoto_dataUrl";
  const DIST  = "sczn3_distance_yards";
  const TAPS  = "sczn3_tap_points_json";

  const secIdText     = $("secIdText");
  const thumb         = $("targetThumb");
  const distanceText  = $("distanceText");
  const adjText       = $("adjText");

  const noData         = $("noData");
  const results        = $("results");

  const scoreText      = $("scoreText");
  const elevClicks     = $("elevClicks");
  const windClicks     = $("windClicks");
  const elevDir        = $("elevDir");
  const windDir        = $("windDir");
  const tipText        = $("tipText");

  // ---------- SEC ID ----------
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2, 8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  if (secIdText) secIdText.textContent = `SEC-ID — ${sid}`;

  // ---------- BASE DATA ----------
  const imgData = sessionStorage.getItem(PHOTO);
  const yards = Number(sessionStorage.getItem(DIST) || 100);

  if (distanceText) distanceText.textContent = String(yards);
  if (adjText) adjText.textContent = "1/4 MOA per click";

  if (!imgData || !thumb) return;
  thumb.src = imgData;

  const showResults = () => {
    if (noData) noData.classList.add("hidden");
    if (results) results.classList.remove("hidden");
  };

  // ---------- TAP SCORE ----------
  thumb.onload = () => {
    let taps = [];
    try {
      taps = JSON.parse(sessionStorage.getItem(TAPS) || "[]");
    } catch {}

    if (!Array.isArray(taps) || taps.length === 0) return;

    const w = thumb.naturalWidth || 1;
    const h = thumb.naturalHeight || 1;

    let sx = 0, sy = 0, c = 0;
    for (const p of taps) {
      const x = Number(p?.x);
      const y = Number(p?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sx += x; sy += y; c++;
    }
    if (!c) return;

    const cx = w / 2;
    const cy = h / 2;
    const px = sx / c;
    const py = sy / c;

    const dist = Math.hypot(px - cx, py - cy);
    const score = Math.max(0, Math.round(1000 - dist));

    if (scoreText) scoreText.textContent = String(score);
    if (tipText) tipText.textContent = `Tap N Score pilot — ${c} shot(s) recorded.`;

    showResults();
  };

  // ---------- BACKEND ANALYZE ----------
  async function analyze() {
    try {
      const blob = await (await fetch(imgData)).blob();
      const fd = new FormData();
      fd.append("image", blob, "target.jpg");

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.correction_in) return;

      const dx = Number(data.correction_in.dx);
      const dy = Number(data.correction_in.dy);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

      const inchPerMOA = 1.047 * (yards / 100);
      const toClicks = (v) => (Math.abs(v) / inchPerMOA / 0.25).toFixed(2);

      if (elevClicks) elevClicks.textContent = toClicks(dy);
      if (windClicks) windClicks.textContent = toClicks(dx);

      if (elevDir) elevDir.textContent = data.directions?.elevation || "";
      if (windDir) windDir.textContent = data.directions?.windage || "";

      // If taps didn’t exist, tip should still be truthful
      if (tipText && (!tipText.textContent || tipText.textContent === "—")) {
        tipText.textContent = "Pilot: backend clicks are live (True MOA, 2 decimals).";
      }

      showResults();
    } catch {}
  }

  analyze();
})();
