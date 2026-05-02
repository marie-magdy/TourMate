"""
import_excel.py — One-time migration: TourMate_attractions.xlsx → PostgreSQL
─────────────────────────────────────────────────────────────────────────────
Usage:
  python import_excel.py            # DRY RUN — prints the plan, touches nothing
  python import_excel.py --run      # LIVE    — actually writes to the database
"""

import re
import sys
import warnings
import psycopg2
import psycopg2.extras
import pandas as pd

warnings.filterwarnings("ignore")

# ─── Config ───────────────────────────────────────────────────────────────────
DB_URL    = (
    "postgresql://postgres.ngcwvfusvoevtmipudtc:Tour_mate2026"
    "@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
)
XLSX_PATH = "TourMate_attractions.xlsx"
DRY_RUN   = "--run" not in sys.argv   # default: dry-run only


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Load and clean the Excel sheet
# ─────────────────────────────────────────────────────────────────────────────
def load_excel(path: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Attractions", header=2)
    df.columns = [c.strip().replace("\n", " ") for c in df.columns]

    # Normalise variant column names
    renames = {}
    for col in df.columns:
        if col.startswith("avg_rating"):
            renames[col] = "avg_rating"
        elif col.startswith("popularity"):
            renames[col] = "popularity"
        elif col.startswith("price_range"):
            renames[col] = "price_range"
        elif col.startswith("crowd_pattern"):
            renames[col] = "crowd_pattern"
    if renames:
        df = df.rename(columns=renames)

    df = df.dropna(subset=["attraction_id"]).reset_index(drop=True)

    # Categories → comma-separated lowercase string
    df["categories_str"] = df["categories"].fillna("").apply(
        lambda x: ",".join(c.strip().lower() for c in str(x).split(",") if c.strip())
    )

    # meal_slot → comma-separated lowercase string (NaN → "")
    df["meal_slot_str"] = df["meal_slot"].fillna("").apply(
        lambda x: ",".join(
            s.strip().lower() for s in str(x).split(",")
            if s.strip().lower() not in ("", "nan", "n/a")
        )
    )

    # Numeric columns
    for col in ["avg_rating", "popularity", "avg_visit_hrs",
                "latitude", "longitude", "admission_egp", "total_reviews"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # open_hour / close_hour: "08:00" → 8
    def _parse_hour(val):
        try:
            s = str(val).split(":")[0]
            return int(float(s))
        except Exception:
            return 0
    df["open_hour_int"]  = df["open_hour"].apply(_parse_hour)
    df["close_hour_int"] = df["close_hour"].apply(_parse_hour)

    # price_range → price_min, price_max
    def parse_price(s):
        s = str(s)
        if "Free" in s:
            return 0.0, 0.0
        try:
            part = s.split("|")[-1].replace("EGP", "").strip()
            # handle both hyphen variants: "–" and "-"
            sep = "–" if "–" in part else ("-" if "-" in part else None)
            if sep:
                lo, hi = part.split(sep, 1)
                return float(lo.strip()), float(hi.strip())
            v = float(part)
            return v, v
        except Exception:
            return 0.0, 0.0

    df[["price_min", "price_max"]] = df["price_range"].apply(
        lambda x: pd.Series(parse_price(x))
    )

    # address / sub_type / crowd_label / crowd_pattern — fill NaN with ""
    for col in ["address", "sub_type", "crowd_label", "crowd_pattern",
                "district", "description"]:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str)
        else:
            df[col] = ""

    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Name-normalisation for duplicate detection
# ─────────────────────────────────────────────────────────────────────────────
def _norm(name: str) -> str:
    """Lowercase, collapse hyphens/punctuation, collapse whitespace."""
    s = str(name).lower().strip()
    s = re.sub(r"[-_'\"،]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — ALTER TABLE: add missing columns if needed
# ─────────────────────────────────────────────────────────────────────────────
ALTER_SQL = """
ALTER TABLE attractions
  ADD COLUMN IF NOT EXISTS attraction_id  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS categories     TEXT,
  ADD COLUMN IF NOT EXISTS sub_type       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS popularity     NUMERIC,
  ADD COLUMN IF NOT EXISTS total_reviews  INTEGER,
  ADD COLUMN IF NOT EXISTS meal_slot      TEXT,
  ADD COLUMN IF NOT EXISTS price_min      NUMERIC,
  ADD COLUMN IF NOT EXISTS price_max      NUMERIC;
"""


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Main migration logic
# ─────────────────────────────────────────────────────────────────────────────
def run_migration(dry_run: bool = True):
    mode = "DRY RUN" if dry_run else "LIVE RUN"
    print(f"\n{'='*60}")
    print(f"  TourMate Excel → PostgreSQL Migration  [{mode}]")
    print(f"{'='*60}\n")

    # Load Excel
    df = load_excel(XLSX_PATH)
    print(f"Excel loaded: {len(df)} attractions  "
          f"({df['city'].value_counts().to_dict()})\n")

    # Connect to PostgreSQL
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Apply schema changes (always safe — IF NOT EXISTS)
    if not dry_run:
        print("Applying ALTER TABLE (adding missing columns)...")
        cur.execute(ALTER_SQL)
        conn.commit()
        print("  Schema updated.\n")
    else:
        print("Schema change (dry run — not applied):")
        print("  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS attraction_id, "
              "categories, sub_type, popularity, total_reviews, meal_slot, "
              "price_min, price_max\n")

    # Load all existing PostgreSQL attractions
    cur.execute("""
        SELECT a.id, a.name, lower(trim(ci.name)) AS city
        FROM   attractions a
        LEFT JOIN cities ci ON ci.city_id = a.city_id
    """)
    pg_rows = cur.fetchall()
    # Build lookup: (norm_name, norm_city) → pg id
    pg_lookup = {
        (_norm(r["name"]), _norm(r["city"])): r["id"]
        for r in pg_rows
    }

    # Load city_id map from PostgreSQL
    cur.execute("SELECT city_id, lower(trim(name)) AS name FROM cities")
    city_id_map = {r["name"]: r["city_id"] for r in cur.fetchall()}

    # Iterate Excel rows and decide UPDATE vs INSERT
    updates  = []   # (pg_id, excel_row)
    inserts  = []   # excel_row
    skipped  = []   # name+city pairs already perfectly matched

    for _, row in df.iterrows():
        key = (_norm(row["name"]), _norm(row["city"]))
        if key in pg_lookup:
            pg_id = pg_lookup[key]
            updates.append((pg_id, row))
        else:
            inserts.append(row)

    # ── Print the plan ────────────────────────────────────────────────────────
    print("─── MATCHES (will UPDATE existing rows) ───")
    for pg_id, row in updates:
        print(f"  MATCH : '{row['name']}' ({row['city']}) "
              f"→ UPDATE existing id={pg_id}")

    print(f"\n─── NEW ATTRACTIONS (will INSERT) ───")
    for row in inserts:
        print(f"  NEW   : '{row['attraction_id']} — {row['name']}' "
              f"({row['city']}) → INSERT")

    print(f"\n{'─'*60}")
    print(f"  Will UPDATE : {len(updates)}")
    print(f"  Will INSERT : {len(inserts)}")
    print(f"  Total Excel : {len(df)}")
    print(f"{'─'*60}\n")

    if dry_run:
        print("DRY RUN complete — no changes made to the database.")
        print("Re-run with:  python import_excel.py --run")
        cur.close()
        conn.close()
        return

    # ── LIVE: Execute UPDATEs ─────────────────────────────────────────────────
    print("Running UPDATEs...")
    updated_count = 0
    for pg_id, row in updates:
        cur.execute("""
            UPDATE attractions SET
                attraction_id  = %(attraction_id)s,
                categories     = %(categories_str)s,
                sub_type       = %(sub_type)s,
                popularity     = %(popularity)s,
                total_reviews  = %(total_reviews)s,
                meal_slot      = %(meal_slot_str)s,
                price_min      = %(price_min)s,
                price_max      = %(price_max)s,
                avg_visit_hrs  = %(avg_visit_hrs)s,
                latitude       = CASE WHEN %(latitude)s = 0 THEN latitude ELSE %(latitude)s END,
                longitude      = CASE WHEN %(longitude)s = 0 THEN longitude ELSE %(longitude)s END,
                rating         = CASE WHEN %(avg_rating)s = 0 THEN rating ELSE %(avg_rating)s END,
                price_from     = %(price_min)s,
                crowd_label    = %(crowd_label)s,
                crowd_pattern  = %(crowd_pattern)s,
                address        = CASE WHEN %(address)s = '' THEN address ELSE %(address)s END,
                open_hour      = %(open_hour_int)s,
                close_hour     = %(close_hour_int)s,
                admission_egp  = %(admission_egp)s,
                updated_at     = NOW()
            WHERE id = %(pg_id)s
        """, {**row.to_dict(), "pg_id": pg_id})
        updated_count += 1

    conn.commit()
    print(f"  Updated {updated_count} rows.\n")

    # ── LIVE: Execute INSERTs ─────────────────────────────────────────────────
    print("Running INSERTs...")
    inserted_count = 0
    skipped_city   = 0
    for row in inserts:
        city_key = _norm(row["city"])
        city_id  = city_id_map.get(city_key)
        if city_id is None:
            print(f"  SKIP INSERT — city '{row['city']}' not in cities table "
                  f"(attraction: {row['name']})")
            skipped_city += 1
            continue

        cur.execute("""
            INSERT INTO attractions (
                attraction_id, name, city_id, description,
                categories, sub_type, rating, price_from,
                popularity, total_reviews, meal_slot,
                price_min, price_max, avg_visit_hrs,
                latitude, longitude,
                crowd_label, crowd_pattern,
                address, district, is_outdoor,
                open_hour, close_hour, admission_egp,
                is_popular
            ) VALUES (
                %(attraction_id)s, %(name)s, %(city_id)s, NULL,
                %(categories_str)s, %(sub_type)s, %(avg_rating)s, %(price_min)s,
                %(popularity)s, %(total_reviews)s, %(meal_slot_str)s,
                %(price_min)s, %(price_max)s, %(avg_visit_hrs)s,
                %(latitude)s, %(longitude)s,
                %(crowd_label)s, %(crowd_pattern)s,
                %(address)s, %(district)s, %(is_outdoor)s,
                %(open_hour_int)s, %(close_hour_int)s, %(admission_egp)s,
                false
            )
        """, {
            **row.to_dict(),
            "city_id":    city_id,
            "is_outdoor": bool(row.get("is_outdoor", False)),
        })
        inserted_count += 1

    conn.commit()
    print(f"  Inserted {inserted_count} rows.")
    if skipped_city:
        print(f"  Skipped  {skipped_city} rows (city not in cities table).\n")

    # ── Final summary ─────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) AS n FROM attractions")
    total = cur.fetchone()["n"]

    print(f"\n{'='*60}")
    print(f"  Migration complete!")
    print(f"  Updated : {updated_count}")
    print(f"  Inserted: {inserted_count}")
    print(f"  Total attractions in DB now: {total}")
    print(f"{'='*60}\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    run_migration(dry_run=DRY_RUN)
