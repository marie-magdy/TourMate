"""
TourMate Recommendation Engine  v2
No .env or API keys needed 
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

# Load .env if present
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
    "diving": ["beach", "coastal", "nature", "outdoor", "waterfront"],
    "food": ["food", "restaurant", "cafe", "bakery", "dessert", "local", "seafood"],
    "party": ["modern", "restaurant", "cafe", "viewpoint", "waterfront"],
    "history": ["historical", "ancient", "museum", "landmark", "cultural", "religious"],
    "shopping": ["shopping", "mall", "modern"],
    "nature": ["nature", "outdoor", "park", "waterfront", "coastal", "beach"],
    "nightlife": ["modern", "restaurant", "cafe", "viewpoint", "waterfront"],
    "family": ["family", "park", "museum", "outdoor", "cultural"],
    "culture": ["cultural", "museum", "historical", "local", "religious"],
}

CITY_COORDS = {
    "hurghada": (27.2579, 33.8116),
    "cairo": (30.0444, 31.2357),
    "alexandria": (31.2001, 29.9187),
    "luxor": (25.6872, 32.6396),
    "aswan": (24.0889, 32.8998),
    "sharm el sheikh": (27.9158, 34.3300),
    "dahab": (28.5096, 34.5179),
    "marsa matrouh": (31.3543, 27.2373),
    "siwa": (29.2031, 25.5195),
    "el gouna": (27.3949, 33.6773),
}

# Scoring weights
W_COSINE     = 0.60
W_POPULARITY = 0.20
W_RATING     = 0.10
W_PRICE      = 0.10

# Bonuses / penalties
LIKED_BONUS      = 0.15
CROWD_PENALTY    = {"Very High": 0.12, "High": 0.05, "Moderate": 0.00, "Low": 0.00}
HIDDEN_GEM_BONUS = 0.05

WALKING_KM     = 0.8
MAYBE_KM       = 2.0
COFFEE_GAP_HRS = 1.5
MIN_VISIT_HRS  = 0.5   # minimum 30 minutes at any attraction

# Taxi rates per city (EGP, 2024-2025)
# (base_egp, per_km_low, per_km_high)
CITY_TAXI_RATES: dict = {
    "cairo":          (15, 8,  12),   # metered + negotiated
    "alexandria":     (15, 8,  12),   # similar to Cairo
    "luxor":          (20, 10, 15),   # tourist city, higher
    "aswan":          (20, 10, 15),   # tourist city, higher
    "hurghada":       (20, 12, 18),   # resort, tourist pricing
    "sharm el sheikh":(25, 15, 20),   # most expensive resort area
    "dahab":          (10,  6, 10),   # small town, lower prices
    "marsa matrouh":  (15,  8, 12),   # seasonal resort
    "siwa":           (20, 10, 15),   # remote, limited transport
    "el gouna":       (20, 12, 16),   # gated resort community
}
# Default fallback for unknown cities
TAXI_RATES_DEFAULT = (15, 8, 12)


def get_taxi_rates(city: str) -> tuple[int, int, int]:
    """Return (base_egp, per_km_low, per_km_high) for the given city."""
    return CITY_TAXI_RATES.get(str(city).strip().lower(), TAXI_RATES_DEFAULT)

# ── Simple in-process cache to avoid redundant API calls ─────────────────────
_osrm_cache: dict = {}
_osm_cache:  dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# 1. DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────
def load_attractions(db_url: str = DB_URL) -> pd.DataFrame:
    """Load attractions from PostgreSQL. Only rows with ATT### attraction_ids are loaded."""
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

    # Parse comma-separated TEXT columns into lists
    df["categories"] = df["categories"].fillna("").apply(
        lambda x: [c.strip().lower() for c in str(x).split(",") if c.strip()]
    )
    df["meal_slot"] = df["meal_slot"].fillna("").apply(
        lambda x: [s.strip().lower() for s in str(x).split(",")
                   if s.strip() not in ("", "n/a", "nan")]
    )

    # Synthesize price_range string used by the /attractions API response
    def _price_range_str(row):
        if row["price_min"] == 0 and row["price_max"] == 0:
            return "Free"
        return f"Budget | {int(row['price_min'])}–{int(row['price_max'])} EGP"

    df["price_range"] = df.apply(_price_range_str, axis=1)
    df["price_avg"] = (df["price_min"] + df["price_max"]) / 2.0
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
    user_id:              str
    name:                 str
    city:                 str
    preferred_categories: list
    budget_egp:           float
    available_hours:      float
    current_lat:          float
    current_lon:          float
    liked_ids:            list = field(default_factory=list)
    visited_ids:          list = field(default_factory=list)
    eaten_meal_categories: list = field(default_factory=list)  # cuisine types already used on previous days
    dislikes_crowds:      bool  = False
    meal_budget_ratio:    float = 0.25
    accessibility_needs:  str   = "None"
    meal_plan:            str   = "3meals"          # "2meals" skips lunch & coffee
    preferred_area_lat:   float = 0.0
    preferred_area_lon:   float = 0.0
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
# 4. COSINE SIMILARITY SCORING  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
def compute_cosine_scores(user: UserProfile, att_matrix: np.ndarray) -> np.ndarray:
    user_vec = user.to_vector().reshape(1, -1)
    return cosine_similarity(user_vec, att_matrix).flatten()


