from flask import Flask, request, jsonify
from PIL import Image
import tensorflow as tf
import numpy as np
import json
import os
from dotenv import load_dotenv
from functools import wraps

load_dotenv()
app = Flask(__name__)

# ── Load models once when server starts ──
BASE = os.path.dirname(__file__)

print("Loading outdoor landmarks model...")
outdoor_model = tf.lite.Interpreter(
    model_path=os.path.join(BASE, 'models/outdoor_landmarks.tflite'))
outdoor_model.allocate_tensors()

print("Loading museum artifacts model...")
artifact_model = tf.lite.Interpreter(
    model_path=os.path.join(BASE, 'models/museum_artifacts.tflite'))
artifact_model.allocate_tensors()

with open(os.path.join(BASE, 'models/class_labels.json')) as f:
    outdoor_labels = json.load(f)

with open(os.path.join(BASE, 'models/artifact_class_labels.json')) as f:
    artifact_labels = json.load(f)

print("✅ Both models loaded successfully!")

# ── API key protection ──
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get('x-api-key')
        if key != os.getenv('API_KEY'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ── Helper: run prediction ──
def predict(image, model, labels):
    img = image.convert('RGB').resize((224, 224))
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)

    inp = model.get_input_details()
    out = model.get_output_details()
    model.set_tensor(inp[0]['index'], arr)
    model.invoke()
    output = model.get_tensor(out[0]['index'])[0]

    idx = int(np.argmax(output))
    confidence = float(np.max(output))
    label = labels[str(idx)]

    return label, confidence

# ── Main recognition endpoint ──
@app.route('/recognize', methods=['POST'])
@require_api_key
def recognize():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    model_type = request.form.get('model_type', 'outdoor')

    try:
        image = Image.open(request.files['image'])
    except Exception:
        return jsonify({'error': 'Invalid image'}), 400

    if model_type == 'artifact':
        label, confidence = predict(image, artifact_model, artifact_labels)
    else:
        label, confidence = predict(image, outdoor_model, outdoor_labels)

    if confidence < 0.60:
        return jsonify({
            'recognized': False,
            'message': 'Landmark not recognized clearly',
            'confidence': round(confidence, 4)
        }), 200

    return jsonify({
        'recognized': True,
        'model_label': label,
        'confidence': round(confidence, 4),
        'model_type': model_type
    }), 200

# ── Health check ──
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'outdoor_classes': len(outdoor_labels),
        'artifact_classes': len(artifact_labels)
    }), 200

if __name__ == '__main__':
    app.run(port=5001, debug=True)