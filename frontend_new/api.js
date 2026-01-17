// sczn3-webapp/frontend_new/api.js
// Frontend API helper for Tap-n-Score / SEC
//
// Optional override (recommended):
//   sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com")

window.SEC_API = {
  async analyzeTarget({ file, distanceYards, moaPerClick = 0.25, targetWIn = 8.5, targetHIn = 11 }) {
    const backendBase =
      sessionStorage.getItem("sczn3_backend_base") ||
      "https://sczn3-backend-new1.onrender.com";

    if (!file) throw new Error("No file provided.");

    // distanceYards is REQUIRED by backend_new
    const dy = Number(distanceYards);
    if (!Number.isFinite(dy) || dy <= 0) {
      throw new Error("distanceYards must be > 0 (required).");
    }

    // 1) Create thumbnail locally (fast + reliable)
    const thumbDataUrl = await fileToDataUrl(file);

    // 2) Send image to backend for analysis
    const fd = new FormData();
    fd.append("image", file, file.name || "target.jpg");
    fd.append("distanceYards", String(dy));          // REQUIRED
    fd.append("moaPerClick", String(moaPerClick));   // optional (default 0.25)
    fd.append("targetWIn", String(targetWIn));       // optional (default 8.5)
    fd.append("targetHIn", String(targetHIn));       // optional (default 11)

    const res = await fetch(`${backendBase}/api/analyze`, {
      method: "POST",
      body: fd
    });

    const txt = await safeText(res);
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }

    // 3) Handle errors (HTTP or ok:false)
    if (!res.ok) {
      const msg = data?.error?.message || txt || `Backend analyze failed (${res.status}).`;
      throw new Error(msg);
    }
    if (!data || data.ok !== true) {
      const msg = data?.error?.message || "Backend returned ok:false.";
      throw new Error(msg);
    }

    // 4) Stable secId (keep your existing behavior)
    const secId =
      (data && (data.secId || data.sec_id || data.id)) ||
      sessionStorage.getItem("sczn3_sec_id") ||
      String(Math.random().toString(16).slice(2, 8).toUpperCase());

    sessionStorage.setItem("sczn3_sec_id", secId);

    return {
      secId,
      distanceYards: dy,
      thumbDataUrl,
      data // includes: correction_in, directions, clicks, score, tip, mode, build...
    };
  }
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("FileReader failed."));
    r.readAsDataURL(file);
  });
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
