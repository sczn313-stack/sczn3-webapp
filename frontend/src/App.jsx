im. port React, { useMemo, useState } from "react";

const SEC_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

function round2(n) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

function dialFromClicksSigned(clicksSigned) {
  const w = Number(clicksSigned?.windage ?? 0);
  const e = Number(clicksSigned?.elevation ?? 0);

  const windage =
    w > 0 ? `RIGHT ${round2(Math.abs(w))} clicks` :
    w < 0 ? `LEFT ${round2(Math.abs(w))} clicks` :
    `CENTER 0.00 clicks`;

  const elevation =
    e > 0 ? `UP ${round2(Math.abs(e))} clicks` :
    e < 0 ? `DOWN ${round2(Math.abs(e))} clicks` :
    `LEVEL 0.00 clicks`;

  return { windage, elevation };
}

// Always interpret 8.5x11 as long side = 11
function parseTargetSizeLongSide(input) {
  const s = String(input || "").trim().toLowerCase();

  // Accept common entries
  if (s === "11") return 11;
  if (s === "8.5x11" || s === "8.5×11" || s === "8.5 x 11" || s === "letter") return 11;

  // If they typed "23" keep it numeric
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return n;

  // Default safe
  return 11;
}

// Patch result to force true center + correct axes using normalized midpoints
function patchResultTrueCenter(json) {
  if (!json || typeof json !== "object") return json;

  const detect = json.detect || {};
  const normalized = detect.normalized || {};
  const groupCenterPx = detect.groupCenterPx || {};

  const w = Number(normalized.width);
  const h = Number(normalized.height);
  const gX = Number(groupCenterPx.x);
  const gY = Number(groupCenterPx.y);
  const ppi = Number(detect.pixelsPerInch);

  const distanceYards = Number(json?.sec?.distanceYards ?? 100);
  const clickValueMoa = Number(json?.sec?.clickValueMoa ?? 0.25);

  const ok =
    Number.isFinite(w) && w > 0 &&
    Number.isFinite(h) && h > 0 &&
    Number.isFinite(gX) &&
    Number.isFinite(gY) &&
    Number.isFinite(ppi) && ppi > 0 &&
    Number.isFinite(distanceYards) && distanceYards > 0 &&
    Number.isFinite(clickValueMoa) && clickValueMoa > 0;

  if (!ok) return json;

  // TRUE CENTER OF NORMALIZED IMAGE
  const centerPx = { x: w / 2, y: h / 2 };

  // Delta from center in image coords
  const dxPx = gX - centerPx.x;
  const dyPx = gY - centerPx.y;

  // POIB inches: right-positive, up-positive (flip image Y)
  const poibInches = {
    x: dxPx / ppi,
    y: -(dyPx / ppi),
  };

  // Correction inches = opposite of POIB
  const corrInches = { x: -poibInches.x, y: -poibInches.y };

  // inches per MOA (1.047" @ 100y)
  const inchesPerMOA = (distanceYards * 1.047) / 100;

  const corrMoa = {
    x: corrInches.x / inchesPerMOA,
    y: corrInches.y / inchesPerMOA,
  };

  const clicksSigned = {
    windage: corrMoa.x / clickValueMoa,
    elevation: corrMoa.y / clickValueMoa,
  };

  const dial = dialFromClicksSigned(clicksSigned);

  return {
    ...json,
    poibInches: { x: Number(round2(poibInches.x)), y: Number(round2(poibInches.y)) },
    clicksSigned: {
      windage: Number(round2(clicksSigned.windage)),
      elevation: Number(round2(clicksSigned.elevation)),
    },
    dial,
    detect: {
      ...detect,
      centerPx, // overwrite bad backend center
    },
    patchNote: "APPJSX_TRUE_CENTER_LOCKED",
  };
}

