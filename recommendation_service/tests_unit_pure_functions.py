"""
Unit tests for reccomender_v2.py — pure functions only (no DB, no HTTP).

Run with:
    python -m pytest test_recommender.py -v
"""

import math
import pytest
import numpy as np
import pandas as pd

# ── import only the pure helpers — no side-effects at module load ─────────────
from reccomender_v2 import (
    _fmt,
    _haversine_fallback,
    build_category_vector,
    build_attraction_matrix,
    expand_interest_labels,
    get_city_coords,
    get_taxi_rates,
    discretize_budget_egp,
    discretize_time_hours,
    split_budget_across_days,
    solve_2d_knapsack,
    nearest_neighbor_route,
    build_user_from_payload,
    make_serializable,
    ALL_CATEGORIES,
    CAT_INDEX,
    N_DIMS,
    CITY_COORDS,
)


# ─────────────────────────────────────────────────────────────────────────────
# _fmt
# ─────────────────────────────────────────────────────────────────────────────
class TestFmt:
    def test_whole_hour(self):
        assert _fmt(9.0) == "09:00"

    def test_half_hour(self):
        assert _fmt(9.5) == "09:30"

    def test_quarter_hour(self):
        assert _fmt(14.25) == "14:15"

    def test_midnight_rollover(self):
        # 24.0 should roll over to 00:00
        assert _fmt(24.0) == "00:00"

    def test_minute_rounding_rollover(self):
        # 9 + 59.5/60 ≈ 9.9917 → rounds to 10:00
        assert _fmt(9 + 59.5 / 60) == "10:00"

    def test_fractional_minutes(self):
        # 10 + 10/60 ≈ 10.1667 → 10:10
        assert _fmt(10 + 10 / 60) == "10:10"


# ─────────────────────────────────────────────────────────────────────────────
# _haversine_fallback
# ─────────────────────────────────────────────────────────────────────────────
class TestHaversine:
    def test_same_point_is_zero(self):
        result = _haversine_fallback(30.0, 31.0, 30.0, 31.0)
        assert result["distance_km"] == 0.0
        assert result["duration_min"] == 0.0

    def test_keys_present(self):
        r = _haversine_fallback(30.0, 31.0, 31.0, 32.0)
        assert "distance_km" in r
        assert "duration_min" in r
        assert "source" in r

    def test_source_is_fallback(self):
        r = _haversine_fallback(30.0, 31.0, 31.0, 32.0)
        assert r["source"] == "haversine_fallback"

    def test_positive_distance(self):
        r = _haversine_fallback(31.2, 29.9, 30.0, 31.2)  # Alexandria → Cairo
        assert r["distance_km"] > 0

    def test_symmetry(self):
        a = _haversine_fallback(31.2, 29.9, 30.0, 31.2)
        b = _haversine_fallback(30.0, 31.2, 31.2, 29.9)
        assert abs(a["distance_km"] - b["distance_km"]) < 0.01

    def test_cairo_factor_applied(self):
        # Cairo uses factor=1.35; any other city uses 1.20.
        # Road distance should be strictly larger than straight-line distance.
        r_cairo = _haversine_fallback(30.0, 31.0, 30.1, 31.1, city="Cairo")
        r_other = _haversine_fallback(30.0, 31.0, 30.1, 31.1, city="Alexandria")
        assert r_cairo["distance_km"] > r_other["distance_km"]

    def test_duration_consistent_with_distance(self):
        r = _haversine_fallback(30.0, 31.0, 30.1, 31.1)
        # 30 km/h → dur = dist / 30 * 60
        expected = r["distance_km"] / 30.0 * 60.0
        assert abs(r["duration_min"] - round(expected, 1)) < 0.01


# ─────────────────────────────────────────────────────────────────────────────
# build_category_vector
# ─────────────────────────────────────────────────────────────────────────────
class TestCategoryVector:
    def test_empty_list_is_zeros(self):
        vec = build_category_vector([])
        assert vec.shape == (N_DIMS,)
        assert vec.sum() == 0.0

    def test_known_category_sets_bit(self):
        vec = build_category_vector(["museum"])
        assert vec[CAT_INDEX["museum"]] == 1.0

    def test_unknown_category_ignored(self):
        vec = build_category_vector(["nonexistent_category"])
        assert vec.sum() == 0.0

    def test_multiple_categories(self):
        cats = ["museum", "historical", "beach"]
        vec = build_category_vector(cats)
        assert vec.sum() == 3.0
        for c in cats:
            assert vec[CAT_INDEX[c]] == 1.0

    def test_duplicate_categories(self):
        # Duplicates should not double-set the same bit
        vec = build_category_vector(["museum", "museum"])
        assert vec[CAT_INDEX["museum"]] == 1.0
        assert vec.sum() == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# build_attraction_matrix
