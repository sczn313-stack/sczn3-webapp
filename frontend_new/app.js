// frontend_new/app.js
// Two-page SEC:
//   - index.html (Upload SEC)
//   - output.html (Output SEC)
//
// Pilot scoring: Offset-only (backend returns `score`)
// Stores last/avg in localStorage (no login)

(function () {
  const el = (id) => document.getElementById(id);

  const STORAGE_KEY = "SEC_LAST_RESULT_V1";
  const SCORE_HISTORY_KEY = "SEC_SCORE_HISTORY_V1";

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const f2 = (v) => (Math.round(num(v) * 100) / 100).toFixed(2);

  function cleanDir(s) {
    return String(s || "").trim().toUpperCase();
  }

  // dx: +RIGHT / -LEFT
  // dy: +UP / -DOWN
  function dirFromSign(axis, value) {
    const v = num(value);
    if (v === 0) return "";
    if (axis === "x") return v > 0 ? "RIGHT" : "LEFT";
    return v > 0 ? "UP" : "DOWN";
  }

  function extractDxDyAndDirs(apiData) {
    const dx =
      apiData?.correction_in?.dx ??
      apiData?.correctionIn?.dx ??
      apiData?.correction_inches?.dx ??
      apiData?.correction?.dx ??
      apiData?.delta_in?.dx ??
      apiData?.dx ??
      0;

    const dy =
      apiData?.correction_in?.dy ??
      apiData?.correctionIn?.dy ??
      apiData?.correction_inches?.dy ??
      apiData?.correction?.dy ??
      apiData?.delta_in?.dy ??
      apiData?.dy ??
      0;

    const windDir =
      apiData?.directions?.windage ??
      apiData?.direction?.windage ??
      apiData?.windage_direction ??
      apiData?.windDir ??
      apiData?.windageDir ??
      "";

    const elevDir =
      apiData?.directions?.elevation ??
      apiData?.direction?.elevation ??
      apiData?.elevation_direction ??
      apiData?.elevDir ??
      apiData?.elevationDir ??
      "";

    return {
      dx: num(dx),
      dy: num(dy),
      windDir: cleanDir(windDir),
      elevDir: cleanDir(elevDir),
    };
  }

  // Pilot score returned by backend
  function extractScore(apiData) {
    const s =
      apiData?.score ??
      apiData?.smart_score ??
      apiData?.smartScore ??
      apiData?.result?.score ??
      null;

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function getHistory() {
    try {
      const raw = localStorage.getItem(SCORE_HISTORY_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function setHistory(arr) {
    try {
      localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(arr));
    } catch {}
  }

  function pushScore(scoreNum) {
    const hist = getHistory();
    hist.push({ t: Date.now(), score: scoreNum });

    while (hist.length > 50) hist.shift();

    setHistory(hist);
    return hist;
  }

  function avgScore(hist) {
    if (!hist.length) return null;
    let sum = 0;
    let cnt = 0;
    for (const it of hist) {
      const s = Number(it?.score);
      if (Number.isFinite(s)) {
        sum += s;
        cnt++;
      }
    }
    if (!cnt) return null;
    return sum / cnt;
  }

  function setStatus(statusEl, msg, isErr) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("err", !!isErr);
  }

  // SEC Identifier
  function makeSecId() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SEC-${yy}${mm}${dd}-${hh}${mi}-${rand}`;
  }

  /* =========================
     PAGE: UPLOAD (index.html)
     ========================= */
  async function initUploadPage() {
    const fileEl = el("file");
    const yardsEl = el("yards");
    const pressBtn = el("pressBtn");
    const thumb = el("thumb");
    const status = el("status");

    const barTop = document.querySelector(".barTop");
    const thumbWrap = document.querySelector(".thumbWrap");

    if (!fileEl || !pressBtn || !yardsEl) return;

    // Click-to-upload zones
    if (barTop) {
      barTop.style.cursor = "pointer";
      barTop.addEventListener("click", () => fileEl.click());
    }
    if (thumbWrap) {
      thumbWrap.style.cursor = "pointer";
      thumbWrap.addEventListener("click", () => fileEl.click());
    }

    fileEl.addEventListener("change", () => {
      const f = fileEl.files && fileEl.files[0];
      if (f) {
        thumb.src = URL.createObjectURL(f);
        setStatus(status, "", false);
      }
    });

    pressBtn.addEventListener("click", async () => {
      try {
        setStatus(status, "", false);

        const f = fileEl.files && fileEl.files[0];
        if (!f) {
          setStatus(status, "Pick a photo first.", true);
          fileEl.click();
          return;
        }

        const yards = Number(yardsEl.value) || 100;

        pressBtn.disabled = true;

        // Analyze
        const apiData = await window.postAnalyze(f, yards);

        const secId = makeSecId();
        const objectUrl = thumb?.src || URL.createObjectURL(f);

        const payload = {
          sec_id: secId,
          yards,
          objectUrl,
          apiData,
        };

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.location.href = "./output.html";
      } catch (e) {
        setStatus(status, e?.message || String(e), true);
      } finally {
        pressBtn.disabled = false;
      }
    });
  }

  /* =========================
     PAGE: OUTPUT (output.html)
     ========================= */
  function initOutputPage() {
    const secIdEl = el("secId");
    const windDirEl = el("windDir");
    const elevDirEl = el("elevDir");
    const thumb = el("thumb");
    const status = el("status");
    const doAnother = el("doAnother");

    const scoreBig = el("scoreBig");
    const lastScoreVal = el("lastScoreVal");
    const avgScoreVal = el("avgScoreVal");

    let payload = null;
    try {
      payload = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      payload = null;
    }

    if (!payload) {
      setStatus(status, "No SEC data found. Start over.", true);
      if (doAnother) doAnother.addEventListener("click", () => (window.location.href = "./index.html"));
      return;
    }

    const { sec_id, yards, objectUrl, apiData } = payload;

    if (secIdEl) secIdEl.textContent = sec_id || "SEC-0000";
    if (thumb && objectUrl) thumb.src = objectUrl;

    // clicks
    const { dx, dy, windDir, elevDir } = extractDxDyAndDirs(apiData);

    const windClicks = window.clicksFromInches(Math.abs(dx), yards);
    const elevClicks = window.clicksFromInches(Math.abs(dy), yards);

    const finalWindDir = windDir || dirFromSign("x", dx);
    const finalElevDir = elevDir || dirFromSign("y", dy);

    if (windDirEl) windDirEl.textContent = `${f2(windClicks)} ${finalWindDir}`.trim();
    if (elevDirEl) elevDirEl.textContent = `${f2(elevClicks)} ${finalElevDir}`.trim();

    // scoring (pilot offset-only)
    const currentScore = extractScore(apiData);

    // last score is the previous score before pushing this one
    const histBefore = getHistory();
    const prevItem = histBefore.length ? histBefore[histBefore.length - 1] : null;
    const prevScore = prevItem && Number.isFinite(Number(prevItem.score)) ? Number(prevItem.score) : null;

    if (lastScoreVal) lastScoreVal.textContent = prevScore == null ? "—" : f2(prevScore);

    if (currentScore != null) {
      if (scoreBig) scoreBig.textContent = f2(currentScore);

      const histAfter = pushScore(currentScore);
      const a = avgScore(histAfter);
      if (avgScoreVal) avgScoreVal.textContent = a == null ? "—" : f2(a);
    } else {
      if (scoreBig) scoreBig.textContent = "—";
      if (avgScoreVal) avgScoreVal.textContent = "—";
    }

    if (doAnother) {
      doAnother.addEventListener("click", () => {
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = "./index.html";
      });
    }

    setStatus(status, "", false);
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".stage-upload")) initUploadPage();
    if (document.querySelector(".stage-output")) initOutputPage();
  });
})();
