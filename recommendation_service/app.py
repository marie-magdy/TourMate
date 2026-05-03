from flask import Flask, jsonify, request
from flask_cors import CORS

from reccomender_v2 import (
    build_attraction_matrix, generate_itinerary_from_payload,
    load_attractions, split_budget_across_days,
)

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

    day_index = int(payload.get("day_index", 0) or 0)
    n_days    = int(payload.get("n_days", 1) or 1)
    city      = str(payload.get("city", "?")).upper()

    if day_index == 0:
        print("\n" + "═" * 60)
        print(f"  NEW PLAN REQUEST  ·  {city}  ·  {n_days} day(s)")
        print("═" * 60)
    else:
        print("\n" + "─" * 60)
        print(f"  DAY {day_index + 1} / {n_days}  ·  {city}")
        print("─" * 60)

    print(f"  liked    : {payload.get('liked_ids', [])}")
    print(f"  visited  : {payload.get('visited_ids', [])}")
    print(f"  budget   : {payload.get('budget_egp')} EGP  |  hours: {payload.get('available_hours')}")

    try:
        result = generate_itinerary_from_payload(payload, df=df, att_matrix=att_matrix)
        return jsonify(result), 200
    except Exception as exc:
        import traceback
        print("[FLASK ERROR] Full traceback:")
        traceback.print_exc()
        return jsonify({"error": str(exc), "details": traceback.format_exc()}), 500


@app.post("/budget-split")
def budget_split():
    """
    Compute adaptive per-day budget fractions.
    Body: { city, daily_hours, liked_ids? }
    Response: { fractions, daily_pressures }

    Per-day cost pressure is derived from the user's liked/selected spot prices,
    distributed across days proportional to each day's share of total hours.
    Days assigned expensive liked spots receive a higher cost-pressure weight,
    giving genuinely non-uniform fractions even for same-city trips.
    Fallback: city-median price when no liked spots are available.
    """
    payload     = request.get_json(silent=True) or {}
    daily_hours = payload.get("daily_hours", [])
    city        = str(payload.get("city", "")).strip().lower()
    liked_ids   = [str(x) for x in (payload.get("liked_ids") or [])]

    if not daily_hours:
        return jsonify({"error": "daily_hours is required"}), 400

    n = len(daily_hours)

    # City-level median as the baseline fallback
    city_median = 1.0
    if not df.empty:
        city_df = df[df["city"].str.strip().str.lower() == city] if city else df
        if city_df.empty:
            city_df = df
        top_prices = city_df.nlargest(20, "avg_rating")["price_avg"].dropna()
        if not top_prices.empty:
            city_median = float(top_prices.median())

    # Distribute liked spots across days proportional to hours, then compute
    # per-day cost pressure as the mean price of spots assigned to that day.
    daily_top_prices = [city_median] * n
    if liked_ids and not df.empty:
        liked_df = df[df["attraction_id"].astype(str).isin(liked_ids)][["attraction_id", "price_avg"]].copy()
        if not liked_df.empty:
            # Sort expensive spots first so the heaviest items spread across days
            liked_df = liked_df.sort_values("price_avg", ascending=False).reset_index(drop=True)
            total_hrs    = sum(daily_hours) or 1.0
            day_capacity = [h / total_hrs for h in daily_hours]  # share of total hours per day
            day_buckets: list[list] = [[] for _ in range(n)]

            # Greedy round-robin weighted by remaining day capacity
            for _, spot in liked_df.iterrows():
                # Assign to the day with the most remaining proportional capacity
                idx = max(range(n), key=lambda d: day_capacity[d])
                day_buckets[idx].append(float(spot["price_avg"]))
                day_capacity[idx] -= (1.0 / len(liked_df))  # reduce that day's "slot weight"

            daily_top_prices = [
                float(sum(bucket) / len(bucket)) if bucket else city_median
                for bucket in day_buckets
            ]

    fractions = split_budget_across_days(daily_hours, daily_top_prices)
    return jsonify({"fractions": fractions, "daily_pressures": daily_top_prices}), 200


if __name__ == "__main__":
    app.run(port=5002, debug=True)