def score_all_attractions(user: UserProfile, df: pd.DataFrame,
                          att_matrix: np.ndarray) -> pd.DataFrame:
    scored = df.copy()
    scored["cosine_sim"] = compute_cosine_scores(user, att_matrix)

    def price_score(row):
        p, b = row["price_avg"], user.attraction_budget
        if p > b:  return 0.0
        if p == 0: return 0.8
        ratio = p / b
        if b >= 1500: return 0.4 + (0.6 * ratio)
        elif b >= 500: return 1.0 - (0.5 * ratio)
        else: return 1.0 - ratio

    scored["price_score"] = scored.apply(price_score, axis=1)
    scored["rating_norm"] = scored["avg_rating"] / 5.0
    scored["base_score"]  = (
        W_COSINE     * scored["cosine_sim"]
      + W_POPULARITY * scored["popularity"]
      + W_RATING     * scored["rating_norm"]
      + W_PRICE      * scored["price_score"]
    )

    # Pre-compute area boost mask (if preferred_area was passed for Day 2+)
    area_boost_mask = None
    if user.preferred_area_radius_km > 0 and user.preferred_area_lat != 0.0:
        def _area_dist(row):
            R = 6371.0
            lat1, lon1 = math.radians(user.preferred_area_lat), math.radians(user.preferred_area_lon)
            lat2, lon2 = math.radians(float(row["latitude"])), math.radians(float(row["longitude"]))
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        area_dists = scored.apply(_area_dist, axis=1)
        area_boost_mask = area_dists <= user.preferred_area_radius_km
        print(f"[SCORE] Area boost: {area_boost_mask.sum()} attractions within {user.preferred_area_radius_km}km of ({user.preferred_area_lat:.4f}, {user.preferred_area_lon:.4f})")

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

    # Apply area boost AFTER base scoring so it doesn't distort cosine/price weights
    if area_boost_mask is not None:
        scored.loc[area_boost_mask, "final_score"] = (scored.loc[area_boost_mask, "final_score"] + 0.20).clip(upper=1.0)

    # DEBUG — confirm IDs coming in vs IDs in the database
    print(f"[SCORE] liked_ids from payload : {user.liked_ids}")
    print(f"[SCORE] visited_ids from payload: {user.visited_ids}")
    print(f"[SCORE] sample DB attraction_ids: {df['attraction_id'].astype(str).head(5).tolist()}")

    food_tags = {"restaurant", "cafe", "food", "bakery", "dessert"}
    is_food   = scored["categories"].apply(lambda cats: any(c in food_tags for c in cats))
    base_mask = (
        (scored["city"] == user.city)
      & (~scored["attraction_id"].astype(str).isin(user.visited_ids))
      & (~is_food)
      & (scored["price_avg"] <= user.attraction_budget)
    )
    # Try interest-matched attractions first; fall back to any city attraction
    filtered = scored[base_mask & (scored["cosine_sim"] > 0)].copy()
    if filtered.empty:
        filtered = scored[base_mask].copy()
    filtered = filtered.sort_values("final_score", ascending=False).reset_index(drop=True)

    # Force-include liked attractions first (prepended so they survive dedup below)
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
        print(f"[SCORE] Force-including liked attractions: {liked_rows['name'].tolist()}")
        filtered = pd.concat(
            [liked_rows, filtered]
        ).drop_duplicates(
            subset="attraction_id"
        ).reset_index(drop=True)
    else:
        print(f"[SCORE] No liked attractions matched — liked_ids={user.liked_ids}, "
              f"DB ids sample={scored['attraction_id'].astype(str).head(10).tolist()}")

    # Beach/mall dedup applied AFTER liked concat — max 1 beach and 1 mall per day.
    # Liked attractions are at the top of the list so they are always the one kept.
    beach_tags = {"beach", "coastal"}
    is_beach   = filtered["categories"].apply(lambda cats: any(c in beach_tags for c in cats))
    beach_idx  = filtered[is_beach].index.tolist()
    if len(beach_idx) > 1:
        filtered = filtered.drop(beach_idx[1:]).reset_index(drop=True)

    mall_tags = {"mall", "shopping"}
    is_mall   = filtered["categories"].apply(lambda cats: any(c in mall_tags for c in cats))
    mall_idx  = filtered[is_mall].index.tolist()
    if len(mall_idx) > 1:
        filtered = filtered.drop(mall_idx[1:]).reset_index(drop=True)

    return filtered


# ─────────────────────────────────────────────────────────────────────────────
# 4b. OSRM  (Open Source Routing Machine — free, no key needed)
# ─────────────────────────────────────────────────────────────────────────────
OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"
_HEADERS  = {"User-Agent": "TourMate-RecommendationSystem/2.0 (thesis project)"}

def osrm_distance(origin_lat: float, origin_lon: float,
                  dest_lat: float, dest_lon: float) -> dict:
    """
    Get real road distance and duration via OSRM public API.
    Free, no API key required.

    Returns:
        {
            "distance_km": float,
            "duration_min": float,
            "source": "osrm"        # or "haversine_fallback"
        }

    Falls back to haversine × road factor if the request fails.
    """
    cache_key = f"{origin_lat},{origin_lon}|{dest_lat},{dest_lon}"
    if cache_key in _osrm_cache:
        return _osrm_cache[cache_key]

    # OSRM expects lon,lat order
    url = f"{OSRM_BASE}/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {"overview": "false"}
    try:
        resp = requests.get(url, params=params, headers=_HEADERS, timeout=6)
        data = resp.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route     = data["routes"][0]
            dist_km   = route["distance"] / 1000.0
            dur_min   = route["duration"] / 60.0
            result    = {"distance_km": round(dist_km, 2),
                         "duration_min": round(dur_min, 1),
                         "source": "osrm"}
            _osrm_cache[cache_key] = result
            return result
    except Exception as e:
        print(f"  [OSRM] Routing error: {e} — using fallback")

    return _haversine_fallback(origin_lat, origin_lon, dest_lat, dest_lon)


def osm_directions_url(origin_lat: float, origin_lon: float,
                       dest_lat: float, dest_lon: float) -> str:
    """
    Generate an OpenStreetMap directions URL (opens in browser).
    No API key required.

    Example output:
      https://www.openstreetmap.org/directions?from=30.04,31.23&to=30.05,31.24
    """
    return (f"https://www.openstreetmap.org/directions"
            f"?from={origin_lat},{origin_lon}&to={dest_lat},{dest_lon}"
            f"&engine=osrm_car")


