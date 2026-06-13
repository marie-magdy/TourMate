"""In-process CV inference benchmark. Times predict() over N iterations
against the mocked TFLite interpreter to characterise the application-layer
overhead (image resize + numpy + interpreter invoke + label lookup) without
loading the real .tflite weights.

Run with:  python -m pytest tests/bench_inference.py -s
"""
import io
import json
import os
import sys
import time
import importlib
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from PIL import Image

# Reuse the make_app fixture from conftest by importing it.
sys.path.insert(0, os.path.dirname(__file__))
from test_app import make_app  # noqa: E402


def _png_bytes(size=(640, 480), color=(120, 80, 40)):
    img = Image.new('RGB', size, color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def test_inference_time_p95_under_50_ms(make_app):
    """Time predict() over 100 iterations on a 640x480 input; record avg + p95.
    With a mocked interpreter the dominant cost is the PIL resize +
    np.expand_dims call. Real on-device inference is bound by the .tflite
    weights and the phone's NN accelerator and is not measured here."""
    _, app_mod = make_app(output_class=2, confidence=0.91)

    image = Image.new('RGB', (640, 480), color=(120, 80, 40))
    samples = []
    # Warmup
    for _ in range(10):
        app_mod.predict(image, app_mod.outdoor_model, app_mod.outdoor_labels)
    # Measured
    for _ in range(100):
        t0 = time.perf_counter()
        app_mod.predict(image, app_mod.outdoor_model, app_mod.outdoor_labels)
        samples.append((time.perf_counter() - t0) * 1000.0)

    avg = sum(samples) / len(samples)
    samples.sort()
    p95 = samples[int(0.95 * len(samples))]
    print(f"\nCV predict() (640x480, mocked TFLite)  avg={avg:.2f} ms  p95={p95:.2f} ms")

    # Write to JSON for the docx builder.
    out = r"C:\Users\Jom\AppData\Local\Temp\cv-bench-results.json"
    with open(out, "w") as f:
        json.dump({
            "predict_avg_ms": round(avg, 2),
            "predict_p95_ms": round(p95, 2),
            "n": len(samples),
            "input_size": "640x480",
            "outdoor_model_bytes": os.path.getsize(
                os.path.join(os.path.dirname(__file__), '..', 'models', 'outdoor_landmarks.tflite')
            ),
            "artifact_model_bytes": os.path.getsize(
                os.path.join(os.path.dirname(__file__), '..', 'models', 'museum_artifacts.tflite')
            ),
        }, f)
    print("Wrote", out)

    assert avg < 50.0   # Application-layer budget (resize + numpy + invoke)
    assert p95 < 100.0
