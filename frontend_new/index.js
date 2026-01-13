// frontend_new/index.js
// Upload page logic:
// - Show thumbnail preview
// - Save image + distance to sessionStorage
// - PRESS TO SEE -> output.html

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  const fileInput = $("targetPhoto");
  const thumb = $("thumb");
  const distanceInput = $("distanceYards") || document.querySelector('input[type="number"]');

  // Find PRESS TO SEE link/button (works even if it has no id)
  const pressToSee =
    $("pressToSee") ||
    Array.from(document.querySelectorAll("a,button")).find((el) =>
      (el.textContent || "").trim().toUpperCase().includes("PRESS TO SEE")
    );

  if (!fileInput) return;

  // Save distance any time it changes
  if (distanceInput) {
    const saveDistance = () => {
      const v = String(distanceInput.value || "").trim();
      if (v) sessionStorage.setItem("sczn3_distance_yards", v);
    };
    distanceInput.addEventListener("input", saveDistance);
    distanceInput.addEventListener("change", saveDistance);
    saveDistance();
  }

  // File change -> preview + store
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

      if (thumb) {
        thumb.src = dataUrl;
        thumb.style.display = "block";
      }

      try {
        sessionStorage.setItem("sczn3_targetPhoto_dataUrl", dataUrl);
        sessionStorage.setItem("sczn3_targetPhoto_fileName", file.name || "target.jpg");
      } catch (err) {
        console.warn("sessionStorage failed:", err);
      }

      if (pressToSee) {
        pressToSee.style.opacity = "1";
        pressToSee.style.pointerEvents = "auto";
      }
    };

    reader.readAsDataURL(file);
  });

  // PRESS TO SEE -> output.html
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      e.preventDefault();

      const hasPhoto = !!sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
      if (!hasPhoto) {
        alert("Please upload a target photo first.");
        return;
      }

      window.location.href = "output.html";
    });

    // Slight “disabled” look until photo exists
    const alreadyHasPhoto = !!sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
    if (!alreadyHasPhoto) pressToSee.style.opacity = "0.75";
  }
})();