def _haversine_fallback(lat1, lon1, lat2, lon2, city="Cairo") -> dict:
    """Offline fallback when OSRM is unavailable."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    haversine_km = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    factor       = 1.35 if city == "Cairo" else 1.20
    road_km      = haversine_km * factor
    # Estimate 30 km/h average city speed
    dur_min      = (road_km / 30.0) * 60.0
    return {"distance_km": round(road_km, 2),
            "duration_min": round(dur_min, 1),
            "source": "haversine_fallback"}


# ─────────────────────────────────────────────────────────────────────────────
# 4c. OPENSTREETMAP  (Nominatim)
# ─────────────────────────────────────────────────────────────────────────────

def osm_geocode(address: str) -> dict:
    """
    Forward geocode: address string → {lat, lon, display_name}.
    Uses OpenStreetMap Nominatim — free, no key required.

    Rate limit: max 1 req/sec (enforced internally).

    Returns:
        {"lat": float, "lon": float, "display_name": str, "source": "osm"}
        or None if not found.
    """
    if address in _osm_cache:
        return _osm_cache[address]

    url    = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "limit": 1, "countrycodes": "eg"}
    try:
        time.sleep(1.1)  # Nominatim rate limit: 1 req/sec
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
    """
    Reverse geocode: lat/lon → {address, suburb, city}.
    Useful for enriching attraction address fields.

    Returns dict or None.
    """
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
    """
    Generate an OpenStreetMap link for a location.
    Opens in browser with a pin — no API key needed.

    Example:
      https://www.openstreetmap.org/?mlat=30.0478&mlon=31.2336&zoom=16
    """
    base = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}&zoom=16"
    if name:
        base += f"&layers=N&place={requests.utils.quote(name)}"
    return base


# ─────────────────────────────────────────────────────────────────────────────
# 5b. UNIFIED TRANSPORT INFO
# ─────────────────────────────────────────────────────────────────────────────
def get_transport_info(origin_lat: float, origin_lon: float,
                       dest_lat: float, dest_lon: float,
                       dest_name: str = "",
                       city: str = "Cairo") -> dict:
    """
    Unified transport info using OSRM for routing and OSM for map links.

    Returns a single dict used by the itinerary builder:
    {
        "mode":          "Walk" | "Walk or Taxi" | "Taxi",
        "distance_km":   4.2,
        "duration_min":  18.0,
        "cost_egp":      55,
        "icon":          "🚗",
        "tip":           "Taxi: 49–65 EGP | 4.2 km, ~18 min",
        "costs":         {"taxi_low": 49, "taxi_high": 65},
        "directions_url": "https://...",
        "osm_url":        "https://...",
        "distance_source": "osrm" | "haversine_fallback",
    }
    """
    # Step 1: Real road distance via OSRM (falls back to haversine)
    dist_info = osrm_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    road_km   = dist_info["distance_km"]
    dur_min   = dist_info["duration_min"]

    # Step 2: Taxi estimate using city-specific rates
    base, per_km_low, per_km_high = get_taxi_rates(city)
    taxi_low  = round(base + road_km * per_km_low)
    taxi_high = round(base + road_km * per_km_high)
    taxi_mid  = round((taxi_low + taxi_high) / 2)

    # Step 3: Determine mode
    if road_km <= WALKING_KM:
        mode     = "Walk"
        icon     = "🚶"
        cost_egp = 0
        tip      = f"Walking distance — {road_km} km, ~{int(dur_min)} min (free)"
    elif road_km <= MAYBE_KM:
        mode     = "Walk or Taxi"
        icon     = "🚶🚗"
        cost_egp = taxi_mid
        tip      = (f"Short ride — {road_km} km, ~{int(dur_min)} min  |  "
                    f"Taxi: {taxi_low}–{taxi_high} EGP")
    else:
        mode     = "Taxi"
        icon     = "🚗"
        cost_egp = taxi_mid
        tip      = (f"Taxi: {taxi_low}–{taxi_high} EGP  |  "
                    f"{road_km} km, ~{int(dur_min)} min")

    # Step 4: Generate OSM map & directions links
    directions_url = osm_directions_url(origin_lat, origin_lon, dest_lat, dest_lon)
    osm_url        = osm_maps_url(dest_lat, dest_lon, dest_name)

    return {
        "mode":            mode,
        "distance_km":     road_km,
        "duration_min":    dur_min,
        "cost_egp":        cost_egp,
        "icon":            icon,
        "tip":             tip,
        "costs":           {"taxi_low": taxi_low, "taxi_high": taxi_high},
        "directions_url":  directions_url,
        "osm_url":         osm_url,
        "distance_source": dist_info["source"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. MEAL RECOMMENDATION  (updated to use new transport layer)
# ─────────────────────────────────────────────────────────────────────────────
def recommend_meals(df, user, slot, near_lat, near_lon,
                    visited_today, top_n=3):
    per_meal   = user.meal_budget / max(
        sum([1 if slot == s else 0
             for s in ["breakfast","lunch","dinner","coffee"]]), 1
    )
    slot_clean = slot.lower().strip()

    # Strict category whitelist per slot — prevents fish markets / attractions
    # ending up as "coffee" just because their meal_slot field contains the word.
    SLOT_CATS = {
        "breakfast": {"cafe", "bakery", "restaurant", "food", "dessert"},
        "lunch":     {"restaurant", "food", "cafe", "seafood", "grills", "local", "international"},
        "dinner":    {"restaurant", "food", "seafood", "grills", "local", "international", "nile view", "waterfront"},
        "coffee":    {"cafe", "bakery", "dessert"},   # strict — cafes/patisseries only
    }
    slot_cats = SLOT_CATS.get(slot_clean, {"restaurant", "cafe", "food", "bakery", "dessert"})

    # Cuisine types worth tracking for cross-day diversity.
    # Generic labels (restaurant, food, local, international) are excluded from
    # the diversity check — otherwise we'd run out of options on Day 2.
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

    # If all options are filtered out by the diversity rule, relax it gracefully.
    if cands.empty and eaten:
        print(f"[DIVERSITY] No {slot} options left after excluding {eaten} — relaxing diversity rule")
        cands = df[
            (df["city"] == user.city)
          & (df["meal_slot"].apply(lambda s: slot_clean in s))
          & (~df["attraction_id"].isin(visited_today))
          & (df["price_avg"] <= per_meal * 1.5)
          & (df["categories"].apply(lambda cats: any(c in slot_cats for c in cats)))
        ].copy()

    if cands.empty:
        # Relax: drop price constraint but keep category whitelist
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
        lambda r: _haversine_fallback(near_lat, near_lon,
                                      r["latitude"], r["longitude"])["distance_km"],
        axis=1,
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
            near_lat, near_lon, row["latitude"], row["longitude"],
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
            "osm_url":     osm_maps_url(row["latitude"], row["longitude"], row["name"]),
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 7. ROUTE OPTIMISER  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
def optimise_route(top_df, start_lat, start_lon):
    ordered   = []
    remaining = top_df.copy()
    clat, clon = start_lat, start_lon
    while not remaining.empty:
        remaining["dist"] = remaining.apply(
            lambda r: _haversine_fallback(clat, clon,
                                          r["latitude"], r["longitude"])["distance_km"],
            axis=1,
        )
        mx = remaining["dist"].max()
        remaining["prox"] = 1 - remaining["dist"] / (mx + 1e-9)
        remaining["comb"] = 0.60 * remaining["prox"] + 0.40 * remaining["final_score"]
        idx  = remaining["comb"].idxmax()
        best = remaining.loc[idx]
        ordered.append(best)
        clat, clon = best["latitude"], best["longitude"]
        remaining  = remaining.drop(idx)
    return ordered


# ─────────────────────────────────────────────────────────────────────────────
# 8. PAYLOAD HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def expand_interest_labels(interests: list[str]) -> list[str]:
    categories: list[str] = []
    for interest in interests:
        mapped = INTEREST_CATEGORY_MAP.get(str(interest).strip().lower(), [])
        categories.extend(mapped)
    return list(dict.fromkeys(categories))  # preserve order, remove duplicates


def get_city_coords(city: str) -> tuple[float, float]:
    return CITY_COORDS.get(str(city).strip().lower(), CITY_COORDS["cairo"])


def build_user_from_payload(payload: dict) -> UserProfile:
    city = str(payload.get("city", "Cairo") or "Cairo").strip().lower()
    lat, lon = get_city_coords(city)
    interests = payload.get("interests", []) or []
    preferred_categories = expand_interest_labels(interests) or ["historical", "cultural", "outdoor"]
    s_hr = payload.get("start_hour")
    e_hr = payload.get("end_hour")

    if s_hr is not None and e_hr is not None:
        avail_hrs = float(e_hr) - float(s_hr)
        start_hour = float(s_hr)
    else:
        avail_hrs = float(payload.get("available_hours", 8))
        start_hour = 9.0

    return UserProfile(
        user_id=str(payload.get("user_id", "guest")),
        name=str(payload.get("name", "TourMate User")),
        city=city,
        preferred_categories=preferred_categories,
        budget_egp=float(payload.get("budget_egp", 1000) or 1000),
        available_hours=avail_hrs,
        current_lat=float(payload.get("current_lat", lat) or lat),
        current_lon=float(payload.get("current_lon", lon) or lon),
        liked_ids=[str(x) for x in (payload.get("liked_ids", []) or [])],
        visited_ids=[str(x) for x in (payload.get("visited_ids", []) or [])],
        eaten_meal_categories=[str(x).lower() for x in (payload.get("eaten_meal_categories", []) or [])],
        dislikes_crowds=bool(payload.get("dislikes_crowds", False)),
        meal_budget_ratio=float(payload.get("meal_budget_ratio", 0.25) or 0.25),
        accessibility_needs=str(payload.get("accessibility_needs", "None")),
        meal_plan=str(payload.get("meal_plan", "3meals") or "3meals"),
        preferred_area_lat=float(payload.get("preferred_area_lat", 0.0) or 0.0),
        preferred_area_lon=float(payload.get("preferred_area_lon", 0.0) or 0.0),
        preferred_area_radius_km=float(payload.get("preferred_area_radius_km", 0.0) or 0.0),
    )


def make_serializable(obj):
    """Recursively convert numpy types to plain Python so Flask can JSON-encode them."""
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


def generate_itinerary_from_payload(payload: dict,
                                    df: pd.DataFrame | None = None,
                                    att_matrix: np.ndarray | None = None) -> dict:

    local_df     = df if df is not None else load_attractions()
    local_matrix = att_matrix if att_matrix is not None else build_attraction_matrix(local_df)

    user = build_user_from_payload(payload)

    top_n    = int(payload.get("top_n", 10) or 10)
    browse_n = int(payload.get("browse_n", 20) or 20)

    start_val = payload.get("start_hour")
    end_val   = payload.get("end_hour")

    if start_val is not None and end_val is not None:
        start_hour = float(start_val)
        available_hours = float(end_val) - float(start_val)
    else:
        start_hour = 9.0
        available_hours = float(payload.get("available_hours", 8))

    # IMPORTANT: override user value
    user.available_hours = available_hours

    result = build_itinerary(
        local_df,
        local_matrix,
        user,
        start_hour=start_hour,
        top_n=top_n,
        browse_n=browse_n
    )

    result["request"] = {
        "city": user.city,
        "interests": payload.get("interests", []),
        "preferred_categories": user.preferred_categories,
        "budget_egp": user.budget_egp,
        "available_hours": available_hours,
        "start_hour": start_hour,
        "end_hour": payload.get("end_hour")
    }

    return make_serializable(result)
# ─────────────────────────────────────────────────────────────────────────────
# 9. ITINERARY BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def _fmt(hour):
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60: h, m = h + 1, 0
    return f"{h:02d}:{m:02d}"


def build_itinerary(df, att_matrix, user, start_hour=9, top_n=5, browse_n=5):
    scored = score_all_attractions(user, df, att_matrix)
    if scored.empty:
        return {"error": "No matching attractions found."}

    top = scored.head(top_n).reset_index(drop=True)

    # Liked attractions are always scheduled first — they must not be buried
    # behind regular stops and silently dropped when time runs out.
    liked_ids_set  = {str(x) for x in user.liked_ids}
    liked_in_top   = top[top["attraction_id"].astype(str).isin(liked_ids_set)]
    other_in_top   = top[~top["attraction_id"].astype(str).isin(liked_ids_set)]

    # ── Liked restaurant / café pool for meal-slot priority ────────────────────
    # Any liked venue whose categories overlap with food types is a candidate to
    # be placed directly in a meal slot instead of the AI-picked restaurant.
    _LIKED_MEAL_CATS = {"restaurant", "cafe", "food", "seafood", "grills",
                        "local", "international", "bakery", "dessert"}
    liked_meal_pool: list = df[
        df["attraction_id"].astype(str).isin(liked_ids_set)
        & df["categories"].apply(lambda cats: bool(set(cats) & _LIKED_MEAL_CATS))
    ].to_dict("records")
    liked_used_as_meal: set = set()   # IDs placed in a meal slot this day

    ordered_liked  = optimise_route(liked_in_top,  user.current_lat, user.current_lon) \
                     if not liked_in_top.empty else []

    # Re-sort liked attractions so nearby pairs (≤2km) are consecutive
    NEARBY_KM = 2.0
    if len(ordered_liked) >= 2:
        reordered = [ordered_liked[0]]
        remaining = list(ordered_liked[1:])
        while remaining:
            last = reordered[-1]
            dists = [_haversine_fallback(last["latitude"], last["longitude"],
                     r["latitude"], r["longitude"])["distance_km"] for r in remaining]
            closest_idx = int(min(range(len(dists)), key=lambda i: dists[i]))
            closest = remaining.pop(closest_idx)
            closest_dist = dists[closest_idx]
            if closest_dist <= NEARBY_KM:
                print(f"[ROUTE] Grouping nearby liked: '{last['name']}' + '{closest['name']}' ({closest_dist:.1f} km)")
            reordered.append(closest)
        ordered_liked = reordered

    # Route remaining attractions starting from the last liked stop (or user start)
    last_lat = ordered_liked[-1]["latitude"]  if ordered_liked else user.current_lat
    last_lon = ordered_liked[-1]["longitude"] if ordered_liked else user.current_lon
    ordered_other  = optimise_route(other_in_top,  last_lat, last_lon) \
                     if not other_in_top.empty else []

    ordered = ordered_liked + ordered_other

    itinerary       = []
    visited_today   = list(user.visited_ids)
    curr_hr         = float(start_hour)
    prev_lat        = user.current_lat
    prev_lon        = user.current_lon
    total_cost      = 0.0
    total_transport = 0.0
    total_dist      = 0.0
    lunch_done      = False
    dinner_done     = False
    last_stop_type  = None

    # ── Per-day category frequency limits ──────────────────────────────────────
    beach_added = False   # max 1 beach/coastal per day
    mall_added  = False   # max 1 mall/shopping per day
    BEACH_CATS  = {"beach", "coastal"}
    MALL_CATS   = {"mall", "shopping"}
    # Food-type venues: skip as an attraction if a meal was served < 2 h ago.
    # Applies equally to liked and non-liked spots — no exceptions.
    FOOD_CATS    = {"restaurant", "cafe", "food", "seafood", "grills",
                    "local", "international", "bakery", "dessert"}
    FOOD_GAP_HRS = 2.0
    last_meal_hr = float(start_hour) - 999.0  # sentinel: no meal served yet

    # ── Meal rules (Option A + B) ─────────────────────────────────────────────
    # Breakfast : always if start_hour ≤ 10, regardless of day length
    # Coffee    : always after any attraction whose visit duration ≥ 1.5 h
    # Lunch     : if avail_hrs ≥ 8  (triggered at ~40 % of the day)
    # Dinner    : only if avail_hrs > 12 (triggered at ~75 % of the day)
    avail_hrs      = user.available_hours
    include_lunch  = avail_hrs >= 8
    include_dinner = avail_hrs > 12
    end_hr         = float(start_hour) + avail_hrs

    def time_left():
        return user.available_hours - (curr_hr - float(start_hour))

    def add_meal(slot, emoji, nlat, nlon, dur):
        nonlocal curr_hr, prev_lat, prev_lon, total_cost, total_transport, total_dist, last_stop_type, last_meal_hr
        opts = recommend_meals(df, user, slot, nlat, nlon, visited_today)
        if not opts:
            return
        pick           = opts[0]
        transport      = pick["transport"]
        transport_cost = transport.get("cost_egp", 0)
        travel_hrs     = float(transport.get("duration_min", 0) or 0) / 60.0
        total_stop_hrs = travel_hrs + dur
        if time_left() < total_stop_hrs:
            return
        if (pick["price_avg"] + transport_cost) > (user.budget_egp - total_cost - total_transport):
            return
        itinerary.append({
            "time":           _fmt(curr_hr + travel_hrs),
            "departure_time": _fmt(curr_hr),
            "type":           f"{emoji} {slot.capitalize()}",
            "name":           pick["name"],
            "id":             pick["id"],
            "latitude":       pick["lat"],
            "longitude":      pick["lon"],
            "duration_hrs":   dur,
            "travel_duration_min": transport.get("duration_min", 0),
            "cost_egp":       pick["price_avg"],
            "distance_km":    transport["distance_km"],
            "transport":      transport,
            "transport_cost": transport_cost,
            "address":        pick["address"],
            "description":    pick.get("description", ""),
            "rating":         pick.get("rating", 0),
            "categories":     pick.get("categories", []),
            "options":        opts,
            "osm_url":        pick.get("osm_url", ""),
            "directions_url": transport.get("directions_url", ""),
        })
        visited_today.append(pick["id"])
        prev_lat        = pick["lat"]
        prev_lon        = pick["lon"]
        curr_hr        += total_stop_hrs
        total_cost     += pick["price_avg"]
        total_transport += transport_cost
        total_dist     += transport["distance_km"]
        last_stop_type  = "meal"
        last_meal_hr    = curr_hr   # curr_hr already advanced past this meal

    # Maximum straight-line distance we're willing to detour for a liked
    # restaurant at meal time.  Beyond this the route disruption isn't worth it
    # and we fall back to the nearest AI-picked option.
    MAX_MEAL_DETOUR_KM = 8.0

    def try_liked_meal(slot: str, emoji: str, dur: float) -> bool:
        """Place the closest liked restaurant that fits this meal slot and is
        within MAX_MEAL_DETOUR_KM of the current position.

        Returns True if a liked venue was placed (caller should skip add_meal).
        Returns False if none was close enough / feasible (falls back to add_meal).
        """
        nonlocal curr_hr, prev_lat, prev_lon, total_cost, total_transport, total_dist, last_stop_type, last_meal_hr
        slot_clean = slot.lower()
        candidates = [
            r for r in liked_meal_pool
            if str(r["attraction_id"]) not in liked_used_as_meal
            and r["attraction_id"] not in visited_today
            and slot_clean in (r.get("meal_slot") or [])
        ]
        if not candidates:
            return False

        # Pre-rank by cheap haversine — avoids unnecessary OSRM calls.
        candidates.sort(key=lambda r: _haversine_fallback(
            prev_lat, prev_lon, r["latitude"], r["longitude"])["distance_km"]
        )

        for r in candidates:
            straight_km = _haversine_fallback(
                prev_lat, prev_lon, r["latitude"], r["longitude"])["distance_km"]
            if straight_km > MAX_MEAL_DETOUR_KM:
                # Sorted by distance — every remaining candidate is also too far.
                print(f"[LIKED-MEAL] Closest liked option '{r['name']}' is {straight_km:.1f} km away"
                      f" — exceeds {MAX_MEAL_DETOUR_KM} km cap, falling back to nearest restaurant")
                return False

            t = get_transport_info(
                prev_lat, prev_lon, r["latitude"], r["longitude"],
                dest_name=r["name"], city=user.city,
            )
            travel_hrs     = float(t.get("duration_min", 0) or 0) / 60.0
            transport_cost = t.get("cost_egp", 0)

            if time_left() < travel_hrs + dur:
                continue
            if (float(r["price_avg"]) + transport_cost) > (user.budget_egp - total_cost - total_transport):
                continue

            # All checks passed — commit this candidate.
            itinerary.append({
                "time":           _fmt(curr_hr + travel_hrs),
                "departure_time": _fmt(curr_hr),
                "type":           f"{emoji} {slot.capitalize()}",
                "name":           r["name"],
                "id":             r["attraction_id"],
                "latitude":       r["latitude"],
                "longitude":      r["longitude"],
                "duration_hrs":   dur,
                "travel_duration_min": t.get("duration_min", 0),
                "cost_egp":       float(r["price_avg"]),
                "distance_km":    t["distance_km"],
                "transport":      t,
                "transport_cost": transport_cost,
                "address":        r.get("address", ""),
                "description":    str(r.get("description") or ""),
                "rating":         float(r.get("avg_rating", 0)),
                "categories":     list(r.get("categories", [])),
                "osm_url":        osm_maps_url(r["latitude"], r["longitude"], r["name"]),
                "directions_url": t.get("directions_url", ""),
            })
            visited_today.append(r["attraction_id"])
            liked_used_as_meal.add(str(r["attraction_id"]))
            prev_lat        = r["latitude"]
            prev_lon        = r["longitude"]
            curr_hr        += travel_hrs + dur
            total_cost     += float(r["price_avg"])
            total_transport += transport_cost
            total_dist     += t["distance_km"]
            last_stop_type  = "meal"
            last_meal_hr    = curr_hr
            print(f"[LIKED-MEAL] '{r['name']}' placed as {slot} ({straight_km:.1f} km away)")
            return True

        return False  # all candidates failed feasibility checks

    # Breakfast: always at the start of a morning trip (any day length)
    if start_hour <= 10:
        add_meal("breakfast", "🍳", user.current_lat, user.current_lon, 0.5)

    # Clock-based trigger times
    # Lunch  at ~40 % of the day (capped at 13:00)
    # Dinner at ~75 % of the day (only for >12 h days)
    lunch_trigger_hr  = min(float(start_hour) + avail_hrs * 0.40, 13.0)
    dinner_trigger_hr = float(start_hour) + avail_hrs * 0.75

    last_att_dur = 0.0   # track previous attraction's actual duration for coffee

    for att in ordered:
        if time_left() <= 0:
            break

        # ── Category frequency enforcement ─────────────────────────────────────
        # These guards apply to ALL entries in `ordered`, including liked spots.
        att_cats = set(att["categories"])
        if att_cats & BEACH_CATS and beach_added:
            print(f"[CAT-LIMIT] Skipping '{att['name']}' — beach already added today")
            continue
        if att_cats & MALL_CATS and mall_added:
            print(f"[CAT-LIMIT] Skipping '{att['name']}' — mall/shopping already added today")
            continue
        # ── Skip liked spots already consumed as a meal slot ───────────────────
        if str(att["attraction_id"]) in liked_used_as_meal:
            continue

        # ── Coffee break after any long attraction (≥ 1.5 h) ─────────────────
        # Only after lunch has been served — coffee before lunch is redundant.
        if last_stop_type == "attraction" and last_att_dur >= COFFEE_GAP_HRS and lunch_done:
            add_meal("coffee", "☕", prev_lat, prev_lon, 0.4)

        # ── Lunch injection — liked restaurant takes priority ──────────────────
        if include_lunch and not lunch_done and curr_hr >= lunch_trigger_hr:
            if not try_liked_meal("lunch", "🍽", 0.75):
                add_meal("lunch", "🍽", prev_lat, prev_lon, 0.75)
            lunch_done = True

        # ── Dinner injection — liked restaurant takes priority ─────────────────
        if include_dinner and not dinner_done and lunch_done and curr_hr >= dinner_trigger_hr:
            if not try_liked_meal("dinner", "🌙", 1.0):
                add_meal("dinner", "🌙", prev_lat, prev_lon, 1.0)
            dinner_done = True

        # ── Food-venue proximity guard ──────────────────────────────────────────
        # Checked AFTER meal injections so last_meal_hr reflects any meal just placed
        # this iteration. Prevents a food attraction from immediately following a meal.
        if att_cats & FOOD_CATS and (curr_hr - last_meal_hr) < FOOD_GAP_HRS:
            print(f"[FOOD-GAP] Skipping '{att['name']}' — meal served {curr_hr - last_meal_hr:.1f}h ago")
            continue

        if time_left() <= 0:
            break

        # ── Transport & feasibility checks ─────────────────────────────────────
        transport = get_transport_info(
            prev_lat, prev_lon,
            att["latitude"], att["longitude"],
            dest_name=att["name"], city=user.city,
        )
        transport_cost   = transport.get("cost_egp", 0)
        travel_hrs       = float(transport.get("duration_min", 0) or 0) / 60.0
        remaining_budget = user.budget_egp - total_cost - total_transport

        is_liked = str(att["attraction_id"]) in liked_ids_set
        if not is_liked and float(att["price_avg"]) > remaining_budget:
            continue
        if time_left() <= travel_hrs:
            continue

        # ── Opening-hours enforcement ──────────────────────────────────────────
        arrival_hr = curr_hr + travel_hrs
        open_hr    = float(att.get("open_hour", 0))
        close_hr   = float(att.get("close_hour", 24))
        # Skip if we arrive before the attraction opens
        if arrival_hr < open_hr:
            print(f"[TIME-CHECK] Skipping '{att['name']}' — arrives at {_fmt(arrival_hr)}, opens at {_fmt(open_hr)}")
            continue
        # Skip if we arrive so late there isn't at least MIN_VISIT_HRS before closing
        if arrival_hr >= close_hr - MIN_VISIT_HRS:
            print(f"[TIME-CHECK] Skipping '{att['name']}' — arrives at {_fmt(arrival_hr)}, closes at {_fmt(close_hr)}")
            continue

        raw_dur = max(float(att["avg_visit_hrs"]), MIN_VISIT_HRS)
        # Cap visit so it doesn't run past closing time
        time_until_close = close_hr - arrival_hr
        dur     = min(raw_dur, max(0.0, time_left() - travel_hrs), time_until_close)
        if dur < MIN_VISIT_HRS:
            continue

        effective_cost = float(att["price_avg"])

        itinerary.append({
            "time":           _fmt(curr_hr + travel_hrs),
            "departure_time": _fmt(curr_hr),
            "type":           "🏛 Attraction",
            "name":           att["name"],
            "id":             att["attraction_id"],
            "latitude":       att["latitude"],
            "longitude":      att["longitude"],
            "cosine_sim":     round(float(att["cosine_sim"]), 3),
            "final_score":    round(float(att["final_score"]), 3),
            "duration_hrs":   round(dur, 2),
            "travel_duration_min": transport.get("duration_min", 0),
            "cost_egp":       effective_cost,
            "distance_km":    transport["distance_km"],
            "transport":      transport,
            "transport_cost": transport_cost,
            "address":        att["address"],
            "description":    att.get("description", ""),
            "categories":     att["categories"],
            "crowd_label":    att["crowd_label"],
            "crowd_pattern":  att["crowd_pattern"],
            "rating":         att["avg_rating"],
            "open":           att["open_hour"],
            "close":          att["close_hour"],
            "directions_url": transport.get("directions_url", ""),
            "osm_url":        osm_maps_url(att["latitude"], att["longitude"], att["name"]),
        })
        visited_today.append(att["attraction_id"])
        prev_lat        = att["latitude"]
        prev_lon        = att["longitude"]
        curr_hr        += travel_hrs + dur
        total_cost     += effective_cost
        total_transport += transport_cost
        total_dist     += transport["distance_km"]
        last_stop_type  = "attraction"
        last_att_dur    = dur   # record for next iteration's coffee check

        # Update category trackers after a successful add
        if att_cats & BEACH_CATS:
            beach_added = True
        if att_cats & MALL_CATS:
            mall_added = True

    # ── Post-loop meal safety nets ──────────────────────────────────────────────
    # Fire only when the loop ended before clock-based triggers were reached.

    lunch_added_in_safety = False
    if include_lunch and not lunch_done and time_left() >= 1.5:
        if not try_liked_meal("lunch", "🍽", 0.75):
            add_meal("lunch", "🍽", prev_lat, prev_lon, 0.75)
        lunch_done = True
        lunch_added_in_safety = True

    # Dinner safety net — only if lunch was done during the loop (not just now),
    # to avoid two restaurants back-to-back.
    if include_dinner and not dinner_done and lunch_done and not lunch_added_in_safety:
        if not try_liked_meal("dinner", "🌙", 1.0):
            add_meal("dinner", "🌙", prev_lat, prev_lon, 1.0)
        dinner_done = True

    # ── Missed liked places ─────────────────────────────────────────────────────
    added_ids = {str(s["id"]) for s in itinerary}
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
        "rank":          i + 1,
        "id":            a["attraction_id"],
        "name":          a["name"],
        "cosine_sim":    round(float(a["cosine_sim"]), 3),
        "final_score":   round(float(a["final_score"]), 3),
        "categories":    a["categories"],
        "price_range":   a["price_range"],
        "price_avg":     round(float(a["price_avg"]), 0),
        "avg_visit_hrs": round(float(a["avg_visit_hrs"]), 1),
        "crowd_label":   a["crowd_label"],
        "rating":        a["avg_rating"],
        "osm_url":       osm_maps_url(a["latitude"], a["longitude"], a["name"]),
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
            "total_visit_hours":      round(sum(s["duration_hrs"] for s in itinerary), 1),
            "total_travel_hours":     round(sum(float(s.get("travel_duration_min", 0) or 0) / 60.0 for s in itinerary), 1),
            "cost_attractions_meals": round(total_cost, 0),
            "cost_transport_egp":     round(total_transport, 0),
            "total_cost_egp":         round(total_all, 0),
            "total_distance_km":      round(total_dist, 1),
            "budget_remaining":       round(user.budget_egp - total_all, 0),
        },
        "api_status": {
            "osrm":          "live (always — no key needed)",
            "openstreetmap": "live (always — no key needed)",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 10. PRETTY PRINTER
# ─────────────────────────────────────────────────────────────────────────────
def print_itinerary(result, user=None):
    if "error" in result:
        print(f"\n  ERROR: {result['error']}\n")
        return
    W = 75
    print("\n" + "=" * W)
    print(f"  TourMate  |  {result['user']}  |  {result['city']}")

    # API status banner
    if "api_status" in result:
        s = result["api_status"]
        print(f"  APIs: OSRM [{s['osrm']}]  OSM [{s['openstreetmap']}]")
    print("=" * W)

    print(f"\n  {'#':<3} {'Name':<30} {'Cosine':<8} {'Final':<8} {'Crowd':<12} Price")
    print("  " + "-" * (W - 2))
    for a in result["recommended_attractions"]:
        print(f"  {a['rank']:<3} {a['name'][:28]:<30} {a['cosine_sim']:<8} "
              f"{a['final_score']:<8} {a['crowd_label']:<12} {a['price_range']}")
        print(f"       OSM → {a['osm_url']}")

    print(f"\n  FULL DAY ITINERARY")
    print("  " + "-" * (W - 2))
    for stop in result["itinerary"]:
        print(f"\n  {stop['time']}  {stop['type']}  —  {stop['name']}")
        t     = stop.get("transport", {})
        costs = t.get("costs", {})

        print(f"     {t.get('icon','')}  {t.get('tip','')}")
        if costs:
            print(f"     Taxi: {costs.get('taxi_low',0)}–{costs.get('taxi_high',0)} EGP")

        line = f"     Duration: {stop['duration_hrs']}hr   Place cost: {int(stop['cost_egp'])} EGP"
        if "cosine_sim" in stop:
            line += f"   Cosine: {stop['cosine_sim']}  Score: {stop['final_score']}"
        print(line)

        # Map & directions links
        directions = stop.get("directions_url", "")
        osm        = stop.get("osm_url", "")
        if directions: print(f"     🗺  Directions → {directions}")
        if osm:        print(f"     📍 OSM pin    → {osm}")

        if "crowd_label" in stop:
            print(f"     Crowd: {stop['crowd_label']} ({stop.get('crowd_pattern','')})")
        if "options" in stop and len(stop["options"]) > 1:
            print(f"     Other options: {', '.join(o['name'] for o in stop['options'][1:])}")

    s = result["stats"]
    print("\n" + "-" * W)
    print(f"  {s['total_stops']} stops  |  {s['total_hours']} hrs  |  {s['total_distance_km']} km")
    print(f"  Attractions & Meals: {int(s['cost_attractions_meals'])} EGP  |  "
          f"Transport (est.): {int(s['cost_transport_egp'])} EGP  |  "
          f"TOTAL: {int(s['total_cost_egp'])} EGP")
    if user:
        print(f"  Budget: {int(user.budget_egp)} EGP  →  Remaining: {int(s['budget_remaining'])} EGP")
    print("=" * W + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# 10. DEMO
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":

    print("Loading database...")
    df         = load_attractions()
    att_matrix = build_attraction_matrix(df)
    print(f"Loaded {len(df)} attractions | {N_DIMS}-dim vector space\n")

    print("API Status:")
    print(f"  OSRM          : ✅ always available (no key needed)")
    print(f"  OpenStreetMap : ✅ always available (no key needed)\n")

    # Quick OSM geocode demo
    print("OSM Geocode demo — searching 'Pyramids of Giza, Egypt':")
    geo = osm_geocode("Pyramids of Giza, Egypt")
    if geo:
        print(f"  Found: {geo['display_name']}")
        print(f"  Coords: {geo['lat']}, {geo['lon']}")
        print(f"  OSM link: {osm_maps_url(geo['lat'], geo['lon'], 'Pyramids of Giza')}\n")

    # Demo 1: Sarah
    sarah = UserProfile(
        user_id="USR001", name="Sarah Mitchell (Tourist, Cairo)",
        city="Cairo",
        preferred_categories=["historical", "ancient", "museum", "outdoor"],
        budget_egp=2000, available_hours=9.0,
        current_lat=30.0478, current_lon=31.2336,
        liked_ids=["ATT001", "ATT002"], visited_ids=["ATT001"],
        dislikes_crowds=False,
    )
    print_itinerary(build_itinerary(df, att_matrix, sarah, start_hour=9, top_n=5), user=sarah)

    # Demo 2: Omar
    omar = UserProfile(
        user_id="USR007", name="Omar Tarek (Local, Alexandria)",
        city="Alexandria",
        preferred_categories=["historical", "ancient", "outdoor", "coastal"],
        budget_egp=400, available_hours=5.0,
        current_lat=31.1988, current_lon=29.9134,
        liked_ids=["ATT049"], visited_ids=["ATT049", "ATT052", "ATT055"],
        dislikes_crowds=True,
    )
    print_itinerary(build_itinerary(df, att_matrix, omar, start_hour=10, top_n=4), user=omar)
