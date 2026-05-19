FROM python:3.10-slim

# Instala las librerías del sistema que necesita opencv-python
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    python -c "import cv2; import tensorflow; print('cv2:', cv2.__version__, 'tf:', tensorflow.__version__)"

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
