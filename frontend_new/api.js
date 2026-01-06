// frontend_new/api.js
// Locked: backend expects multipart field name "image"

const BACKEND_BASE = "https://sczn3-backend-new.onrender.com"; // ✅ your live backend

async function postAnalyze(file) {
  const fd = new FormData();
  fd.append("image", file); // ✅ must be "image"

  const url = `${BACKEND_BASE}/api/analyze`;
  const r = await fetch(url, { method: "POST", body: fd });

  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, error: "Non-JSON response", raw: text };
  }

  if (!r.ok || !data.ok) {
    const msg = data.error || data.message || `HTTP ${r.status}`;
    throw new Error(`Analyze failed: ${msg}`);
  }

  return data;
}

// True MOA only (simple + stable)
function inchesPerMOAAtYards(yards) {
  const y = Number(yards) || 100;
  return (1.047 * y) / 100;
}

// Default click value locked here (change ONE value later if you want)
const MOA_PER_CLICK_DEFAULT = 0.25;

function clicksFromInches(inches, yards) {
  const ipm = inchesPerMOAAtYards(yards);
  const moa = inches / ipm;
  const clicks = moa / MOA_PER_CLICK_DEFAULT;
  return Math.round(clicks * 100) / 100;
}
