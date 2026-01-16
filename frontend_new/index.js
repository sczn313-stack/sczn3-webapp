// sczn3-webapp/frontend_new/index.js
// Input page logic (index.html):
// - Upload photo (iOS-safe label -> hidden input)
// - Show thumbnail preview
// - Save photo + distance in sessionStorage
// - Enable "YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS"
// - Open a modal that loads output.html inside an iframe

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILENAME_KEY = "sczn3_targetPhoto_fileName";
  const DIST_KEY = "sczn3_distance_yards";
  const BUY_URL_KEY = "sczn3_vendor_buy_url";

  function $(id) {
    return document.getElementById(id);
  }

  const fileInput = $("targetPhoto");
  const uploadLabel = $("uploadLabel");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const buyMoreBtn = $("buyMoreBtn");
  const pressToSee = $("pressToSee");

  // Modal elements (must exist in your index.html)
  const overlay = $("secModalOverlay");
  const modalBody = $("secModalBody");
  const modalClose = $("secModalClose");

  if (!fileInput) return;

  function setPressEnabled(enabled) {
    if (!pressToSee) return;
    if (enabled) {
      pressToSee.classList.remove("disabled");
      pressToSee.setAttribute("aria-disabled", "false");
      pressToSee.style.pointerEvents = "auto";
    } else {
      pressToSee.classList.add("disabled");
      pressToSee.setAttribute("aria-disabled", "true");
      pressToSee.style.pointerEvents = "none";
    }
  }

  function saveDistance() {
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function restoreDistance() {
    if (!distanceInput) return;
    const saved = sessionStorage.getItem(DIST_KEY);
    if (saved != null && saved !== "") {
      distanceInput.value = saved;
    } else {
      // default already in HTML, but keep storage aligned
      sessionStorage.setItem(DIST_KEY, String(distanceInput.value || "100"));
    }
  }

  function showThumb(dataUrl) {
    if (!thumb) return;
    thumb.src = dataUrl;
    thumb.style.display = "block";
  }

  function restoreThumb() {
    const dataUrl = sessionStorage.getItem(PHOTO_KEY);
    if (dataUrl) {
      showThumb(dataUrl);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
    }
  }

  // iOS: allow re-picking the same photo by clearing the input before opening picker
  if (uploadLabel) {
    uploadLabel.addEventListener("click", () => {
      try {
        fileInput.value = "";
      } catch {}
    });
  }

  // Distance listeners
  if (distanceInput) {
    restoreDistance();
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // Vendor buy link (optional)
  if (buyMoreBtn) {
    const buyUrl = sessionStorage.getItem(BUY_URL_KEY);
    if (buyUrl) buyMoreBtn.href = buyUrl;
    buyMoreBtn.addEventListener("click", (e) => {
      // If it’s still "#", prevent awkward jump
      if (!buyMoreBtn.getAttribute("href") || buyMoreBtn.getAttribute("href") === "#") {
        e.preventDefault();
      }
    });
  }

  // File selection -> preview + store
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      try {
        fileInput.value = "";
      } catch {}
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e && e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) return;

      try {
        sessionStorage.setItem(PHOTO_KEY, dataUrl);
        sessionStorage.setItem(FILENAME_KEY, file.name || "target.jpg");
      } catch (err) {
        console.warn("sessionStorage failed:", err);
      }

      showThumb(dataUrl);
      setPressEnabled(true);
      saveDistance();
    };

    reader.readAsDataURL(file);
  });

  // ---- Modal open/close + iframe loader ----
  function openModal() {
    if (!overlay || !modalBody) {
      // If modal markup is missing, fall back to normal navigation
      window.location.href = "./output.html";
      return;
    }

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // Clear + load iframe
    modalBody.innerHTML = "";

    // Little “loading” text (fast feedback)
    const loading = document.createElement("div");
    loading.textContent = "Generating…";
    loading.style.fontWeight = "700";
    loading.style.padding = "10px 0 12px 0";
    modalBody.appendChild(loading);

    const frame = document.createElement("iframe");
    frame.src = "./output.html";
    frame.title = "SEC Output";
    frame.style.width = "100%";
    frame.style.height = "70vh";
    frame.style.border = "0";
    frame.style.borderRadius = "12px";
    frame.style.background = "#fff";

    frame.onload = () => {
      loading.remove();
    };

    modalBody.appendChild(frame);
  }

  function closeModal() {
    if (!overlay || !modalBody) return;
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalBody.innerHTML = "";
  }

  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
      if (!hasPhoto) {
        alert("Please upload a target photo first.");
        return;
      }

      saveDistance();
      openModal();
    });
  }

  if (modalClose) {
    modalClose.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Click outside modal closes (only if clicking the overlay background)
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Init
  restoreThumb();
})();
