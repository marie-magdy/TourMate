"""
TourMate Recommendation Engine
================================
Uses content-based filtering with Cosine Similarity (scikit-learn)
as specified in the TourMate thesis, Chapter 7.

How cosine similarity works here:
  - Every attraction is converted into a 29-dimension vector
    (one dimension per category tag, 1.0 = has it, 0.0 = doesnt)
  - The user's preferences are also converted into the same vector space
  - cosine_similarity(user_vector, attraction_vector) gives a score 0-1
  - 1.0 = perfect match, 0.0 = nothing in common

Additional signals layered on top of cosine score:
  - Price feasibility  (can user afford it?)
  - Popularity boost   (well-known spots ranked higher)
  - Liked bonus        (user previously liked similar spots)
  - Crowd penalty      (if user dislikes crowds)
  - Hidden gem bonus   (low-crowd spots get a small boost)

Modules:
  1. Data loading & preprocessing
  2. Vector builder (user + attractions -> numpy arrays)
  3. Cosine similarity scoring
  4. Routing client (Google Maps / ORS / haversine fallback)
  5. Haversine distance + walking check
  6. Meal recommendation (proximity-based)
  7. Route optimiser (nearest-neighbour TSP)
  8. Full itinerary builder
  9. Pretty printer
  10. Demo runner
"""

import math
import time
import urllib.request
import urllib.parse
import json
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from sklearn.metrics.pairwise import cosine_similarity

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
DATA_PATH = "TourMate_Database_Tables.xlsx"

# All 29 unique category tags from the database (defines vector dimensions)
ALL_CATEGORIES = [
    "ancient", "bakery", "beach", "cafe", "coastal", "cultural",
    "dessert", "experience", "family", "food", "grills", "historical",
    "indoor", "international", "landmark", "local", "mall", "modern",
    "museum", "nature", "nile view", "outdoor", "park", "religious",
    "restaurant", "seafood", "shopping", "viewpoint", "waterfront",
]
CAT_INDEX = {cat: i for i, cat in enumerate(ALL_CATEGORIES)}
N_DIMS    = len(ALL_CATEGORIES)   # 29

# Scoring weights (must sum to 1.0)
W_COSINE     = 0.60   # cosine similarity between user prefs & attraction
W_POPULARITY = 0.20   # popularity score (0-1) from database
W_RATING     = 0.10   # avg rating normalised to 0-1
W_PRICE      = 0.10   # price affordability score (0-1)

# Bonus / penalty modifiers (applied after weighted sum)
LIKED_BONUS   = 0.15
CROWD_PENALTY = {"Very High": 0.12, "High": 0.05, "Moderate": 0.00, "Low": 0.00}
HIDDEN_GEM_BONUS = 0.05

WALKING_KM     = 0.8    # <= this -> Walk
MAYBE_KM       = 2.0    # <= this -> Walk or Taxi
COFFEE_GAP_HRS = 1.5    # suggest coffee if previous attraction took >= this long

# ── Transport pricing (Egyptian market rates, 2024-2025) ──────────────────────
# Taxi (metered/negotiated on the street)
TAXI_BASE_EGP    = 15    # base/flag-fall fare
TAXI_PER_KM_LOW  = 8     # lower bound per km
TAXI_PER_KM_HIGH = 12    # upper bound per km

# Uber/Careem (app-based, slightly pricier but more reliable)
UBER_BASE_EGP    = 20    # base fare
UBER_PER_KM_LOW  = 11    # lower bound per km
UBER_PER_KM_HIGH = 15    # upper bound per km

# Walking is always free
WALK_COST_EGP    = 0

# ── Routing API config ────────────────────────────────────────────────────────
# Set one of these keys to enable real street distances.
# Leave both empty ("") to use the haversine + road-factor fallback.

# Option A: Google Maps Distance Matrix API
#   Get key: https://console.cloud.google.com  → Maps → Distance Matrix API
#   Free credit: $200/month (~40,000 elements free)
GOOGLE_MAPS_API_KEY = ""   # e.g. "AIzaSy..."

# Option B: OpenRouteService (ORS) — completely free, 2 000 req/day
#   Get key: https://openrouteservice.org/dev/#/signup
ORS_API_KEY = ""           # e.g. "5b3ce3..."

# Which provider to use: "google" | "ors" | "haversine"
# "haversine" skips all API calls and uses the road-factor approximation.
ROUTING_PROVIDER = "haversine"   # change to "google" or "ors" once you have a key


