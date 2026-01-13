// frontend_new/index.js
// Purpose:
// 1) When user selects a photo, show thumbnail preview
// 2) Save the photo to sessionStorage so the next page can display it
// 3) Make "PRESS TO SEE" actually navigate (safe fallback)

(function () {
  // --- helpers ---
  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    // Optional: if you have a status element later, wire it here.
    // For now we keep it silent.
    // console.log(msg);
  }

  // --- elements we expect (based on your HTML) ---
  const fileInput = $("targetPhoto");
  const thumb = $("thumb");

  // Find "PRESS TO SEE" link/button even if it doesn't have an id
  const pressToSee =
    $("pressToSee") ||
    document.querySelector('a[href="#"].pillBtn') ||
    Array.from(document.querySelectorAll("a")).find(a =>
      (a.textContent || "").toUpperCase().includes("PRESS TO SEE")
    );

  // Make sure we have the input
  if (!fileInput) {
    setStatus("No #targetPhoto input found.");
    return;
  }

  // 1) File change → preview + store for output page
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    // Only accept images
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) return;

      // Show thumbnail on the upload page
      if (thumb) {
        thumb.src = dataUrl;
        thumb.style.display = "block";
      }

      // Store so output page can show it too
      // (Session storage survives page navigation in same tab)
      try {
        sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl);
        sessionStorage.setItem("sczn3_targetPhoto_fileName", file.name || "target.jpg");
      } catch (err) {
        // If storage is blocked or too large, still keep preview on this page
        console.warn("sessionStorage failed:", err);
      }

      // Make PRESS TO SEE feel “enabled”
      if (pressToSee) {
        pressToSee.style.opacity = "1";
        pressToSee.style.pointerEvents = "auto";
      }

      setStatus("Photo loaded.");
    };

    reader.readAsDataURL(file);
  });

  // 2) PRESS TO SEE → go to output page (safe fallbacks)
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      // Require photo before continuing
      const hasPhoto = !!sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
      if (!hasPhoto) {
        alert("Please upload a target photo first.");
        return;
      }

      // Try common output filenames (we’ll create/confirm next)
      // Priority: sec.html → output.html → result.html
      const candidates = ["sec.html", "output.html", "result.html"];

      // We can’t reliably “check” file existence on static hosting without fetch,
      // so we just navigate to the most likely one first.
      window.location.href = candidates[0];
    });

    // Default disabled look until a photo is uploaded
    const alreadyHasPhoto = !!sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
    if (!alreadyHasPhoto) {
      pressToSee.style.opacity = "0.6";
      pressToSee.style.pointerEvents = "auto"; // keep clickable, but we block with alert
    }
  }

})();
