import React, { useState } from "react";

const round2 = (n) => Math.round(n * 100) / 100;

export default function App() {
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [file, setFile] = useState(null);

  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.10);

  // Defaults you locked earlier:
  const [bullXIn, setBullXIn] = useState(4.25);
  const [bullYIn, setBullYIn] = useState(5.50);

  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [showJson, setShowJson] = useState(true);

  async function onSend() {
    setStatus("");
    setResult(null);

    // HARD RULE: this page works ONLY from image upload now.
    if (!file) {
      setStatus("Choose an image first.");
      return;
    }

    // Safety: endpoint must look like a POST URL
    if (!endpoint || !endpoint.startsWith("http")) {
      setStatus("Endpoint is missing or invalid.");
      return;
    }

    try {
      setStatus("Sending…");

      const fd = new FormData();
      fd.append("image", file);
      fd.append("targetSizeSpec", String(targetSizeSpec));
      fd.append("distanceYards", String(distanceYards));
      fd.append("clickValueMoa", String(clickValueMoa));
      fd.append("deadbandIn", String(deadbandIn));
      fd.append("bullXIn", String(bullXIn));
      fd.append("bullYIn", String(bullYIn));

      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        setStatus(`Error (${res.status})`);
        setResult(json || { ok: false, error: { code: "BAD_RESPONSE" } });
        return;
      }

      setResult(json);

      if (json.ok) setStatus("Done.");
      else setStatus("Can't compute.");
    } catch (e) {
      setStatus("Network/server error.");
      setResult({ ok: false, error: { code: "NETWORK_ERROR", message: String(e) } });
    }
  }

  const clicks = result?.clicksSigned;
  const scope = result?.scopeClicks;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>SCZN3 SEC — Upload Test</h1>

      <p style={{ marginTop: 0 }}>
        Endpoint must be the <b>POST</b> route (example ends in <b>/api/sec</b>)
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
        <label style={{ display: "block", fontWeight: 600 }}>Endpoint</label>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
        />

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 600 }}>Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ marginTop: 6 }}
          />
          {file && (
            <div style={{ marginTop: 6, fontSize: 14 }}>
              Selected: <b>{file.name}</b>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Target Size</label>
            <select
              value={targetSizeSpec}
              onChange={(e) => setTargetSizeSpec(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            >
              <option value="8.5x11">8.5x11</option>
              <option value="11x8.5">11x8.5</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Distance (yards)</label>
            <input
              type="number"
              value={distanceYards}
              onChange={(e) => setDistanceYards(Number(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Click Value (MOA)</label>
            <input
              type="number"
              step="0.01"
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(Number(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Deadband (inches)</label>
            <input
              type="number"
              step="0.01"
              value={deadbandIn}
              onChange={(e) => setDeadbandIn(Number(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Bull X (inches)</label>
            <input
              type="number"
              step="0.01"
              value={bullXIn}
              onChange={(e) => setBullXIn(Number(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600 }}>Bull Y (inches)</label>
            <input
              type="number"
              step="0.01"
              value={bullYIn}
              onChange={(e) => setBullYIn(Number(e.target.value))}
              style={{ width: "100%", padding: 10, fontSize: 16, marginTop: 6 }}
            />
          </div>
        </div>

        <button
          onClick={onSend}
          style={{
            width: "100%",
            marginTop: 14,
            padding: 14,
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 10,
            border: "2px solid #2b6cb0",
            background: "white",
            cursor: "pointer",
          }}
        >
          Send
        </button>

        <div style={{ marginTop: 10, fontWeight: 700 }}>Status: {status || "—"}</div>
      </div>

      {/* Output */}
      {result && (
        <div style={{ marginTop: 14, border: "2px solid #2f855a", borderRadius: 10, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Scope Clicks</h2>

          {result.ok && scope ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Windage: {scope.windage}
                <br />
                Elevation: {scope.elevation}
              </div>
              {clicks && (
                <div style={{ marginTop: 8, fontFamily: "monospace" }}>
                  clicksSigned: w={round2(clicks.windage)}, e={round2(clicks.elevation)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              CAN’T COMPUTE
              <div style={{ marginTop: 6, fontWeight: 600 }}>
                Error: {result?.error?.code || "UNKNOWN"}
              </div>
            </div>
          )}

          <label style={{ display: "block", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={showJson}
              onChange={(e) => setShowJson(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Show raw JSON
          </label>

          {showJson && (
            <pre
              style={{
                marginTop: 10,
                background: "#111",
                color: "#eee",
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
      )}
    </div>
  );
}
