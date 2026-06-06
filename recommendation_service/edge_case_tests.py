"""
Edge case tests for the itinerary recommendation service.
Run with the Flask service already running on port 5002.
"""
import requests, json

BASE = "http://127.0.0.1:5002/itinerary"

def post_day(label, payload):
    try:
        resp = requests.post(BASE, json=payload, timeout=60)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}

def run_case(title, cases):
    """cases = list of (day_label, payload) tuples, one per day."""
    print(f"\n{'═'*60}")
    print(f"  {title}")
    print(f"{'═'*60}")

    visited = []
    for label, payload in cases:
        payload["visited_ids"] = visited
        data = post_day(label, payload)

        if "error" in data and "itinerary" not in data:
            print(f"  ERROR: {data['error']}")
            continue

        itin   = data.get("itinerary", [])
        missed = data.get("missed_liked_places", [])

        print(f"\n  {label}")
        print(f"  {'─'*50}")
        if not itin:
            print("  (empty itinerary)")
        for s in itin:
            t    = s.get("time", s.get("departure_time", "?"))
            kind = s.get("type", "?")
            name = s.get("name", "?")
            liked_ids = set(payload.get("liked_ids", []))
            tag  = " *" if str(s.get("id", "")) in liked_ids else ""
            print(f"  {t}  {kind:13} {name}{tag}")

        att_stops = [s for s in itin if s.get("type") == "Attraction"]
        print(f"\n  Attractions: {len(att_stops)}")
        if missed:
            print(f"  Missed liked: {[m['name'] for m in missed]}")
        else:
            print(f"  Missed liked: none")

        visited += [str(s["id"]) for s in itin]


# ── Base coords for Alexandria ─────────────────────────────────────────────
ALX_LAT, ALX_LON = 31.2208, 29.9420

# ── CASE 1: No liked places — pure interest-based ──────────────────────────
run_case("CASE 1 — No liked places (interest-based only)", [
    ("Day 1 / 2", {
        "city": "alexandria", "n_days": 2, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 2000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": [],
    }),
    ("Day 2 / 2", {
        "city": "alexandria", "n_days": 2, "day_index": 1,
        "start_hour": 9, "available_hours": 12, "budget_egp": 2000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": [],
    }),
])

# ── CASE 2: All liked places geographically close (central Alexandria) ──────
run_case("CASE 2 — All liked places close together (central Alexandria)", [
    ("Day 1 / 3", {
        "city": "alexandria", "n_days": 3, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 3000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        # All central Alexandria: Bibliotheca, Graeco-Roman, Roman Theatre, Fine Arts
        "liked_ids": ["ATT050", "ATT059", "ATT060", "ATT090"],
    }),
    ("Day 2 / 3", {
        "city": "alexandria", "n_days": 3, "day_index": 1,
        "start_hour": 9, "available_hours": 12, "budget_egp": 3000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT059", "ATT060", "ATT090"],
    }),
    ("Day 3 / 3", {
        "city": "alexandria", "n_days": 3, "day_index": 2,
        "start_hour": 9, "available_hours": 12, "budget_egp": 3000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT059", "ATT060", "ATT090"],
    }),
])

# ── CASE 3: Single day trip ────────────────────────────────────────────────
run_case("CASE 3 — Single day trip with liked places", [
    ("Day 1 / 1", {
        "city": "alexandria", "n_days": 1, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 2500,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT065", "ATT120"],
    }),
])

# ── CASE 4: Very tight budget ──────────────────────────────────────────────
run_case("CASE 4 — Very tight budget (500 EGP total)", [
    ("Day 1 / 2", {
        "city": "alexandria", "n_days": 2, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 500,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT059", "ATT065"],
    }),
    ("Day 2 / 2", {
        "city": "alexandria", "n_days": 2, "day_index": 1,
        "start_hour": 9, "available_hours": 12, "budget_egp": 500,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT059", "ATT065"],
    }),
])

# ── CASE 5: Food-only liked places ────────────────────────────────────────
run_case("CASE 5 — Only food places liked (no attraction liked)", [
    ("Day 1 / 1", {
        "city": "alexandria", "n_days": 1, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 3000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT120", "ATT079"],  # BALBAA + Coffee Roastery
    }),
])

# ── CASE 6: Short day (4 hours available) ─────────────────────────────────
run_case("CASE 6 — Short day (4 hours only)", [
    ("Day 1 / 1", {
        "city": "alexandria", "n_days": 1, "day_index": 0,
        "start_hour": 14, "available_hours": 4, "budget_egp": 2000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "ATT059"],
    }),
])

# ── CASE 7: Invalid/unknown liked ID ─────────────────────────────────────
run_case("CASE 7 — Unknown liked ID in the list", [
    ("Day 1 / 1", {
        "city": "alexandria", "n_days": 1, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 3000,
        "current_lat": ALX_LAT, "current_lon": ALX_LON,
        "liked_ids": ["ATT050", "FAKE999", "ATT065"],
    }),
])

# ── CASE 8: Cairo (different city) ────────────────────────────────────────
run_case("CASE 8 — Cairo 2-day trip", [
    ("Day 1 / 2", {
        "city": "cairo", "n_days": 2, "day_index": 0,
        "start_hour": 9, "available_hours": 12, "budget_egp": 5000,
        "current_lat": 30.0444, "current_lon": 31.2357,
        "liked_ids": [],
    }),
    ("Day 2 / 2", {
        "city": "cairo", "n_days": 2, "day_index": 1,
        "start_hour": 9, "available_hours": 12, "budget_egp": 5000,
        "current_lat": 30.0444, "current_lon": 31.2357,
        "liked_ids": [],
    }),
])

print(f"\n{'═'*60}")
print("  ALL EDGE CASES DONE")
print(f"{'═'*60}\n")