# ─────────────────────────────────────────────────────────────────────────────
# 4. ROUTING CLIENT
# ─────────────────────────────────────────────────────────────────────────────
class RoutingClient:
    """
    Fetches real street distances and driving durations.

    Priority:
      1. Google Maps Distance Matrix API  (most accurate for Egypt)
      2. OpenRouteService (ORS)           (free, OpenStreetMap-based)
      3. Haversine × road factor          (offline fallback, always works)

    Usage:
      client = RoutingClient()

      # Single pair
      km, mins = client.get(origin_lat, origin_lon, dest_lat, dest_lon)

      # Full matrix — one API call for N×N pairs (use before route optimisation)
      matrix = client.get_matrix([(lat, lon), ...])
      # matrix[i][j] = (km, mins) from point i to point j
    """

    def __init__(self):
        self._cache: dict = {}   # (lat1,lon1,lat2,lon2) -> (km, mins)

    # ── public interface ──────────────────────────────────────────────────────

    def get(self, lat1: float, lon1: float, lat2: float, lon2: float,
            city: str = "Cairo") -> tuple[float, float]:
        """
        Return (road_km, drive_minutes) between two points.
        Results are cached so repeated calls are free.
        """
        key = (round(lat1, 6), round(lon1, 6), round(lat2, 6), round(lon2, 6))
        if key in self._cache:
            return self._cache[key]

        if ROUTING_PROVIDER == "google" and GOOGLE_MAPS_API_KEY:
            result = self._google_single(lat1, lon1, lat2, lon2)
        elif ROUTING_PROVIDER == "ors" and ORS_API_KEY:
            result = self._ors_single(lat1, lon1, lat2, lon2)
        else:
            result = self._haversine_fallback(lat1, lon1, lat2, lon2, city)

        self._cache[key] = result
        return result

    def get_matrix(self, points: list[tuple[float, float]],
                   city: str = "Cairo") -> list[list[tuple[float, float]]]:
        """
        Return an N×N matrix where matrix[i][j] = (km, minutes) from
        points[i] to points[j].

        Makes a single batched API call when possible.
        """
        if ROUTING_PROVIDER == "google" and GOOGLE_MAPS_API_KEY:
            return self._google_matrix(points)
        if ROUTING_PROVIDER == "ors" and ORS_API_KEY:
            return self._ors_matrix(points, city)

        # Haversine fallback — compute all pairs locally
        matrix = []
        for la1, lo1 in points:
            row = []
            for la2, lo2 in points:
                row.append(self._haversine_fallback(la1, lo1, la2, lo2, city))
            matrix.append(row)
        return matrix

    # ── Google Maps ───────────────────────────────────────────────────────────

    def _google_single(self, lat1, lon1, lat2, lon2) -> tuple[float, float]:
        """One origin → one destination via Distance Matrix API."""
        return self._google_matrix_raw(
            origins=f"{lat1},{lon1}",
            destinations=f"{lat2},{lon2}",
        )[0][0]

    def _google_matrix(self, points: list[tuple]) -> list[list[tuple]]:
        """
        Batch all points as both origins and destinations.
        Google allows up to 25 origins × 25 destinations per request.
        We chunk if needed.
        """
        chunk = 25
        n = len(points)
        result = [[None] * n for _ in range(n)]

        for i_start in range(0, n, chunk):
            i_end = min(i_start + chunk, n)
            origins_str = "|".join(f"{la},{lo}" for la, lo in points[i_start:i_end])

            for j_start in range(0, n, chunk):
                j_end = min(j_start + chunk, n)
                dests_str = "|".join(f"{la},{lo}" for la, lo in points[j_start:j_end])

                block = self._google_matrix_raw(origins_str, dests_str)
                for ri, i in enumerate(range(i_start, i_end)):
                    for rj, j in enumerate(range(j_start, j_end)):
                        result[i][j] = block[ri][rj]
                        self._cache[self._key(points[i], points[j])] = block[ri][rj]

        return result

    def _google_matrix_raw(self, origins: str, destinations: str
                           ) -> list[list[tuple[float, float]]]:
        """
        Call the Google Maps Distance Matrix API and parse the response.
        Returns a 2-D list of (km, minutes).
        Falls back to haversine if the API call fails.
        """
        params = urllib.parse.urlencode({
            "origins":      origins,
            "destinations": destinations,
            "mode":         "driving",
            "units":        "metric",
            "key":          GOOGLE_MAPS_API_KEY,
        })
        url = f"https://maps.googleapis.com/maps/api/distancematrix/json?{params}"
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"[RoutingClient] Google API error: {e} — using fallback")
            return self._fallback_block(origins, destinations)

        if data.get("status") != "OK":
            print(f"[RoutingClient] Google API status={data.get('status')} — using fallback")
            return self._fallback_block(origins, destinations)

        rows_out = []
        for row in data["rows"]:
            cols_out = []
            for el in row["elements"]:
                if el["status"] == "OK":
                    km   = el["distance"]["value"] / 1000.0
                    mins = el["duration"]["value"] / 60.0
                else:
                    km, mins = 0.0, 0.0
                cols_out.append((round(km, 3), round(mins, 1)))
            rows_out.append(cols_out)
        return rows_out

    # ── OpenRouteService ──────────────────────────────────────────────────────

    def _ors_single(self, lat1, lon1, lat2, lon2) -> tuple[float, float]:
        """One origin → one destination via ORS Directions API."""
        url = "https://api.openrouteservice.org/v2/directions/driving-car"
        body = json.dumps({
            "coordinates": [[lon1, lat1], [lon2, lat2]]   # ORS uses [lon, lat]
        }).encode()
        req = urllib.request.Request(
            url, data=body,
            headers={"Authorization": ORS_API_KEY,
                     "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
            seg = data["routes"][0]["summary"]
            km   = seg["distance"] / 1000.0
            mins = seg["duration"] / 60.0
            return round(km, 3), round(mins, 1)
        except Exception as e:
            print(f"[RoutingClient] ORS single error: {e} — using fallback")
            return self._haversine_fallback(lat1, lon1, lat2, lon2)

    def _ors_matrix(self, points: list[tuple], city: str = "Cairo") -> list[list[tuple]]:
        """
        ORS Matrix API: up to 3 500 source-destination pairs per request.
        Returns N×N (km, minutes).
        """
        coords = [[lo, la] for la, lo in points]   # ORS: [lon, lat]
        body = json.dumps({
            "locations": coords,
            "metrics":   ["distance", "duration"],
            "units":     "km",
        }).encode()
        req = urllib.request.Request(
            "https://api.openrouteservice.org/v2/matrix/driving-car",
            data=body,
            headers={"Authorization": ORS_API_KEY,
                     "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            dist_m  = data["distances"]   # km (because units=km)
            dur_s   = data["durations"]   # seconds
            n = len(points)
            matrix = []
            for i in range(n):
                row = []
                for j in range(n):
                    km   = round(dist_m[i][j], 3)
                    mins = round(dur_s[i][j] / 60.0, 1)
                    result = (km, mins)
                    row.append(result)
                    self._cache[self._key(points[i], points[j])] = result
                matrix.append(row)
            return matrix
        except Exception as e:
            print(f"[RoutingClient] ORS matrix error: {e} — using fallback")
            # Haversine fallback — compute all pairs locally
            return [
                [self._haversine_fallback(la1, lo1, la2, lo2, city)
                 for la2, lo2 in points]
                for la1, lo1 in points
            ]

    # ── Haversine fallback ────────────────────────────────────────────────────

    def _haversine_fallback(self, lat1, lon1, lat2, lon2,
                            city: str = "Cairo") -> tuple[float, float]:
        """Straight-line × road factor → estimated road km + drive time."""
        h_km    = haversine(lat1, lon1, lat2, lon2)
        road_km = road_distance(h_km, city)
        # 25 km/h average city speed
        mins    = round((road_km / 25.0) * 60.0, 1)
        return round(road_km, 3), mins

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _key(p1: tuple, p2: tuple):
        return (round(p1[0], 6), round(p1[1], 6), round(p2[0], 6), round(p2[1], 6))

    def _fallback_block(self, origins_str: str, destinations_str: str
                        ) -> list[list[tuple[float, float]]]:
        """Parse lat/lon strings and compute haversine block for error recovery."""
        def parse(s):
            return [tuple(float(v) for v in p.split(",")) for p in s.split("|")]
        origins = parse(origins_str)
        dests   = parse(destinations_str)
        return [
            [self._haversine_fallback(la1, lo1, la2, lo2) for la2, lo2 in dests]
            for la1, lo1 in origins
        ]


# Module-level singleton — shared across all itinerary builds in one session
_routing = RoutingClient()


# ─────────────────────────────────────────────────────────────────────────────
# 1. DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────
def load_attractions(path: str = DATA_PATH) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Attractions", header=2)
    df.columns = [c.strip().replace("\n", " ") for c in df.columns]
    df = df.rename(columns={
        "avg_rating (0-5)":                    "avg_rating",
        "popularity (0-1)":                    "popularity",
        "price_range (tier | min-max EGP)":    "price_range",
        "price_range (tier | min\u2013max EGP)": "price_range",
        "crowd_pattern (weekday/weekend)":     "crowd_pattern",
    })
    # handle the en-dash in column name
    df.columns = [c.replace("\u2013", "-") for c in df.columns]
    if "price_range (tier | min-max EGP)" in df.columns:
        df = df.rename(columns={"price_range (tier | min-max EGP)": "price_range"})

    df = df.dropna(subset=["attraction_id"]).reset_index(drop=True)

    # Categories -> list
    df["categories"] = df["categories"].fillna("").apply(
        lambda x: [c.strip().lower() for c in str(x).split(",") if c.strip()]
    )

    # Meal slot -> list
    df["meal_slot"] = df["meal_slot"].fillna("N/A").apply(
        lambda x: [s.strip().lower() for s in str(x).split(",")
                   if s.strip() not in ("", "N/A", "nan")]
    )

    for col in ["admission_egp", "avg_rating", "popularity",
                "total_reviews", "avg_visit_hrs", "latitude", "longitude"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Parse price_range -> price_avg
    def parse_price(s):
        s = str(s)
        if "Free" in s:
            return 0.0, 0.0
        try:
            part = s.split("|")[-1].replace("EGP", "").strip()
            sep = "-" if "-" in part else "\u2013"
            if sep in part:
                lo, hi = part.split(sep)
                return float(lo.strip()), float(hi.strip())
            v = float(part)
            return v, v
        except Exception:
            return 0.0, 0.0

    df[["price_min", "price_max"]] = df["price_range"].apply(
        lambda x: pd.Series(parse_price(x))
    )
    df["price_avg"] = (df["price_min"] + df["price_max"]) / 2.0
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2. VECTOR BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def build_category_vector(categories: list) -> np.ndarray:
    """
    Convert a list of category tags into a 29-dim binary vector.

    Example:
      ["historical", "outdoor", "ancient"]
      -> index 0 (ancient)=1, index 11 (historical)=1, index 21 (outdoor)=1
      -> [1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]
    """
    vec = np.zeros(N_DIMS, dtype=float)
    for cat in categories:
        if cat in CAT_INDEX:
            vec[CAT_INDEX[cat]] = 1.0
    return vec


def build_attraction_matrix(df: pd.DataFrame) -> np.ndarray:
    """
    Build an (87 x 29) matrix - one row per attraction.
    Built once at startup, reused for all similarity calculations.
    """
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
    dislikes_crowds:      bool  = False
    meal_budget_ratio:    float = 0.25
    accessibility_needs:  str   = "None"

    @property
    def meal_budget(self):
        return self.budget_egp * self.meal_budget_ratio

    @property
    def attraction_budget(self):
        return self.budget_egp * (1 - self.meal_budget_ratio)

    def to_vector(self) -> np.ndarray:
        """Convert preferred_categories into a 29-dim vector."""
        return build_category_vector(self.preferred_categories)


# ─────────────────────────────────────────────────────────────────────────────
# 4. COSINE SIMILARITY SCORING
# ─────────────────────────────────────────────────────────────────────────────
def compute_cosine_scores(user: UserProfile, att_matrix: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between user vector and every attraction.

    Math:
      cosine_similarity(A, B) = (A . B) / (||A|| * ||B||)

    sklearn expects 2D input:
      user_vec  shape: (1, 29)
      att_matrix shape: (87, 29)
      output shape: (1, 87) -> flattened to (87,)
    """
    user_vec = user.to_vector().reshape(1, -1)        # (1, 29)
    scores   = cosine_similarity(user_vec, att_matrix) # (1, 87)
    return scores.flatten()                            # (87,)


def score_all_attractions(
    user: UserProfile,
    df: pd.DataFrame,
    att_matrix: np.ndarray,
) -> pd.DataFrame:
    """
    Score every attraction for this user.

    Final score =
      0.60 * cosine_similarity   <- primary: how well categories match
    + 0.20 * popularity          <- secondary: is it well-known?
    + 0.10 * (rating / 5)        <- tertiary: is it highly rated?
    + 0.10 * price_score         <- can the user afford it?
    + 0.15  [if in liked_ids]    <- bonus: user liked it before
    - penalty [if dislikes crowds]
    + 0.05  [if crowd == Low]    <- hidden gem bonus
    """
    scored = df.copy()

    # A: Cosine similarity
    scored["cosine_sim"] = compute_cosine_scores(user, att_matrix)

    # B: Price score (0-1)
    # For LOW budget users  → cheaper is better (penalise expensive)
    # For HIGH budget users → pricier places score higher (reward premium)
    # Budget tiers: low < 500 EGP, mid 500-1500, high > 1500
    def price_score(row):
        p = row["price_avg"]
        b = user.attraction_budget
        if p > b:  return 0.0   # can never afford → always 0
        if p == 0: return 0.8   # free is good, but not perfect for high-budget users
        ratio = p / b           # 0 = very cheap relative to budget, 1 = at budget limit
        if b >= 1500:
            # High budget: reward places closer to their budget ceiling
            # e.g. GEM (450 EGP) scores higher than a 10 EGP mosque for a 2000 EGP budget user
            return 0.4 + (0.6 * ratio)
        elif b >= 500:
            # Mid budget: neutral — slight preference for mid-range
            return 1.0 - (0.5 * ratio)
        else:
            # Low budget: cheaper is better
            return 1.0 - ratio
    scored["price_score"] = scored.apply(price_score, axis=1)

    # C: Rating normalised
    scored["rating_norm"] = scored["avg_rating"] / 5.0

    # D: Weighted base score
    scored["base_score"] = (
        W_COSINE     * scored["cosine_sim"]
      + W_POPULARITY * scored["popularity"]
      + W_RATING     * scored["rating_norm"]
      + W_PRICE      * scored["price_score"]
    )

    # E: Bonuses & penalties
    def adjust(row):
        s = row["base_score"]
        if row["attraction_id"] in user.liked_ids:
            s += LIKED_BONUS
        if user.dislikes_crowds:
            s -= CROWD_PENALTY.get(str(row.get("crowd_label", "")), 0.0)
        if str(row.get("crowd_label", "")) == "Low":
            s += HIDDEN_GEM_BONUS
        return round(max(0.0, s), 4)

    scored["final_score"] = scored.apply(adjust, axis=1)

    # F: Filter
    food_tags = {"restaurant", "cafe", "food", "bakery", "dessert"}
    is_food = scored["categories"].apply(
        lambda cats: any(c in food_tags for c in cats)
    )
    filtered = scored[
        (scored["city"] == user.city)
      & (~scored["attraction_id"].isin(user.visited_ids))
      & (~is_food)
      & (scored["price_avg"] <= user.attraction_budget)
      & (scored["cosine_sim"] > 0)
    ].copy()

    filtered = filtered.sort_values("final_score", ascending=False).reset_index(drop=True)

    # ONE BEACH PER DAY RULE
    # Keep only the highest-scoring beach/coastal attraction
    # Users spend hours at one beach — they don't hop between beaches
    beach_tags = {"beach", "coastal"}
    is_beach = filtered["categories"].apply(lambda cats: any(c in beach_tags for c in cats))
    beach_indices = filtered[is_beach].index.tolist()
    if len(beach_indices) > 1:
        filtered = filtered.drop(beach_indices[1:]).reset_index(drop=True)

    # ONE MALL PER DAY RULE
    # Keep only the highest-scoring mall/shopping attraction
    # No point visiting two malls in one day
    mall_tags = {"mall", "shopping"}
    is_mall = filtered["categories"].apply(lambda cats: any(c in mall_tags for c in cats))
    mall_indices = filtered[is_mall].index.tolist()
    if len(mall_indices) > 1:
        filtered = filtered.drop(mall_indices[1:]).reset_index(drop=True)

    return filtered


# ─────────────────────────────────────────────────────────────────────────────
# 5. DISTANCE & WALKING
# ─────────────────────────────────────────────────────────────────────────────
def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Road correction factors: haversine gives straight-line distance.
# Real road distance in city is longer due to turns, one-way streets etc.
# Cairo roads are more winding → factor 1.35 | Alexandria coastline → factor 1.20
ROAD_FACTOR_CAIRO = 1.35
ROAD_FACTOR_ALEX  = 1.20

def road_distance(haversine_km: float, city: str = "Cairo") -> float:
    """Convert straight-line haversine distance to estimated road distance."""
    factor = ROAD_FACTOR_CAIRO if city == "Cairo" else ROAD_FACTOR_ALEX
    return haversine_km * factor

def calc_transport_cost(road_km: float) -> dict:
    """
    Estimate taxi and Uber cost ranges for a given road distance.

    Taxi  (street-hailed): base 15 EGP + 8–12 EGP/km
    Uber/Careem (app):     base 20 EGP + 11–15 EGP/km

    Returns low and high estimates for each to give the user a range.
    """
    taxi_low  = round(TAXI_BASE_EGP + road_km * TAXI_PER_KM_LOW)
    taxi_high = round(TAXI_BASE_EGP + road_km * TAXI_PER_KM_HIGH)
    uber_low  = round(UBER_BASE_EGP + road_km * UBER_PER_KM_LOW)
    uber_high = round(UBER_BASE_EGP + road_km * UBER_PER_KM_HIGH)
    return {
        "taxi_low":  taxi_low,
        "taxi_high": taxi_high,
        "uber_low":  uber_low,
        "uber_high": uber_high,
        # Mid-point used for budget deduction
        "taxi_mid":  round((taxi_low + taxi_high) / 2),
        "uber_mid":  round((uber_low + uber_high) / 2),
        # Cheapest option mid-point (always taxi)
        "cheapest_mid": round((taxi_low + taxi_high) / 2),
    }


def walking_status(dist_km: float, city: str = "Cairo",
                   real_road_km: float = None,
                   real_drive_mins: float = None) -> dict:
    """
    Returns transport mode, time estimates, and cost ranges.

    Modes:
      Walk        — free, under 0.8 km road distance
      Walk or Taxi— user choice, 0.8–2.0 km
      Taxi / Uber — must take transport, over 2.0 km

    Cost is always calculated for taxi + uber regardless of mode.

    Parameters
    ----------
    dist_km        : haversine straight-line distance (used for mode decision
                     when real_road_km is not available)
    real_road_km   : actual street distance from routing API (preferred)
    real_drive_mins: actual driving time from routing API (preferred)
    """
    # Use real road distance if the routing API provided it
    road_km = real_road_km if real_road_km is not None else road_distance(dist_km, city)
    # Walk time always estimated (API gives drive time, not walk time)
    walk_mins = round(road_km / (5 / 60))    # 5 km/h walking
    # Drive time: use real API value if available, else estimate from road_km
    taxi_mins = round(real_drive_mins) if real_drive_mins is not None else round(road_km / (25 / 60))
    costs     = calc_transport_cost(road_km)

    # Mode decision uses road_km (real street distance when API available,
    # otherwise haversine × road factor). Compare directly against thresholds.
    if road_km <= WALKING_KM:
        return {
            "mode":      "Walk",
            "icon":      "🚶",
            "road_km":   round(road_km, 2),
            "walk_mins": walk_mins,
            "taxi_mins": taxi_mins,
            "cost_egp":  0,           # walking is free
            "costs":     costs,
            "tip": (
                f"~{road_km:.1f} km - easy walk (~{walk_mins} min) — FREE  |  Or taxi: {costs['taxi_low']}–{costs['taxi_high']} EGP  |  "
                f"Uber: {costs['uber_low']}–{costs['uber_high']} EGP"
            ),
        }
    if road_km <= MAYBE_KM:
        return {
            "mode":      "Walk or Taxi",
            "icon":      "🚶🚕",
            "road_km":   round(road_km, 2),
            "walk_mins": walk_mins,
            "taxi_mins": taxi_mins,
            "cost_egp":  costs["cheapest_mid"],
            "costs":     costs,
            "tip": (
                f"~{road_km:.1f} km - walk (~{walk_mins} min) FREE  or  Taxi: {costs['taxi_low']}–{costs['taxi_high']} EGP (~{taxi_mins} min)  |  "
                f"Uber: {costs['uber_low']}–{costs['uber_high']} EGP"
            ),
        }
    return {
        "mode":      "Taxi / Uber",
        "icon":      "🚕",
        "road_km":   round(road_km, 2),
        "walk_mins": walk_mins,
        "taxi_mins": taxi_mins,
        "cost_egp":  costs["cheapest_mid"],
        "costs":     costs,
        "tip": (
            f"~{road_km:.1f} km - Taxi: {costs['taxi_low']}–{costs['taxi_high']} EGP "
            f"(~{taxi_mins} min)  |  "
            f"Uber: {costs['uber_low']}–{costs['uber_high']} EGP"
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. MEAL RECOMMENDATION
# ─────────────────────────────────────────────────────────────────────────────
def recommend_meals(df, user, slot, near_lat, near_lon, visited_today, top_n=3):
    """
    Find best meal options near the user's current position.

    Budget tier matching:
      Low  budget (meal/3 < 60 EGP)  → prefer Budget tier restaurants
      Mid  budget (60–150 EGP)        → prefer Mid-range restaurants
      High budget (> 150 EGP)         → prefer Mid-range to Upscale restaurants
                                         actively exclude street food / budget spots
    Sort: budget-tier match first, then proximity, then rating.
    """
    per_meal = max(25.0, user.meal_budget / 3)

    cands = df[
        (df["city"] == user.city)
      & (df["meal_slot"].apply(lambda s: slot in s))
      & (~df["attraction_id"].isin(visited_today))
      & (df["price_avg"] <= per_meal)
    ].copy()

    # If nothing within budget, relax constraint
    if cands.empty:
        cands = df[
            (df["city"] == user.city)
          & (df["meal_slot"].apply(lambda s: slot in s))
          & (~df["attraction_id"].isin(visited_today))
        ].copy()

    # Budget tier preference
    # For high-budget users: penalise very cheap street food
    # so Sequoia/Abou El Sid ranks above Koshary even if Koshary is closer
    def meal_tier_score(row):
        p = row["price_avg"]
        if per_meal >= 150:
            # High budget: reward mid-range to upscale, penalise budget street food
            if p >= 100:   return 1.0   # ideal range
            if p >= 50:    return 0.6   # acceptable
            return         0.2          # too cheap — deprioritise
        elif per_meal >= 60:
            # Mid budget: prefer mid-range
            if 40 <= p <= 200: return 1.0
            return              0.6
        else:
            # Low budget: cheaper is better
            if p <= 80: return 1.0
            return      0.5

    cands["tier_score"] = cands.apply(meal_tier_score, axis=1)

    # Street distance from current location via routing API (or haversine fallback)
    cands["dist_km"], cands["drive_mins"] = zip(*cands.apply(
        lambda r: _routing.get(near_lat, near_lon, r["latitude"], r["longitude"], user.city),
        axis=1,
    ))

    # Normalise distance to 0-1 (closer = higher score)
    max_dist = cands["dist_km"].max()
    cands["prox_score"] = 1 - (cands["dist_km"] / (max_dist + 1e-9))

    # Combined meal score: 50% tier match + 30% proximity + 20% rating
    cands["meal_score"] = (
        0.50 * cands["tier_score"]
      + 0.30 * cands["prox_score"]
      + 0.20 * (cands["avg_rating"] / 5.0)
    )
    cands = cands.sort_values("meal_score", ascending=False)

    results = []
    for _, row in cands.head(top_n).iterrows():
        d     = row["dist_km"]
        dmins = row["drive_mins"]
        results.append({
            "id": row["attraction_id"], "name": row["name"],
            "sub_type": row["sub_type"], "price_range": row["price_range"],
            "price_avg": row["price_avg"], "rating": row["avg_rating"],
            "distance_km": round(d, 2),
            "transport": walking_status(d, user.city,
                                        real_road_km=d, real_drive_mins=dmins),
            "address": row["address"], "crowd_label": row["crowd_label"],
            "lat": row["latitude"], "lon": row["longitude"],
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 7. ROUTE OPTIMISER
# ─────────────────────────────────────────────────────────────────────────────
def optimise_route(top_df, start_lat, start_lon, city: str = "Cairo"):
    """
    Nearest-neighbour TSP: greedily pick next stop balancing
    proximity (60%) and cosine score (40%).

    Uses real street distances from the routing API when available.
    A single matrix call fetches all pairwise distances up front so the
    greedy loop needs zero additional API calls.
    """
    # Build coordinate list: user start + all candidate attractions
    points = [(start_lat, start_lon)] + [
        (row["latitude"], row["longitude"])
        for _, row in top_df.iterrows()
    ]
    # One API call (or haversine) for the full N×N distance matrix
    dist_matrix = _routing.get_matrix(points, city)
    # dist_matrix[i][j] = (km, minutes); index 0 = user start position

    ordered   = []
    remaining = top_df.copy()
    # current position index in dist_matrix (starts at 0 = user location)
    curr_idx  = 0
    # map attraction df index -> dist_matrix index (offset by 1 for user start)
    idx_map   = {df_idx: mat_idx + 1
                 for mat_idx, df_idx in enumerate(top_df.index)}

    while not remaining.empty:
        # Look up pre-computed distances from current position to all remaining stops
        remaining["dist"] = remaining.index.map(
            lambda df_idx: dist_matrix[curr_idx][idx_map[df_idx]][0]  # km
        )
        mx = remaining["dist"].max()
        remaining["prox"] = 1 - remaining["dist"] / (mx + 1e-9)
        remaining["comb"] = 0.60 * remaining["prox"] + 0.40 * remaining["final_score"]
        best_df_idx = remaining["comb"].idxmax()
        best = remaining.loc[best_df_idx]
        ordered.append(best)
        curr_idx  = idx_map[best_df_idx]   # advance current position in matrix
        remaining = remaining.drop(best_df_idx)

    return ordered


# ─────────────────────────────────────────────────────────────────────────────
# 8. ITINERARY BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def build_itinerary(df, att_matrix, user, start_hour=9, top_n=5):
    """
    Full pipeline:
      1. Score via cosine similarity -> filter -> rank
      2. Pick top_n
      3. Order by nearest-neighbour route
      4. Insert meals at right times
      5. Return structured itinerary + stats
    """
    scored = score_all_attractions(user, df, att_matrix)
    if scored.empty:
        return {"error": "No matching attractions found."}

    top     = scored.head(top_n).reset_index(drop=True)
    ordered = optimise_route(top, user.current_lat, user.current_lon, user.city)

    itinerary           = []
    visited_today       = list(user.visited_ids)
    curr_hr             = float(start_hour)
    prev_lat            = user.current_lat
    prev_lon            = user.current_lon
    total_cost          = 0.0    # attractions + meals
    total_transport     = 0.0    # taxi/uber costs
    total_dist          = 0.0
    lunch_done          = False
    dinner_done         = False
    last_stop_type      = None   # track whether last stop was meal or attraction

    def time_left():
        """Hours remaining before available_hours runs out."""
        return user.available_hours - (curr_hr - float(start_hour))

    def add_meal(slot, emoji, nlat, nlon, dur):
        nonlocal curr_hr, prev_lat, prev_lon, total_cost, total_transport, total_dist
        # Skip if not enough time left for this meal
        if time_left() < dur:
            return
        opts = recommend_meals(df, user, slot, nlat, nlon, visited_today)
        if not opts:
            return
        pick = opts[0]
        dist = pick["distance_km"]
        t    = pick["transport"]
        dist_transport_cost = t.get("cost_egp", 0)
        itinerary.append({
            "time":           _fmt(curr_hr),
            "type":           f"{emoji} {slot.capitalize()}",
            "name":           pick["name"],
            "id":             pick["id"],
            "duration_hrs":   dur,
            "cost_egp":       pick["price_avg"],
            "distance_km":    dist,
            "transport":      t,
            "transport_cost": dist_transport_cost,
            "address":        pick["address"],
            "options":        opts,
        })
        visited_today.append(pick["id"])
        prev_lat        = pick["lat"]
        prev_lon        = pick["lon"]
        curr_hr        += dur
        total_cost     += pick["price_avg"]
        total_transport += dist_transport_cost
        total_dist     += dist
        nonlocal last_stop_type
        last_stop_type  = "meal"

    if start_hour <= 10:
        add_meal("breakfast", "🍳", user.current_lat, user.current_lon, 0.5)

    for i, att in enumerate(ordered):
        # Hard stop — no time left at all
        if time_left() <= 0:
            break

        # Lunch — only insert if time allows
        if not lunch_done and curr_hr >= 12.0:
            add_meal("lunch", "🍽", prev_lat, prev_lon, 0.75)
            lunch_done = True

        # Coffee break rules:
        #   1. Previous stop must have been an ATTRACTION (not a meal/breakfast/lunch)
        #   2. That attraction must have been long enough (>= COFFEE_GAP_HRS)
        #   3. Enough time remaining
        prev_was_long_attraction = (
            i > 0
            and last_stop_type == "attraction"
            and float(ordered[i-1]["avg_visit_hrs"]) >= COFFEE_GAP_HRS
        )
        if prev_was_long_attraction:
            add_meal("coffee", "☕", prev_lat, prev_lon, 0.4)

        # Re-check time after meals
        if time_left() <= 0:
            break

        road_km, drive_mins = _routing.get(
            prev_lat, prev_lon, att["latitude"], att["longitude"], user.city
        )
        dist = road_km   # street distance replaces haversine throughout itinerary
        walk = walking_status(dist, user.city,
                              real_road_km=road_km, real_drive_mins=drive_mins)
        # Skip attraction if transport + entry cost would bust remaining budget
        remaining_budget = user.budget_egp - total_cost - total_transport
        transport_cost   = walk.get("cost_egp", 0)
        if (transport_cost + float(att["price_avg"])) > remaining_budget:
            continue
        # Clamp duration to whatever time is left (don't exceed available_hours)
        dur  = min(float(att["avg_visit_hrs"]), time_left())

        itinerary.append({
            "time":           _fmt(curr_hr),
            "type":           "🏛 Attraction",
            "name":           att["name"],
            "id":             att["attraction_id"],
            "cosine_sim":     round(float(att["cosine_sim"]), 3),
            "final_score":    round(float(att["final_score"]), 3),
            "duration_hrs":   round(dur, 2),
            "cost_egp":       float(att["price_avg"]),
            "distance_km":    round(dist, 2),
            "transport":      walk,
            "transport_cost": walk.get("cost_egp", 0),
            "address":        att["address"],
            "categories":     att["categories"],
            "crowd_label":    att["crowd_label"],
            "crowd_pattern":  att["crowd_pattern"],
            "rating":         att["avg_rating"],
            "open":           att["open_hour"],
            "close":          att["close_hour"],
        })
        visited_today.append(att["attraction_id"])
        prev_lat        = att["latitude"]
        prev_lon        = att["longitude"]
        curr_hr        += dur
        total_cost     += float(att["price_avg"])
        total_transport += walk.get("cost_egp", 0)
        total_dist     += dist
        last_stop_type  = "attraction"

    # Dinner — only if trip ends after 18:00 AND time is still available
    if curr_hr >= 18.0 and not dinner_done:
        add_meal("dinner", "🌙", prev_lat, prev_lon, 1.0)

    ranked = [{
        "rank":        i + 1,
        "id":          a["attraction_id"],
        "name":        a["name"],
        "cosine_sim":  round(float(a["cosine_sim"]), 3),
        "final_score": round(float(a["final_score"]), 3),
        "categories":  a["categories"],
        "price_range": a["price_range"],
        "crowd_label": a["crowd_label"],
        "rating":      a["avg_rating"],
    } for i, a in enumerate(ordered)]

    total_hrs        = sum(s["duration_hrs"] for s in itinerary)
    total_all        = total_cost + total_transport
    return {
        "user":                    user.name,
        "city":                    user.city,
        "recommended_attractions": ranked,
        "itinerary":               itinerary,
        "stats": {
            "total_stops":           len(itinerary),
            "total_hours":           round(total_hrs, 1),
            "cost_attractions_meals":round(total_cost, 0),
            "cost_transport_egp":    round(total_transport, 0),
            "total_cost_egp":        round(total_all, 0),
            "total_distance_km":     round(total_dist, 1),
            "budget_remaining":      round(user.budget_egp - total_all, 0),
        },
    }


def _fmt(hour):
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60: h, m = h + 1, 0
    return f"{h:02d}:{m:02d}"


# ─────────────────────────────────────────────────────────────────────────────
# 9. PRETTY PRINTER
# ─────────────────────────────────────────────────────────────────────────────
def print_itinerary(result, user=None):
    if "error" in result:
        print(f"\n  ERROR: {result['error']}\n")
        return
    W = 70
    print("\n" + "=" * W)
    print(f"  TourMate  |  {result['user']}  |  {result['city']}")
    print("=" * W)
    print("\n  Cosine Similarity scores (0-1): how closely categories match")
    print("  Final Score = cosine(60%) + popularity(20%) + rating(10%) + price(10%) +/- bonuses\n")
    print(f"  {'#':<3} {'Name':<30} {'Cosine':<8} {'Final':<8} {'Crowd':<12} Price")
    print("  " + "-" * (W - 2))
    for a in result["recommended_attractions"]:
        print(f"  {a['rank']:<3} {a['name'][:28]:<30} {a['cosine_sim']:<8} "
              f"{a['final_score']:<8} {a['crowd_label']:<12} {a['price_range']}")

    print(f"\n  FULL DAY ITINERARY")
    print("  " + "-" * (W - 2))
    for stop in result["itinerary"]:
        print(f"\n  {stop['time']}  {stop['type']}")
        print(f"  >> {stop['name']}")
        t = stop.get("transport", {})
        print(f"     {t.get('icon','')}  {t.get('tip','')}")
        # Cost line: place cost + transport cost to get there
        t_cost = stop.get("transport_cost", 0)
        t      = stop.get("transport", {})
        costs  = t.get("costs", {})
        line   = f"     Duration: {stop['duration_hrs']}hr   Place cost: {int(stop['cost_egp'])} EGP"
        if "cosine_sim" in stop:
            line += f"   Cosine: {stop['cosine_sim']}  Score: {stop['final_score']}"
        print(line)
        # Show transport cost breakdown (taxi vs uber range)
        if stop.get("distance_km", 0) > 0 and costs:
            if t.get("mode") == "Walk":
                print(f"     Transport: FREE (walking)  |  "
                      f"or Taxi: {costs.get('taxi_low',0)}–{costs.get('taxi_high',0)} EGP  |  "
                      f"Uber: {costs.get('uber_low',0)}–{costs.get('uber_high',0)} EGP")
            else:
                print(f"     Transport: Taxi {costs.get('taxi_low',0)}–{costs.get('taxi_high',0)} EGP  |  "
                      f"Uber: {costs.get('uber_low',0)}–{costs.get('uber_high',0)} EGP  "
                      f"(budgeted: ~{t_cost} EGP)")
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
    budget_str = f"{int(user.budget_egp)} EGP  →  " if user else ""
    print(f"  Budget: {budget_str}Remaining: {int(s['budget_remaining'])} EGP")
    print("=" * W + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# 10. DEMO
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":

    print("Loading database...")
    df         = load_attractions(DATA_PATH)
    att_matrix = build_attraction_matrix(df)
    print(f"Loaded {len(df)} attractions | {N_DIMS}-dim vector space\n")

    # Show how cosine similarity works (useful for thesis demo)
    print("=" * 60)
    print("  COSINE SIMILARITY - HOW IT WORKS")
    print("=" * 60)
    u_vec = build_category_vector(["historical", "outdoor", "ancient"])
    a_vec = build_category_vector(["historical", "outdoor", "ancient", "landmark"])
    b_vec = build_category_vector(["beach", "coastal", "nature"])
    sim_a = cosine_similarity(u_vec.reshape(1,-1), a_vec.reshape(1,-1))[0][0]
    sim_b = cosine_similarity(u_vec.reshape(1,-1), b_vec.reshape(1,-1))[0][0]
    print(f"  User likes: [historical, outdoor, ancient]")
    print(f"  Pyramids   [historical, outdoor, ancient, landmark] -> cosine = {sim_a:.4f} (HIGH match)")
    print(f"  Miami Beach [beach, coastal, nature]                -> cosine = {sim_b:.4f} (NO match)")
    print("=" * 60 + "\n")

    # Demo 1: Sarah - Tourist in Cairo, history lover
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

    # Demo 2: Omar - Local in Alexandria, dislikes crowds
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

    # Demo 3: Emma - Tourist in Alexandria, beach lover
    emma = UserProfile(
        user_id="USR005", name="Emma Johnson (Tourist, Alexandria)",
        city="Alexandria",
        preferred_categories=["beach", "coastal", "outdoor", "nature"],
        budget_egp=4000, available_hours=7.0,
        current_lat=31.2365, current_lon=29.9547,
        liked_ids=["ATT082", "ATT058"], visited_ids=[],
        dislikes_crowds=False,
    )
    print_itinerary(build_itinerary(df, att_matrix, emma, start_hour=9, top_n=5), user=emma)