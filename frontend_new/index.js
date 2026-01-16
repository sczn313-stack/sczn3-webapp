// sczn3-webapp/frontend_new/index.js
// Upload page logic (Tap & Score Pilot):
// - Upload target photo -> show thumbnail
// - Tap thumbnail to record shots (x,y in image pixels)
// - Undo / Reset taps
// - Save: image dataUrl, distance yards, tap points -> sessionStorage
// - PRESS TO SEE -> output.html

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  // ---- IDs expected in your current upload page HTML ----
  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const pressToSee = $("pressToSee");

  // If your page has an upload label, we don't need it for logic,
  // but we keep it here in case you want to style it later.
  const uploadLabel = $("uploadLabel");

  if (!fileInput || !thumb || !pressToSee) return;

  // ---- Storage keys (LOCK: do not rename without updating output.js) ----
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const NAME_KEY = "sczn3_targetPhoto_fileName";
  const DIST_KEY = "sczn3_distance_yards";
  const TAPS_KEY = "sczn3_tap_points_json";

  // ---- Tap & Score state ----
  let taps = []; // {x,y} in displayed-image pixel space
  let scaleX = 1; // naturalWidth / displayedWidth
  let scaleY = 1; // naturalHeight / displayedHeight

  // ---- Helpers ----
  function setDisabled(el, disabled) {
    if (!el) return;
    if (disabled) {
      el.classList.add("disabled");
      el.setAttribute("aria-disabled", "true");
      el.style.pointerEvents = "none";
    } else {
      el.classList.remove("disabled");
      el.removeAttribute("aria-disabled");
      el.style.pointerEvents = "auto";
    }
  }

  function saveDistance() {
    const v = String((distanceInput && distanceInput.value) || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function loadDistance() {
    const v = sessionStorage.getItem(DIST_KEY);
    if (v && distanceInput) distanceInput.value = v;
  }

  function savePhoto(dataUrl, fileName) {
    sessionStorage.setItem(PHOTO_KEY, dataUrl);
    sessionStorage.setItem(NAME_KEY, fileName || "target.jpg");
  }

  function saveTaps() {
    try {
      sessionStorage.setItem(TAPS_KEY, JSON.stringify(taps));
    } catch {}
  }

  function loadTaps() {
    try {
      const raw = sessionStorage.getItem(TAPS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) taps = parsed.filter(p => p && isFinite(p.x) && isFinite(p.y));
    } catch {}
  }

  // ---- Create UI controls (without touching your layout/CSS file) ----
  // These controls sit under the thumbnail on the upload page.
  const toolsWrap = document.createElement("div");
  toolsWrap.style.maxWidth = "92%";
  toolsWrap.style.margin = "14px auto 0 auto";
  toolsWrap.style.display = "none"; // only after photo is loaded
  toolsWrap.style.textAlign = "center";
  toolsWrap.style.gap = "10px";

  const countLine = document.createElement("div");
  countLine.style.marginTop = "10px";
  countLine.style.fontWeight = "700";
  countLine.style.color = "#2f5f73";
  countLine.textContent = "Shots recorded: 0";

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.justifyContent = "center";
  btnRow.style.gap = "10px";
  btnRow.style.flexWrap = "wrap";
  btnRow.style.marginTop = "10px";

  function makeMiniBtn(text) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.padding = "10px 14px";
    b.style.borderRadius = "999px";
    b.style.border = "1px solid #c9d6dd";
    b.style.background = "#e6eef2";
    b.style.color = "#0b66c3";
    b.style.fontWeight = "700";
    b.style.cursor = "pointer";
    b.style.webkitTapHighlightColor = "transparent";
    return b;
  }

  const undoBtn = makeMiniBtn("UNDO LAST TAP");
  const resetBtn = makeMiniBtn("RESET TAPS");

  btnRow.appendChild(undoBtn);
  btnRow.appendChild(resetBtn);

  toolsWrap.appendChild(btnRow);
  toolsWrap.appendChild(countLine);

  // Insert tools right after the thumbnail image
  thumb.insertAdjacentElement("afterend", toolsWrap);

  // ---- Tap overlay: dots are drawn as absolutely positioned divs over the image ----
  const overlay = document.createElement("div");
  overlay.style.position = "relative";
  overlay.style.display = "inline-block";
  overlay.style.maxWidth = "92%";
  overlay.style.margin = "16px auto 0 auto";

  // Move thumb into overlay container (no layout break; keeps same visual)
  const thumbParent = thumb.parentElement;
  if (thumbParent) {
    // Wrap only once
    if (!thumbParent.querySelector(".sczn3OverlayWrap")) {
      const wrap = document.createElement("div");
      wrap.className = "sczn3OverlayWrap";
      wrap.style.textAlign = "center";
      wrap.appendChild(overlay);

      // Insert wrap before thumb, then move thumb into overlay
      thumbParent.insertBefore(wrap, thumb);
      overlay.appendChild(thumb);
    }
  }

  const dotsLayer = document.createElement("div");
  dotsLayer.style.position = "absolute";
  dotsLayer.style.left = "0";
  dotsLayer.style.top = "0";
  dotsLayer.style.right = "0";
  dotsLayer.style.bottom = "0";
  dotsLayer.style.pointerEvents = "none";
  overlay.appendChild(dotsLayer);

  function clearDots() {
    dotsLayer.innerHTML = "";
  }

  function drawDots() {
    clearDots();

    const rect = thumb.getBoundingClientRect();
    const w = rect.width || thumb.clientWidth || 1;
    const h = rect.height || thumb.clientHeight || 1;

    // Dots sized relative to image
    const dotSize = Math.max(10, Math.min(w, h) * 0.02);

    for (const p of taps) {
      const dot = document.createElement("div");
      dot.style.position = "absolute";
      dot.style.width = dotSize + "px";
      dot.style.height = dotSize + "px";
      dot.style.borderRadius = "50%";
      dot.style.background = "#b00000";
      dot.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.85)";
      dot.style.transform = "translate(-50%, -50%)";
      dot.style.left = (p.x / scaleX) + "px";
      dot.style.top = (p.y / scaleY) + "px";
      dotsLayer.appendChild(dot);
    }

    countLine.textContent = "Shots recorded: " + taps.length;
    saveTaps();
  }

  function updateScale() {
    // Save taps in NATURAL pixel coords so resizing doesn't break them.
    const nw = thumb.naturalWidth || 1;
    const nh = thumb.naturalHeight || 1;
    const dw = thumb.clientWidth || 1;
    const dh = thumb.clientHeight || 1;
    scaleX = nw / dw;
    scaleY = nh / dh;
  }

  // ---- File upload -> preview ----
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) return;

      // Show thumbnail
      thumb.src = dataUrl;
      thumb.style.display = "block";

      // Reset taps for new image
      taps = [];
      saveTaps();

      // Save image to storage
      savePhoto(dataUrl, file.name || "target.jpg");

      // Enable tap tools + PRESS TO SEE
      toolsWrap.style.display = "block";
      setDisabled(pressToSee, false);

      // Recompute scaling when image loads
      thumb.onload = () => {
        updateScale();
        drawDots();
      };
    };

    reader.readAsDataURL(file);
  });

  // ---- Tap to add shot ----
  thumb.addEventListener("click", (evt) => {
    // Only if photo exists
    const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
    if (!hasPhoto) return;

    updateScale();

    const rect = thumb.getBoundingClientRect();
    const xDisplayed = evt.clientX - rect.left;
    const yDisplayed = evt.clientY - rect.top;

    // Convert to NATURAL pixel coordinates
    const x = xDisplayed * scaleX;
    const y = yDisplayed * scaleY;

    taps.push({ x: Math.round(x), y: Math.round(y) });
    drawDots();
  });

  // ---- Undo / Reset ----
  undoBtn.addEventListener("click", () => {
    if (taps.length === 0) return;
    taps.pop();
    drawDots();
  });

  resetBtn.addEventListener("click", () => {
    taps = [];
    drawDots();
  });

  // ---- Distance store ----
  if (distanceInput) {
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ---- PRESS TO SEE -> output.html ----
  pressToSee.addEventListener("click", (e) => {
    e.preventDefault();

    const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
    if (!hasPhoto) {
      alert("Please upload a target photo first.");
      return;
    }

    // Save distance right before leaving
    saveDistance();

    // If user didn't tap yet, we still allow output page (it can show banner)
    window.location.href = "output.html";
  });

  // ---- Init state ----
  loadDistance();
  loadTaps();

  const existingPhoto = sessionStorage.getItem(PHOTO_KEY);
  if (existingPhoto) {
    thumb.src = existingPhoto;
    thumb.style.display = "block";
    toolsWrap.style.display = "block";
    setDisabled(pressToSee, false);

    thumb.onload = () => {
      updateScale();
      drawDots();
    };
  } else {
    // start disabled until upload
    setDisabled(pressToSee, true);
  }

  // Redraw dots if viewport changes
  window.addEventListener("resize", () => {
    if (!thumb || thumb.style.display === "none") return;
    updateScale();
    drawDots();
  });
})();