# ─────────────────────────────────────────────────────────────────────────────
class TestAttractionMatrix:
    def _make_df(self, rows):
        return pd.DataFrame({"categories": rows})

    def test_shape(self):
        df = self._make_df([["museum"], ["beach", "outdoor"]])
        mat = build_attraction_matrix(df)
        assert mat.shape == (2, N_DIMS)

    def test_correct_bits(self):
        df = self._make_df([["museum", "historical"]])
        mat = build_attraction_matrix(df)
        assert mat[0, CAT_INDEX["museum"]] == 1.0
        assert mat[0, CAT_INDEX["historical"]] == 1.0

    def test_empty_categories(self):
        df = self._make_df([[]])
        mat = build_attraction_matrix(df)
        assert mat[0].sum() == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# expand_interest_labels
# ─────────────────────────────────────────────────────────────────────────────
class TestExpandInterestLabels:
    def test_known_interest(self):
        cats = expand_interest_labels(["history"])
        assert "historical" in cats
        assert "museum" in cats

    def test_unknown_interest_ignored(self):
        cats = expand_interest_labels(["zumba"])
        assert cats == []

    def test_no_duplicates(self):
        # history + culture both map to historical/museum — should be deduped
        cats = expand_interest_labels(["history", "culture"])
        assert len(cats) == len(set(cats))

    def test_empty_list(self):
        assert expand_interest_labels([]) == []

    def test_case_insensitive(self):
        cats1 = expand_interest_labels(["History"])
        cats2 = expand_interest_labels(["history"])
        assert cats1 == cats2


# ─────────────────────────────────────────────────────────────────────────────
# get_city_coords
# ─────────────────────────────────────────────────────────────────────────────
class TestGetCityCoords:
    def test_known_city(self):
        lat, lon = get_city_coords("alexandria")
        assert lat == pytest.approx(CITY_COORDS["alexandria"][0])
        assert lon == pytest.approx(CITY_COORDS["alexandria"][1])

    def test_case_insensitive(self):
        assert get_city_coords("Alexandria") == get_city_coords("alexandria")

    def test_unknown_city_returns_cairo(self):
        assert get_city_coords("atlantis") == CITY_COORDS["cairo"]

    def test_all_cities_reachable(self):
        for city in CITY_COORDS:
            lat, lon = get_city_coords(city)
            assert isinstance(lat, float)
            assert isinstance(lon, float)


# ─────────────────────────────────────────────────────────────────────────────
# get_taxi_rates
# ─────────────────────────────────────────────────────────────────────────────
class TestGetTaxiRates:
    def test_known_city_returns_tuple(self):
        base, low, high = get_taxi_rates("cairo")
        assert base > 0
        assert low > 0
        assert high >= low

    def test_unknown_city_returns_default(self):
        from reccomender_v2 import TAXI_RATES_DEFAULT
        assert get_taxi_rates("nowhere") == TAXI_RATES_DEFAULT

    def test_case_insensitive(self):
        assert get_taxi_rates("Cairo") == get_taxi_rates("cairo")


# ─────────────────────────────────────────────────────────────────────────────
# discretize_budget_egp / discretize_time_hours
# ─────────────────────────────────────────────────────────────────────────────
class TestDiscretize:
    def test_budget_zero(self):
        assert discretize_budget_egp(0.0) == 0

    def test_budget_step(self):
        from reccomender_v2 import DP_BUDGET_STEP_EGP
        assert discretize_budget_egp(DP_BUDGET_STEP_EGP) == 1
        assert discretize_budget_egp(DP_BUDGET_STEP_EGP * 3) == 3

    def test_budget_negative_clamps_to_zero(self):
        assert discretize_budget_egp(-100) == 0

    def test_time_zero(self):
        assert discretize_time_hours(0.0) == 0

    def test_time_one_hour(self):
        from reccomender_v2 import DP_TIME_STEP_MIN
        expected = int(60 / DP_TIME_STEP_MIN)
        assert discretize_time_hours(1.0) == expected

    def test_time_negative_clamps_to_zero(self):
        assert discretize_time_hours(-1.0) == 0


