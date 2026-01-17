// sczn3-webapp/frontend_new/output.js  (FULL REPLACEMENT)
// Renders Tap-N-Score results from sessionStorage "tapnscore_result"

(function () {
  const RESULT_KEY = "tapnscore_result";

  function $(id){ return document.getElementById(id); }

  const out = $("out") || document.body;

  function esc(s){
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  const raw = sessionStorage.getItem(RESULT_KEY);
  if (!raw){
    out.innerHTML = `
      <div style="padding:18px;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="opacity:0.8;margin-bottom:10px;">Results</div>
        <div style="font-size:22px;font-weight:650;margin-bottom:10px;">No result found.</div>
        <a href="index.html" style="color:#fff;text-decoration:underline;">Back</a>
      </div>
    `;
    return;
  }

  let r = null;
  try { r = JSON.parse(raw); } catch { r = null; }

  if (!r || r.ok !== true){
    out.innerHTML = `
      <div style="padding:18px;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="opacity:0.8;margin-bottom:10px;">Results</div>
        <div style="font-size:22px;font-weight:650;margin-bottom:10px;">Invalid result payload.</div>
        <a href="index.html" style="color:#fff;text-decoration:underline;">Back</a>
      </div>
    `;
    return;
  }

  const windDir = r?.directions?.windage || "";
  const elevDir = r?.directions?.elevation || "";
  const windClicks = r?.clicks?.windage || "0.00";
  const elevClicks = r?.clicks?.elevation || "0.00";

  const score = Number.isFinite(Number(r.score)) ? String(r.score) : "";
  const tip = r.tip ? esc(r.tip) : "";

  out.innerHTML = `
    <div style="padding:18px;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;">
      <div style="opacity:0.7;letter-spacing:1.4px;text-transform:uppercase;font-size:12px;margin-bottom:10px;">Results</div>

      <div style="font-size:26px;font-weight:650;margin-bottom:6px;">Measured Outcome</div>
      <div style="opacity:0.75;font-size:14px;margin-bottom:14px;">Confirmed hits analyzed.</div>

      <div style="border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);border-radius:14px;padding:16px;">
        <div style="font-size:16px;font-weight:650;margin-bottom:10px;">Recommended Adjustment</div>

        <div style="line-height:1.55;">
          <div><b>Windage:</b> ${esc(windClicks)} clicks ${esc(windDir)}</div>
          <div><b>Elevation:</b> ${esc(elevClicks)} clicks ${esc(elevDir)}</div>
          ${score ? `<div style="margin-top:10px;"><b>Score:</b> ${esc(score)}</div>` : ``}
        </div>

        <div style="margin-top:12px;font-size:14px;font-weight:650;opacity:0.9;">After-Shot Intelligence™</div>
      </div>

      ${tip ? `<div style="margin-top:12px;opacity:0.75;font-size:13px;">${tip}</div>` : ``}

      <div style="margin-top:16px;">
        <a href="index.html"
           style="display:inline-block;width:100%;text-align:center;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.12);color:#fff;text-decoration:none;font-weight:650;">
          Start next session
        </a>
      </div>
    </div>
  `;
})();
