// frontend_new/index.js
// Bull-first workflow: Tap #1 = bull (aim point), Tap #2+ = bullet holes.
// Shooter-language results + strong anti-pinch ghost-tap handling.

(() => {
  // ---- Elements ----
  const photoInput   = document.getElementById("photoInput");      // single camera/library input (your current setup)
  const targetImage  = document.getElementById("targetImage");     // <img>
  const imageWrap    = document.getElementById("targetImageWrap"); // wrapper div (tap area)
  const tapsCountEl  = document.getElementById("tapsCount");
  const clearTapsBtn = document.getElementById("clearTapsBtn");
  const seeResultsBtn = document.getElementById("seeResultsBtn");
  const distanceInput = document.getElementById("distanceInput");
  const vendorInput = document.getElementById("vendorInput");

  // Optional UI pieces (safe if missing)
  const resultsBox = document.getElementById("resultsBox");
  const resultsText = document.getElementById("resultsText");
  const backBtn = document.getElementById("backBtn");
  const savedBtn = document.getElementById("savedBtn");
  const receiptBtn = document.getElementById("receiptBtn");

  // You said: remove the upper-left instruction line entirely.
  // So we will not update statusLine during normal flow.
  function setStatus(_msg){ /* intentionally silent */ }

  function setTapsCount(n){
    if (tapsCountEl) tapsCountEl.textContent = String(n);
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

  // ---- Tap State ----
  let bullTap = null;  // {x,y} normalized 0..1
  let taps = [];       // holes only
  let lastResultJson = null;

  // ---- Dots ----
  function clearDots(){
    document.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  function addDotAt(px, py, kind){
    if (!imageWrap) return;
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind || "hole";
    dot.style.left = `${px}px`;
    dot.style.top = `${py}px`;
    imageWrap.appendChild(dot);
  }

  // ---- Progressive UI hooks (optional, driven by IDs if present) ----
  // We’ll look for these elements if you added them in HTML:
  // 1) A hardcoded instruction line inside the Target card:
  //    <div id="tapHintLine">Tap bull’s-eye (aim point) first — then tap bullet holes.</div>
  // 2) A "See results" green box that should appear only after taps begin:
  //    (already seeResultsBtn)
  // 3) Vendor CTA that appears only after "See results" appears:
  //    <div id="vendorCta" style="display:none;">Buy more targets like this</div>
  // 4) Pinch hint that shows after first tap only:
  //    <div id="pinchHint" style="display:none;">Pinch to zoom</div>
  const tapHintLine = document.getElementById("tapHintLine");
  const vendorCta = document.getElementById("vendorCta");
  const pinchHint = document.getElementById("pinchHint");

  function showTapLineIfReady(){
    // You requested: do NOT show the tap instruction line until a target exists.
    const hasTarget = !!(targetImage && targetImage.src);
    if (tapHintLine) tapHintLine.style.display = hasTarget ? "block" : "none";
  }

  function showSeeResultsIfReady(){
    // “See results” should appear quietly only AFTER tapping starts (bullTap exists)
    if (!seeResultsBtn) return;
    const shouldShow = !!bullTap;
    seeResultsBtn.style.display = shouldShow ? "block" : "none";

    // Vendor CTA appears at same moment (sticky vendor moment)
    if (vendorCta) vendorCta.style.display = shouldShow ? "block" : "none";
  }

  function showPinchHintOnce(){
    if (!pinchHint) return;
    pinchHint.style.display = "block";
    // auto-hide after a moment to keep “progressive quietness”
    setTimeout(() => { pinchHint.style.display = "none"; }, 2200);
  }

  function resetFlow(){
    bullTap = null;
    taps = [];
    lastResultJson = null;

    clearDots();
    setTapsCount(0);

    // Hide results panel
    if (resultsBox) resultsBox.style.display = "none";

    // Hide “See results” + vendor CTA until tapping starts
    showSeeResultsIfReady();

    // Hide tap hint if no target
    showTapLineIfReady();

    // Hide pinch hint
    if (pinchHint) pinchHint.style.display = "none";
  }

  // ---- Photo Load ----
  if (photoInput){
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];

      if (!file){
        clearPreview();
        resetFlow();
        return;
      }
      if (!file.type || !file.type.startsWith("image/")){
        alert("That file is not an image.");
        clearPreview();
        resetFlow();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        showPreview(dataUrl);

        try { sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl); } catch {}

        resetFlow();
        // Target exists now → show hardcoded line
        showTapLineIfReady();
      };
      reader.onerror = () => {
        alert("Could not read that photo.");
        clearPreview();
        resetFlow();
      };
      reader.readAsDataURL(file);
    });
  }

  // ---- Anti-ghost taps during pinch zoom (iOS Safari) ----
  // Strategy:
  // 1) If multi-touch is happening (touches>=2), do NOT record taps.
  // 2) After a multi-touch begins, ignore taps briefly (cooldown),
  //    because Safari often fires an initial pointer/touch event.
  let multiTouchActive = false;
  let ignoreTapsUntil = 0;

  function nowMs(){ return Date.now(); }
  function setIgnore(ms){ ignoreTapsUntil = Math.max(ignoreTapsUntil, nowMs() + ms); }
  function canTap(){
    if (multiTouchActive) return false;
    if (nowMs() < ignoreTapsUntil) return false;
    return true;
  }

  if (imageWrap){
    // Touch guards (most reliable on iOS)
    imageWrap.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length >= 2) {
        multiTouchActive = true;
        setIgnore(350); // block immediate ghost tap
      }
    }, { passive: true });

    imageWrap.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length >= 2) {
        multiTouchActive = true;
        setIgnore(350);
      }
    }, { passive: true });

    imageWrap.addEventListener("touchend", (e) => {
      // If all fingers lifted, end multi-touch but keep short cooldown
      const remaining = (e.touches && e.touches.length) ? e.touches.length : 0;
      if (remaining < 2) {
        multiTouchActive = false;
        setIgnore(220); // prevent “pinch released” ghost tap
      }
    }, { passive: true });

    imageWrap.addEventListener("touchcancel", () => {
      multiTouchActive = false;
      setIgnore(250);
    }, { passive: true });
  }

  // ---- Tap Capture ----
  function onTap(clientX, clientY){
    if (!imageWrap || !targetImage || !targetImage.src) return;
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

      // After the FIRST tap, show pinch hint briefly
      showPinchHintOnce();

      // Now show green “See results” + vendor CTA
      showSeeResultsIfReady();
    } else {
      taps.push({ x: nx, y: ny });
      setTapsCount(taps.length);
      addDotAt(x, y, "hole");
    }
  }

  if (imageWrap){
    imageWrap.style.position = "relative";

    // Use pointerdown but don’t preventDefault globally (it interferes with pinch/scroll)
    imageWrap.addEventListener("pointerdown", (e) => {
      // Only accept primary pointer (finger/mouse). If Safari gives weirdness, touch guards handle it.
      if (e.isPrimary === false) return;
      onTap(e.clientX, e.clientY);
    });
  }

  // ---- Clear Taps ----
  if (clearTapsBtn){
    clearTapsBtn.addEventListener("click", () => {
      // Keep photo, just reset taps
      bullTap = null;
      taps = [];
      lastResultJson = null;

      clearDots();
      setTapsCount(0);

      // Hide results, hide seeResults again until bullTap re-done
      if (resultsBox) resultsBox.style.display = "none";
      showSeeResultsIfReady();

      // Hide pinch hint
      if (pinchHint) pinchHint.style.display = "none";
    });
  }

  // ---- Shooter-language results formatting ----
  function fmtPct(n){
    // n is normalized 0..1 or delta normalized
    const v = Math.abs(Number(n || 0)) * 100;
    return `${v.toFixed(1)}%`;
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

  function distanceNorm(dx, dy){
    const d = Math.sqrt((dx*dx) + (dy*dy));
    return (d * 100).toFixed(1) + "%";
  }

  function renderShooterResults(out){
    // Expected out shape from backend:
    // { ok, distanceYds, tapsCount, bullTap:{x,y}, poib:{x,y}, delta:{x,y}, ... }
    if (!resultsText) return;

    const ok = !!out?.ok;
    if (!ok) {
      resultsText.innerHTML = `<div class="mono">No results.</div>`;
      return;
    }

    const distanceYds = Number(out.distanceYds || 0);
    const shots = Number(out.tapsCount || 0);

    const bull = out.bullTap || null;
    const poib = out.poib || null;

    // delta is the money: correction = bull - POIB
    // If backend didn’t provide delta, compute it if possible.
    let dx = Number(out?.delta?.x);
    let dy = Number(out?.delta?.y);

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      if (bull && poib) {
        dx = Number(bull.x) - Number(poib.x);
        dy = Number(bull.y) - Number(poib.y);
      } else {
        dx = 0; dy = 0;
      }
    }

    const lr = dirLR(dx);
    const ud = dirUD(dy);

    const html = `
      <div class="resultGrid">
        <div class="resultRow">
          <div class="label">Distance</div>
          <div class="value">${distanceYds} yds</div>
        </div>

        <div class="resultRow">
          <div class="label">Shots tapped</div>
          <div class="value">${shots}</div>
        </div>

        <div class="divider"></div>

        <div class="resultRow">
          <div class="label">Aim point (Tap 1)</div>
          <div class="value">${bull ? "Captured" : "—"}</div>
        </div>

        <div class="resultRow">
          <div class="label">POIB (group center)</div>
          <div class="value">${poib ? "Captured" : "—"}</div>
        </div>

        <div class="divider"></div>

        <div class="resultRow">
          <div class="label">Correction</div>
          <div class="value big">${lr} ${fmtPct(dx)} • ${ud} ${fmtPct(dy)}</div>
        </div>

        <div class="resultRow">
          <div class="label">Offset (aim → POIB)</div>
          <div class="value">${distanceNorm(dx, dy)}</div>
        </div>

        <div class="subtle mt8">
          Note: percent values are relative to the photo size. (Inches/MOA comes next once we bind this to your grid scale.)
        </div>
      </div>
    `;

    resultsText.innerHTML = html;
  }

  function renderReceiptJson(out){
    if (!resultsText) return;
    resultsText.innerHTML = `<pre class="mono" style="white-space:pre-wrap;margin:0;">${escapeHtml(JSON.stringify(out, null, 2))}</pre>`;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ---- Results call ----
  async function doResults(){
    try{
      if (!targetImage || !targetImage.src) {
        alert("Add a target photo first.");
        return;
      }
      if (!bullTap) {
        alert("Tap the bull’s-eye / aim point first.");
        return;
      }
      if (taps.length < 1) {
        alert("Tap at least 1 bullet hole after the aim point.");
        return;
      }

      const distanceYds = Number(distanceInput?.value || 100);
      const vendorLink = String(vendorInput?.value || "").trim();

      const payload = {
        distanceYds,
        vendorLink,
        bullTap,
        taps,
        imageDataUrl: null
      };

      if (typeof window.tapscore !== "function") {
        throw new Error("Analyze function missing (api.js not loaded).");
      }

      const out = await window.tapscore(payload);
      lastResultJson = out;

      // Show results panel
      if (resultsBox) resultsBox.style.display = "block";

      // Shooter-language view by default
      renderShooterResults(out);
    } catch(err){
      const msg = (err && err.message) ? err.message : "Network/server error. Try again.";
      alert(msg);
    }
  }

  if (seeResultsBtn){
    seeResultsBtn.addEventListener("click", doResults);
  }

  // ---- Results buttons ----
  if (backBtn){
    backBtn.addEventListener("click", () => {
      if (resultsBox) resultsBox.style.display = "none";
    });
  }

  if (receiptBtn){
    receiptBtn.addEventListener("click", () => {
      if (!lastResultJson) return;
      renderReceiptJson(lastResultJson);
    });
  }

  if (savedBtn){
    savedBtn.addEventListener("click", () => {
      // placeholder; you can wire later
      alert("Saved (stub).");
    });
  }

  // ---- Init ----
  // Start clean: hide “See results” until first tap, hide tap line until photo exists.
  if (seeResultsBtn) seeResultsBtn.style.display = "none";
  showTapLineIfReady();
})();