# ─────────────────────────────────────────────────────────────────────────────
# split_budget_across_days
# ─────────────────────────────────────────────────────────────────────────────
class TestSplitBudget:
    def test_empty_returns_empty(self):
        assert split_budget_across_days([], []) == []

    def test_single_day_returns_one(self):
        assert split_budget_across_days([8.0], [500.0]) == [1.0]

    def test_fractions_sum_to_one(self):
        fracs = split_budget_across_days([8.0, 6.0, 4.0], [500.0, 300.0, 200.0])
        assert abs(sum(fracs) - 1.0) < 1e-9

    def test_more_hours_gets_larger_share(self):
        fracs = split_budget_across_days([10.0, 2.0], [200.0, 200.0])
        assert fracs[0] > fracs[1]

    def test_equal_days_equal_shares(self):
        fracs = split_budget_across_days([8.0, 8.0], [300.0, 300.0])
        assert abs(fracs[0] - fracs[1]) < 1e-9


# ─────────────────────────────────────────────────────────────────────────────
# solve_2d_knapsack
# ─────────────────────────────────────────────────────────────────────────────
def _knapsack_df(items):
    """items: list of (id, cost_egp, hrs, score)"""
    rows = []
    for aid, cost, hrs, score in items:
        rows.append({
            "attraction_id":         aid,
            "knapsack_total_cost_egp": float(cost),
            "knapsack_total_hrs":      float(hrs),
            "enjoyment_score":         float(score),
        })
    return pd.DataFrame(rows)


class TestKnapsack:
    def test_empty_candidates_returns_empty(self):
        assert solve_2d_knapsack(pd.DataFrame(), 1000.0, 8.0) == []

    def test_zero_budget_returns_empty(self):
        df = _knapsack_df([("A1", 100, 1.0, 0.8)])
        assert solve_2d_knapsack(df, 0.0, 8.0) == []

    def test_zero_time_returns_empty(self):
        df = _knapsack_df([("A1", 100, 1.0, 0.8)])
        assert solve_2d_knapsack(df, 1000.0, 0.0) == []

    def test_single_item_fits(self):
        df = _knapsack_df([("A1", 100, 1.0, 0.8)])
        result = solve_2d_knapsack(df, 500.0, 4.0)
        assert "A1" in result

    def test_single_item_too_expensive(self):
        df = _knapsack_df([("A1", 1000, 1.0, 0.8)])
        result = solve_2d_knapsack(df, 50.0, 4.0)
        assert "A1" not in result

    def test_single_item_too_long(self):
        df = _knapsack_df([("A1", 100, 10.0, 0.8)])
        result = solve_2d_knapsack(df, 500.0, 2.0)
        assert "A1" not in result

    def test_picks_higher_score_when_budget_limited(self):
        # A1: cheaper but lower score, A2: more expensive but higher score
        # With enough budget for both but only time for one (time-constrained)
        df = _knapsack_df([
            ("A1", 100, 3.0, 0.3),
            ("A2", 150, 3.0, 0.9),
        ])
        result = solve_2d_knapsack(df, 500.0, 3.5)
        assert "A2" in result
        assert "A1" not in result

    def test_fits_multiple_items(self):
        df = _knapsack_df([
            ("A1", 100, 1.0, 0.8),
            ("A2", 100, 1.0, 0.7),
            ("A3", 100, 1.0, 0.6),
        ])
        result = solve_2d_knapsack(df, 500.0, 4.0)
        assert len(result) == 3

    def test_returns_strings(self):
        df = _knapsack_df([("A1", 50, 1.0, 0.5)])
        result = solve_2d_knapsack(df, 500.0, 4.0)
        assert all(isinstance(x, str) for x in result)


# ─────────────────────────────────────────────────────────────────────────────
# nearest_neighbor_route
# ─────────────────────────────────────────────────────────────────────────────
def _route_df(attractions):
    """attractions: list of (id, lat, lon)"""
    return pd.DataFrame([
        {"attraction_id": aid, "latitude": lat, "longitude": lon}
        for aid, lat, lon in attractions
    ])


