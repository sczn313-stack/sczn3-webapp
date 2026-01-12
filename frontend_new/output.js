// frontend_new/output.js

(function () {
  const el = (id) => document.getElementById(id);

  const secIdEl = el("secId");
  const windageDirEl = el("windageDir");
  const elevDirEl = el("elevDir");
  const thumbEl = el("thumb");

  const windageText = el("windageText");
  const elevText = el("elevText");

  const scoreLast = el("scoreLast");
  const scoreAvg = el("scoreAvg");

  const vendorBtnOut = el("vendorBtnOut");
  const status = el("status");

  function setStatus(msg) {
    status.textContent = msg || "";
  }

  function two(n) {
    return Number(n || 0).toFixed(2);
  }

  function clampText(s) {
    return String(s || "").trim().toUpperCase();
  }

  function loadHistoryScores() {
    const key = "SEC_SCORE_HISTORY";
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistoryScore(val) {
    const key = "SEC_SCORE_HISTORY";
    const arr = loadHistoryScores();
    arr.push(Number(val) || 0);
    // keep last 50
    while (arr.length > 50) arr.shift();
    localStorage.setItem(key, JSON.stringify(arr));
    return arr;
  }

  function average(arr) {
    if (!arr.length) return 0;
    const s = arr.reduce((a, b) => a + (Number(b) || 0), 0);
    return s / arr.length;
  }

  // render
  try {
    const raw = sessionStorage.getItem("SEC_PAYLOAD");
    if (!raw) {
      setStatus("No SEC data found.");
      return;
    }

    const p = JSON.parse(raw);

    // SEC-ID
    secIdEl.textContent = `SEC-ID ${String(p.secId || "000")}`;

    // Directions in the SCOPE CLICKS box
    windageDirEl.textContent = clampText(p.windDir || "LEFT");
    elevDirEl.textContent = clampText(p.elevDir || "UP");

    // Thumbnail
    if (p.thumbDataUrl) {
      thumbEl.src = p.thumbDataUrl;
    }

    // Store numeric outputs (hidden for now, used later if you want)
    windageText.textContent = `${two(p.windClicks)} clicks ${clampText(p.windDir)}`.trim();
    elevText.textContent = `${two(p.elevClicks)} clicks ${clampText(p.elevDir)}`.trim();

    // Score history (last score + avg score)
    const scoreVal = Number(p.score) || 0;
    const history = saveHistoryScore(scoreVal);
    const avg = average(history);

    scoreLast.textContent = two(scoreVal);
    scoreAvg.textContent = two(avg);

    // Vendor link placeholders
    vendorBtnOut.href = p.vendorUrl || "#";
    vendorBtnOut.addEventListener("click", (e) => {
      if ((p.vendorUrl || "#") === "#") e.preventDefault();
    });

    setStatus("");
  } catch (err) {
    setStatus(String(err && err.message ? err.message : err));
  }
})();
