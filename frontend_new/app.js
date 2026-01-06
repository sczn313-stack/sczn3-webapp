// frontend_new/app.js
// SEC v2.0 — Minimal SEC: upload + yards + generate
// Removes all debug UI (lock_version / coord_system)
// Formats output as STACKED: number (line 1) + "clicks DIRECTION" (line 2)

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

  // File picker label behavior
  fileEl.addEventListener("change", () => {
    const f = fileEl.files && fileEl.files[0];
    fileName.textContent = f ? f.name : "No file selected";
    setStatus("");
  });

  // Helper: normalize direction to a clean word
  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  // Helper: render stacked "number\nclicks DIR"
  function setStacked(elNode, clicks, dir) {
    const n = Number(clicks) || 0;
    const d = cleanDir(dir);
    const line1 = n.toFixed(2);
    const line2 = d ? `clicks ${d}` : "clicks";
    // Stacked: relies on CSS white-space OR we can enforce with <br> via innerHTML.
    // Safer across CSS: use innerHTML with <br>.
    elNode.innerHTML = `${line1}<br>${line2}`;
  }

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

      const windDir = apiData?.directions?.windage;
      const elevDir = apiData?.directions?.elevation;

      // SEC v2.0 stacked output
      setStacked(windageText, windClicks, windDir);
      setStacked(elevText, elevClicks, elevDir);

      // 3) Thumbnail preview
      const url = URL.createObjectURL(f);
      thumb.src = url;

      // 4) Show output
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
