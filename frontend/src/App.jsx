import React, { useMemo, useState } from "react";

type Hole = { x: number; y: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

const DEMO_HOLES_UL: Hole[] = [
  { x: 3.82, y: 4.88 },
  { x: 3.93, y: 4.85 },
  { x: 4.02, y: 4.79 },
  { x: 3.88, y: 4.78 },
];

function safeParseHoles(text: string): Hole[] | null {
  const t = (text || "").trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return null;
    const holes: Hole[] = [];
    for (const item of v) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.x === "number" &&
        typeof item.y === "number"
      ) {
        holes.push({ x: item.x, y: item.y });
      }
    }
    return holes.length ? holes : null;
  } catch {
    return null;
  }
}

export default function PoibAnchorTest() {
  // Defaults (inches only)
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);

  // bull defaults per your current test page
  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  const [holesJson, setHolesJson] = useState<string>(
    JSON.stringify(DEMO_HOLES_UL, null, 2)
  );

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const holesToUse = useMemo(() => {
    return safeParseHoles(holesJson) ?? DEMO_HOLES_UL;
  }, [holesJson]);

  const loadDemoUL = () => {
    setHolesJson(JSON.stringify(DEMO_HOLES_UL, null, 2));
    setStatus("Loaded Demo Holes (UL).");
  };

  async function send() {
    setStatus("Sending...");
    setResult(null);

    // Always send holes. No popup. No blocking.
    const holes = holesToUse;

    try {
      // If you have a backend route that accepts multipart image, keep it.
      // If not, the backend can ignore image. This will still work.
      const form = new FormData();

      // optional image
      if (file) form.append("image", file);

      // REQUIRED fields (in inches / yards / MOA)
      form.append("targetSizeSpec", targetSizeSpec);
      form.append("distanceYards", String(distanceYards));
      form.append("clickValueMoa", String(clickValueMoa));
      form.append("deadbandIn", String(deadbandIn));

      // bull + holes
      form.append("bullX", String(bullX));
      form.append("bullY", String(bullY));
      form.append("holes", JSON.stringify(holes));

      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`Error: ${res.status}`);
        setResult(data);
        return;
      }

      setStatus("Done.");
      setResult(data);
    } catch (e: any) {
      setStatus(`Network error: ${e?.message || "unknown"}`);
      setResult({ ok: false, error: { code: "NETWORK_ERROR" } });
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "8px 0 16px" }}>POIB Anchor Test</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label><b>Target Size</b></label>
          <input
            value={targetSizeSpec}
            onChange={(e) => setTargetSizeSpec(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label><b>Distance (yards)</b></label>
          <input
            type="number"
            value={distanceYards}
            onChange={(e) => setDistanceYards(Number(e.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label><b>Click Value (MOA)</b></label>
          <input
            type="number"
            step="0.01"
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(Number(e.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label><b>Deadband (inches)</b></label>
          <input
            type="number"
            step="0.01"
            value={deadbandIn}
            onChange={(e) => setDeadbandIn(Number(e.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label><b>Bull X (inches)</b></label>
          <input
            type="number"
            step="0.01"
            value={bullX}
            onChange={(e) => setBullX(Number(e.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label><b>Bull Y (inches)</b></label>
          <input
            type="number"
            step="0.01"
            value={bullY}
            onChange={(e) => setBullY(Number(e.target.value))}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label><b>Endpoint (POST)</b></label>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label><b>Image (optional for now)</b></label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label><b>Holes JSON (in inches)</b></label>
        <textarea
          value={holesJson}
          onChange={(e) => setHolesJson(e.target.value)}
          rows={8}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={loadDemoUL} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #bbb" }}>
            Load Demo Holes (UL)
          </button>
          <button onClick={send} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #111" }}>
            Send
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
          Using {holesToUse.length} holes. (If Holes JSON is blank/invalid, it automatically uses Demo Holes.)
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}>
        <b>Status:</b> {status || "—"}
      </div>

      {result && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Response</h3>
          <pre style={{ padding: 12, borderRadius: 12, background: "#111", color: "#eee", overflowX: "auto" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.75 }}>
        Note: If you keep using the same holes (Demo Holes), you’ll keep getting the same output—regardless of what image you pick.
      </div>
    </div>
  );
}
