"""
analyse_migration.py — Pre-migration analysis
  - Full column comparison (PG vs Excel)
  - Smart duplicate detection (exact / fuzzy / coordinate)
  - Migration plan dry run

Run:  python analyse_migration.py
"""

import math
import re
import warnings
from difflib import SequenceMatcher

import pandas as pd
import psycopg2
import psycopg2.extras

warnings.filterwarnings("ignore")

DB_URL    = (
    "postgresql://postgres.ngcwvfusvoevtmipudtc:Tour_mate2026"
    "@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
)
XLSX_PATH = "TourMate_attractions.xlsx"

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _norm(name: str) -> str:
    s = str(name).lower().strip()
    s = re.sub(r"[-_'\"،&]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s

def fuzzy(a: str, b: str) -> float:
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Distance in metres between two lat/lon points."""
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a  = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# ─────────────────────────────────────────────────────────────────────────────
# 1. Load Excel
# ─────────────────────────────────────────────────────────────────────────────
df = pd.read_excel(XLSX_PATH, sheet_name="Attractions", header=2)
df.columns = [c.strip().replace("\n", " ") for c in df.columns]

# normalise variant column names
renames = {}
for col in df.columns:
    if col.startswith("avg_rating"):      renames[col] = "avg_rating"
    elif col.startswith("popularity"):    renames[col] = "popularity"
    elif col.startswith("price_range"):   renames[col] = "price_range"
    elif col.startswith("crowd_pattern"): renames[col] = "crowd_pattern"
if renames:
    df = df.rename(columns=renames)
df = df.dropna(subset=["attraction_id"]).reset_index(drop=True)

for col in ["latitude", "longitude", "avg_rating", "popularity",
            "avg_visit_hrs", "admission_egp", "total_reviews"]:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

EXCEL_COLS = list(df.columns)

# ─────────────────────────────────────────────────────────────────────────────
# 2. Load PostgreSQL
# ─────────────────────────────────────────────────────────────────────────────
conn = psycopg2.connect(DB_URL)
cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# PG columns
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'attractions'
    ORDER BY ordinal_position
""")
pg_col_rows = cur.fetchall()
PG_COLS = [r["column_name"] for r in pg_col_rows]

# All PG attractions with coords
cur.execute("""
    SELECT a.id, a.name, lower(trim(ci.name)) AS city,
           COALESCE(a.latitude,  0)::float AS lat,
           COALESCE(a.longitude, 0)::float AS lon
    FROM   attractions a
    LEFT JOIN cities ci ON ci.city_id = a.city_id
""")
pg_rows = cur.fetchall()

# city_id map
cur.execute("SELECT city_id, lower(trim(name)) AS name FROM cities")
city_id_map = {r["name"]: r["city_id"] for r in cur.fetchall()}

cur.close(); conn.close()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Full column comparison
# ─────────────────────────────────────────────────────────────────────────────
# Normalise column names for comparison (PG uses snake_case, Excel uses spaces)
EXCEL_NORM_MAP = {
    "attraction_id":  "attraction_id",
    "name":           "name",
    "city":           "city",
    "district":       "district",
    "latitude":       "latitude",
    "longitude":      "longitude",
    "address":        "address",
    "categories":     "categories",
    "sub_type":       "sub_type",
    "is_outdoor":     "is_outdoor",
    "avg_visit_hrs":  "avg_visit_hrs",
    "admission_egp":  "admission_egp",
    "avg_rating":     "rating",          # PG calls it "rating"
    "popularity":     "popularity",
    "total_reviews":  "total_reviews",
    "open_hour":      "open_hour",
    "close_hour":     "close_hour",
    "meal_slot":      "meal_slot",
    "price_range":    "price_range",
    "crowd_label":    "crowd_label",
    "crowd_pattern":  "crowd_pattern",
}

excel_to_pg = EXCEL_NORM_MAP   # excel col → pg equivalent name
pg_equiv    = set(excel_to_pg.values())

print("=" * 72)
print("  STEP 1 — COLUMN COMPARISON")
print("=" * 72)
print(f"  {'Excel column':<35} {'PostgreSQL column':<25} {'Status'}")
print(f"  {'-'*35} {'-'*25} {'-'*12}")

# Excel columns
for ecol in EXCEL_COLS:
    pgcol = excel_to_pg.get(ecol)
    if pgcol and pgcol in PG_COLS:
        status = "✓ MATCH"
    else:
        status = "ONLY IN EXCEL"
    print(f"  {ecol:<35} {pgcol or '—':<25} {status}")

