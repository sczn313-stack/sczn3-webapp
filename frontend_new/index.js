/* sczn3-webapp/frontend_new/index.js
   PURPOSE:
   - Make the big "UPLOAD TARGET PHOTO or TAKE PICTURE" control open the file picker
   - Allow iPhone/iPad Safari to choose Camera OR Photo Library (no forced camera)
   - Show thumbnail preview + status text
   - Save selected image + yards so output.html can read it (localStorage)
   - Optional: try backend analyze call if you have an endpoint (won’t crash if missing)
*/

(function () {
  // Elements (support both your older label version and your newer button version)
  const fileInput = document.getElementById("targetPhoto");
  const thumb = document.getElementById("thumb");
  const thumbText = document.getElementById("thumbText") || null;

  const uploadBtn =
    document.getElementById("uploadBtn") || // if you used <button id="uploadBtn">
    document.querySelector('label[for="targetPhoto"]') || // if you used <label for="targetPhoto">
    null;

  const yardsInput = document.getElementById("yards");
  const generateBtn = document.getElementById("generateBtn");
  const pressToSee = document.getElementById("pressToSee");

  // Basic guards
  if (!fileInput) {
    console.warn("index.js: #targetPhoto not found");
    return;
  }

  // IMPORTANT: do NOT force camera capture.
  // If any old HTML had capture="environment", removing it in HTML is best,
  // but this also helps if it sneaks in.
  fileInput.removeAttribute("capture");

  // Make the big upload control open the picker
  if (uploadBtn) {
    uploadBtn.addEventListener("click", (e) => {
      // If it's a label, default is fine, but button needs this.
      e.preventDefault();
      fileInput.click();
    });
  }

  // Handle file selection + thumbnail preview
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    // Basic type safety
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please select an image file.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target && e.target.result ? String(e.target.result) : "";
      if (!dataUrl) return;

      // Show thumbnail
      if (thumb) {
        thumb.src = dataUrl;
        thumb.style.display = "block";
      }
      if (thumbText) {
        thumbText.textContent = "Photo loaded. Press PRESS TO SEE.";
      }

      // Save to localStorage so output.html can read it
      try {
        localStorage.setItem("sczn3_target_image", dataUrl);
        localStorage.setItem(
          "sczn3_yards",
          yardsInput ? String(yardsInput.value || "100") : "100"
        );
        localStorage.setItem("sczn3_file_name", file.name || "target.jpg");
      } catch (err) {
        console.warn("localStorage write failed:", err);
      }

      // Enable generate if present
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.style.opacity = "1";
        generateBtn.style.pointerEvents = "auto";
      }
    };

    reader.readAsDataURL(file);
  });

  // Keep yards synced in storage
  if (yardsInput) {
    yardsInput.addEventListener("input", () => {
      try {
        localStorage.setItem("sczn3_yards", String(yardsInput.value || "100"));
      } catch (_) {}
    });
  }

  // GENERATE behavior:
  // - If you have a backend endpoint, we try it.
  // - Regardless, we send you to output.html (where we’ll render from localStorage next).
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        alert("Pick a target photo first.");
        return;
      }

      const yards = yardsInput ? Number(yardsInput.value || 100) : 100;

      // Optional backend call (safe if your backend is not ready)
      // If you DO have an endpoint, set window.SCZN3_API_BASE in HTML (optional),
      // or it will try same-origin "/api/analyze".
      const API_BASE = window.SCZN3_API_BASE || "";
      const analyzeUrl = `${API_BASE}/api/analyze`;

      try {
        const form = new FormData();
        form.append("targetPhoto", file);
        form.append("yards", String(yards));

        const res = await fetch(analyzeUrl, {
          method: "POST",
          body: form,
        });

        if (res.ok) {
          const data = await res.json();
          // Save result so output.html can show scores/clicks
          localStorage.setItem("sczn3_result", JSON.stringify(data));
        } else {
          // Not fatal — output page can still show the photo
          console.warn("Analyze failed:", res.status);
        }
      } catch (err) {
        // Not fatal
        console.warn("Analyze request skipped/failed:", err);
      }

      // Go to output page
      if (pressToSee && pressToSee.getAttribute("href")) {
        window.location.href = pressToSee.getAttribute("href");
      } else {
        window.location.href = "./output.html";
      }
    });
  }

  // PRESS TO SEE should always work (even if generate not clicked yet)
  if (pressToSee) {
    pressToSee.addEventListener("click", (e) => {
      // If no photo selected, still allow navigation, but warn
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        // let it navigate anyway
        return;
      }
    });
  }
})();
