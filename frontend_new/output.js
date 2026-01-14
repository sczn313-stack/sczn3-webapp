// sczn3-webapp/frontend_new/output.js
// Output page logic (CUT + PASTE FULL FILE)
//
// LOCKS:
// - Uses stored photo + distance from sessionStorage (from index.js)
// - Calls backend /api/analyze with multipart field name: "image"
// - Uses backend correction_in + directions (no reinterpret)
// - Converts inches -> clicks using TRUE MOA (1.047"/100y) + 1/4 MOA per click
// - 2 decimals everywhere

(function () {
  const $ = (id) => document.getElementById(id);

  // ---- Elements (match your output.html) ----
  const secIdText = $("secIdText");

  const targetThumb = $("targetThumb");
  const distanceText = $("distanceText");
  const adjText = $("adjText");

  const noDataBanner = $("noDataBanner");
  const resultsGrid = $("resultsGrid");

  const scoreText = $("scoreText");
  const elevClicksText = $("elevClicksText");
  const elevDirText = $("elevDirText");
  const windClicksText = $("windClicksText");
  const windDirText = $("windDirText");
  const tipText = $("tipText");

  const debugBox = $("debugBox");

  // ---- Storage keys (NEW + backward compatible) ----
  // NEW keys (from the index.js I gave you)
  const K_PHOTO_NEW = "sec_targetPhoto_dataUrl";
  const K_NAME_NEW = "sec_targetPhoto_fileName";
  const K_DIST_NEW = "sec_distance_yards";
  const K_VENDOR_NEW = "sec_vendor_buy_url";
  const K_SECID_NEW = "sec_id";
  const K_RESULT_NEW = "sec_results_json";

  // OLD keys (backward compatibility)
  const K_PHOTO_OLD = "sczn3_targetPhoto_dataUrl";
  const K_NAME_OLD = "sczn3_targetPhoto_fileName";
  const K_DIST_OLD = "sczn3_distance_yards";
  const K_VENDOR_OLD = "sczn3_vendor_buy_url";
  const K_SECID_OLD = "sczn3_sec_id";
  const K_RESULT_OLD = "sczn3_sec_results_json";

  // ---- Helpers ----
  const n = (v, fb = 0) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fb;
  };

  const f2 = (v) => (Math.round(n(v) * 100) / 100).toFixed(2);

  function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
  }
  function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
  }
  function setText(el, value) {
    if (!el) return;
    el.textContent = value == null ? "—" : String(value);
  }
  function safeGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeSet(key, val) {
    try {
      sessionStorage.setItem(key, val);
    } catch {}
  }
  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
  function setDir(el, dir) {
    if (!el) return;
    const d = String(dir || "").trim().toUpperCase();
    el.textContent = d ? d : "";
  }

  // TRUE MOA (1.047" per MOA at 100y)
  function inchesPerMOA(distanceYards) {
    return 1.047 * (n(distanceYards, 100) / 100);
  }

  // clicks = MOA / moaPerClick (default 0.25)
  function clicksFromInches(inches, distanceYards, moaPerClick) {
    const inPer = inchesPerMOA(distanceYards);
    const moa = inPer > 0 ? n(inches) / inPer : 0;
    const c = n(moaPerClick, 0.25) > 0 ? moa / n(moaPerClick, 0.25) : 0;
    return c;
  }

  // Converts dataURL -> Blob so we can send FormData
  function dataUrlToBlob(url) {
    const parts = url.split(",");
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bstr = atob(parts[1]);
    let i = bstr.length;
    const u8 = new Uint8Array(i);
    while (i--) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent =
      (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  function getStoredPhoto() {
    return safeGet(K_PHOTO_NEW) || safeGet(K_PHOTO_OLD) || "";
  }
  function getStoredName() {
    return safeGet(K_NAME_NEW) || safeGet(K_NAME_OLD) || "target.jpg";
  }
  function getStoredDistance() {
    return safeGet(K_DIST_NEW) || safeGet(K_DIST_OLD) || "100";
  }
  function getStoredVendorUrl() {
    return safeGet(K_VENDOR_NEW) || safeGet(K_VENDOR_OLD) || "";
  }
  function getStoredResultJson() {
    return safeGet(K_RESULT_NEW) || safeGet(K_RESULT_OLD) || "";
  }
  function setStoredResultJson(val) {
    safeSet(K_RESULT_NEW, val);
    safeSet(K_RESULT_OLD, val);
  }

  // ---- SEC ID ----
  (function initSecId() {
    if (!secIdText) return;

    const existing =
      safeGet(K_SECID_NEW) ||
      safeGet(K_SECID_OLD);

    if (existing) {
      secIdText.textContent = "SEC-ID — " + existing;
      return;
    }

    const gen = Math.random().toString(16).slice(2, 8).toUpperCase();
    safeSet(K_SECID_NEW, gen);
    safeSet(K_SECID_OLD, gen);
    secIdText.textContent = "SEC-ID — " + gen;
  })();

  // ---- Basics (photo + distance + adjustment label) ----
  const dataUrl = getStoredPhoto();
  const fileName = getStoredName();
  const distance = getStoredDistance(); // string
  const distNum = n(distance, 100);

  setText(distanceText, String(distNum));
  setText(adjText, "1/4 MOA per click");

  if (dataUrl && targetThumb) {
    targetThumb.src = dataUrl;
  } else {
    // Landed here without photo
    setText(scoreText, "—");
    setText(elevClicksText, "—");
    setText(windClicksText, "—");
    setDir(elevDirText, "");
    setDir(windDirText, "");
    setText(tipText, "—");
    show(noDataBanner);
    hide(resultsGrid);
    return;
  }

  // ---- If results already cached, render them ----
  const cached = safeJsonParse(getStoredResultJson());
  if (cached) {
    hide(noDataBanner);
    show(resultsGrid);
    renderFromBackend(cached, { source: "cache" });
    return;
  }

  // Default state until backend responds
  show(noDataBanner);
  hide(resultsGrid);

  // ---- Core render from backend payload ----
  function renderFromBackend(data, meta) {
    // Preferred shape: { correction_in:{dx,dy}, directions:{windage,elevation}, poib_in:{x,y} }
    const dx =
      data?.correction_in?.dx ??
      data?.correctionIn?.dx ??
      data?.correction?.dx ??
      data?.dx ??
      0;

    const dy =
      data?.correction_in?.dy ??
      data?.correctionIn?.dy ??
      data?.correction?.dy ??
      data?.dy ??
      0;

    const windDir =
      data?.directions?.windage ??
      data?.direction?.windage ??
      data?.windageDirection ??
      data?.windDir ??
      "";

    const elevDir =
      data?.directions?.elevation ??
      data?.direction?.elevation ??
      data?.elevationDirection ??
      data?.elevDir ??
      "";

    const windClicks = clicksFromInches(Math.abs(n(dx)), distNum, 0.25);
    const elevClicks = clicksFromInches(Math.abs(n(dy)), distNum, 0.25);

    // Score (pilot-safe): show OFFSET inches (no invented scoring scale)
    let offsetIn = null;
    const px = data?.poib_in?.x ?? data?.poib?.x ?? null;
    const py = data?.poib_in?.y ?? data?.poib?.y ?? null;
    if (px != null && py != null) {
      offsetIn = Math.sqrt(n(px) * n(px) + n(py) * n(py));
    }

    hide(noDataBanner);
    show(resultsGrid);

    if (offsetIn == null) {
      setText(scoreText, "OFFSET —");
    } else {
      setText(scoreText, "OFFSET " + f2(offsetIn) + " in");
    }

    setText(elevClicksText, f2(elevClicks));
    setDir(elevDirText, String(elevDir).trim().toUpperCase());

    setText(windClicksText, f2(windClicks));
    setDir(windDirText, String(windDir).trim().toUpperCase());

    setText(tipText, "Shoot another cluster and scan again.");

    // Optional debug (hidden by default via CSS class)
    if (debugBox) {
      debug(
        "SEC output (locked)",
        {
          meta: meta || {},
          distanceYards: distNum,
          correction_in: { dx: n(dx), dy: n(dy) },
          directions: { windage: windDir, elevation: elevDir },
          computed_clicks: { wind: f2(windClicks), elev: f2(elevClicks) },
          poib_in: data?.poib_in || data?.poib || null,
          lock: "clicks use TRUE MOA + 1/4 MOA per click; directions come from backend",
        }
      );
      // Comment this out if you never want debug visible:
      // show(debugBox);
      hide(debugBox);
    }
  }

  // ---- Backend call (LOCKED: field name = "image", endpoint = /api/analyze) ----
  async function callAnalyze() {
    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();

    // IMPORTANT: backend_new/server.js expects upload.single("image")
    fd.append("image", blob, fileName || "target.jpg");

    // Not required by backend, but harmless if you log later
    fd.append("distanceYards", String(distNum));

    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Analyze failed (HTTP " + res.status + ")");
    return res.json();
  }

  (async function run() {
    try {
      const data = await callAnalyze();

      // Cache for refresh
      try {
        setStoredResultJson(JSON.stringify(data));
      } catch {}

      renderFromBackend(data, { source: "/api/analyze" });
    } catch (err) {
      // Leave banner visible, but show a helpful hint in debug
      debug(
        "No results yet. Backend didn’t return data for /api/analyze.",
        { error: String(err) }
      );
      hide(debugBox); // keep quiet unless you want it visible
      show(noDataBanner);
      hide(resultsGrid);
    }
  })();
})();
