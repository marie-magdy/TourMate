"""
System Tests — full end-to-end itinerary generation with real database.
These tests hit the actual PostgreSQL DB and run the full pipeline.

Skipped automatically if DATABASE_URL is not set.

Run with:
    python -m pytest test_system.py -v
"""

import os
import pytest

DB_AVAILABLE = bool(os.getenv("DATABASE_URL"))

pytestmark = pytest.mark.skipif(
    not DB_AVAILABLE,
    reason="DATABASE_URL not set — skipping system tests"
)


@pytest.fixture(scope="module")
def attractions():
    """Load real attractions from DB once for all system tests."""
    from reccomender_v2 import load_attractions, build_attraction_matrix
    df  = load_attractions()
    mat = build_attraction_matrix(df)
    return df, mat


@pytest.fixture(scope="module")
def alexandria_payload():
    return {
        "user_id": "test_user",
        "name": "Test User",
        "city": "alexandria",
        "interests": ["history", "culture"],
        "budget_egp": 1000,
        "available_hours": 8,
        "start_hour": 9,
        "end_hour": 17,
        "current_lat": 31.2001,
        "current_lon": 29.9187,
        "liked_ids": [],
        "visited_ids": [],
        "day_index": 0,
        "n_days": 1,
        "is_foreigner": False,
    }


# ─────────────────────────────────────────────────────────────────────────────
# DB connectivity
# ─────────────────────────────────────────────────────────────────────────────
class TestDatabaseConnectivity:
    def test_loads_attractions(self, attractions):
        df, _ = attractions
        assert not df.empty, "No attractions loaded from DB"

    def test_has_required_columns(self, attractions):
        df, _ = attractions
        required = ["attraction_id", "name", "city", "latitude", "longitude",
                    "categories", "avg_rating", "popularity", "open_hour", "close_hour"]
        for col in required:
            assert col in df.columns, f"Missing column: {col}"

    def test_has_alexandria_attractions(self, attractions):
        df, _ = attractions
        alex = df[df["city"] == "alexandria"]
        assert len(alex) >= 5, f"Only {len(alex)} Alexandria attractions — too few to plan"

    def test_no_null_coordinates(self, attractions):
        df, _ = attractions
        # At least 80% of attractions should have valid coordinates
        valid = df[(df["latitude"] != 0) & (df["longitude"] != 0)]
        ratio = len(valid) / len(df)
        assert ratio >= 0.8, f"Too many zero coordinates: {ratio:.0%} valid"


