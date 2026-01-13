// frontend_new/index.js
// Wires the "UPLOAD TARGET PHOTO or TAKE PICTURE" button/label to the hidden file input,
// shows the thumbnail preview, and persists the chosen image so it can be reused after navigation.

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("targetPhoto");
  const thumb = document.getElementById("thumb");

  // Your upload control might be a <button id="uploadBtn"> OR a <label for="targetPhoto">
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadLabel = document.querySelector('label[for="targetPhoto"]');

  // Sometimes iOS gets forced into camera mode if capture is present.
  // Make sure it's NOT set.
  if (fileInput) {
    fileInput.removeAttribute("capture");
  }

  // Helper: show preview
  function showPreview(dataUrl) {
    if (!thumb) return;
    thumb.src = dataUrl;
    thumb.style.display = "block";
  }

  // Helper: persist preview so it survives refresh / "PRESS TO SEE"
  const LS_KEY = "sczn3_target_thumb_dataurl";
  function savePreview(dataUrl) {
    try {
      localStorage.setItem(LS_KEY, dataUrl);
    } catch (_) {}
  }
  function loadPreview() {
    try {
      return localStorage.getItem(LS_KEY);
    } catch (_) {
      return null;
    }
  }

  // Restore preview if we already have one
  const existing = loadPreview();
  if (existing) showPreview(existing);

  // Clicking the visible upload button should open the real file picker
  function openPicker() {
    if (!fileInput) return;
    // Some browsers require this to be directly in a user gesture; this is (button click).
    fileInput.click();
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openPicker();
    });
  }

  // If you’re using a label instead, clicking it already opens the picker.
  // But some CSS/overlays can block it; this keeps it reliable.
  if (uploadLabel) {
    uploadLabel.addEventListener("click", () => {
      // Let the label do its default behavior, but if it’s blocked, this still helps.
      // (No preventDefault here.)
      if (fileInput && fileInput.disabled !== true) {
        // Small delay helps on iOS Safari sometimes
        setTimeout(() => {
          // If nothing happened, force it
          // (If it already opened, this is harmless)
          try { fileInput.click(); } catch (_) {}
        }, 50);
      }
    });
  }

  // When a file is selected, preview it
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      // Only images
      if (!file.type || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target && e.target.result;
        if (!dataUrl) return;

        showPreview(dataUrl);
        savePreview(dataUrl);

        // Optional: tiny status line if you have an element for it
        const status = document.getElementById("photoStatus");
        if (status) status.textContent = "Photo loaded.";
      };
      reader.readAsDataURL(file);
    });
  }

  // If you have duplicate upload controls on an output page,
  // this makes ANY element with class "goUpload" take you back to the upload area.
  document.querySelectorAll(".goUpload").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      // If your output page is a separate route/page, set this to your real upload page path:
      // window.location.href = "/";
      // If it's same page with sections, just scroll to top:
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
});
