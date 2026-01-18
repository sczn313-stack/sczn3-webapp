// sczn3-webapp/frontend_new/api.js (FULL FILE REPLACEMENT)
// One job: call backend /analyze and return JSON.
// Provides: window.sczn3Analyze(payload)

(() => {
  // IMPORTANT: set this to your backend base URL
  const BASE = "https://sczn3-backend-new1.onrender.com";

  async function postJson(path, body){
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });

    // Try parse JSON even on errors
    let data = null;
    try { data = await res.json(); } catch {}

    if (!res.ok){
      const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // Your backend earlier complained: "Need either (dx & dy) inches override OR tapsJson with bull+holes."
  // So we build a tapsJson that includes bull + holes.
  // For now: bull is center of the displayed image; holes are taps.
  // If you already compute bull elsewhere, replace this logic.
  window.sczn3Analyze = async function(payload){
    const taps = Array.isArray(payload?.taps) ? payload.taps : [];
    const distanceYards = payload?.distanceYards;
    const vendorUrl = payload?.vendorUrl || "";

    // Build tapsJson expected by backend
    // bull at (0,0) is not right; we set bull to center in pixel coords
    // Backend should interpret as pixels and compute offsets; if backend expects inches, convert there.
    // NOTE: If your backend expects normalized coords, adjust here.
    const tapsJson = {
      bull: { x: 0, y: 0 },  // placeholder; backend can overwrite if it has bull detection
      holes: taps.map(t => ({ x: t.x, y: t.y }))
    };

    return postJson("/analyze", {
      distanceYards,
      vendorUrl,
      tapsJson
    });
  };
})();
