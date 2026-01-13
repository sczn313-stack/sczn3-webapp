// sczn3-webapp/frontend_new/output.js
// Output page logic:
// - Show stored image preview
// - Show stored distance
// - (Optional) Try to call backend for score/clicks if endpoint exists

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  const img = $("targetPreview");
  const noPreview = $("noPreview");
  const distanceOut = $("distanceOut");
  const scoreOut = $("scoreOut");
  const scopeOut = $("scopeOut");
  const clicksOut = $("clicksOut");
  const tipOut = $("tipOut");
  const statusOut = $("statusOut");
  const buyMoreBtn = $("buyMoreBtn");

  const dataUrl = sessionStorage.getItem("sczn3_targetPhoto_dataUrl");
  const distance = sessionStorage.getItem("sczn3_distance_yards") || "100";

  if (distanceOut) distanceOut.textContent = distance;

  if (dataUrl && img) {
    img.src = dataUrl;
    img.style.display = "block";
    if (noPreview) noPreview.style.display = "none";
  } else {
    if (statusOut) statusOut.textContent = "No uploaded photo found. Go back and upload one.";
    return;
  }

  // Default placeholders
  if (scoreOut) scoreOut.textContent = "Pending";
  if (scopeOut) scopeOut.textContent = "Pending";
  if (clicksOut) clicksOut.textContent = "Pending";
  if (tipOut) tipOut.textContent = "Pending";
  if (statusOut) statusOut.textContent = "Preview OK. Waiting on backend scoring.";

  // Optional vendor link
  const buyUrl = sessionStorage.getItem("sczn3_vendor_buy_url");
  if (buyMoreBtn && buyUrl) buyMoreBtn.href = buyUrl;

  function dataUrlToBlob(url) {
    const parts = url.split(",");
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  async function tryPost(url) {
    const blob = dataUrlToBlob(dataUrl);
    const fd = new FormData();
    fd.append("targetPhoto", blob, "target.jpg");
    fd.append("distanceYards", distance);

    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  (async function () {
    const endpoints = ["/analyze", "/api/analyze", "/sec/analyze"];

    for (const ep of endpoints) {
      try {
        if (statusOut) statusOut.textContent = "Scoring... (" + ep + ")";
        const data = await tryPost(ep);

        if (scoreOut) scoreOut.textContent = data.score ?? data.smartScore ?? "—";
        if (scopeOut) scopeOut.textContent = data.scope ?? data.scopeModel ?? "—";
        if (clicksOut) clicksOut.textContent = data.clicks ?? data.corrections ?? "—";
        if (tipOut) tipOut.textContent = data.tip ?? data.message ?? "—";

        if (statusOut) statusOut.textContent = "Scoring complete.";
        return;
      } catch (err) {
        // try next endpoint
      }
    }

    if (statusOut) {
      statusOut.textContent =
        "Preview OK. Backend scoring endpoint not detected yet (static site is fine).";
    }
  })();
})();
