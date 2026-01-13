// frontend_new/index.js
// Upload photo -> save payload in sessionStorage -> redirect to output.html

function nextSecId() {
  const key = "sczn3_sec_id_counter";
  const current = Number(sessionStorage.getItem(key) || "0") + 1;
  sessionStorage.setItem(key, String(current));
  return String(current).padStart(3, "0"); // "001", "002", ...
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // REQUIRED in index.html:
  // <button id="uploadBtn" type="button">UPLOAD TARGET PHOTO or TAKE PICTURE</button>
  // <input id="fileInput" type="file" accept="image/*" style="display:none;" />

  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");

  // OPTIONAL in index.html (only if you have it):
  // <input id="distanceInput" ... />
  const distanceInput = document.getElementById("distanceInput");

  if (!uploadBtn || !fileInput) {
    console.warn("Missing #uploadBtn or #fileInput in index.html");
    return;
  }

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const thumbDataUrl = await readFileAsDataURL(file);
      const distanceYards = distanceInput ? Number(distanceInput.value || 100) : 100;

      const secIdNum = nextSecId();

      // TEMP placeholders for Step 2 verification
      const payload = {
        secId: `SEC-ID ${secIdNum}`,
        distanceYards,
        lastScore: "Last Score: (pending)",
        avgScore: "Avg Score: (pending)",
        windLine: "Windage: (pending)",
        elevLine: "Elevation: (pending)",
        tips: "Tip: (pending)",
        vendorUrl: "https://example.com",
        thumbDataUrl
      };

      sessionStorage.setItem("sczn3_sec_payload", JSON.stringify(payload));
      window.location.href = "./output.html";
    } catch (err) {
      console.error("Upload flow error:", err);
      alert("Upload failed. Try again.");
    }
  });
});
