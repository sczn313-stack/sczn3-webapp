let selectedFile = null;

const fileInput = document.getElementById("file");
const thumbImg = document.getElementById("thumbPreview");
const seeBtn = document.getElementById("seeBtn");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  selectedFile = f;

  if (!f) {
    if (thumbImg) thumbImg.removeAttribute("src");
    seeBtn.disabled = true;
    setStatus("Pick a photo first.");
    return;
  }

  // Thumbnail preview
  if (thumbImg) {
    const url = URL.createObjectURL(f);
    thumbImg.src = url;

    // Optional: release old objectURL after load
    thumbImg.onload = () => URL.revokeObjectURL(url);
  }

  seeBtn.disabled = false;
  setStatus("");
});

// If you already have upload logic, plug it here.
// This is a safe placeholder that won’t break your existing code.
seeBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    setStatus("Pick a photo first.");
    return;
  }

  // Keep your existing submit/upload call here.
  // Example pattern:
  // const yards = document.getElementById("yards").value || "100";
  // await window.ScznApi.uploadAndProcess(selectedFile, yards);
  // window.location.href = "./output.html";

  setStatus("Ready (wire your existing upload call here).");
});
