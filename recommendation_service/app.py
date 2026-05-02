from pathlib import Path
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from reccomender_v2 import build_attraction_matrix, generate_itinerary_from_payload, load_attractions  # noqa: E402

app = Flask(__name__)
CORS(app)

try:
    df = load_attractions()
    att_matrix = build_attraction_matrix(df)
    print(f"[FLASK] Loaded {len(df)} attractions from PostgreSQL")
    print(f"[FLASK] Cities: {df['city'].value_counts().to_dict()}")
except Exception as e:
    print(f"[FLASK] STARTUP ERROR loading attractions: {e}")
    import traceback; traceback.print_exc()
    import pandas as pd, numpy as np
    df = pd.DataFrame()
    att_matrix = np.zeros((0, 30))


@app.get("/attractions")
def attractions():
    city     = request.args.get("city", "").strip().lower()
    category = request.args.get("category", "").strip().lower()

    print(f"[FLASK /attractions] city='{city}' category='{category}' total_rows={len(df)}")

    filtered = df.copy()
    if city:
        filtered = filtered[filtered["city"].str.strip().str.lower() == city]
    print(f"[FLASK /attractions] after city filter: {len(filtered)} rows")
    if category and category not in ("all", ""):
        filtered = filtered[
            filtered["categories"].apply(
                lambda cats: any(category in c.lower() for c in cats)
            )
        ]

    spots = []
    for _, row in filtered.sort_values("avg_rating", ascending=False).head(50).iterrows():
        # Convert every value to a plain Python type so Flask's JSON encoder
        # doesn't choke on numpy.int64 / numpy.float64.
        lat = row["latitude"]
        lon = row["longitude"]
        spots.append({
            "id":          str(row["attraction_id"]),
            "name":        str(row["name"]),
            "categories":  [str(c) for c in row["categories"]],
            "price_from":  float(row["price_min"]),
            "price_range": str(row["price_range"]),
            "rating":      float(row["avg_rating"]),
            "city":        str(row["city"]),
            "description": str(row.get("description") or ""),
            "latitude":    float(lat) if (lat and float(lat) != 0.0) else None,
            "longitude":   float(lon) if (lon and float(lon) != 0.0) else None,
            "avg_visit_hrs": float(row["avg_visit_hrs"]),
            "image_url":   str(row.get("primary_image") or ""),
        })

    return jsonify({"success": True, "data": spots}), 200


@app.get("/health")
def health():
    return jsonify({
        "status": "running",
        "data_source": "postgresql",
        "attractions_loaded": int(len(df)),
    }), 200


@app.post("/itinerary")
def itinerary():
    payload = request.get_json(silent=True) or {}

    # DEBUG — confirm what the frontend sent
    print("[FLASK /itinerary] raw payload keys:", list(payload.keys()))
    print("[FLASK /itinerary] liked_ids received:", payload.get("liked_ids", []))
    print("[FLASK /itinerary] visited_ids received:", payload.get("visited_ids", []))
    print("[FLASK /itinerary] city:", payload.get("city"), "| budget:", payload.get("budget_egp"), "| hours:", payload.get("available_hours"))

    try:
        result = generate_itinerary_from_payload(payload, df=df, att_matrix=att_matrix)
        return jsonify(result), 200
    except Exception as exc:
        import traceback
        print("[FLASK ERROR] Full traceback:")
        traceback.print_exc()
        return jsonify({"error": str(exc), "details": traceback.format_exc()}), 500


if __name__ == "__main__":
    app.run(port=5002, debug=True)
