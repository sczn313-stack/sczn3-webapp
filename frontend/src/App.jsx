import React, { useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — Frontend (Static Site)
  - Upload image -> POST /api/sec (multipart/form-data key MUST be "file")
  - Renders a clean SEC preview (clicks only, two decimals, arrows)
  - Download PNG + Share (if supported)
  - Fails-closed on 422 (no / not enough holes)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// HARD-WIRED message for blank / not-enough-holes cases
const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

function fmt2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  // clamp tiny values to 0.00 so we don’t show “-0.00”
  const clean = Math.abs(v) < 0.005 ? 0 : v;
  return clean.toFixed(2);
}

// IMPORTANT: You said BOTH directions are currently wrong.
// So we FLIP the arrows for BOTH windage and elevation:
//
// Windage:  +  => dial LEFT
//           -  => dial RIGHT
//
// Elevation: + => dial DOWN
//            - => dial UP
//
// (Numbers stay the same; we’re correcting the directional UI.)
function windArrow(clicks) {
  const v = Number(clicks);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "•";
  return v > 0 ? "←" : "→";
}

function elevArrow(clicks) {
  const v = Number(clicks);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "•";
  return v > 0 ? "↓" : "↑";
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = cur + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return String(nxt).padStart(3, "0");
}

function drawSecToCanvas(canvas, { windage, elevation, index }) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 4x6 at 300dpi = 1200 x 1800
  const W = 1200;
  const H = 1800;
  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.lineWidth = 18;
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // Title
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 88px Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 260);

  // Section labels
  ctx.font = "bold 70px Arial";
  ctx.fillText("Windage", W / 2, 620);

  // Windage value + arrow
  ctx.font = "bold 190px Arial";
  ctx.fillText(`${windArrow(windage)} ${fmt2(windage)}`, W / 2, 820);

  // Elevation label
  ctx.font = "bold 70px Arial";
  ctx.fillText("Elevation", W / 2, 1120);

  // Elevation value + arrow
  ctx.font = "bold 190px Arial";
  ctx.fillText(`${elevArrow(elevation)} ${fmt2(elevation)}`, W / 2, 1320);

  // Index (italic)
  ctx.font = "italic 60px Arial";
  ctx.fillText(`Index: ${index}`, W / 2, 1550);
}

export default function App() {
  const [apiBase, setApiBase] = useState(
    (import.meta?.env?.VITE_API_BASE_URL || "").trim() || DEFAULT_API_BASE
  );
  const [convention, setConvention] = useState("DIAL_TO_CENTER");

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const [sec, setSec] = useState(null); // { windage_clicks, elevation_clicks, index }
  const [rawBackend, setRawBackend] = useState(null);

  const canvasRef = useRef(null);

  const canDownloadOrShare = useMemo(() => {
    return !!sec && !!canvasRef.current;
  }, [sec]);

  async function onAnalyze() {
    if (!file) return;

    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setBusy(true);

    try {
      const url = new URL(SEC_PATH, apiBase).toString();

      const form = new FormData();
      form.append("file", file);
      form.append("convention", convention);

      const res = await fetch(url, { method: "POST", body: form });

      // Fail-closed on 422 (no holes)
      if (res.status === 422) {
        setError(NO_SHOTS_MSG);
        setBusy(false);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setError(`Backend error (${res.status}). ${txt || ""}`.trim());
        setBusy(false);
        return;
      }

      const data = await res.json();
      setRawBackend(data);

      const w = data?.sec?.windage_clicks;
      const e = data?.sec?.elevation_clicks;

      if (!Number.isFinite(Number(w)) || !Number.isFinite(Number(e))) {
        setError("Backend response missing windage/elevation clicks.");
        setBusy(false);
        return;
      }

      const idx = nextIndex();

      const nextSec = {
        windage_clicks: Number(w),
        elevation_clicks: Number(e),
        index: idx,
      };

      setSec(nextSec);

      // Draw preview immediately
      requestAnimationFrame(() => {
        drawSecToCanvas(canvasRef.current, {
          windage: nextSec.windage_clicks,
          elevation: nextSec.elevation_clicks,
          index: nextSec.index,
        });
      });

      setBusy(false);
    } catch (err) {
      setError(`Network / CORS error: ${String(err?.message || err)}`);
      setBusy(false);
    }
  }

  function onDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const a = document.createElement("a");
    a.download = `SCZN3_SEC_${sec?.index || "000"}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  async function onShare() {
    const canvas = canvasRef.current;
    if (!canvas || !sec) return;

    if (!navigator.share) {
      setNote("Share not supported on this device/browser.");
      return;
    }

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );

    if (!blob) {
      setNote("Could not generate image for sharing.");
      return;
    }

    const fileObj = new File([blob], `SCZN3_SEC_${sec.index}.png`, {
      type: "image/png",
    });

    try {
      await navigator.share({
        title: "SCZN3 Shooter Experience Card (SEC)",
        text: "SEC",
        files: [fileObj],
      });
    } catch (e) {
      // user canceled share is fine — don’t treat as an error
      setNote("");
    }
  }

  return (
    <div style={{ padding: 18, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 44, margin: "10px 0 18px" }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 16 }}>
          Convention:&nbsp;
          <select
            value={convention}
            onChange={(e) => setConvention(e.target.value)}
            style={{ padding: 8, fontSize: 16 }}
          >
            <option value="DIAL_TO_CENTER">Dial to center (move impact to center)</option>
          </select>
        </label>

        <label style={{ fontSize: 16 }}>
          API Base:&nbsp;
          <input
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            style={{ padding: 8, fontSize: 16, width: 420, maxWidth: "90vw" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #bbb",
            cursor: "pointer",
            background: "#f6f6f6",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Take or Upload Target Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
        </label>

        <div style={{ fontSize: 14, opacity: 0.8 }}>
          {file ? file.name : "No photo selected"}
        </div>

        <button
          onClick={onAnalyze}
          disabled={!file || busy}
          style={{ padding: "10px 14px", fontSize: 16, cursor: "pointer" }}
        >
          {busy ? "Analyzing…" : "Analyze / SEC"}
        </button>

        <button
          onClick={onDownloadPng}
          disabled={!canDownloadOrShare}
          style={{ padding: "10px 14px", fontSize: 16, cursor: "pointer" }}
        >
          Download SEC (PNG)
        </button>

        <button
          onClick={onShare}
          disabled={!canDownloadOrShare}
          style={{ padding: "10px 14px", fontSize: 16, cursor: "pointer" }}
        >
          Share SEC
        </button>
      </div>

      {(error || note) && (
        <div style={{ marginTop: 14 }}>
          {error && (
            <div style={{ padding: 12, border: "1px solid #c00", color: "#c00" }}>
              {error}
            </div>
          )}
          {note && (
            <div style={{ padding: 12, border: "1px solid #999", color: "#333" }}>
              {note}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Preview</div>
        <div
          style={{
            border: "1px solid #ddd",
            padding: 12,
            display: "inline-block",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: 300, // show a smaller preview; image exports at full resolution
              height: 450,
              display: "block",
            }}
          />
        </div>
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Debug</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 10 }}>
          {rawBackend ? JSON.stringify(rawBackend, null, 2) : "(no response yet)"}
        </pre>
      </details>
    </div>
  );
}
