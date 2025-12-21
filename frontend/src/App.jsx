import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SCZN3 Shooter Experience Card (SEC)
 * - Upload image -> POST /api/sec (multipart/form-data key MUST be: "file")
 * - Renders a clean SEC preview (clicks only, two decimals, arrows)
 * - Download PNG + Share (if supported)
 */

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

// Flip only windage arrow direction (your reported issue)
const FLIP_WINDAGE_ARROW = true;

const INDEX_KEY = "SCZN3_SEC_INDEX";

function clampToTwo(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function formatTwo(n) {
  return clampToTwo(n).toFixed(2);
}

function nextIndex() {
  const raw = localStorage.getItem(INDEX_KEY);
  const cur = Number.parseInt(raw || "0", 10);
  const next = Number.isFinite(cur) ? cur + 1 : 1;
  localStorage.setItem(INDEX_KEY, String(next));
  return next;
}

function pad3(n) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}

function windageArrowFromValue(v) {
  // v is "clicks" signed
  // normal: + => RIGHT, - => LEFT
  // flip:   + => LEFT,  - => RIGHT
  const sign = Number(v) >= 0 ? 1 : -1;
  if (FLIP_WINDAGE_ARROW) return sign >= 0 ? "←" : "→";
  return sign >= 0 ? "→" : "←";
}

function elevationArrowFromValue(v) {
  // + => UP, - => DOWN
  return Number(v) >= 0 ? "↑" : "↓";
}

async function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

export default function App() {
  const apiBase = useMemo(() => {
    // If you later set VITE_API_BASE_URL on Render, it will override this at build-time.
    const fromEnv = import.meta?.env?.VITE_API_BASE_URL;
    return (fromEnv && String(fromEnv).trim()) || DEFAULT_API_BASE;
  }, []);

  const [convention, setConvention] = useState("DIAL_TO_CENTER");
  const [file, setFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rawResponse, setRawResponse] = useState(null);

  const [windageClicks, setWindageClicks] = useState(null);
  const [elevationClicks, setElevationClicks] = useState(null);
  const [indexNum, setIndexNum] = useState(null);

  const [previewUrl, setPreviewUrl] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    // cleanup object URL
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw SEC card whenever values change
  useEffect(() => {
    if (windageClicks == null || elevationClicks == null || indexNum == null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 1200;
    const H = 800;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Border
    const outer = 28;
    const inner = 52;

    ctx.lineWidth = 10;
    ctx.strokeStyle = "#111111";
    ctx.strokeRect(outer, outer, W - outer * 2, H - outer * 2);

    ctx.lineWidth = 4;
    ctx.strokeRect(inner, inner, W - inner * 2, H - inner * 2);

    // Title
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "700 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 170);

    // Labels
    ctx.font = "700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Windage", W / 2, 295);

    // Windage value line (arrow + value)
    const wArrow = windageArrowFromValue(windageClicks);
    const wVal = formatTwo(Math.abs(windageClicks));
    ctx.font = "800 140px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${wArrow} ${wVal}`, W / 2, 430);

    // Elevation label + value
    ctx.font = "700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Elevation", W / 2, 540);

    const eArrow = elevationArrowFromValue(elevationClicks);
    const eVal = formatTwo(Math.abs(elevationClicks));
    ctx.font = "800 140px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${eArrow} ${eVal}`, W / 2, 675);

    // Index bottom
    ctx.font = "italic 600 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Index: ${pad3(indexNum)}`, W / 2, 742);

    // Update preview URL
    (async () => {
      const blob = await canvasToBlob(canvas, "image/png");
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    })();
  }, [windageClicks, elevationClicks, indexNum]);

  async function analyze() {
    setErr("");
    setRawResponse(null);

    if (!file) {
      setErr("Choose a file first.");
      return;
    }

    setBusy(true);
    try {
      const url = `${apiBase}${SEC_PATH}`;

      const form = new FormData();
      form.append("file", file); // IMPORTANT: key must be exactly "file"
      // optional (won’t break if backend ignores it)
      form.append("convention", convention);

      const res = await fetch(url, { method: "POST", body: form });
      const contentType = res.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
      }

      setRawResponse({ status: res.status, data });

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status}).`);
      }

      const w = data?.sec?.windage_clicks;
      const e = data?.sec?.elevation_clicks;

      if (!Number.isFinite(Number(w)) || !Number.isFinite(Number(e))) {
        throw new Error("Backend response missing sec.windage_clicks / sec.elevation_clicks.");
      }

      setWindageClicks(clampToTwo(w));
      setElevationClicks(clampToTwo(e));
      setIndexNum(nextIndex());
    } catch (e) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPng() {
    setErr("");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await canvasToBlob(canvas, "image/png");
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SCZN3_SEC_${indexNum != null ? pad3(indexNum) : "000"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function sharePng() {
    setErr("");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await canvasToBlob(canvas, "image/png");
    if (!blob) return;

    const fileName = `SCZN3_SEC_${indexNum != null ? pad3(indexNum) : "000"}.png`;
    const shareFile = new File([blob], fileName, { type: "image/png" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      await navigator.share({
        files: [shareFile],
        title: "SCZN3 Shooter Experience Card (SEC)",
      });
      return;
    }

    // fallback: just download
    await downloadPng();
  }

  const hasSec = windageClicks != null && elevationClicks != null && indexNum != null;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 44, margin: "8px 0 18px" }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>
          Convention:&nbsp;
          <select value={convention} onChange={(e) => setConvention(e.target.value)}>
            <option value="DIAL_TO_CENTER">Dial to center (move impact to center)</option>
            <option value="MOVE_IMPACT">Move impact (impact direction)</option>
          </select>
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setErr("");
            setRawResponse(null);
            setFile(e.target.files?.[0] || null);
          }}
        />

        <button onClick={analyze} disabled={!file || busy} style={{ padding: "8px 14px" }}>
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button onClick={downloadPng} disabled={!hasSec} style={{ padding: "8px 14px" }}>
          Download SEC (PNG)
        </button>

        <button onClick={sharePng} disabled={!hasSec} style={{ padding: "8px 14px" }}>
          Share SEC
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>{err}</div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Preview</div>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="SEC Preview"
                style={{
                  maxWidth: 820,
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                }}
              />
            ) : (
              <div style={{ padding: 18, border: "1px solid #ddd", borderRadius: 8 }}>
                Upload an image and click Analyze / SEC.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          onClick={() => setShowDebug((v) => !v)}
          style={{ padding: "6px 10px", fontWeight: 700 }}
        >
          {showDebug ? "Hide Debug" : "Debug"}
        </button>

        {showDebug ? (
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              background: "#111",
              color: "#eee",
              borderRadius: 8,
              overflowX: "auto",
              fontSize: 12,
            }}
          >
{JSON.stringify(
  {
    apiBase,
    secPath: SEC_PATH,
    convention,
    fileName: file?.name || null,
    windageClicks,
    elevationClicks,
    index: indexNum != null ? pad3(indexNum) : null,
    lastResponse: rawResponse,
  },
  null,
  2
)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
