/* output.js
   Output page logic:
   - reads the fields stored by index.js / backend
   - displays the thumbnail from sessionStorage
   - back button returns to index.html
   - vendor button opens vendor url
*/

(() => {
  const secIdEl = document.getElementById("secId");
  const lastScoreEl = document.getElementById("lastScore");
  const avgScoreEl = document.getElementById("avgScore");
  const windLineEl = document.getElementById("windLine");
  const elevLineEl = document.getElementById("elevLine");
  const tipsBoxEl = document.getElementById("tipsBox");
  const thumbEl = document.getElementById("thumb");
  const backBtn = document.getElementById("backBtn");
  const vendorBtn = document.getElementById("vendorBtn");

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt || "";
  }

  function get(key, fallback = "") {
    const v = sessionStorage.getItem(key);
    return v == null ? fallback : v;
  }

  // Fill text fields
  setText(secIdEl, get("sczn3_secId", "SEC-ID 000"));
  setText(lastScoreEl, get("sczn3_lastScore", ""));
  setText(avgScoreEl, get("sczn3_avgScore", ""));
  setText(windLineEl, get("sczn3_windLine", ""));
  setText(elevLineEl, get("sczn3_elevLine", ""));
  setText(tipsBoxEl, get("sczn3_tips", ""));

  // Thumbnail
  const thumb = get("sczn3_thumb", "");
  if (thumbEl) {
    if (thumb) {
      thumbEl.src = thumb;
    } else {
      // Keep placeholder text visible if your CSS uses alt text area
      thumbEl.removeAttribute("src");
    }
  }

  // Buttons
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  if (vendorBtn) {
    vendorBtn.addEventListener("click", () => {
      const url = get("sczn3_vendorUrl", "#");
      if (!url || url === "#") return;
      window.open(url, "_blank", "noopener");
    });
  }
})();
