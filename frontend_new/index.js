// index.js
(function () {
  const fileInput = document.getElementById("file");
  const topUploadBtn = document.getElementById("topUploadBtn");
  const seeBtn = document.getElementById("seeBtn");
  const yardsInput = document.getElementById("yards");
  const statusEl = document.getElementById("status");

  const thumbPreview = document.getElementById("thumbPreview");
  const thumbHint = document.getElementById("thumbHint");

  let selectedFile = null;

  // Top button triggers file picker
  topUploadBtn.addEventListener("click", () => fileInput.click());

  // When file chosen, show thumbnail + store it (so output page can show it too)
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    selectedFile = f;

    const url = URL.createObjectURL(f);
    thumbPreview.src = url;
    thumbPreview.style.display = "block";
    thumbHint.style.display = "none";

    // Also store a smaller-ish dataURL for output page
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem("sec_last_thumb", reader.result);
      } catch (e) {
        // if storage full, just skip
      }
    };
    reader.readAsDataURL(f);

    statusEl.textContent = "Photo selected.";
  });

  // Press to see -> call backend -> store results -> go to output
  seeBtn.addEventListener("click", async () => {
    if (!selectedFile) {
      statusEl.textContent = "Pick a photo first.";
      return;
    }

    const yards = Number(yardsInput.value || 100);
    statusEl.textContent = "Analyzing…";

    try {
      const fd = new FormData();
      fd.append("image", selectedFile);
      fd.append("yards", String(yards));

      const res = await fetch(window.SEC_API.analyzeUrl, {
        method: "POST",
        body: fd
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Analyze failed (${res.status}). ${t}`);
      }

      const data = await res.json();

      // Store for output page to render
      localStorage.setItem("sec_last_result", JSON.stringify(data));
      localStorage.setItem("sec_last_yards", String(yards));

      // Go output
      window.location.href = "./output.html";
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || "Analyze failed.";
    }
  });
})();
