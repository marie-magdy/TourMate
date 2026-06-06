"""Tests for cv_service/app.py — the Flask landmark/artifact recognition service.

We stub tensorflow's tflite Interpreter and the JSON label files BEFORE importing
app, so tests don't need real model weights and run in milliseconds.
"""
import io
import json
import os
import sys
import importlib
from unittest.mock import patch, MagicMock

import numpy as np
import pytest
from PIL import Image


# ── Helpers ──────────────────────────────────────────────────────────
def _make_interpreter_stub(output_class: int, confidence: float):
    """Return a fake tflite Interpreter that always predicts `output_class`
    with the given `confidence` regardless of input.
    """
    class FakeInterpreter:
        def __init__(self, model_path=None):
            self.model_path = model_path

        def allocate_tensors(self):
            pass

        def get_input_details(self):
            return [{'index': 0}]

        def get_output_details(self):
            return [{'index': 0}]

        def set_tensor(self, _idx, _arr):
            pass

        def invoke(self):
            pass

        def get_tensor(self, _idx):
            num_classes = max(output_class + 1, 5)
            out = np.zeros((1, num_classes), dtype=np.float32)
            out[0, output_class] = confidence
            return out

    return FakeInterpreter


SAMPLE_LABELS = {str(i): f'landmark_{i}' for i in range(5)}


def _open_with_labels(labels_json: str):
    """Return a `builtins.open` replacement that yields the labels JSON for
    any .json file path; delegates to the real `open` for everything else.
    """
    real_open = open

    class _Reader(io.StringIO):
        def __enter__(self):
            return self
        def __exit__(self, *args):
            self.close()
            return False

    def _open(path, *args, **kwargs):
        if isinstance(path, str) and path.endswith('.json'):
            return _Reader(labels_json)
        return real_open(path, *args, **kwargs)
    return _open


def _png_bytes(color=(120, 80, 40)):
    img = Image.new('RGB', (32, 32), color=color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


@pytest.fixture
def make_app():
    """Factory: load cv_service.app with stubbed Interpreter + label files,
    then swap the module's outdoor/artifact models for fakes that predict
    the requested class with the requested confidence.
    Returns (test_client, app_module).
    """
    def _factory(*, output_class=0, confidence=0.95, api_key='secret-key'):
        os.environ['API_KEY'] = api_key
        sys.modules.pop('app', None)

        fake_cls = _make_interpreter_stub(output_class, confidence)
        labels_json = json.dumps(SAMPLE_LABELS)

        # The labels open() is the one we must intercept before import.
        # The tflite Interpreter class is lazy on TF 2.x, so we don't even
        # try to patch it at import time — instead, after the module is
        # loaded we replace the module-level model objects directly.
        with patch('builtins.open', _open_with_labels(labels_json)), \
             patch('tensorflow.lite.Interpreter', fake_cls, create=True):
            import app  # noqa: WPS433
            importlib.reload(app)

        # Swap any real interpreters that may have slipped through with our
        # deterministic stubs.
        fake = fake_cls()
        app.outdoor_model = fake
        app.artifact_model = fake
        # Make sure label dicts are the small sample set.
        app.outdoor_labels = dict(SAMPLE_LABELS)
        app.artifact_labels = dict(SAMPLE_LABELS)

        app.app.config['TESTING'] = True
        return app.app.test_client(), app

    return _factory


# ── /health ──────────────────────────────────────────────────────────
def test_health_returns_running_with_class_counts(make_app):
    client, _ = make_app()
    res = client.get('/health')
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'running'
    assert body['outdoor_classes'] == len(SAMPLE_LABELS)
    assert body['artifact_classes'] == len(SAMPLE_LABELS)


# ── /recognize — auth ────────────────────────────────────────────────
def test_recognize_returns_401_without_api_key(make_app):
    client, _ = make_app(api_key='secret-key')
    res = client.post(
        '/recognize',
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 401
    assert res.get_json() == {'error': 'Unauthorized'}


def test_recognize_returns_401_with_wrong_api_key(make_app):
    client, _ = make_app(api_key='secret-key')
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'wrong'},
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 401


# ── /recognize — input validation ────────────────────────────────────
def test_recognize_returns_400_when_image_field_missing(make_app):
    client, _ = make_app()
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={},
        content_type='multipart/form-data',
    )
    assert res.status_code == 400
    assert res.get_json() == {'error': 'No image provided'}


