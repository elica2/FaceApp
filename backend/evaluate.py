"""
evaluate.py
───────────
Evalúa el sistema con un conjunto de prueba separado y genera métricas
para incluir en el reporte: precisión, recall, F1, matriz de confusión.

Uso:
    python evaluate.py --test_dir ./fotos_prueba

Estructura esperada:
    fotos_prueba/
        Nombre_Persona/
            prueba1.jpg
            ...
        Desconocido/        ← imágenes de personas NO registradas
            extra1.jpg
            ...
"""

import sys
import argparse
import json
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

import cv2
import numpy as np
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)

from app.face_service import FaceService

UNKNOWN = "Desconocido"


def evaluate(test_dir: str):
    service = FaceService()
    test_path = Path(test_dir)

    y_true, y_pred = [], []
    details = []

    subdirs = [d for d in test_path.iterdir() if d.is_dir()]
    print(f"\n{'─'*55}")
    print(f"  Evaluando con {len(subdirs)} clase(s) en {test_dir}")
    print(f"{'─'*55}\n")

    for cls_dir in sorted(subdirs):
        true_label = cls_dir.name.replace("_", " ")
        imgs = list(cls_dir.glob("*.jpg")) + list(cls_dir.glob("*.jpeg")) + \
               list(cls_dir.glob("*.png"))

        for img_path in imgs:
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            detections = service.identify(img)
            if not detections:
                pred_label = UNKNOWN
            else:
                # Tomar la detección de mayor similitud
                best = max(detections, key=lambda d: d["similarity"])
                pred_label = best["name"]

            y_true.append(true_label)
            y_pred.append(pred_label)
            details.append({
                "image": str(img_path),
                "true": true_label,
                "pred": pred_label,
                "correct": true_label == pred_label,
            })

    if not y_true:
        print("[ERROR] No se procesaron imágenes.")
        return

    labels = sorted(set(y_true + y_pred))
    acc = accuracy_score(y_true, y_pred)

    print(f"Accuracy global: {acc:.4f} ({acc*100:.2f}%)\n")
    print("Classification Report:")
    print(classification_report(y_true, y_pred, labels=labels, zero_division=0))

    print("Confusion Matrix:")
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    print("Labels:", labels)
    print(cm)

    # Guardar resultados en JSON
    out = {
        "accuracy": acc,
        "n_samples": len(y_true),
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "details": details,
    }
    with open("evaluation_results.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("\n[OK] Resultados guardados en evaluation_results.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test_dir", default="./fotos_prueba")
    args = parser.parse_args()
    evaluate(args.test_dir)
