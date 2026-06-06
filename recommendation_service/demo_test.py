"""
Demo: 3-day Alexandria plan with the same liked places from the bug report.
Calls the running service on port 5002 once per day, passing visited IDs forward.
"""
import requests, json

BASE = "http://127.0.0.1:5002/itinerary"
LIKED = ["ATT050", "ATT120", "ATT060", "ATT059", "ATT065", "ATT063", "ATT096", "ATT079"]
LIKED_NAMES = {
    "ATT050": "Bibliotheca Alexandrina",
    "ATT120": "BALBAA Restaurant - Sidi Beshr",
    "ATT060": "Royal Jewelry Museum",
    "ATT059": "Graeco-Roman Museum",
    "ATT065": "Montaza Royal Gardens",
    "ATT063": "San Stefano Mall",
    "ATT096": "Antoniadis Garden",
    "ATT079": "Coffee Roastery (San Stefano)",
}

visited = []
budgets = [3333, 4565, 7797]
all_missed = {}

print("\n" + "═" * 60)
print("  DEMO — 3-day Alexandria plan  (pending-liked fix)")
print("═" * 60)

for day in range(3):
    payload = {
        "city": "alexandria",
        "n_days": 3,
        "day_index": day,
        "start_hour": 9,
        "available_hours": 12,
        "budget_egp": budgets[day],
        "current_lat": 31.2208,
        "current_lon": 29.9420,
        "interests": [],
        "liked_ids": LIKED,
        "visited_ids": visited,
    }

    resp = requests.post(BASE, json=payload, timeout=60)
    data = resp.json()

    itin   = data.get("itinerary", [])
    missed = data.get("missed_liked_places", [])

    print(f"\n{'─'*60}")
    print(f"  DAY {day+1} / 3")
    print(f"{'─'*60}")
    for s in itin:
        t    = s.get("time", s.get("departure_time", "?"))
        kind = s.get("type", "?")
        name = s.get("name", "?")
        tag  = " ★" if str(s.get("id", "")) in LIKED else ""
        print(f"  {t}  {kind:13} {name}{tag}")

    liked_scheduled = [
        LIKED_NAMES[lid] for lid in LIKED
        if any(str(s.get("id","")) == lid for s in itin)
    ]
    print(f"\n  Liked scheduled this day : {liked_scheduled or 'none'}")

    if missed:
        print(f"  Missed liked             : {[m['name'] for m in missed]}")
    else:
        print(f"  Missed liked             : none")

    # carry forward ALL stop IDs (attractions + meals), matching real frontend behaviour
    visited += [str(s["id"]) for s in itin]
    all_missed[day+1] = missed

print("\n" + "═" * 60)
print("  SUMMARY — liked places scheduled across all 3 days")
print("═" * 60)
scheduled_all = []
for day in range(1, 4):
    for m in all_missed.get(day, []):
        pass  # just using all_missed for reference

final_missed_names = {m["name"] for m in all_missed.get(3, [])}
for lid, name in LIKED_NAMES.items():
    status = "✗ missed" if name in final_missed_names else "✓ scheduled"
    print(f"  {status:14}  {name}")
print()
