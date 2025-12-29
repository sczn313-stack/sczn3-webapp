import React, { useMemo, useState } from "react";

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
function fmt2(n) {
  return round2(n).toFixed(2);
}

function parseLongSideInches(raw) {
  const s = String(raw || "").trim().toLowerCase().replaceAll("×", "x");
  if (!s) return { ok: false, reason: "EMPTY" };

  // number like "11" or "23"
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: "BAD_NUMBER" };
    return { ok: true, spec: s, long: n, short: null };
  }

  // "8.5x11"
  const m = s.replaceAll(" ", "").match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
  if (!m) return { ok: false, reason: "BAD_FORMAT" };

  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return { ok: false, reason: "BAD_DIMS" };
  }

  return { ok: true, spec: `${a}x${b}`, long: Math.max(a, b), short: Math.min(a, b) };
}

function dialFromSignedClicks(clicksSigned) {
  const w = Number(clicksSigned?.windage ?? 0);
  const e = Number(clicksSigned?.elevation ?? 0);

  const windDir = w > 0 ? "RIGHT" : w < 0 ? "LEFT" : "CENTER";
  const elevDir = e > 0 ? "UP" : e < 0 ? "DOWN" : "LEVEL";

  return {
    windDir,
    elevDir,
    windAbs: Math.abs(w),
    elevAbs: Math.abs(e),
    windText: windDir === "CENTER" ? "CENTER 0.00 clicks" : `${windDir} ${fmt2(Math.abs(w))} clicks`,
    elevText: elevDir === "LEVEL" ? "LEVEL 0.00 clicks" : `${elevDir} ${fmt2(Math.abs(e))} clicks`,
  };
}

