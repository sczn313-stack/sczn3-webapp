// frontend_new/output.js
// Read payload from sessionStorage -> fill output.html placeholders

document.addEventListener("DOMContentLoaded", () => {
  const raw = sessionStorage.getItem("sczn3_sec_payload");

  if (!raw) {
    console.warn("No payload found in sessionStorage. Redirecting to index.html");
    window.location.href = "./index.html";
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Bad payload JSON:", err);
    window.location.href = "./index.html";
    return;
  }

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  };

  setText("secId", data.secId);
  setText("lastScore", data.lastScore);
  setText("avgScore", data.avgScore);
  setText("windLine", data.windLine);
  setText("elevLine", data.elevLine);
  setText("tipsBox", data.tips);

  const thumb = document.getElementById("thumb");
  if (thumb) {
    thumb.src = data.thumbDataUrl || "";
    if (!data.thumbDataUrl) thumb.alt = "NO THUMBNAIL";
  }

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  const vendorBtn = document.getElementById("vendorBtn");
  if (vendorBtn) {
    vendorBtn.addEventListener("click", () => {
      const url = data.vendorUrl || "https://example.com";
      window.open(url, "_blank");
    });
  }
});
