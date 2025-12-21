import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — Frontend (App.jsx)

  Fixes included:
  - File chooser does NOT force camera (no capture attribute) so iOS shows choices.
  - Button/label text changed to "Take or Upload Target Photo".
  - Hard-wired "No / not enough bullet holes" message on 422 from backend.
  - Windage + Elevation arrow directions inverted (per your current convention needs).
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

// Hard-wired message for blank / not-enough-holes cases
const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumber(obj, keys) {
  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = cur[p];
    }
    const n = toNum(cur);
    if (n !== null) return n;
  }
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

// Invert BOTH axes for direction (your current output is reversed)
function arrowForWindage(clicks) {
  if (clicks === 0) return "→";
  // inverted
  return clicks > 0 ? "←" : "→";
}

function arrowForElevation(clicks) {
  if (clicks === 0) return "↑";
  // inverted
  return clicks > 0 ? "↓" : "↑";
}

function abs2(v) {
  const n = toNum(v);
  if (n === null) return "0.00";
  return Math.abs(n).toFixed(2);
}

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
        // 422: "no holes" is expected fail-closed
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

      // Try common shapes/keys (supporting multiple backend variants)
      const windageClicks = pickFirstNumber(data, [
        "windageClicks",
        "windage_clicks",
        "clicks.windage",
        "clicks.windageClicks",
        "windage",
        "W",
        "w",
      ]);

      const elevationClicks = pickFirstNumber(data, [
        "elevationClicks",
        "elevation_clicks",
        "clicks.elevation",
        "clicks.elevationClicks",
        "elevation",
        "E",
        "e",
      ]);

      if (windageClicks === null || elevationClicks === null) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      setSec({
        windageClicks,
        elevationClicks,
        index,
      });
    } catch (e) {
      setError(`Request failed: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // Draw SEC to canvas whenever sec updates
  useEffect(() => {
    if (!sec || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 4×6 at 300 DPI = 1200×1800 (but that's big). Use 1000×1500 for snappy UI.
    const W = 1000;
    const H = 1500;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Title
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.font = "bold 64px Arial";
    ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 160);

    // Windage label
    ctx.font = "bold 54px Arial";
    ctx.fillText("Windage", W / 2, 430);

    // Windage arrow + value
    const wArrow = arrowForWindage(sec.windageClicks);
    const wVal = abs2(sec.windageClicks);

    ctx.font = "bold 140px Arial";
    ctx.fillText(`${wArrow} ${wVal}`, W / 2, 620);

    // Elevation label
    ctx.font = "bold 54px Arial";
    ctx.fillText("Elevation", W / 2, 920);

    // Elevation arrow + value
    const eArrow = arrowForElevation(sec.elevationClicks);
    const eVal = abs2(sec.elevationClicks);

    ctx.font = "bold 140px Arial";
    ctx.fillText(`${eArrow} ${eVal}`, W / 2, 1110);

    // Index
    ctx.font = "italic 48px Arial";
    ctx.fillText(`Index: ${sec.index}`, W / 2, 1285);

    // Export PNG URL
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
      const f = new File([blob], `SCZN3_SEC_${sec?.index || "000"}.png`, {
        type: "image/png",
      });

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

        <div style={{ opacity: 0.7 }}>
          {file ? file.name : "No photo selected"}
        </div>
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
