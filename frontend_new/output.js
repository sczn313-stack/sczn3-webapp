// sczn3-webapp/frontend_new/output.js
(function () {
  function $(id) {
    return document.getElementById(id);
  }

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

  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const DIST_KEY  = "sczn3_distance_yards";
  const RESULT_KEY = "sczn3_sec_results_json";

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
    el.textContent = value == null || value === "" ? "—" : String(value);
  }
  function setDir(el, dir) {
    if (!el) return;
    const d = String(dir || "").trim();
    el.textContent = d ? d : "";
  }

  // Accepts:
  // - "7.26 DOWN"
  // - { clicks: "7.26", dir: "DOWN" }
  // - { value: "7.26", dir: "DOWN" }
  function setClicks(v, vEl, dEl) {
    if (!v) {
      setText(vEl, "—");
      setDir(dEl, "");
      return;
    }

    if (typeof v === "object") {
      setText(vEl, v.clicks ?? v.value ?? "—");
      setDir(dEl, v.dir ?? "");
      return;
    }

    const s = String(v).trim();
    if (!s) {
      setText(vEl, "—");
      setDir(dEl, "");
      return;
    }

    const parts = s.split(/\s+/);
    if (parts.length >= 2) {
      setText(vEl, parts[0]);
      setDir(dEl, parts.slice(1).join(" "));
    } else {
      setText(vEl, s);
      setDir(dEl, "");
    }
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  // dataURL -> Blob
  function dataUrlToBlob(url) {
    const parts = url.split(",");
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  function debug(msg, obj) {
    if (!debugBox) return;
    debugBox.textContent = (msg || "") + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    show(debugBox);
  }

  function forceShowResults() {
    // THIS is the fix for your screenshot problem.
    if (noDataBanner) hide(noDataBanner);
    if (resultsGrid) show(resultsGrid);
  }

  function showNoData() {
    if (noDataBanner) show(noDataBanner);
    if (resultsGrid) hide(resultsGrid);
  }

  // SEC ID
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

  // Basics
  const dataUrl = sessionStorage.getItem(PHOTO_KEY);
  const distance = sessionStorage.getItem(DIST_KEY) || "100";

  setText(distanceText, distance);
  setText(adjText, "1/4 MOA per click");

  if (dataUrl && targetThumb) {
    targetThumb.src = dataUrl;
  } else {
    showNoData();
    return;
  }

  // 1) If cached results exist, use them immediately
  const cached = safeJsonParse(sessionStorage.getItem(RESULT_KEY) || "");
  if (cached) {
    forceShowResults();

    setText(scoreText, cached.score ?? cached.smartScore ?? "—");

    const elevVal =
      cached.elevation ?? cached.elev ?? cached.elevClicks ?? cached.elev_clicks ?? cached.clicksElevation ?? null;

    const windVal =
      cached.windage ?? cached.wind ?? cached.windClicks ?? cached.wind_clicks ?? cached.clicksWindage ?? null;

    setClicks(elevVal, elevClicksText, elevDirText);
    setClicks(windVal, windClicksText, windDirText);

    setText(tipText, cached.tip ?? cached.message ?? "—");
    return;
  }

  // Default state until backend responds
  showNoData();

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

        try {
          sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
        } catch {}

        forceShowResults();

        setText(scoreText, data.score ?? data.smartScore ?? "—");

        const elevVal =
          data.elevation ?? data.elev ?? data.elevClicks ?? data.elev_clicks ?? data.clicksElevation ?? null;

        const windVal =
          data.windage ?? data.wind ?? data.windClicks ?? data.wind_clicks ?? data.clicksWindage ?? null;

        setClicks(elevVal, elevClicksText, elevDirText);
        setClicks(windVal, windClicksText, windDirText);

        setText(tipText, data.tip ?? data.message ?? "—");
        return;
      } catch (err) {
        // try next endpoint
      }
    }

    // If no endpoint works, we keep "No results..." visible.
  })();
})();
