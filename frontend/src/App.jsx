import React, { useMemo, useState } from "react";

const APP_BUILD = "NO_DEMO_NO_POPUP__2026-01-01";

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
  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandInches, setDeadbandInches] = useState(0.1);
  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  // Default backend endpoint (PIPE)
  const [endpoint, setEndpoint] = useState("https://sczn3-sec-backend-pipe-17.onrender.com/api/sec");

  const [holesJson, setHolesJson] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [result, setResult] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [sending, setSending] = useState(false);

  const parsedHoles = useMemo(() => safeParseHoles(holesJson), [holesJson]);

  async function onSend() {
    setErrorText("");
    setResult(null);
    setSending(true);

    try {
      const payload = {
        targetSize,
        distanceYards: Number(distanceYards),
        clickValueMoa: Number(clickValueMoa),
        deadbandInches: Number(deadbandInches),
        bullX: Number(bullX),
        bullY: Number(bullY),
      };

      // If holes JSON is valid, include it. If not, we STILL send (no popup).
      if (parsedHoles) payload.holes = parsedHoles;

      // Image not used yet (backend is POIB/holes-only for now), but we keep the chooser.
      // This keeps UI ready for later without blocking the workflow today.
      if (imageFile) payload.imageName = imageFile.name;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && (data.message || data.error)) ||
          `Request failed (${res.status})`;
        setErrorText(String(msg));
        setResult(data);
        return;
      }

      setResult(data);
    } catch (e) {
      setErrorText(e && e.message ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 14, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 10 }}>
        Build: <b>{APP_BUILD}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Target Size</div>
          <select value={targetSize} onChange={(e) => setTargetSize(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }}>
            <option value="8.5x11">8.5x11</option>
            <option value="23x23">23x23</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
          <input
            type="number"
            value={distanceYards}
            onChange={(e) => setDistanceYards(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
          <input
            type="number"
            step="0.01"
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</div>
          <input
            type="number"
            step="0.01"
            value={deadbandInches}
            onChange={(e) => setDeadbandInches(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullX}
            onChange={(e) => setBullX(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullY}
            onChange={(e) => setBullY(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Backend Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, fontSize: 14 }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Example: https://sczn3-sec-backend-pipe-17.onrender.com/api/sec
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Image (optional for now)</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Image is not used by backend yet (holes/POIB only). It will not block Send.
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Holes JSON (in inches)</div>
        <textarea
          value={holesJson}
          onChange={(e) => setHolesJson(e.target.value)}
          rows={8}
          placeholder='Example: [{"x":3.82,"y":4.88},{"x":3.93,"y":4.85}]'
          style={{ width: "100%", padding: 10, fontSize: 14 }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          No popups. If this is empty/invalid, Send will still run and you’ll see the backend message.
        </div>
      </div>

      <button
        onClick={onSend}
        disabled={sending}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 14,
          fontSize: 18,
          fontWeight: 800,
          borderRadius: 12,
          border: "2px solid #1e5aa8",
          background: sending ? "#d9e7ff" : "#ffffff",
        }}
      >
        {sending ? "Sending..." : "Send"}
      </button>

      {errorText ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "2px solid #c22", background: "#fff5f5" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div>{errorText}</div>
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "2px solid #1a7f37", background: "#f1fff6" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>

          <div style={{ opacity: 0.85, marginTop: 6 }}>
            clicksSigned: w={round2(result?.clicksSigned?.windage ?? 0)}, e={round2(result?.clicksSigned?.elevation ?? 0)}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
            <span style={{ fontWeight: 800 }}>Show raw JSON</span>
          </label>

          {showRaw ? (
            <pre
              style={{
                marginTop: 10,
                background: "#111",
                color: "#eee",
                padding: 12,
                borderRadius: 10,
                overflowX: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
