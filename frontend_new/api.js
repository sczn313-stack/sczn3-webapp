// sczn3-webapp/frontend_new/api.js
// Frontend API helper for Tap-n-Score / SEC
//
// Uses full backend URL because Render Static Site is a different origin.
// Optional override:
//   sessionStorage.setItem("sczn3_backend_base","https://sczn3-backend-new1.onrender.com")

(function () {
  const DIST_KEY = "sczn3_distance_yards";
  const TAPS_KEY = "sczn3_taps_json"; // stringified JSON: { bull:{x,y}, holes:[{x,y},...] }

  window.SEC_API = {
    async analyzeTarget({ file, distanceYards, tapsJson }) {
      const backendBase =
        sessionStorage.getItem("sczn3_backend_base") ||
        "https://sczn3-backend-new1.onrender.com";

      if (!file) throw new Error("No file provided.");

      // Thumb for UI
      const thumbDataUrl = await fileToDataUrl(file);

      const fd = new FormData();
      fd.append("image", file, file.name || "target.jpg");

      const dist = Number(distanceYards || sessionStorage.getItem(DIST_KEY) || 100);
      fd.append("distanceYards", String(dist));

      // Prefer explicit tapsJson passed in; else try sessionStorage
      const taps =
        tapsJson ||
        (function () {
          const raw = sessionStorage.getItem(TAPS_KEY);
          try { return raw ? JSON.parse(raw) : null; } catch { return null; }
        })();

      // Fender plug: only attach tapsJson if it looks valid
      if (taps && taps.bull && Array.isArray(taps.holes) && taps.holes.length > 0) {
        fd.append("tapsJson", JSON.stringify(taps));
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
        distanceYards: dist,
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
    try { return await res.text(); } catch { return ""; }
  }
})();