export default function App() {
  const [file, setFile] = useState(null);
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [targetSizeInput, setTargetSizeInput] = useState("8.5x11");
  const [showRaw, setShowRaw] = useState(true);

  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");

  const targetSizeLong = useMemo(
    () => parseTargetSizeLongSide(targetSizeInput),
    [targetSizeInput]
  );

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setStatus("");
    if (f) setPreviewUrl(URL.createObjectURL(f));
  }

  async function onSend() {
    if (!file) {
      setStatus("Pick an image first.");
      return;
    }

    setStatus("Uploading...");
    setResult(null);

    const fd = new FormData();
    fd.append("image", file);

    // LOCKED inputs
    fd.append("distanceYards", String(distanceYards));
    fd.append("clickValueMoa", String(clickValueMoa));
    fd.append("targetSizeInches", String(targetSizeLong)); // ALWAYS 11 for 8.5x11

    try {
      const res = await fetch(SEC_ENDPOINT, { method: "POST", body: fd });
      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }

      // FORCE TRUE CENTER + AXES
      const patched = patchResultTrueCenter(json);

      setResult(patched);
      setStatus("Done.");
    } catch (err) {
      setStatus(String(err?.message || err));
    }
  }

  const backendBox = useMemo(() => {
    if (!result) return null;

    const w = result?.clicksSigned?.windage ?? 0;
    const e = result?.clicksSigned?.elevation ?? 0;

    const windDial =
      w > 0 ? `RIGHT (${round2(Math.abs(w))} clicks)` :
      w < 0 ? `LEFT (${round2(Math.abs(w))} clicks)` :
      `CENTER (0.00 clicks)`;

    const elevDial =
      e > 0 ? `UP (${round2(Math.abs(e))} clicks)` :
      e < 0 ? `DOWN (${round2(Math.abs(e))} clicks)` :
      `LEVEL (0.00 clicks)`;

    const px = result?.poibInches || {};
    const tSent = result?.sec?.targetSizeInches ?? targetSizeLong;

    return (
      <div style={{ border: "3px solid #2aa66a", padding: 14, borderRadius: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Backend confirmed</div>

        <div style={{ fontFamily: "monospace", fontSize: 14, whiteSpace: "pre-wrap" }}>
          Windage (signed): {round2(w)}  |  Dial: {windDial}{"\n"}
          Elevation (signed): {round2(e)}  |  Dial: {elevDial}{"\n"}
          POIB inches: x={round2(px.x ?? 0)}, y={round2(px.y ?? 0)}{"\n"}
          Distance: {round2(distanceYards)}y  |  Click: {round2(clickValueMoa)} MOA{"\n"}
          computeStatus: {String(result?.computeStatus || "")}{"\n"}
          targetSizeInches sent: {round2(tSent)}{"\n"}
          patch: {String(result?.patchNote || "none")}
        </div>
      </div>
    );
  }, [result, distanceYards, clickValueMoa, targetSizeLong]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0 }}>SCZN3 SEC — Upload Test</h1>
      <div style={{ marginTop: 8, marginBottom: 18, color: "#444" }}>
        Endpoint: {SEC_ENDPOINT}
        <br />
        multipart field: <b>image</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* LEFT PANEL */}
        <div style={{ border: "2px solid #222", padding: 14, borderRadius: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={onChooseFile} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 700 }}>Distance (yards)</label>
            <input
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
              value={distanceYards}
              onChange={(e) => setDistanceYards(Number(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 700 }}>Click Value (MOA)</label>
            <input
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(Number(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 700 }}>Target Size (inches)</label>
            <input
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
              value={targetSizeInput}
              onChange={(e) => setTargetSizeInput(e.target.value)}
            />
            <div style={{ marginTop: 6, color: "#555" }}>
              Accepts: 11 or 8.5x11 (or 8.5×11). We send the long side.
              <br />
              Sending targetSizeInches = <b>{targetSizeLong}</b>
            </div>
          </div>

          <button
            onClick={onSend}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 18,
              fontWeight: 800,
              borderRadius: 10,
              border: "3px solid #2c66ff",
              background: "white",
              cursor: "pointer",
            }}
          >
            Send to SCZN3 SEC backend
          </button>

          <div style={{ marginTop: 12, color: "#111" }}>
            <b>Status:</b> {status}
          </div>

          <div style={{ marginTop: 16 }}>{backendBox}</div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ border: "2px solid #222", padding: 14, borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Preview</h2>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
              Show raw JSON
            </label>
          </div>

          <div style={{ marginTop: 10, border: "2px solid #333", borderRadius: 10, overflow: "hidden" }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ padding: 20, color: "#666" }}>Choose an image to preview it.</div>
            )}
          </div>

          {showRaw && result && (
            <pre
              style={{
                marginTop: 12,
                background: "#111",
                color: "#fff",
                padding: 12,
                borderRadius: 10,
                overflowX: "auto",
                fontSize: 13,
              }}
            >
{JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
