(() => {
  const $ = id => document.getElementById(id);

  const PHOTO = "sczn3_targetPhoto_dataUrl";
  const DIST  = "sczn3_distance_yards";
  const TAPS  = "sczn3_tap_points_json";

  const secIdText = $("secIdText");
  const thumb = $("targetThumb");
  const distanceText = $("distanceText");
  const adjText = $("adjText");

  const noData = $("noData");
  const results = $("results");

  const scoreText = $("scoreText");
  const elevClicks = $("elevClicks");
  const windClicks = $("windClicks");
  const elevDir = $("elevDir");
  const windDir = $("windDir");
  const tipText = $("tipText");

  // ---------- SEC ID ----------
  let sid = sessionStorage.getItem("sczn3_sec_id");
  if (!sid) {
    sid = Math.random().toString(16).slice(2,8).toUpperCase();
    sessionStorage.setItem("sczn3_sec_id", sid);
  }
  secIdText.textContent = `SEC-ID — ${sid}`;

  // ---------- BASE DATA ----------
  const imgData = sessionStorage.getItem(PHOTO);
  const yards = Number(sessionStorage.getItem(DIST) || 100);

  distanceText.textContent = yards;
  adjText.textContent = "1/4 MOA per click";

  if (!imgData) return;

  thumb.src = imgData;

  // ---------- TAP SCORE ----------
  thumb.onload = () => {
    const taps = JSON.parse(sessionStorage.getItem(TAPS) || "[]");
    if (!Array.isArray(taps) || taps.length === 0) return;

    const w = thumb.naturalWidth;
    const h = thumb.naturalHeight;

    let sx=0, sy=0;
    taps.forEach(p => { sx+=p.x; sy+=p.y; });

    const cx = w/2;
    const cy = h/2;
    const px = sx/taps.length;
    const py = sy/taps.length;

    const dist = Math.hypot(px-cx, py-cy);
    const score = Math.max(0, Math.round(1000 - dist));

    scoreText.textContent = score;
    tipText.textContent = `Tap & Score pilot — ${taps.length} shot(s) recorded.`;

    noData.classList.add("hidden");
    results.classList.remove("hidden");
  };

  // ---------- BACKEND ANALYZE ----------
  async function analyze() {
    try {
      const blob = await (await fetch(imgData)).blob();
      const fd = new FormData();
      fd.append("image", blob);

      const res = await fetch("/api/analyze", { method:"POST", body:fd });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.correction_in) return;

      const inchPerMOA = 1.047 * (yards/100);
      const clicks = v => (Math.abs(v)/inchPerMOA/0.25).toFixed(2);

      elevClicks.textContent = clicks(data.correction_in.dy);
      windClicks.textContent = clicks(data.correction_in.dx);

      elevDir.textContent = data.directions?.elevation || "";
      windDir.textContent = data.directions?.windage || "";

      noData.classList.add("hidden");
      results.classList.remove("hidden");
    } catch {}
  }

  analyze();
})();
