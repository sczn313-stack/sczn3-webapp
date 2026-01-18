(() => {
  const camInput   = document.getElementById("photoInputCam");
  const libInput   = document.getElementById("photoInputLib");

  const targetImg  = document.getElementById("targetImage");
  const wrap       = document.getElementById("targetImageWrap");
  const dotsLayer  = document.getElementById("dotsLayer");

  const tapsCount  = document.getElementById("tapsCount");
  const clearBtn   = document.getElementById("clearTapsBtn");
  const seeBtn     = document.getElementById("seeResultsBtn");

  const distanceInput = document.getElementById("distanceInput");
  const vendorInput   = document.getElementById("vendorInput");
  const emptyHint     = document.getElementById("emptyHint");

  const resultsBox  = document.getElementById("resultsBox");
  const resultsText = document.getElementById("resultsText");
  const backBtn     = document.getElementById("backBtn");

  let taps = [];
  let imageDataUrl = "";

  function setStatus(msg){
    const el = document.getElementById("statusLine");
    if (el) el.textContent = String(msg || "");
  }

  function updateCount(){
    if (tapsCount) tapsCount.textContent = String(taps.length);
  }

  function clearDots(){
    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function addDotAt(px, py){
    if (!dotsLayer) return;
    const d = document.createElement("div");
    d.className = "dot";
    d.style.left = `${px}px`;
    d.style.top  = `${py}px`;
    dotsLayer.appendChild(d);
  }

  function clearAllTaps(){
    taps = [];
    clearDots();
    updateCount();
    setStatus("Taps cleared.");
  }

  function showResults(text){
    if (resultsBox) resultsBox.style.display = "block";
    if (resultsText) resultsText.textContent = text;
  }

  function hideResults(){
    if (resultsBox) resultsBox.style.display = "none";
  }

  function loadFileFromInput(inputEl, label){
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) {
      setStatus(`${label}: no photo selected.`);
      return;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setStatus(`${label}: that file is not an image.`);
      return;
    }

    setStatus(`${label}: loading photo...`);

    const r = new FileReader();
    r.onload = () => {
      imageDataUrl = String(r.result || "");
      if (targetImg) targetImg.src = imageDataUrl;

      if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes.";
      clearAllTaps();
      hideResults();

      setStatus("Photo loaded. Tap bullet holes.");
      try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", imageDataUrl); } catch {}

      // ✅ Clear AFTER load (iOS-safe)
      try { inputEl.value = ""; } catch {}
    };

    r.onerror = () => {
      setStatus(`${label}: could not read that photo.`);
      try { inputEl.value = ""; } catch {}
    };

    r.readAsDataURL(file);
  }

  if (camInput){
    camInput.addEventListener("change", () => loadFileFromInput(camInput, "Camera"));
  }
  if (libInput){
    libInput.addEventListener("change", () => loadFileFromInput(libInput, "Library"));
  }

  function handleTap(clientX, clientY){
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const nx = rect.width  ? (x / rect.width)  : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    taps.push({ x: nx, y: ny });
    updateCount();
    addDotAt(x, y);
  }

  if (wrap){
    wrap.addEventListener("pointerdown", (e) => {
      if (!imageDataUrl){
        setStatus("Add a photo first.");
        return;
      }
      handleTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  if (clearBtn) clearBtn.addEventListener("click", clearAllTaps);
  if (backBtn) backBtn.addEventListener("click", hideResults);

  if (seeBtn){
    seeBtn.addEventListener("click", async () => {
      if (!window.tapscore) {
        alert("Analyze function missing (api.js not loaded).");
        return;
      }
      if (!imageDataUrl) {
        alert("Add a photo first.");
        return;
      }
      if (!taps.length) {
        alert("Tap at least 1 bullet hole.");
        return;
      }

      const distanceYds = Number(distanceInput && distanceInput.value ? distanceInput.value : 100) || 100;
      const vendorLink  = String(vendorInput && vendorInput.value ? vendorInput.value : "").trim();

      setStatus("Analyzing...");
      try {
        // If backend doesn’t want imageDataUrl, remove it here:
        const payload = { distanceYds, taps, vendorLink, imageDataUrl };

        const out = await window.tapscore(payload);
        showResults(JSON.stringify(out, null, 2));
        setStatus("Done.");
      } catch (err) {
        console.error(err);
        alert("Network/server error. Try again.");
        setStatus("Network/server error. Try again.");
      }
    });
  }

  // Restore last image (optional)
  try {
    const saved = sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
    if (saved && targetImg) {
      imageDataUrl = saved;
      targetImg.src = saved;
      if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes.";
      setStatus("Ready. Tap bullet holes.");
    }
  } catch {}

  updateCount();
})();
