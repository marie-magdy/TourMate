"""
Component Tests — Flask routes in app.py
Tests how reccomender_v2.py talks to the Flask layer.
No real DB needed: recommender functions are mocked.

Run with:
    python -m pytest test_component.py -v
"""

import json
import pytest
from unittest.mock import patch, MagicMock
import numpy as np
import pandas as pd


# ── Patch DB pool before app is imported so it never tries to connect ─────────
@pytest.fixture(autouse=True, scope="session")
def mock_db():
    with patch("reccomender_v2._get_pool") as mock_pool:
        mock_conn = MagicMock()
        mock_cur  = MagicMock()
        mock_cur.fetchall.return_value = []
        mock_conn.cursor.return_value  = mock_cur
        mock_pool.return_value.getconn.return_value = mock_conn
        yield mock_pool


@pytest.fixture(scope="session")
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ── Minimal fake itinerary returned by mocked recommender ────────────────────
FAKE_ITINERARY = {
    "itinerary": [
        {
            "id": "ATT001",
            "name": "Roman Theatre",
            "time": "09:00",
            "duration_hrs": 1.5,
            "lat": 31.2,
            "lon": 29.9,
            "transport": {"mode": "Walk", "distance_km": 0.5, "duration_min": 6},
        }
    ],
    "stats": {
        "total_hours": 1.5,
        "total_distance_km": 0.5,
        "total_cost_egp": 50,
        "cost_attractions_meals": 50,
        "cost_transport_egp": 0,
        "budget_remaining": 950,
    },
    "missed_liked": [],
}

FAKE_DF = pd.DataFrame([{
    "attraction_id": "ATT001",
    "name": "Roman Theatre",
    "city": "alexandria",
    "district": "",
    "latitude": 31.2,
    "longitude": 29.9,
    "address": "Alexandria",
    "categories": ["historical", "ancient"],
    "sub_type": "Theatre",
    "avg_visit_hrs": 1.5,
    "admission_egp": 50.0,
    "admission_egp_foreigner": 100.0,
    "avg_rating": 4.5,
    "popularity": 0.8,
    "open_hour": 9,
    "close_hour": 17,
    "meal_slot": [],
    "price_min": 50.0,
    "price_max": 50.0,
    "price_avg": 50.0,
    "crowd_label": "Moderate",
    "description": "Historic Roman theatre",
    "primary_image": "",
    "price_range": "Budget | 50–50 EGP",
}])

FAKE_MATRIX = np.zeros((1, 33))


# ─────────────────────────────────────────────────────────────────────────────
# /health
# ─────────────────────────────────────────────────────────────────────────────
class TestHealthRoute:
    def test_health_returns_200(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_returns_status_running(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.get("/health").get_json()
        assert data["status"] == "running"

    def test_health_includes_attraction_count(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.get("/health").get_json()
        assert "attractions_loaded" in data
        assert isinstance(data["attractions_loaded"], int)


# ─────────────────────────────────────────────────────────────────────────────
# /attractions
# ─────────────────────────────────────────────────────────────────────────────
class TestAttractionsRoute:
    def test_returns_200(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            resp = client.get("/attractions?city=alexandria")
        assert resp.status_code == 200

    def test_returns_success_true(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.get("/attractions?city=alexandria").get_json()
        assert data["success"] is True

    def test_filters_by_city(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.get("/attractions?city=cairo").get_json()
        # FAKE_DF only has alexandria — cairo filter should return empty list
        assert data["data"] == []

    def test_returns_expected_fields(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.get("/attractions?city=alexandria").get_json()
        if data["data"]:
            spot = data["data"][0]
            for field in ["id", "name", "categories", "rating", "city"]:
                assert field in spot

    def test_empty_df_returns_503(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(pd.DataFrame(), FAKE_MATRIX)):
            resp = client.get("/attractions")
        assert resp.status_code == 503


# ─────────────────────────────────────────────────────────────────────────────
# /itinerary
# ─────────────────────────────────────────────────────────────────────────────
class TestItineraryRoute:
    BASE_PAYLOAD = {
        "city": "alexandria",
        "interests": ["history"],
        "budget_egp": 1000,
        "available_hours": 8,
        "current_lat": 31.2,
        "current_lon": 29.9,
        "day_index": 0,
        "n_days": 1,
    }

    def test_returns_200_on_valid_payload(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload", return_value=FAKE_ITINERARY):
            resp = client.post("/itinerary",
                               data=json.dumps(self.BASE_PAYLOAD),
                               content_type="application/json")
        assert resp.status_code == 200

    def test_returns_itinerary_key(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload", return_value=FAKE_ITINERARY):
            data = client.post("/itinerary",
                               data=json.dumps(self.BASE_PAYLOAD),
                               content_type="application/json").get_json()
        assert "itinerary" in data

    def test_empty_payload_still_returns_200(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload", return_value=FAKE_ITINERARY):
            resp = client.post("/itinerary",
                               data=json.dumps({}),
                               content_type="application/json")
        assert resp.status_code == 200

    def test_recommender_exception_returns_500(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload",
                   side_effect=RuntimeError("something broke")):
            resp = client.post("/itinerary",
                               data=json.dumps(self.BASE_PAYLOAD),
                               content_type="application/json")
        assert resp.status_code == 500

    def test_500_response_includes_error_message(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload",
                   side_effect=RuntimeError("something broke")):
            data = client.post("/itinerary",
                               data=json.dumps(self.BASE_PAYLOAD),
                               content_type="application/json").get_json()
        assert "error" in data

    def test_payload_forwarded_to_recommender(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)), \
             patch("app.generate_itinerary_from_payload",
                   return_value=FAKE_ITINERARY) as mock_gen:
            client.post("/itinerary",
                        data=json.dumps(self.BASE_PAYLOAD),
                        content_type="application/json")
        called_payload = mock_gen.call_args[0][0]
        assert called_payload["city"] == "alexandria"
        assert called_payload["budget_egp"] == 1000


# ─────────────────────────────────────────────────────────────────────────────
# /budget-split
# ─────────────────────────────────────────────────────────────────────────────
class TestBudgetSplitRoute:
    def test_returns_200(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            resp = client.post("/budget-split",
                               data=json.dumps({"daily_hours": [8.0, 6.0], "city": "alexandria"}),
                               content_type="application/json")
        assert resp.status_code == 200

    def test_returns_fractions(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.post("/budget-split",
                               data=json.dumps({"daily_hours": [8.0, 6.0], "city": "alexandria"}),
                               content_type="application/json").get_json()
        assert "fractions" in data
        assert len(data["fractions"]) == 2

    def test_fractions_sum_to_one(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            data = client.post("/budget-split",
                               data=json.dumps({"daily_hours": [8.0, 6.0, 4.0], "city": "alexandria"}),
                               content_type="application/json").get_json()
        assert abs(sum(data["fractions"]) - 1.0) < 1e-6

    def test_missing_daily_hours_returns_400(self, client):
        with patch("app.ensure_attractions_loaded", return_value=(FAKE_DF, FAKE_MATRIX)):
            resp = client.post("/budget-split",
                               data=json.dumps({"city": "alexandria"}),
                               content_type="application/json")
        assert resp.status_code == 400
