"""
FaceService: lógica central del sistema.
- Detección con MTCNN
- Embeddings con ArcFace (via DeepFace) — más preciso que FaceNet original
- Clasificación por distancia coseno con umbral
- Persistencia en JSON + numpy
"""

import os
import json
import logging
import time
from pathlib import Path

import numpy as np
import cv2
from mtcnn import MTCNN
from deepface import DeepFace
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
DB_FILE = DATA_DIR / "users.json"

EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
DB_FILE.parent.mkdir(parents=True, exist_ok=True)

MODEL_NAME = "ArcFace"          # mejor que FaceNet clásico en LFW benchmark
DETECTOR_BACKEND = "mtcnn"      # MTCNN para detección y alineación
DISTANCE_THRESHOLD = 0.40       # coseno: > umbral → mismo rostro (ArcFace normalizado)
MIN_FACE_CONFIDENCE = 0.90      # confianza mínima MTCNN para aceptar detección
UNKNOWN_LABEL = "Desconocido"

# ─── Clase principal ──────────────────────────────────────────────────────────

class FaceService:
    def __init__(self):
        logger.info("Inicializando FaceService...")
        self.detector = MTCNN()
        self.db: dict[str, np.ndarray] = {}   # name → embedding promedio
        self.user_meta: dict[str, dict] = {}   # name → {n_images, registered_at}
        self._load_db()
        logger.info(f"FaceService listo. Usuarios: {list(self.db.keys())}")

    # ─── Persistencia ─────────────────────────────────────────────────────────

    def _load_db(self):
        """Carga embeddings y metadatos desde disco."""
        if DB_FILE.exists():
            with open(DB_FILE) as f:
                self.user_meta = json.load(f)
        for name in self.user_meta:
            emb_path = EMBEDDINGS_DIR / f"{name}.npy"
            if emb_path.exists():
                self.db[name] = np.load(str(emb_path))

    def _save_db(self):
        """Persiste metadatos en JSON."""
        with open(DB_FILE, "w") as f:
            json.dump(self.user_meta, f, indent=2, ensure_ascii=False)

    def _save_embedding(self, name: str, emb: np.ndarray):
        np.save(str(EMBEDDINGS_DIR / f"{name}.npy"), emb)

    # ─── Detección facial ──────────────────────────────────────────────────────

    def detect_faces(self, img_bgr: np.ndarray) -> list[dict]:
        """
        Detecta rostros con MTCNN.
        Retorna lista de {box, confidence, keypoints}.
        """
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        detections = self.detector.detect_faces(img_rgb)
        return [d for d in detections if d["confidence"] >= MIN_FACE_CONFIDENCE]

    # ─── Embeddings ────────────────────────────────────────────────────────────

    def _get_embedding(self, face_bgr: np.ndarray) -> np.ndarray | None:
        """
        Extrae embedding ArcFace de un recorte facial ya alineado.
        DeepFace normaliza internamente. Retorna vector 512-d.
        """
        try:
            # DeepFace espera BGR o RGB; enforce_detection=False porque ya detectamos
            result = DeepFace.represent(
                img_path=face_bgr,
                model_name=MODEL_NAME,
                enforce_detection=False,
                detector_backend="skip",  # ya tenemos el recorte
                align=True,
            )
            emb = np.array(result[0]["embedding"], dtype=np.float32)
            # Normalizar a norma unitaria para usar similitud coseno directamente
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb
        except Exception as e:
            logger.warning(f"Error extrayendo embedding: {e}")
            return None

    def _extract_face_crop(self, img_bgr: np.ndarray, detection: dict) -> np.ndarray | None:
        """Recorta y alinea el rostro usando los keypoints de MTCNN."""
        x, y, w, h = detection["box"]
        # Clamp coordenadas
        x, y = max(0, x), max(0, y)
        x2 = min(img_bgr.shape[1], x + w)
        y2 = min(img_bgr.shape[0], y + h)
        if x2 <= x or y2 <= y:
            return None

        # Padding del 20% para incluir contexto facial
        pad_x = int(w * 0.2)
        pad_y = int(h * 0.2)
        x1p = max(0, x - pad_x)
        y1p = max(0, y - pad_y)
        x2p = min(img_bgr.shape[1], x2 + pad_x)
        y2p = min(img_bgr.shape[0], y2 + pad_y)

        face = img_bgr[y1p:y2p, x1p:x2p]
        face = cv2.resize(face, (160, 160))  # ArcFace espera 112x112, DeepFace hace resize
        return face

    # ─── Registro ──────────────────────────────────────────────────────────────

    def register_user(self, name: str, images: list[np.ndarray]) -> dict:
        """
        Registra usuario con varias imágenes.
        Promedia los embeddings para mayor robustez.
        """
        embeddings = []
        faces_detected = 0

        for img in images:
            detections = self.detect_faces(img)
            if not detections:
                # Intentar con imagen completa como último recurso
                emb = self._get_embedding(img)
                if emb is not None:
                    embeddings.append(emb)
                continue

            # Tomar el rostro de mayor confianza
            best = max(detections, key=lambda d: d["confidence"])
            face = self._extract_face_crop(img, best)
            if face is None:
                continue
            faces_detected += 1
            emb = self._get_embedding(face)
            if emb is not None:
                embeddings.append(emb)

        if not embeddings:
            return {
                "success": False,
                "message": "No se pudo extraer ningún embedding. Verifica que las imágenes tengan un rostro visible.",
            }

        avg_emb = np.mean(embeddings, axis=0)
        avg_emb = avg_emb / np.linalg.norm(avg_emb)  # renormalizar

        self.db[name] = avg_emb
        self.user_meta[name] = {
            "n_images": len(embeddings),
            "faces_detected": faces_detected,
            "registered_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "model": MODEL_NAME,
        }
        self._save_embedding(name, avg_emb)
        self._save_db()

        return {
            "success": True,
            "name": name,
            "images_processed": len(images),
            "embeddings_extracted": len(embeddings),
            "message": f"'{name}' registrado con {len(embeddings)} embeddings.",
        }

    # ─── Identificación ────────────────────────────────────────────────────────

    def identify(self, img_bgr: np.ndarray) -> list[dict]:
        detections = self.detect_faces(img_bgr)
        results = []

        for det in detections:
            face = self._extract_face_crop(img_bgr, det)
            if face is None:
                continue

            emb = self._get_embedding(face)
            if emb is None:
                continue

            x, y, w, h = det["box"]
            # ← esto es el fix: convertir numpy.int64 a int nativo
            x, y, w, h = int(x), int(y), int(w), int(h)
            x, y = max(0, x), max(0, y)

            raw_kp = det.get("keypoints", {}) or {}
            keypoints = {
                k: [float(v[0]), float(v[1])] if hasattr(v, '__len__') else float(v)
                for k, v in raw_kp.items()
            }

            if not self.db:
                results.append({
                    "name": UNKNOWN_LABEL,
                    "similarity": 0.0,
                    "confidence": round(float(det["confidence"]), 3),
                    "box": {"x": x, "y": y, "w": w, "h": h},
                    "keypoints": keypoints,
                })
                continue

            names = list(self.db.keys())
            stored_embs = np.stack([self.db[n] for n in names])
            similarities = cosine_similarity([emb], stored_embs)[0]

            best_idx = int(np.argmax(similarities))
            best_sim = float(similarities[best_idx])
            best_name = names[best_idx] if best_sim >= DISTANCE_THRESHOLD else UNKNOWN_LABEL

            results.append({
                "name": best_name,
                "similarity": round(best_sim, 4),
                "confidence": round(float(det["confidence"]), 3),
                "box": {"x": x, "y": y, "w": w, "h": h},
                "keypoints": keypoints,
                "all_scores": {n: round(float(s), 4) for n, s in zip(names, similarities)},
            })

        return results

    # ─── Administración ────────────────────────────────────────────────────────

    def list_users(self) -> dict:
        users = []
        for name, meta in self.user_meta.items():
            users.append({"name": name, **meta})
        return {"users": users, "total": len(users)}

    def delete_user(self, name: str) -> bool:
        if name not in self.db:
            return False
        del self.db[name]
        del self.user_meta[name]
        emb_path = EMBEDDINGS_DIR / f"{name}.npy"
        if emb_path.exists():
            emb_path.unlink()
        self._save_db()
        return True

    def get_metrics(self) -> dict:
        return {
            "model": MODEL_NAME,
            "detector": "MTCNN",
            "distance_metric": "cosine_similarity",
            "threshold": DISTANCE_THRESHOLD,
            "registered_users": len(self.db),
            "unknown_label": UNKNOWN_LABEL,
            "embedding_dim": 512,
        }
