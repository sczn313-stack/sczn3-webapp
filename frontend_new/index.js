// index.js
const els = {
  uploadHeaderBtn: document.getElementById("uploadHeaderBtn"),
  file: document.getElementById("file"),
  yards: document.getElementById("yards"),
  thumbPreview: document.getElementById("thumbPreview"),
  thumbEmpty: document.getElementById("thumbEmpty"),
  seeBtn: document.getElementById("seeBtn"),
  status: document.getElementById("status"),
  vendorBtn: document.getElementById("vendorBtn"),
};

let selectedFile = null;
let selectedThumbDataUrl = null;

// Example vendor link (replace later from config or response)
els.vendorBtn.href = "https://example.com";

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function showThumb(dataUrl) {
  if (!dataUrl) {
    els.thumbPreview.style.display = "none";
    els.thumbEmpty.style.display = "flex";
    return;
  }
  els.thumbPreview.src = dataUrl;
  els.thumbPreview.style.display = "block";
  els.thumbEmpty.style.display = "none";
}

function enableSee(enabled) {
  els.seeBtn.disabled = !enabled;
}

// Clicking the header button opens the picker
els.uploadHeaderBtn.addEventListener("click", () => {
  els.file.click();
});

// When file chosen, show thumbnail + enable Press to see
els.file.addEventListener("change", async () => {
  const file = els.file.files && els.file.files[0];
  selectedFile = file || null;

  if (!selectedFile) {
    selectedThumbDataUrl = null;
    showThumb(null);
    enableSee(false);
    setStatus("");
    return;
  }

  // Create a local preview
  const reader = new FileReader();
  reader.onload = () => {
    selectedThumbDataUrl = String(reader.result || "");
    showThumb(selectedThumbDataUrl);
    enableSee(true);
    setStatus("Photo selected. Press to see.");
  };
  reader.readAsDataURL(selectedFile);
});

// Press to see -> call backend -> store results -> go output
els.seeBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    setStatus("Pick a photo first.");
    return;
  }

  try {
    setStatus("Analyzing…");
    enableSee(false);

    const yards = Number(els.yards.value || 100);

    const result = await postAnalyzeTarget({ file: selectedFile, yards });

    // Store everything output page needs
    const payload = {
      ts: Date.now(),
      yards,
      thumbDataUrl: selectedThumbDataUrl, // local thumbnail preview
      result, // backend JSON
    };

    localStorage.setItem("SEC_LAST_RESULT", JSON.stringify(payload));

    // Go to output page
    window.location.href = "./output.html";
  } catch (err) {
    setStatus(`Error: ${err.message || err}`);
    enableSee(true);
  }
});

// Initial state
showThumb(null);
enableSee(false);
setStatus("");
