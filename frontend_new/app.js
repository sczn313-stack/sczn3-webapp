// frontend_new/app.js
// Minimal SEC: upload + yards + generate
// Shows errors on-screen (no silent failures)

(function () {
  const el = (id) => document.getElementById(id);

  const fileEl = el("file");
  const fileBtn = el("fileBtn");
  const fileName = el("fileName");
  const yardsEl = el("yards");
  const btn = el("btn");
  const status = el("status");

  const panel = el("panel");
  const secOut = el("secOut");
  const windageText = el("windageText");
  const elevText = el("elevText");
  const thumb = el("thumb");
  const lockLine = el("lockLine");
  const again = el("again");

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
    lockLine.textContent = "";
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
      const apiData = await postAnalyze(f);

      // 2) Compute clicks from correction inches
      const dx = Number(apiData?.correction_in?.dx) || 0;
      const dy = Number(apiData?.correction_in?.dy) || 0;

      const windClicks = clicksFromInches(Math.abs(dx), yards);
      const elevClicks = clicksFromInches(Math.abs(dy), yards);

      const windDir = (apiData?.directions?.windage || "").trim();
      const elevDir = (apiData?.directions?.elevation || "").trim();

      windageText.textContent = `${windClicks.toFixed(2)} ${windDir}`.trim();
      elevText.textContent = `${elevClicks.toFixed(2)} ${elevDir}`.trim();

      // 3) Thumbnail preview
      const url = URL.createObjectURL(f);
      thumb.src = url;

      // 4) Lock stamp line (so we can SEE drift if it ever happens)
      const lv = apiData?.lock_version || "?";
      const cs = apiData?.coord_system || "?";
      lockLine.textContent = `lock_version: ${lv} • coord_system: ${cs}`;

      // 5) Show output
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
    // keep file selection so you can just re-run if you want
  });

  // Start state
  showOutput(false);
  setStatus("");
})();
