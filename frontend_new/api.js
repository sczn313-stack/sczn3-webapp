// sczn3-webapp/frontend_new/api.js
// Frontend API helper for SEC
//
// Uses full backend URL because Render Static Site is a different origin.
// Optional override (recommended):
//   sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com")

window.SEC_API = {
  async analyzeTarget({ file, distanceYards }) {
    const backendBase =
      sessionStorage.getItem("sczn3_backend_base") ||
      "https://sczn3-backend-new1.onrender.com";

    if (!file) throw new Error("No file provided.");

    // 1) Create thumbnail locally (fast + reliable)
    const thumbDataUrl = await fileToDataUrl(file);

    // 2) Send image to backend for analysis
    const fd = new FormData();
    fd.append("image", file, file.name || "target.jpg");
    fd.append("distanceYards", String(distanceYards || 100)); // optional, only if backend uses it

    const res = await fetch(`${backendBase}/api/analyze`, {
      method: "POST",
      body: fd
    });

    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`Backend analyze failed (${res.status}). ${txt}`);
    }

    const data = await res.json();

    // You can keep a stable secId here if backend returns one
    const secId =
      (data && (data.secId || data.sec_id || data.id)) ||
      sessionStorage.getItem("sczn3_sec_id") ||
      String(Math.random().toString(16).slice(2, 8).toUpperCase());

    sessionStorage.setItem("sczn3_sec_id", secId);

    return {
      secId,
      distanceYards: Number(distanceYards || 100),
      thumbDataUrl,
      data // <-- includes correction_in + directions if backend provides them
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
