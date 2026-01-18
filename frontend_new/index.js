(() => {
  const photoInput = document.getElementById("photoInput");
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

  /** state **/
  let taps = []; // [{x:0..1, y:0..1}] relative to displayed image box
  let imageDataUrl = "";

  function setStatus(msg){
    if (window.setStatus) window.setStatus(msg);
  }

  function updateCount(){
    if (tapsCount) tapsCount.textContent = String(taps.length);
  }

  function clearDots(){
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
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
    updateCount();
    clearDots();
    setStatus("Taps cleared.");
  }

  function showResults(text){
    if (resultsBox) resultsBox.style.display = "block";
    if (resultsText) resultsText.textContent = text;
  }

  function hideResults(){
    if (resultsBox) resultsBox.style.display = "none";
  }

  /** Load photo **/
  if (photoInput && targetImg) {
    photoInput.addEventListener("change", () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) {
        setStatus("No photo selected.");
        return;
      }
      if (!f.type || !f.type.startsWith("image/")) {
        setStatus("That file is not an image.");
        return;
      }

      const r = new FileReader();
      r.onload = () => {
        imageDataUrl = String(r.result || "");
        targetImg.src = imageDataUrl;
        if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes.";
        clearAllTaps();
        hideResults();
        setStatus("Photo loaded. Tap bullet holes.");
        try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", imageDataUrl); } catch {}
      };
      r.onerror = () => setStatus("Could not read that photo.");
      r.readAsDataURL(f);
    });
  }

  /** Tap handler **/
  function handleTap(clientX, clientY){
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // ignore if outside
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    // store normalized
    const nx = rect.width  ? (x / rect.width)  : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    taps.push({ x: nx, y: ny });
    updateCount();

    // draw dot where tapped (in pixels)
    addDotAt(x, y);
  }

  if (wrap) {
    // pointer events work on iOS Safari
    wrap.addEventListener("pointerdown", (e) => {
      // Only when photo loaded (optional). If you want taps even without photo, remove this.
      if (!imageDataUrl) {
        setStatus("Add a photo first.");
        return;
      }
      handleTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  /** Clear taps **/
  if (clearBtn) clearBtn.addEventListener("click", clearAllTaps);

  /** Results **/
  if (backBtn) backBtn.addEventListener("click", hideResults);

  if (seeBtn) {
    seeBtn.addEventListener("click", async () => {
      // Must have api.js
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
      const vendorLink = String(vendorInput && vendorInput.value ? vendorInput.value : "").trim();

      setStatus("Analyzing...");
      try {
        // NOTE: sending imageDataUrl is optional; remove if backend doesn’t want it.
        const payload = { distanceYds, taps, vendorLink, imageDataUrl };

        const out = await window.tapscore(payload);

        // display whatever backend returns
        const pretty = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        showResults(pretty);

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