# PG-only columns
print()
print(f"  {'—':<35} {'PostgreSQL column':<25} {'Status'}")
print(f"  {'-'*35} {'-'*25} {'-'*12}")
for pcol in PG_COLS:
    if pcol not in pg_equiv:
        print(f"  {'—':<35} {pcol:<25} ONLY IN PG")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Smart duplicate detection
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 72)
print("  STEP 2 — SMART DUPLICATE CHECK")
print("=" * 72)

FUZZY_THRESHOLD  = 0.85
COORD_THRESHOLD  = 0.002   # ~200 m in degrees

# Manual overrides (known same place, different name)
MANUAL_MATCHES = {
    ("ATT049", "qaitbay citadel"):        1,   # PG id=1: Citadel of Qaitbay
    ("ATT051", "montaza palace gardens"): 3,   # PG id=3: Montaza Palace
    ("ATT058", "stanley bridge & beach"): 4,   # PG id=4: Stanley Bridge
}

# Build PG lookup by (norm_name, city)
pg_by_key   = {(_norm(r["name"]), r["city"]): r for r in pg_rows}
pg_by_id    = {r["id"]: r                       for r in pg_rows}

# cities present in Excel
excel_cities = set(df["city"].str.lower().str.strip().unique())
pg_only_cities = set(r["city"] for r in pg_rows) - excel_cities

exact_matches  = {}   # excel attraction_id → pg_id
fuzzy_matches  = {}   # excel attraction_id → (pg_id, score, method)
possible_dups  = []   # for printing

for _, erow in df.iterrows():
    att_id  = str(erow["attraction_id"])
    ename   = str(erow["name"])
    ecity   = str(erow["city"]).lower().strip()
    elat    = float(erow["latitude"])
    elon    = float(erow["longitude"])

    # ── Manual override ──────────────────────────────────────────────────
    manual_key = (att_id, _norm(ename))
    if manual_key in MANUAL_MATCHES:
        pg_id = MANUAL_MATCHES[manual_key]
        pgr   = pg_by_id[pg_id]
        exact_matches[att_id] = pg_id
        possible_dups.append({
            "level":   "MANUAL",
            "pg_id":   pg_id,   "pg_name":  pgr["name"],
            "pg_lat":  pgr["lat"], "pg_lon": pgr["lon"],
            "att_id":  att_id, "ex_name": ename,
            "ex_lat":  elat,   "ex_lon":  elon,
            "sim":     fuzzy(ename, pgr["name"]),
            "dist_m":  haversine_m(elat, elon, pgr["lat"], pgr["lon"]) if elat and elon and pgr["lat"] and pgr["lon"] else None,
            "suggest": "UPDATE",
        })
        continue

    # ── Level 1: exact name + city ───────────────────────────────────────
    key = (_norm(ename), ecity)
    if key in pg_by_key:
        pgr = pg_by_key[key]
        exact_matches[att_id] = pgr["id"]
        continue   # clean exact match — reported in migration plan, not as duplicate

    # ── Level 2: fuzzy name (same city, ≥85%) ───────────────────────────
    best_score, best_pgr = 0.0, None
    for pgr in pg_rows:
        if pgr["city"] != ecity:
            continue
        score = fuzzy(ename, pgr["name"])
        if score > best_score:
            best_score, best_pgr = score, pgr

    # ── Level 3: coordinate proximity (≤200m, any city) ─────────────────
    if elat and elon:
        for pgr in pg_rows:
            if pgr["lat"] and pgr["lon"]:
                dlat = abs(elat - pgr["lat"])
                dlon = abs(elon - pgr["lon"])
                if dlat < COORD_THRESHOLD and dlon < COORD_THRESHOLD:
                    dist_m = haversine_m(elat, elon, pgr["lat"], pgr["lon"])
                    fscore = fuzzy(ename, pgr["name"])
                    # Only flag if not already an exact match AND looks like same place
                    if att_id not in exact_matches and (fscore >= 0.60 or dist_m < 100):
                        if best_pgr is None or fscore > best_score:
                            best_score, best_pgr = fscore, pgr
                        possible_dups.append({
                            "level":   "L3-COORD",
                            "pg_id":   pgr["id"], "pg_name": pgr["name"],
                            "pg_lat":  pgr["lat"], "pg_lon": pgr["lon"],
                            "att_id":  att_id, "ex_name": ename,
                            "ex_lat":  elat,   "ex_lon":  elon,
                            "sim":     fscore,
                            "dist_m":  dist_m,
                            "suggest": "UPDATE" if fscore >= 0.75 else "REVIEW",
                        })

    if best_score >= FUZZY_THRESHOLD and att_id not in exact_matches:
        pgr = best_pgr
        fuzzy_matches[att_id] = (pgr["id"], best_score)
        possible_dups.append({
            "level":   "L2-FUZZY",
            "pg_id":   pgr["id"], "pg_name": pgr["name"],
            "pg_lat":  pgr["lat"], "pg_lon": pgr["lon"],
            "att_id":  att_id, "ex_name": ename,
            "ex_lat":  elat,   "ex_lon":  elon,
            "sim":     best_score,
            "dist_m":  haversine_m(elat, elon, pgr["lat"], pgr["lon"]) if elat and elon and pgr["lat"] and pgr["lon"] else None,
            "suggest": "UPDATE",
        })

