"""
TourMate Recommendation Engine  v2
No .env or API keys needed 
"""

import os
import sys
import math
import time
import requests
import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
import psycopg2.pool
import threading
from dataclasses import dataclass, field, replace as _dc_replace
from sklearn.metrics.pairwise import cosine_similarity
from collections import deque

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
LIKED_BONUS      = 0.35
CROWD_PENALTY    = {"Very High": 0.12, "High": 0.05, "Moderate": 0.00, "Low": 0.00}
HIDDEN_GEM_BONUS = 0.05

WALKING_KM      = 1.5
COFFEE_GAP_HRS  = 1.5
MIN_VISIT_HRS   = 0.5   # minimum 30 minutes at any attraction
MIN_CLUSTER_SIZE = 10   # minimum attractions per day cluster

# Maximum straight-line distance for fill-step candidates (non-liked only).
# Prevents the fill loop from appending faraway attractions when time is spare.
MAX_FILL_DISTANCE_KM = 10.0
CITY_FILL_DISTANCE_KM: dict = {
    "alexandria":     5.0,
    "cairo":          8.0,
    "dahab":          3.0,
    "el gouna":       3.0,
    "sharm el sheikh":4.0,
    "siwa":           3.0,
}

# 2-D knapsack discretization grid
DP_BUDGET_STEP_EGP = 50    # EGP per budget cell
DP_TIME_STEP_MIN   = 15    # minutes per time cell
DP_MAX_CANDIDATES  = 30    # max attractions fed into knapsack

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

# Max cluster radius per city (km). Keeps clusters tight enough to avoid zigzag.
CITY_CLUSTER_RADIUS: dict = {
    "cairo":          8.0,
    "alexandria":     6.0,
    "luxor":          5.0,
    "aswan":          5.0,
    "hurghada":       5.0,
    "sharm el sheikh":4.0,
    "dahab":          3.0,
    "marsa matrouh":  5.0,
    "siwa":           3.0,
    "el gouna":       3.0,
}
CLUSTER_RADIUS_DEFAULT = 6.0


def get_taxi_rates(city: str) -> tuple[int, int, int]:
    """Return (base_egp, per_km_low, per_km_high) for the given city."""
    return CITY_TAXI_RATES.get(str(city).strip().lower(), TAXI_RATES_DEFAULT)


# ─────────────────────────────────────────────────────────────────────────────
# LOGGING HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _fmt(hour: float) -> str:
    """Format a float hour value as HH:MM."""
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60:
        h, m = h + 1, 0
    return f"{h:02d}:{m:02d}"


class _Logger:
    """
    Structured, optionally coloured logger for TourMate.

    Verbosity levels — set via TOURMATE_LOG_LEVEL env var or log.verbosity:
      0  quiet   : box header + day summary only
      1  normal  : + section banners, route hops, hard skips    (default)
      2  verbose : + scoring details, cluster internals, knapsack
    """
    QUIET   = 0
    NORMAL  = 1
    VERBOSE = 2

    _RST = "\033[0m"
    _BLD = "\033[1m"
    _DIM = "\033[2m"
    _CYN = "\033[36m"
    _GRN = "\033[32m"
    _YLW = "\033[33m"
    _ORG = "\033[93m"   # bright yellow — renders as orange in most terminals
    _MGT = "\033[35m"

    def __init__(self) -> None:
        self.verbosity: int = int(os.environ.get("TOURMATE_LOG_LEVEL", "1"))
        self._color: bool   = (
            sys.stdout.isatty()
            and os.environ.get("NO_COLOR") is None
            and os.environ.get("TERM", "") != "dumb"
        )

    def _c(self, *codes: str) -> str:
        return "".join(codes) if self._color else ""

    def _r(self) -> str:
        return self._RST if self._color else ""

    # ── public API ────────────────────────────────────────────────────────────

    def header(self, city: str, day_index: int, n_days: int,
               budget: float, liked_ids: list,
               start_lat: float, start_lon: float,
               start_hour: float, end_hour: float) -> None:
        """Boxed build-start header."""
        W  = 66
        cb = self._c(self._CYN, self._BLD)
        r  = self._r()
        liked_str = ", ".join(liked_ids) if liked_ids else "none"
        rows = [
            f"  City    : {city.title()}",
            f"  Day     : {day_index + 1} / {n_days}",
            f"  Window  : {_fmt(start_hour)} – {_fmt(end_hour)}",
            f"  Budget  : {budget:.0f} EGP",
            f"  Liked   : {liked_str}",
            f"  Coords  : ({start_lat:.4f}, {start_lon:.4f})",
        ]
        print(f"\n{cb}╔{'═' * (W - 2)}╗{r}")
        title = "  BUILD · TourMate Itinerary Engine"
        print(f"{cb}║{r}{title}{' ' * (W - 2 - len(title))}{cb}║{r}")
        print(f"{cb}╠{'═' * (W - 2)}╣{r}")
        for row in rows:
            pad = W - 2 - len(row)
            print(f"{cb}║{r}{row}{' ' * pad}{cb}║{r}")
        print(f"{cb}╚{'═' * (W - 2)}╝{r}\n")

    def section(self, name: str, msg: str = "", verbosity: int = 1) -> None:
        if self.verbosity < verbosity:
            return
        cb = self._c(self._BLD)
        r  = self._r()
        label = f"{cb}[{name}]{r}"
        print(f"{label} {msg}" if msg else label)

    def hop(self, depart_str: str, name: str, dist_km: float,
            dur_min: float, mode: str,
            arrival_str: str, open_hr: float, close_hr: float) -> None:
        """Single accepted-hop line: ROUTE 12:30 → Name   5.0 km | 8 min Taxi | arrival 12:45 (open 09:00–18:00)"""
        if self.verbosity < self.NORMAL:
            return
        cg = self._c(self._GRN, self._BLD)
        cd = self._c(self._DIM)
        r  = self._r()
        name_col = f"{name[:34]:<34}"
        print(
            f"  {cg}ROUTE{r} {depart_str} → {name_col}"
            f"  {dist_km:>5.1f} km | {int(dur_min):>3} min {mode:<4}"
            f" | arrival {arrival_str}  {cd}(open {_fmt(open_hr)}–{_fmt(close_hr)}){r}"
        )

    def skip(self, name: str, reason: str, verbosity: int = 1) -> None:
        if self.verbosity < verbosity:
            return
        cy = self._c(self._YLW)
        r  = self._r()
        print(f"  {cy}SKIP{r}  {name[:34]:<34}  {reason}")

    def info(self, tag: str, msg: str, verbosity: int = 1) -> None:
        if self.verbosity < verbosity:
            return
        cd = self._c(self._DIM)
        r  = self._r()
        print(f"  {cd}[{tag}]{r} {msg}")

    def warn(self, tag: str, msg: str) -> None:
        cy = self._c(self._YLW, self._BLD)
        r  = self._r()
        print(f"  {cy}⚠  [{tag}]{r} {msg}")

    def summary(self, day_index: int, n_days: int,
                att_stops: list, meal_stops: list,
                missed: list, stats: dict) -> None:
        """Bullet-form end-of-day summary."""
        W  = 66
        cb = self._c(self._CYN, self._BLD)
        cg = self._c(self._GRN)
        cy = self._c(self._YLW)
        r  = self._r()
        print(f"\n{cb}╔{'═' * (W - 2)}╗{r}")
        title = f"  DAY {day_index + 1}/{n_days} · DONE"
        print(f"{cb}║{r}{title}{' ' * (W - 2 - len(title))}{cb}║{r}")
        print(f"{cb}╠{'═' * (W - 2)}╣{r}")
        if att_stops:
            print(f"  Attractions ({len(att_stops)}):")
            for s in att_stops:
                print(f"    {cg}•{r}  {s['time']}  {s['name'][:40]:<40}  {s['duration_hrs']}h")
        if meal_stops:
            print(f"  Meals / Coffee ({len(meal_stops)}):")
            for s in meal_stops:
                print(f"    {cg}•{r}  {s['time']}  {s['name']}")
        if missed:
            print(f"  {cy}Missed liked ({len(missed)}):{r}")
            for m in missed:
                print(f"    {cy}✗{r}  {m['name']}  [{m.get('reason', '?')}]")
        st = stats
        print(f"  {'─' * (W - 4)}")
        print(
            f"  ⏱  {st['total_hours']}h used"
            f"  |  📍 {st['total_distance_km']} km"
        )
        print(
            f"  💰 Att+Meals {int(st['cost_attractions_meals'])} EGP"
            f"  + Transport {int(st['cost_transport_egp'])} EGP"
            f"  = {int(st['total_cost_egp'])} EGP"
            f"  (remaining {int(st['budget_remaining'])} EGP)"
        )
        print(f"{cb}╚{'═' * (W - 2)}╝{r}\n")


log = _Logger()


# ── Simple in-process cache to avoid redundant API calls ─────────────────────
_osrm_cache: dict = {}
_osm_cache:  dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# 1. DATA LOADING  —  connection pool + TTL cache
# ─────────────────────────────────────────────────────────────────────────────

_DB_POOL: psycopg2.pool.ThreadedConnectionPool | None = None
_DB_POOL_LOCK = threading.Lock()

_DF_CACHE: dict[str, tuple[pd.DataFrame, float]] = {}   # key → (df, expires_at)
_DF_CACHE_TTL  = 300.0   # seconds before a cached frame is refreshed
_DF_CACHE_LOCK = threading.Lock()


def _get_pool(db_url: str = DB_URL) -> psycopg2.pool.ThreadedConnectionPool:
    """Return the module-level connection pool, creating it on first call."""
    global _DB_POOL
    if _DB_POOL is None:
        with _DB_POOL_LOCK:
            if _DB_POOL is None:
                _DB_POOL = psycopg2.pool.ThreadedConnectionPool(
                    minconn=1, maxconn=2, dsn=db_url
                )
                print("[DB] connection pool created (min=1 max=4)")
    return _DB_POOL


def _fetch_attractions(db_url: str) -> pd.DataFrame:
    """Run the projection query and return a raw DataFrame (no caching here)."""
    pool = _get_pool(db_url)
    conn = pool.getconn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                a.attraction_id,
                a.name,
                lower(trim(ci.name))                      AS city,
                COALESCE(a.district, '')                  AS district,
                COALESCE(a.latitude,  0)::float           AS latitude,
                COALESCE(a.longitude, 0)::float           AS longitude,
                COALESCE(a.address, '')                   AS address,
                COALESCE(a.categories, '')                AS categories,
                COALESCE(a.sub_type, '')                  AS sub_type,
                COALESCE(a.is_outdoor, false)             AS is_outdoor,
                COALESCE(a.avg_visit_hrs, 1)::float       AS avg_visit_hrs,
                COALESCE(a.admission_egp, 0)::float       AS admission_egp,
                COALESCE(a.admission_egp_foreigner, 0)::float AS admission_egp_foreigner,
                COALESCE(a.rating, 0)::float              AS avg_rating,
                COALESCE(a.popularity, 0)::float          AS popularity,
                COALESCE(a.total_reviews, 0)::int         AS total_reviews,
                COALESCE(a.open_hour, 8)::int             AS open_hour,
                COALESCE(a.close_hour, 22)::int           AS close_hour,
                COALESCE(a.meal_slot, '')                 AS meal_slot,
                COALESCE(a.price_min, 0)::float           AS price_min,
                COALESCE(a.price_max, 0)::float           AS price_max,
                COALESCE(a.crowd_label, '')               AS crowd_label,
                COALESCE(a.crowd_pattern, '')             AS crowd_pattern,
                COALESCE(a.description, '')               AS description,
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
    finally:
        pool.putconn(conn)

    return pd.DataFrame([dict(r) for r in rows])


