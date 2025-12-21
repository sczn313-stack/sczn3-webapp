import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — Frontend (App.jsx)

  Fixes included:
  - iOS file picker shows choices (no capture attribute).
  - Button/label text: "Take or Upload Target Photo"
  - Fail-closed message on 422 (no holes)
  - Very robust click-extraction from backend JSON (handles many payload shapes)
  - Arrow directions inverted (per your current direction issue)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

// ---------- helpers ----------

function extractFirstNumberFromString(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return extractFirstNumberFromString(v);
  return null;
}

function pad3(n) {
  const s = String(n);
  if (s.length >= 3) return s;
  return "0".repeat(3 - s.length) + s;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = Number.isFinite(cur) ? cur + 1 : 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return pad3(nxt);
}

// Invert BOTH axes for direction (because you said both were wrong)
function arrowForWindage(clicks) {
  if (clicks === 0) return "→";
  return clicks > 0 ? "←" : "→";
}

function arrowForElevation(clicks) {
  if (clicks === 0) return "↑";
  return clicks > 0 ? "↓" : "↑";
}

function abs2(v) {
  const n = toNum(v);
  if (n === null) return "0.00";
  return Math.abs(n).toFixed(2);
}

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

// Collect every numeric-ish value in a JSON tree along with its "path"
function collectNumericCandidates(root) {
  const out = [];

  const walk = (node, path) => {
    const n = toNum(node);
    if (n !== null) out.push({ path, value: n });

    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (isPlainObject(node)) {
      Object.entries(node).forEach(([k, v]) => {
        walk(v, path ? `${path}.${k}` : k);
      });
    }
  };

  walk(root, "");
  return out;
}

// Quick direct-path getter: "a.b.c"
function getPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

// Best-effort extraction for windage/elevation clicks from many backend shapes.
function extractClicksFromBackend(data) {
  // 1) direct common keys (fast path)
  const directKeySets = {
    w: [
      "windageClicks",
      "windage_clicks",
      "windage_click",
      "windage",
      "wind",
      "w",
      "xClicks",
      "x_clicks",
      "x",
      "dxClicks",
      "dx",
      "horizontalClicks",
      "horizontal_clicks",
      "horizontal",
      "leftRightClicks",
      "lrClicks",
    ],
    e: [
      "elevationClicks",
      "elevation_clicks",
      "elevation_click",
      "elevation",
      "elev",
      "e",
      "yClicks",
      "y_clicks",
      "y",
      "dyClicks",
      "dy",
      "verticalClicks",
      "vertical_clicks",
      "vertical",
      "upDownClicks",
      "udClicks",
    ],
  };

  for (const k of directKeySets.w) {
    const n = toNum(getPath(data, k));
    if (n !== null) {
      for (const ke of directKeySets.e) {
        const ne = toNum(getPath(data, ke));
        if (ne !== null) return { windageClicks: n, elevationClicks: ne };
      }
    }
  }

  // 2) known nested layouts
  // clicks: { windage: X, elevation: Y }
  const clickObj = getPath(data, "clicks");
  if (isPlainObject(clickObj)) {
    const w =
      toNum(clickObj.windage) ??
      toNum(clickObj.w) ??
      toNum(clickObj.x) ??
      toNum(clickObj.horizontal);
    const e =
      toNum(clickObj.elevation) ??
      toNum(clickObj.e) ??
      toNum(clickObj.y) ??
      toNum(clickObj.vertical);
    if (w !== null && e !== null) return { windageClicks: w, elevationClicks: e };
  }

  // clicks: [w, e]
  if (Array.isArray(clickObj) && clickObj.length >= 2) {
    const w = toNum(clickObj[0]);
    const e = toNum(clickObj[1]);
    if (w !== null && e !== null) return { windageClicks: w, elevationClicks: e };
  }

  // adjustment / corrections objects (common naming)
  const adj = getPath(data, "adjustment") || getPath(data, "correction") || getPath(data, "corrections");
  if (isPlainObject(adj)) {
    const w =
      toNum(adj.windageClicks) ??
      toNum(adj.windage) ??
      toNum(adj.w) ??
      toNum(adj.x) ??
      toNum(adj.horizontal) ??
      toNum(adj.leftRight);
    const e =
      toNum(adj.elevationClicks) ??
      toNum(adj.elevation) ??
      toNum(adj.e) ??
      toNum(adj.y) ??
      toNum(adj.vertical) ??
      toNum(adj.upDown);
    if (w !== null && e !== null) return { windageClicks: w, elevationClicks: e };
  }

  // 3) scoring-based auto-detect by key path
  const candidates = collectNumericCandidates(data);

  const windRe = /(wind|winda|horizontal|left|right|lr|x)(click)?/i;
  const elevRe = /(elev|vertical|up|down|ud|y)(click)?/i;
  const clicksRe = /(click|clicks)/i;

  const score = (path, isWind) => {
    let s = 0;
    if (!path) return s;

    if (clicksRe.test(path)) s += 3;

    if (isWind) {
      if (windRe.test(path)) s += 6;
      if (elevRe.test(path)) s -= 2;
    } else {
      if (elevRe.test(path)) s += 6;
      if (windRe.test(path)) s -= 2;
    }

    // bonus if path ends with something meaningful
    if (/\.(windage|elevation|w|e|x|y)$/.test(path)) s += 2;

    return s;
  };

  let bestW = null;
  let bestE = null;

  for (const c of candidates) {
    const sw = score(c.path, true);
    if (!bestW || sw > bestW.s) bestW = { ...c, s: sw };

    const se = score(c.path, false);
    if (!bestE || se > bestE.s) bestE = { ...c, s: se };
  }

  // If we got decent scores, use them (avoid using same candidate twice if possible)
  if (bestW && bestE && (bestW.s >= 5 || bestE.s >= 5)) {
    if (bestW.path !== bestE.path) {
      return { windageClicks: bestW.value, elevationClicks: bestE.value };
    }
    // same path chosen for both; find next-best for elevation
    let secondE = null;
    for (const c of candidates) {
      if (c.path === bestW.path) continue;
      const se = score(c.path, false);
      if (!secondE || se > secondE.s) secondE = { ...c, s: se };
    }
    if (secondE && secondE.s >= 3) {
      return { windageClicks: bestW.value, elevationClicks: secondE.value };
    }
  }

  // 4) last resort: first two numbers found in the payload
  if (candidates.length >= 2) {
    return { windageClicks: candidates[0].value, elevationClicks: candidates[1].value };
  }

  return null;
}

