import time, os
os.environ.setdefault("TOURMATE_LOG_LEVEL", "0")  # quiet mode

from reccomender_v2 import load_attractions, build_attraction_matrix, generate_itinerary_from_payload

df  = load_attractions()
mat = build_attraction_matrix(df)

payloads = [
    ("1-day Alexandria history 1000 EGP", dict(
        city="alexandria", interests=["history"], budget_egp=1000,
        start_hour=9, end_hour=21, current_lat=31.2001, current_lon=29.9187,
        liked_ids=[], visited_ids=[], day_index=0, n_days=1)),
    ("1-day Alexandria food+nature 500 EGP", dict(
        city="alexandria", interests=["food","nature"], budget_egp=500,
        start_hour=9, end_hour=17, current_lat=31.2001, current_lon=29.9187,
        liked_ids=[], visited_ids=[], day_index=0, n_days=1)),
    ("1-day Cairo history 2000 EGP", dict(
        city="cairo", interests=["history","culture"], budget_egp=2000,
        start_hour=9, end_hour=21, current_lat=30.0444, current_lon=31.2357,
        liked_ids=[], visited_ids=[], day_index=0, n_days=1)),
    ("Day 1 of 3-day Alexandria trip", dict(
        city="alexandria", interests=["history","culture","food"], budget_egp=3000,
        start_hour=9, end_hour=21, current_lat=31.2001, current_lon=29.9187,
        liked_ids=[], visited_ids=[], day_index=0, n_days=3)),
]

MEAL_TYPES = {"Breakfast","Lunch","Dinner","Coffee"}

print()
for label, p in payloads:
    t0 = time.time()
    result = generate_itinerary_from_payload(p, df=df, att_matrix=mat)
    elapsed = time.time() - t0
    itin  = result.get("itinerary", [])
    stops = [s for s in itin if s.get("type") not in MEAL_TYPES]
    meals = [s for s in itin if s.get("type") in MEAL_TYPES]
    stats = result.get("stats", {})
    print(f"Scenario : {label}")
    print(f"  Response time : {elapsed:.2f}s")
    print(f"  Attractions   : {len(stops)}")
    print(f"  Meals         : {len(meals)}")
    print(f"  Total distance: {stats.get('total_distance_km','?')} km")
    print(f"  Total cost    : {int(stats.get('total_cost_egp',0))} EGP / {p['budget_egp']} EGP budget")
    print(f"  Hours used    : {stats.get('total_hours','?')}h")
    print()
