// frontend_new/index.js

(() => {
  const fileInput = document.getElementById("targetPhoto");
  const uploadBtn = document.getElementById("uploadBtn");
  const thumb = document.getElementById("thumb");
  const thumbText = document.getElementById("thumbText");
  const yardsInput = document.getElementById("yards");
  const generateBtn = document.getElementById("generateBtn");
  const pressToSee = document.getElementById("pressToSee");

  if (!fileInput || !uploadBtn || !thumb || !yardsInput || !generateBtn || !pressToSee) {
    console.error("Missing required elements. Check index.html IDs.");
    return;
  }

  // Start state
  generateBtn.disabled = true;

  // Helper: store/retrieve
  const save = (key, val) => localStorage.setItem(key, val);
  const load = (key) => localStorage.getItem(key);

  // Restore yards if present
  const savedYards = load("sczn3_yards");
  if (savedYards) yardsInput.value = savedYards;

  // Clicking the big "UPLOAD..." button triggers the hidden file input
  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // When a file is selected, show thumbnail + enable Generate
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    // Optional: basic guard
    if (!file.type || !file.type.startsWith("image/")) {
      alert("Please select an image file.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target && e.target.result ? e.target.result : "";
      if (!dataUrl) return;

      // Show thumbnail
      thumb.src = dataUrl;
      thumb.style.display = "block";
      if (thumbText) thumbText.style.display = "none";

      // Save image for output page
      save("sczn3_target_image", dataUrl);

      // Enable generate
      generateBtn.disabled = false;
    };

    reader.readAsDataURL(file);
  });

  // Save yards live
  yardsInput.addEventListener("input", () => {
    const yards = String(yardsInput.value || "100").trim();
    save("sczn3_yards", yards);
  });

  // Generate: lock in yards + go to output
  generateBtn.addEventListener("click", () => {
    const yards = String(yardsInput.value || "100").trim();
    save("sczn3_yards", yards);

    const img = load("sczn3_target_image");
    if (!img) {
      alert("Upload a target photo first.");
      return;
    }

    // (Optional) set a simple SEC id for display later
    if (!load("sczn3_sec_id")) {
      const secId = String(Math.floor(100 + Math.random() * 900)); // 3-digit quick id
      save("sczn3_sec_id", secId);
    }

    // Go to output page
    window.location.href = "./output.html";
  });

  // "PRESS TO SEE" should NOT go anywhere until you have an image
  pressToSee.addEventListener("click", (e) => {
    const img = load("sczn3_target_image");
    if (!img) {
      e.preventDefault();
      alert("Upload a target photo first.");
      return;
    }
  });
})();
