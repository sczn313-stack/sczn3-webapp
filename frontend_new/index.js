// sczn3-webapp/frontend_new/index.js
// INPUT page logic (index.html)
//
// What it does:
// - iOS-safe upload button (label -> hidden file input) handled by HTML
// - Shows thumbnail preview immediately
// - Saves photo (as dataURL) + filename + distance to sessionStorage
// - Enables "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS" only after photo is ready
// - Opens a modal with an embedded output.html (iframe)
// - Modal closes via X, outside tap, or ESC

(function () {
  const $ = (id) => document.getElementById(id);

  // ---- Elements (match your index.html) ----
  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const buyMoreBtn = $("buyMoreBtn");
  const pressToSee = $("pressToSee");

  // Modal elements (must exist in index.html)
  const overlay = $("secModalOverlay");
  const modalBody = $("secModalBody");
  const closeBtn = $("secModalClose");

  if (!fileInput) return;

  // ---- Storage keys (must match output.js) ----
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const NAME_KEY = "sczn3_targetPhoto_fileName";
  const DIST_KEY = "sczn3_distance_yards";
  const BUY_URL_KEY = "sczn3_vendor_buy_url";
  const SEC_ID_KEY = "sczn3_sec_id";

  // ---- UI helpers ----
  function setDisabled(el, disabled) {
    if (!el) return;
    if (disabled) el.classList.add("disabled");
    else el.classList.remove("disabled");
  }

  function hasPhotoReady() {
    return !!sessionStorage.getItem(PHOTO_KEY);
  }

  function syncPressToSeeState() {
    setDisabled(pressToSee, !hasPhotoReady());
  }

  function saveDistance() {
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function ensureSecId() {
    let id = sessionStorage.getItem(SEC_ID_KEY);
    if (!id) {
      id = Math.random().toString(16).slice(2, 8).toUpperCase();
      sessionStorage.setItem(SEC_ID_KEY, id);
    }
    return id;
  }

  // ---- Modal controls ----
  function openModal() {
    if (!overlay || !modalBody) {
      // Fallback: if modal markup missing, just go to output.html
      window.location.href = "./output.html";
      return;
    }

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // Clear previous content
    modalBody.innerHTML = "";

    // Build iframe that loads output.html
    const iframe = document.createElement("iframe");
    iframe.src = "./output.html";
    iframe.title = "SEC Output";
    iframe.style.width = "100%";
    iframe.style.height = "70vh";
    iframe.style.border = "0";
    iframe.style.borderRadius = "12px";

    // Simple loading message (optional but feels good)
    const loading = document.createElement("div");
    loading.textContent = "Generating SEC…";
    loading.style.fontWeight = "700";
    loading.style.margin = "4px 0 10px 0";

    modalBody.appendChild(loading);
    modalBody.appendChild(iframe);

    // Once iframe loads, remove the loading text
    iframe.addEventListener("load", () => {
      try {
        loading.remove();
      } catch {}
    });
  }

  function closeModal() {
    if (!overlay) return;
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (modalBody) modalBody.innerHTML = "";
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Click outside modal closes it
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // ESC closes it (desktop)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ---- Distance persistence ----
  if (distanceInput) {
    // Load saved distance (if any)
    const saved = sessionStorage.getItem(DIST_KEY);
    if (saved) distanceInput.value = saved;

    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
    saveDistance();
  }

  // ---- BUY MORE TARGETS ----
  if (buyMoreBtn) {
    const buyUrl = sessionStorage.getItem(BUY_URL_KEY);
    if (buyUrl) buyMoreBtn.href = buyUrl;

    buyMoreBtn.addEventListener("click", (e) => {
      const url = sessionStorage.getItem(BUY_URL_KEY);
      if (!url || url === "#") {
        // If no URL yet, don't dead-click. (You can wire this later.)
        e.preventDefault();
        alert("Buy link not set yet.");
      }
    });
  }

  // ---- Upload + thumbnail + storage ----
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      return;
    }

    ensureSecId();
    saveDistance();

    // 1) Instant thumbnail preview using an object URL (fast, iOS-friendly)
    if (thumb) {
      try {
        const objUrl = URL.createObjectURL(file);
        thumb.src = objUrl;
        thumb.style.display = "block";
        // We could revoke later, but leaving it is fine for this simple page.
      } catch {
        // If createObjectURL fails, we'll still try FileReader below
      }
    }

    // 2) Store as dataURL for output.js
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e && e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) return;

      try {
        sessionStorage.setItem(PHOTO_KEY, dataUrl);
        sessionStorage.setItem(NAME_KEY, file.name || "target.jpg");
      } catch (err) {
        console.warn("sessionStorage failed:", err);
      }

      // If thumbnail didn't show yet, set it now
      if (thumb && (!thumb.src || thumb.src === window.location.href)) {
        thumb.src = dataUrl;
        thumb.style.display = "block";
      }

      // Enable the button only after data is saved
      syncPressToSeeState();
    };

    reader.onerror = () => {
      alert("Could not read that image. Please try a different photo.");
      try {
        sessionStorage.removeItem(PHOTO_KEY);
      } catch {}
      syncPressToSeeState();
    };

    reader.readAsDataURL(file);
  });

  // ---- PRESS TO SEE (opens modal + loads output.html) ----
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      // Must have stored dataURL (not just preview)
      if (!hasPhotoReady()) {
        alert("Please upload a target photo first.");
        return;
      }

      // Make sure distance is stored before showing output
      saveDistance();

      openModal();
    });
  }

  // Initial state
  syncPressToSeeState();
})();