function approxEqual(a, b, tol = 0.02) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= tol;
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [targetPreset, setTargetPreset] = useState("8.5x11");
  const [targetSpecRaw, setTargetSpecRaw] = useState("8.5x11");

  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);

  const [status, setStatus] = useState("");
  const [resp, setResp] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const [incongruences, setIncongruences] = useState([]);

  const parsedTarget = useMemo(() => parseLongSideInches(targetSpecRaw), [targetSpecRaw]);

  const expectedLongSide = parsedTarget.ok ? parsedTarget.long : null;

  const uiDial = useMemo(() => {
    if (!resp?.clicksSigned) return null;
    return dialFromSignedClicks(resp.clicksSigned);
  }, [resp]);

  function onChooseFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setIncongruences([]);
    setStatus("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  function onPresetChange(v) {
    setTargetPreset(v);
    setTargetSpecRaw(v);
    setResp(null);
    setIncongruences([]);
    setStatus("");
  }

  async function onSend() {
    setResp(null);
    setIncongruences([]);
    setStatus("");

    if (!file) {
      setStatus("Choose an image first.");
      return;
    }

    if (!parsedTarget.ok) {
      setStatus("Target size is invalid. Use 8.5x11 or a number like 23.");
      return;
    }

    const dist = Number(distanceYards);
    const click = Number(clickValueMoa);

    if (!Number.isFinite(dist) || dist <= 0) {
      setStatus("Distance must be > 0.");
      return;
    }
    if (!Number.isFinite(click) || click <= 0) {
      setStatus("Click value must be > 0.");
      return;
    }

    setStatus("Sending...");

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("distanceYards", String(dist));
      fd.append("clickValueMoa", String(click));
      // IMPORTANT: always send LONG SIDE inches only (ex: 11 for 8.5x11)
      fd.append("targetSizeInches", String(parsedTarget.long));

      const r = await fetch(endpoint, { method: "POST", body: fd });
      const json = await r.json().catch(() => null);

      if (!r.ok || !json) {
        setStatus("Backend error.");
        setResp(json || { ok: false, error: { code: "BAD_RESPONSE" } });
        return;
      }

      setResp(json);
      setStatus("Done.");

      // Congruence gate
      const issues = [];

      const backendTarget = Number(json?.sec?.targetSizeInches);
      if (Number.isFinite(backendTarget) && !approxEqual(backendTarget, parsedTarget.long, 0.02)) {
        issues.push({
          code: "TARGET_SIZE_INCONGRUENT",
          expectedLongSide: parsedTarget.long,
          backendTargetSizeInches: backendTarget,
          fix: "Frontend must send long-side inches only; backend must echo the same value."
        });
      }

      // Direction congruence (UI must trust clicksSigned, not backend dial strings)
      const bDialW = String(json?.dial?.windage || "");
      const bDialE = String(json?.dial?.elevation || "");
      const ui = dialFromSignedClicks(json?.clicksSigned);

      if (bDialW && !bDialW.toUpperCase().includes(ui.windDir)) {
        issues.push({
          code: "WINDAGE_DIRECTION_INCONGRUENT",
          clicksSignedWindage: json?.clicksSigned?.windage,
          uiDial: ui.windText,
          backendDial: bDialW,
          fix: "Ignore backend dial strings. UI direction must be derived from clicksSigned only."
        });
      }

      if (bDialE && !bDialE.toUpperCase().includes(ui.elevDir)) {
        issues.push({
          code: "ELEVATION_DIRECTION_INCONGRUENT",
          clicksSignedElevation: json?.clicksSigned?.elevation,
          uiDial: ui.elevText,
          backendDial: bDialE,
          fix: "Ignore backend dial strings. UI direction must be derived from clicksSigned only."
        });
      }

      setIncongruences(issues);
    } catch (e) {
      setStatus("Network error.");
      setResp({ ok: false, error: { code: "NETWORK", message: String(e?.message || e) } });
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18 }}>
      <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 10 }}>SCZN3 SEC — Upload Test</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Endpoint</div>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            style={{ width: "100%", padding: 10, border: "2px solid #111", borderRadius: 10 }}
          />
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
            POST multipart field: <b>image</b>
          </div>

          <div style={{ height: 14 }} />

          <div style={{ fontWeight: 800, marginBottom: 6 }}>Choose file</div>
          <input type="file" accept="image/*" onChange={onChooseFile} />
          {file ? (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>{file.name}</div>
          ) : null}

          <div style={{ height: 16 }} />

          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Target Size</div>

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <select
              value={targetPreset}
              onChange={(e) => onPresetChange(e.target.value)}
              style={{ padding: 10, border: "2px solid #111", borderRadius: 10 }}
            >
              <option value="8.5x11">8.5x11</option>
              <option value="23">23</option>
            </select>

            <input
              value={targetSpecRaw}
              onChange={(e) => setTargetSpecRaw(e.target.value)}
              placeholder="8.5x11 or 23"
              style={{ padding: 10, border: "2px solid #111", borderRadius: 10 }}
            />
          </div>

          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
            {parsedTarget.ok ? (
              <span>
                Parsed: spec={parsedTarget.spec}{" "}
                {parsedTarget.short ? (
                  <>
                    long={fmt2(parsedTarget.long)} short={fmt2(parsedTarget.short)}
                  </>
                ) : (
                  <>long={fmt2(parsedTarget.long)}</>
                )}
              </span>
            ) : (
              <span>Target size required (8.5x11 or 23)</span>
            )}
          </div>

          <div style={{ height: 16 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Distance (yards)</div>
              <input
                value={distanceYards}
                onChange={(e) => setDistanceYards(e.target.value)}
                style={{ width: "100%", padding: 10, border: "2px solid #111", borderRadius: 10 }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Click Value (MOA)</div>
              <input
                value={clickValueMoa}
                onChange={(e) => setClickValueMoa(e.target.value)}
                style={{ width: "100%", padding: 10, border: "2px solid #111", borderRadius: 10 }}
              />
            </div>
          </div>

          <div style={{ height: 14 }} />

          <button
            onClick={onSend}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 20,
              fontWeight: 900,
              border: "3px solid #1a56ff",
              borderRadius: 12,
              background: "#eaf0ff",
              cursor: "pointer",
            }}
          >
            Send (with Congruence Gate)
          </button>

          <div style={{ marginTop: 10, fontWeight: 800 }}>Status: <span style={{ fontWeight: 600 }}>{status || "—"}</span></div>

          {resp?.ok && uiDial ? (
            <div style={{ marginTop: 14, border: "3px solid #1c8b3a", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Scope Clicks (Minimal)</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Windage: {uiDial.windDir} {fmt2(uiDial.windAbs)} clicks
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                Elevation: {uiDial.elevDir} {fmt2(uiDial.elevAbs)} clicks
              </div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                clicksSigned: w={fmt2
