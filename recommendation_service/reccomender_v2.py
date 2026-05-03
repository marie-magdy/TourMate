"""
TourMate Recommendation Engine  v3 (merged)
Graduation Project Edition

Algorithmic upgrades from v3:
  1. Bayesian rating score (replaces raw avg_rating)
  2. Popularity normalization
  3. 2-opt TSP route optimization (replaces nearest-neighbor only)
  4. Multi-day itinerary with geo-clustering (TTDP / TOPTW approach)
  5. Transport cost included in budget feasibility check
  6. Liked places force-included across geo zones

Time-window upgrade from v2:
  7. start_hour / end_hour payload fields (in addition to available_hours)
     — whichever pair is provided wins; available_hours is the fallback.
"""

import os
import math
import time
import requests
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from dataclasses import dataclass, field
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
DB_URL = os.getenv("DATABASE_URL")

ALL_CATEGORIES = [
    "ancient", "bakery", "beach", "cafe", "coastal", "cultural",
    "dessert", "experience", "family", "food", "grills", "historical",
    "indoor", "international", "landmark", "local", "mall", "modern",
    "museum", "nature", "nile view", "outdoor", "park", "religious",
    "restaurant", "seafood", "shopping", "viewpoint", "waterfront",
]
CAT_INDEX = {cat: i for i, cat in enumerate(ALL_CATEGORIES)}
N_DIMS    = len(ALL_CATEGORIES)

INTEREST_CATEGORY_MAP = {
    "adventure": ["outdoor", "nature", "experience", "viewpoint"],
    "diving":    ["beach", "coastal", "nature", "outdoor", "waterfront"],
    "food":      ["food", "restaurant", "cafe", "bakery", "dessert", "local", "seafood"],
    "party":     ["modern", "restaurant", "cafe", "viewpoint", "waterfront"],
    "history":   ["historical", "ancient", "museum", "landmark", "cultural", "religious"],
    "shopping":  ["shopping", "mall", "modern"],
    "nature":    ["nature", "outdoor", "park", "waterfront", "coastal", "beach"],
    "nightlife": ["modern", "restaurant", "cafe", "viewpoint", "waterfront"],
    "family":    ["family", "park", "museum", "outdoor", "cultural"],
    "culture":   ["cultural", "museum", "historical", "local", "religious"],
}

CITY_COORDS = {
    "hurghada":        (27.2579, 33.8116),
    "cairo":           (30.0444, 31.2357),
    "alexandria":      (31.2001, 29.9187),
    "luxor":           (25.6872, 32.6396),
    "aswan":           (24.0889, 32.8998),
    "sharm el sheikh": (27.9158, 34.3300),
    "dahab":           (28.5096, 34.5179),
    "marsa matrouh":   (31.3543, 27.2373),
    "siwa":            (29.2031, 25.5195),
    "el gouna":        (27.3949, 33.6773),
}

# ── Scoring weights ────────────────────────────────────────────────────────────
W_COSINE     = 0.60
W_POPULARITY = 0.20
W_RATING     = 0.10
W_PRICE      = 0.10

# ── Bayesian rating parameters ────────────────────────────────────────────────
BAYESIAN_MIN_REVIEWS = 30

# ── Bonuses / penalties ───────────────────────────────────────────────────────
LIKED_BONUS      = 0.15
CROWD_PENALTY    = {"Very High": 0.12, "High": 0.05, "Moderate": 0.00, "Low": 0.00}
HIDDEN_GEM_BONUS = 0.05

WALKING_KM     = 0.8
MAYBE_KM       = 2.0
COFFEE_GAP_HRS = 1.5
MIN_VISIT_HRS  = 0.5

# ── Taxi rates per city (EGP) — (base_egp, per_km_low, per_km_high) ──────────
CITY_TAXI_RATES: dict = {
    "cairo":           (15, 8,  12),
    "alexandria":      (15, 8,  12),
    "luxor":           (20, 10, 15),
    "aswan":           (20, 10, 15),
    "hurghada":        (20, 12, 18),
    "sharm el sheikh": (25, 15, 20),
    "dahab":           (10,  6, 10),
    "marsa matrouh":   (15,  8, 12),
    "siwa":            (20, 10, 15),
    "el gouna":        (20, 12, 16),
}
TAXI_RATES_DEFAULT = (15, 8, 12)

def get_taxi_rates(city: str) -> tuple:
    return CITY_TAXI_RATES.get(str(city).strip().lower(), TAXI_RATES_DEFAULT)

# ── In-process caches ─────────────────────────────────────────────────────────
_osrm_cache: dict = {}
_osm_cache:  dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: resolve start_hour / end_hour / available_hours from a payload
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_time_window(payload: dict) -> tuple[float, float]:
    """
    Return (start_hour, available_hours) from a payload dict.

    Priority:
      1. start_hour + end_hour  →  available_hours = end_hour - start_hour
      2. start_hour + available_hours  →  use both directly
      3. available_hours only  →  start_hour defaults to 9.0
      4. nothing  →  start_hour=9.0, available_hours=8.0
    """
    s_hr = payload.get("start_hour")
    e_hr = payload.get("end_hour")
    avail = payload.get("available_hours")

    if s_hr is not None and e_hr is not None:
        return float(s_hr), float(e_hr) - float(s_hr)
    if s_hr is not None and avail is not None:
        return float(s_hr), float(avail)
    if avail is not None:
        return 9.0, float(avail)
    return 9.0, 8.0


# ─────────────────────────────────────────────────────────────────────────────
# 1. DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────
def load_attractions(db_url: str = DB_URL) -> pd.DataFrame:
    conn = psycopg2.connect(db_url)
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT
            a.attraction_id,
            a.name,
            lower(trim(ci.name))              AS city,
            COALESCE(a.district, '')          AS district,
            COALESCE(a.latitude,  0)::float   AS latitude,
            COALESCE(a.longitude, 0)::float   AS longitude,
            COALESCE(a.address, '')           AS address,
            COALESCE(a.categories, '')        AS categories,
            COALESCE(a.sub_type, '')          AS sub_type,
            COALESCE(a.is_outdoor, false)     AS is_outdoor,
            COALESCE(a.avg_visit_hrs, 1)::float  AS avg_visit_hrs,
            COALESCE(a.admission_egp, 0)::float  AS admission_egp,
            COALESCE(a.rating, 0)::float         AS avg_rating,
            COALESCE(a.popularity, 0)::float     AS popularity,
            COALESCE(a.total_reviews, 0)::int    AS total_reviews,
            COALESCE(a.open_hour, 8)::int        AS open_hour,
            COALESCE(a.close_hour, 22)::int      AS close_hour,
            COALESCE(a.meal_slot, '')            AS meal_slot,
            COALESCE(a.price_min, 0)::float      AS price_min,
            COALESCE(a.price_max, 0)::float      AS price_max,
            COALESCE(a.crowd_label, '')          AS crowd_label,
            COALESCE(a.crowd_pattern, '')        AS crowd_pattern,
            COALESCE(a.description, '')          AS description,
            (
                SELECT ai.image_url
                FROM attraction_images ai
                WHERE ai.attraction_id = a.id
                  AND ai.is_primary = true
                LIMIT 1
            ) AS primary_image
        FROM attractions a
        LEFT JOIN cities ci ON ci.city_id = a.city_id
        WHERE a.attraction_id IS NOT NULL
        ORDER BY a.id
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    df = pd.DataFrame([dict(r) for r in rows])

    df["categories"] = df["categories"].fillna("").apply(
        lambda x: [c.strip().lower() for c in str(x).split(",") if c.strip()]
    )
    df["meal_slot"] = df["meal_slot"].fillna("").apply(
        lambda x: [s.strip().lower() for s in str(x).split(",")
                   if s.strip() not in ("", "n/a", "nan")]
    )

    def _price_range_str(row):
        if row["price_min"] == 0 and row["price_max"] == 0:
            return "Free"
        return f"Budget | {int(row['price_min'])}–{int(row['price_max'])} EGP"

    df["price_range"] = df.apply(_price_range_str, axis=1)
    df["price_avg"]   = (df["price_min"] + df["price_max"]) / 2.0
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2. VECTOR BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def build_category_vector(categories: list) -> np.ndarray:
    vec = np.zeros(N_DIMS, dtype=float)
    for cat in categories:
        if cat in CAT_INDEX:
            vec[CAT_INDEX[cat]] = 1.0
    return vec

def build_attraction_matrix(df: pd.DataFrame) -> np.ndarray:
    matrix = np.zeros((len(df), N_DIMS), dtype=float)
    for i, row in df.iterrows():
        matrix[i] = build_category_vector(row["categories"])
    return matrix


