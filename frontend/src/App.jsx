import { useMemo, useRef, useState } from "react";

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

// Flip image-based Y (down-positive) into SCZN3 Y (up-positive)
// and also flip elevation clicks + dial text so it matches reality.
function fixElevationSign(payload) {
  if (!payload || typeof payload !== "object") return payload;

  // POIB inches (y)
  if (payload.poibInches && typeof payload.poibInches.y === "number") {
    payload.poibInches = { ...payload.poibInches, y: -payload.poibInches.y };
  }

  // clicksSigned elevation
  if (payload.clicksSigned && typeof payload.clicksSigned.elevation === "number") {
    payload.clicksSigned = {
      ...payload.clicksSigned,
      elevation: -payload.clicksSigned.elevation,
    };
  }

  // dial elevation text (swap UP/DOWN if present)
  if (payload.dial && typeof payload.dial.elevation === "string") {
    const s = payload.dial.elevation.trim();
    // examples: "DOWN 26.79 clicks" or "UP 12.34 clicks"
    if (s.startsWith("DOWN ")) payload.dial = { ...payload.dial, elevation: s.replace(/^DOWN /, "UP ") };
    else if (s.startsWith("UP ")) payload.dial = { ...payload.dial, elevation: s.replace(/^UP /, "DOWN ") };
  }

  return payload;
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return round2(x).toFixed(2);
}

