import React, { useMemo, useState } from "react";

type Hole = { x: number; y: number };

type ApiResult = any;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizePostEndpoint(raw: string) {
  const s = (raw || "").trim().replace(/\/+$/, "");
  if (!s) return "";
  // If user already typed /api/sec, keep it. Otherwise append it.
  if (s.endsWith("/api/sec")) return s;
  return `${s}/api/sec`;
}

function safeParseHoles(text: string): Hole[] | null {
  const t = (text || "").trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return null;
    const holes: Hole[] = v
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    return holes.length ? holes : null;
  } catch {
    return null;
  }
}

function demoHoles(which: "UL" | "UR" | "LL" | "LR"): Hole[] {
  // Bull defaults are (4.25, 5.50). These demo holes are placed in each quadrant relative to that bull.
  // Coordinates are in INCHES.
  switch (which) {
    case "UL":
      return [
        { x: 3.95, y: 4.80 },
        { x: 3.88, y: 4.78 },
        { x: 4.02, y: 4.86 },
        { x: 3.90, y: 4.85 },
      ];
    case "UR":
      return [
        { x: 4.55, y: 4.85 },
        { x: 4.62, y: 4.78 },
        { x: 4.58, y: 4.92 },
        { x: 4.70, y: 4.83 },
      ];
    case "LL":
      return [
        { x: 3.95, y: 5.85 },
        { x: 3.88, y: 5.78 },
        { x: 4.02, y: 5.92 },
        { x: 3.90, y: 5.88 },
      ];
    case "LR":
      return [
        { x: 4.55, y: 5.85 },
        { x: 4.62, y: 5.78 },
        { x: 4.58, y: 5.92 },
        { x: 4.70, y: 5.83 },
      ];
  }
}

