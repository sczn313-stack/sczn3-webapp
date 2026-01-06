// frontend_new/app.js
// SEC v2.0 — Minimal SEC: upload + yards + generate
// Output format: STACKED -> number (line 1) + "clicks DIRECTION" (line 2)

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

  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  function setStacked(targetEl, clicks, dirWord) {
    const n = Number(clicks || 0).toFixed(2);
    const d = cleanDir(dirWord);
    targetEl.innerHTML = `
      <span class="numLine">${n}</span>
      <span class="dirLine">clicks ${d}</span>
    `.trim();
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

      // 2) Use correction inches from backend
      const dx = Number(apiData?.correction_in?.dx) || 0;
      const dy = Number(apiData?.correction_in?.dy) || 0;

      const windClicks = clicksFromInches(Math.abs(dx), yards);
      const elevClicks = clicksFromInches(Math.abs(dy), yards);

      const windDir = apiData?.directions?.windage || "";
      const elevDir = apiData?.directions?.elevation || "";

      setStacked(windageText, windClicks, windDir);
      setStacked(elevText, elevClicks, elevDir);

      // 3) Thumbnail preview
      thumb.src = URL.createObjectURL(f);

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
  });

  showOutput(false);
  setStatus("");
})();
