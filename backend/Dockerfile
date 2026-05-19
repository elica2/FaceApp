FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python 2>/dev/null; \
    pip install --no-cache-dir opencv-python-headless

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