class TestNearestNeighborRoute:
    def test_empty_returns_empty(self):
        assert nearest_neighbor_route(pd.DataFrame(), 30.0, 31.0) == []

    def test_single_item(self):
        df = _route_df([("A1", 30.0, 31.0)])
        result = nearest_neighbor_route(df, 30.0, 31.0)
        assert len(result) == 1
        assert result[0]["attraction_id"] == "A1"

    def test_all_items_visited(self):
        df = _route_df([
            ("A1", 30.0, 31.0),
            ("A2", 30.1, 31.1),
            ("A3", 30.2, 31.2),
        ])
        result = nearest_neighbor_route(df, 29.9, 30.9)
        assert len(result) == 3

    def test_first_stop_is_nearest(self):
        # Start at (30.0, 31.0). A2 is closer than A1.
        df = _route_df([
            ("A1", 35.0, 36.0),  # far
            ("A2", 30.01, 31.01),  # near
        ])
        result = nearest_neighbor_route(df, 30.0, 31.0)
        assert result[0]["attraction_id"] == "A2"

    def test_returns_list_of_dicts(self):
        df = _route_df([("A1", 30.0, 31.0)])
        result = nearest_neighbor_route(df, 30.0, 31.0)
        assert isinstance(result, list)
        assert isinstance(result[0], dict)


# ─────────────────────────────────────────────────────────────────────────────
# build_user_from_payload
# ─────────────────────────────────────────────────────────────────────────────
class TestBuildUserFromPayload:
    def _base(self, **overrides):
        payload = {
            "user_id": "u1",
            "name": "Test",
            "city": "Alexandria",
            "interests": ["history"],
            "budget_egp": 1000,
            "available_hours": 8,
            "current_lat": 31.2,
            "current_lon": 29.9,
        }
        payload.update(overrides)
        return payload

    def test_city_lowercase(self):
        u = build_user_from_payload(self._base(city="CAIRO"))
        assert u.city == "cairo"

    def test_interests_expand_to_categories(self):
        u = build_user_from_payload(self._base(interests=["history"]))
        assert "historical" in u.preferred_categories

    def test_start_end_hour_sets_available_hours(self):
        u = build_user_from_payload(self._base(start_hour=9, end_hour=17))
        assert u.available_hours == pytest.approx(8.0)

    def test_zero_coords_fall_back_to_city_centroid(self):
        u = build_user_from_payload(self._base(current_lat=0.0, current_lon=0.0, city="alexandria"))
        lat, lon = CITY_COORDS["alexandria"]
        assert u.current_lat == pytest.approx(lat)
        assert u.current_lon == pytest.approx(lon)

    def test_missing_budget_defaults_to_1000(self):
        payload = self._base()
        del payload["budget_egp"]
        u = build_user_from_payload(payload)
        assert u.budget_egp == 1000.0

    def test_liked_ids_are_strings(self):
        u = build_user_from_payload(self._base(liked_ids=[1, 2, "ATT003"]))
        assert all(isinstance(x, str) for x in u.liked_ids)

    def test_dislikes_crowds_default_false(self):
        u = build_user_from_payload(self._base())
        assert u.dislikes_crowds is False


# ─────────────────────────────────────────────────────────────────────────────
# make_serializable
# ─────────────────────────────────────────────────────────────────────────────
class TestMakeSerializable:
    def test_numpy_int(self):
        assert make_serializable(np.int64(5)) == 5
        assert isinstance(make_serializable(np.int64(5)), int)

    def test_numpy_float(self):
        result = make_serializable(np.float32(3.14))
        assert isinstance(result, float)

    def test_numpy_array(self):
        result = make_serializable(np.array([1, 2, 3]))
        assert result == [1, 2, 3]
        assert isinstance(result, list)

    def test_nested_dict(self):
        obj = {"a": np.int64(1), "b": {"c": np.float32(2.5)}}
        result = make_serializable(obj)
        assert result == {"a": 1, "b": {"c": pytest.approx(2.5)}}

    def test_list_of_numpy(self):
        result = make_serializable([np.int64(1), np.float32(2.0)])
        assert result == [1, pytest.approx(2.0)]

    def test_plain_python_unchanged(self):
        assert make_serializable("hello") == "hello"
        assert make_serializable(42) == 42
        assert make_serializable(None) is None


# ─────────────────────────────────────────────────────────────────────────────
# Late-day distance cap constants (regression guard)
# ─────────────────────────────────────────────────────────────────────────────
class TestLateDayCapConstants:
    def test_late_day_cap_logic_present(self):
        """Regression guard: late-day distance cap must still exist in the scheduler."""
        import inspect, reccomender_v2
        src = inspect.getsource(reccomender_v2)
        assert "late-day cap" in src, (
            "Late-day distance cap log message removed — the cap logic may have been deleted"
        )
        # The cap skips attractions > 10 km after 16:00
        assert "16.0" in src or "16:" in src, "16:00 cutoff not found in source"
        assert "10.0" in src or "> 10" in src, "10 km limit not found in source"
