// frontend_new/app.js
// Minimal SEC: upload + yards + generate
// Output format:
//   10.16 clicks RIGHT
//   0.00 clicks

(function () {
  const el = (id) => document.getElementById(id);

  const fileEl = el("file");
  const fileName = el("fileName");
  const yardsEl = el("yards");
  const btn = el("btn");
  const status = el("status");

  const panel = el("panel");
  const secOut = el("secOut");
  const windageText = el("windageText");
  const elevText = el("elevText");
  const thumb = el("thumb");
  const again = el("again");
  const debug = el("debug");

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function setStatus(msg, isError = false) {
    status.textContent = msg || "";
    status.classList.toggle("err", !!isError);
  }

  function setBusy(busy) {
    btn.disabled = !!busy;
    btn.textContent = busy ? "Generating..." : "Generate SEC";
  }

  function showOutput(show) {
    if (show) {
      panel.style.display = "none";
      secOut.style.display = "block";
    } else {
      secOut.style.display = "none";
      panel.style.display = "block";
    }
  }

  function resetOutput() {
    windageText.textContent = "—";
    elevText.textContent = "—";
    thumb.removeAttribute("src");
    if (debug) debug.textContent = "";
  }

  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  // If backend didn't send direction, derive from sign
  // dx: +RIGHT / -LEFT, dy: +UP / -DOWN
  function dirFromSign(axis, value) {
    const v = num(value);
    if (v === 0) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  // Robustly extract dx/dy and direction words from multiple possible backend shapes
  function extractDxDyAndDirs(apiData) {
    const c =
      apiData?.correction_in ??
      apiData?.correctionIn ??
      apiData?.correction_inches ??
      apiData?.correction ??
      apiData?.delta_in ??
      apiData ??
      {};

    // dx candidates
    const dx =
      c?.dx ??
      c?.x ??
      c?.windage ??
      c?.wind ??
      apiData?.dx ??
      apiData?.x ??
      apiData?.windage_in ??
      apiData?.wind_in ??
      0;

    // dy candidates
    const dy =
      c?.dy ??
      c?.y ??
      c?.elevation ??
      c?.elev ??
      apiData?.dy ??
      apiData?.y ??
      apiData?.elevation_in ??
      apiData?.elev_in ??
      0;

    const windDir =
      apiData?.directions?.windage ??
      apiData?.direction?.windage ??
      apiData?.windage_direction ??
      apiData?.windDir ??
      apiData?.windageDir ??
      "";

    const elevDir =
      apiData?.directions?.elevation ??
      apiData?.direction?.elevation ??
      apiData?.elevation_direction ??
      apiData?.elevDir ??
      apiData?.elevationDir ??
      "";

    return {
      dx: num(dx),
      dy: num(dy),
      windDir: cleanDir(windDir),
      elevDir: cleanDir(elevDir),
    };
  }

  function formatLine(clicks, dirWord) {
    const n = Number(clicks || 0).toFixed(2);
    const d = cleanDir(dirWord);
    return d ? `${n} clicks ${d}` : `${n} clicks`;
  }

  // File picker label behavior
  fileEl.addEventListener("change", () => {
    const f = fileEl.files && fileEl.files[0];
    fileName.textContent = f ? f.name : "No file selected";
    setStatus("");
  });

  async function onGenerate() {
    try {
      setStatus("");

      const f = fileEl.files && fileEl.files[0];
      if (!f) {
        setStatus("Pick a photo first.", true);
        return;
      }

      const yards = Number(yardsEl.value) || 100;

      setBusy(true);
      resetOutput();

      // 1) Analyze image (backend)
      const apiData = await window.postAnalyze(f);

      // DEBUG: show exactly what backend returned
      if (debug) debug.textContent = JSON.stringify(apiData, null, 2);

      // 2) Extract dx/dy + directions (robust)
      const { dx, dy, windDir, elevDir } = extractDxDyAndDirs(apiData);

      // 3) Convert inches -> clicks (True MOA, 0.25/click)
      const windClicks = window.clicksFromInches(Math.abs(dx), yards);
      const elevClicks = window.clicksFromInches(Math.abs(dy), yards);

      // 4) If backend didn’t send direction, derive from sign
      const finalWindDir = windDir || dirFromSign("x", dx);
      const finalElevDir = elevDir || dirFromSign("y", dy);

      windageText.textContent = formatLine(windClicks, finalWindDir);
      elevText.textContent = formatLine(elevClicks, finalElevDir);

      // 5) Thumbnail preview
      thumb.src = URL.createObjectURL(f);

      // 6) Show output
      showOutput(true);
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err), true);
    } finally {
      setBusy(false);
    }
  }

  btn.addEventListener("click", onGenerate);

  again.addEventListener("click", () => {
    showOutput(false);
    resetOutput();
    setStatus("");
  });

  // Start state
  showOutput(false);
  setStatus("");
})();
