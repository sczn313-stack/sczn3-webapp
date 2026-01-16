// sczn3-webapp/frontend_new/index.js
// Upload page logic (index.html)
//
// What it does:
// - Upload target photo (iOS-safe: label triggers hidden input)
// - Shows thumbnail preview immediately
// - Saves photo + distance to sessionStorage
// - Enables PRESS TO SEE only after photo is selected
// - PRESS TO SEE -> output.html
//
// Storage keys used by output.js:
//   sczn3_targetPhoto_dataUrl
//   sczn3_targetPhoto_fileName
//   sczn3_distance_yards
//
// Optional keys:
//   sczn3_vendor_buy_url

(function () {
  const PHOTO_KEY = "sczn3_targetPhoto_dataUrl";
  const FILE_KEY = "sczn3_targetPhoto_fileName";
  const DIST_KEY = "sczn3_distance_yards";

  function $(id) {
    return document.getElementById(id);
  }

  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const pressToSee = $("pressToSee");
  const buyMoreBtn = $("buyMoreBtn");

  // Modal elements exist in your HTML — we won't use them right now,
  // because PRESS TO SEE needs to go to output.html for the SEC output.
  // (Leaving them in place does not hurt anything.)
  // const modalOverlay = $("secModalOverlay");

  function setPressEnabled(enabled) {
    if (!pressToSee) return;
    if (enabled) {
      pressToSee.classList.remove("disabled");
      pressToSee.style.pointerEvents = "auto";
      pressToSee.style.opacity = "1";
    } else {
      pressToSee.classList.add("disabled");
      pressToSee.style.pointerEvents = "none";
      pressToSee.style.opacity = "0.7";
    }
  }

  function saveDistance() {
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (v) sessionStorage.setItem(DIST_KEY, v);
  }

  function showThumb(dataUrl) {
    if (!thumb) return;
    thumb.src = dataUrl;
    thumb.style.display = "block";
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read failed."));
      reader.onload = (e) => resolve(String(e.target && e.target.result ? e.target.result : ""));
      reader.readAsDataURL(file);
    });
  }

  // ---- Init: load saved state if any ----
  (function init() {
    // distance
    const savedDist = sessionStorage.getItem(DIST_KEY);
    if (distanceInput && savedDist) distanceInput.value = savedDist;

    // vendor url (optional)
    const buyUrl = sessionStorage.getItem("sczn3_vendor_buy_url");
    if (buyMoreBtn && buyUrl) buyMoreBtn.href = buyUrl;

    // photo + thumbnail
    const savedPhoto = sessionStorage.getItem(PHOTO_KEY);
    if (savedPhoto) {
      showThumb(savedPhoto);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
    }

    // save distance immediately
    saveDistance();
  })();

  // ---- Distance save ----
  if (distanceInput) {
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
  }

  // ---- Upload change -> thumbnail + storage ----
  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      setPressEnabled(false);
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);

      if (!dataUrl) {
        alert("Could not load the photo. Please try again.");
        setPressEnabled(false);
        return;
      }

      // show thumbnail
      showThumb(dataUrl);

      // store for output page
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
      sessionStorage.setItem(FILE_KEY, file.name || "target.jpg");

      // keep distance current
      saveDistance();

      // enable PRESS TO SEE
      setPressEnabled(true);
    } catch (err) {
      alert("Photo load failed. Please try again.");
      setPressEnabled(false);
    }
  });

  // ---- PRESS TO SEE -> output.html ----
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      const hasPhoto = !!sessionStorage.getItem(PHOTO_KEY);
      if (!hasPhoto) {
        alert("Please upload a target photo first.");
        setPressEnabled(false);
        return;
      }

      // lock in distance right before leaving
      saveDistance();

      window.location.href = "./output.html";
    });
  }
})();
