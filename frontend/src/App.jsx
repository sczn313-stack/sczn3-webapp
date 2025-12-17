import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [responseText, setResponseText] = useState("");

  const canUpload = useMemo(() => !!file, [file]);

  async function onUpload() {
    if (!file) return;

    setStatus("Uploading...");
    setResponseText("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = `${API_BASE}/api/upload`;
      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      setResponseText(text);

      if (!res.ok) {
        setStatus(`Upload failed (${res.status})`);
        return;
      }

      setStatus("Upload OK");
    } catch (err) {
      setStatus("Upload error");
      setResponseText(String(err));
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>SCZN3 Upload Test</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button onClick={onUpload} disabled={!canUpload}>
          Upload
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status || "Idle"}
      </div>

      {responseText ? (
        <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          {responseText}
        </pre>
      ) : null}
    </div>
  );
}
