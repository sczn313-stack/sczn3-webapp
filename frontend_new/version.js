// frontend_new/version.js  (NEW FILE — FULL CUT/PASTE)
// Fender Plug: hard-stop if cached/mismatched assets are running.

(() => {
  // IMPORTANT: set this once per release and keep identical in index.html/output.html/receipt.html/saved.html
  const APP_VERSION = "2026.01.18-F";

  const KEY = "tapnscore_app_version";

  function hardStop(msg){
    // Nuke the UI and show a clean recovery action.
    document.documentElement.innerHTML = `
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#000000" />
        <title>Tap-n-Score™</title>
        <style>
          html,body{margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
          .wrap{padding:18px;max-width:720px;margin:0 auto}
          .k{opacity:.75;letter-spacing:.12em;font-size:12px}
          h1{margin:10px 0 6px 0}
          .box{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);border-radius:18px;padding:14px;margin-top:12px}
          button{width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:#fff;color:#000;font-weight:800;font-size:16px;margin-top:14px}
          .mini{opacity:.75;font-size:12px;margin-top:10px}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="k">TAP-N-SCORE™</div>
          <h1>Update required</h1>
          <div class="box">${String(msg || "A cached file mismatch was detected. Please reload.")}</div>
          <button id="reloadBtn" type="button">Reload now</button>
          <div class="mini">Version: ${APP_VERSION}</div>
        </div>
        <script>
          document.getElementById("reloadBtn").addEventListener("click", () => {
            try {
              // Clear storage marker so next load is clean
              sessionStorage.clear();
            } catch {}
            // Hard reload with cache-bust
            window.location.href = window.location.pathname + "?v=" + Date.now();
          });
        </script>
      </body>
    `;
  }

  try{
    const seen = localStorage.getItem(KEY);
    if (!seen){
      localStorage.setItem(KEY, APP_VERSION);
      return;
    }
    if (seen !== APP_VERSION){
      localStorage.setItem(KEY, APP_VERSION);
      hardStop(`Your device loaded mixed cached files (${seen} vs ${APP_VERSION}).`);
    }
  } catch {
    // If localStorage blocked, fail open (don't brick the app)
  }

  // expose for debugging
  window.TAPNSCORE_VERSION = APP_VERSION;
})();