def _hydrate(raw: pd.DataFrame) -> pd.DataFrame:
    """Parse text columns and synthesize derived fields on a raw frame."""
    df = raw.copy()
    df["categories"] = df["categories"].fillna("").apply(
        lambda x: [c.strip().lower() for c in str(x).split(",") if c.strip()]
    )
    df["meal_slot"] = df["meal_slot"].fillna("").apply(
        lambda x: [s.strip().lower() for s in str(x).split(",")
                   if s.strip() not in ("", "n/a", "nan")]
    )
    df["price_avg"] = (df["price_min"] + df["price_max"]) / 2.0
    df["price_range"] = df.apply(
        lambda r: "Free" if r["price_min"] == 0 and r["price_max"] == 0
                  else f"Budget | {int(r['price_min'])}–{int(r['price_max'])} EGP",
        axis=1,
    )
    return df


def load_attractions(db_url: str = DB_URL) -> pd.DataFrame:
    """
    Return the full hydrated attractions DataFrame.

    Results are cached for _DF_CACHE_TTL seconds so repeated calls within the
    same request burst (multi-day itinerary generation) hit memory, not the DB.
    A ThreadedConnectionPool caps DB connections at 4 regardless of concurrency.
    """
    cache_key = db_url or "default"
    now = time.monotonic()

    with _DF_CACHE_LOCK:
        entry = _DF_CACHE.get(cache_key)
        if entry is not None and now < entry[1]:
            return entry[0]

    df = _hydrate(_fetch_attractions(db_url))

    with _DF_CACHE_LOCK:
        _DF_CACHE[cache_key] = (df, now + _DF_CACHE_TTL)

    print(f"[DB] loaded {len(df)} attractions (cache refreshed, TTL={_DF_CACHE_TTL:.0f}s)")
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
    """Build the category matrix without iterrows — ~10x faster on large frames."""
    matrix = np.zeros((len(df), N_DIMS), dtype=np.float32)
    for idx, cats in enumerate(df["categories"]):
        cols = [CAT_INDEX[c] for c in cats if c in CAT_INDEX]
        if cols:
            matrix[idx, cols] = 1.0
    return matrix


# ── Per-city matrix cache (memoised for the process lifetime) ─────────────────
# Key: (city, id(att_matrix)).  att_matrix is built once in app.py and never
# mutated, so its object-identity is a stable cache key.
_CITY_MATRIX_CACHE: dict[tuple, tuple[np.ndarray, np.ndarray]] = {}


def _get_city_matrix(
    df: pd.DataFrame, att_matrix: np.ndarray, city: str
) -> tuple[np.ndarray, np.ndarray]:
    """
    Return (bool_mask, city_matrix) for *city*, building and caching on first call.

    bool_mask     — positional boolean array aligned with df rows
    city_matrix   — att_matrix rows where city matches; aligned with df[bool_mask]
    """
    key = (city, id(att_matrix))
    if key not in _CITY_MATRIX_CACHE:
        mask = df["city"].values == city
        _CITY_MATRIX_CACHE[key] = (mask, att_matrix[mask])
    return _CITY_MATRIX_CACHE[key]


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
# 3b. LIKED-ID VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
def _validate_liked_ids(liked_ids: list, df: pd.DataFrame, city: str) -> list:
    """
    Return the subset of liked_ids that (a) exist in the DB and (b) belong to
    the requested city.  Any ID that fails either check is logged and skipped.
    """
    target_city = str(city).strip().lower()
    valid: list = []
    for lid in liked_ids:
        sid = str(lid)
        match = df[df["attraction_id"].astype(str) == sid]
        if match.empty:
            log.warn("LIKED", f"'{sid}' not found in DB — skipped")
            continue
        att_city = str(match.iloc[0]["city"]).strip().lower()
        if att_city != target_city:
            log.warn("LIKED", f"'{sid}' ({match.iloc[0]['name']}) is in '{att_city}', expected '{target_city}' — skipped")
            continue
        valid.append(sid)
    return valid


# ─────────────────────────────────────────────────────────────────────────────
# 4. COSINE SIMILARITY SCORING
# ─────────────────────────────────────────────────────────────────────────────

