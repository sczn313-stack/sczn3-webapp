// frontend_new/demo.js
// Tap-only demo mode:
// - draw a blank grid target on canvas
// - user taps shots (stores 7+ taps)
// - compute POIB (centroid), correction (bull - POIB), clicks, score (offset-only)
// - store results into sessionStorage so output.html can display
// - generate a thumbnail image from the canvas for output.html

(function () {
  const $ = (id) => document.getElementById(id);

  const canvas = $("targetCanvas");
  const ctx = canvas.getContext("2d");

  const distanceYardsEl = $("distanceYards");
  const statusEl = $("status");
  const undoBtn = $("undoBtn");
  const clearBtn = $("clearBtn");
  const pressToSeeBtn = $("pressToSee");

  // ---- Storage keys (match output.js expectations) ----
  const PHOTO_KEY  = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY   = "sczn3_distance_yards";
  const RESULT_KEY = "sczn3_sec_results_json";

  // ---- Target geometry (demo) ----
  // Treat canvas as a 23x23 inch target with a 1" grid.
  // Bull is centered.
  const TARGET_INCHES = 23;
  const pxPerInch = canvas.width / TARGET_INCHES; // square canvas assumed

  const bull = { x: canvas.width / 2, y: canvas.height / 2 };

  const shots = []; // {xPx, yPx}

  function setStatus() {
    statusEl.textContent = `${shots.length} taps`;
  }

  function draw() {
    // background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid (1" lines)
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    for (let i = 0; i <= TARGET_INCHES; i++) {
      const p = i * pxPerInch;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }

    // thicker lines every 5"
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= TARGET_INCHES; i += 5) {
      const p = i * pxPerInch;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }

    // bull ring + crosshair
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.arc(bull.x, bull.y, pxPerInch * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bull.x - pxPerInch * 1.2, bull.y);
    ctx.lineTo(bull.x + pxPerInch * 1.2, bull.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bull.x, bull.y - pxPerInch * 1.2);
    ctx.lineTo(bull.x, bull.y + pxPerInch * 1.2);
    ctx.stroke();

    // shots
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      // outer ring
      ctx.fillStyle = "rgba(255,140,0,0.90)";
      ctx.beginPath();
      ctx.arc(s.xPx, s.yPx, 7, 0, Math.PI * 2);
      ctx.fill();

      // inner dot
      ctx.fillStyle = "rgba(70,20,0,0.85)";
      ctx.beginPath();
      ctx.arc(s.xPx, s.yPx, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Convert shot pixel to TARGET inches coords (+X right, +Y up)
  function pxToTargetInches(xPx, yPx) {
    const xIn = (xPx - bull.x) / pxPerInch;
    const yIn = (bull.y - yPx) / pxPerInch; // Y flipped (UP is positive)
    return { xIn, yIn };
  }

  // True MOA conversions: 1 MOA = 1.047" at 100 yards
  function clicksFromInches(inches, yards, moaPerClick = 0.25) {
    const y = Number(yards) || 100;
    const inchesPerMOA = (y / 100) * 1.047;
    const moa = inchesPerMOA > 0 ? inches / inchesPerMOA : 0;
    const clicks = moaPerClick > 0 ? (moa / moaPerClick) : 0;
    return clicks;
  }

  function f2(x) {
    return Math.round(Number(x) * 100) / 100;
  }

  function dirFromSign(axis, value) {
    const v = Number(value) || 0;
    if (v === 0) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  // Offset-only score: smallest offset wins.
  // For pilot: Score = 100 - (offsetInches * 10), clamped 0..100 (simple + explainable)
  function offsetOnlyScore(offsetInches) {
    const raw = 100 - (offsetInches * 10);
    const s = Math.max(0, Math.min(100, raw));
    return Math.round(s);
  }

  function computeResults() {
    const yards = Number(distanceYardsEl.value) || 100;

    // centroid in px
    let sx = 0, sy = 0;
    for (const s of shots) { sx += s.xPx; sy += s.yPx; }
    const cx = shots.length ? sx / shots.length : bull.x;
    const cy = shots.length ? sy / shots.length : bull.y;

    // POIB in inches (target coords)
    const poib = pxToTargetInches(cx, cy); // +x right, +y up
    const poibX = f2(poib.xIn);
    const poibY = f2(poib.yIn);

    // correction = bull - POIB => bull is (0,0)
    const dx = f2(0 - poibX);
    const dy = f2(0 - poibY);

    const windDir = dirFromSign("x", dx);
    const elevDir = dirFromSign("y", dy);

    const windClicks = f2(clicksFromInches(Math.abs(dx), yards));
    const elevClicks = f2(clicksFromInches(Math.abs(dy), yards));

    const offset = Math.sqrt((poibX * poibX) + (poibY * poibY));
    const score = offsetOnlyScore(offset);

    const tip =
      score >= 90 ? "Tight. Confirm with another 5-shot group." :
      score >= 75 ? "Good. Focus on consistent grip and trigger press." :
      "Work fundamentals: sight picture + smooth press. Run another group.";

    return {
      // what output.js can display
      score: String(score),
      elevation: String(elevClicks.toFixed(2)),
      windage: String(windClicks.toFixed(2)),
      elevDir,
      windDir,
      tip,

      // debug/info (optional)
      poib_in: { x: poibX, y: poibY },
      correction_in: { dx, dy },
      distance_yards: yards,
      mode: "tap_demo"
    };
  }

  function saveAndGo() {
    if (shots.length < 3) {
      alert("Tap at least 3 shots first (7 is ideal).");
      return;
    }

    const yards = String(Number(distanceYardsEl.value) || 100);
    sessionStorage.setItem(DIST_KEY, yards);

    // Save thumbnail from canvas as "uploaded photo" so output page shows it
    const thumbDataUrl = canvas.toDataURL("image/png");
    sessionStorage.setItem(PHOTO_KEY, thumbDataUrl);

    const result = computeResults();
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));

    // Go to output
    window.location.href = "./output.html";
  }

  function pointerToCanvasXY(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  // ---- Events ----
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    const p = pointerToCanvasXY(ev);
    shots.push({ xPx: p.x, yPx: p.y });
    draw();
    setStatus();
  });

  undoBtn.addEventListener("click", () => {
    shots.pop();
    draw();
    setStatus();
  });

  clearBtn.addEventListener("click", () => {
    shots.length = 0;
    draw();
    setStatus();
  });

  pressToSeeBtn.addEventListener("click", saveAndGo);

  // keep distance stored
  distanceYardsEl.addEventListener("input", () => {
    sessionStorage.setItem(DIST_KEY, String(distanceYardsEl.value || "100"));
  });
  sessionStorage.setItem(DIST_KEY, String(distanceYardsEl.value || "100"));

  // init
  draw();
  setStatus();
})();
