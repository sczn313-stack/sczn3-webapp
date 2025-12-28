import React, { useMemo, useState } from "react";

const ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

// Always show 2 decimals
function two(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "—";
  return x.toFixed(2);
}

// Accepts: "11" OR "8.5x11" OR "8.5×11" (or with spaces)
// Sends LONG SIDE as targetSizeInches (11 for 8.5x11).
function parseTargetSizeInches(input) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!s) return { value: 23, note: "blank → default 23" };

  // plain number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const v = Number(s);
    return { value: v, note: "numeric" };
  }

  // "8.5x11" or "8.5×11"
  const parts = s.split(/x|×/);
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > 0 && b > 0) {
      const v = Math.max(a, b);
      return { value: v, note: `parsed ${a}×${b} → long side ${v}` };
    }
  }

  return { value: 23, note: "unreadable → default 23" };
}

function dialDir(kind, signedClicks) {
  const v = Number(signedClicks);
  if (Number.isNaN(v)) return { label: "—", abs: "—" };

  if (kind === "windage") {
    if (v > 0) return { label: "RIGHT", abs: Math.abs(v) };
    if (v < 0) return { label: "LEFT", abs: Math.abs(v) };
    return { label: "CENTER", abs: 0 };
  }

  // elevation
  if (v > 0) return { label: "UP", abs: Math.abs(v) };
  if (v < 0) return { label: "DOWN", abs: Math.abs(v) };
  return { label: "LEVEL", abs: 0 };
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);

  // User can type 8.5x11; we’ll convert
  const [targetSizeText, setTargetSizeText] = useState("8.5x11");

  const [manualPoib, setManualPoib] = useState(false);
  const [poibX, setPoibX] = useState("");
  const [poibY, setPoibY] = useState("");

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [rawJson, setRawJson] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const parsedSize = useMemo(
    () => parseTargetSizeInches(targetSizeText),
    [targetSizeText]
  );

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setRawJson(null);
    setStatus("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSend() {
    setRawJson(null);

    if (!file) {
      setStatus("Choose an image file first.");
      return;
    }

    setSending(true);
    setStatus("Sending…");

    try {
      const fd = new FormData();
      fd.append("image", file); // MUST be "image"
      fd.append("distanceYards", String(distanceYards));
      fd.append("clickValueMoa", String(clickValueMoa));
      fd.append("targetSizeInches", String(parsedSize.value));

      if (manualPoib) {
        fd.append("manualPoib", "true");
        fd.append("poibX", String(poibX ?? ""));
        fd.append("poibY", String(poibY ?? ""));
      } else {
        fd.append("manualPoib", "false");
      }

      const res = await fetch(ENDPOINT, { method: "POST", body: fd });
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { ok: false, parseError: true, raw: text };
      }

      setRawJson(json);

      if (!res.ok || json?.ok === false) {
        setStatus(`Backend error (${res.status}). See raw JSON.`);
        setSending(false);
        return;
      }

      setStatus("Done.");
    } catch (err) {
      setStatus(`Request failed: ${String(err)}`);
    } finally {
      setSending(false);
    }
  }

  // IMPORTANT: clicks are returned at TOP LEVEL: json.clicksSigned.windage / elevation
  const clicksSigned = rawJson?.clicksSigned || rawJson?.sec?.clicksSigned || {};
  const w = clicksSigned?.windage;
  const e = clicksSigned?.elevation;

  const poibInches = rawJson?.poibInches || rawJson?.sec?.poibInches || {};
  const px = poibInches?.x;
  const py = poibInches?.y;

  const windDial = dialDir("windage", w);
  const elevDial = dialDir("elevation", e);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 16 }}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 36 }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ fontSize: 14, marginBottom: 12 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* LEFT */}
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Choose file</div>
          <input type="file" accept="image/*" onChange={onChooseFile} />
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
            {file ? file.name : "No file selected"}
          </div>

          <label style={{ display: "block", marginTop: 12, fontWeight: 900 }}>
            <input
              type="checkbox"
              checked={manualPoib}
              onChange={(e) => setManualPoib(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Manual POIB (turn ON only when you want to type POIB)
          </label>

          <div style={{ fontSize: 13, color: "#555" }}>
            Manual POIB OFF → backend computes POIB from the image.
          </div>

          {manualPoib && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>POIB X (inches)</div>
                <input
                  value={poibX}
                  onChange={(e) => setPoibX(e.target.value)}
                  placeholder='e.g. -1.25'
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #111" }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>POIB Y (inches)</div>
                <input
                  value={poibY}
                  onChange={(e) => setPoibY(e.target.value)}
                  placeholder='e.g. 0.75'
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #111" }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#555" }}>
                X: right positive, Y: up positive (only for manual entry).
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Distance (yards)</div>
              <input
                type="number"
                value={distanceYards}
                onChange={(e) => setDistanceYards(Number(e.target.value))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #111" }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Click Value (MOA)</div>
              <input
                type="number"
                step="0.01"
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(Number(e.target.value))}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #111" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Target Size (inches)</div>
            <input
              value={targetSizeText}
              onChange={(e) => setTargetSizeText(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "2px solid #111" }}
            />
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              Accepts: <b>11</b> or <b>8.5x11</b> (or 8.5×11). We send the long side.
              <div>Sending <code>targetSizeInches</code> = <b>{parsedSize.value}</b> ({parsedSize.note})</div>
            </div>
          </div>

          <button
            onClick={onSend}
            disabled={sending}
            style={{
              width: "100%",
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              border: "3px solid #1b5cff",
              background: "#eaf0ff",
              fontSize: 18,
              fontWeight: 900,
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.6 : 1
            }}
          >
            {sending ? "Sending…" : "Send to SCZN3 SEC backend"}
          </button>

          {/* BACKEND CONFIRMED BOX */}
          {rawJson?.ok && (
            <div style={{ marginTop: 12, border: "3px solid #1aa34a", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Backend confirmed</div>

              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 14, lineHeight: 1.35 }}>
                <div>
                  <b>Windage (signed):</b> {two(w)} &nbsp; | &nbsp;
                  <b>Dial:</b> {windDial.label} ({two(windDial.abs)} clicks)
                </div>
                <div>
                  <b>Elevation (signed):</b> {two(e)} &nbsp; | &nbsp;
                  <b>Dial:</b> {elevDial.label} ({two(elevDial.abs)} clicks)
                </div>

                <div style={{ marginTop: 10 }}>
                  <b>POIB inches:</b> x={two(px)}, y={two(py)} &nbsp; | &nbsp;
                  <b>Distance:</b> {two(distanceYards)}y &nbsp; | &nbsp;
                  <b>Click:</b> {two(clickValueMoa)}
                </div>

                <div style={{ marginTop: 10 }}>
                  <b>Service:</b> {rawJson?.service || "—"} &nbsp; | &nbsp;
                  <b>Build:</b> {rawJson?.build || "—"}
                </div>

                <div>
                  <b>computeStatus:</b> {rawJson?.computeStatus || "—"}
                </div>

                <div>
                  <b>targetSizeInches sent:</b> {two(parsedSize.value)}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 13, color: status.includes("error") ? "#b00020" : "#333" }}>
            {status}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Preview</div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: "100%", height: "auto", border: "2px solid #111", borderRadius: 10 }}
            />
          ) : (
            <div style={{ fontSize: 13, color: "#555" }}>Choose a file to see preview.</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Response</div>
            <label style={{ fontSize: 13, color: "#555", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show raw JSON
            </label>
          </div>

          {showRaw && (
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 12,
                border: "2px solid #111",
                background: "#0b0b0b",
                color: "#f1f1f1",
                overflow: "auto",
                maxHeight: 420,
                fontSize: 12
              }}
            >
              {rawJson ? JSON.stringify(rawJson, null, 2) : ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
