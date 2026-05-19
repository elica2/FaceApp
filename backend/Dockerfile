FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python tensorflow 2>/dev/null; \
    pip install --no-cache-dir opencv-python-headless==4.9.0.80

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
