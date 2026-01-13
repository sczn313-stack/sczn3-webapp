// sczn3-webapp/frontend_new/output.js
// Output page logic for output.html (the one you pasted)
//
// What it does:
// - Loads the uploaded target image (from sessionStorage) into #targetThumb
// - Loads distance into #distanceText
// - Sets default adjustment text into #adjText
// - Shows a friendly "no data yet" banner until results exist
// - Optional: tries to call backend endpoints safely (won't break UI)

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ---- Elements (match output.html) ----
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

  // ---- Storage keys (must match index.js) ----
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY = "sczn3_distance_yards";

  // Optional result cache keys (if backend or other code stores them later)
  const RESULT_KEY = "sczn3_sec_results_json";

  // ---- Helpers ----
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

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function setDir(el, dir) {
    if (!el) return;
    const d = (dir || "").toString().trim();
    el.textContent = d ? d : "";
  }

  function setClicks(value, valueEl, dir, dirEl) {
    // value can be a string like "4.25" or "4.25 UP" or an object { clicks:"4.25", dir:"UP" }
    if (value && typeof value === "object") {
      setText(valueEl, value.clicks ?? value.value ?? "—");
      setDir(dirEl, value.dir ?? "");
      return;
    }

    const s = (value == null ? "" : String(value)).trim();
    if (!s) {
      setText(valueEl, "—");
      setDir(dirEl, "");
      return;
    }

    // Try to split "4.25 UP"
    const parts = s.split(/\s+/);
    if (parts.length >= 2) {
      setText(valueEl, parts[0]);
      setDir(dirEl, parts.slice(1).join(" "));
    } else {
      setText(valueEl, s);
      setDir(dirEl, dir || "");
    }
  }

  // Converts dataURL -> Blob so we can send FormData
  function dataUrlToBlob(url) {
    const parts = url.split(",");
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent =
      (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  // ---- Load basics (photo + distance) ----
  const dataUrl = sessionStorage.getItem(PHOTO_KEY);
  const distance = sessionStorage.getItem(DIST_KEY) || "100";

  // SEC ID (simple for now)
  if (secIdText) {
    const existing = sessionStorage.getItem("sczn3_sec_id");
    if (existing) {
      secIdText.textContent = "SEC-ID — " + existing;
    } else {
      const gen = Math.random().toString(16).slice(2, 8).toUpperCase();
      sessionStorage.setItem("sczn3_sec_id", gen);
      secIdText.textContent = "SEC-ID — " + gen;
    }
  }

  // Fill Distance + Adjustment defaults
  setText(distanceText, distance);
  setText(adjText, "1/4 MOA per click");

  // Load preview image
  if (dataUrl && targetThumb) {
    targetThumb.src = dataUrl;
  } else {
    // No photo means they landed here without upload
    setText(scoreText, "—");
    setClicks(null, elevClicksText, "", elevDirText);
    setClicks(null, windClicksText, "", windDirText);
    setText(tipText, "—");
    show(noDataBanner);
    hide(resultsGrid);
    return;
  }

  // ---- If results were saved already, show them immediately ----
  const cached = safeJsonParse(sessionStorage.getItem(RESULT_KEY) || "");
  if (cached) {
    hide(noDataBanner);
    show(resultsGrid);

    setText(scoreText, cached.score ?? cached.smartScore ?? "—");

    // Support multiple naming styles
    const elevVal =
      cached.elevation ?? cached.elev ?? cached.elevClicks ?? cached.elev_clicks ?? null;
    const windVal =
      cached.windage ?? cached.wind ?? cached.windClicks ?? cached.wind_clicks ?? null;

    setClicks(elevVal, elevClicksText, cached.elevDir, elevDirText);
    setClicks(windVal, windClicksText, cached.windDir, windDirText);

    setText(tipText, cached.tip ?? cached.message ?? "—");
    return;
  }

  // Default state: no results yet (until backend wired)
  show(noDataBanner);
  hide(resultsGrid);

  // ---- OPTIONAL: Try backend endpoints safely (won't break UI) ----
  async function tryPost(url) {
    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();
    fd.append("targetPhoto", blob, "target.jpg");
    fd.append("distanceYards", distance);

    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  (async function () {
    const endpoints = ["/analyze", "/api/analyze", "/sec/analyze"];

    for (const ep of endpoints) {
      try {
        const data = await tryPost(ep);

        // If we got here, we have a working endpoint.
        // Cache it so refresh keeps results.
        try {
          sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
        } catch {}

        hide(noDataBanner);
        show(resultsGrid);

        setText(scoreText, data.score ?? data.smartScore ?? "—");

        // Directions/clicks support
        const elevVal =
          data.elevation ?? data.elev ?? data.elevClicks ?? data.elev_clicks ?? data.clicksElevation ?? null;
        const windVal =
          data.windage ?? data.wind ?? data.windClicks ?? data.wind_clicks ?? data.clicksWindage ?? null;

        setClicks(elevVal, elevClicksText, data.elevDir, elevDirText);
        setClicks(windVal, windClicksText, data.windDir, windDirText);

        setText(tipText, data.tip ?? data.message ?? "—");
        return;
      } catch (err) {
        // keep trying next endpoint
      }
    }

    // No endpoint found (normal for now)
    // Leave the banner visible.
  })();
})();
