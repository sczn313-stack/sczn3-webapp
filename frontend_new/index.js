// frontend_new/index.js
// Updates:
/// - Stops forcing camera-only by NOT overriding label behavior
//   (label-for already opens the picker, which allows Photo Library)
/// - Enables PRESS TO SEE after a valid image is chosen
/// - Keeps distance editable (sanitizes on blur/change)

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const buyMoreBtn = $("buyMoreBtn");
  const pressToSeeBtn = $("pressToSee");

  let selectedFile = null;

  function setPressToSeeEnabled(enabled) {
    if (!pressToSeeBtn) return;

    if (enabled) {
      pressToSeeBtn.classList.remove("disabled");
      pressToSeeBtn.style.pointerEvents = "auto";
      pressToSeeBtn.style.opacity = "1";
      pressToSeeBtn.setAttribute("aria-disabled", "false");
    } else {
      pressToSeeBtn.classList.add("disabled");
      pressToSeeBtn.style.pointerEvents = "none";
      pressToSeeBtn.style.opacity = "0.6";
      pressToSeeBtn.setAttribute("aria-disabled", "true");
    }
  }

  function sanitizeDistance(raw) {
    const n = Number(String(raw ?? "").trim());
    if (!Number.isFinite(n)) return 100;
    const rounded = Math.round(n);
    return Math.max(1, rounded);
  }

  function showThumbFromFile(file) {
    if (!thumb) return;

    if (!file) {
      thumb.removeAttribute("src");
      thumb.style.display = "none";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    thumb.onload = () => URL.revokeObjectURL(objectUrl);
    thumb.src = objectUrl;
    thumb.style.display = "block";
  }

  // Init
  setPressToSeeEnabled(false);

  // IMPORTANT:
  // Do NOT programmatically click the file input from the label click.
  // On iOS, that can push camera-only behavior.
  // The label (for="targetPhoto") is the iOS-safe mechanism by itself.

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

      if (!file) {
        selectedFile = null;
        showThumbFromFile(null);
        setPressToSeeEnabled(false);
        return;
      }

      if (!file.type || !file.type.startsWith("image/")) {
        selectedFile = null;
        showThumbFromFile(null);
        setPressToSeeEnabled(false);
        alert("Please choose an image file.");
        return;
      }

      selectedFile = file;
      showThumbFromFile(file);
      setPressToSeeEnabled(true);
    });
  }

  if (distanceInput) {
    distanceInput.addEventListener("blur", () => {
      distanceInput.value = String(sanitizeDistance(distanceInput.value));
    });
    distanceInput.addEventListener("change", () => {
      distanceInput.value = String(sanitizeDistance(distanceInput.value));
    });
  }

  if (buyMoreBtn) {
    buyMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Buy More Targets link not set yet.");
    });
  }

  if (pressToSeeBtn) {
    pressToSeeBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (!selectedFile) {
        setPressToSeeEnabled(false);
        alert("Upload a target photo first.");
        return;
      }

      const distanceYards = sanitizeDistance(distanceInput ? distanceInput.value : 100);

      alert(
        `YOUR SCORE / SCOPE CLICKS / SHOOTING TIPS\n\nReady to analyze.\n\nPhoto: ${selectedFile.name}\nDistance: ${distanceYards} yards\n\nNext step: connect this button to your backend analyze endpoint.`
      );
    });
  }
})();
