import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { identifyImage } from "../utils/api";

const COLORS = {
  known: "#4ade80",
  unknown: "#f87171",
};

function drawDetections(canvas, img, detections) {
  const ctx = canvas.getContext("2d");
  canvas.width = img.naturalWidth || img.videoWidth || img.width;
  canvas.height = img.naturalHeight || img.videoHeight || img.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / (img.clientWidth || img.offsetWidth || canvas.width);
  const scaleY = canvas.height / (img.clientHeight || img.offsetHeight || canvas.height);

  for (const det of detections) {
    const { x, y, w, h } = det.box;
    const isKnown = det.name !== "Desconocido";
    const color = isKnown ? COLORS.known : COLORS.unknown;

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    // Label background
    const label = `${det.name}  ${(det.similarity * 100).toFixed(1)}%`;
    ctx.font = "bold 14px 'Space Mono', monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 24, tw + 12, 22);

    // Label text
    ctx.fillStyle = "#000";
    ctx.fillText(label, x + 6, y - 7);

    // Keypoints
    if (det.keypoints) {
      for (const [, pt] of Object.entries(det.keypoints)) {
        if (!pt || pt.length < 2) continue;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 3, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }
}

// ─── Upload mode ──────────────────────────────────────────
function UploadIdentify() {
  const [imgSrc, setImgSrc] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImgSrc(ev.target.result);
      setDetections([]);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleIdentify = useCallback(async () => {
    if (!imgSrc) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await identifyImage(imgSrc);
      setDetections(data.detections || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al identificar");
    } finally {
      setLoading(false);
    }
  }, [imgSrc]);

  useEffect(() => {
    if (imgRef.current && canvasRef.current && detections.length > 0) {
      const img = imgRef.current;
      const draw = () => drawDetections(canvasRef.current, img, detections);
      if (img.complete) draw();
      else img.onload = draw;
    }
  }, [detections, imgSrc]);

  return (
    <div className="card">
      <div className="card-title">Cargar imagen</div>

      <div className="upload-area" onClick={() => fileRef.current.click()}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
        {imgSrc
          ? <div style={{ position: "relative", display: "inline-block" }}>
              <img ref={imgRef} src={imgSrc} alt="upload"
                style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 8 }} />
              <canvas ref={canvasRef}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
            </div>
          : <p>Haz clic o arrastra una imagen aquí</p>
        }
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleIdentify}
          disabled={!imgSrc || loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? "Identificando…" : "Identificar"}
        </button>
        {imgSrc && <button className="btn btn-ghost" onClick={() => { setImgSrc(null); setDetections([]); }}>
          Limpiar
        </button>}
      </div>

      {detections.length > 0 && (
        <div className="detection-list">
          {detections.map((d, i) => (
            <div key={i} className={`detection-item ${d.name === "Desconocido" ? "unknown" : "known"}`}>
              <div className="detection-name">{d.name}</div>
              <span className="detection-sim">
                sim {(d.similarity * 100).toFixed(1)}%
              </span>
              <span className={`badge ${d.name === "Desconocido" ? "badge-error" : "badge-success"}`}>
                {d.name === "Desconocido" ? "DESCONOCIDO" : "IDENTIFICADO"}
              </span>
            </div>
          ))}
        </div>
      )}

      {imgSrc && detections.length === 0 && !loading && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 12 }}>
          No se detectaron rostros o aún no has identificado.
        </p>
      )}
    </div>
  );
}

// ─── Live webcam mode ─────────────────────────────────────
function LiveIdentify() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState([]);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  const doIdentify = useCallback(async () => {
    if (!webcamRef.current) return;
    const img = webcamRef.current.getScreenshot({ width: 640, height: 480 });
    if (!img) return;
    try {
      const { data } = await identifyImage(img);
      const dets = data.detections || [];
      setDetections(dets);
      // Draw on overlay canvas
      if (canvasRef.current && webcamRef.current.video) {
        drawDetections(canvasRef.current, webcamRef.current.video, dets);
      }
    } catch {
      // silencioso durante live
    }
  }, []);

  const startLive = () => {
    setRunning(true);
    setError("");
    intervalRef.current = setInterval(doIdentify, 1200);
  };

  const stopLive = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setDetections([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div className="card">
      <div className="card-title">Cámara en vivo</div>

      <div className="webcam-wrap" style={{ maxWidth: 640, position: "relative" }}>
        <Webcam ref={webcamRef} screenshotFormat="image/jpeg"
          videoConstraints={{ width: 640, height: 480, facingMode: "user" }} />
        <canvas ref={canvasRef}
          className="webcam-overlay-canvas"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        {!running
          ? <button className="btn btn-primary" onClick={startLive}>Iniciar detección</button>
          : <button className="btn btn-danger" onClick={stopLive}>Detener</button>
        }
        {running && <span style={{ color: "var(--accent)", fontSize: "0.8rem", fontFamily: "var(--mono)" }}>
          ● En vivo
        </span>}
      </div>

      {detections.length > 0 && (
        <div className="detection-list">
          {detections.map((d, i) => (
            <div key={i} className={`detection-item ${d.name === "Desconocido" ? "unknown" : "known"}`}>
              <div className="detection-name">{d.name}</div>
              <span className="detection-sim">sim {(d.similarity * 100).toFixed(1)}%</span>
              <span className={`badge ${d.name === "Desconocido" ? "badge-error" : "badge-success"}`}>
                {d.name === "Desconocido" ? "DESCONOCIDO" : "IDENTIFICADO"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function IdentifyPage() {
  const [mode, setMode] = useState("upload");

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Identificación facial</h1>
        <p className="page-subtitle">Detecta e identifica rostros en tiempo real o desde una imagen</p>
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
          Imagen
        </button>
        <button className={`mode-btn ${mode === "live" ? "active" : ""}`} onClick={() => setMode("live")}>
          Cámara
        </button>
      </div>

      {mode === "upload" ? <UploadIdentify /> : <LiveIdentify />}
    </div>
  );
}