// ---------- component ----------

export default function App() {
  const canvasRef = useRef(null);

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [rawBackend, setRawBackend] = useState(null);

  const [sec, setSec] = useState(null); // { windageClicks, elevationClicks, index }
  const [secPngUrl, setSecPngUrl] = useState("");

  const [showDebug, setShowDebug] = useState(false);

  const apiBase = useMemo(() => {
    const env =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        import.meta.env.VITE_API_BASE_URL) ||
      "";
    return (env || DEFAULT_API_BASE).replace(/\/+$/, "");
  }, []);

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");
  }

  async function onAnalyze() {
    if (!file || busy) return;

    setBusy(true);
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");

    try {
      const url = new URL(SEC_PATH, apiBase).toString();

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(url, { method: "POST", body: fd });

      if (!res.ok) {
        if (res.status === 422) {
          setNote(NO_SHOTS_MSG);
          return;
        }
        const txt = await res.text().catch(() => "");
        setError(`Backend error (${res.status}). ${txt || ""}`.trim());
        return;
      }

      const data = await res.json();
      setRawBackend(data);

      const extracted = extractClicksFromBackend(data);

      if (!extracted) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      setSec({
        windageClicks: extracted.windageClicks,
        elevationClicks: extracted.elevationClicks,
        index,
      });
    } catch (e) {
      setError(`Request failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!sec || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1000;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.font = "bold 64px Arial";
    ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 160);

    ctx.font = "bold 54px Arial";
    ctx.fillText("Windage", W / 2, 430);

    const wArrow = arrowForWindage(sec.windageClicks);
    const wVal = abs2(sec.windageClicks);

    ctx.font = "bold 140px Arial";
    ctx.fillText(`${wArrow} ${wVal}`, W / 2, 620);

    ctx.font = "bold 54px Arial";
    ctx.fillText("Elevation", W / 2, 920);

    const eArrow = arrowForElevation(sec.elevationClicks);
    const eVal = abs2(sec.elevationClicks);

    ctx.font = "bold 140px Arial";
    ctx.fillText(`${eArrow} ${eVal}`, W / 2, 1110);

    ctx.font = "italic 48px Arial";
    ctx.fillText(`Index: ${sec.index}`, W / 2, 1285);

    const png = canvas.toDataURL("image/png");
    setSecPngUrl(png);
  }, [sec]);

  function onDownload() {
    if (!secPngUrl) return;
    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${sec?.index || "000"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onShare() {
    if (!secPngUrl) return;
    try {
      if (!navigator.share) {
        setNote("Share not supported on this device/browser.");
        return;
      }
      const blob = await (await fetch(secPngUrl)).blob();
      const f = new File([blob], `SCZN3_SEC_${sec?.index || "000"}.png`, { type: "image/png" });

      await navigator.share({
        files: [f],
        title: "SCZN3 Shooter Experience Card (SEC)",
        text: "SCZN3 SEC",
      });
    } catch (e) {
      // user cancel is normal
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 8, fontWeight: 700 }}>Convention:</div>
        <select defaultValue="dialToCenter">
          <option value="dialToCenter">Dial to center (move impact to center)</option>
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label
          htmlFor="targetPhoto"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            border: "1px solid #888",
            borderRadius: 8,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          Take or Upload Target Photo
        </label>

        <input
          id="targetPhoto"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        <button
          onClick={onAnalyze}
          disabled={!file || busy}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button
          onClick={onDownload}
          disabled={!secPngUrl}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
          Download SEC (PNG)
        </button>

        <button
          onClick={onShare}
          disabled={!secPngUrl}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
          Share SEC
        </button>

        <div style={{ opacity: 0.7 }}>{file ? file.name : "No photo selected"}</div>
      </div>

      {error ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #c00", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div>{error}</div>
        </div>
      ) : null}

      {note ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #888", borderRadius: 8 }}>
          {note}
        </div>
      ) : null}

      {secPngUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Preview</div>
          <canvas
            ref={canvasRef}
            style={{
              width: "min(100%, 900px)",
              height: "auto",
              border: "1px solid #ddd",
              borderRadius: 12,
              display: "block",
            }}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <button
          onClick={() => setShowDebug((v) => !v)}
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {showDebug ? "Hide Debug" : "Debug"}
        </button>

        {showDebug ? (
          <div style={{ marginTop: 10, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>API Base</div>
              <div style={{ fontFamily: "monospace" }}>{apiBase}</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>SEC Path</div>
              <div style={{ fontFamily: "monospace" }}>{SEC_PATH}</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Raw backend</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none yet)"}
              </pre>
            </div>

            <div>
              <div style={{ fontWeight: 700 }}>Computed</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {sec ? JSON.stringify(sec, null, 2) : "(none yet)"}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