def score_all_attractions(user: UserProfile, df: pd.DataFrame,
                          att_matrix: np.ndarray) -> pd.DataFrame:
    """
    Score attractions for *user.city* only.

    Performance profile vs. the old implementation:
      • Cosine similarity runs on ~city_size rows instead of the full catalog.
      • Price, crowd, and bonus adjustments are fully vectorised numpy — no .apply().
      • Area-boost haversine is computed in a single numpy pass.
      • City matrix is memoised; repeated calls (e.g. stable_user rescore) are free.
    """
    # ── 1. City slice — all expensive work runs on this subset ────────────────
    city_bool, city_matrix = _get_city_matrix(df, att_matrix, user.city)
    scored = df[city_bool].reset_index(drop=True).copy()
    # city_matrix rows are positionally aligned with scored after reset_index

    # ── 2. Cosine similarity on city-only matrix ──────────────────────────────
    user_vec = user.to_vector().reshape(1, -1)
    scored["cosine_sim"] = cosine_similarity(user_vec, city_matrix).flatten()

    # ── 3. Vectorised price score ─────────────────────────────────────────────
    p = scored["price_avg"].values
    b = float(user.attraction_budget)
    scored["price_score"] = np.where(
        p > b,    0.0,        np.where(
        p == 0,   0.8,        np.where(
        b >= 1500, 0.4 + 0.6 * (p / b), np.where(
        b >= 500,  1.0 - 0.5 * (p / b),
                   1.0 - (p / b)))))

    scored["rating_norm"] = scored["avg_rating"].values / 5.0
    scored["base_score"]  = (
        W_COSINE     * scored["cosine_sim"].values
      + W_POPULARITY * scored["popularity"].values
      + W_RATING     * scored["rating_norm"].values
      + W_PRICE      * scored["price_score"].values
    )

    # ── 4. Liked-ID validation + vectorised bonus/penalty adjustments ─────────
    _valid_liked     = _validate_liked_ids(user.liked_ids, df, user.city)
    _valid_liked_set = set(_valid_liked)
    att_ids          = scored["attraction_id"].astype(str)

    final = scored["base_score"].values.copy()
    final[att_ids.isin(_valid_liked_set).values] += LIKED_BONUS
    if user.dislikes_crowds:
        final -= scored["crowd_label"].map(CROWD_PENALTY).fillna(0.0).values
    final[(scored["crowd_label"] == "Low").values] += HIDDEN_GEM_BONUS
    scored["final_score"] = np.round(np.clip(final, 0.0, None), 4)

    # ── 5. Area boost — single-pass vectorised haversine ─────────────────────
    if user.preferred_area_radius_km > 0 and user.preferred_area_lat != 0.0:
        _lat1  = math.radians(user.preferred_area_lat)
        _lon1  = math.radians(user.preferred_area_lon)
        lats   = np.radians(scored["latitude"].values.astype(float))
        lons   = np.radians(scored["longitude"].values.astype(float))
        dlat, dlon = lats - _lat1, lons - _lon1
        _a     = np.sin(dlat / 2) ** 2 + math.cos(_lat1) * np.cos(lats) * np.sin(dlon / 2) ** 2
        dist_km = 6371.0 * 2 * np.arctan2(np.sqrt(_a), np.sqrt(1.0 - _a))
        boost   = dist_km <= user.preferred_area_radius_km
        scored.loc[boost, "final_score"] = (
            scored.loc[boost, "final_score"] + 0.20
        ).clip(upper=1.0)
        log.info("SCORING", f"area boost: {boost.sum()} within {user.preferred_area_radius_km}km", verbosity=2)

    log.info("SCORING", f"city={user.city} rows={len(scored)} liked={user.liked_ids}", verbosity=2)

    # ── 6. Filter: exclude visited, food venues, over-budget ─────────────────
    food_tags   = {"restaurant", "cafe", "food", "bakery", "dessert"}
    visited_set = {str(v) for v in user.visited_ids}
    is_food     = scored["categories"].apply(lambda cats: any(c in food_tags for c in cats))
    base_mask   = (
        ~att_ids.isin(visited_set)
      & ~is_food
      & (scored["price_avg"] <= user.attraction_budget)
    )
    filtered = scored[base_mask & (scored["cosine_sim"] > 0)].copy()
    if filtered.empty:
        filtered = scored[base_mask].copy()
    filtered = filtered.sort_values("final_score", ascending=False).reset_index(drop=True)

    # ── 7. Force-include liked attractions ────────────────────────────────────
    liked_mask = att_ids.isin(_valid_liked) & ~att_ids.isin(visited_set)
    liked_rows = scored[liked_mask].copy()
    if not liked_rows.empty:
        log.info("SCORING", f"force-including liked: {liked_rows['name'].tolist()}", verbosity=2)
        filtered = (
            pd.concat([liked_rows, filtered])
            .drop_duplicates(subset="attraction_id")
            .reset_index(drop=True)
        )
    elif _valid_liked:
        log.warn("SCORING", f"no liked attractions matched — valid_liked={_valid_liked}")

    filtered["is_forced"] = filtered["attraction_id"].astype(str).isin(_valid_liked_set)

    # ── 8. Beach / mall dedup ─────────────────────────────────────────────────
    beach_tags = {"beach", "coastal"}
    is_beach   = filtered["categories"].apply(lambda cats: any(c in beach_tags for c in cats))
    unforced_beach = filtered[is_beach & ~filtered["is_forced"]].index.tolist()
    if len(unforced_beach) > 1:
        log.info("SCORING", f"dedup: dropped {len(unforced_beach)-1} extra beach(es)", verbosity=2)
        filtered = filtered.drop(unforced_beach[1:]).reset_index(drop=True)

    mall_tags = {"mall", "shopping"}
    is_mall   = filtered["categories"].apply(lambda cats: any(c in mall_tags for c in cats))
    unforced_mall = filtered[is_mall & ~filtered["is_forced"]].index.tolist()
    if len(unforced_mall) > 1:
        log.info("SCORING", f"dedup: dropped {len(unforced_mall)-1} extra mall(s)", verbosity=2)
        filtered = filtered.drop(unforced_mall[1:]).reset_index(drop=True)

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
        "mode":          "Walk" | "Taxi",
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

    # Step 3: Mode decision is distance-based (OSRM returns DRIVING times at ~50 km/h,
    # so dur_min alone cannot tell us if something is walkable).
    # Walking speed ≈ 5 km/h → walk_min = road_km / 5 * 60
    # Walk only when ≤ 1.5 km (≈ 18 min at 5 km/h). Everything else is Taxi.
    walk_min = (road_km / 5.0) * 60.0  # estimated walking time in minutes

    if road_km <= WALKING_KM and walk_min <= 20:
        mode             = "Walk"
        icon             = "🚶"
        cost_egp         = 0
        effective_dur    = walk_min
        tip              = (f"Walking distance — {road_km} km, "
                            f"~{int(walk_min)} min walk (free)")
    else:
        mode             = "Taxi"
        icon             = "🚗"
        cost_egp         = taxi_mid
        effective_dur    = dur_min     # OSRM driving time
        tip              = (f"Taxi: {taxi_low}–{taxi_high} EGP  |  "
                            f"{road_km} km, ~{int(dur_min)} min drive")

    # Step 4: Generate OSM map & directions links
    directions_url = osm_directions_url(origin_lat, origin_lon, dest_lat, dest_lon)
    osm_url        = osm_maps_url(dest_lat, dest_lon, dest_name)

    return {
        "mode":              mode,
        "distance_km":       road_km,
        "duration_min":      round(effective_dur, 1),  # actual travel time used by scheduler
        "drive_duration_min": round(dur_min, 1),        # raw OSRM driving time (taxi ETA ref)
        "cost_egp":          cost_egp,
        "icon":              icon,
        "tip":               tip,
        "costs":             {"taxi_low": taxi_low, "taxi_high": taxi_high},
        "directions_url":    directions_url,
        "osm_url":           osm_url,
        "distance_source":   dist_info["source"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. MEAL RECOMMENDATION  (updated to use new transport layer)
# ─────────────────────────────────────────────────────────────────────────────
def recommend_meals(df, user, slot, near_lat, near_lon,
                    visited_today, top_n=3, dest_lat=None, dest_lon=None):
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
        log.info("ROUTE", f"no {slot} options after diversity filter {eaten} — relaxing", verbosity=2)
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

    # On-the-way filter: if a destination is known, drop candidates that require
    # backtracking (detour > 1.3× direct distance from start to destination).
    if dest_lat is not None and dest_lon is not None and not cands.empty:
        direct_km = _haversine_fallback(near_lat, near_lon, dest_lat, dest_lon)["distance_km"]
        if direct_km > 1.0:  # only filter when the destination is meaningfully far
            def _detour(row):
                to_r = _haversine_fallback(near_lat, near_lon, float(row["latitude"]), float(row["longitude"]))["distance_km"]
                r_to_dest = _haversine_fallback(float(row["latitude"]), float(row["longitude"]), dest_lat, dest_lon)["distance_km"]
                return to_r + r_to_dest
            cands["_detour_km"] = cands.apply(_detour, axis=1)
            on_way = cands[cands["_detour_km"] <= direct_km * 1.3]
            if not on_way.empty:
                cands = on_way
            cands = cands.drop(columns=["_detour_km"], errors="ignore")

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
            "price_from":  float(row.get("price_min", 0)),
            "image_url":   str(row.get("primary_image") or ""),
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
# 7b. KNAPSACK OPTIMIZATION HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def discretize_budget_egp(amount: float) -> int:
    return max(0, int(amount / DP_BUDGET_STEP_EGP))


def discretize_time_hours(hours: float) -> int:
    return max(0, int(hours * 60 / DP_TIME_STEP_MIN))


def estimate_knapsack_travel(att_row, origin_lat: float, origin_lon: float,
                              city: str = "cairo") -> dict:
    """Cheap Haversine-only travel estimate for knapsack planning (no OSRM)."""
    info = _haversine_fallback(
        origin_lat, origin_lon,
        float(att_row["latitude"]), float(att_row["longitude"]),
        city=city,
    )
    dist_km       = info["distance_km"]
    travel_hrs    = info["duration_min"] / 60.0
    base, per_low, per_high = get_taxi_rates(city)
    transport_egp = round(base + dist_km * (per_low + per_high) / 2.0)
    if dist_km <= WALKING_KM:
        transport_egp = 0
    return {
        "distance_km":        round(dist_km, 2),
        "travel_hrs":         round(travel_hrs, 3),
        "transport_cost_egp": float(transport_egp),
    }


def build_knapsack_candidates(scored_df: pd.DataFrame, user: "UserProfile",
                               origin_lat: float, origin_lon: float,
                               available_hours: float, budget_egp: float,
                               max_candidates: int = DP_MAX_CANDIDATES) -> pd.DataFrame:
    """
    Prepare the candidate pool for the 2-D knapsack solver.
    Excludes pure food venues and computes per-row cost/time weight columns.
    """
    FOOD_TAGS = {"restaurant", "cafe", "food", "bakery", "dessert",
                 "seafood", "grills", "local", "international"}

    def _is_pure_food(cats):
        return bool(cats) and all(c in FOOD_TAGS for c in cats)

    cands = scored_df[
        ~scored_df["categories"].apply(_is_pure_food)
        & (scored_df["latitude"].astype(float)  != 0.0)
        & (scored_df["longitude"].astype(float) != 0.0)
    ].copy()

    if cands.empty:
        return cands

    if "enjoyment_score" not in cands.columns:
        cands["enjoyment_score"] = cands["final_score"]

    def _knapsack_cols(row):
        travel    = estimate_knapsack_travel(row, origin_lat, origin_lon, user.city)
        price     = float(row["price_avg"])
        visit_hrs = float(row["avg_visit_hrs"])
        return pd.Series({
            "knapsack_price_egp":      price,
            "knapsack_visit_hrs":      visit_hrs,
            "knapsack_travel_hrs":     travel["travel_hrs"],
            "knapsack_transport_egp":  travel["transport_cost_egp"],
            "knapsack_total_cost_egp": price + travel["transport_cost_egp"],
            "knapsack_total_hrs":      visit_hrs + travel["travel_hrs"],
            "is_liked_candidate":      str(row["attraction_id"]) in user.liked_ids,
        })

    extra = cands.apply(_knapsack_cols, axis=1)
    cands = pd.concat([cands, extra], axis=1)

    # +15% budget headroom so knapsack keeps candidates the scheduler can still afford
    # (scheduler trims any that exceed the real remaining budget at runtime).
    # Forced liked attractions are exempt — they must enter the candidate list so
    # the post-knapsack injection can re-add them even if they exceed the budget cap.
    _forced_mask = (
        cands["is_forced"] if "is_forced" in cands.columns
        else pd.Series(False, index=cands.index)
    )
    cands = cands[
        _forced_mask
        | (
            (cands["knapsack_total_cost_egp"] <= budget_egp * 1.15)
            & (cands["knapsack_total_hrs"]     <= available_hours)
        )
    ]

    if cands.empty:
        return cands

    cands = cands.sort_values("enjoyment_score", ascending=False)

    liked_cands = cands[cands["is_liked_candidate"]]
    other_cands = cands[~cands["is_liked_candidate"]]
    n_liked     = min(len(liked_cands), max_candidates)
    n_other     = max_candidates - n_liked
    result = pd.concat([liked_cands.head(n_liked), other_cands.head(n_other)])
    result = (result
              .drop_duplicates(subset="attraction_id")
              .sort_values("enjoyment_score", ascending=False)
              .reset_index(drop=True))
    return result.head(max_candidates)


def solve_2d_knapsack(candidates_df: pd.DataFrame,
                      budget_egp: float, available_hours: float) -> list:
    """
    Classic 0/1 2-D knapsack over discretized budget × time.
    Uses full per-item DP layers so backtracking is unambiguous:
    dp[i+1][b][t] vs dp[i][b][t] tells us definitively whether item i
    is in the optimal solution, with no risk of stale-flag confusion.
    Memory: (n+1)*(B+1)*(T+1) floats — ≈ 170 KB at the default caps.
    Returns a list of selected attraction_id strings.
    """
    if candidates_df.empty:
        return []

    items = candidates_df.to_dict("records")
    B     = discretize_budget_egp(budget_egp)
    T     = discretize_time_hours(available_hours)

    if B <= 0 or T <= 0:
        return []

    n = len(items)

    # dp[i][b][t] = best enjoyment using items 0..i-1 with capacity (b, t)
    dp = [[[0.0] * (T + 1) for _ in range(B + 1)] for _ in range(n + 1)]

    for i, item in enumerate(items):
        cb  = discretize_budget_egp(item["knapsack_total_cost_egp"])
        ct  = discretize_time_hours(item["knapsack_total_hrs"])
        val = float(item["enjoyment_score"])
        prev = dp[i]
        curr = dp[i + 1]
        for b in range(B + 1):
            row_prev = prev[b]
            row_curr = curr[b]
            for t in range(T + 1):
                row_curr[t] = row_prev[t]          # skip item i
            if cb <= 0 or ct <= 0 or cb > B or ct > T:
                continue
            for b in range(cb, B + 1):
                for t in range(ct, T + 1):
                    with_item = prev[b - cb][t - ct] + val
                    if with_item > curr[b][t]:
                        curr[b][t] = with_item

    # Backtrack: dp[i+1][b][t] > dp[i][b][t] iff item i is in the optimal subset
    selected_ids = []
    b, t = B, T
    for i in range(n - 1, -1, -1):
        if b <= 0 or t <= 0:
            break
        if dp[i + 1][b][t] != dp[i][b][t]:
            item = items[i]
            selected_ids.append(str(item["attraction_id"]))
            b -= discretize_budget_egp(item["knapsack_total_cost_egp"])
            t -= discretize_time_hours(item["knapsack_total_hrs"])

    log.info("KNAPSACK", f"selected {len(selected_ids)}/{len(items)} (B={B} T={T})", verbosity=2)
    return selected_ids


def nearest_neighbor_route(selected_df: pd.DataFrame,
                            start_lat: float, start_lon: float) -> list:
    """Pure nearest-neighbor TSP heuristic. Returns ordered list of attraction dicts."""
    if selected_df.empty:
        return []
    ordered   = []
    remaining = selected_df.copy()
    clat, clon = start_lat, start_lon
    while not remaining.empty:
        remaining = remaining.copy()
        remaining["_nn_dist"] = remaining.apply(
            lambda r: _haversine_fallback(
                clat, clon, float(r["latitude"]), float(r["longitude"])
            )["distance_km"],
            axis=1,
        )
        idx  = remaining["_nn_dist"].idxmin()
        best = remaining.loc[idx]
        ordered.append(best.to_dict())
        clat, clon = float(best["latitude"]), float(best["longitude"])
        remaining  = remaining.drop(idx)
    return ordered


def select_anchors(scored_df: pd.DataFrame, liked_ids_set: set,
                   n: int, min_separation_km: float = 4.0,
                   start_lat: float = 0.0, start_lon: float = 0.0) -> list:
    """
    Pick n anchor points for n-day geographic clustering.

    Uses final_score (cosine sim + interests + rating + liked bonus) so anchors
    reflect both the user's liked places AND their interests, not just popularity.

    Liked non-food places are prioritised first. Subsequent anchors must be at
    least min_separation_km from all existing anchors — candidates that are
    closer are considered 'grouped' into the nearest anchor's cluster instead
    of spawning a new one.  Spread vs quality is balanced 50/50.

    start_lat/start_lon: when non-zero, the Day-1 anchor is biased toward
    attractions near the user's actual starting position (hotel / transport hub)
    so the first hop is short.  Liked attractions still float to the top via their
    score bonus; proximity is a 35 % tiebreaker among equal-quality candidates.
    """
    if n <= 1:
        return []

    FOOD_TAGS = {"restaurant", "cafe", "food", "bakery", "dessert",
                 "seafood", "grills", "local", "international"}

    pool = scored_df[
        scored_df["latitude"].astype(float).ne(0.0)
        & scored_df["longitude"].astype(float).ne(0.0)
        & ~scored_df["categories"].apply(
            lambda cats: bool(cats) and all(c in FOOD_TAGS for c in cats)
        )
    ].copy()

    if pool.empty:
        return []

    # Liked first (sorted by final_score), then others by final_score
    liked = pool[pool["attraction_id"].astype(str).isin(liked_ids_set)] \
                .sort_values("final_score", ascending=False)
    others = pool[~pool["attraction_id"].astype(str).isin(liked_ids_set)] \
                 .sort_values("final_score", ascending=False)
    ordered = (
        pd.concat([liked, others])
        .drop_duplicates("attraction_id")
        .reset_index(drop=True)
    )

    # Bias first-anchor selection toward user start: blend score (65%) + proximity (35%)
    if start_lat != 0.0 and start_lon != 0.0:
        ordered = ordered.copy()
        ordered["_dist_start"] = ordered.apply(
            lambda r: _haversine_fallback(
                start_lat, start_lon,
                float(r["latitude"]), float(r["longitude"]),
            )["distance_km"],
            axis=1,
        )
        max_s = ordered["final_score"].max() or 1.0
        max_d = ordered["_dist_start"].max() or 1.0
        # ordered["_anchor0_val"] = (
        #     0.65 * (ordered["final_score"] / max_s) +
        #     0.35 * (1.0 - ordered["_dist_start"] / max_d)
        # )
        # ordered["_isolation"] = ordered.apply(
        #     lambda r: pool.apply(
        #         lambda p: _haversine_fallback(
        #             float(r["latitude"]), float(r["longitude"]),
        #             float(p["latitude"]), float(p["longitude"])
        #         )["distance_km"],
        #         axis=1
        #     ).nsmallest(10).mean(),
        #     axis=1,
        # )
        # max_iso = ordered["_isolation"].max() or 1.0
        # ordered["_anchor0_val"] = (
        #     0.50 * (ordered["final_score"] / max_s) +
        #     0.30 * (1.0 - ordered["_dist_start"] / max_d) +
        #     0.20 * (1.0 - ordered["_isolation"] / max_iso)
        # )
        lats = ordered["latitude"].astype(float).values
        lons = ordered["longitude"].astype(float).values
        lats_r = np.radians(lats)
        lons_r = np.radians(lons)
        n_pts  = len(lats_r)
        density = np.zeros(n_pts)
        for i in range(n_pts):
            dlat = lats_r - lats_r[i]
            dlon = lons_r - lons_r[i]
            a    = (np.sin(dlat/2)**2
                    + np.cos(lats_r[i]) * np.cos(lats_r) * np.sin(dlon/2)**2)
            dist = 6371.0 * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
            dist[i] = np.inf   # exclude self
            density[i] = (dist <= 6.0).sum()  # count attractions within 5km

        max_density = density.max() or 1.0
        ordered["_density"] = density
        ordered["_anchor0_val"] = (
            0.50 * (ordered["final_score"] / max_s) +
            0.30 * (1.0 - ordered["_dist_start"] / max_d) +
            0.20 * (ordered["_density"] / max_density)  # dense areas win, Abu Qir loses
        )
        ordered = (ordered
                   .sort_values("_anchor0_val", ascending=False)
                   .drop(columns=["_dist_start", "_anchor0_val","_density"])
                   .reset_index(drop=True))
        log.info("ANCHOR", f"start=({start_lat:.4f},{start_lon:.4f}) → first candidate: '{ordered.iloc[0]['name']}'", verbosity=2)

    # Pre-seed: force any liked attraction that is >5 km from every other liked
    # attraction into the anchor list first (up to n slots) so isolated liked
    # places always get their own day cluster rather than being absorbed.
    LIKED_ISOLATION_KM = 5.0
    liked_pool = pool[pool["attraction_id"].astype(str).isin(liked_ids_set)].copy()
    forced_anchors: list = []
    if not liked_pool.empty:
        liked_sorted = liked_pool.sort_values("final_score", ascending=False)
        for _, row in liked_sorted.iterrows():
            if len(forced_anchors) >= n:
                break
            rlat, rlon = float(row["latitude"]), float(row["longitude"])
            if all(
                _haversine_fallback(rlat, rlon, fa["lat"], fa["lon"])["distance_km"] >= LIKED_ISOLATION_KM
                for fa in forced_anchors
            ):
                forced_anchors.append({"lat": rlat, "lon": rlon, "name": str(row["name"])})
                log.info("ANCHOR", f"force-promoted liked '{row['name']}' (≥{LIKED_ISOLATION_KM} km isolated)", verbosity=2)

    anchors: list = []
    first = ordered.iloc[0]
    anchors.append({
        "lat":  float(first["latitude"]),
        "lon":  float(first["longitude"]),
        "name": str(first["name"]),
    })

    # Merge forced_anchors into anchors (skip any already covered by the first anchor)
    for fa in forced_anchors:
        if len(anchors) >= n:
            break
        if all(
            _haversine_fallback(fa["lat"], fa["lon"], a["lat"], a["lon"])["distance_km"] >= min_separation_km
            for a in anchors
        ):
            anchors.append(fa)

    remaining = ordered.iloc[1:].copy()
    # Drop rows already represented by a forced anchor
    forced_ids = {str(row["attraction_id"]) for _, row in liked_pool.iterrows()
                  if any(
                      abs(float(row["latitude"]) - fa["lat"]) < 1e-6 and
                      abs(float(row["longitude"]) - fa["lon"]) < 1e-6
                      for fa in forced_anchors
                  )}
    remaining = remaining[~remaining["attraction_id"].astype(str).isin(forced_ids)].copy()

    while len(anchors) < n and not remaining.empty:
        remaining = remaining.copy()

        remaining["_min_d"] = remaining.apply(
            lambda r: min(
                _haversine_fallback(
                    float(r["latitude"]), float(r["longitude"]),
                    a["lat"], a["lon"]
                )["distance_km"]
                for a in anchors
            ),
            axis=1,
        )

        # Only candidates far enough form a new anchor
        # — the rest are naturally absorbed by the nearest cluster
        far = remaining[remaining["_min_d"] >= min_separation_km].copy()
        if far.empty:
            log.info("ANCHOR", f"all remaining within {min_separation_km} km — grouped into existing clusters", verbosity=2)
            break

        # Balance quality (final_score) and spread (distance from nearest anchor)
        max_score = far["final_score"].max() or 1.0
        max_dist  = far["_min_d"].max()       or 1.0
        far["_anchor_val"] = (
            0.5 * (far["final_score"] / max_score) +
            0.5 * (far["_min_d"]      / max_dist)
        )

        best_idx = far["_anchor_val"].idxmax()
        best     = remaining.loc[best_idx]
        anchors.append({
            "lat":  float(best["latitude"]),
            "lon":  float(best["longitude"]),
            "name": str(best["name"]),
        })
        remaining = remaining.drop(best_idx)

    return anchors


def build_cluster_for_anchor(scored_df: pd.DataFrame,
                              anchor_lat: float, anchor_lon: float,
                              city: str = "",
                              exclude_ids: set | None = None,
                              min_size: int = MIN_CLUSTER_SIZE,
                              start_km: float = 2.0,
                              step_km: float = 1.0) -> tuple:
    """
    Restrict scored_df to non-food attractions within a growing radius of anchor.
    Uses city-specific max radius to keep clusters tight.
    exclude_ids: attractions already claimed by a previous day — removed from pool
                 before building this cluster, preventing cross-day overlap.
    Returns (cluster_df, cluster_ids_set).
    """
    FOOD_TAGS = {"restaurant", "cafe", "food", "bakery", "dessert",
                 "seafood", "grills", "local", "international"}

    max_km = CITY_CLUSTER_RADIUS.get(str(city).strip().lower(), CLUSTER_RADIUS_DEFAULT)

    pool = scored_df[
        ~scored_df["categories"].apply(
            lambda cats: bool(cats) and all(c in FOOD_TAGS for c in cats)
        )
        & scored_df["latitude"].astype(float).ne(0.0)
        & scored_df["longitude"].astype(float).ne(0.0)
    ].copy()

    if exclude_ids:
        pool = pool[~pool["attraction_id"].astype(str).isin(exclude_ids)]

    if pool.empty:
        return scored_df, set()

    pool["_dist"] = pool.apply(
        lambda r: _haversine_fallback(
            anchor_lat, anchor_lon,
            float(r["latitude"]), float(r["longitude"])
        )["distance_km"],
        axis=1,
    )

    # Expand radius until we hit min_size or the city cap
    radius = start_km
    while (pool["_dist"] <= radius).sum() < min_size and radius < max_km:
        radius += step_km

    cluster = pool[pool["_dist"] <= radius].copy()

    # If nothing at all is within the cap, take the nearest available attractions —
    # but never fall back to the full city pool, which would scatter the user.
    if cluster.empty:
        log.info("CLUSTER", f"no attractions within {radius:.1f} km — using nearest available", verbosity=2)
        cluster = pool.nsmallest(min(min_size, len(pool)), "_dist").copy()

    max_d = cluster["_dist"].max() or 1.0
    cluster["final_score"] = (
        cluster["final_score"] * (1.0 - 0.5 * (cluster["_dist"] / max_d))
    ).clip(lower=0.0)

    cluster_ids = set(cluster["attraction_id"].astype(str).tolist())

    log.info("CLUSTER", f"anchor=({anchor_lat:.4f},{anchor_lon:.4f}) city={city} max={max_km}km used={radius:.1f}km → {len(cluster)} candidates", verbosity=2)

    return cluster.drop(columns=["_dist"]), cluster_ids


def split_budget_across_days(daily_hours: list, daily_top_prices: list) -> list:
    """
    Adaptive per-day budget allocation.
    Blends 60 % normalized hours + 40 % normalized cost-pressure.
    daily_hours      — list of available hours per day
    daily_top_prices — list of avg top-attraction price per day (cost pressure proxy)
    Returns list of fractions that sum to 1.0.
    """
    n = len(daily_hours)
    if n == 0:
        return []
    if n == 1:
        return [1.0]

    total_hrs   = sum(daily_hours) or 1.0
    total_price = sum(daily_top_prices) or 1.0

    fractions = []
    for hrs, price in zip(daily_hours, daily_top_prices):
        w = 0.60 * (hrs / total_hrs) + 0.40 * (price / total_price)
        fractions.append(w)

    total_w = sum(fractions) or 1.0
    return [f / total_w for f in fractions]


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
    fallback_lat, fallback_lon = get_city_coords(city)
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

    # Only fall back to city centroid when payload lat/lon is absent or exactly 0
    _plat = payload.get("current_lat")
    _plon = payload.get("current_lon")
    _clat = float(_plat) if (_plat is not None and float(_plat) != 0.0) else fallback_lat
    _clon = float(_plon) if (_plon is not None and float(_plon) != 0.0) else fallback_lon
    _src  = "payload" if (_plat is not None and float(_plat) != 0.0) else "city-centroid"
    log.info("BUILD", f"city={city} start=({_clat:.4f},{_clon:.4f}) [{_src}]", verbosity=2)

    return UserProfile(
        user_id=str(payload.get("user_id", "guest")),
        name=str(payload.get("name", "TourMate User")),
        city=city,
        preferred_categories=preferred_categories,
        budget_egp=float(payload.get("budget_egp", 1000) or 1000),
        available_hours=avail_hrs,
        current_lat=_clat,
        current_lon=_clon,
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
        browse_n=browse_n,
        is_foreigner=bool(payload.get("is_foreigner", False)),
        day_index=int(payload.get("day_index", 0) or 0),
        n_days=int(payload.get("n_days", 1) or 1),
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


def build_itinerary(df, att_matrix, user, start_hour=9, top_n=5, browse_n=5,
                    is_foreigner=False, day_index=0, n_days=1):
    log.header(
        city=user.city, day_index=day_index, n_days=n_days,
        budget=user.budget_egp, liked_ids=list(user.liked_ids),
        start_lat=user.current_lat, start_lon=user.current_lon,
        start_hour=float(start_hour),
        end_hour=float(start_hour) + user.available_hours,
    )

    print("  [ENGINE v2.1] post-meal swap + closing-hours guard active")
    # Apply nationality-based admission pricing before scoring
    _FOOD_TAGS_PRICE = {"restaurant", "cafe", "food", "bakery", "dessert",
                        "seafood", "grills", "local", "international"}
    df = df.copy()
    is_food_mask = df["categories"].apply(
        lambda cats: bool(cats) and all(c in _FOOD_TAGS_PRICE for c in cats)
    )
    if is_foreigner:
        att_mask = (~is_food_mask) & (df["admission_egp_foreigner"] > 0)
        df.loc[att_mask, "price_avg"] = df.loc[att_mask, "admission_egp_foreigner"]
    else:
        att_mask = (~is_food_mask) & (df["admission_egp"] > 0)
        df.loc[att_mask, "price_avg"] = df.loc[att_mask, "admission_egp"]

    scored = score_all_attractions(user, df, att_matrix)
    if scored.empty:
        return {"error": "No matching attractions found."}

    # Validate liked IDs against the DB and city before anything else.
    # liked_ids_set throughout this function only contains valid, city-matched IDs.
    liked_ids_set = set(_validate_liked_ids(user.liked_ids, df, user.city))
    _rejected_liked = {str(x) for x in user.liked_ids} - liked_ids_set
    if _rejected_liked:
        log.warn("LIKED", f"{len(_rejected_liked)} ID(s) rejected (not in DB or wrong city): {sorted(_rejected_liked)}")

    avail_hrs     = user.available_hours
    end_hr        = float(start_hour) + avail_hrs

    # ── Anchor-based geographic clustering (multi-day trips only) ──────────────
    # Anchors are computed from a visited-free pool so they stay consistent
    # across all day calls (day N's visited list doesn't shift anchor N+1).
    # Cross-day deduplication is handled by visited_ids in `scored` alone —
    # we no longer pass full cluster_ids forward to avoid over-exclusion.
    cluster_ids: set = set()
    liked_day_assignment: dict[str, int] = {}   # attraction_id → day index it belongs to
    if n_days > 1:
        stable_user   = _dc_replace(user, visited_ids=[])
        stable_scored = score_all_attractions(stable_user, df, att_matrix)
        anchors = select_anchors(stable_scored, liked_ids_set, n_days,
                                 start_lat=user.current_lat, start_lon=user.current_lon)
        log.section("CLUSTER", f"{len(anchors)} anchors: {[a['name'] for a in anchors]}")
        if anchors:
            # Assign every liked attraction to its nearest anchor (= its reserved day).
            # Done on stable_scored (no visited filter) so the assignment is identical
            # across all day calls.
            liked_rows = stable_scored[
                stable_scored["attraction_id"].astype(str).isin(liked_ids_set)
            ]
            for _, row in liked_rows.iterrows():
                aid  = str(row["attraction_id"])
                rlat = float(row["latitude"])
                rlon = float(row["longitude"])
                if rlat == 0.0 and rlon == 0.0:
                    liked_day_assignment[aid] = 0
                    continue
                best_day = min(
                    range(len(anchors)),
                    key=lambda d: _haversine_fallback(
                        rlat, rlon, anchors[d]["lat"], anchors[d]["lon"]
                    )["distance_km"],
                )
                liked_day_assignment[aid] = best_day
                log.info("CLUSTER", f"liked '{row['name']}' → Day {best_day + 1} (anchor '{anchors[best_day]['name']}')", verbosity=2)

            anchor = anchors[min(day_index, len(anchors) - 1)]
            _anchor_lat, _anchor_lon = anchor["lat"], anchor["lon"]
            log.section("CLUSTER", f"Day {day_index + 1} anchor: '{anchor['name']}' ({anchor['lat']:.4f}, {anchor['lon']:.4f})")
            scored_for_knapsack, cluster_ids = build_cluster_for_anchor(
                scored, anchor["lat"], anchor["lon"],
                city=user.city,
            )
            log.info("CLUSTER", f"pool={len(scored)} → cluster={len(scored_for_knapsack)}", verbosity=2)
        else:
            scored_for_knapsack = scored
            _anchor_lat, _anchor_lon = user.current_lat, user.current_lon
    else:
        scored_for_knapsack = scored
        _anchor_lat, _anchor_lon = user.current_lat, user.current_lon

    # Today's liked IDs: those whose nearest anchor matches this day.
    # For single-day trips (no assignment computed) all liked IDs belong today.
    today_liked_ids: set[str] = (
        {aid for aid, day in liked_day_assignment.items() if day == day_index}
        if liked_day_assignment else set(liked_ids_set)
    )

    # Force-inject today's liked places that were cut by the cluster radius filter.
    if today_liked_ids and n_days > 1:
        already_in = set(scored_for_knapsack["attraction_id"].astype(str))
        missing_today = today_liked_ids - already_in
        if missing_today:
            missing_rows = scored[scored["attraction_id"].astype(str).isin(missing_today)].copy()
            if not missing_rows.empty:
                scored_for_knapsack = (
                    pd.concat([missing_rows, scored_for_knapsack])
                    .drop_duplicates(subset="attraction_id")
                    .reset_index(drop=True)
                )
                log.info("CLUSTER", f"force-injected today's liked outside cluster radius: {missing_rows['name'].tolist()}", verbosity=1)

    # Remove liked attractions reserved for OTHER days from today's candidate pool
    # so they are never scheduled (or force-injected) into the wrong day.
    other_day_liked = liked_ids_set - today_liked_ids
    if other_day_liked and n_days > 1:
        before = len(scored_for_knapsack)
        scored_for_knapsack = scored_for_knapsack[
            ~scored_for_knapsack["attraction_id"].astype(str).isin(other_day_liked)
        ].copy()
        log.info("CLUSTER", f"day {day_index + 1} liked: today={sorted(today_liked_ids)} | reserved={sorted(other_day_liked)} | pool {before}→{len(scored_for_knapsack)}", verbosity=1)
        # Show human-readable names for reserved liked attractions
        for aid in sorted(other_day_liked):
            row = df[df["attraction_id"].astype(str) == aid]
            name = row.iloc[0]["name"] if not row.empty else aid
            assigned_day = liked_day_assignment.get(aid, "?")
            log.info("LIKED", f"'{name}' reserved for Day {assigned_day + 1 if isinstance(assigned_day, int) else assigned_day} — excluded from Day {day_index + 1} pool", verbosity=1)

    # ── Liked restaurant / café pool for meal-slot priority ────────────────────
    _LIKED_MEAL_CATS = {"restaurant", "cafe", "food", "seafood", "grills",
                        "local", "international", "bakery", "dessert"}
    liked_meal_pool: list = df[
        df["attraction_id"].astype(str).isin(liked_ids_set)
        & df["categories"].apply(lambda cats: bool(set(cats) & _LIKED_MEAL_CATS))
    ].to_dict("records")
    liked_used_as_meal: set = set()

    # ── Fixed meal windows (clock-based, not progress-based) ───────────────────
    BREAKFAST_OPEN, BREAKFAST_CLOSE = 8.0,  10.0
    LUNCH_OPEN,     LUNCH_CLOSE     = 12.5, 16.0
    COFFEE_OPEN,    COFFEE_CLOSE    = 16.0, 18.0
    DINNER_OPEN,    DINNER_CLOSE    = 19.0, 21.0

    include_breakfast = float(start_hour) <= BREAKFAST_CLOSE and end_hr > BREAKFAST_OPEN
    include_lunch     = end_hr > LUNCH_OPEN
    include_coffee    = end_hr > COFFEE_OPEN
    include_dinner    = end_hr > DINNER_OPEN

    # ── Reserve hours and budget for meals before knapsack ─────────────────────
    # Coffee is excluded: it fires opportunistically in the scheduler only.
    meal_reserve_hrs = (
        (0.5  if include_breakfast else 0.0) +
        (0.75 if include_lunch     else 0.0) +
        (1.0  if include_dinner    else 0.0)
    )
    attraction_hrs    = max(0.5, avail_hrs - meal_reserve_hrs)
    attraction_budget = max(50.0, user.budget_egp * (1.0 - user.meal_budget_ratio))

    _FOOD_TAGS = {"restaurant", "cafe", "food", "bakery", "dessert",
                  "seafood", "grills", "local", "international"}

    # ── Knapsack pipeline ───────────────────────────────────────────────────────
    # +1 hr buffer so the knapsack selects more candidates than strictly fit —
    # the scheduler then keeps only what actually fits within the real time window.
    knapsack_hrs = attraction_hrs + 1.0

    # 1. Build candidate pool (filters food venues, computes weight columns)
    candidates = build_knapsack_candidates(
        scored_for_knapsack, user,
        user.current_lat, user.current_lon,
        knapsack_hrs, attraction_budget,
    )
    log.section("KNAPSACK", f"cluster={len(scored_for_knapsack)} candidates={len(candidates)} hrs={knapsack_hrs:.1f} budget={attraction_budget:.0f}", verbosity=2)

    # 2. Solve 2-D knapsack
    selected_ids = set(solve_2d_knapsack(candidates, attraction_budget, knapsack_hrs))

    # 2b. Re-inject liked non-food attractions the knapsack excluded.
    # Only today's liked attractions are eligible — places reserved for other days
    # must not be force-injected into the wrong day's schedule.
    _liked_non_food_in_pool = set(
        scored_for_knapsack[
            scored_for_knapsack["attraction_id"].astype(str).isin(today_liked_ids)
            & ~scored_for_knapsack["categories"].apply(
                lambda c: bool(c) and all(x in _FOOD_TAGS for x in c)
            )
        ]["attraction_id"].astype(str).tolist()
    )
    _extra = _liked_non_food_in_pool - selected_ids
    if _extra:
        _extra_names = scored_for_knapsack[
            scored_for_knapsack["attraction_id"].astype(str).isin(_extra)
        ]["name"].tolist()
        log.section("KNAPSACK", f"re-injected {len(_extra)} liked place(s): {_extra_names}", verbosity=2)
        selected_ids |= _extra

    # 3. Build DataFrame for routing; fall back to top-N if knapsack returned nothing
    # selected_df = scored_for_knapsack[scored_for_knapsack["attraction_id"].astype(str).isin(selected_ids)].copy()
    # if selected_df.empty:
    #     selected_df = scored_for_knapsack[~scored_for_knapsack["categories"].apply(
    #         lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
    #     )].head(top_n).copy()
    selected_df = scored_for_knapsack[scored_for_knapsack["attraction_id"].astype(str).isin(selected_ids)].copy()
    if selected_df.empty:
        selected_df = scored_for_knapsack[~scored_for_knapsack["categories"].apply(
            lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
        )].head(top_n).copy()

    # Build unified pool — knapsack selection + remaining scored attractions
    # knapsack picks get a priority flag so TSP can use them as tiebreaker
    _non_selected = scored[
        ~scored["attraction_id"].astype(str).isin(selected_ids)
        & ~scored["categories"].apply(
            lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
        )
    ].copy()

    selected_df["_knapsack_selected"] = True
    _non_selected["_knapsack_selected"] = False

    unified_pool = (
        pd.concat([selected_df, _non_selected])
        .drop_duplicates(subset="attraction_id")
        .reset_index(drop=True)
    )

    # 5. Nearest-neighbor TSP ordering (replaces optimise_route as the live path)
    ordered = nearest_neighbor_route(selected_df, user.current_lat, user.current_lon)

    # Use natural nearest-neighbor order — liked places are already in the pool via
    # knapsack re-injection and their LIKED_BONUS score. Forcing them first caused them
    # to be tried before they opened and then never retried.
    # Sort by open_hour ascending (secondary: original nearest-neighbor position).
    # This ensures 09:00 attractions are visited before 10:00 ones, so late-opening
    # liked places are naturally reached after the clock has passed their open time.
    _liked_in_order = [a["name"] for a in ordered if str(a["attraction_id"]) in today_liked_ids]
    if _liked_in_order:
        log.section("ROUTE", f"liked in pool: {_liked_in_order}")

    # ── Scheduler state ─────────────────────────────────────────────────────────
    itinerary       = []
    visited_today   = list(user.visited_ids)
    curr_hr         = float(start_hour)
    prev_lat        = user.current_lat
    prev_lon        = user.current_lon
    total_cost      = 0.0
    total_transport = 0.0
    total_dist      = 0.0
    last_stop_type  = None

    breakfast_done = False
    lunch_done     = False
    coffee_done    = False
    dinner_done    = False

    beach_added  = False
    mall_added   = False
    BEACH_CATS   = {"beach", "coastal"}
    MALL_CATS    = {"mall", "shopping"}
    FOOD_CATS    = {"restaurant", "cafe", "food", "seafood", "grills",
                    "local", "international", "bakery", "dessert"}
    FOOD_GAP_HRS = 2.0
    last_meal_hr = float(start_hour) - 999.0
    _queue_ref = [deque()]

    def time_left():
        return avail_hrs - (curr_hr - float(start_hour))
    
    def _build_queue(from_lat, from_lon, visited_set):
        
        remaining = unified_pool[
            ~unified_pool["attraction_id"].astype(str).isin(visited_set)
            & ~unified_pool["categories"].apply(
                lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
            )
        ].copy()
        if remaining.empty:
            return deque()

        # ── Exclude attractions that belong geographically to another day's
        # anchor (closer to any other anchor than to today's). Always keep
        # today's liked attractions regardless of geography.
        if n_days > 1 and len(anchors) > 1:
            def _belongs_to_today(row):
                rlat = float(row["latitude"])
                rlon = float(row["longitude"])
                if rlat == 0.0 and rlon == 0.0:
                    return True
                dist_today = _haversine_fallback(
                    rlat, rlon, _anchor_lat, _anchor_lon
                )["distance_km"]
                for d, a in enumerate(anchors):
                    if d == day_index:
                        continue
                    dist_other = _haversine_fallback(
                        rlat, rlon, a["lat"], a["lon"]
                    )["distance_km"]
                    if dist_other < dist_today:
                        return False
                return True

            belongs_mask = remaining.apply(_belongs_to_today, axis=1)
            liked_mask   = remaining["attraction_id"].astype(str).isin(today_liked_ids)
            remaining    = remaining[belongs_mask | liked_mask].copy()
            log.info("QUEUE", f"geo-filter: {belongs_mask.sum()} of {len(belongs_mask)} attractions belong to Day {day_index+1}", verbosity=2)

        # Score by proximity + final_score + knapsack priority
        remaining["_dist"] = remaining.apply(
            lambda r: _haversine_fallback(
                from_lat, from_lon,
                float(r["latitude"]), float(r["longitude"])
            )["distance_km"],
            axis=1,
        )
        max_dist  = remaining["_dist"].max() or 1.0
        max_score = remaining["final_score"].max() or 1.0
        remaining["_routing_score"] = (
            0.60 * (1 - remaining["_dist"] / max_dist) +
            0.25 * (remaining["final_score"] / max_score) +
            0.15 * remaining["_knapsack_selected"].astype(float)
        )
        remaining = remaining.sort_values("_routing_score", ascending=False).drop(
            columns=["_dist", "_routing_score"]
        )
        return deque(remaining.to_dict("records"))

    def _refresh_queue():
        _queue_ref[0] = _build_queue(
            prev_lat, prev_lon,
            set(str(v) for v in visited_today)
        )

    def add_meal(slot, nlat, nlon, dur, max_dist_km=None, dest_lat=None, dest_lon=None):
        nonlocal curr_hr, prev_lat, prev_lon, total_cost, total_transport, total_dist, last_stop_type, last_meal_hr
        opts = recommend_meals(df, user, slot, nlat, nlon, visited_today, dest_lat=dest_lat, dest_lon=dest_lon)
        if not opts:
            return
        pick           = opts[0]
        transport      = pick["transport"]
        transport_cost = transport.get("cost_egp", 0)
        travel_hrs     = float(transport.get("duration_min", 0) or 0) / 60.0
        if max_dist_km is not None and transport.get("distance_km", 0) > max_dist_km:
            log.info("ROUTE", f"skipping {slot} — nearest option {transport['distance_km']:.1f} km away (cap {max_dist_km} km)", verbosity=1)
            return
        total_stop_hrs = travel_hrs + dur
        if time_left() < total_stop_hrs:
            return
        if (pick["price_avg"] + transport_cost) > (user.budget_egp - total_cost - total_transport):
            return
        itinerary.append({
            "time":           _fmt(curr_hr + travel_hrs),
            "departure_time": _fmt(curr_hr),
            "type":           slot.capitalize(),
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
            "image_url":      pick.get("image_url", ""),
            "price_from":     pick.get("price_from", 0),
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
        last_meal_hr    = curr_hr
         # Rebuild queue from new position after meal
        _refresh_queue()

    def try_liked_meal(slot: str, dur: float) -> bool:
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
        candidates.sort(key=lambda r: _haversine_fallback(
            prev_lat, prev_lon, r["latitude"], r["longitude"])["distance_km"]
        )
        for r in candidates:
            straight_km = _haversine_fallback(
                prev_lat, prev_lon, r["latitude"], r["longitude"])["distance_km"]
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
            detour_note = (
                f"This is a place you liked! We went out of the day's area to fit it in — "
                "your plan may be slightly less optimised around this stop."
                if str(r["attraction_id"]) not in cluster_ids else ""
            )
            itinerary.append({
                "time":           _fmt(curr_hr + travel_hrs),
                "departure_time": _fmt(curr_hr),
                "type":           slot.capitalize(),
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
                "image_url":      str(r.get("primary_image") or ""),
                "price_from":     float(r.get("price_min", 0)),
                "osm_url":        osm_maps_url(r["latitude"], r["longitude"], r["name"]),
                "directions_url": t.get("directions_url", ""),
                "detour_note":    detour_note,
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
             # Rebuild queue from new position after liked meal
            _refresh_queue()
            log.info("ROUTE", f"liked meal '{r['name']}' placed as {slot} ({straight_km:.1f} km away)")
            return True
        return False

    def _try_meal_window(slot, dur, window_open, window_close, done_flag, guard=True):
        """Inject a meal if we're inside its window and it hasn't been served yet.
        guard=True means we skip injection if we've already passed the window close."""
        if curr_hr < window_open:
            return done_flag   # window not yet open
        if curr_hr > window_close and guard:
            return True        # window closed — mark done, skip
        if not try_liked_meal(slot, dur):
            add_meal(slot, prev_lat, prev_lon, dur)
        return True            # mark done regardless of whether add_meal succeeded

    # ── Pre-loop: breakfast ─────────────────────────────────────────────────────
    # Breakfast fires immediately if start_hour is within the window.
    if include_breakfast and not breakfast_done and curr_hr >= BREAKFAST_OPEN:
        if curr_hr <= BREAKFAST_CLOSE:
            if not try_liked_meal("breakfast", 0.5):
                add_meal("breakfast", user.current_lat, user.current_lon, 0.5,
                         dest_lat=_anchor_lat, dest_lon=_anchor_lon)
        breakfast_done = True

    # ── TSP from post-breakfast position ────────────────────────────────────────
    # ordered = nearest_neighbor_route(selected_df, prev_lat, prev_lon)
    # _liked_in_order = [a["name"] for a in ordered if str(a["attraction_id"]) in today_liked_ids]
    # if _liked_in_order:
    #     log.section("ROUTE", f"liked in pool: {_liked_in_order}")

    # # ── Main scheduling loop ────────────────────────────────────────────────────
    # # _open_wait holds liked places parked because they aren't open yet.
    # # After each successful visit the clock advances, so we check if any of them
    # # can now be visited and push them to the front of the queue immediately.
    # from collections import deque
    # _sched_queue = deque(ordered)
    # _open_wait: list = []
    _open_wait: list = []


    # _sched_queue = _build_queue(prev_lat, prev_lon, set(str(v) for v in visited_today))
    _queue_ref[0] = _build_queue(prev_lat, prev_lon, set(str(v) for v in visited_today))

    _liked_in_order = [a["name"] for a in _queue_ref[0] if str(a["attraction_id"]) in today_liked_ids]

    # _liked_in_order = [a["name"] for a in _sched_queue if str(a["attraction_id"]) in today_liked_ids]
    if _liked_in_order:
        log.section("ROUTE", f"liked in pool: {_liked_in_order}")

    while _queue_ref[0]:
        if time_left() <= 0:
            break

        # Flush any parked liked places that are now open back into the queue
        # so the liked-first scan below can pick them up immediately.
        for _w in list(_open_wait):
            if curr_hr >= float(_w.get("open_hour", 0)):
                _queue_ref[0].appendleft(_w)
                _open_wait.remove(_w)
                log.info("LIKED", f"'{_w['name']}' now open — back in queue", verbosity=1)

        # Always try a liked place that is currently open before anything else.
        # Scan the queue for the first liked attraction whose open_hour <= curr_hr.
        att = None
        for _i, _candidate in enumerate(_queue_ref[0]):
            if str(_candidate.get("attraction_id")) in today_liked_ids:
                if curr_hr >= float(_candidate.get("open_hour", 0) or 0):
                    att = _candidate
                    del _queue_ref[0][_i]
                    log.info("LIKED", f"'{_candidate['name']}' pulled to front (open now)", verbosity=2)
                    break
        if att is None:
            att = _queue_ref[0].popleft()

        # # ── Inject meals whose window has opened since the last attraction ──────
        # if include_breakfast and not breakfast_done:
        #     breakfast_done = _try_meal_window(
        #         "breakfast", 0.5, BREAKFAST_OPEN, BREAKFAST_CLOSE, breakfast_done)

        # if include_lunch and not lunch_done:
        #     lunch_done = _try_meal_window(
        #         "lunch", 0.75, LUNCH_OPEN, LUNCH_CLOSE, lunch_done)

        # # Coffee: fires within window, but only after COFFEE_GAP_HRS since last meal
        # if (include_coffee and not coffee_done and
        #         COFFEE_OPEN <= curr_hr <= COFFEE_CLOSE and
        #         (curr_hr - last_meal_hr) >= COFFEE_GAP_HRS):
        #     if not try_liked_meal("coffee", 0.4):
        #         add_meal("coffee", prev_lat, prev_lon, 0.4, max_dist_km=2.0)
        #     coffee_done = True
        # elif include_coffee and not coffee_done and curr_hr > COFFEE_CLOSE:
        #     coffee_done = True  # window passed without eligible gap — skip

        # if include_dinner and not dinner_done:
        #     dinner_done = _try_meal_window(
        #         "dinner", 1.0, DINNER_OPEN, DINNER_CLOSE, dinner_done)

        # ── Inject meals BEFORE pulling next attraction ─────────────────────────
        # Checking curr_hr here (top of loop, before pop) ensures the queue is
        # rebuilt from the post-meal position via _refresh_queue() inside add_meal,
        # so the next attraction selected reflects where we actually are after eating.
        # This prevents zigzag routes like: Lunch → far attraction → nearby attraction
        # that should have come right after lunch.
        if include_breakfast and not breakfast_done and curr_hr >= BREAKFAST_OPEN:
            if not try_liked_meal("breakfast", 0.5):
                add_meal("breakfast", prev_lat, prev_lon, 0.5)
            breakfast_done = True

        if include_lunch and not lunch_done and curr_hr >= LUNCH_OPEN:
            if not try_liked_meal("lunch", 0.75):
                add_meal("lunch", prev_lat, prev_lon, 0.75)
            lunch_done = True

        if (include_coffee and not coffee_done and
                COFFEE_OPEN <= curr_hr <= COFFEE_CLOSE and
                (curr_hr - last_meal_hr) >= COFFEE_GAP_HRS):
            if not try_liked_meal("coffee", 0.4):
                add_meal("coffee", prev_lat, prev_lon, 0.4, max_dist_km=2.0)
            coffee_done = True
        elif include_coffee and not coffee_done and curr_hr > COFFEE_CLOSE:
            coffee_done = True

        if include_dinner and not dinner_done and curr_hr >= DINNER_OPEN:
            if not try_liked_meal("dinner", 1.0):
                add_meal("dinner", prev_lat, prev_lon, 1.0)
            dinner_done = True

        if time_left() <= 0:
            break

        # ── Post-meal proximity check ───────────────────────────────────────────
        if last_stop_type == "meal" and att is not None and _queue_ref[0]:
            att_dist = _haversine_fallback(
                prev_lat, prev_lon,
                float(att["latitude"]), float(att["longitude"])
            )["distance_km"]

            _is_att_liked  = str(att.get("attraction_id")) in today_liked_ids
            _att_is_far_liked = _is_att_liked and att_dist > 7.0

            if _att_is_far_liked or not _is_att_liked:
                _closer_idx  = None
                _closer_cand = None
                _closer_dist = att_dist

                for _scan_i, _scan_cand in enumerate(list(_queue_ref[0])[:5]):
                    _scan_dist = _haversine_fallback(
                        prev_lat, prev_lon,
                        float(_scan_cand["latitude"]),
                        float(_scan_cand["longitude"])
                    )["distance_km"]
                    if (_scan_dist < _closer_dist and
                            att_dist / max(_scan_dist, 0.1) >= 2.0):
                        _closer_idx  = _scan_i
                        _closer_cand = _scan_cand
                        _closer_dist = _scan_dist

                _should_swap = False

                if _closer_cand is not None and _is_att_liked:
                    # Simulate arriving at liked place after visiting closer one first
                    _sim_visit  = float(_closer_cand.get("avg_visit_hrs", 1.0))
                    _sim_travel = _closer_dist / 30.0
                    _liked_eta  = curr_hr + _sim_travel + _sim_visit + att_dist / 30.0
                    _liked_close = float(att.get("close_hour", 24))


                    if _liked_eta >= _liked_close - MIN_VISIT_HRS:
                        log.info("ROUTE",
                            f"keeping '{att['name']}' first — closes at "
                            f"{_fmt(_liked_close)} (detour noted)", verbosity=1)
                        att = dict(att)
                        att["detour_note"] = (
                            "This is a place you liked! It closes soon so we "
                            "prioritised it — your route may be slightly less optimised."
                        )
                    else:
                        _should_swap = True

                elif _closer_cand is not None and not _is_att_liked:
                    _should_swap = True

                if _should_swap:
                    del _queue_ref[0][_closer_idx]
                    _queue_ref[0].appendleft(att)
                    att = _closer_cand

                if last_stop_type == "meal":
                     last_stop_type = "checked"

        # ── Category frequency guards ───────────────────────────────────────────
        att_cats = set(att["categories"])
        is_liked = str(att["attraction_id"]) in liked_ids_set
        if att_cats & BEACH_CATS and beach_added and not is_liked:
            log.skip(att["name"], "beach cap reached", verbosity=2)
            continue
        if att_cats & MALL_CATS and mall_added and not is_liked:
            log.skip(att["name"], "mall cap reached", verbosity=2)
            continue
        if str(att["attraction_id"]) in liked_used_as_meal:
            continue
        if att_cats & FOOD_CATS and (curr_hr - last_meal_hr) < FOOD_GAP_HRS and not is_liked:
            log.skip(att["name"], f"food gap ({curr_hr - last_meal_hr:.1f}h since last meal)", verbosity=2)
            continue

        # ── Future-anchor proximity guard ───────────────────────────────────────
        # Skip attractions that belong geographically to a future day's cluster
        # (closer to a future anchor than today's anchor AND within that anchor's radius)
        # if n_days > 1 and day_index < n_days - 1 and not is_liked:
        is_today_liked = str(att.get("attraction_id")) in today_liked_ids
        if n_days > 1 and day_index < n_days - 1 and not is_today_liked:
            att_lat = float(att.get("latitude", 0))
            att_lon = float(att.get("longitude", 0))
            if att_lat != 0.0 and att_lon != 0.0:
                dist_to_today = _haversine_fallback(
                    att_lat, att_lon, _anchor_lat, _anchor_lon
                )["distance_km"]
                _skip_for_future = False
                for future_day, future_anchor in enumerate(anchors):
                    if future_day <= day_index:
                        continue
                    dist_to_future = _haversine_fallback(
                        att_lat, att_lon,
                        future_anchor["lat"], future_anchor["lon"]
                    )["distance_km"]
                    if (dist_to_future < dist_to_today and
                            dist_to_future < CITY_CLUSTER_RADIUS.get(user.city, CLUSTER_RADIUS_DEFAULT)):
                        log.skip(
                            att["name"],
                            f"belongs to Day {future_day+1} cluster "
                            f"(anchor '{future_anchor['name']}' "
                            f"{dist_to_future:.1f} km vs today's {dist_to_today:.1f} km)"
                        )
                        _skip_for_future = True
                        break
                if _skip_for_future:
                    continue

        # ── Transport & feasibility ─────────────────────────────────────────────
        transport = get_transport_info(
            prev_lat, prev_lon,
            att["latitude"], att["longitude"],
            dest_name=att["name"], city=user.city,
        )
        transport_cost   = transport.get("cost_egp", 0)
        travel_hrs       = float(transport.get("duration_min", 0) or 0) / 60.0
        remaining_budget = user.budget_egp - total_cost - total_transport

        if not is_liked and float(att["price_avg"]) > remaining_budget:
            log.skip(att["name"], f"over budget ({att['price_avg']:.0f} EGP, {remaining_budget:.0f} left)", verbosity=2)
            continue
        if time_left() <= travel_hrs:
            log.skip(att["name"], "not enough time left to travel", verbosity=2)
            continue

        # ── Opening-hours enforcement ───────────────────────────────────────────
        arrival_hr = curr_hr + travel_hrs
        open_hr    = float(att.get("open_hour", 0))
        close_hr   = float(att.get("close_hour", 24))
        if arrival_hr < open_hr:
            reason = f"arrives {_fmt(arrival_hr)}, opens {_fmt(open_hr)}"
            log.skip(att["name"], reason)
            if is_liked and att not in _open_wait:
                _open_wait.append(att)
                log.info("LIKED", f"'{att['name']}' parked — will retry after next visit (opens {_fmt(open_hr)})", verbosity=1)
            continue
        if arrival_hr >= close_hr - MIN_VISIT_HRS:
            reason = f"arrives {_fmt(arrival_hr)}, closes {_fmt(close_hr)}"
            log.skip(att["name"], reason)
            if is_liked: log.warn("LIKED", f"'{att['name']}' skipped — {reason}")
            continue

        raw_dur          = max(float(att["avg_visit_hrs"]), MIN_VISIT_HRS)
        time_until_close = close_hr - arrival_hr
        dur = min(raw_dur, max(0.0, time_left() - travel_hrs), time_until_close)
        if dur < MIN_VISIT_HRS:
            reason = "can't fit minimum visit time"
            log.skip(att["name"], reason, verbosity=2)
            if is_liked: log.warn("LIKED", f"'{att['name']}' skipped — {reason}")
            continue
        if not is_liked and dur < raw_dur * 0.70:
            log.skip(att["name"], f"needs {raw_dur}h, only {dur:.2f}h available (70% rule)")
            continue
        if is_liked and dur < MIN_VISIT_HRS:
            reason = f"can't fit even {MIN_VISIT_HRS}h"
            log.skip(att["name"], reason)
            log.warn("LIKED", f"'{att['name']}' skipped — {reason}")
            continue

        # ── Accepted — log the route hop ────────────────────────────────────────
        log.hop(_fmt(curr_hr), att["name"],
                transport["distance_km"], transport["duration_min"],
                transport["mode"], _fmt(arrival_hr), open_hr, close_hr)

        effective_cost = float(att["price_avg"])

        itinerary.append({
            "time":           _fmt(curr_hr + travel_hrs),
            "departure_time": _fmt(curr_hr),
            "type":           "Attraction",
            "name":           att["name"],
            "id":             att["attraction_id"],
            "latitude":       att["latitude"],
            "longitude":      att["longitude"],
            "cosine_sim":     round(float(att.get("cosine_sim", 0)), 3),
            "final_score":    round(float(att.get("final_score", 0)), 3),
            "duration_hrs":   round(dur, 2),
            "travel_duration_min": transport.get("duration_min", 0),
            "cost_egp":       effective_cost,
            "distance_km":    transport["distance_km"],
            "transport":      transport,
            "transport_cost": transport_cost,
            "address":        att.get("address", ""),
            "description":    att.get("description", ""),
            "categories":     att["categories"],
            "crowd_label":    att.get("crowd_label", ""),
            "crowd_pattern":  att.get("crowd_pattern", ""),
            "rating":         att.get("avg_rating", 0),
            "open":           att.get("open_hour", 0),
            "close":          att.get("close_hour", 24),
            "image_url":      str(att.get("primary_image") or ""),
            "price_from":     float(att.get("price_min", 0)),
            "directions_url": transport.get("directions_url", ""),
            "osm_url":        osm_maps_url(att["latitude"], att["longitude"], att["name"]),
            "detour_note":    att.get("detour_note", ""), 
        })
        visited_today.append(att["attraction_id"])
        prev_lat        = att["latitude"]
        prev_lon        = att["longitude"]
        curr_hr        += travel_hrs + dur
        total_cost     += effective_cost
        total_transport += transport_cost
        total_dist     += transport["distance_km"]
        last_stop_type  = "attraction"

        if att_cats & BEACH_CATS:
            beach_added = True
        if att_cats & MALL_CATS:
            mall_added = True
        
        # Rebuild queue dynamically from current position
        _queue_ref[0] = _build_queue(
            prev_lat, prev_lon,
            set(str(v) for v in visited_today)
        )
        # Re-inject any parked liked places back into consideration
        for _w in list(_open_wait):
            if curr_hr >= float(_w.get("open_hour", 0)):
                _queue_ref[0].appendleft(_w)
                _open_wait.remove(_w)
                log.info("LIKED", f"'{_w['name']}' now open — back in queue", verbosity=1)


# ── Last-day global fallback ────────────────────────────────────────────────
    # On the final day, if time remains and attractions are sparse, expand to the
    # full city pool — there are no future days to protect, so cluster radius
    # restrictions no longer apply.
    att_count  = sum(1 for s in itinerary if s["type"] == "Attraction")
    is_last_day = (day_index == n_days - 1)

    if time_left() > 1.5 and (att_count < 5 or is_last_day):
        already_in = {str(s["id"]) for s in itinerary}

        if is_last_day:
            # Use full city pool — no radius cap on last day
            fallback_df = scored[
                ~scored["attraction_id"].astype(str).isin(already_in)
                & ~scored["categories"].apply(
                    lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
                )
            ].copy()
            log.section("ROUTE",
                f"last-day global fill — {time_left():.1f}h left, "
                f"{len(fallback_df)} unvisited attractions citywide")
        else:
            FALLBACK_RADIUS_KM = 6.0
            log.section("ROUTE",
                f"fallback — only {att_count} attraction(s), "
                f"expanding to {FALLBACK_RADIUS_KM:.0f} km around anchor")
            fallback_df = scored[
                ~scored["attraction_id"].astype(str).isin(already_in)
                & ~scored["categories"].apply(
                    lambda cats: bool(cats) and all(c in _FOOD_TAGS for c in cats)
                )
            ].copy()
            if not fallback_df.empty:
                fallback_df["_fb_dist"] = fallback_df.apply(
                    lambda r: _haversine_fallback(
                        _anchor_lat, _anchor_lon,
                        float(r["latitude"]), float(r["longitude"])
                    )["distance_km"],
                    axis=1,
                )
                fallback_df = fallback_df[
                    fallback_df["_fb_dist"] <= FALLBACK_RADIUS_KM
                ].drop(columns=["_fb_dist"])

        if not fallback_df.empty:
            fallback_ordered = nearest_neighbor_route(fallback_df, prev_lat, prev_lon)
            for att in fallback_ordered:
                if time_left() <= 0:
                    break
                if is_last_day and sum(
                    1 for s in itinerary if s["type"] == "Attraction"
                ) >= 7:
                    break  # cap at 7 attractions total on last day
                att_cats = set(att["categories"])
                is_liked = str(att["attraction_id"]) in liked_ids_set
                if att_cats & BEACH_CATS and beach_added and not is_liked: continue
                if att_cats & MALL_CATS  and mall_added  and not is_liked: continue
                if str(att["attraction_id"]) in liked_used_as_meal: continue
                if att_cats & FOOD_CATS and (curr_hr - last_meal_hr) < FOOD_GAP_HRS and not is_liked: continue
                transport      = get_transport_info(
                    prev_lat, prev_lon,
                    att["latitude"], att["longitude"],
                    dest_name=att["name"], city=user.city)
                transport_cost = transport.get("cost_egp", 0)
                travel_hrs     = float(transport.get("duration_min", 0) or 0) / 60.0
                if not is_liked and float(att["price_avg"]) > (
                    user.budget_egp - total_cost - total_transport): continue
                if time_left() <= travel_hrs: continue
                arrival_hr = curr_hr + travel_hrs
                open_hr  = float(att.get("open_hour", 0))
                close_hr = float(att.get("close_hour", 24))
                if arrival_hr < open_hr or arrival_hr >= close_hr - MIN_VISIT_HRS: continue
                raw_dur = max(float(att["avg_visit_hrs"]), MIN_VISIT_HRS)
                dur = min(raw_dur, max(0.0, time_left() - travel_hrs), close_hr - arrival_hr)
                if dur < MIN_VISIT_HRS: continue
                if not is_liked and dur < raw_dur * 0.70: continue
                log.hop(_fmt(curr_hr), att["name"],
                        transport["distance_km"], transport["duration_min"],
                        transport["mode"], _fmt(arrival_hr), open_hr, close_hr)
                itinerary.append({
                    "time": _fmt(curr_hr + travel_hrs), "departure_time": _fmt(curr_hr),
                    "type": "Attraction", "name": att["name"], "id": att["attraction_id"],
                    "latitude": att["latitude"], "longitude": att["longitude"],
                    "cosine_sim": round(float(att.get("cosine_sim", 0)), 3),
                    "final_score": round(float(att.get("final_score", 0)), 3),
                    "duration_hrs": round(dur, 2),
                    "travel_duration_min": transport.get("duration_min", 0),
                    "cost_egp": float(att["price_avg"]),
                    "distance_km": transport["distance_km"],
                    "transport": transport, "transport_cost": transport_cost,
                    "address": att.get("address", ""), "description": att.get("description", ""),
                    "categories": att["categories"], "crowd_label": att.get("crowd_label", ""),
                    "crowd_pattern": att.get("crowd_pattern", ""), "rating": att.get("avg_rating", 0),
                    "open": att.get("open_hour", 0), "close": att.get("close_hour", 24),
                    "image_url": str(att.get("primary_image") or ""),
                    "price_from": float(att.get("price_min", 0)),
                    "directions_url": transport.get("directions_url", ""),
                    "osm_url": osm_maps_url(att["latitude"], att["longitude"], att["name"]),
                    "detour_note": att.get("detour_note", ""),
                })
                already_in.add(str(att["attraction_id"]))
                visited_today.append(att["attraction_id"])
                prev_lat = att["latitude"]; prev_lon = att["longitude"]
                curr_hr += travel_hrs + dur
                total_cost += float(att["price_avg"])
                total_transport += transport_cost
                total_dist += transport["distance_km"]
                last_stop_type = "attraction"
                if att_cats & BEACH_CATS: beach_added = True
                if att_cats & MALL_CATS:  mall_added  = True

    # ── Post-loop: fire any meal windows not yet reached by the attraction loop ─
    if include_breakfast and not breakfast_done and curr_hr <= BREAKFAST_CLOSE:
        if not try_liked_meal("breakfast", 0.5):
            add_meal("breakfast", prev_lat, prev_lon, 0.5,
                     dest_lat=_anchor_lat, dest_lon=_anchor_lon)
        breakfast_done = True

    lunch_added_post = False
    if include_lunch and not lunch_done and time_left() >= 1.0:
        if not try_liked_meal("lunch", 0.75):
            add_meal("lunch", prev_lat, prev_lon, 0.75)
        lunch_done = True
        lunch_added_post = True

    if include_dinner and not dinner_done and not lunch_added_post and time_left() >= 1.0:
        if not try_liked_meal("dinner", 1.0):
            add_meal("dinner", prev_lat, prev_lon, 1.0)
        dinner_done = True

    # ── Missed liked places ─────────────────────────────────────────────────────
    added_ids = {str(s["id"]) for s in itinerary} | {str(v) for v in user.visited_ids}
    missed_liked_places = []
    for lid in [str(x) for x in user.liked_ids]:
        if lid in added_ids:
            continue
        row = df[df["attraction_id"].astype(str) == lid]
        if row.empty:
            missed_liked_places.append({
                "id": lid, "name": f"Unknown ({lid})",
                "reason": "not_in_db",
                "message": f"Liked place '{lid}' was not found in the database.",
            })
            continue
        name     = row.iloc[0]["name"]
        att_city = str(row.iloc[0]["city"]).strip().lower()
        if att_city != user.city:
            missed_liked_places.append({
                "id": lid, "name": name,
                "reason": "city_mismatch",
                "message": (
                    f"{name} is in '{att_city}', not '{user.city}' "
                    "— it doesn't apply to this trip."
                ),
            })
        else:
            missed_liked_places.append({
                "id": lid, "name": name,
                "reason": "not_scheduled",
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

    att_stops  = [s for s in itinerary if s["type"] == "Attraction"]
    meal_stops = [s for s in itinerary if s["type"] not in ("Attraction",)]

    stats_dict = {
        "total_hours":            round(total_hrs, 1),
        "total_distance_km":      round(total_dist, 1),
        "cost_attractions_meals": round(total_cost, 0),
        "cost_transport_egp":     round(total_transport, 0),
        "total_cost_egp":         round(total_all, 0),
        "budget_remaining":       round(user.budget_egp - total_all, 0),
    }
    log.summary(day_index, n_days, att_stops, meal_stops, missed_liked_places, stats_dict)

    if day_index == n_days - 1 and liked_ids_set:
        truly_missed = [p for p in missed_liked_places if p.get("reason") == "not_scheduled"]
        cg = log._c(log._GRN, log._BLD)
        co = log._c(log._ORG, log._BLD)
        r  = log._r()
        if not truly_missed:
            print(f"  {cg}[OK] All liked places were included across the trip.{r}\n")
        else:
            names = ", ".join(p["name"] for p in truly_missed)
            print(f"  {co}[MISSED] {len(truly_missed)} liked place(s) could not be scheduled: {names}{r}\n")

    return {
        "user":                    user.name,
        "city":                    user.city,
        "recommended_attractions": ranked,
        "itinerary":               itinerary,
        "missed_liked_places":     missed_liked_places,
        "cluster_ids":             list(cluster_ids),
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
# 10. REGRESSION TESTS
# ─────────────────────────────────────────────────────────────────────────────
def test_liked_validation(df: pd.DataFrame, att_matrix: np.ndarray) -> None:
    """
    Verifies the liked-ID validation pipeline end-to-end.

    Assertions
    ----------
    1. liked_ids=['ATT087','ATT102'] in Alexandria → forced list is exactly
       {'ATT087','ATT102'} (Corniche Alexandria + Montaza Royal Gardens).
    2. Adding ATT065 (Giftun Island, Hurghada) → it is rejected; forced list
       stays {'ATT087','ATT102'}.
    3. An ID that doesn't exist in the DB at all → rejected.
    4. is_forced column in score_all_attractions output reflects exactly the
       validated set — no more, no less.
    """
    city = "alexandria"

    # ── Test 1 & 4: both valid Alexandria IDs ────────────────────────────────
    valid = _validate_liked_ids(["ATT087", "ATT102"], df, city)
    assert set(valid) == {"ATT087", "ATT102"}, (
        f"[TEST FAIL] Expected {{'ATT087','ATT102'}}, got {set(valid)}"
    )

    user = UserProfile(
        user_id="TEST", name="Test", city=city,
        preferred_categories=["outdoor", "historical"],
        budget_egp=1000, available_hours=8,
        current_lat=31.2001, current_lon=29.9187,
        liked_ids=["ATT087", "ATT102"], visited_ids=[],
    )
    scored = score_all_attractions(user, df, att_matrix)
    forced_ids = set(scored[scored["is_forced"]]["attraction_id"].astype(str).tolist())
    assert forced_ids == {"ATT087", "ATT102"}, (
        f"[TEST FAIL] is_forced mismatch: expected {{'ATT087','ATT102'}}, got {forced_ids}"
    )

    # ── Test 2: cross-city ID is rejected ────────────────────────────────────
    valid2 = _validate_liked_ids(["ATT087", "ATT102", "ATT065"], df, city)
    assert "ATT065" not in valid2, (
        "[TEST FAIL] ATT065 (Giftun Island / Hurghada) should be rejected for alexandria"
    )
    assert set(valid2) == {"ATT087", "ATT102"}, (
        f"[TEST FAIL] After cross-city rejection, expected {{'ATT087','ATT102'}}, got {set(valid2)}"
    )

    # ── Test 3: unknown ID is rejected ───────────────────────────────────────
    valid3 = _validate_liked_ids(["ATT087", "ATT_DOES_NOT_EXIST"], df, city)
    assert "ATT_DOES_NOT_EXIST" not in valid3, (
        "[TEST FAIL] Non-existent ID should be rejected"
    )
    assert "ATT087" in valid3, "[TEST FAIL] Valid ID dropped alongside unknown one"

    print("[TEST] test_liked_validation PASSED — forced list matches exactly {'ATT087','ATT102'}")


# ─────────────────────────────────────────────────────────────────────────────
# 11. DEMO
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":

    print("Loading database...")
    df         = load_attractions()
    att_matrix = build_attraction_matrix(df)
    print(f"Loaded {len(df)} attractions | {N_DIMS}-dim vector space\n")

    print("Running regression tests...")
    test_liked_validation(df, att_matrix)
    print()

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
