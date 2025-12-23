import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — v1 (Simple)
  - SEC output: clicks ONLY (2 decimals), with direction arrows.
  - Direction is locked from raw SIGNED click values first.
  - Then magnitude is displayed as absolute value (2 decimals).

  Buttons:
  - Take Target Photo (camera capture)
  - Upload Target Photo (normal file picker)
*/

const DEFAULT_API_BASE = "https://sczn3-webapp-1.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// ---------- helpers ----------
function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function asNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function pad3(n) {
  const s = String(n ?? "");
  if (s.length >= 3) return s.slice(-3);
  return ("000" + s).slice(-3);
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const next = (Number.isFinite(cur) ? cur : 0) + 1;
  localStorage.setItem(INDEX_KEY, String(next));
  return pad3(next);
}

function pickApiBase() {
  // Allow override: ?api=https://your-backend.onrender.com
  try {
    const u = new URL(window.location.href);
    const q = u.searchParams.get("api");
    if (q && /^https?:\/\//i.test(q)) return q.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_API_BASE;
}

function getClicks(payload) {
  // Accept a few possible shapes, but we mainly expect:
  // { windage_clicks: number, elevation_clicks: number }
  if (!payload || typeof payload !== "object") return { w: NaN, e: NaN };

  const w =
    asNum(payload.windage_clicks) ??
    asNum(payload.windage) ??
    asNum(payload.w) ??
    NaN;

  const e =
    asNum(payload.elevation_clicks) ??
    asNum(payload.elevation) ??
    asNum(payload.e) ??
    NaN;

  return { w, e };
}

// ---------- canvas SEC drawing ----------
function drawSEC({
  canvas,
  windageSigned,
  elevationSigned,
  index,
  title = "SCZN3 Shooter Experience Card (SEC)",
}) {
  if (!canvas) return null;

  // Fixed 4x6 aspect (portrait) at a nice pixel density
  const W = 1200; // width px
  const H = 1800; // height px
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Border
  const outer = 60;
  const inner = 90;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 10;
  roundRect(ctx, outer, outer, W - outer * 2, H - outer * 2, 28);
  ctx.stroke();

  ctx.lineWidth = 6;
  roundRect(ctx, inner, inner, W - inner * 2, H - inner * 2, 24);
  ctx.stroke();

  // Title
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 74px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(title, W / 2, 230);

  // Divider space
  // WINDAGE block
  ctx.font = "800 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Windage", W / 2, 620);

  // LOCKED DIRECTION: decide arrow from signed number FIRST
  const w = Number(windageSigned);
  const wArrow = w === 0 ? "" : w < 0 ? "←" : "→";
  const wText = Number.isFinite(w) ? Math.abs(w).toFixed(2) : "--";

  // Big arrow + value
  ctx.font = "900 230px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  // Arrow
  ctx.fillText(wArrow, W / 2 - 280, 850);
  // Value
  ctx.fillText(wText, W / 2 + 120, 850);

  // ELEVATION block
  ctx.font = "800 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Elevation", W / 2, 1120);

  const e = Number(elevationSigned);

  // IMPORTANT: positive elevation = DIAL UP (↑)
  const eArrow = e === 0 ? "" : e < 0 ? "↓" : "↑";
  const eText = Number.isFinite(e) ? Math.abs(e).toFixed(2) : "--";

  ctx.font = "900 230px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(eArrow, W / 2 - 280, 1350);
  ctx.fillText(eText, W / 2 + 120, 1350);

  // Index
  ctx.font = "italic 62px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Index: ${index}`, W / 2, 1640);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ---------- main ----------
export default function App() {
  const apiBase = useMemo(() => pickApiBase(), []);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rawBackend, setRawBackend] = useState(null);

  const [result, setResult] = useState(null); // { windage_clicks, elevation_clicks, index }
  const [secPngUrl, setSecPngUrl] = useState("");

  const canvasRef = useRef(null);

  useEffect(() => {
    // cleanup object url
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile(f) {
    setError("");
    setRawBackend(null);
    setResult(null);
    setSecPngUrl("");

    if (fileUrl) {
      try {
        URL.revokeObjectURL(fileUrl);
      } catch {}
      setFileUrl("");
    }

    if (!f) {
      setFile(null);
      return;
    }

    setFile(f);
    const u = URL.createObjectURL(f);
    setFileUrl(u);
  }

  async function onAnalyze() {
    setError("");
    setRawBackend(null);
    setResult(null);
    setSecPngUrl("");

    if (!file) {
      setError("Pick a target photo first.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const url = apiBase.replace(/\/+$/, "") + SEC_PATH;

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      const text = await res.text().catch(() => "");
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      setRawBackend(data);

      if (!res.ok) {
        setError(`Backend error (${res.status}).`);
        return;
      }

      const { w, e } = getClicks(data);

      // Fail closed if missing
      if (!isNum(w) || !isNum(e)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      // Store SIGNED values (lock depends on sign)
      const next = {
        windage_clicks: Number(w),
        elevation_clicks: Number(e),
        index,
      };

      setResult(next);

      // Draw SEC PNG
      const png = drawSEC({
        canvas: canvasRef.current,
        windageSigned: next.windage_clicks,
        elevationSigned: next.elevation_clicks,
        index: next.index,
      });

      if (png) setSecPngUrl(png);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    if (!secPngUrl) return;
    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${result?.index || "000"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onShare() {
    if (!secPngUrl) return;

    try {
      const blob = await (await fetch(secPngUrl)).blob();
      const fileName = `SCZN3_SEC_${result?.index || "000"}.png`;
      const shareFile = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: "SCZN3 SEC",
          text: "SCZN3 Shooter Experience Card (SEC)",
        });
      } else {
        // fallback: download
        onDownload();
      }
    } catch (e) {
      setError(`Share failed: ${String(e?.message || e)}`);
    }
  }

  // UI rendering: numbers shown are ABS magnitude to 2 decimals
  const windSigned = result?.windage_clicks;
  const elevSigned = result?.elevation_clicks;

  const windArrow =
    typeof windSigned === "number" && Number.isFinite(windSigned)
      ? windSigned === 0
        ? ""
        : windSigned < 0
        ? "←"
        : "→"
      : "";

  // positive elevation = UP
  const elevArrow =
    typeof elevSigned === "number" && Number.isFinite(elevSigned)
      ? elevSigned === 0
        ? ""
        : elevSigned < 0
        ? "↓"
        : "↑"
      : "";

  const windText =
    typeof windSigned === "number" && Number.isFinite(windSigned)
      ? Math.abs(windSigned).toFixed(2)
      : "--";

  const elevText =
    typeof elevSigned === "number" && Number.isFinite(elevSigned)
      ? Math.abs(elevSigned).toFixed(2)
      : "--";

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={styles.row}>
        {/* Two file inputs so iOS doesn’t force camera-only */}
        <label style={styles.btn}>
          Take Target Photo
          <input
            style={styles.file}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />
        </label>

        <label style={styles.btn}>
          Upload Target Photo
          <input
            style={styles.file}
            type="file"
            accept="image/*"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          style={{ ...styles.btnPlain, opacity: file && !busy ? 1 : 0.45 }}
          disabled={!file || busy}
          onClick={onAnalyze}
        >
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button
          style={{ ...styles.btnPlain, opacity: secPngUrl ? 1 : 0.45 }}
          disabled={!secPngUrl}
          onClick={onDownload}
        >
          Download SEC (PNG)
        </button>

        <button
          style={{ ...styles.btnPlain, opacity: secPngUrl ? 1 : 0.45 }}
          disabled={!secPngUrl}
          onClick={onShare}
        >
          Share SEC
        </button>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div style={styles.grid2}>
        <div>
          <div style={styles.sectionTitle}>Target Preview</div>
          <div style={styles.previewBox}>
            {fileUrl ? (
              <img
                src={fileUrl}
                alt="Target preview"
                style={styles.previewImg}
              />
            ) : (
              <div style={styles.placeholder}>No image selected.</div>
            )}
          </div>
        </div>

        <div>
          <div style={styles.sectionTitle}>SEC Preview</div>
          <div style={styles.previewBox}>
            {secPngUrl ? (
              <img src={secPngUrl} alt="SEC preview" style={styles.secImg} />
            ) : (
              <div style={styles.placeholder}>
                Analyze to generate the SEC card.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden canvas used to generate the PNG */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Debug (collapsible) */}
      <details style={styles.details}>
        <summary style={styles.summary}>Debug</summary>

        <div style={styles.debugRow}>
          <div style={styles.debugCard}>
            <div style={styles.debugTitle}>API Base</div>
            <div style={styles.mono}>{apiBase}</div>
            <div style={{ height: 8 }} />
            <div style={styles.debugTitle}>Endpoint</div>
            <div style={styles.mono}>{SEC_PATH}</div>
          </div>

          <div style={styles.debugCard}>
            <div style={styles.debugTitle}>Locked Output (Signed → Arrow)</div>
            <div style={styles.mono}>
              windage_signed:{" "}
              {isNum(windSigned) ? windSigned.toFixed(2) : "--"} | arrow:{" "}
              {windArrow || "(none)"} | shown: {windText}
            </div>
            <div style={styles.mono}>
              elevation_signed:{" "}
              {isNum(elevSigned) ? elevSigned.toFixed(2) : "--"} | arrow:{" "}
              {elevArrow || "(none)"} | shown: {elevText}
            </div>
            <div style={styles.mono}>
              index: {result?.index || "--"}
            </div>
          </div>
        </div>

        <div style={styles.debugCard}>
          <div style={styles.debugTitle}>Raw Backend Response</div>
          <pre style={styles.pre}>
            {rawBackend ? JSON.stringify(rawBackend, null, 2) : "—"}
          </pre>
        </div>
      </details>

      <div style={styles.footerNote}>
        Want more? Unlock Advanced Mode (distance-aware clicks, saved sessions,
        coaching).
      </div>

      <button style={styles.unlockBtn} disabled>
        Unlock Advanced
      </button>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "28px 18px 60px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#111",
  },
  h1: {
    fontSize: 48,
    lineHeight: 1.1,
    margin: "10px 0 18px",
    fontWeight: 900,
  },
  row: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 18,
  },
  btn: {
    position: "relative",
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    userSelect: "none",
  },
  btnPlain: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  file: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    width: "100%",
    height: "100%",
    cursor: "pointer",
  },
  errorBox: {
    border: "1px solid #ffb4b4",
    background: "#ffecec",
    padding: "12px 14px",
    borderRadius: 10,
    marginBottom: 18,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    margin: "6px 0 10px",
  },
  previewBox: {
    border: "1px solid #ddd",
    borderRadius: 14,
    padding: 12,
    minHeight: 260,
    background: "#fff",
  },
  previewImg: {
    width: "100%",
    height: "auto",
    borderRadius: 10,
    display: "block",
  },
  secImg: {
    width: "100%",
    height: "auto",
    borderRadius: 10,
    display: "block",
  },
  placeholder: {
    padding: 18,
    color: "#555",
  },
  details: {
    marginTop: 22,
    borderTop: "1px solid #eee",
    paddingTop: 12,
  },
  summary: {
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    marginBottom: 10,
  },
  debugRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 14,
  },
  debugCard: {
    border: "1px solid #e5e5e5",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
  },
  debugTitle: {
    fontWeight: 900,
    marginBottom: 8,
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  pre: {
    margin: 0,
    padding: 10,
    borderRadius: 10,
    background: "#fff",
    border: "1px solid #eee",
    overflowX: "auto",
    fontSize: 12,
  },
  footerNote: {
    marginTop: 24,
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    background: "#fafafa",
    fontWeight: 700,
  },
  unlockBtn: {
    marginTop: 10,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    background: "#fff",
    fontWeight: 800,
    cursor: "not-allowed",
    opacity: 0.6,
  },
};