# ─────────────────────────────────────────────────────────────────────────────
# 3. USER PROFILE
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class UserProfile:
    user_id:               str
    name:                  str
    city:                  str
    preferred_categories:  list
    budget_egp:            float
    available_hours:       float
    current_lat:           float
    current_lon:           float
    liked_ids:             list  = field(default_factory=list)
    visited_ids:           list  = field(default_factory=list)
    eaten_meal_categories: list  = field(default_factory=list)
    dislikes_crowds:       bool  = False
    meal_budget_ratio:     float = 0.25
    accessibility_needs:   str   = "None"
    meal_plan:             str   = "3meals"
    preferred_area_lat:    float = 0.0
    preferred_area_lon:    float = 0.0
    preferred_area_radius_km: float = 0.0

    @property
    def meal_budget(self):
        return self.budget_egp * self.meal_budget_ratio

    @property
    def attraction_budget(self):
        return self.budget_egp * (1 - self.meal_budget_ratio)

    def to_vector(self) -> np.ndarray:
        return build_category_vector(self.preferred_categories)


# ─────────────────────────────────────────────────────────────────────────────
# 4. SCORING ENGINE
# UPDATE 1: Bayesian rating replaces raw avg_rating
# UPDATE 2: Popularity is normalized before weighting
# ─────────────────────────────────────────────────────────────────────────────
def compute_cosine_scores(user: UserProfile,
                          att_matrix: np.ndarray) -> np.ndarray:
    user_vec = user.to_vector().reshape(1, -1)
    return cosine_similarity(user_vec, att_matrix).flatten()


def bayesian_rating(rating: float,
                    review_count: int,
                    global_avg: float,
                    min_reviews: int = BAYESIAN_MIN_REVIEWS) -> float:
    """
    Bayesian average rating.

    Pulls low-review attractions toward the global mean so a place
    with 3 reviews at 5.0 does not outrank one with 500 at 4.7.

    Formula:
        score = (v * R + m * C) / (v + m)

    Where:
        v = attraction's review count
        R = attraction's average rating
        m = minimum reviews threshold (confidence floor)
        C = global average rating across all attractions
    """
    return (review_count * rating + min_reviews * global_avg) / \
           (review_count + min_reviews)


def score_all_attractions(user: UserProfile,
                          df: pd.DataFrame,
                          att_matrix: np.ndarray) -> pd.DataFrame:
    scored = df.copy()
    scored["cosine_sim"] = compute_cosine_scores(user, att_matrix)

    # ── UPDATE 1: Bayesian rating ─────────────────────────────────────────────
    global_avg = scored["avg_rating"].mean()
    scored["bayesian_rating"] = scored.apply(
        lambda r: bayesian_rating(
            r["avg_rating"],
            int(r["total_reviews"]),
            global_avg,
            BAYESIAN_MIN_REVIEWS
        ),
        axis=1
    )
    scored["rating_norm"] = scored["bayesian_rating"] / 5.0

    # ── UPDATE 2: Normalize popularity to [0, 1] ──────────────────────────────
    pop_max = scored["popularity"].max()
    scored["popularity_norm"] = (
        scored["popularity"] / pop_max if pop_max > 0
        else scored["popularity"]
    )

    def price_score(row):
        p, b = row["price_avg"], user.attraction_budget
        if p > b:  return 0.0
        if p == 0: return 0.8
        ratio = p / b
        if b >= 1500: return 0.4 + (0.6 * ratio)
        elif b >= 500: return 1.0 - (0.5 * ratio)
        else: return 1.0 - ratio

    scored["price_score"] = scored.apply(price_score, axis=1)
    scored["base_score"]  = (
        W_COSINE     * scored["cosine_sim"]
      + W_POPULARITY * scored["popularity_norm"]   # normalized
      + W_RATING     * scored["rating_norm"]        # bayesian
      + W_PRICE      * scored["price_score"]
    )

    # ── Area boost (for Day 2+ preferred zone) ────────────────────────────────
    area_boost_mask = None
    if user.preferred_area_radius_km > 0 and user.preferred_area_lat != 0.0:
        def _area_dist(row):
            R = 6371.0
            lat1 = math.radians(user.preferred_area_lat)
            lon1 = math.radians(user.preferred_area_lon)
            lat2 = math.radians(float(row["latitude"]))
            lon2 = math.radians(float(row["longitude"]))
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = (math.sin(dlat/2)**2 +
                 math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2)
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        area_dists      = scored.apply(_area_dist, axis=1)
        area_boost_mask = area_dists <= user.preferred_area_radius_km
        print(f"[SCORE] Area boost: {area_boost_mask.sum()} attractions "
              f"within {user.preferred_area_radius_km}km")

    def adjust(row):
        s = row["base_score"]
        if str(row["attraction_id"]) in user.liked_ids:
            s += LIKED_BONUS
        if user.dislikes_crowds:
            s -= CROWD_PENALTY.get(str(row.get("crowd_label", "")), 0.0)
        if str(row.get("crowd_label", "")) == "Low":
            s += HIDDEN_GEM_BONUS
        return round(max(0.0, s), 4)

    scored["final_score"] = scored.apply(adjust, axis=1)

    if area_boost_mask is not None:
        scored.loc[area_boost_mask, "final_score"] = (
            scored.loc[area_boost_mask, "final_score"] + 0.20
        ).clip(upper=1.0)

    print(f"[SCORE] liked_ids  : {user.liked_ids}")
    print(f"[SCORE] visited_ids: {user.visited_ids}")

    food_tags = {"restaurant", "cafe", "food", "bakery", "dessert"}
    is_food   = scored["categories"].apply(
        lambda cats: any(c in food_tags for c in cats)
    )
    base_mask = (
        (scored["city"] == user.city)
      & (~scored["attraction_id"].astype(str).isin(user.visited_ids))
      & (~is_food)
      & (scored["price_avg"] <= user.attraction_budget)
    )
    filtered = scored[base_mask & (scored["cosine_sim"] > 0)].copy()
    if filtered.empty:
        filtered = scored[base_mask].copy()
    # Final fallback: budget cap may be too tight (e.g. daily_budget split left
    # very little). Relax the price filter so Day 1 is never silently empty.
    if filtered.empty:
        base_mask_no_price = (
            (scored["city"] == user.city)
          & (~scored["attraction_id"].astype(str).isin(user.visited_ids))
          & (~is_food)
        )
        filtered = scored[base_mask_no_price & (scored["cosine_sim"] > 0)].copy()
        if filtered.empty:
            filtered = scored[base_mask_no_price].copy()
        if not filtered.empty:
            print(f"[SCORE] Budget cap relaxed — original attraction_budget "
                  f"{user.attraction_budget:.0f} EGP was too tight")
    filtered = filtered.sort_values(
        "final_score", ascending=False
    ).reset_index(drop=True)

    # Force-include liked attractions
    liked_mask = (
        scored["attraction_id"].astype(str).isin(
            [str(x) for x in user.liked_ids]
        )
        & (~scored["attraction_id"].astype(str).isin(
            [str(x) for x in user.visited_ids]
        ))
    )
    liked_rows = scored[liked_mask].copy()
    if not liked_rows.empty:
        print(f"[SCORE] Force-including liked: {liked_rows['name'].tolist()}")
        filtered = pd.concat(
            [liked_rows, filtered]
        ).drop_duplicates(
            subset="attraction_id"
        ).reset_index(drop=True)

    # Beach / mall dedup
    beach_tags = {"beach", "coastal"}
    is_beach   = filtered["categories"].apply(
        lambda cats: any(c in beach_tags for c in cats)
    )
    beach_idx  = filtered[is_beach].index.tolist()
    if len(beach_idx) > 1:
        filtered = filtered.drop(beach_idx[1:]).reset_index(drop=True)

    mall_tags = {"mall", "shopping"}
    is_mall   = filtered["categories"].apply(
        lambda cats: any(c in mall_tags for c in cats)
    )
    mall_idx  = filtered[is_mall].index.tolist()
    if len(mall_idx) > 1:
        filtered = filtered.drop(mall_idx[1:]).reset_index(drop=True)

    return filtered


# ─────────────────────────────────────────────────────────────────────────────
# 4b. OSRM
# ─────────────────────────────────────────────────────────────────────────────
OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"
_HEADERS  = {"User-Agent": "TourMate-RecommendationSystem/3.0 (thesis project)"}

