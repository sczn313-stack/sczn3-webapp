// frontend_new/app.jshttps://dashboard.render.com/web/srv-d51b1q6mcj7s73end6i0/settings
// Rule: clicks to move POIB -> Bull = bull - POIB
// Inches only. Two decimals always.

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt2(n) {
  return round2(n).toFixed(2);
}

// Inches per MOA at a given distance
function inchesPerMOA(distanceYards, useTrueMOA) {
  const moaAt100 = useTrueMOA ? 1.047 : 1.0; // inches at 100y
  return moaAt100 * (distanceYards / 100);
}

function axisDirection(delta, axis) {
  if (delta === 0) return "NONE";
  if (axis === "x") return delta > 0 ? "RIGHT" : "LEFT";
  return delta > 0 ? "UP" : "DOWN";
}

function getNumber(id) {
  const el = document.getElementById(id);
  return Number(el.value);
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function calculate() {
  const distanceYards = getNumber("distance");
  const clickMOA = getNumber("clickValue");
  const useTrueMOA = document.getElementById("trueMoa").value === "true";

  const bullX = getNumber("bullX");
  const bullY = getNumber("bullY");
  const poibX = getNumber("poibX");
  const poibY = getNumber("poibY");

  // IMPORTANT: correction = bull - POIB
  const dx = bullX - poibX; // + => dial RIGHT
  const dy = bullY - poibY; // + => dial UP

  const ipm = inchesPerMOA(distanceYards, useTrueMOA);

  const windMOA = dx / ipm;
  const elevMOA = dy / ipm;

  const windClicks = windMOA / clickMOA;
  const elevClicks = elevMOA / clickMOA;

  setText("dx", fmt2(dx));
  setText("dy", fmt2(dy));

  setText("windDir", axisDirection(dx, "x"));
  setText("windClicks", fmt2(Math.abs(windClicks)));
  setText("windMoa", fmt2(Math.abs(windMOA)));

  setText("elevDir", axisDirection(dy, "y"));
  setText("elevClicks", fmt2(Math.abs(elevClicks)));
  setText("elevMoa", fmt2(Math.abs(elevMOA)));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calcBtn").addEventListener("click", calculate);

  // Auto-calc when values change
  ["distance","clickValue","trueMoa","bullX","bullY","poibX","poibY"].forEach((id) => {
    document.getElementById(id).addEventListener("input", calculate);
    document.getElementById(id).addEventListener("change", calculate);
  });

  calculate();
});