def test_recognize_returns_400_when_image_is_invalid(make_app):
    client, _ = make_app()
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (io.BytesIO(b'not really an image'), 'fake.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 400
    assert res.get_json() == {'error': 'Invalid image'}


# ── /recognize — recognition results ────────────────────────────────
def test_recognize_returns_not_recognized_when_confidence_below_60(make_app):
    client, _ = make_app(output_class=1, confidence=0.40)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['recognized'] is False
    assert body['message'] == 'Landmark not recognized clearly'
    assert body['confidence'] == 0.4


def test_recognize_returns_label_when_confidence_above_threshold(make_app):
    client, _ = make_app(output_class=2, confidence=0.85)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['recognized'] is True
    assert body['model_label'] == 'landmark_2'
    assert body['confidence'] == 0.85
    assert body['model_type'] == 'outdoor'


def test_recognize_defaults_to_outdoor_when_model_type_missing(make_app):
    client, _ = make_app(output_class=0, confidence=0.99)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    body = res.get_json()
    assert body['model_type'] == 'outdoor'


def test_recognize_uses_artifact_model_when_requested(make_app):
    client, _ = make_app(output_class=3, confidence=0.80)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={
            'image': (_png_bytes(), 'x.png'),
            'model_type': 'artifact',
        },
        content_type='multipart/form-data',
    )
    body = res.get_json()
    assert body['recognized'] is True
    assert body['model_type'] == 'artifact'


def test_confidence_exactly_at_60_threshold_is_considered_recognized(make_app):
    # Source uses `< 0.60` for "not recognized" — exactly 0.60 should pass.
    client, _ = make_app(output_class=4, confidence=0.60)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (_png_bytes(), 'x.png')},
        content_type='multipart/form-data',
    )
    body = res.get_json()
    assert body['recognized'] is True
    assert body['confidence'] == 0.6


# ── predict() helper ─────────────────────────────────────────────────
def test_predict_returns_argmax_label_and_confidence(make_app):
    _, app_mod = make_app(output_class=2, confidence=0.77)
    image = Image.new('RGB', (50, 50))
    label, conf = app_mod.predict(image, app_mod.outdoor_model, app_mod.outdoor_labels)
    assert label == 'landmark_2'
    assert conf == pytest.approx(0.77)


def test_predict_resizes_image_to_224x224(make_app):
    """The predict helper resizes the input to (224, 224, 3). Verify the shape
    of the array passed to set_tensor on a MagicMock model.
    """
    _, app_mod = make_app()
    mock_model = MagicMock()
    mock_model.get_input_details.return_value = [{'index': 0}]
    mock_model.get_output_details.return_value = [{'index': 0}]
    mock_model.get_tensor.return_value = np.array([[0.9, 0.0, 0.1]], dtype=np.float32)

    img = Image.new('RGB', (1000, 50))  # gets resized down
    app_mod.predict(img, mock_model, {'0': 'a', '1': 'b', '2': 'c'})

    set_call = mock_model.set_tensor.call_args
    arr = set_call[0][1]
    assert arr.shape == (1, 224, 224, 3)
    assert arr.dtype == np.float32


# ── TC-CV-03: non-landmark object → very low confidence ─────────────
def test_recognize_rejects_non_landmark_with_very_low_confidence(make_app):
    """A random object (not a landmark) produces a near-zero confidence;
    the response is 'recognized: false' with the same message used for
    blurry / dark images. Distinct from the 0.59 boundary case to make
    the 'not a landmark' intent explicit."""
    client, _ = make_app(output_class=0, confidence=0.05)
    res = client.post(
        '/recognize',
        headers={'x-api-key': 'secret-key'},
        data={'image': (_png_bytes(color=(200, 50, 50)), 'random.png')},
        content_type='multipart/form-data',
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['recognized'] is False
    assert body['message'] == 'Landmark not recognized clearly'
    assert body['confidence'] == 0.05


# ── TC-CV-06: predict() processing time stays well under 10 seconds ──
def test_predict_returns_in_under_10_seconds(make_app):
    """The /recognize processing budget in the original test plan is < 10s.
    With a mocked TFLite interpreter the call should complete in tens of
    milliseconds — assert it returns in well under one second."""
    import time
    _, app_mod = make_app(output_class=2, confidence=0.91)
    img = Image.new('RGB', (640, 480))
    start = time.perf_counter()
    label, conf = app_mod.predict(img, app_mod.outdoor_model, app_mod.outdoor_labels)
    elapsed = time.perf_counter() - start
    assert label == 'landmark_2'
    assert elapsed < 1.0  # well under the 10 s test-plan budget


# ── TC-CV-04: multiple high outputs → argmax picks the primary one ──
def test_predict_returns_argmax_when_multiple_outputs_are_high(make_app):
    """When the model gives several classes a high score, predict() must
    return the single highest one (no ties / no list)."""
    _, app_mod = make_app()
    mock_model = MagicMock()
    mock_model.get_input_details.return_value = [{'index': 0}]
    mock_model.get_output_details.return_value = [{'index': 0}]
    # Three "high" landmarks; argmax → index 1 ("sphinx" in our fake labels).
    mock_model.get_tensor.return_value = np.array(
        [[0.62, 0.91, 0.74, 0.10]], dtype=np.float32,
    )
    labels = {'0': 'pyramids', '1': 'sphinx', '2': 'karnak', '3': 'noise'}

    label, conf = app_mod.predict(Image.new('RGB', (32, 32)), mock_model, labels)
    assert label == 'sphinx'
    assert conf == pytest.approx(0.91)
