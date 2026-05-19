"""
FaceApp Backend — FastAPI
Detección: MTCNN
Embeddings: DeepFace con ArcFace (mejor que FaceNet original)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import base64
import numpy as np
import cv2
import json
import os

from app.face_service import FaceService

app = FastAPI(title="FaceApp API", version="1.0.0")

# CORS — permite cualquier origen (ajusta en producción si quieres)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

face_service = FaceService()


# ─── Utilidades ───────────────────────────────────────────────────────────────

def decode_image(data_url: str) -> np.ndarray:
    """Decodifica base64 data-URL a imagen BGR numpy array."""
    header, encoded = data_url.split(",", 1)
    img_bytes = base64.b64decode(encoded)
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Imagen inválida")
    return img


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "FaceApp API corriendo"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/users")
def list_users():
    """Lista todos los usuarios registrados con sus metadatos."""
    return face_service.list_users()


@app.post("/register")
async def register_user(
    name: str = Form(...),
    images: list[UploadFile] = File(...),
):
    """
    Registra un nuevo usuario con N imágenes.
    Extrae embeddings de cada imagen y guarda el promedio.
    """
    if not name.strip():
        raise HTTPException(status_code=400, detail="Nombre vacío")

    raw_images = []
    for upload in images:
        content = await upload.read()
        arr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            raw_images.append(img)

    if not raw_images:
        raise HTTPException(status_code=400, detail="No se pudieron leer las imágenes")

    result = face_service.register_user(name.strip(), raw_images)
    return result


@app.post("/register-base64")
async def register_user_base64(payload: dict):
    """
    Registra usuario con imágenes en base64 (para webcam).
    Body: { "name": str, "images": [data_url, ...] }
    """
    name = payload.get("name", "").strip()
    images_b64 = payload.get("images", [])

    if not name:
        raise HTTPException(status_code=400, detail="Nombre vacío")
    if not images_b64:
        raise HTTPException(status_code=400, detail="Sin imágenes")

    raw_images = []
    for data_url in images_b64:
        try:
            img = decode_image(data_url)
            raw_images.append(img)
        except Exception:
            continue

    if not raw_images:
        raise HTTPException(status_code=400, detail="No se pudieron decodificar las imágenes")

    result = face_service.register_user(name, raw_images)
    return result


@app.post("/identify")
async def identify(payload: dict):
    """
    Identifica rostros en una imagen.
    Body: { "image": data_url }
    Returns: lista de detecciones con nombre, confianza y bounding box.
    """
    data_url = payload.get("image", "")
    if not data_url:
        raise HTTPException(status_code=400, detail="Sin imagen")

    img = decode_image(data_url)
    results = face_service.identify(img)
    return {"detections": results}


@app.delete("/users/{name}")
def delete_user(name: str):
    """Elimina un usuario de la base de datos."""
    ok = face_service.delete_user(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Usuario '{name}' no encontrado")
    return {"message": f"Usuario '{name}' eliminado"}


@app.get("/metrics")
def get_metrics():
    """Devuelve métricas básicas del sistema."""
    return face_service.get_metrics()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
