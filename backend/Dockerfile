FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python tensorflow 2>/dev/null || true && \
    pip install --no-cache-dir --force-reinstall opencv-python-headless==4.9.0.80 && \
    python -c "import cv2; print('cv2 OK:', cv2.__version__)"

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