# Deduplicate possible_dups by (att_id, pg_id)
seen_pairs = set()
unique_dups = []
for d in possible_dups:
    pair = (d["att_id"], d["pg_id"])
    if pair not in seen_pairs:
        seen_pairs.add(pair)
        unique_dups.append(d)

# Print duplicate report
for d in unique_dups:
    dist_str = f"~{d['dist_m']:.0f}m" if d["dist_m"] is not None else "no coords"
    print(f"\nPOSSIBLE DUPLICATE  [{d['level']}]")
    print(f"  PG   : '{d['pg_name']}'  id={d['pg_id']}  "
          f"lat={d['pg_lat']}  lon={d['pg_lon']}")
    print(f"  Excel: '{d['att_id']} — {d['ex_name']}'  "
          f"lat={d['ex_lat']}  lon={d['ex_lon']}")
    print(f"  Similarity: {d['sim']*100:.0f}%  /  Distance: {dist_str}")
    print(f"  → Suggestion: {d['suggest']}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Migration plan summary
# ─────────────────────────────────────────────────────────────────────────────
# All matches = exact + manual + fuzzy
all_matches = {**exact_matches}
for att_id, (pg_id, _) in fuzzy_matches.items():
    if att_id not in all_matches:
        all_matches[att_id] = pg_id

will_update   = []
will_insert   = []
will_skip_pg  = []

for _, erow in df.iterrows():
    att_id = str(erow["attraction_id"])
    ecity  = str(erow["city"]).lower().strip()
    if att_id in all_matches:
        will_update.append((all_matches[att_id], erow))
    else:
        will_insert.append(erow)

# PG-only rows (cities not in Excel)
for pgr in pg_rows:
    if pgr["city"] in pg_only_cities:
        will_skip_pg.append(pgr)

print()
print("=" * 72)
print("  STEP 3 — MIGRATION PLAN SUMMARY")
print("=" * 72)
print()
print(f"  Will UPDATE  (Excel enriches existing PG row) : {len(will_update)}")
print(f"  Will INSERT  (new attraction from Excel)      : {len(will_insert)}")
print(f"  Will SKIP    (PG-only cities — untouched)     : {len(will_skip_pg)}")
print(f"  Possible duplicates to review                 : {len(unique_dups)}")
print()
print("  UPDATE rows:")
for pg_id, row in will_update:
    pgr = pg_by_id.get(pg_id, {})
    print(f"    id={pg_id:<4} '{pgr.get('name','')}' ← Excel '{row['name']}'")
print()
print("  INSERT rows (first 15 shown):")
for row in will_insert[:15]:
    print(f"    {row['attraction_id']} — {row['name']} ({row['city']})")
if len(will_insert) > 15:
    print(f"    ... and {len(will_insert)-15} more")
print()
print("  SKIP rows (PG-only cities):")
for pgr in will_skip_pg:
    print(f"    id={pgr['id']:<4} '{pgr['name']}' ({pgr['city']})")
print()
print("  Schema changes (ALTER TABLE — safe, IF NOT EXISTS):")
new_cols = [
    "attraction_id VARCHAR(10)",
    "categories    TEXT",
    "sub_type      VARCHAR(100)",
    "popularity    NUMERIC",
    "total_reviews INTEGER",
    "meal_slot     TEXT",
    "price_min     NUMERIC",
    "price_max     NUMERIC",
]
for c in new_cols:
    already = c.split()[0] in PG_COLS
    print(f"    {'(already exists)' if already else 'ADD'} {c}")
print()
print("  Run the actual migration with:")
print("    python import_excel.py --run")
print()
print("=" * 72)
