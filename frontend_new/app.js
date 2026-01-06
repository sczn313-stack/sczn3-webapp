// frontend_new/app.js
// Minimal SEC: upload + yards + generate
// Output format: stacked lines:
//   10.16
//   clicks RIGHT

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
  }

  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  // Derive direction if backend didn't send it
  // dx: +RIGHT / -LEFT, dy: +UP / -DOWN
  function dirFromSign(axis, value) {
    const v = num(value);
    if (v === 0) return "HOLD";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  // Accept multiple backend response shapes for dx/dy + directions
  function extractDxDyAndDirs(apiData) {
    // dx / dy inches (try a bunch of common shapes)
    const dx =
      apiData?.correction_in?.dx ??
      apiData?.correctionIn?.dx ??
      apiData?.correction_inches?.dx ??
      apiData?.correction?.dx ??
      apiData?.delta_in?.dx ??
      apiData?.dx ??
      apiData?.windage_in ??
      apiData?.wind_in ??
      0;

    const dy =
      apiData?.correction_in?.dy ??
      apiData?.correctionIn?.dy ??
      apiData?.correction_inches?.dy ??
      apiData?.correction?.dy ??
      apiData?.delta_in?.dy ??
      apiData?.dy ??
      apiData?.elevation_in ??
      apiData?.elev_in ??
      0;

    // direction strings (try a bunch of common shapes)
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
      const apiData = await window.postAnalyze(f, yards);

      // 2) Pull dx/dy + directions (robust)
      const { dx, dy, windDir, elevDir } = extractDxDyAndDirs(apiData);

      // 3) Convert inches -> clicks (true MOA) using your helper
      const windClicks = window.clicksFromInches(Math.abs(dx), yards);
      const elevClicks = window.clicksFromInches(Math.abs(dy), yards);

      // 4) If backend didn’t send direction, derive from sign
      const finalWindDir = windDir || dirFromSign("x", dx);
      const finalElevDir = elevDir || dirFromSign("y", dy);

      windageText.textContent = `${windClicks.toFixed(2)}\nclicks ${finalWindDir}`;
      elevText.textContent = `${elevClicks.toFixed(2)}\nclicks ${finalElevDir}`;

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
