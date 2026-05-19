import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { registerUser } from "../utils/api";

const TARGET_SHOTS = 8;  // número de capturas recomendadas

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("webcam"); // webcam | upload
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const webcamRef = useRef(null);
  const fileRef = useRef(null);

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return;
    const img = webcamRef.current.getScreenshot({ width: 640, height: 480 });
    if (img) {
      setCaptures((prev) => [...prev, img]);
    }
  }, []);

  const removeCapture = (idx) => {
    setCaptures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const readers = files.map(
      (file) =>
        new Promise((res) => {
          const r = new FileReader();
          r.onload = (ev) => res(ev.target.result);
          r.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((imgs) => setCaptures((prev) => [...prev, ...imgs]));
  };

  const handleRegister = async () => {
    if (!name.trim()) { setError("Escribe el nombre de la persona"); return; }
    if (captures.length === 0) { setError("Captura al menos una foto"); return; }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await registerUser(name.trim(), captures);
      setResult(data);
      if (data.success) {
        setCaptures([]);
        setName("");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Registrar persona</h1>
        <p className="page-subtitle">
          Captura {TARGET_SHOTS} fotos con distintas poses e iluminaciones para mejor precisión
        </p>
      </div>

      <div className="card">
        <div className="card-title">Nombre</div>
        <input
          className="input"
          placeholder="Ej: María García"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn ${mode === "webcam" ? "active" : ""}`} onClick={() => setMode("webcam")}>
          Webcam
        </button>
        <button className={`mode-btn ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
          Archivos
        </button>
      </div>

      {mode === "webcam" && (
        <div className="card">
          <div className="card-title">Cámara</div>
          <div className="webcam-wrap" style={{ maxWidth: 480 }}>
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ width: 480, height: 360, facingMode: "user" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={capturePhoto}
              disabled={captures.length >= TARGET_SHOTS * 2}>
              📸 Capturar
            </button>
            <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
              {captures.length} / {TARGET_SHOTS} recomendadas
            </span>
          </div>
          <div className="capture-progress">
            {Array.from({ length: TARGET_SHOTS }).map((_, i) => (
              <div key={i} className={`dot ${i < captures.length ? "filled" : ""}`} />
            ))}
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="card">
          <div className="card-title">Subir fotos</div>
          <div className="upload-area" onClick={() => fileRef.current.click()}>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileUpload} />
            <p>Haz clic para seleccionar imágenes (puedes elegir varias)</p>
            <p style={{ fontSize: "0.8rem", marginTop: 6 }}>
              JPG, PNG, WEBP — Recomienda {TARGET_SHOTS}+ imágenes por persona
            </p>
          </div>
        </div>
      )}

      {captures.length > 0 && (
        <div className="card">
          <div className="card-title">Capturas ({captures.length})</div>
          <div className="thumb-grid">
            {captures.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt={`capture-${i}`} className="thumb" />
                <button
                  onClick={() => removeCapture(i)}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    background: "var(--error)", border: "none", borderRadius: "50%",
                    width: 18, height: 18, cursor: "pointer", color: "#fff",
                    fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <div className={`alert ${result.success ? "alert-success" : "alert-error"}`}>
          {result.message}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleRegister}
        disabled={loading || !name.trim() || captures.length === 0}
        style={{ width: "100%", justifyContent: "center", padding: "14px" }}
      >
        {loading ? <><span className="spinner" /> Procesando…</> : "✓ Registrar persona"}
      </button>
    </div>
  );
}
