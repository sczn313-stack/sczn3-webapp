// frontend_new/api.js  (FULL CUT/PASTE REPLACEMENT)
// Locks frontend -> backend (prevents "Not Found" from static site),
// provides one analyze function, and stores the last result for output.html.

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  const SS_LAST_RESULT = "sczn3_last_result_json";
  const SS_PHOTO       = "sczn3_targetPhoto_dataUrl";
  const SS_TAPS        = "sczn3_taps_v1";

  function safeJsonParse(s){
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function timeoutFetch(url, opts, ms){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(() => clearTimeout(t));
  }

  async function postJson(path, body, ms = 20000){
    const url = BACKEND_BASE + path;

    try{
      const res = await timeoutFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        mode: "cors",
        cache: "no-store"
      }, ms);

      const txt = await res.text().catch(() => "");
      let data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }

      if (!res.ok){
        return { ok:false, status: res.status, error: data || { message: txt || "Request failed." } };
      }

      return { ok:true, status: res.status, data };
    } catch (e){
      const msg = (e && e.name === "AbortError")
        ? "Request timed out. Try again."
        : "Network/server error. Try again.";
      return { ok:false, status:0, error:{ message: msg } };
    }
  }

  // This is what index.js calls (optional hook)
  window.sczn3Analyze = async function ({ distanceYds = 100, vendorLink = "", taps = [] } = {}) {
    // Guard: need photo + at least 1 tap
    let photoDataUrl = "";
    try { photoDataUrl = sessionStorage.getItem(SS_PHOTO) || ""; } catch {}

    if (!photoDataUrl) {
      return { ok:false, error:{ message:"No photo loaded." } };
    }
    if (!Array.isArray(taps) || taps.length < 1) {
      return { ok:false, error:{ message:"No taps captured." } };
    }

    // Payload to backend_new/server.js expects tapsJson = array of points
    // bull-first convention: user should tap bull FIRST, then holes
    // Here we send as array in the required shape.
    const tapsJson = taps.map(p => ({ x: Number(p.x), y: Number(p.y) }));

    const payload = {
      distanceYards: Number(distanceYds) || 100,
      tapsJson: JSON.stringify(tapsJson),
      // optionally include image as multipart in future, but backend supports taps-only
      // Also include natural dims if your UI has them later
    };

    // Store "Analyzing..." stub
    try {
      sessionStorage.setItem(SS_LAST_RESULT, JSON.stringify({
        ok:false,
        error:{ message:"Analyzing…" },
        created_at: new Date().toISOString()
      }));
    } catch {}

    const r = await postJson("/api/analyze", payload);

    // Store final result for output.html to render
    try {
      sessionStorage.setItem(SS_LAST_RESULT, JSON.stringify(r.ok ? (r.data || {}) : ({
        ok:false,
        error: r.error || { message:"Analyze failed." },
        status: r.status
      })));
    } catch {}

    // Navigate to output page on success/failure (output page shows status)
    window.location.href = "./output.html?v=" + Date.now();
    return r;
  };

  // helper: allow manual override if needed
  window.setSczn3BackendBase = function (url) {
    // kept for future; not used in this pinned version
    console.log("Backend base is pinned in api.js:", BACKEND_BASE, "requested:", url);
  };
})();
