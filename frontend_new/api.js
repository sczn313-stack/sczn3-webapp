// frontend_new/api.js  (FULL CUT/PASTE REPLACEMENT — sends NORMALIZED taps as-is)
// IMPORTANT:
// - Your index.js stores taps as normalized 0..1 coords in sessionStorage("sczn3_taps_v1")
// - This api.js sends tapsJson with those normalized coords (bull first) to the backend
// - Backend V4 auto-detects normalized vs pixels, so this is rock solid.

(() => {
  const BACKEND_BASE = "https://sczn3-backend-new1.onrender.com";

  const SS_LAST_RESULT = "sczn3_last_result_json";
  const SS_PHOTO       = "sczn3_targetPhoto_dataUrl";
  const SS_TAPS        = "sczn3_taps_v1";
  const SS_VENDOR      = "sczn3_vendor_buy_url";

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

  // Called by index.js
  window.sczn3Analyze = async function ({ distanceYds = 100, vendorLink = "", taps = [] } = {}) {
    // store vendor link for Receipt + Saved pages
    try {
      if (vendorLink && String(vendorLink).trim()) {
        sessionStorage.setItem(SS_VENDOR, String(vendorLink).trim());
      }
    } catch {}

    // Guard: need photo + taps
    let photoDataUrl = "";
    try { photoDataUrl = sessionStorage.getItem(SS_PHOTO) || ""; } catch {}
    if (!photoDataUrl) {
      return { ok:false, error:{ message:"No photo loaded." } };
    }

    if (!Array.isArray(taps) || taps.length < 2) {
      // REQUIRE bull + at least one hole
      return { ok:false, error:{ message:"Tap bull first, then at least 1 hole." } };
    }

    // taps are normalized; send as-is
    const tapsJson = JSON.stringify(taps.map(p => ({ x: Number(p.x), y: Number(p.y) })));

    // (Optional) keep a copy in sessionStorage
    try { sessionStorage.setItem(SS_TAPS, JSON.stringify(taps)); } catch {}

    // Place "Analyzing..." stub so output.html can show clean status
    try {
      sessionStorage.setItem(SS_LAST_RESULT, JSON.stringify({
        ok:false,
        error:{ message:"Analyzing…" },
        created_at: new Date().toISOString()
      }));
    } catch {}

    const payload = {
      distanceYards: Number(distanceYds) || 100,
      tapsJson
    };

    const r = await postJson("/api/analyze", payload);

    // Store final result for output.html
    try {
      sessionStorage.setItem(SS_LAST_RESULT, JSON.stringify(
        r.ok ? (r.data || {}) : ({
          ok:false,
          error: r.error || { message:"Analyze failed." },
          status: r.status
        })
      ));
    } catch {}

    // Always go to output to show result / error
    window.location.href = "./output.html?v=" + Date.now();
    return r;
  };

  // Optional debug helpers
  window.sczn3Ping = async function () {
    return await postJson("/health", {}, 8000);
  };
})();
