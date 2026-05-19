# Practica 2 — Detección e Identificación Facial

Sistema de visión por computadora que detecta e identifica rostros usando:
- **MTCNN** — detección y alineación facial
- **ArcFace** (via DeepFace) — embeddings discriminativos (512 dimensiones)
- **Similitud coseno** — clasificación/identificación
- **FastAPI** — backend REST
- **React** — interfaz web

> **¿Por qué ArcFace en lugar de FaceNet clásico?**  
> ArcFace supera a FaceNet en los benchmarks estándar (LFW, CFP-FP, AgeDB).  
> En LFW: ArcFace ≈ 99.83% vs FaceNet ≈ 99.63%. Además, el margen aditivo angular  
> que usa durante el entrenamiento produce embeddings más discriminativos y  
> mejor separados entre clases.

---

## Estructura del proyecto

```
Practica2/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI endpoints
│   │   └── face_service.py  # MTCNN + ArcFace + lógica de identificación
│   ├── data/
│   │   ├── embeddings/      # Archivos .npy por persona (generados automáticamente)
│   │   └── users.json       # Metadatos de usuarios
│   ├── evaluate.py          # Evaluación con métricas (para el reporte)
│   ├── requirements.txt
│   ├── Procfile             # Para Railway
│   └── railway.toml
└── frontend/
    ├── src/
    │   ├── pages/           # IdentifyPage, RegisterPage, UsersPage
    │   ├── utils/api.js     # Cliente HTTP
    │   ├── App.jsx
    │   └── App.css
    ├── public/index.html
    ├── package.json
    ├── vercel.json
    └── .env.example
```

---

## Instalación local

### Requisitos previos
- Python 3.10+ 
- Node.js 18+
- Cámara web (para identificación en vivo)

### 1. Backend

```bash
cd backend

# Crear entorno virtual (recomendado)
python -m venv venv
source venv/bin/activate      # Linux/Mac
# o: venv\Scripts\activate    # Windows

# Instalar dependencias
pip install -r requirements.txt

# Los modelos ArcFace y MTCNN se descargan automáticamente la primera vez (~500 MB)

# Ejecutar servidor
uvicorn app.main:app --reload --port 8000
```

El backend queda en: http://localhost:8000  
Documentación interactiva (Swagger): http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

# Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local si el backend está en otra URL

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm start
```

La app queda en: http://localhost:3000

---

## Flujo de uso (interfaz web)

### Registrar nuevas personas
1. Ve a **Registrar**
2. Escribe el nombre
3. Usa la webcam para tomar 8+ fotos (distintas poses, iluminaciones)
4. Haz clic en **Registrar persona**

### Identificar
1. Ve a **Identificar**
2. Modo **Imagen**: carga una foto → clic en "Identificar"
3. Modo **Cámara**: clic en "Iniciar detección" → identifica en tiempo real

### Administrar usuarios
- Ve a **Usuarios** para ver todos los registrados y eliminar si es necesario

---

## Evaluación del sistema

Prepara un conjunto de prueba separado del de entrenamiento:

```
fotos_prueba/
    Nombre_Persona/
        prueba1.jpg
        prueba2.jpg
    Desconocido/       ← fotos de personas NO registradas
        extra1.jpg
```

Ejecuta:

```bash
cd backend
python evaluate.py --test_dir ./fotos_prueba
```

Genera:
- Accuracy global
- Precision / Recall / F1 por persona
- Matriz de confusión
- `evaluation_results.json`

---

## Deploy gratuito en producción

### Backend → Railway

1. Crea cuenta en [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Selecciona la carpeta `backend/` como root
4. Railway detecta `Procfile` y `requirements.txt` automáticamente
5. Agrega variable de entorno: `DATA_DIR=/data`
6. Opcional: adjunta un volumen en `/data` para persistir embeddings
7. Copia la URL pública que genera Railway (ej: `https://faceapp-production.up.railway.app`)

> **Nota sobre persistencia**: Railway en el plan gratuito no garantiza disco persistente.  
> Para persistencia real, adjunta un volumen o usa Railway's plan Hobby ($5/mes).  
> Alternativa gratuita con persistencia: **Render.com** con disco persistente en el plan free.

### Frontend → Vercel

1. Crea cuenta en [vercel.com](https://vercel.com)
2. "Add New Project" → importa el repo, selecciona carpeta `frontend/`
3. Agrega variable de entorno:
   - Nombre: `REACT_APP_API_URL`
   - Valor: la URL de Railway del paso anterior
4. Haz clic en "Deploy"

El frontend queda en `https://tu-proyecto.vercel.app`

---

## Parámetros configurables

En `backend/app/face_service.py`:

| Parámetro | Valor default | Descripción |
|-----------|--------------|-------------|
| `MODEL_NAME` | `"ArcFace"` | Modelo de embeddings (opciones: FaceNet, VGG-Face, Facenet512) |
| `DISTANCE_THRESHOLD` | `0.40` | Umbral similitud coseno para considerar "conocido" |
| `MIN_FACE_CONFIDENCE` | `0.90` | Confianza mínima de MTCNN para aceptar detección |
| `UNKNOWN_LABEL` | `"Desconocido"` | Etiqueta para personas no registradas |

Ajusta `DISTANCE_THRESHOLD` si hay demasiados falsos positivos (sube el umbral) o falsos negativos (bájalo).

---

## Consideraciones éticas

- Las imágenes capturadas se usan exclusivamente con fines académicos.
- Las personas fotografiadas deben dar su consentimiento.
- Las fotos de celebridades descargadas de redes sociales se usan solo para prácticas académicas.
- No distribuir la base de datos fuera del equipo.

---

## Dependencias principales

| Librería | Versión | Propósito |
|----------|---------|-----------|
| fastapi | 0.111 | API REST |
| mtcnn | 0.1.1 | Detección facial |
| deepface | 0.0.92 | Embeddings ArcFace |
| tensorflow | 2.15 | Motor de inference |
| opencv-python-headless | 4.9 | Procesamiento de imagen |
| scikit-learn | 1.4 | Similitud coseno, métricas |
| react | 18.3 | Interfaz web |
| react-webcam | 7.2 | Acceso a cámara |
