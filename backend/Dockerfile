FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

# Instala todo excepto deepface, que se instala sin deps al final
RUN pip install --no-cache-dir $(grep -v "^deepface" requirements.txt) && \
    pip install --no-cache-dir --no-deps deepface==0.0.92 && \
    pip install --no-cache-dir --no-deps retina-face==0.0.13 && \
    python -c "import cv2; import tensorflow; print('cv2:', cv2.__version__, 'tf:', tensorflow.__version__)"

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
