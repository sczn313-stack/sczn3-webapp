const BUILD_STAMP = "NO_DEMO_V4_2025-12-31_16-17";import React, { useMemo, useState } from "react";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function safeParseHoles(text) {
  const t = (text || "").trim();
  if (!t) return null;

  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return null;

    const holes = [];
    for (const item of v) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y)
      ) {
        holes.push({ x: item.x, y: item.y });
      }
    }

    return holes.length ? holes : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.10);

  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.50);

  const [file, setFile] = useState(null);
  const [holesText, setHolesText] = useState("");

  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const holes = useMemo(() => safeParseHoles(holesText), [holesText]);

  const usingImage = !!file;
  const usingHoles = !!holes;

  function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    setFile(f || null);

    // IMPORTANT: if user picks a new image, clear old holes JSON
    // so you don't keep getting "same output" from old demo/holes.
    setHolesText("");
    setResult(null);

    if (f) setStatus("Ready. Using uploaded image.");
    else setStatus("");
  }

  async function onSend() {
    setStatus("");
    setResult(null);

    const ep = (endpoint || "").trim();
    if (!ep) {
      setStatus("Missing Endpoint URL.");
      return;
    }

    // DO NOT BLOCK with a popup.
    // Only stop if we have neither holes nor an uploaded image.
    if (!usingImage && !usingHoles) {
      setStatus("Upload an image (recommended) or paste Holes JSON (optional).");
      return;
    }

    const fd = new FormData();
    fd.append("targetSizeSpec", targetSizeSpec);
    fd.append("distanceYards", String(distanceYards));
    fd.append("clickValueMoa", String(clickValueMoa));
    fd.append("deadbandIn", String(deadbandIn));
    fd.append("bullX", String(bullX));
    fd.append("bullY", String(bullY));

    if (usingHoles) {
      fd.append("holesJson", JSON.stringify(holes));
    }

    if (usingImage) {
      fd.append("image", file);
    }

    try {
      setStatus("Sending…");

      const resp = await fetch(ep, {
        method: "POST",
        body: fd,
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        const msg =
          (data && data.error && (data.error.message || data.error.code)) ||
          `HTTP ${resp.status}`;
        setStatus(`Error: ${msg}`);
        setResult(data || { ok: false, error: { message: msg } });
        return;
      }

      setStatus("Done.");
      setResult(data);
    } catch (err) {
      setStatus(`Network error: ${err?.message || String(err)}`);
    }
  }

  const scopeClicksText = useMemo(() => {
    if (!result) return null;
    // Support either "scopeClicks" string fields or clicksSigned numeric
    if (result.scopeClicks && (result.scopeClicks.windage || result.scopeClicks.elevation)) {
      return {
        windage: result.scopeClicks.windage || "",
        elevation: result.scopeClicks.elevation || "",
      };
    }
    if (result.clicksSigned) {
      const w = Number(result.clicksSigned.windage);
      const e = Number(result.clicksSigned.elevation);
      const wDir = w >= 0 ? "RIGHT" : "LEFT";
      const eDir = e >= 0 ? "UP" : "DOWN";
      return {
        windage: `${wDir} ${round2(Math.abs(w))} clicks`,
        elevation: `${eDir} ${round2(Math.abs(e))} clicks`,
      };
    }
    return null;
  }, [result]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 44, margin: "8px 0 8px" }}>SCZN3 SEC — Upload Test</h1>

      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Endpoint must be the POST route. Example: <code>https://sczn3-sec-backend-pipe-17.onrender.com/api/sec</code>
      </p>

      <div style={{ border: "2px solid #ddd", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Endpoint</label>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
          placeholder="https://.../api/sec"
        />

        <div style={{ height: 14 }} />

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Target Size</label>
        <input
          value={targetSizeSpec}
          onChange={(e) => setTargetSizeSpec(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
          placeholder='e.g. "8.5x11"'
        />

        <div style={{ height: 14 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Distance (yards)</label>
            <input
              type="number"
              value={distanceYards}
              onChange={(e) => setDistanceYards(Number(e.target.value))}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</label>
            <input
              type="number"
              step="0.01"
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(Number(e.target.value))}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</label>
            <input
              type="number"
              step="0.01"
              value={deadbandIn}
              onChange={(e) => setDeadbandIn(Number(e.target.value))}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
            />
          </div>

          <div />
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</label>
            <input
              type="number"
              step="0.01"
              value={bullX}
              onChange={(e) => setBullX(Number(e.target.value))}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</label>
            <input
              type="number"
              step="0.01"
              value={bullY}
              onChange={(e) => setBullY(Number(e.target.value))}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16 }}
            />
          </div>
        </div>

        <div style={{ height: 14 }} />

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Image (recommended)</label>
        <input type="file" accept="image/*" onChange={onPickFile} />

        <div style={{ height: 14 }} />

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Holes JSON (optional)</label>
        <textarea
          value={holesText}
          onChange={(e) => setHolesText(e.target.value)}
          style={{ width: "100%", height: 110, padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 14 }}
          placeholder='Optional. Example: [{"x":3.9,"y":4.8},{"x":4.0,"y":4.7}]'
        />

        <div style={{ height: 14 }} />

        <button
          onClick={onSend}
          style={{
            width: "100%",
            padding: "16px 14px",
            borderRadius: 12,
            border: "2px solid #1d4ed8",
            background: "white",
            fontSize: 22,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Send
        </button>

        <div style={{ marginTop: 10, fontWeight: 700 }}>
          {status ? <span>Status: {status}</span> : <span>Status: Ready.</span>}
        </div>
      </div>

      {scopeClicksText && (
        <div style={{ marginTop: 14, border: "3px solid #16a34a", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Scope Clicks (Minimal)</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>
            Windage: {scopeClicksText.windage}
            <br />
            Elevation: {scopeClicksText.elevation}
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Show raw JSON
            </label>
          </div>

          {showRaw && result && (
            <pre style={{ marginTop: 10, background: "#111", color: "#fff", padding: 12, borderRadius: 10, overflowX: "auto" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
