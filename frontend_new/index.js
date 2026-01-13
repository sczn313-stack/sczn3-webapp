// index.js (SEC upload page)
// Uses IDs from your index.html:
// file, seeBtn, yards, status, vendorBtn
// Writes payload to localStorage under: sczn3_sec_payload
// Then navigates to output.html

(function () {
  const fileInput = document.getElementById("file");
  const seeBtn = document.getElementById("seeBtn");
  const yardsInput = document.getElementById("yards");
  const statusEl = document.getElementById("status");
  const vendorBtn = document.getElementById("vendorBtn");

  // Set vendor link (placeholder for now)
  if (vendorBtn) {
    vendorBtn.href = "https://example.com";
    vendorBtn.target = "_blank";
    vendorBtn.rel = "noopener";
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Could not read image"));
      r.readAsDataURL(file);
    });
  }

  async function handleSee() {
    try {
      setStatus("");

      const file = fileInput?.files?.[0];
      if (!file) {
        setStatus("Please choose a target photo first.");
        return;
      }

      const yardsRaw = yardsInput ? Number(yardsInput.value) : 100;
      const yards = Number.isFinite(yardsRaw) && yardsRaw > 0 ? yardsRaw : 100;

      setStatus("Loading image...");

      const dataUrl = await fileToDataURL(file);

      // Minimal payload for Output page to render thumbnail + distance
      const payload = {
        createdAt: new Date().toISOString(),
        yards,
        thumbDataUrl: dataUrl,

        // placeholders for now (backend will fill later)
        lastScore: "",
        avgScore: "",
        windLine: "",
        elevLine: "",
        tips: ""
      };

      localStorage.setItem("sczn3_sec_payload", JSON.stringify(payload));

      // go to output page
      window.location.href = "./output.html";
    } catch (err) {
      console.error(err);
      setStatus("Error. Try again.");
    }
  }

  if (seeBtn) {
    seeBtn.addEventListener("click", handleSee);
  }

  // Nice UX: if they pick a file, clear status
  if (fileInput) {
    fileInput.addEventListener("change", () => setStatus(""));
  }
})();
