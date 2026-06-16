"""
Plan-coach only: retime a user-chosen ordered list of attraction IDs.
Reuses get_transport_info / OSRM from reccomender_v2 — does NOT modify scoring or build_itinerary.
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd

from reccomender_v2 import (
    MIN_VISIT_HRS,
    CITY_COORDS,
    get_transport_info,
    make_serializable,
    osm_maps_url,
)

_FOOD_TAGS_PRICE = {
    "restaurant", "cafe", "food", "bakery", "dessert",
    "seafood", "grills", "local", "international",
}


def _fmt_hour(hour: float) -> str:
    h = int(hour) % 24
    m = int(round((hour - int(hour)) * 60))
    if m == 60:
        h, m = h + 1, 0
    return f"{h:02d}:{m:02d}"


def _infer_stop_type(categories: list, arrival_hr: float) -> str:
    cats = {str(c).lower() for c in (categories or [])}
    is_food = bool(cats & _FOOD_TAGS_PRICE)
    if not is_food:
        return "Attraction"
    ah = arrival_hr % 24.0
    if ah < 11:
        return "Breakfast"
    if ah < 16:
        return "Lunch"
    if ah < 18:
        return "Coffee"
    return "Dinner"


def _apply_visitor_pricing(df_city: pd.DataFrame, is_foreigner: bool) -> pd.DataFrame:
    out = df_city.copy()
    is_food_mask = out["categories"].apply(
        lambda cats: bool(cats) and all(c in _FOOD_TAGS_PRICE for c in cats)
    )
    if is_foreigner:
        att_mask = (~is_food_mask) & (out["admission_egp_foreigner"] > 0)
        out.loc[att_mask, "price_avg"] = out.loc[att_mask, "admission_egp_foreigner"]
    else:
        att_mask = (~is_food_mask) & (out["admission_egp"] > 0)
        out.loc[att_mask, "price_avg"] = out.loc[att_mask, "admission_egp"]
    return out


def _resolve_start_lat_lon(city: str, lat: float | None, lon: float | None) -> tuple[float, float]:
    if lat is not None and lon is not None and not (math.isnan(lat) or math.isnan(lon)):
        return float(lat), float(lon)
    key = str(city).strip().lower()
    if key in CITY_COORDS:
        return float(CITY_COORDS[key][0]), float(CITY_COORDS[key][1])
    return 26.82, 30.8


def _ordered_road_km_total(
    prev_lat: float, prev_lon: float, ordered_atts: list[pd.Series], city: str
) -> float:
    total = 0.0
    pl, pyl = prev_lat, prev_lon
    for att in ordered_atts:
        t = get_transport_info(
            pl, pyl,
            float(att["latitude"]), float(att["longitude"]),
            dest_name=str(att["name"]), city=str(city),
        )
        total += float(t.get("distance_km", 0) or 0)
        pl, pyl = float(att["latitude"]), float(att["longitude"])
    return total


def _greedy_nn_road_km_total(
    prev_lat: float, prev_lon: float, atts: list[pd.Series], city: str
) -> float:
    """Lower-is-better baseline: greedy nearest-neighbor on the same multiset (coach-only)."""
    rem = list(atts)
    total = 0.0
    pl, pyl = prev_lat, prev_lon
    while rem:
        best_i = 0
        best_km = None
        for i, att in enumerate(rem):
            t = get_transport_info(
                pl, pyl,
                float(att["latitude"]), float(att["longitude"]),
                dest_name=str(att["name"]), city=str(city),
            )
            km = float(t.get("distance_km", 0) or 0)
            if best_km is None or km < best_km:
                best_km = km
                best_i = i
        att = rem.pop(best_i)
        total += float(best_km or 0)
        pl, pyl = float(att["latitude"]), float(att["longitude"])
    return total


def retime_ordered_ids_for_coach(
    df: pd.DataFrame,
    city: str,
    ordered_ids: list[str],
    start_hour: float,
    end_hour: float,
    current_lat: float | None,
    current_lon: float | None,
    is_foreigner: bool = False,
    budget_egp: float | None = None,
    existing_activities: list | None = None,
) -> dict[str, Any]:
    """
    Returns { success, itinerary, warnings, skipped_ids, dropped_for_time,
             route_km_ordered, route_km_greedy_nn }.
    """
    _existing_dur_map: dict[str, float] = {}
    for entry in (existing_activities or []):
        eid = str(entry.get("id", "")).strip()
        dur = entry.get("duration_hrs")
        if eid and dur is not None:
            _existing_dur_map[eid] = float(dur)

    warnings: list[str] = []
    skipped_ids: list[str] = []

    city_key = str(city).strip().lower()
    city_df = df[df["city"].str.strip().str.lower() == city_key].copy()
    if city_df.empty:
        return {"success": False, "error": f"No attractions loaded for city '{city}'"}

    priced = _apply_visitor_pricing(city_df, is_foreigner)

    seen: set[str] = set()
    rows: list[pd.Series] = []
    for oid in ordered_ids:
        sid = str(oid).strip()
        if sid in seen:
            continue
        seen.add(sid)
        hit = priced[priced["attraction_id"].astype(str) == sid]
        if hit.empty:
            skipped_ids.append(sid)
            continue
        rows.append(hit.iloc[0])

    if skipped_ids:
        warnings.append(
            "Some requested stops could not be found and were skipped."
        )

    if not rows:
        return {
            "success": True,
            "itinerary": [],
            "warnings": warnings + ["No valid stops to schedule."],
            "skipped_ids": skipped_ids,
            "dropped_for_time": [],
            "route_km_ordered": 0.0,
            "route_km_greedy_nn": 0.0,
        }

    start_hr = float(start_hour)
    end_hr = float(end_hour)
    if end_hr <= start_hr:
        end_hr += 24.0

    slat, slon = _resolve_start_lat_lon(city, current_lat, current_lon)

    try:
        nn_km = _greedy_nn_road_km_total(slat, slon, list(rows), city)
        ord_km = _ordered_road_km_total(slat, slon, rows, city)
    except Exception:
        nn_km, ord_km = 0.0, 0.0

    if nn_km > 0.5 and ord_km > nn_km * 1.30:
        warnings.append(
            "This route could involve more travel"
        )

    curr_hr = start_hr
    prev_lat, prev_lon = slat, slon
    itinerary: list[dict[str, Any]] = []
    dropped_for_time: list[str] = []
    total_cost = 0.0
    total_transport = 0.0

    def time_left() -> float:
        return end_hr - curr_hr

    for att in rows:
        transport = get_transport_info(
            prev_lat, prev_lon,
            float(att["latitude"]), float(att["longitude"]),
            dest_name=str(att["name"]), city=str(city),
        )
        transport_cost = float(transport.get("cost_egp", 0) or 0)
        travel_hrs = float(transport.get("duration_min", 0) or 0) / 60.0

        if time_left() < travel_hrs + 0.05:
            dropped_for_time.append(str(att["name"]))
            continue

        arrival_hr = curr_hr + travel_hrs
        open_hr = float(att.get("open_hour", 0) or 0)
        close_hr = float(att.get("close_hour", 24) or 24)

        if arrival_hr < open_hr:
            dropped_for_time.append(str(att["name"]))
            warnings.append(
                f"'{att['name']}' opens later than your arrival time — skipped for this day's chain."
            )
            continue
        if arrival_hr >= close_hr - MIN_VISIT_HRS:
            dropped_for_time.append(str(att["name"]))
            warnings.append(
                f"Could not fit '{att['name']}' before closing time — removed from this day."
            )
            continue

        att_id = str(att["attraction_id"]).strip()
        raw_dur = _existing_dur_map.get(att_id) or max(float(att.get("avg_visit_hrs", 1.0) or 1.0), MIN_VISIT_HRS)
        raw_dur = max(raw_dur, MIN_VISIT_HRS)
        
        time_until_close = close_hr - arrival_hr
        dur = min(raw_dur, max(0.0, time_left() - travel_hrs), time_until_close)
        if dur < MIN_VISIT_HRS:
            dropped_for_time.append(str(att["name"]))
            continue

        eff_cost = float(att.get("price_avg", 0) or 0)
        stop_type = _infer_stop_type(list(att.get("categories", [])), arrival_hr)

        itinerary.append(
            {
                "time": _fmt_hour(arrival_hr),
                "departure_time": _fmt_hour(curr_hr),
                "type": stop_type,
                "name": str(att["name"]),
                "id": str(att["attraction_id"]),
                "latitude": float(att["latitude"]),
                "longitude": float(att["longitude"]),
                "duration_hrs": round(dur, 2),
                "travel_duration_min": transport.get("duration_min", 0),
                "cost_egp": eff_cost,
                "distance_km": transport.get("distance_km", 0),
                "transport": transport,
                "transport_cost": transport_cost,
                "address": str(att.get("address", "") or ""),
                "description": str(att.get("description", "") or ""),
                "rating": float(att.get("avg_rating", 0) or 0),
                "categories": [str(c) for c in att.get("categories", [])],
                "open": float(att.get("open_hour", 0) or 0),
                "close": float(att.get("close_hour", 24) or 24),
                "image_url": str(att.get("primary_image") or ""),
                "price_from": float(att.get("price_min", 0) or 0),
                "directions_url": transport.get("directions_url", ""),
                "osm_url": osm_maps_url(float(att["latitude"]), float(att["longitude"]), str(att["name"])),
            }
        )

        prev_lat = float(att["latitude"])
        prev_lon = float(att["longitude"])
        curr_hr += travel_hrs + dur
        total_cost += eff_cost
        total_transport += transport_cost

    if dropped_for_time:
        warnings.append(
           "These stops could not fit in the day's time window and were removed: "
            + ", ".join(dropped_for_time)
        )

    if budget_egp is not None and budget_egp > 0:
        spent = total_cost + total_transport
        if spent > budget_egp:
            warnings.append(
                f"This day's stops cost about {spent:.0f} EGP (entries + transport), "
                f"which is above the roughly {budget_egp:.0f} EGP day budget — not cost-optimized."
            )

    return make_serializable(
        {
            "success": True,
            "itinerary": itinerary,
            "warnings": warnings,
            "skipped_ids": skipped_ids,
            "dropped_for_time": dropped_for_time,
            "route_km_ordered": round(ord_km, 2),
            "route_km_greedy_nn": round(nn_km, 2),
        }
    )
