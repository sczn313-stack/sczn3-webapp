// sczn3-webapp/frontend_new/api.js
// Frontend API helper for Tap-n-Score / SEC
//
// Uses full backend URL because Render Static Site is a different origin.
// Optional override:
//   sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com")

window.SEC_API = {
  async analyzeTarget({ file, distanceYards, tapsJson }) {
    const backendBase =
      sessionStorage.getItem("sczn3_backend_base") ||
      "https://sczn3-backend-new1.onrender.com";

    if (!file) throw new Error("No file provided.");

    // Create thumbnail locally (fast + reliable)
    const thumbDataUrl = await fileToDataUrl(file);

    // Build form
    const fd = new FormData();
    fd.append("image", file, file.name || "target.jpg");
    fd.append("distanceYards", String(distanceYards || 100));

    // IMPORTANT: send tapsJson if provided
    if (tapsJson) {
      const payload = typeof tapsJson === "string" ? tapsJson : JSON.stringify(tapsJson);
      fd.append("tapsJson", payload);
    }

    const res = await fetch(`${backendBase}/api/analyze`, {
      method: "POST",
      body: fd
    });

    if (!res.ok) {
      const txt = await safeText(res);
      throw new Error(`Backend analyze failed (${res.status}). ${txt}`);
    }

    const data = await res.json();

    const secId =
      (data && (data.secId || data.sec_id || data.id)) ||
      sessionStorage.getItem("sczn3_sec_id") ||
      String(Math.random().toString(16).slice(2, 8).toUpperCase());

    sessionStorage.setItem("sczn3_sec_id", secId);

    return {
      secId,
      distanceYards: Number(distanceYards || 100),
      thumbDataUrl,
      data
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
