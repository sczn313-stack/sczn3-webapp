// frontend_new/app.js
// MINIMAL SEC (PADLOCKED) — upload + yards + generate
//
// LOCK RULES (FRONTEND):
// 1) Frontend does NOT reinterpret directions if backend sends them.
// 2) If backend does NOT send directions, frontend derives them ONLY from LOCKED correction:
//      correction = bull - POIB   (TARGET coords: +X RIGHT, +Y UP)
// 3) If backend does NOT send correction, but DOES send poib_in, frontend computes correction using bull_in (default 0,0).
// 4) Always display 2 decimals everywhere.
//
// Output format:
//   10.16 clicks RIGHT
//   0.00 clicks UP

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

  // -------------------
  // Helpers
  // -------------------
  const num = (v, fallback = 0) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  };

  const f2 = (v) => (Math.round(num(v) * 100) / 100).toFixed(2);

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

  // LOCKED: directions come from correction = bull - POIB (TARGET coords)
  // dx>0 RIGHT, dx<0 LEFT, dy>0 UP, dy<0 DOWN, 0 => ""
  function dirFromCorrection(axis, value) {
    const v = num(value, 0);
    if (Object.is(v, 0)) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  function formatLine(clicks, dirWord) {
    const d = cleanDir(dirWord);
    return d ? `${f2(clicks)} clicks ${d}` : `${f2(clicks)} clicks`;
  }

  // -------------------
  // PADLOCKED extraction
  // -------------------
  function extractLockStamp(apiData) {
    const lock =
      apiData?.lock_version ??
      apiData?.lockVersion ??
      apiData?.lock ??
      "";

    const coord =
      apiData?.coord_system ??
      apiData?.coordSystem ??
      apiData?.coord ??
      "";

    return { lock: String(lock || ""), coord: String(coord || "") };
  }

  function extractBullAndPoib(apiData) {
    const bullX =
      apiData?.bull_in?.x ??
      apiData?.bullIn?.x ??
      apiData?.bull?.x ??
      0;

    const bullY =
      apiData?.bull_in?.y ??
      apiData?.bullIn?.y ??
      apiData?.bull?.y ??
      0;

    const poibX =
      apiData?.poib_in?.x ??
      apiData?.poibIn?.x ??
      apiData?.poib?.x ??
      apiData?.poibX_in ??
      0;

    const poibY =
      apiData?.poib_in?.y ??
      apiData?.poibIn?.y ??
      apiData?.poib?.y ??
      apiData?.poibY_in ??
      0;

    return {
      bullX: num(bullX, 0),
      bullY: num(bullY, 0),
      poibX: num(poibX, 0),
      poibY: num(poibY, 0),
    };
  }

  function extractCorrection(apiData) {
    const dx =
      apiData?.correction_in?.dx ??
      apiData?.correctionIn?.dx ??
      apiData?.correction_inches?.dx ??
      apiData?.correction?.dx ??
      apiData?.delta_in?.dx ??
      apiData?.dx ??
      null;

    const dy =
      apiData?.correction_in?.dy ??
      apiData?.correctionIn?.dy ??
      apiData?.correction_inches?.dy ??
      apiData?.correction?.dy ??
      apiData?.delta_in?.dy ??
      apiData?.dy ??
      null;

    return {
      dx: dx == null ? null : num(dx, 0),
      dy: dy == null ? null : num(dy, 0),
    };
  }

  function extractDirections(apiData) {
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

    return { windDir: cleanDir(windDir), elevDir: cleanDir(elevDir) };
  }

  // -------------------
  // Events
  // -------------------
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

      const yards = num(yardsEl.value, 100);

      // Hard fail if required helpers are missing
      if (typeof window.postAnalyze !== "function") {
        throw new Error("Missing window.postAnalyze(file, yards). Check frontend_new/api.js (or where postAnalyze is defined).");
      }
      if (typeof window.clicksFromInches !== "function") {
        throw new Error("Missing window.clicksFromInches(inches, yards). Check frontend_new/math.js (or where clicksFromInches is defined).");
      }

      setBusy(true);
      resetOutput();

      // 1) Analyze image (backend)
      const apiData = await window.postAnalyze(f, yards);

      // 2) Padlock stamp check (warn if missing; optional hard-fail)
      const { lock, coord } = extractLockStamp(apiData);

      // If you want this to be HARD REQUIRED, uncomment:
      // if (!lock) throw new Error("Backend missing lock_version. Refusing to compute. (Prevents drift.)");

      // 3) Determine correction in inches (LOCKED priority)
      // Priority: backend correction_in -> else compute from bull_in + poib_in
      let { dx, dy } = extractCorrection(apiData);

      if (dx == null || dy == null) {
        const { bullX, bullY, poibX, poibY } = extractBullAndPoib(apiData);
        // LOCKED: correction = bull - POIB
        dx = bullX - poibX;
        dy = bullY - poibY;
      }

      dx = num(dx, 0);
      dy = num(dy, 0);

      // 4) Directions: use backend directions ONLY if provided; else derive from LOCKED correction
      const { windDir, elevDir } = extractDirections(apiData);

      const finalWindDir = windDir || dirFromCorrection("x", dx);
      const finalElevDir = elevDir || dirFromCorrection("y", dy);

      // 5) Convert inches -> clicks (true MOA)
      const windClicks = window.clicksFromInches(Math.abs(dx), yards);
      const elevClicks = window.clicksFromInches(Math.abs(dy), yards);

      // 6) Render
      windageText.textContent = formatLine(windClicks, finalWindDir);
      elevText.textContent = formatLine(elevClicks, finalElevDir);

      // 7) Thumbnail preview
      thumb.src = URL.createObjectURL(f);

      // Optional: show lock stamp in status (helps detect drift instantly)
      if (lock || coord) {
        setStatus(`LOCK: ${lock || "—"} • ${coord || "—"}`);
      }

      // 8) Show output
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

  // Init
  showOutput(false);
  setStatus("");
})();