function dialFromClicks(clicksSigned) {
  const w = Number(clicksSigned?.windage ?? 0);
  const e = Number(clicksSigned?.elevation ?? 0);

  const windage =
    w > 0 ? `RIGHT ${fmt2(Math.abs(w))} clicks` :
    w < 0 ? `LEFT ${fmt2(Math.abs(w))} clicks` :
    `CENTER 0.00 clicks`;

  const elevation =
    e > 0 ? `UP ${fmt2(Math.abs(e))} clicks` :
    e < 0 ? `DOWN ${fmt2(Math.abs(e))} clicks` :
    `LEVEL 0.00 clicks`;

  return { windage, elevation };
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showRaw, setShowRaw] = useState(true);

  const [manualPoibOn, setManualPoibOn] = useState(false);
  const [poibX, setPoibX] = useState("");
  const [poibY, setPoibY] = useState("");

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [targetSize, setTargetSize] = useState("8.5x11");

  const [sending, setSending] = useState(false);
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");

  const objectUrlRef = useRef("");

  const expected = useMemo(() => {
    // Only meaningful if manual POIB is ON (client-side sanity check)
    if (!manualPoibOn) {
      return {
        windage: 0,
        elevation: 0,
        dial: { windage: "CENTER 0.00 clicks", elevation: "LEVEL 0.00 clicks" },
      };
    }

    const dxIn = Number(poibX);
    const dyIn = Number(poibY);
    const d = Number(distanceYards);
    const cv = Number(clickValueMoa);

    if (![dxIn, dyIn, d, cv].every(Number.isFinite) || d <= 0 || cv <= 0) {
      return {
        windage: 0,
        elevation: 0,
        dial: { windage: "CENTER 0.00 clicks", elevation: "LEVEL 0.00 clicks" },
      };
    }

    // Correction is opposite of POIB
    const corrX = -dxIn;
    const corrY = -dyIn;

    const inchesPerMOA = (d * 1.047) / 100;
    const corrMoaX = corrX / inchesPerMOA;
    const corrMoaY = corrY / inchesPerMOA;

    const clicksSigned = {
      windage: corrMoaX / cv,
      elevation: corrMoaY / cv,
    };

    return {
      windage: round2(clicksSigned.windage),
      elevation: round2(clicksSigned.elevation),
      dial: dialFromClicks(clicksSigned),
    };
  }, [manualPoibOn, poibX, poibY, distanceYards, clickValueMoa]);

  function onPickFile(f) {
    setResp(null);
    setErr("");
    setFile(f || null);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";

    if (f) {
      const url = URL.createObjectURL(f);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  }

  async function onSend() {
    setErr("");
    setResp(null);

    if (!endpoint?.startsWith("http")) {
      setErr("Endpoint URL is missing or invalid.");
      return;
    }
    if (!file) {
      setErr("Choose an image first.");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);

    // optional fields
    fd.append("distanceYards", String(distanceYards || "100"));
    fd.append("clickValueMoa", String(clickValueMoa || "0.25"));
    fd.append("targetSize", String(targetSize || ""));

    // manual POIB (only when ON)
    if (manualPoibOn) {
      fd.append("manualPoibOn", "true");
      fd.append("poibX", String(poibX || "0"));
      fd.append("poibY", String(poibY || "0"));
    }

    setSending(true);
    try {
      const r = await fetch(endpoint, { method: "POST", body: fd });
      const text = await r.text();

      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // non-json response
      }

      if (!r.ok) {
        setErr(json?.error || json?.message || text || `HTTP ${r.status}`);
        setSending(false);
        return;
      }

      // FIX elevation sign at the client level so your UI is always correct.
      const fixed = fixElevationSign(json);

      // If backend didn’t send dial, generate it.
      if (fixed && fixed.clicksSigned && !fixed.dial) {
        fixed.dial = dialFromClicks(fixed.clicksSigned);
      }

      setResp(fixed);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  const confirmed = useMemo(() => {
    if (!resp) return null;
    const cs = resp.clicksSigned || {};
    const dial = resp.dial || dialFromClicks(cs);
    const poib = resp.poibInches || {};
    return {
      windage: typeof cs.windage === "number" ? cs.windage : Number(cs.windage || 0),
      elevation: typeof cs.elevation === "number" ? cs.elevation : Number(cs.elevation || 0),
      dial,
      poibX: typeof poib.x === "number" ? poib.x : Number(poib.x || 0),
      poibY: typeof poib.y === "number" ? poib.y : Number(poib.y || 0),
      service: resp.service || "",
      build: resp.build || "",
      computeStatus: resp.computeStatus || "",
      targetSizeInchesSent: resp.targetSizeInchesSent ?? resp.sec?.targetSizeInches ?? null,
    };
  }, [resp]);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0 }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginTop: 8, fontSize: 14 }}>
        <div>
          <b>Endpoint:</b>{" "}
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </div>
        <div style={{ marginTop: 6, color: "#777" }}>
          multipart field: <b>image</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        {/* LEFT */}
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={{ marginTop: 10, border: "1px solid #ddd", padding: 10, borderRadius: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={manualPoibOn}
                onChange={(e) => setManualPoibOn(e.target.checked)}
              />
              <b>Manual POIB (turn ON only when you want to type POIB)</b>
            </label>
            <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
              Manual POIB is OFF → backend will compute POIB from the target image.
            </div>

            {manualPoibOn && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>POIB X (inches)</div>
                  <input value={poibX} onChange={(e) => setPoibX(e.target.value)} style={{ width: "100%", padding: 8 }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>POIB Y (inches)</div>
                  <input value={poibY} onChange={(e) => setPoibY(e.target.value)} style={{ width: "100%", padding: 8 }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}><b>Distance (yards)</b></div>
              <input value={distanceYards} onChange={(e) => setDistanceYards(e.target.value)} style={{ width: "100%", padding: 8 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}><b>Click Value (MOA)</b></div>
              <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} style={{ width: "100%", padding: 8 }} />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}><b>Target Size (inches)</b></div>
            <input value={targetSize} onChange={(e) => setTargetSize(e.target.value)} style={{ width: "100%", padding: 8 }} />
            <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>
              Accepts: <b>11</b> or <b>8.5x11</b> (or <b>8.5×11</b>). Backend usually uses the long side.
            </div>
          </div>

          <div style={{ marginTop: 12, border: "1px solid #ddd", padding: 10, borderRadius: 10 }}>
            <div style={{ fontWeight: 700 }}>Expected clicks (client-side sanity check)</div>
            <div style={{ marginTop: 6, fontSize: 14 }}>
              <div><b>Windage:</b> {fmt2(expected.windage)}</div>
              <div><b>Elevation:</b> {fmt2(expected.elevation)}</div>
              <div><b>Dial:</b> {expected.dial.windage}</div>
              <div><b>Dial:</b> {expected.dial.elevation}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                (Manual POIB is {manualPoibOn ? "ON" : "OFF"} → {manualPoibOn ? "expected is meaningful." : "expected shows 0.00 here."})
              </div>
            </div>
          </div>

          <button
            onClick={onSend}
            disabled={sending}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "2px solid #1f6feb",
              background: sending ? "#eee" : "#fff",
              fontWeight: 800,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {err && (
            <div style={{ marginTop: 10, color: "#b00020", whiteSpace: "pre-wrap" }}>
              <b>Error:</b> {err}
            </div>
          )}

          {confirmed && (
            <div style={{ marginTop: 12, border: "2px solid #26a269", padding: 10, borderRadius: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Backend confirmed</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13, lineHeight: 1.35 }}>
                Windage (signed): {fmt2(confirmed.windage)} &nbsp; | &nbsp; Dial: {confirmed.dial.windage}
                <br />
                Elevation (signed): {fmt2(confirmed.elevation)} &nbsp; | &nbsp; Dial: {confirmed.dial.elevation}
                <br />
                POIB inches: x={fmt2(confirmed.poibX)}, y={fmt2(confirmed.poibY)}
                <br />
                Distance: {fmt2(distanceYards)}y &nbsp; | &nbsp; Click: {fmt2(clickValueMoa)}
                <br />
                Service: {confirmed.service} &nbsp; | &nbsp; Build: {confirmed.build}
                <br />
                computeStatus: {confirmed.computeStatus}
                {confirmed.targetSizeInchesSent != null && (
                  <>
                    <br />
                    targetSizeInches sent: {fmt2(confirmed.targetSizeInchesSent)}
                  </>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                NOTE: This UI applies the Y-flip fix so “below bull” correctly returns <b>UP</b>.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>Preview</b>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
              <span>Show raw JSON</span>
            </label>
          </div>

          <div style={{ marginTop: 10, border: "1px solid #ddd", borderRadius: 10, padding: 8, minHeight: 220 }}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <div style={{ color: "#777" }}>Choose an image to preview it here.</div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <b>Response</b>
            {showRaw && (
              <pre
                style={{
                  marginTop: 8,
                  background: "#111",
                  color: "#fff",
                  padding: 10,
                  borderRadius: 10,
                  overflowX: "auto",
                  fontSize: 12,
                  lineHeight: 1.3,
                  minHeight: 180,
                }}
              >
{resp ? JSON.stringify(resp, null, 2) : "// no response yet"}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
