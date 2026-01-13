// sczn3-webapp/frontend_new/index.js
// Upload page logic (LOCKED):
// - iOS-safe file picker (label tap + forced .click fallback)
// - Show thumbnail preview
// - Save image + distance to sessionStorage
// - Enable PRESS TO SEE only after photo exists
// - PRESS TO SEE -> output.html

(function () {
  const $ = (id) => document.getElementById(id);

  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards");
  const pressToSee = $("pressToSee");
  const buyMoreBtn = $("buyMoreBtn");
  const uploadLabel = $("uploadLabel");

  // Storage keys (consistent)
  const K_PHOTO = "sec_targetPhoto_dataUrl";
  const K_NAME = "sec_targetPhoto_fileName";
  const K_DIST = "sec_distance_yards";
  const K_VENDOR = "sec_vendor_buy_url";

  if (!fileInput) {
    console.warn("[index.js] Missing #targetPhoto input.");
    return;
  }

  // -----------------------
  // Helpers
  // -----------------------
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

  function saveDistance() {
    if (!distanceInput) return;
    const v = String(distanceInput.value || "").trim();
    if (!v) return;
    try {
      sessionStorage.setItem(K_DIST, v);
    } catch (e) {
      console.warn("sessionStorage distance failed:", e);
    }
  }

  function readDistanceOrDefault() {
    const v = (distanceInput && String(distanceInput.value || "").trim()) || "";
    if (v) return v;
    try {
      return sessionStorage.getItem(K_DIST) || "100";
    } catch {
      return "100";
    }
  }

  function showThumb(dataUrl) {
    if (!thumb) return;
    thumb.src = dataUrl;
    thumb.style.display = "block";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("File read failed"));
      reader.onload = (e) => resolve(String(e.target && e.target.result ? e.target.result : ""));
      reader.readAsDataURL(file);
    });
  }

  // -----------------------
  // Initialize saved state
  // -----------------------
  // Distance init
  if (distanceInput) {
    const saved = (() => {
      try {
        return sessionStorage.getItem(K_DIST);
      } catch {
        return null;
      }
    })();
    if (saved) distanceInput.value = saved;
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
    saveDistance();
  }

  // Buy-more link init (optional future use)
  if (buyMoreBtn) {
    try {
      const url = sessionStorage.getItem(K_VENDOR);
      if (url) buyMoreBtn.href = url;
    } catch {}
  }

  // If we already have a stored photo, show it and enable press
  try {
    const existing = sessionStorage.getItem(K_PHOTO);
    if (existing) {
      showThumb(existing);
      setPressEnabled(true);
    } else {
      setPressEnabled(false);
    }
  } catch {
    setPressEnabled(false);
  }

  // -----------------------
  // iOS-safe: label tap fallback
  // -----------------------
  // On some iOS builds, label->input works only if input is NOT display:none
  // We already fixed CSS, but we add a fallback click anyway.
  if (uploadLabel) {
    uploadLabel.addEventListener("click", () => {
      // Let the default label behavior happen, but also kick a fallback.
      // (No preventDefault here; we just assist.)
      try {
        setTimeout(() => fileInput.click(), 0);
      } catch {}
    });
  }

  // -----------------------
  // Handle file selection
  // -----------------------
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      setPressEnabled(false);
      return;
    }

    // Save distance (so output can show it)
    saveDistance();

    try {
      const dataUrl = await fileToDataUrl(file);

      if (!dataUrl) {
        alert("That file couldn’t be read. Try another photo.");
        fileInput.value = "";
        setPressEnabled(false);
        return;
      }

      // Show preview
      showThumb(dataUrl);

      // Persist for output page
      try {
        sessionStorage.setItem(K_PHOTO, dataUrl);
        sessionStorage.setItem(K_NAME, file.name || "target.jpg");
        sessionStorage.setItem(K_DIST, readDistanceOrDefault());
      } catch (e) {
        console.warn("sessionStorage photo failed:", e);
      }

      // Enable PRESS TO SEE
      setPressEnabled(true);
    } catch (err) {
      console.warn(err);
      alert("Could not load that image. Try again.");
      fileInput.value = "";
      setPressEnabled(false);
    }
  });

  // -----------------------
  // PRESS TO SEE -> output.html
  // -----------------------
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      let hasPhoto = false;
      try {
        hasPhoto = !!sessionStorage.getItem(K_PHOTO);
      } catch {
        hasPhoto = false;
      }

      if (!hasPhoto) {
        alert("Please upload a target photo first.");
        setPressEnabled(false);
        return;
      }

      // Make sure distance is stored before leaving
      saveDistance();

      window.location.href = "./output.html";
    });
  }
})();
