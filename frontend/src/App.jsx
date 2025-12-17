import { useMemo, useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Idle");

  const apiBase = useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE_URL || "";
    return raw.replace(/\/+$/, "");
  }, []);

  async function handleUpload() {
    if (!file) {
      setStatus("Choose a file first");
      return;
    }

    try {
      setStatus("Uploading...");

      const form = new FormData();
      form.append("file", file);

      const url = `${apiBase}/api/upload`;

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setStatus(`Upload failed (${res.status}) ${text ? "- " + text : ""}`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      setStatus(`Upload OK ${data?.message ? "- " + data.message : ""}`);
    } catch (err) {
      setStatus(`Upload error: ${err?.message || String(err)}`);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 24 }}>
      <h1>SCZN3 Upload Test</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button onClick={handleUpload}>Upload</button>
      </div>

      <p style={{ marginTop: 12 }}>
        <b>Status:</b> {status}
      </p>

      <p style={{ marginTop: 12, opacity: 0.7 }}>
        <b>API Base:</b> {apiBase || "(missing VITE_API_BASE_URL)"}
      </p>
    </div>
  );
}
