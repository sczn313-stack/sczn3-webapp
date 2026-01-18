// sczn3-webapp/frontend_new/index.js (FULL FILE REPLACEMENT)
// iOS-safe Tap-n-Score: photo load + reliable tap capture + guarded analyze launch.

(() => {
  const LS_SAVED = "sczn3_saved_sessions_v1";
  const SS_LAST  = "sczn3_last_result_json";
  const SS_PHOTO = "sczn3_targetPhoto_dataUrl";

  const statusLine   = document.getElementById("statusLine");
  const photoInput   = document.getElementById("photoInput");
  const targetImage  = document.getElementById("targetImage");
  const imageWrap    = document.getElementById("targetImageWrap");
  const tapsCountEl  = document.getElementById("tapsCount");
  const clearBtn     = document.getElementById("clearTapsBtn");
  const seeBtn       = document.getElementById("seeResultsBtn");
  const distInput    = document.getElementById("distanceInput");
  const vendorInput  = document.getElementById("vendorInput");
  const emptyHint    = document.getElementById("emptyHint");

  let taps = [];

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function updateCount() {
    if (tapsCountEl) tapsCountEl.textContent = String(taps.length);
  }

  function clearDots() {
    if (!imageWrap) return;
    imageWrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function addDot(x, y) {
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    imageWrap.appendChild(dot);
  }

  function clearAllTaps() {
    taps = [];
    updateCount();
    clearDots();
    setStatus("Taps cleared. Tap bullet holes.");
  }

  function normalizeTap(clientX, clientY) {
    if (!imageWrap) return null;
    const rect = imageWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y, w: rect.width, h: rect.height };
  }

  function handleTap(clientX, clientY) {
    const p = normalizeTap(clientX, clientY);
    if (!p) return;

    taps.push({ x: p.x, y: p.y });
    addDot(p.x, p.y);
    updateCount();
    setStatus(`Taps: ${taps.length}`);
  }

  // ====== PHOTO LOAD ======
  function showPreview(dataUrl) {
    if (!targetImage || !imageWrap) return;
    targetImage.src = dataUrl;
    imageWrap.style.display = "block";
    if (emptyHint) emptyHint.textContent = "Photo loaded. Tap bullet holes (Tap-n-Score).";
  }

  function clearPreview() {
    if (targetImage) targetImage.src = "";
    if (imageWrap) imageWrap.style.display = "block"; // keep box stable (no jump)
    if (emptyHint) emptyHint.textContent = "Add a photo, then tap bullet holes.";
  }

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const f = photoInput.files && photoInput.files[0];
      if (!f) {
        setStatus("No photo selected.");
        clearPreview();
        return;
      }
      if (!f.type || !f.type.startsWith("image/")) {
        setStatus("That file is not an image.");
        clearPreview();
        return;
      }

      const r = new FileReader();
      r.onload = () => {
        const dataUrl = String(r.result || "");
        showPreview(dataUrl);
        try { sessionStorage.setItem(SS_PHOTO, dataUrl); } catch {}
        clearAllTaps();
        setStatus("Photo loaded. Tap bullet holes.");
      };
      r.onerror = () => {
        setStatus("Could not read that photo.");
        clearPreview();
      };
      r.readAsDataURL(f);
    });
  }

  // ====== TAP BINDING (critical for iOS) ======
  function bindTapEvents() {
    if (!imageWrap) return;

    // ensure wrapper receives touch and prevents safari scroll/zoom interference
    imageWrap.style.touchAction = "none";
    imageWrap.style.webkitUserSelect = "none";
    imageWrap.style.userSelect = "none";

    // IMPORTANT: passive:false so preventDefault actually works on iOS
    imageWrap.addEventListener("touchstart", (e) => {
      if (!targetImage || !targetImage.src) return;
      e.preventDefault();
      const t = e.touches && e.touches[0];
      if (!t) return;
      handleTap(t.clientX, t.clientY);
    }, { passive: false });

    // click fallback (desktop + some iOS cases)
    imageWrap.addEventListener("click", (e) => {
      if (!targetImage || !targetImage.src) return;
      handleTap(e.clientX, e.clientY);
    });
  }

  bindTapEvents();

  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllTaps);
    clearBtn.addEventListener("touchstart", (e) => { e.preventDefault(); clearAllTaps(); }, { passive: false });
  }

  // ====== ANALYZE GUARD + NAVIGATE ======
  function saveLastResultStub(payload) {
    // This ensures results page always has something to show (even if fail)
    const stub = {
      ok: false,
      error: { message: "Not analyzed yet." },
      payload,
      created_at: new Date().toISOString(),
    };
    try { sessionStorage.setItem(SS_LAST, JSON.stringify(stub)); } catch {}
  }

  async function onSeeResults() {
    const distanceYds = Number(distInput && distInput.value ? distInput.value : 100);
    const vendorLink = String(vendorInput && vendorInput.value ? vendorInput.value.trim() : "");

    const photoDataUrl = (() => {
      try { return sessionStorage.getItem(SS_PHOTO) || ""; } catch { return ""; }
    })();

    if (!photoDataUrl) {
      setStatus("Add a photo first.");
      return;
    }

    if (taps.length < 1) {
      setStatus("Tap at least 1 bullet hole before results.");
      return;
    }

    setStatus("Analyzing…");

    const payload = {
      distanceYds,
      vendorLink,
      // backend expects tapsJson with bull+holes in some builds; we send the minimal structure
      tapsJson: {
        holes: taps.map(p => ({ x: p.x, y: p.y })),
        // bull optional; backend may infer or default
      },
      // keep the photo handy for backends that decode it (if your backend ignores it, no harm)
      photoDataUrl,
    };

    saveLastResultStub(payload);

    // Call backend now (so results page loads clean and already has data)
    const api = window.SCNZ3_API;
    if (!api || !api.postJson) {
      setStatus("API not loaded.");
      return;
    }

    const resp = await api.postJson("/api/analyze", payload);

    const resultToStore = resp.ok
      ? { ok: true, data: resp.data, created_at: new Date().toISOString() }
      : { ok: false, error: resp.error || { message: "Analyze failed." }, status: resp.status, created_at: new Date().toISOString() };

    try { sessionStorage.setItem(SS_LAST, JSON.stringify(resultToStore)); } catch {}

    // Navigate after storing
    window.location.href = "./output.html";
  }

  if (seeBtn) {
    seeBtn.addEventListener("click", onSeeResults);
    seeBtn.addEventListener("touchstart", (e) => { e.preventDefault(); onSeeResults(); }, { passive: false });
  }

  // boot
  updateCount();
  setStatus("Ready. Tap ADD PHOTO.");
})();
