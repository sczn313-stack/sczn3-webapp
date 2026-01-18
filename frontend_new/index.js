// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// iOS Safari: use TOUCHEND (single finger only) to avoid pinch ghost taps.

(() => {
  const photoInput   = document.getElementById("photoInput");
  const targetImage  = document.getElementById("targetImage");
  const imageWrap    = document.getElementById("targetImageWrap");
  const tapsCountEl  = document.getElementById("tapsCount");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const distanceInput = document.getElementById("distanceInput");
  const vendorInput  = document.getElementById("vendorInput");

  // Green box is the only trigger now
  const seeResultsHint = document.getElementById("seeResultsHint");

  // Micro-slot UI
  const pinchHint = document.getElementById("pinchHint");
  const vendorCta = document.getElementById("vendorCta");

  // Hardcoded anchor instruction line (only show when photo exists)
  const tapHintLine = document.getElementById("tapHintLine");

  // Results
  const resultsBox = document.getElementById("resultsBox");
  const resultsText = document.getElementById("resultsText");
  const backBtn = document.getElementById("backBtn");
  const receiptBtn = document.getElementById("receiptBtn");
  const savedBtn = document.getElementById("savedBtn");

  function setTapsCount(n){
    if (tapsCountEl) tapsCountEl.textContent = String(n);
  }

  function clearDots(){
    document.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function addDotAt(px, py, kind){
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind || "hole";
    dot.style.left = `${px}px`;
    dot.style.top  = `${py}px`;
    imageWrap.appendChild(dot);
  }

  function showPreview(dataUrl){
    if (!targetImage) return;
    targetImage.src = dataUrl;
    if (imageWrap) imageWrap.style.display = "block";
  }

  function clearPreview(){
    if (targetImage) targetImage.src = "";
    if (imageWrap) imageWrap.style.display = "none";
  }

  // ---- State ----
  let bullTap = null;
  let taps = [];
  let lastResultJson = null;

  // Pinch / multi-touch guard (REAL)
  let multiTouchActive = false;
  let ignoreTapsUntil = 0;
  const nowMs = () => Date.now();
  const setIgnore = (ms) => { ignoreTapsUntil = Math.max(ignoreTapsUntil, nowMs() + ms); };
  const canTap = () => !multiTouchActive && nowMs() >= ignoreTapsUntil;

  function hasPhoto(){
    return !!(targetImage && targetImage.src);
  }

  function updateProgressiveUI(){
    const photoOk = hasPhoto();

    // anchor instruction should only show after photo exists
    if (tapHintLine) tapHintLine.style.display = photoOk ? "block" : "none";

    // green see-results appears only after bullTap exists
    if (seeResultsHint) seeResultsHint.style.display = bullTap ? "inline-flex" : "none";

    // vendor CTA appears when see-results appears
    if (vendorCta) vendorCta.style.display = bullTap ? "flex" : "none";

    // pinch hint: only show briefly after first tap
    // (we hide it unless explicitly shown)
  }

  function showPinchHintOnce(){
    if (!pinchHint) return;
    pinchHint.style.display = "block";
    setTimeout(() => { pinchHint.style.display = "none"; }, 2000);
  }

  function resetFlow(keepPhoto){
    bullTap = null;
    taps = [];
    lastResultJson = null;
    clearDots();
    setTapsCount(0);

    if (!keepPhoto) clearPreview();

    if (resultsBox) resultsBox.style.display = "none";
    if (pinchHint) pinchHint.style.display = "none";

    updateProgressiveUI();
  }

  // ---- Photo load ----
  if (photoInput){
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file){
        resetFlow(false);
        return;
      }
      if (!file.type || !file.type.startsWith("image/")){
        alert("That file is not an image.");
        resetFlow(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        showPreview(dataUrl);
        try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}
        resetFlow(true);
      };
      reader.onerror = () => {
        alert("Could not read that photo.");
        resetFlow(false);
      };
      reader.readAsDataURL(file);
    });
  }

  // ---- Multi-touch detection (touch events) ----
  if (imageWrap){
    imageWrap.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2) {
        multiTouchActive = true;
        setIgnore(450);
      }
    }, { passive: true });

    imageWrap.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length >= 2) {
        multiTouchActive = true;
        setIgnore(450);
      }
    }, { passive: true });

    imageWrap.addEventListener("touchend", (e) => {
      const remaining = (e.touches && e.touches.length) ? e.touches.length : 0;
      if (remaining < 2) {
        multiTouchActive = false;
        setIgnore(250);
      }
    }, { passive: true });

    imageWrap.addEventListener("touchcancel", () => {
      multiTouchActive = false;
      setIgnore(250);
    }, { passive: true });
  }

  // ---- Tap capture (TOUCHEND only; single finger only) ----
  function captureTapAt(clientX, clientY){
    if (!imageWrap || !hasPhoto()) return;
    if (!canTap()) return;

    const rect = imageWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const nx = rect.width ? (x / rect.width) : 0;
    const ny = rect.height ? (y / rect.height) : 0;

    if (!bullTap){
      bullTap = { x: nx, y: ny };
      addDotAt(x, y, "bull");
      showPinchHintOnce();
      updateProgressiveUI(); // green box + vendor CTA appear now
    } else {
      taps.push({ x: nx, y: ny });
      setTapsCount(taps.length);
      addDotAt(x, y, "hole");
    }
  }

  if (imageWrap){
    imageWrap.style.position = "relative";

    // iOS reliable: record on touchend (single touch only)
    imageWrap.addEventListener("touchend", (e) => {
      // if this touchend is coming from multi-touch, ignore
      if (!canTap()) return;

      // changedTouches can contain the finger that lifted
      const ct = e.changedTouches;
      if (!ct || ct.length !== 1) return;

      // ensure not currently multi-touch
      if (e.touches && e.touches.length >= 1) {
        // if any remaining touches, we’re mid-gesture; ignore
        return;
      }

      const t = ct[0];
      captureTapAt(t.clientX, t.clientY);
    }, { passive: true });

    // Desktop / mouse support (optional)
    imageWrap.addEventListener("click", (e) => {
      // click can fire after touch sometimes; ignore during cooldown
      if (!canTap()) return;
      captureTapAt(e.clientX, e.clientY);
    });
  }

  // ---- Clear taps ----
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      resetFlow(true); // keep photo
    });
  }

  // ---- Results rendering (Shooter language) ----
  function escapeHtml(s){
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function dirLR(dx){
    if (dx > 0) return "RIGHT";
    if (dx < 0) return "LEFT";
    return "CENTER";
  }
  function dirUD(dy){
    if (dy > 0) return "UP";
    if (dy < 0) return "DOWN";
    return "CENTER";
  }

  function fmtPct(n){
    const v = Math.abs(Number(n || 0)) * 100;
    return `${v.toFixed(1)}%`;
  }

  function renderShooterResults(out){
    if (!resultsText) return;

    const distanceYds = Number(out?.distanceYds || 0);
    const shots = Number(out?.tapsCount || 0);

    const bull = out?.bullTap;
    const poib = out?.poib;

    // correction = bull - POIB
    let dx = Number(out?.delta?.x);
    let dy = Number(out?.delta?.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      if (bull && poib) {
        dx = Number(bull.x) - Number(poib.x);
        dy = Number(bull.y) - Number(poib.y);
      } else { dx = 0; dy = 0; }
    }

    const html = `
      <div class="resultGrid">
        <div class="resultRow"><div class="label">Distance</div><div class="value">${distanceYds} yds</div></div>
        <div class="resultRow"><div class="label">Shots tapped</div><div class="value">${shots}</div></div>
        <div class="divider"></div>
        <div class="resultRow"><div class="label">Correction</div>
          <div class="value big">${dirLR(dx)} ${fmtPct(dx)} • ${dirUD(dy)} ${fmtPct(dy)}</div>
        </div>
        <div class="subtle mt12">Receipt view stays available for debugging.</div>
      </div>
    `;
    resultsText.innerHTML = html;
  }

  function renderReceipt(out){
    if (!resultsText) return;
    resultsText.innerHTML = `<pre class="mono" style="margin:0;">${escapeHtml(JSON.stringify(out, null, 2))}</pre>`;
  }

  async function doResults(){
    try{
      if (!hasPhoto()) { alert("Upload target photo first."); return; }
      if (!bullTap) { alert("Tap the bull’s-eye / aim point first."); return; }
      if (taps.length < 1) { alert("Tap at least 1 bullet hole."); return; }

      const distanceYds = Number(distanceInput?.value || 100);
      const vendorLink = String(vendorInput?.value || "").trim();

      const payload = { distanceYds, vendorLink, bullTap, taps, imageDataUrl: null };

      if (typeof window.tapscore !== "function") throw new Error("Analyze function missing (api.js not loaded).");

      const out = await window.tapscore(payload);
      lastResultJson = out;

      if (resultsBox) resultsBox.style.display = "block";
      renderShooterResults(out);
    } catch (err) {
      alert(err?.message || "Network/server error. Try again.");
    }
  }

  // Green box is the only trigger
  if (seeResultsHint){
    seeResultsHint.addEventListener("click", doResults);
  }

  if (backBtn){
    backBtn.addEventListener("click", () => {
      if (resultsBox) resultsBox.style.display = "none";
    });
  }

  if (receiptBtn){
    receiptBtn.addEventListener("click", () => {
      if (lastResultJson) renderReceipt(lastResultJson);
    });
  }

  if (savedBtn){
    savedBtn.addEventListener("click", () => alert("Saved (stub)."));
  }

  // Init
  updateProgressiveUI();
})();
