// sczn3-webapp/frontend_new/index.js
// Input page logic (works with your current index.html that includes the modal markup)
//
// - iOS-safe upload via <label for="targetPhoto">
// - Shows thumbnail preview (forces render on iOS)
// - Stores photo + distance in sessionStorage
// - Enables "YOUR SCORE / ..." button after photo selected
// - Opens modal and loads output.html inside an iframe

(function () {
  // ---- Helpers ----
  function $(id) {
    return document.getElementById(id);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function init() {
    // ---- Elements (match your index.html) ----
    const fileInput = $("targetPhoto");
    const thumb = $("thumb");
    const distanceInput = $("distanceYards");

    const buyMoreBtn = $("buyMoreBtn");
    const pressToSee = $("pressToSee");

    // Modal elements (you added these in the HTML)
    const overlay = $("secModalOverlay");
    const modalBody = $("secModalBody");
    const closeBtn = $("secModalClose");

    // ---- Storage keys (must match output.js) ----
    const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
    const NAME_KEY = "sczn3_targetPhoto_fileName";
    const DIST_KEY = "sczn3_distance_yards";

    // If these IDs aren't present, bail safely
    if (!fileInput) return;

    // ---- Distance handling ----
    function saveDistance() {
      if (!distanceInput) return;
      const v = String(distanceInput.value || "").trim();
      if (v) sessionStorage.setItem(DIST_KEY, v);
    }

    if (distanceInput) {
      distanceInput.addEventListener("input", saveDistance);
      distanceInput.addEventListener("change", saveDistance);
      saveDistance();
    }

    // ---- Button enable/disable ----
    function setPressEnabled(enabled) {
      if (!pressToSee) return;

      if (enabled) {
        pressToSee.classList.remove("disabled");
        pressToSee.setAttribute("aria-disabled", "false");
      } else {
        pressToSee.classList.add("disabled");
        pressToSee.setAttribute("aria-disabled", "true");
      }
    }

    // Start disabled unless we already have a stored photo
    setPressEnabled(!!sessionStorage.getItem(PHOTO_KEY));

    // ---- Thumbnail render helper (forces iOS repaint) ----
    function showThumb(dataUrl) {
      if (!thumb) return;

      // Force visible styles (iOS sometimes keeps it hidden if styles were applied earlier)
      thumb.style.display = "block";
      thumb.style.visibility = "visible";
      thumb.style.opacity = "1";

      // Set src after a tick to force repaint
      requestAnimationFrame(() => {
        thumb.src = dataUrl;

        // extra tick for Safari
        setTimeout(() => {
          thumb.src = dataUrl;
        }, 0);
      });
    }

    // ---- File change -> preview + store ----
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith("image/")) {
        alert("Please choose an image file.");
        fileInput.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = function (e) {
        const dataUrl = e && e.target && e.target.result ? String(e.target.result) : "";
        if (!dataUrl) return;

        // Show preview
        showThumb(dataUrl);

        // Store for output page
        try {
          sessionStorage.setItem(PHOTO_KEY, dataUrl);
          sessionStorage.setItem(NAME_KEY, file.name || "target.jpg");
          saveDistance();
        } catch (err) {
          console.warn("sessionStorage failed:", err);
        }

        // Enable the big button
        setPressEnabled(true);
      };

      reader.readAsDataURL(file);
    });

    // ---- Modal open/close ----
    function openModal() {
      if (!overlay || !modalBody) {
        // fallback: no modal present -> just go to output.html
        window.location.href = "./output.html";
        return;
      }

      document.body.classList.add("modal-open");
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");

      // Build an iframe to load output.html inside the modal
      modalBody.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.src = "./output.html?v=" + Date.now(); // cache-bust so you always see latest
      iframe.title = "SEC Output";
      iframe.style.width = "100%";
      iframe.style.height = "70vh";
      iframe.style.border = "0";
      iframe.style.borderRadius = "12px";

      modalBody.appendChild(iframe);
    }

    function closeModal() {
      if (!overlay) return;

      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");

      // Clear iframe content so it reloads fresh next time
      if (modalBody) modalBody.innerHTML = "";
    }

    // Click big button
    if (pressToSee) {
      pressToSee.addEventListener("click", function (e) {
        e.preventDefault();

        // If still disabled or missing photo, block
        const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
        if (!hasPhoto) {
          alert("Please upload a target photo first.");
          return;
        }

        openModal();
      });
    }

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeModal();
      });
    }

    // Click outside modal closes it
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    // ESC closes it (desktop)
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  });
})();
