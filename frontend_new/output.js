(function () {
  const $ = (id) => document.getElementById(id);

  // Elements
  const secIdText = $("secIdText");
  const targetThumb = $("targetThumb");
  const distanceText = $("distanceText");
  const adjText = $("adjText");

  const noDataBanner = $("noDataBanner");
  const resultsGrid = $("resultsGrid");

  const scoreText = $("scoreText");
  const elevClicksText = $("elevClicksText");
  const windClicksText = $("windClicksText");
  const elevDirText = $("elevDirText");
  const windDirText = $("windDirText");
  const tipText = $("tipText");

  const debugBox = $("debugBox");

  function showDebug(obj) {
    debugBox.classList.remove("hidden");
    debugBox.textContent = JSON.stringify(obj, null, 2);
  }

  function showResults() {
    noDataBanner.classList.add("hidden");
    resultsGrid.classList.remove("hidden");
  }

  function showNoData() {
    noDataBanner.classList.remove("hidden");
    resultsGrid.classList.add("hidden");
  }

  // 1) Try query string first (optional)
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("data");

  // 2) Then try localStorage (recommended)
  // Your index page should set this after Generate SEC:
  // localStorage.setItem("sczn3_last_result", JSON.stringify(result));
  const fromStorage = localStorage.getItem("sczn3_last_result");

  let payload = null;

  try {
    if (fromQuery) {
      // If data is base64 encoded JSON
      const json = atob(fromQuery);
      payload = JSON.parse(json);
    } else if (fromStorage) {
      payload = JSON.parse(fromStorage);
    }
  } catch (e) {
    showNoData();
    showDebug({ error: "Failed to parse payload", message: String(e) });
    return;
  }

  if (!payload || typeof payload !== "object") {
    showNoData();
    return;
  }

  // Expecting common keys, but we’ll be forgiving.
  // Try multiple possible field names so it still works.
  const secId = payload.secId ?? payload.id ?? payload.sec_id ?? payload.SEC_ID ?? "—";
  const distance = payload.distanceYards ?? payload.distance ?? payload.yards ?? "—";
  const adj = payload.adjustment ?? payload.clickValue ?? payload.adjustmentValue ?? "1/4 MOA";

  const thumbUrl =
    payload.thumbnailUrl ??
    payload.thumbUrl ??
    payload.imagePreview ??
    payload.targetThumb ??
    payload.target_thumbnail ??
    "";

  // Score / clicks / directions
  const score =
    payload.score ??
    payload.smartScore ??
    payload.SmartScore ??
    "—";

  // clicks values
  const elevClicks =
    payload.elevationClicks ??
    payload.elevClicks ??
    payload.elevation_clicks ??
    payload.elevation ??
    "—";

  const windClicks =
    payload.windageClicks ??
    payload.windClicks ??
    payload.windage_clicks ??
    payload.windage ??
    "—";

  // direction text
  const elevDir =
    payload.elevationDirection ??
    payload.elevDir ??
    payload.elevation_dir ??
    "";

  const windDir =
    payload.windageDirection ??
    payload.windDir ??
    payload.windage_dir ??
    "";

  const tip =
    payload.tip ??
    payload.coachingTip ??
    payload.note ??
    "—";

  // Fill UI
  secIdText.textContent = `SEC-ID ${secId}`;
  distanceText.textContent = String(distance);
  adjText.textContent = String(adj);

  scoreText.textContent = String(score);
  elevClicksText.textContent = String(elevClicks);
  windClicksText.textContent = String(windClicks);

  elevDirText.textContent = elevDir ? `(${elevDir})` : "";
  windDirText.textContent = windDir ? `(${windDir})` : "";

  tipText.textContent = String(tip);

  // Thumbnail (optional)
  if (thumbUrl) {
    targetThumb.src = thumbUrl;
    targetThumb.style.display = "block";
  } else {
    targetThumb.style.display = "none";
  }

  showResults();

  // If you want to confirm EXACTLY what the page received, unhide debug:
  // showDebug(payload);
})();