def osrm_distance(origin_lat, origin_lon, dest_lat, dest_lon) -> dict:
    cache_key = f"{origin_lat},{origin_lon}|{dest_lat},{dest_lon}"
    if cache_key in _osrm_cache:
        return _osrm_cache[cache_key]

    url    = f"{OSRM_BASE}/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {"overview": "false"}
    try:
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=6)
        data = resp.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route  = data["routes"][0]
            result = {
                "distance_km":  round(route["distance"] / 1000.0, 2),
                "duration_min": round(route["duration"] / 60.0, 1),
                "source":       "osrm",
            }
            _osrm_cache[cache_key] = result
            return result
    except Exception as e:
        print(f"  [OSRM] Error: {e} — using fallback")

    return _haversine_fallback(origin_lat, origin_lon, dest_lat, dest_lon)


def osm_directions_url(origin_lat, origin_lon, dest_lat, dest_lon) -> str:
    return (f"https://www.openstreetmap.org/directions"
            f"?from={origin_lat},{origin_lon}&to={dest_lat},{dest_lon}"
            f"&engine=osrm_car")


def _haversine_fallback(lat1, lon1, lat2, lon2, city="Cairo") -> dict:
    R  = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a  = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    hav_km  = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    factor  = 1.35 if city == "Cairo" else 1.20
    road_km = hav_km * factor
    dur_min = (road_km / 30.0) * 60.0
    return {
        "distance_km":  round(road_km, 2),
        "duration_min": round(dur_min, 1),
        "source":       "haversine_fallback",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4c. OPENSTREETMAP
# ─────────────────────────────────────────────────────────────────────────────
def osm_geocode(address: str) -> dict:
    if address in _osm_cache:
        return _osm_cache[address]
    url    = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "limit": 1, "countrycodes": "eg"}
    try:
        time.sleep(1.1)
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=6)
        data = resp.json()
        if data:
            result = {
                "lat":          float(data[0]["lat"]),
                "lon":          float(data[0]["lon"]),
                "display_name": data[0]["display_name"],
                "source":       "osm",
            }
            _osm_cache[address] = result
            return result
    except Exception as e:
        print(f"  [OSM] Geocode error for '{address}': {e}")
    return None


def osm_reverse_geocode(lat: float, lon: float) -> dict:
    cache_key = f"rev:{lat:.5f},{lon:.5f}"
    if cache_key in _osm_cache:
        return _osm_cache[cache_key]
    url    = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lon, "format": "json"}
    try:
        time.sleep(1.1)
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=6)
        data = resp.json()
        addr = data.get("address", {})
        result = {
            "display_name": data.get("display_name", ""),
            "road":         addr.get("road", ""),
            "suburb":       addr.get("suburb", ""),
            "city":         addr.get("city", addr.get("town", "")),
            "source":       "osm",
        }
        _osm_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"  [OSM] Reverse geocode error: {e}")
    return None


def osm_maps_url(lat: float, lon: float, name: str = "") -> str:
    base = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}&zoom=16"
    if name:
        base += f"&layers=N&place={requests.utils.quote(name)}"
    return base