# ─────────────────────────────────────────────────────────────────────────────
# Full itinerary generation
# ─────────────────────────────────────────────────────────────────────────────
class TestItineraryGeneration:
    def test_generates_without_error(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        assert "error" not in result, f"Recommender returned error: {result.get('error')}"

    def test_itinerary_key_present(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        assert "itinerary" in result

    def test_at_least_one_stop(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        assert len(result["itinerary"]) >= 1, "Itinerary has no stops"

    def test_stops_have_required_fields(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        for stop in result["itinerary"]:
            assert "id"   in stop, f"Stop missing 'id': {stop['name']}"
            assert "name" in stop, f"Stop missing 'name'"
            assert "time" in stop, f"Stop '{stop['name']}' missing 'time'"
            # Attractions use lat/lon, meal stops use latitude/longitude
            has_coords = ("lat" in stop and "lon" in stop) or \
                         ("latitude" in stop and "longitude" in stop)
            assert has_coords, f"Stop '{stop['name']}' has no coordinates"

    def test_all_stops_in_correct_city(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        att_ids = set(df[df["city"] == "alexandria"]["attraction_id"].astype(str))
        meal_ids = set(df[df["city"] == "alexandria"]["attraction_id"].astype(str))
        for stop in result["itinerary"]:
            sid = str(stop["id"])
            assert sid in att_ids or sid in meal_ids, \
                f"Stop '{stop['name']}' (id={sid}) does not belong to Alexandria"

    def test_total_cost_within_budget(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        stats = result.get("stats", {})
        total = stats.get("total_cost_egp", 0)
        budget = alexandria_payload["budget_egp"]
        assert total <= budget * 1.10, \
            f"Total cost {total} EGP exceeds budget {budget} EGP by more than 10%"

    def test_no_duplicate_stops(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        ids = [str(s["id"]) for s in result["itinerary"]]
        assert len(ids) == len(set(ids)), f"Duplicate stops found: {ids}"

    def test_stop_times_are_chronological(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        times = [s["time"] for s in result["itinerary"] if "time" in s]
        assert times == sorted(times), f"Stop times not in order: {times}"

    def test_no_stops_before_start_hour(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        for stop in result["itinerary"]:
            t = stop.get("time", "00:00")
            h, m = map(int, t.split(":"))
            assert h >= 9 or (h == 8 and m >= 0), \
                f"Stop '{stop['name']}' scheduled at {t}, before start hour 09:00"

    def test_stats_keys_present(self, attractions, alexandria_payload):
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        result = generate_itinerary_from_payload(alexandria_payload, df=df, att_matrix=mat)
        stats = result.get("stats", {})
        for key in ["total_hours", "total_distance_km", "total_cost_egp", "budget_remaining"]:
            assert key in stats, f"Missing stats key: {key}"


# ─────────────────────────────────────────────────────────────────────────────
# Liked places end-to-end
# ─────────────────────────────────────────────────────────────────────────────
class TestLikedPlacesSystem:
    def test_liked_place_appears_in_itinerary(self, attractions):
        """A liked attraction must appear in the generated itinerary."""
        from reccomender_v2 import generate_itinerary_from_payload, load_attractions
        df, mat = attractions
        # Pick the first Alexandria non-food attraction as the liked place
        alex = df[
            (df["city"] == "alexandria") &
            (df["latitude"] != 0) &
            df["categories"].apply(lambda c: not all(
                x in {"restaurant","cafe","food","bakery","dessert"} for x in c
            ))
        ]
        if alex.empty:
            pytest.skip("No suitable Alexandria attraction found for liked test")
        liked_id = str(alex.iloc[0]["attraction_id"])
        payload = {
            "city": "alexandria",
            "interests": ["history"],
            "budget_egp": 2000,
            "start_hour": 9,
            "end_hour": 21,
            "current_lat": 31.2001,
            "current_lon": 29.9187,
            "liked_ids": [liked_id],
            "visited_ids": [],
            "day_index": 0,
            "n_days": 1,
            "is_foreigner": False,
        }
        result = generate_itinerary_from_payload(payload, df=df, att_matrix=mat)
        scheduled_ids = {str(s["id"]) for s in result["itinerary"]}
        assert liked_id in scheduled_ids, \
            f"Liked attraction {liked_id} ({alex.iloc[0]['name']}) not found in itinerary"

    def test_invalid_liked_id_does_not_crash(self, attractions):
        """A non-existent liked ID should be silently ignored, not crash."""
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        payload = {
            "city": "alexandria",
            "interests": ["history"],
            "budget_egp": 1000,
            "start_hour": 9,
            "end_hour": 17,
            "current_lat": 31.2001,
            "current_lon": 29.9187,
            "liked_ids": ["FAKE_ID_999999"],
            "visited_ids": [],
            "day_index": 0,
            "n_days": 1,
        }
        result = generate_itinerary_from_payload(payload, df=df, att_matrix=mat)
        assert "error" not in result


# ─────────────────────────────────────────────────────────────────────────────
# Multi-day trip
# ─────────────────────────────────────────────────────────────────────────────
class TestMultiDaySystem:
    def test_two_day_trip_no_repeated_attractions(self, attractions):
        """Attractions visited on Day 1 must not appear on Day 2."""
        from reccomender_v2 import generate_itinerary_from_payload
        df, mat = attractions
        base = {
            "city": "alexandria",
            "interests": ["history", "culture"],
            "budget_egp": 2000,
            "start_hour": 9,
            "end_hour": 21,
            "current_lat": 31.2001,
            "current_lon": 29.9187,
            "liked_ids": [],
            "is_foreigner": False,
            "n_days": 2,
        }
        day1 = generate_itinerary_from_payload({**base, "day_index": 0, "visited_ids": []},
                                                df=df, att_matrix=mat)
        day1_ids = [str(s["id"]) for s in day1["itinerary"]]

        day2 = generate_itinerary_from_payload({**base, "day_index": 1, "visited_ids": day1_ids},
                                                df=df, att_matrix=mat)
        day2_ids = {str(s["id"]) for s in day2["itinerary"]}

        overlap = set(day1_ids) & day2_ids
        assert not overlap, f"Attractions repeated across days: {overlap}"
