// frontend_new/api.js
// Backend API + click math (true MOA, 1/4 MOA per click)

const API_BASE = "https://sczn3-sec-backend-144.onrender.com"; // <-- keep your real backend here

async function postAnalyze(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Analyze failed: ${res.status} ${res.statusText} ${t}`.trim());
  }

  return await res.json();
}

// inches → clicks using TRUE MOA (1 MOA = 1.047" @ 100y) and 0.25 MOA/click
function clicksFromInches(inches, yards, clickValueMOA = 0.25) {
  const y = Number(yards) || 100;
  const inchesPerMOA = 1.047 * (y / 100);
  const moa = inches / inchesPerMOA;
  return moa / clickValueMOA;
}