export default function App() {
  // Defaults (your SCZN3 defaults)
  const [endpointBase, setEndpointBase] = useState<string>(
    "https://sczn3-sec-backend-pipe-17.onrender.com"
  );
  const postUrl = useMemo(() => normalizePostEndpoint(endpointBase), [endpointBase]);

  const [targetSizeSpec, setTargetSizeSpec] = useState<string>("8.5x11");
  const [distanceYards, setDistanceYards] = useState<number>(100);
  const [clickValueMoa, setClickValueMoa] = useState<number>(0.25);
  const [deadbandIn, setDeadbandIn] = useState<number>(0.1);

  const [bullX, setBullX] = useState<number>(4.25);
  const [bullY, setBullY] = useState<number>(5.5);

  const [imageFile, setImageFile] = useState<File | null>(null);

  // Optional advanced override only (NOT required)
  const [holesText, setHolesText] = useState<string>("");

  const [status, setStatus] = useState<string>("Ready.");
  const [result, setResult] = useState<ApiResult | null>(null);

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showRawJson, setShowRawJson] = useState<boolean>(true);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    // Important: if you change target/image, clear prior result so you don't think it's "same output"
    setResult(null);
    setStatus("Ready.");
  }

  function loadDemo(which: "UL" | "UR" | "LL" | "LR") {
    const holes = demoHoles(which);
    setHolesText(JSON.stringify(holes, null, 2));
    setShowAdvanced(true);
    setResult(null);
    setStatus(`Demo holes loaded (${which}).`);
  }

  async function handleSend() {
    setResult(null);

    if (!postUrl) {
      setStatus("Missing endpoint.");
      return;
    }

    const holes = safeParseHoles(holesText);

    // ✅ NO POPUP. Only block if BOTH are missing.
    if (!imageFile && !holes) {
      setStatus("Pick an image OR press Demo Holes. (Holes JSON is optional.)");
      return;
    }

    setStatus("Sending...");

    try {
      let res: Response;

      // ✅ Preferred path: Image upload (no Holes JSON required)
      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);

        // send all params as strings (safe for FormData)
        fd.append("targetSizeSpec", String(targetSizeSpec || ""));
        fd.append("distanceYards", String(distanceYards));
        fd.append("clickValueMoa", String(clickValueMoa));
        fd.append("deadbandIn", String(deadbandIn));
        fd.append("bullX", String(bullX));
        fd.append("bullY", String(bullY));

        // optional override: if holes JSON exists, include it too
        if (holes) fd.append("holesJson", JSON.stringify(holes));

        res = await fetch(postUrl, {
          method: "POST",
          body: fd,
          cache: "no-store",
          headers: {
            // helps avoid any weird caching/proxy behavior
            "X-Request-ID": String(Date.now()),
          },
        });
      } else {
        // Fallback path: holes-only JSON request
        const payload = {
          targetSizeSpec,
          distanceYards,
          clickValueMoa,
          deadbandIn,
          bull: { x: bullX, y: bullY },
          holes,
        };

        res = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": String(Date.now()),
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(`Error ${res.status}`);
        setResult(json);
        return;
      }

      setStatus("Done.");
      setResult(json);
    } catch (e: any) {
      setStatus("Network error.");
      setResult({ ok: false, error: String(e?.message || e) });
    }
  }

  // Pretty output
  const windageText =
    result?.scopeClicks?.windage ??
    (typeof result?.clicksSigned?.windage === "number"
      ? `${result.clicksSigned.windage >= 0 ? "RIGHT" : "LEFT"} ${Math.abs(
          round2(result.clicksSigned.windage)
        )} clicks`
      : "");

  const elevationText =
    result?.scopeClicks?.elevation ??
    (typeof result?.clicksSigned?.elevation === "number"
      ? `${result.clicksSigned.elevation >= 0 ? "UP" : "DOWN"} ${Math.abs(
          round2(result.clicksSigned.elevation)
        )} clicks`
      : "");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: "8px 0 14px 0" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          Endpoint must be the POST route. Example: <code>{postUrl || "https://.../api/sec"}</code>
        </div>

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Endpoint</label>
        <input
          value={endpointBase}
          onChange={(e) => setEndpointBase(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #bbb",
            marginBottom: 12,
          }}
          placeholder="https://sczn3-sec-backend-pipe-17.onrender.com"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Target Size</label>
            <input
              value={targetSizeSpec}
              onChange={(e) => setTargetSizeSpec(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
              placeholder="8.5x11"
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              Distance (yards)
            </label>
            <input
              value={distanceYards}
              onChange={(e) => setDistanceYards(Number(e.target.value))}
              type="number"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              Click Value (MOA)
            </label>
            <input
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(Number(e.target.value))}
              type="number"
              step="0.01"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              Deadband (inches)
            </label>
            <input
              value={deadbandIn}
              onChange={(e) => setDeadbandIn(Number(e.target.value))}
              type="number"
              step="0.01"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              Bull X (inches)
            </label>
            <input
              value={bullX}
              onChange={(e) => setBullX(Number(e.target.value))}
              type="number"
              step="0.01"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
              Bull Y (inches)
            </label>
            <input
              value={bullY}
              onChange={(e) => setBullY(Number(e.target.value))}
              type="number"
              step="0.01"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
            Image (optional — but recommended)
          </label>
          <input type="file" accept="image/*" onChange={onPickFile} />
          {imageFile ? (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Selected: <b>{imageFile.name}</b>
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
              No image selected.
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <button
            onClick={() => loadDemo("UL")}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "2px solid #2b6cb0",
              background: "white",
              fontSize: 18,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Load Demo Holes (UL)
          </button>

          <button
            onClick={handleSend}
            style={{
              padding: 14,
              borderRadius: 10,
              border: "2px solid #2b6cb0",
              background: "white",
              fontSize: 18,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>Status: {status}</div>

        {/* Output box */}
        {result && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              border: "2px solid #2f855a",
              background: "#f0fff4",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Scope Clicks</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Windage: {windageText || "(none)"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Elevation: {elevationText || "(none)"}
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={showRawJson}
                  onChange={(e) => setShowRawJson(e.target.checked)}
                />
                Show raw JSON
              </label>

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #999",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </button>
            </div>

            {showRawJson && (
              <pre
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  background: "#111",
                  color: "#fff",
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Advanced: holes JSON override (optional) */}
        {showAdvanced && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Advanced (optional)</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
              Holes JSON is <b>NOT required</b>. Only use this if you want to override detection.
              Format: <code>[{"{"}"x":1.23,"y":4.56{"}"}]</code>
            </div>
            <textarea
              value={holesText}
              onChange={(e) => setHolesText(e.target.value)}
              rows={10}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #bbb" }}
              placeholder='[{"x":3.94,"y":4.80}]'
            />

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => loadDemo("UR")}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #999" }}
              >
                Demo UR
              </button>
              <button
                onClick={() => loadDemo("LL")}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #999" }}
              >
                Demo LL
              </button>
              <button
                onClick={() => loadDemo("LR")}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #999" }}
              >
                Demo LR
              </button>
              <button
                onClick={() => {
                  setHolesText("");
                  setStatus("Advanced holes cleared.");
                }}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #999" }}
              >
                Clear Holes JSON
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Tip: If you change targets/images and still see “same output,” it’s usually because you’re
        still using the same demo holes. Clear Holes JSON or upload a new image and hit Send.
      </div>
    </div>
  );
}