# ─────────────────────────────────────────────────────────────────────────────
# 5. TRANSPORT INFO
# ─────────────────────────────────────────────────────────────────────────────
def get_transport_info(origin_lat, origin_lon,
                       dest_lat, dest_lon,
                       dest_name="", city="Cairo") -> dict:
    dist_info = osrm_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    road_km   = dist_info["distance_km"]
    dur_min   = dist_info["duration_min"]

    base, per_km_low, per_km_high = get_taxi_rates(city)
    taxi_low  = round(base + road_km * per_km_low)
    taxi_high = round(base + road_km * per_km_high)
    taxi_mid  = round((taxi_low + taxi_high) / 2)

    if road_km <= WALKING_KM:
        mode, icon, cost_egp = "Walk", "🚶", 0
        tip = f"Walking distance — {road_km} km, ~{int(dur_min)} min (free)"
    elif road_km <= MAYBE_KM:
        mode, icon, cost_egp = "Walk or Taxi", "🚶🚗", taxi_mid
        tip = (f"Short ride — {road_km} km, ~{int(dur_min)} min  |  "
               f"Taxi: {taxi_low}–{taxi_high} EGP")
    else:
        mode, icon, cost_egp = "Taxi", "🚗", taxi_mid
        tip = (f"Taxi: {taxi_low}–{taxi_high} EGP  |  "
               f"{road_km} km, ~{int(dur_min)} min")

    return {
        "mode":            mode,
        "distance_km":     road_km,
        "duration_min":    dur_min,
        "cost_egp":        cost_egp,
        "icon":            icon,
        "tip":             tip,
        "costs":           {"taxi_low": taxi_low, "taxi_high": taxi_high},
        "directions_url":  osm_directions_url(origin_lat, origin_lon,
                                              dest_lat, dest_lon),
        "osm_url":         osm_maps_url(dest_lat, dest_lon, dest_name),
        "distance_source": dist_info["source"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. MEAL RECOMMENDATION
# ─────────────────────────────────────────────────────────────────────────────
def recommend_meals(df, user, slot, near_lat, near_lon,
                    visited_today, top_n=3):
    per_meal   = user.meal_budget / max(
        sum([1 for s in ["breakfast","lunch","dinner","coffee"]
             if slot == s]), 1
    )
    slot_clean = slot.lower().strip()

    SLOT_CATS = {
        "breakfast": {"cafe", "bakery", "restaurant", "food", "dessert"},
        "lunch":     {"restaurant", "food", "cafe", "seafood", "grills",
                      "local", "international"},
        "dinner":    {"restaurant", "food", "seafood", "grills", "local",
                      "international", "nile view", "waterfront"},
        "coffee":    {"cafe", "bakery", "dessert"},
    }
    slot_cats = SLOT_CATS.get(
        slot_clean, {"restaurant", "cafe", "food", "bakery", "dessert"}
    )

    CUISINE_DIVERSITY_CATS = {"seafood", "grills", "nile view", "waterfront",
                               "bakery", "dessert", "cafe"}
    eaten = set(user.eaten_meal_categories) & CUISINE_DIVERSITY_CATS

    cands = df[
        (df["city"] == user.city)
      & (df["meal_slot"].apply(lambda s: slot_clean in s))
      & (~df["attraction_id"].isin(visited_today))
      & (df["price_avg"] <= per_meal * 1.5)
      & (df["categories"].apply(lambda cats: any(c in slot_cats for c in cats)))
      & (~df["categories"].apply(lambda cats: bool(set(cats) & eaten)))
    ].copy()

    if cands.empty and eaten:
        print(f"[DIVERSITY] No {slot} options — relaxing diversity rule")
        cands = df[
            (df["city"] == user.city)
          & (df["meal_slot"].apply(lambda s: slot_clean in s))
          & (~df["attraction_id"].isin(visited_today))
          & (df["price_avg"] <= per_meal * 1.5)
          & (df["categories"].apply(lambda cats: any(c in slot_cats for c in cats)))
        ].copy()

    if cands.empty:
        cands = df[
            (df["city"] == user.city)
          & (df["meal_slot"].apply(lambda s: slot_clean in s))
          & (~df["attraction_id"].isin(visited_today))
          & (df["categories"].apply(lambda cats: any(c in slot_cats for c in cats)))
        ].copy()

    def meal_tier_score(row):
        p = row["price_avg"]
        if per_meal >= 150:
            if p >= 100: return 1.0
            if p >= 50:  return 0.6
            return 0.2
        elif per_meal >= 60:
            if 40 <= p <= 200: return 1.0
            return 0.6
        else:
            if p <= 80: return 1.0
            return 0.5

    cands["tier_score"] = cands.apply(meal_tier_score, axis=1)
    cands["dist_km"]    = cands.apply(
        lambda r: _haversine_fallback(
            near_lat, near_lon,
            r["latitude"], r["longitude"]
        )["distance_km"], axis=1,
    )
    max_dist            = cands["dist_km"].max()
    cands["prox_score"] = 1 - (cands["dist_km"] / (max_dist + 1e-9))
    cands["meal_score"] = (
        0.50 * cands["tier_score"]
      + 0.30 * cands["prox_score"]
      + 0.20 * (cands["avg_rating"] / 5.0)
    )
    cands = cands.sort_values("meal_score", ascending=False)

    results = []
    for _, row in cands.head(top_n).iterrows():
        transport = get_transport_info(
            near_lat, near_lon,
            row["latitude"], row["longitude"],
            dest_name=row["name"], city=user.city,
        )
        results.append({
            "id":          row["attraction_id"],
            "name":        row["name"],
            "sub_type":    row["sub_type"],
            "price_range": row["price_range"],
            "price_avg":   row["price_avg"],
            "rating":      row["avg_rating"],
            "description": str(row.get("description") or ""),
            "categories":  list(row["categories"]),
            "distance_km": transport["distance_km"],
            "transport":   transport,
            "address":     row["address"],
            "crowd_label": row["crowd_label"],
            "lat":         row["latitude"],
            "lon":         row["longitude"],
            "osm_url":     osm_maps_url(row["latitude"], row["longitude"],
                                        row["name"]),
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 7. ROUTE OPTIMISER
# UPDATE 3: 2-opt TSP replaces pure nearest-neighbor
# ─────────────────────────────────────────────────────────────────────────────
def optimise_route(top_df: pd.DataFrame,
                   start_lat: float,
                   start_lon: float) -> list:
    """
    Build and improve a route through the given attractions.

    Step 1: Nearest-neighbor greedy initialization.
    Step 2: 2-opt local search improvement.

    Returns an ordered list of attraction dicts.
    """
    if top_df.empty:
        return []

    # ── Step 1: Nearest-neighbor initialization ───────────────────────────────
    ordered   = []
    remaining = top_df.copy()
    clat, clon = start_lat, start_lon

    while not remaining.empty:
        remaining["dist"] = remaining.apply(
            lambda r: _haversine_fallback(
                clat, clon,
                r["latitude"], r["longitude"]
            )["distance_km"], axis=1
        )
        mx               = remaining["dist"].max()
        remaining["prox"] = 1 - remaining["dist"] / (mx + 1e-9)
        remaining["comb"] = (0.60 * remaining["prox"] +
                             0.40 * remaining["final_score"])
        idx  = remaining["comb"].idxmax()
        best = remaining.loc[idx]
        ordered.append(best)
        clat, clon = best["latitude"], best["longitude"]
        remaining  = remaining.drop(idx)

    if len(ordered) <= 2:
        return ordered

    # ── Step 2: 2-opt improvement ─────────────────────────────────────────────
    def route_distance(route: list) -> float:
        total = _haversine_fallback(
            start_lat, start_lon,
            route[0]["latitude"], route[0]["longitude"]
        )["distance_km"]
        for i in range(len(route) - 1):
            total += _haversine_fallback(
                route[i]["latitude"],   route[i]["longitude"],
                route[i+1]["latitude"], route[i+1]["longitude"]
            )["distance_km"]
        return total

    improved  = True
    best_dist = route_distance(ordered)

    while improved:
        improved = False
        for i in range(len(ordered) - 1):
            for j in range(i + 1, len(ordered)):
                new_route = (
                    ordered[:i] +
                    ordered[i:j+1][::-1] +
                    ordered[j+1:]
                )
                new_dist = route_distance(new_route)
                if new_dist < best_dist:
                    ordered   = new_route
                    best_dist = new_dist
                    improved  = True

    print(f"[2-OPT] Final route distance: {round(best_dist, 1)} km "
          f"({len(ordered)} stops)")
    return ordered


# ─────────────────────────────────────────────────────────────────────────────
# 7b. GEO-CLUSTERING (REBUILT FROM SCRATCH)
# Core idea: anchor each day around liked places, then fill with nearby ones
# ─────────────────────────────────────────────────────────────────────────────
def assign_geo_zones(df: pd.DataFrame,
                     num_days: int,
                     daily_hours: float,
                     liked_ids: list = None) -> pd.DataFrame:
    """
    Zone assignment strategy:
    
    Phase 1 — Anchor days around liked places
        If the user liked N places that are far apart, each group of
        geographically-close liked places becomes the anchor of one day.
    
    Phase 2 — Fill remaining attractions into the nearest anchor's zone
        Every non-liked attraction is assigned to whichever day-anchor
        is closest to it.
    
    This guarantees:
        - Nearby liked places share a day  (Montaza RG + Montaza Beach → Day 2)
        - Distant liked places get separate days  (Qaitbay → Day 1)
        - Non-liked attractions cluster around the day they fit best
    """
    liked_ids = [str(x) for x in (liked_ids or [])]

    valid = df[
        (df["latitude"]  != 0) &
        (df["longitude"] != 0)
    ].copy().reset_index(drop=True)

    if valid.empty:
        df["geo_zone"] = 0
        return df

    # ── Phase 1: cluster liked places into day-anchors ────────────────────────
    liked_df = valid[
        valid["attraction_id"].astype(str).isin(liked_ids)
    ].copy()

    print(f"\n[CLUSTER] {len(liked_df)} liked attractions to anchor zones")

    # Group liked places that are close to each other (< 8 km)
    # Each group becomes one day-anchor
    CLOSE_KM = 8.0
    anchors   = []   # list of dicts: {lat, lon, liked_ids_in_group}

    for _, row in liked_df.iterrows():
        placed = False
        for anchor in anchors:
            dist = _haversine_fallback(
                anchor["lat"], anchor["lon"],
                row["latitude"], row["longitude"]
            )["distance_km"]
            if dist <= CLOSE_KM:
                # Merge into existing anchor (update centroid)
                n = anchor["count"]
                anchor["lat"] = (anchor["lat"] * n + row["latitude"])  / (n + 1)
                anchor["lon"] = (anchor["lon"] * n + row["longitude"]) / (n + 1)
                anchor["count"] += 1
                anchor["liked_ids"].append(str(row["attraction_id"]))
                placed = True
                break
        if not placed:
            anchors.append({
                "lat":      row["latitude"],
                "lon":      row["longitude"],
                "count":    1,
                "liked_ids": [str(row["attraction_id"])],
            })

    print(f"[CLUSTER] Liked places form {len(anchors)} geographic group(s):")
    for i, a in enumerate(anchors):
        print(f"  Anchor {i}: {a['liked_ids']} @ "
              f"({a['lat']:.4f}, {a['lon']:.4f})")

    # If we have more anchors than days, merge the two closest anchors
    while len(anchors) > num_days:
        best_pair  = (0, 1)
        best_dist  = float("inf")
        for i in range(len(anchors)):
            for j in range(i + 1, len(anchors)):
                d = _haversine_fallback(
                    anchors[i]["lat"], anchors[i]["lon"],
                    anchors[j]["lat"], anchors[j]["lon"]
                )["distance_km"]
                if d < best_dist:
                    best_dist = d
                    best_pair = (i, j)
        i, j = best_pair
        # Merge j into i
        ni, nj = anchors[i]["count"], anchors[j]["count"]
        anchors[i]["lat"]      = (anchors[i]["lat"] * ni +
                                   anchors[j]["lat"] * nj) / (ni + nj)
        anchors[i]["lon"]      = (anchors[i]["lon"] * ni +
                                   anchors[j]["lon"] * nj) / (ni + nj)
        anchors[i]["count"]    = ni + nj
        anchors[i]["liked_ids"].extend(anchors[j]["liked_ids"])
        anchors.pop(j)
        print(f"[CLUSTER] Merged anchors {i} & {j} "
              f"(were {best_dist:.1f} km apart)")

    # If we have fewer anchors than days, pad with dummy anchors
    # (city centre coords) so every day has at least one anchor
    city_lat = valid["latitude"].mean()
    city_lon = valid["longitude"].mean()
    while len(anchors) < num_days:
        anchors.append({
            "lat":      city_lat,
            "lon":      city_lon,
            "count":    0,
            "liked_ids": [],
        })

    print(f"[CLUSTER] Final {len(anchors)} anchors for {num_days} days")

    # ── Phase 2: assign EVERY attraction to nearest anchor ────────────────────
    zone_map = {}   # attraction_id → zone (day index)

    for _, row in valid.iterrows():
        aid = str(row["attraction_id"])

        # First check: is this a liked place? assign to its own anchor's zone
        assigned = False
        for zone_idx, anchor in enumerate(anchors):
            if aid in anchor["liked_ids"]:
                zone_map[aid] = zone_idx
                assigned = True
                break

        if assigned:
            continue

        # Otherwise: assign to nearest anchor
        best_zone = 0
        best_dist = float("inf")
        for zone_idx, anchor in enumerate(anchors):
            d = _haversine_fallback(
                anchor["lat"], anchor["lon"],
                row["latitude"], row["longitude"]
            )["distance_km"]
            if d < best_dist:
                best_dist = d
                best_zone = zone_idx
        zone_map[aid] = best_zone

    valid["geo_zone"] = valid["attraction_id"].astype(str).map(zone_map).fillna(0).astype(int)

    # ── Phase 3: log result ───────────────────────────────────────────────────
    for z in range(num_days):
        zone_attractions = valid[valid["geo_zone"] == z]
        liked_in_zone    = zone_attractions[
            zone_attractions["attraction_id"].astype(str).isin(liked_ids)
        ]
        print(f"[CLUSTER] Zone {z} (Day {z+1}): "
              f"{len(zone_attractions)} attractions, "
              f"{len(liked_in_zone)} liked "
              f"({liked_in_zone['name'].tolist()})")

    # ── Merge geo_zone back into original df ──────────────────────────────────
    df = df.merge(
        valid[["attraction_id", "geo_zone"]],
        on="attraction_id",
        how="left"
    )
    df["geo_zone"] = df["geo_zone"].fillna(0).astype(int)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 8. PAYLOAD HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def expand_interest_labels(interests: list) -> list:
    categories = []
    for interest in interests:
        mapped = INTEREST_CATEGORY_MAP.get(str(interest).strip().lower(), [])
        categories.extend(mapped)
    return list(dict.fromkeys(categories))


def get_city_coords(city: str) -> tuple:
    return CITY_COORDS.get(str(city).strip().lower(), CITY_COORDS["cairo"])


def build_user_from_payload(payload: dict) -> UserProfile:
    city     = str(payload.get("city", "Cairo") or "Cairo").strip().lower()
    lat, lon = get_city_coords(city)
    interests = payload.get("interests", []) or []
    preferred_categories = (expand_interest_labels(interests) or
                             ["historical", "cultural", "outdoor"])

    # ── Resolve time window (v2 feature: start_hour / end_hour support) ───────
    start_hour, available_hours = _resolve_time_window(payload)

    return UserProfile(
        user_id=str(payload.get("user_id", "guest")),
        name=str(payload.get("name", "TourMate User")),
        city=city,
        preferred_categories=preferred_categories,
        budget_egp=float(payload.get("budget_egp", 1000) or 1000),
        available_hours=available_hours,
        current_lat=float(payload.get("current_lat", lat) or lat),
        current_lon=float(payload.get("current_lon", lon) or lon),
        liked_ids=[str(x) for x in (payload.get("liked_ids", []) or [])],
        visited_ids=[str(x) for x in (payload.get("visited_ids", []) or [])],
        eaten_meal_categories=[
            str(x).lower() for x in
            (payload.get("eaten_meal_categories", []) or [])
        ],
        dislikes_crowds=bool(payload.get("dislikes_crowds", False)),
        meal_budget_ratio=float(payload.get("meal_budget_ratio", 0.25) or 0.25),
        accessibility_needs=str(payload.get("accessibility_needs", "None")),
        meal_plan=str(payload.get("meal_plan", "3meals") or "3meals"),
        preferred_area_lat=float(payload.get("preferred_area_lat", 0.0) or 0.0),
        preferred_area_lon=float(payload.get("preferred_area_lon", 0.0) or 0.0),
        preferred_area_radius_km=float(
            payload.get("preferred_area_radius_km", 0.0) or 0.0
        ),
    )


def make_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_serializable(i) for i in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# 9. SINGLE-DAY ITINERARY BUILDER  (fixed)
# ─────────────────────────────────────────────────────────────────────────────

def _fmt(hour: float) -> str:
    """Format a fractional hour as HH:MM, clamped to [00:00, 23:59]."""
    hour = max(0.0, hour)          # guard against negative drift
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60:
        h, m = (h + 1) % 24, 0
    return f"{h:02d}:{m:02d}"


def build_itinerary(df, att_matrix, user,
                    start_hour=9, top_n=5, browse_n=5):
    scored = score_all_attractions(user, df, att_matrix)
    if scored.empty:
        return {"error": "No matching attractions found."}

    top = scored.head(top_n).reset_index(drop=True)

    liked_ids_set = {str(x) for x in user.liked_ids}
    liked_in_top  = top[top["attraction_id"].astype(str).isin(liked_ids_set)]
    other_in_top  = top[~top["attraction_id"].astype(str).isin(liked_ids_set)]

    _LIKED_MEAL_CATS = {"restaurant", "cafe", "food", "seafood", "grills",
                        "local", "international", "bakery", "dessert"}
    liked_meal_pool: list = df[
        df["attraction_id"].astype(str).isin(liked_ids_set)
        & df["categories"].apply(
            lambda cats: bool(set(cats) & _LIKED_MEAL_CATS)
        )
    ].to_dict("records")
    liked_used_as_meal: set = set()

    ordered_liked = (
        optimise_route(liked_in_top, user.current_lat, user.current_lon)
        if not liked_in_top.empty else []
    )

    NEARBY_KM = 2.0
    if len(ordered_liked) >= 2:
        reordered = [ordered_liked[0]]
        remaining_liked = list(ordered_liked[1:])
        while remaining_liked:
            last  = reordered[-1]
            dists = [
                _haversine_fallback(
                    last["latitude"], last["longitude"],
                    r["latitude"],    r["longitude"]
                )["distance_km"]
                for r in remaining_liked
            ]
            closest_idx = int(min(range(len(dists)), key=lambda i: dists[i]))
            closest     = remaining_liked.pop(closest_idx)
            if dists[closest_idx] <= NEARBY_KM:
                print(f"[ROUTE] Grouping nearby liked: "
                      f"'{last['name']}' + '{closest['name']}'")
            reordered.append(closest)
        ordered_liked = reordered

    last_lat = (ordered_liked[-1]["latitude"]
                if ordered_liked else user.current_lat)
    last_lon = (ordered_liked[-1]["longitude"]
                if ordered_liked else user.current_lon)
    ordered_other = (
        optimise_route(other_in_top, last_lat, last_lon)
        if not other_in_top.empty else []
    )
    ordered = ordered_liked + ordered_other

    # ── Shared mutable state ──────────────────────────────────────────────────
    itinerary       = []
    visited_today   = list(user.visited_ids)

    # FIX: single authoritative clock — never read curr_hr outside this scope
    curr_hr         = float(start_hour)   # wall-clock hour (fractional)

    prev_lat        = user.current_lat
    prev_lon        = user.current_lon
    total_cost      = 0.0
    total_transport = 0.0
    total_dist      = 0.0
    lunch_done      = False
    dinner_done     = False
    last_stop_type  = None
    beach_added     = False
    mall_added      = False

    BEACH_CATS   = {"beach", "coastal"}
    MALL_CATS    = {"mall", "shopping"}
    FOOD_CATS    = {"restaurant", "cafe", "food", "seafood", "grills",
                    "local", "international", "bakery", "dessert"}
    FOOD_GAP_HRS = 2.0
    last_meal_hr = float(start_hour) - 999.0
    last_att_dur = 0.0

    avail_hrs      = user.available_hours
    include_lunch  = avail_hrs >= 8
    include_dinner = avail_hrs > 12
    end_hr         = float(start_hour) + avail_hrs   # hard wall-clock deadline

    def time_left() -> float:
        """Remaining hours in the day."""
        return end_hr - curr_hr                       # FIX: derived from end_hr

    # ── Atomic stop recorder ──────────────────────────────────────────────────
    def _commit_stop(stop_dict: dict,
                     travel_hrs: float,
                     duration_hrs: float,
                     cost: float,
                     transport_cost: float,
                     dist_km: float,
                     stop_lat: float,
                     stop_lon: float,
                     stop_id,
                     stop_type: str,
                     att_dur: float = 0.0):
        """
        Append a stop and advance ALL shared state in one place.
        This is the ONLY location that mutates curr_hr / prev_lat / prev_lon
        and the cost accumulators, eliminating clock drift.
        """
        nonlocal curr_hr, prev_lat, prev_lon
        nonlocal total_cost, total_transport, total_dist
        nonlocal last_stop_type, last_meal_hr, last_att_dur

        # FIX: departure = current wall clock; arrival = departure + travel
        departure_time = _fmt(curr_hr)
        arrival_time   = _fmt(curr_hr + travel_hrs)

        stop_dict["departure_time"]      = departure_time
        stop_dict["time"]                = arrival_time   # displayed arrival
        stop_dict["travel_duration_min"] = round(travel_hrs * 60, 1)
        stop_dict["duration_hrs"]        = round(duration_hrs, 2)
        stop_dict["cost_egp"]            = round(cost, 2)
        stop_dict["transport_cost"]      = round(transport_cost, 2)
        stop_dict["distance_km"]         = round(dist_km, 2)

        itinerary.append(stop_dict)
        visited_today.append(stop_id)

        # Advance clock ONCE, atomically
        curr_hr         += travel_hrs + duration_hrs
        prev_lat         = stop_lat
        prev_lon         = stop_lon
        total_cost      += cost
        total_transport += transport_cost
        total_dist      += dist_km
        last_stop_type   = stop_type
        if stop_type == "meal":
            last_meal_hr = curr_hr
        if stop_type == "attraction":
            last_att_dur = att_dur

    # ── Meal helpers ──────────────────────────────────────────────────────────
    def add_meal(slot: str, emoji: str,
                 nlat: float, nlon: float, dur: float) -> bool:
        """Try to insert a recommended meal. Returns True if placed."""
        if time_left() < dur + MIN_VISIT_HRS:
            return False

        slot_clean = slot.lower().strip()
        opts = recommend_meals(df, user, slot_clean, nlat, nlon, visited_today)
        if not opts:
            return False

        pick           = opts[0]
        transport      = pick["transport"]
        transport_cost = float(transport.get("cost_egp", 0))
        travel_hrs     = float(transport.get("duration_min", 0) or 0) / 60.0

        # Guard: does the stop fit in the remaining window?
        if time_left() < travel_hrs + dur:
            return False

        # Budget guard (UPDATE 5: includes transport)
        remaining_budget = user.budget_egp - total_cost - total_transport
        if (pick["price_avg"] + transport_cost) > remaining_budget:
            return False

        stop_dict = {
            "type":        f"{emoji} {slot.capitalize()}",
            "name":        pick["name"],
            "id":          pick["id"],
            "latitude":    pick["lat"],
            "longitude":   pick["lon"],
            "address":     pick["address"],
            "description": pick.get("description", ""),
            "rating":      pick.get("rating", 0),
            "categories":  pick.get("categories", []),
            "transport":   transport,
            "options":     opts,
            "osm_url":     pick.get("osm_url", ""),
            "directions_url": transport.get("directions_url", ""),
        }
        _commit_stop(
            stop_dict,
            travel_hrs=travel_hrs,
            duration_hrs=dur,
            cost=pick["price_avg"],
            transport_cost=transport_cost,
            dist_km=transport["distance_km"],
            stop_lat=pick["lat"],
            stop_lon=pick["lon"],
            stop_id=pick["id"],
            stop_type="meal",
        )
        return True

    MAX_MEAL_DETOUR_KM = 8.0

    def try_liked_meal(slot: str, emoji: str, dur: float) -> bool:
        """Try to insert a liked-place as a meal. Returns True if placed."""
        slot_clean = slot.lower()
        candidates = [
            r for r in liked_meal_pool
            if str(r["attraction_id"]) not in liked_used_as_meal
            and r["attraction_id"] not in visited_today
            and slot_clean in (r.get("meal_slot") or [])
        ]
        if not candidates:
            return False

        candidates.sort(key=lambda r: _haversine_fallback(
            prev_lat, prev_lon, r["latitude"], r["longitude"]
        )["distance_km"])

        for r in candidates:
            straight_km = _haversine_fallback(
                prev_lat, prev_lon, r["latitude"], r["longitude"]
            )["distance_km"]
            if straight_km > MAX_MEAL_DETOUR_KM:
                print(f"[LIKED-MEAL] '{r['name']}' is {straight_km:.1f} km "
                      f"away — exceeds cap, skipping")
                continue                               # FIX: try next, not return

            t = get_transport_info(
                prev_lat, prev_lon,
                r["latitude"], r["longitude"],
                dest_name=r["name"], city=user.city,
            )
            travel_hrs     = float(t.get("duration_min", 0) or 0) / 60.0
            transport_cost = float(t.get("cost_egp", 0))

            if time_left() < travel_hrs + dur:
                continue

            remaining_budget = user.budget_egp - total_cost - total_transport
            if (float(r["price_avg"]) + transport_cost) > remaining_budget:
                continue

            stop_dict = {
                "type":        f"{emoji} {slot.capitalize()}",
                "name":        r["name"],
                "id":          r["attraction_id"],
                "latitude":    r["latitude"],
                "longitude":   r["longitude"],
                "address":     r.get("address", ""),
                "description": str(r.get("description") or ""),
                "rating":      float(r.get("avg_rating", 0)),
                "categories":  list(r.get("categories", [])),
                "transport":   t,
                "osm_url":     osm_maps_url(r["latitude"], r["longitude"],
                                            r["name"]),
                "directions_url": t.get("directions_url", ""),
            }
            liked_used_as_meal.add(str(r["attraction_id"]))
            _commit_stop(
                stop_dict,
                travel_hrs=travel_hrs,
                duration_hrs=dur,
                cost=float(r["price_avg"]),
                transport_cost=transport_cost,
                dist_km=t["distance_km"],
                stop_lat=r["latitude"],
                stop_lon=r["longitude"],
                stop_id=r["attraction_id"],
                stop_type="meal",
            )
            print(f"[LIKED-MEAL] '{r['name']}' placed as {slot}")
            return True

        return False

    # ── Breakfast ─────────────────────────────────────────────────────────────
    if start_hour <= 10:
        add_meal("breakfast", "🍳",
                 user.current_lat, user.current_lon, 0.5)

    lunch_trigger_hr  = min(float(start_hour) + avail_hrs * 0.40, 13.0)
    dinner_trigger_hr = float(start_hour) + avail_hrs * 0.75

    # ── Main attraction loop ──────────────────────────────────────────────────
    for att in ordered:
        if time_left() <= 0:
            break

        att_cats = set(att["categories"])

        if att_cats & BEACH_CATS and beach_added:
            print(f"[CAT-LIMIT] Skipping '{att['name']}' — beach already added")
            continue
        if att_cats & MALL_CATS and mall_added:
            print(f"[CAT-LIMIT] Skipping '{att['name']}' — mall already added")
            continue
        if str(att["attraction_id"]) in liked_used_as_meal:
            continue

        # Coffee after long attraction
        if (last_stop_type == "attraction" and
                last_att_dur >= COFFEE_GAP_HRS and lunch_done):
            add_meal("coffee", "☕", prev_lat, prev_lon, 0.4)

        # Lunch trigger
        if include_lunch and not lunch_done and curr_hr >= lunch_trigger_hr:
            if not try_liked_meal("lunch", "🍽", 0.75):
                add_meal("lunch", "🍽", prev_lat, prev_lon, 0.75)
            lunch_done = True

        # Dinner trigger
        if (include_dinner and not dinner_done and
                lunch_done and curr_hr >= dinner_trigger_hr):
            if not try_liked_meal("dinner", "🌙", 1.0):
                add_meal("dinner", "🌙", prev_lat, prev_lon, 1.0)
            dinner_done = True

        # Food-gap guard
        if (att_cats & FOOD_CATS and
                (curr_hr - last_meal_hr) < FOOD_GAP_HRS):
            print(f"[FOOD-GAP] Skipping '{att['name']}' — "
                  f"meal {curr_hr - last_meal_hr:.1f}h ago")
            continue

        if time_left() <= 0:
            break

        # ── Transport to this attraction ──────────────────────────────────────
        transport = get_transport_info(
            prev_lat, prev_lon,
            att["latitude"], att["longitude"],
            dest_name=att["name"], city=user.city,
        )
        transport_cost = float(transport.get("cost_egp", 0))
        travel_hrs     = float(transport.get("duration_min", 0) or 0) / 60.0

        # FIX: calculate arrival once, use consistently
        arrival_hr = curr_hr + travel_hrs

        # Time-left guard BEFORE computing duration
        if time_left() <= travel_hrs:
            continue

        # Budget guard
        is_liked = str(att["attraction_id"]) in liked_ids_set
        remaining_budget = user.budget_egp - total_cost - total_transport
        if not is_liked and (float(att["price_avg"]) + transport_cost) > remaining_budget:
            continue

        # Opening-hours guard (uses arrival_hr, not curr_hr)
        open_hr  = float(att.get("open_hour",  0))
        close_hr = float(att.get("close_hour", 24))
        if arrival_hr < open_hr:
            print(f"[TIME-CHECK] Skipping '{att['name']}' — "
                  f"arrives {_fmt(arrival_hr)}, opens {_fmt(open_hr)}")
            continue
        if arrival_hr >= close_hr - MIN_VISIT_HRS:
            print(f"[TIME-CHECK] Skipping '{att['name']}' — "
                  f"arrives {_fmt(arrival_hr)}, closes {_fmt(close_hr)}")
            continue

        # Duration: min of desired / time remaining / time until close
        raw_dur          = max(float(att["avg_visit_hrs"]), MIN_VISIT_HRS)
        time_until_close = close_hr - arrival_hr
        dur = min(
            raw_dur,
            max(0.0, time_left() - travel_hrs),  # FIX: time_left() already
            time_until_close,                     #      accounts for travel
        )
        if dur < MIN_VISIT_HRS:
            continue

        stop_dict = {
            "type":            "🏛 Attraction",
            "name":            att["name"],
            "id":              att["attraction_id"],
            "latitude":        att["latitude"],
            "longitude":       att["longitude"],
            "cosine_sim":      round(float(att["cosine_sim"]), 3),
            "final_score":     round(float(att["final_score"]), 3),
            "bayesian_rating": round(float(att.get("bayesian_rating", 0)), 3),
            "transport":       transport,
            "address":         att["address"],
            "description":     att.get("description", ""),
            "categories":      att["categories"],
            "crowd_label":     att["crowd_label"],
            "crowd_pattern":   att["crowd_pattern"],
            "rating":          att["avg_rating"],
            "open":            att["open_hour"],
            "close":           att["close_hour"],
            "directions_url":  transport.get("directions_url", ""),
            "osm_url":         osm_maps_url(
                att["latitude"], att["longitude"], att["name"]
            ),
        }
        
        _commit_stop(
            stop_dict,
            travel_hrs=travel_hrs,
            duration_hrs=dur,
            cost=float(att["price_avg"]),
            transport_cost=transport_cost,
            dist_km=transport["distance_km"],
            stop_lat=att["latitude"],
            stop_lon=att["longitude"],
            stop_id=att["attraction_id"],
            stop_type="attraction",
            att_dur=dur,
        )

        if att_cats & BEACH_CATS:
            beach_added = True
        if att_cats & MALL_CATS:
            mall_added = True

    # ── Post-loop meal safety nets ────────────────────────────────────────────
    lunch_added_in_safety = False
    if include_lunch and not lunch_done and time_left() >= 1.5:
        if not try_liked_meal("lunch", "🍽", 0.75):
            add_meal("lunch", "🍽", prev_lat, prev_lon, 0.75)
        lunch_done            = True
        lunch_added_in_safety = True

    if (include_dinner and not dinner_done and
            lunch_done and not lunch_added_in_safety):
        if not try_liked_meal("dinner", "🌙", 1.0):
            add_meal("dinner", "🌙", prev_lat, prev_lon, 1.0)
        dinner_done = True

    # ── Missed liked places ───────────────────────────────────────────────────
    added_ids           = {str(s["id"]) for s in itinerary}
    missed_liked_places = []
    for lid in user.liked_ids:
        if str(lid) not in added_ids:
            row  = df[df["attraction_id"].astype(str) == str(lid)]
            name = row.iloc[0]["name"] if not row.empty else f"Place {lid}"
            missed_liked_places.append({
                "id":      str(lid),
                "name":    name,
                "message": (
                    f"We couldn't fit {name} into your plan — "
                    "try adding more days or increasing your budget."
                ),
            })

    ranked = [{
        "rank":            i + 1,
        "id":              a["attraction_id"],
        "name":            a["name"],
        "cosine_sim":      round(float(a["cosine_sim"]), 3),
        "final_score":     round(float(a["final_score"]), 3),
        "bayesian_rating": round(float(a.get("bayesian_rating", 0)), 3),
        "categories":      a["categories"],
        "price_range":     a["price_range"],
        "price_avg":       round(float(a["price_avg"]), 0),
        "avg_visit_hrs":   round(float(a["avg_visit_hrs"]), 1),
        "crowd_label":     a["crowd_label"],
        "rating":          a["avg_rating"],
        "osm_url":         osm_maps_url(
            a["latitude"], a["longitude"], a["name"]
        ),
    } for i, (_, a) in enumerate(scored.head(browse_n).iterrows())]

    total_hrs = curr_hr - float(start_hour)
    total_all = total_cost + total_transport

    return {
        "user":                    user.name,
        "city":                    user.city,
        "recommended_attractions": ranked,
        "itinerary":               itinerary,
        "missed_liked_places":     missed_liked_places,
        "stats": {
            "total_stops":            len(itinerary),
            "total_hours":            round(total_hrs, 1),
            "total_visit_hours":      round(
                sum(s["duration_hrs"] for s in itinerary), 1
            ),
            "total_travel_hours":     round(
                sum(float(s.get("travel_duration_min", 0) or 0) / 60.0
                    for s in itinerary), 1
            ),
            "cost_attractions_meals": round(total_cost, 0),
            "cost_transport_egp":     round(total_transport, 0),
            "total_cost_egp":         round(total_all, 0),
            "total_distance_km":      round(total_dist, 1),
            "budget_remaining":       round(user.budget_egp - total_all, 0),
        },
        "api_status": {
            "osrm":          "live (no key needed)",
            "openstreetmap": "live (no key needed)",
        },
    }

# ─────────────────────────────────────────────────────────────────────────────
# 10. MULTI-DAY ITINERARY GENERATOR (updated to pass liked_ids to clustering)
# ─────────────────────────────────────────────────────────────────────────────
def generate_multi_day_itinerary(payload: dict,
                                  df: pd.DataFrame = None,
                                  att_matrix: np.ndarray = None) -> dict:
    local_df     = df         if df is not None else load_attractions()
    local_matrix = (att_matrix if att_matrix is not None
                    else build_attraction_matrix(local_df))

    user       = build_user_from_payload(payload)
    num_days   = int(payload.get("num_days", 1))
    start_hour, daily_hours = _resolve_time_window(payload)
    user.available_hours    = daily_hours

    top_n    = int(payload.get("top_n",    10))
    browse_n = int(payload.get("browse_n", 20))

    city_df = local_df[local_df["city"] == user.city].copy()
    if city_df.empty:
        return {"error": f"No attractions found for city: {user.city}"}

    # ── Cluster with liked_ids as anchors ─────────────────────────────────────
    city_df = assign_geo_zones(
        city_df,
        num_days,
        daily_hours,
        liked_ids=user.liked_ids       # ← NEW: pass liked places
    )

    visited_all  = list(user.visited_ids)
    total_budget = user.budget_egp
    budget_left  = user.budget_egp
    daily_budget = user.budget_egp / num_days
    all_days     = []
    liked_ids_set = {str(x) for x in user.liked_ids}
    scheduled_attractions = set()

    for day in range(num_days):
        print(f"\n{'='*60}")
        print(f"[MULTI-DAY] Day {day+1}/{num_days}  "
              f"zone={day}  budget={round(daily_budget)} EGP  "
              f"hours={daily_hours}h")
        print(f"{'='*60}")

        zone_df = city_df[city_df["geo_zone"] == day].copy()

        # Safety: if this zone is empty, fall back to full city pool
        
        # AFTER (supplements zone with nearby attractions, preserving zone priority)
        if len(zone_df) < 3:
            print(f"[MULTI-DAY] Zone {day} has only {len(zone_df)} "
                f"attractions — supplementing from city pool")
            
            # Get the anchor centroid for this zone
            zone_anchor = zone_df[["latitude", "longitude"]].mean() if not zone_df.empty else None
            
            supplement = city_df[
                ~city_df["attraction_id"].astype(str).isin(visited_all)
                & (city_df["geo_zone"] != day)  # from other zones
            ].copy()
            
            if zone_anchor is not None and not supplement.empty:
                # Sort supplement by distance to this zone's centroid
                anchor_lat = zone_anchor["latitude"]
                anchor_lon = zone_anchor["longitude"]
                supplement["_dist"] = supplement.apply(
                    lambda r: _haversine_fallback(
                        anchor_lat, anchor_lon,
                        r["latitude"], r["longitude"]
                    )["distance_km"], axis=1
                )
                supplement = supplement.sort_values("_dist").drop(columns=["_dist"])
            
            # Append nearest extras, but zone attractions stay at the top
            zone_df = pd.concat([zone_df, supplement]).drop_duplicates(
                subset="attraction_id"
            ).reset_index(drop=True)

            # Remove already visited / scheduled
            zone_df = zone_df[
                ~zone_df["attraction_id"].astype(str).isin(visited_all)
            ].reset_index(drop=True)

            if zone_df.empty:
                all_days.append({"day": day + 1,"error": "No remaining attractions."})
                continue

            zone_matrix = build_attraction_matrix(zone_df)

            user.visited_ids     = visited_all
            user.budget_egp      = min(daily_budget, budget_left)
            user.available_hours = daily_hours

            day_result = build_itinerary(
                zone_df, zone_matrix, user,
                start_hour=start_hour,
                top_n=top_n,
                browse_n=browse_n,
            )

            if "error" not in day_result:
                for stop in day_result.get("itinerary", []):
                    scheduled_attractions.add(str(stop["id"]))
                    visited_all.append(str(stop["id"]))

                spent       = day_result["stats"]["total_cost_egp"]
                budget_left = max(0.0, budget_left - spent)

                day_result["day"]            = day + 1
                day_result["geo_zone"]       = day
                day_result["budget_for_day"] = round(user.budget_egp, 0)
                day_result["start_hour"]     = start_hour
                day_result["end_hour"]       = start_hour + daily_hours
            else:
                day_result["day"] = day + 1

            all_days.append(day_result)

        total_spent = total_budget - budget_left
        return make_serializable({
            "user":             user.name,
            "city":             user.city,
            "num_days":         num_days,
            "start_hour":       start_hour,
            "end_hour":         start_hour + daily_hours,
            "days":             all_days,
            "total_budget":     round(total_budget, 0),
            "total_spent":      round(total_spent, 0),
            "budget_remaining": round(budget_left, 0),
            "visited_all":      visited_all,
        })

# ─────────────────────────────────────────────────────────────────────────────
# 11. ENTRY POINT
# Routes to multi-day or single-day builder based on num_days.
# Fully supports: start_hour/end_hour, start_hour/available_hours,
#                 available_hours only, or neither (defaults apply).
# ─────────────────────────────────────────────────────────────────────────────
def generate_itinerary_from_payload(payload: dict,
                                     df: pd.DataFrame = None,
                                     att_matrix: np.ndarray = None) -> dict:
    num_days = int(payload.get("num_days", 1))

    if num_days > 1:
        return generate_multi_day_itinerary(payload, df, att_matrix)

    # ── Single-day path ────────────────────────────────────────────────────────
    local_df     = df         if df is not None else load_attractions()
    local_matrix = att_matrix if att_matrix is not None else build_attraction_matrix(local_df)

    user = build_user_from_payload(payload)

    # Resolve time window — build_user_from_payload already set available_hours,
    # but we also need start_hour for build_itinerary's clock logic.
    start_hour, available_hours = _resolve_time_window(payload)
    user.available_hours = available_hours   # ensure override is applied

    top_n    = int(payload.get("top_n",    10) or 10)
    browse_n = int(payload.get("browse_n", 20) or 20)

    result = build_itinerary(
        local_df, local_matrix, user,
        start_hour=start_hour, top_n=top_n, browse_n=browse_n
    )
    result["request"] = {
        "city":                 user.city,
        "interests":            payload.get("interests", []),
        "preferred_categories": user.preferred_categories,
        "budget_egp":           user.budget_egp,
        "available_hours":      available_hours,
        "start_hour":           start_hour,
        "end_hour":             payload.get("end_hour"),
    }
    return make_serializable(result)


# ─────────────────────────────────────────────────────────────────────────────
# 12. PRETTY PRINTER
# ─────────────────────────────────────────────────────────────────────────────
def print_itinerary(result, user=None):
    if "error" in result:
        print(f"\n  ERROR: {result['error']}\n")
        return

    # Multi-day result
    if "days" in result:
        print(f"\n{'='*75}")
        print(f"  TourMate  |  {result['user']}  |  {result['city']}  "
              f"|  {result['num_days']} days")
        tw = f"  Daily window: {_fmt(result.get('start_hour', 9))} – {_fmt(result.get('end_hour', 18))}"
        print(tw)
        print(f"  Total Budget: {int(result['total_budget'])} EGP  |  "
              f"Spent: {int(result['total_spent'])} EGP  |  "
              f"Remaining: {int(result['budget_remaining'])} EGP")
        print(f"{'='*75}")
        for day in result["days"]:
            print(f"\n  ── DAY {day['day']} "
                  f"(Zone {day.get('geo_zone', '?')}) ──────────────────────────")
            if "error" in day:
                print(f"     {day['error']}")
                continue
            print_itinerary(day, user=None)
        return

    W = 75
    print(f"\n{'='*W}")
    print(f"  TourMate  |  {result['user']}  |  {result['city']}")
    if "api_status" in result:
        s = result["api_status"]
        print(f"  APIs: OSRM [{s['osrm']}]  OSM [{s['openstreetmap']}]")
    if "request" in result:
        req = result["request"]
        sh  = req.get("start_hour", 9)
        eh  = req.get("end_hour") or (sh + req.get("available_hours", 8))
        print(f"  Time window: {_fmt(sh)} – {_fmt(eh)}  "
              f"({req.get('available_hours', 8):.1f}h)")
    print(f"{'='*W}")

    print(f"\n  {'#':<3} {'Name':<28} {'Cosine':<8} {'Bayes':<7} "
          f"{'Final':<8} {'Crowd':<12} Price")
    print("  " + "-" * (W - 2))
    for a in result["recommended_attractions"]:
        print(f"  {a['rank']:<3} {a['name'][:26]:<28} {a['cosine_sim']:<8} "
              f"{a.get('bayesian_rating', 0):<7} {a['final_score']:<8} "
              f"{a['crowd_label']:<12} {a['price_range']}")

    print(f"\n  FULL DAY ITINERARY")
    print("  " + "-" * (W - 2))
    for stop in result["itinerary"]:
        print(f"\n  {stop['time']}  {stop['type']}  —  {stop['name']}")
        t     = stop.get("transport", {})
        costs = t.get("costs", {})
        print(f"     {t.get('icon','')}  {t.get('tip','')}")
        if costs:
            print(f"     Taxi: {costs.get('taxi_low',0)}–"
                  f"{costs.get('taxi_high',0)} EGP")
        line = (f"     Duration: {stop['duration_hrs']}hr  "
                f"Place cost: {int(stop['cost_egp'])} EGP  "
                f"Transport: {int(stop.get('transport_cost', 0))} EGP")
        if "cosine_sim" in stop:
            line += (f"  Cosine: {stop['cosine_sim']}  "
                     f"Bayes: {stop.get('bayesian_rating', '—')}  "
                     f"Score: {stop['final_score']}")
        print(line)
        d = stop.get("directions_url", "")
        o = stop.get("osm_url", "")
        if d: print(f"     🗺  Directions → {d}")
        if o: print(f"     📍 OSM pin    → {o}")
        if "options" in stop and len(stop["options"]) > 1:
            print(f"     Other options: "
                  f"{', '.join(x['name'] for x in stop['options'][1:])}")

    s = result["stats"]
    print(f"\n{'-'*W}")
    print(f"  {s['total_stops']} stops  |  {s['total_hours']} hrs  |  "
          f"{s['total_distance_km']} km")
    print(f"  Attractions & Meals: {int(s['cost_attractions_meals'])} EGP  |  "
          f"Transport: {int(s['cost_transport_egp'])} EGP  |  "
          f"TOTAL: {int(s['total_cost_egp'])} EGP")
    if user:
        print(f"  Budget: {int(user.budget_egp)} EGP  →  "
              f"Remaining: {int(s['budget_remaining'])} EGP")
    print(f"{'='*W}\n")


# ─────────────────────────────────────────────────────────────────────────────
# 13. DEMO
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":

    print("Loading database...")
    df         = load_attractions()
    att_matrix = build_attraction_matrix(df)
    print(f"Loaded {len(df)} attractions | {N_DIMS}-dim vector space\n")

    # ── Demo 1: Single-day via UserProfile (start_hour passed directly) ────────
    sarah = UserProfile(
        user_id="USR001",
        name="Sarah Mitchell (Tourist, Cairo)",
        city="cairo",
        preferred_categories=["historical", "ancient", "museum", "outdoor"],
        budget_egp=2000,
        available_hours=9.0,
        current_lat=30.0478,
        current_lon=31.2336,
        liked_ids=["ATT001", "ATT002"],
        visited_ids=["ATT001"],
        dislikes_crowds=False,
    )
    print_itinerary(
        build_itinerary(df, att_matrix, sarah, start_hour=9, top_n=5),
        user=sarah
    )

    # ── Demo 2: Single-day via payload with start_hour + end_hour ─────────────
    print("\n" + "="*75)
    print("SINGLE-DAY DEMO — start_hour / end_hour payload")
    print("="*75)
    single_payload = {
        "user_id":    "USR003",
        "name":       "Layla Hassan",
        "city":       "cairo",
        "interests":  ["history", "culture"],
        "budget_egp": 1500,
        # Time window: 10:00 → 18:00  (8 hours)
        "start_hour": 10,
        "end_hour":   18,
        "top_n":      6,
        "browse_n":   10,
    }
    print_itinerary(
        generate_itinerary_from_payload(single_payload, df, att_matrix)
    )

    # ── Demo 3: Multi-day (3 days Cairo via payload with start/end hours) ──────
    print("\n" + "="*75)
    print("MULTI-DAY DEMO — 3 days in Cairo with start_hour / end_hour")
    print("="*75)
    multi_payload = {
        "user_id":           "USR002",
        "name":              "Ahmed Hassan",
        "city":              "cairo",
        "interests":         ["history", "culture", "food"],
        "budget_egp":        5000,
        "num_days":          3,
        # Each day runs 09:00 → 18:00  (9 hours)
        "start_hour":        9,
        "end_hour":          18,
        "top_n":             8,
        "browse_n":          15,
        "liked_ids":         ["ATT001", "ATT016"],
        "visited_ids":       [],
        "dislikes_crowds":   False,
        "meal_budget_ratio": 0.25,
    }
    result = generate_itinerary_from_payload(multi_payload, df, att_matrix)
    print_itinerary(result)