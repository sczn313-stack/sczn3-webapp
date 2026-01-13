// output.js (SEC output page)
// Reads localStorage key: sczn3_sec_payload
// Increments SEC counter: sczn3_sec_counter
// Fills fields by id: secId, lastScore, avgScore, windLine, elevLine, thumb, tipsBox
// Wires buttons: backBtn, vendorBtn

(function () {
  const secIdEl = document.getElementById("secId");
  const lastScoreEl = document.getElementById("lastScore");
  const avgScoreEl = document.getElementById("avgScore");
  const windLineEl = document.getElementById("windLine");
  const elevLineEl = document.getElementById("elevLine");
  const thumbEl = document.getElementById("thumb");
  const tipsBoxEl = document.getElementById("tipsBox");

  const backBtn = document.getElementById("backBtn");
  const vendorBtn = document.getElementById("vendorBtn");

  function pad3(n) {
    const s = String(n);
    return s.length === 1 ? "00" + s : s.length === 2 ? "0" + s : s;
  }

  // Increment SEC-ID
  const counterKey = "sczn3_sec_counter";
  const prev = Number(localStorage.getItem(counterKey) || "0");
  const next = prev + 1;
  localStorage.setItem(counterKey, String(next));

  if (secIdEl) {
    secIdEl.textContent = `SEC-ID ${pad3(next)}`;
  }

  // Load payload
  let payload = null;
  try {
    const raw = localStorage.getItem("sczn3_sec_payload");
    payload = raw ? JSON.parse(raw) : null;
  } catch (e) {
    payload = null;
  }

  // Populate fields
  if (payload) {
    if (lastScoreEl) lastScoreEl.textContent = payload.lastScore || "";
    if (avgScoreEl) avgScoreEl.textContent = payload.avgScore || "";
    if (windLineEl) windLineEl.textContent = payload.windLine || "";
    if (elevLineEl) elevLineEl.textContent = payload.elevLine || "";
    if (tipsBoxEl) tipsBoxEl.textContent = payload.tips || "";

    if (thumbEl) {
      thumbEl.src = payload.thumbDataUrl || "";
      thumbEl.alt = "TARGET THUMBNAIL";
    }
  } else {
    if (tipsBoxEl) tipsBoxEl.textContent = "No data found. Go back and upload a target photo.";
  }

  // Buttons
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  if (vendorBtn) {
    vendorBtn.addEventListener("click", () => {
      window.open("https://example.com", "_blank", "noopener");
    });
  }
})();
