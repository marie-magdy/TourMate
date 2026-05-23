/**
 * Plan Coach: Groq assistant for itinerary edits (GROQ_API_KEY_COACH only).
 * Retiming uses Flask POST /coach/retime-day (same OSRM stack as recommender).
 * Preview: plan_days_preview, optional day_schedules_preview, end_date_preview,
 * coach_extra_spend_total_preview, optimization_warnings.
 */

const RECOMMENDATION_SERVICE =
  process.env.RECOMMENDATION_SERVICE_URL || 'http://127.0.0.1:5002';

const MIN_VISIT_HRS = 0.5;
const FOOD_TAGS = new Set([
  'restaurant', 'cafe', 'food', 'bakery', 'dessert', 'seafood', 'grills', 'local', 'international',
]);

const CITY_CENTRE = {
  cairo: [30.0444, 31.2357],
  giza: [30.0131, 31.2089],
  alexandria: [31.2001, 29.9187],
  hurghada: [27.2579, 33.8116],
  luxor: [25.6872, 32.6396],
  aswan: [24.0889, 32.8998],
  'sharm el sheikh': [27.9158, 34.33],
  'sharm el-sheikh': [27.9158, 34.33],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function transportFromKm(km) {
  if (km <= 1.5) {
    const durationMin = Math.max(4, (km / 5) * 60);
    return {
      mode: 'Walk',
      duration_min: durationMin,
      cost_egp: 0,
      distance_km: Math.round(km * 100) / 100,
      costs: null,
      directions_url: '',
    };
  }
  const durationMin = Math.max(8, (km / 25) * 60);
  const taxiLow = Math.round(30 + km * 7);
  const taxiHigh = Math.round(35 + km * 10);
  const mid = Math.round((taxiLow + taxiHigh) / 2);
  return {
    mode: 'Taxi',
    duration_min: durationMin,
    cost_egp: mid,
    distance_km: Math.round(km * 100) / 100,
    costs: { taxi_low: taxiLow, taxi_high: taxiHigh },
    directions_url: '',
  };
}

function fmtHour(h) {
  let x = h;
  while (x >= 24) x -= 24;
  while (x < 0) x += 24;
  const hh = Math.floor(x);
  const mm = Math.round((x - hh) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function inferStopType(spot, arrivalHour) {
  const cats = (spot.categories || []).map((c) => String(c).toLowerCase());
  const isFood = cats.some((c) => FOOD_TAGS.has(c));
  if (!isFood) return 'Attraction';
  if (arrivalHour < 11) return 'Breakfast';
  if (arrivalHour < 16) return 'Lunch';
  if (arrivalHour < 18) return 'Coffee';
  return 'Dinner';
}

function mapActivityIcon(stopType, categories) {
  const t = (stopType || '').toLowerCase();
  if (t.includes('breakfast')) return 'breakfast';
  if (t.includes('lunch')) return 'food';
  if (t.includes('dinner')) return 'dinner';
  if (t.includes('coffee')) return 'coffee';
  if (t.includes('attraction')) {
    const FOOD_CATS = new Set([...FOOD_TAGS]);
    const isFood = (categories || []).some((c) => FOOD_CATS.has(String(c).toLowerCase()));
    return isFood ? 'food' : 'attraction';
  }
  return 'default';
}

/** Fallback retime if Flask coach endpoint unavailable */
function retimeOrderedSpotsFallback(orderedSpots, ctx) {
  let { startHour, endHour, startLat, startLon } = ctx;
  let endH = endHour;
  if (endH <= startHour) endH += 24;
  let curr = startHour;
  let prevLat = startLat;
  let prevLon = startLon;
  const stops = [];
  const timeLeft = () => endH - curr;

  for (const spot of orderedSpots) {
    const lat = spot.latitude;
    const lon = spot.longitude;
    if (lat == null || lon == null) continue;
    const km = haversineKm(prevLat, prevLon, lat, lon);
    const transport = transportFromKm(km);
    const travelHrs = (transport.duration_min || 0) / 60;
    if (timeLeft() < travelHrs + MIN_VISIT_HRS * 0.25) break;
    const arrivalHr = curr + travelHrs;
    const rawDur = Math.max(Number(spot.avg_visit_hrs) || 1.2, MIN_VISIT_HRS);
    let dur = Math.min(rawDur, Math.max(MIN_VISIT_HRS, timeLeft() - travelHrs));
    if (dur < MIN_VISIT_HRS) break;
    const stopType = inferStopType(spot, arrivalHr % 24);
    const cost = Number(spot.price_from) || 0;
    stops.push({
      time: fmtHour(arrivalHr),
      departure_time: fmtHour(curr),
      type: stopType,
      name: spot.name,
      id: String(spot.id),
      latitude: lat,
      longitude: lon,
      duration_hrs: Math.round(dur * 100) / 100,
      travel_duration_min: transport.duration_min,
      cost_egp: cost,
      distance_km: transport.distance_km,
      transport,
      transport_cost: transport.cost_egp || 0,
      address: spot.address || '',
      description: (spot.description || '').slice(0, 2000),
      rating: spot.rating || 0,
      categories: spot.categories || [],
      image_url: spot.image_url || '',
      open: 0,
      close: 24,
      price_from: Number(spot.price_from) || 0,
    });
    curr += travelHrs + dur;
    prevLat = lat;
    prevLon = lon;
  }
  return stops;
}

export function stopsToPlanActivities(stops) {
  const activities = [];
  if (stops.length > 0) {
    activities.push({
      id: 'start',
      time: stops[0].departure_time ?? '',
      title: 'Your Location',
      icon: '📍',
      category: 'start',
    });
  }
  stops.forEach((stop, index) => {
    activities.push({
      id: String(stop.id ?? `rec-${index}`),
      time: stop.time,
      title: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      duration_hrs: stop.duration_hrs,
      cost_egp: stop.cost_egp,
      transport: stop.transport,
      description: stop.description,
      rating: stop.rating,
      address: stop.address,
      categories: stop.categories,
      image_url: stop.image_url,
      open_hour: stop.open,
      close_hour: stop.close,
      price_from: stop.price_from,
      icon: mapActivityIcon(stop.type, stop.categories),
      category: stop.type,
    });
  });
  if (stops.length > 0) {
    const last = stops[stops.length - 1];
    let endTime = '';
    if (last.time && last.duration_hrs != null) {
      const [hStr, mStr] = last.time.split(':');
      const totalMins =
        parseInt(hStr, 10) * 60 +
        parseInt(mStr ?? '0', 10) +
        Math.round(Number(last.duration_hrs) * 60);
      endTime = `${Math.floor(totalMins / 60) % 24}:${String(totalMins % 60).padStart(2, '0')}`;
    }
    activities.push({
      id: 'end',
      time: endTime,
      title: 'End of Day',
      icon: '🌙',
      category: 'end',
    });
  }
  return activities;
}

async function fetchCatalogMerged(city, nearLat, nearLon) {
  const base = (city || '').toLowerCase();
  const seen = new Map();

  const pull = async (params) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${RECOMMENDATION_SERVICE}/attractions?${q}`);
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return;
    }
    if (!data.success || !Array.isArray(data.data)) return;
    for (const row of data.data) {
      if (row?.id && !seen.has(String(row.id))) seen.set(String(row.id), row);
    }
  };

  await pull({ city: base, limit: '120' });
  if (Number.isFinite(nearLat) && Number.isFinite(nearLon)) {
    await pull({
      city: base,
      limit: '80',
      near_lat: String(nearLat),
      near_lon: String(nearLon),
    });
  }
  return [...seen.values()];
}

function catalogById(list) {
  const m = new Map();
  for (const row of list) m.set(String(row.id), row);
  return m;
}

function interestScore(spot, interests) {
  if (!interests?.length) return 0;
  const cats = (spot.categories || []).map((c) => String(c).toLowerCase());
  let score = 0;
  for (const i of interests) {
    const il = String(i).toLowerCase();
    for (const c of cats) {
      if (c.includes(il) || il.includes(c)) score += 2;
    }
    if (String(spot.name || '').toLowerCase().includes(il)) score += 1;
  }
  return score;
}

function catalogPromptBlock(catalog, interests, maxLines = 100) {
  const sorted = [...catalog].sort(
    (a, b) => interestScore(b, interests) - interestScore(a, interests),
  );
  return sorted
    .slice(0, maxLines)
    .map((s) => {
      const cats = (s.categories || []).join(', ');
      return `- ${s.id} | ${s.name} | ${cats} | visit~${s.avg_visit_hrs}h | ${Math.round(s.price_from)}EGP`;
    })
    .join('\n');
}

function resolveStartCoords(city, startLat, startLon) {
  if (
    typeof startLat === 'number' &&
    typeof startLon === 'number' &&
    !Number.isNaN(startLat) &&
    !Number.isNaN(startLon)
  ) {
    return { lat: startLat, lon: startLon };
  }
  const key = String(city || '').toLowerCase().trim();
  const hit = CITY_CENTRE[key];
  if (hit) return { lat: hit[0], lon: hit[1] };
  return { lat: 26.82, lon: 30.8 };
}

function parseDaySchedules(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function recomputeBudgets(planDays, totalBudget, coachSpendOffset = 0) {
  const pool =
    Math.max(0, Number(totalBudget) || 0) - Math.max(0, Number(coachSpendOffset) || 0);
  let cumulative = 0;
  return planDays.map((d) => {
    const spent = (d.activities || [])
      .filter((a) => a.id !== 'start' && a.id !== 'end')
      .reduce((sum, a) => sum + (a.cost_egp ?? 0) + (a.transport?.cost_egp ?? 0), 0);
    cumulative += spent;
    return {
      ...d,
      budget_spent: spent,
      budget_remaining: pool - cumulative,
    };
  });
}

function cloneDayIds(planDays) {
  if (!planDays?.length) return [];
  return planDays.map((d) =>
    (d.activities || [])
      .filter((a) => a.id !== 'start' && a.id !== 'end')
      .map((a) => String(a.id)),
  );
}

function initSchedulesFromRaw(schedulesRaw, dayCount) {
  const parsed = parseDaySchedules(schedulesRaw);
  const out = [];
  const fallback = { start_hour: 9, end_hour: 21 };
  for (let i = 0; i < dayCount; i++) {
    const s = parsed[i] ?? parsed[parsed.length - 1] ?? fallback;
    out.push({
      start_hour: Number(s.start_hour ?? fallback.start_hour),
      end_hour: Number(s.end_hour ?? fallback.end_hour),
    });
  }
  return out;
}

function parseYmd(str) {
  if (!str || typeof str !== 'string') return null;
  const p = str.split('-').map(Number);
  if (p.length < 3 || !p[0]) return null;
  const d = new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTripDayLabel(d) {
  const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

function addCalendarDays(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function sumRecordExtraSpend(operations) {
  let total = 0;
  for (const op of operations) {
    if (String(op?.op) !== 'record_extra_spend') continue;
    const amt = Number(op.amount_egp);
    if (Number.isFinite(amt) && amt > 0) total += amt;
  }
  return total;
}

function opsRequirePlanRebuild(operations) {
  const need = new Set([
    'replace_day',
    'remove_stop',
    'insert_after',
    'move_stop',
    'remove_day',
    'add_day',
    'set_day_hours',
  ]);
  for (const op of operations) {
    if (need.has(String(op?.op || ''))) return true;
  }
  return false;
}

function applySequentialOperations(plan_days, schedulesRaw, operations) {
  const warnings = [];
  let dayIds = cloneDayIds(plan_days);
  let schedules = initSchedulesFromRaw(schedulesRaw, dayIds.length);

  const padSchedulesToDayIds = () => {
    const fb = { start_hour: 9, end_hour: 21 };
    while (schedules.length < dayIds.length) {
      const last = schedules[schedules.length - 1] || fb;
      schedules.push({ start_hour: last.start_hour, end_hour: last.end_hour });
    }
    if (schedules.length > dayIds.length) schedules = schedules.slice(0, dayIds.length);
  };

  for (const op of operations) {
    if (!op?.op) continue;
    const o = String(op.op);

    if (o === 'record_extra_spend') continue;

    if (o === 'set_day_hours') {
      const di = Number(op.day_index);
      padSchedulesToDayIds();
      if (!Number.isInteger(di) || di < 0 || di >= dayIds.length) continue;
      schedules[di] = {
        start_hour: Number(op.start_hour ?? 9),
        end_hour: Number(op.end_hour ?? 21),
      };
      continue;
    }

    if (o === 'remove_day') {
      const di = Number(op.day_index);
      if (!Number.isInteger(di) || di < 0 || di >= dayIds.length) continue;
      if (dayIds.length <= 1) {
        warnings.push('Cannot remove the only remaining day in the trip.');
        continue;
      }
      dayIds.splice(di, 1);
      schedules.splice(di, 1);
      continue;
    }

    if (o === 'add_day') {
      let at = op.insert_at_index;
      at = at == null || at === '' ? dayIds.length : Number(at);
      if (!Number.isInteger(at) || at < 0) at = dayIds.length;
      at = Math.min(at, dayIds.length);
      padSchedulesToDayIds();
      const template =
        schedules[Math.max(0, at - 1)] ?? schedules[0] ?? { start_hour: 9, end_hour: 21 };
      const ids = [...(op.ordered_ids || [])].map(String);
      dayIds.splice(at, 0, ids);
      schedules.splice(at, 0, {
        start_hour: Number(template.start_hour),
        end_hour: Number(template.end_hour),
      });
      continue;
    }

    if (o === 'replace_day') {
      const di = Number(op.day_index);
      if (Number.isInteger(di) && di >= 0 && di < dayIds.length) {
        dayIds[di] = [...(op.ordered_ids || [])].map(String);
      }
      continue;
    }

    if (o === 'remove_stop') {
      const di = Number(op.day_index);
      const aid = String(op.activity_id ?? '');
      const n = dayIds.length;
      if (!aid || !Number.isInteger(di) || di < 0 || di >= n) continue;
      dayIds[di] = dayIds[di].filter((x) => x !== aid);
      continue;
    }

    if (o === 'insert_after') {
      const di = Number(op.day_index);
      const after = String(op.after_activity_id ?? 'start');
      const inserts = [...(op.insert_ids || [])].map(String);
      const n = dayIds.length;
      if (!Number.isInteger(di) || di < 0 || di >= n || !inserts.length) continue;
      let idx = 0;
      if (after !== 'start') {
        const i = dayIds[di].indexOf(after);
        idx = i >= 0 ? i + 1 : dayIds[di].length;
      }
      for (const ins of inserts) {
        dayIds[di] = dayIds[di].filter((x) => x !== ins);
        dayIds[di].splice(idx, 0, ins);
        idx += 1;
      }
      continue;
    }

    if (o === 'move_stop') {
      const id = String(op.activity_id ?? '');
      const from = Number(op.from_day_index);
      const to = Number(op.to_day_index);
      const after = String(op.after_activity_id ?? 'start');
      const n = dayIds.length;
      if (
        !id ||
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        from >= n ||
        to < 0 ||
        to >= n
      ) {
        continue;
      }
      dayIds[from] = dayIds[from].filter((x) => x !== id);
      let idx = 0;
      if (after !== 'start') {
        const i = dayIds[to].indexOf(after);
        idx = i >= 0 ? i + 1 : dayIds[to].length;
      }
      dayIds[to] = dayIds[to].filter((x) => x !== id);
      dayIds[to].splice(idx, 0, id);
    }
  }

  padSchedulesToDayIds();
  return { dayIds, schedules, warnings };
}

function suggestIdsForEmptyDays(dayIds, catalog, interests, allowedIds, warnings) {
  const out = dayIds.map((ids) => [...ids]);
  const used = new Set(out.flat().map(String));
  for (let i = 0; i < out.length; i++) {
    if (out[i].length > 0) continue;
    const sugg = [];
    const sorted = [...catalog].sort(
      (a, b) => interestScore(b, interests) - interestScore(a, interests),
    );
    for (const s of sorted) {
      if (sugg.length >= 6) break;
      const id = String(s.id);
      if (!allowedIds.has(id) || used.has(id)) continue;
      sugg.push(id);
      used.add(id);
    }
    if (sugg.length === 0) {
      warnings.push(`Day ${i + 1}: no stops — could not suggest places from the catalog.`);
    } else {
      warnings.push(
        `Day ${i + 1}: auto-filled ${sugg.length} database picks ranked by the user's interests.`,
      );
    }
    out[i] = sugg;
  }
  return out;
}

function detectDroppedIds(orderedIds, itinerary) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return [];
  if (!Array.isArray(itinerary) || itinerary.length === 0) return orderedIds.map(String);
  const kept = new Set(
    itinerary
      .map((s) => {
        if (!s) return null;
        const id = s.id ?? s.attraction_id;
        return id != null ? String(id) : null;
      })
      .filter(Boolean),
  );
  return orderedIds.map(String).filter((id) => !kept.has(id));
}

async function flaskRetimeDay(body) {
  const res = await fetch(`${RECOMMENDATION_SERVICE}/coach/retime-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
  if (!res.ok || !data.success) return null;
  return data;
}

function stripJsonFence(text) {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/s, '');
  }
  return t.trim();
}

function buildReplyWithNotices(reply, optimizationWarnings, modelNotice, modelFlag) {
  const parts = [reply];
  if (modelNotice && String(modelNotice).trim()) {
    parts.push(`\n\nNote: ${String(modelNotice).trim()}`);
  }
  if (modelFlag) {
    parts.push(
      '\n\nThis change can make your day less optimized (more travel time, cost, or backtracking) than our automatic planner would choose.',
    );
  }
  if (optimizationWarnings?.length) {
    parts.push('\n\n' + optimizationWarnings.map((w) => `• ${w}`).join('\n'));
  }
  return parts.join('');
}

export async function runPlanCoach({
  messages,
  plan_days,
  city,
  interests,
  day_schedules,
  is_foreigner,
  start_lat,
  start_lon,
  budget,
  start_date,
  existing_coach_extra_spend_egp,
}) {
  const coords = resolveStartCoords(city, start_lat, start_lon);
  const catalog = await fetchCatalogMerged(city, coords.lat, coords.lon);
  if (!catalog.length) {
    return {
      success: false,
      error: 'Could not load places for this city. Is the recommendation service running?',
    };
  }

  const byId = catalogById(catalog);
  const allowedIds = new Set([...byId.keys()]);
  const catalogText = catalogPromptBlock(catalog, interests);

  const planSummary = (plan_days || []).map((d) => ({
    day: d.day,
    date: d.date,
    stops: (d.activities || [])
      .filter((a) => a.id !== 'start' && a.id !== 'end')
      .map((a) => ({ id: a.id, time: a.time, title: a.title })),
  }));

  const system = `You are TourMate Plan Coach — connected to the user's LIVE trip plan for ${city}. You read CURRENT_PLAN_JSON and can change it with structured operations.

User interests (rank database picks): ${(interests || []).join(', ') || 'general'}.
Visitor type: ${is_foreigner ? 'international visitor' : 'local / Egyptian'}.

CAPABILITIES (mention when relevant; if the user asks "what can you do?" or similar, list these plainly):
• Modify the schedule: add/remove/reorder days and stops, move a stop to another day, swap restaurants or sights (ids only from VALID_PLACES).
• Adjust timing: use set_day_hours when they say they start late, end early, or want different day hours — times are recomputed for that day.
• Track extra spending: record_extra_spend for taxis, tips, or unplanned costs so remaining budget in the preview drops.
• Act as a local guide: answer questions about Egypt, history, culture, or practical tips in "reply" even when operations is empty.

RULES:
1) Be concise and practical. Prefer short actionable replies; when helpful, add one or two proactive suggestions (e.g. a better order or a nearby VALID_PLACES alternative).
2) Places MUST ONLY use attraction ids from VALID_PLACES. Never invent ids.
3) Operations apply IN ORDER; day_index always refers to the plan state AFTER previous operations in the same list.
4) Output JSON field "operations" as an array. Allowed ops (combine as needed):
   - { "op": "replace_day", "day_index": <0-based>, "ordered_ids": ["…"] } — full ordered stops that day (no start/end ids).
   - { "op": "remove_stop", "day_index": <int>, "activity_id": "<id>" }
   - { "op": "insert_after", "day_index": <int>, "after_activity_id": "start" | "<id>", "insert_ids": ["…"] }
   - { "op": "move_stop", "activity_id": "<id>", "from_day_index": <int>, "to_day_index": <int>, "after_activity_id": "start" | "<id>" }
   - { "op": "remove_day", "day_index": <0-based> } — removes an entire day and shifts later days; cannot remove the last remaining day. IMPORTANT: Never guess day_index. Only use remove_day if the user clearly identifies which day (e.g. "day 2", "second day", a date from the plan, or "the day that only has X"). If they say "remove a day" / "delete one day" without specifying which, reply briefly asking which day (list options from CURRENT_PLAN_JSON: Day 1 … Day N with dates) and use "operations": [] until they answer.
   - { "op": "add_day", "insert_at_index": <0-based, default append>, "ordered_ids": ["…"] } — new day at position; use ordered_ids from VALID_PLACES matched to interests. If the user wants a new day but does not name places, still pick ordered_ids from the list (never invent). You may use an empty ordered_ids only when you intend the server to auto-fill from interests (prefer you choosing ids yourself).
   - { "op": "set_day_hours", "day_index": <int>, "start_hour": <number>, "end_hour": <number> } — e.g. start at 11 instead of 9.
   - { "op": "record_extra_spend", "amount_egp": <number>, "note": "<optional>" } — reduces remaining budget in the preview (no retime).
5) If a change would hurt route optimization, STILL apply it if the user asked, but set request_reduces_optimization: true and optimization_notice (one short sentence).
6) If no plan edits or budget record: "operations": [].
7) "reply" is plain text only (no markdown fences).
8) When the user only asks for a timing or scheduling adjustment (e.g. start later, end earlier, change hours), reply with ONLY a confirmation of the change. Do NOT suggest additional places, activities, or tips unless the user explicitly asks.

VALID_PLACES:
${catalogText}

CURRENT_PLAN_JSON:
${JSON.stringify(planSummary)}

Respond with one JSON object: reply (string), operations (array), request_reduces_optimization (optional boolean), optimization_notice (optional string).`;

  if (!process.env.GROQ_API_KEY_COACH) {
    return { success: false, error: 'GROQ_API_KEY_COACH is not configured' };
  }

  const groqMessages = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY_COACH}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      max_tokens: 3072,
      temperature: 0.35,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    console.error('Plan coach Groq:', JSON.stringify(data));
    return { success: false, error: 'No response from AI' };
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    return {
      success: true,
      reply: raw,
      plan_days_preview: null,
      optimization_warnings: [],
      day_schedules_preview: null,
      end_date_preview: null,
      coach_extra_spend_total_preview: 0,
    };
  }

  let reply = typeof parsed.reply === 'string' ? parsed.reply : 'Here is an update for your plan.';
  const operations = Array.isArray(parsed.operations) ? parsed.operations : [];
  const modelNotice =
    typeof parsed.optimization_notice === 'string' ? parsed.optimization_notice.trim() : '';
  const modelFlag = Boolean(parsed.request_reduces_optimization);

  const totalBudget = Number(budget) || 0;
  const existingExtra = Math.max(0, Number(existing_coach_extra_spend_egp) || 0);
  const batchExtra = sumRecordExtraSpend(operations);
  const spendOffset = existingExtra + batchExtra;

  const canBootstrap =
    operations.some((o) => String(o?.op) === 'add_day') && !plan_days?.length;

  if (!operations.length) {
    return {
      success: true,
      reply: buildReplyWithNotices(reply, [], modelNotice, modelFlag),
      plan_days_preview: null,
      optimization_warnings: [],
      day_schedules_preview: null,
      end_date_preview: null,
      coach_extra_spend_total_preview: existingExtra,
    };
  }

  if (!plan_days?.length && !canBootstrap) {
    return {
      success: true,
      reply: buildReplyWithNotices(reply, [], modelNotice, modelFlag),
      plan_days_preview: null,
      optimization_warnings: [],
      day_schedules_preview: null,
      end_date_preview: null,
      coach_extra_spend_total_preview: existingExtra,
    };
  }

  const emptyReply = {
    success: true,
    reply: buildReplyWithNotices(reply, [], modelNotice, modelFlag),
    plan_days_preview: null,
    optimization_warnings: [],
    day_schedules_preview: null,
    end_date_preview: null,
    coach_extra_spend_total_preview: existingExtra,
  };

  const needsRebuild = opsRequirePlanRebuild(operations);

  if (!needsRebuild && batchExtra <= 0) {
    return emptyReply;
  }

  if (!needsRebuild && batchExtra > 0) {
    const nextClone = (plan_days || []).map((d) => ({
      ...d,
      activities: [...(d.activities || [])],
    }));
    const merged = buildReplyWithNotices(reply, [], modelNotice, modelFlag);
    const anchor = parseYmd(start_date);
    const endPrev =
      anchor && nextClone.length
        ? formatYmd(addCalendarDays(anchor, Math.max(0, nextClone.length - 1)))
        : null;
    return {
      success: true,
      reply: merged,
      plan_days_preview: recomputeBudgets(nextClone, totalBudget, spendOffset),
      optimization_warnings: [],
      day_schedules_preview: null,
      end_date_preview: endPrev,
      coach_extra_spend_total_preview: spendOffset,
    };
  }

  const { dayIds: rawDayIds, schedules, warnings: opWarnings } = applySequentialOperations(
    plan_days,
    day_schedules,
    operations,
  );
  let dayIds = suggestIdsForEmptyDays(
    rawDayIds,
    catalog,
    interests,
    allowedIds,
    opWarnings,
  );

  const badIds = [];
  for (const row of dayIds) {
    for (const id of row) {
      if (!allowedIds.has(String(id))) badIds.push(String(id));
    }
  }
  if (badIds.length) {
    return {
      success: true,
      reply: `${reply}\n\n(I could not prepare that edit: these ids are not in our database for ${city})`,
      plan_days_preview: null,
      optimization_warnings: [],
      day_schedules_preview: null,
      end_date_preview: null,
      coach_extra_spend_total_preview: existingExtra,
    };
  }

  const startAnchor = parseYmd(start_date) || new Date();
  const numDays = dayIds.length;
  const pool = Math.max(0, totalBudget - spendOffset);
  const budgetPerDay = pool / Math.max(1, numDays);

  const next = dayIds.map((ids, i) => ({
    day: i + 1,
    date: formatTripDayLabel(addCalendarDays(startAnchor, i)),
    activities: [],
  }));

  const allWarnings = [...opWarnings];

  for (let di = 0; di < dayIds.length; di++) {
    const ordered_ids = dayIds[di];
    const spots = ordered_ids.map((id) => byId.get(String(id))).filter(Boolean);
    if (!spots.length) {
      allWarnings.push(`Day ${di + 1}: no stops to schedule.`);
      continue;
    }
    const sch = schedules[di] || {};
    const startHour = Number(sch.start_hour ?? 9);
    const endHour = Number(sch.end_hour ?? 21);

    const flaskBody = {
      city,
      ordered_ids,
      start_hour: startHour,
      end_hour: endHour,
      current_lat: coords.lat,
      current_lon: coords.lon,
      is_foreigner: Boolean(is_foreigner),
      budget_egp: budgetPerDay,
    };

    let itinerary = null;
    const flask = await flaskRetimeDay(flaskBody);
    if (flask?.itinerary?.length) {
      itinerary = flask.itinerary;
      if (Array.isArray(flask.warnings)) allWarnings.push(...flask.warnings);
    } else {
      const stops = retimeOrderedSpotsFallback(spots, {
        startHour,
        endHour,
        city,
        startLat: coords.lat,
        startLon: coords.lon,
      });
      itinerary = stops;
      allWarnings.push(
        'Route times used a fallback estimator (recommendation service unreachable).',
      );
    }

    const dropped = detectDroppedIds(ordered_ids, itinerary);
    if (dropped.length) {
      const droppedNames = dropped.map((id) => byId.get(String(id))?.name || id);
      allWarnings.push(
        `Day ${di + 1}: ${droppedNames.length} stop(s) could not fit your day hours and were removed in the preview: ${droppedNames
          .slice(0, 6)
          .join(', ')}${droppedNames.length > 6 ? '…' : ''}`,
      );
    }

    next[di] = {
      ...next[di],
      activities: stopsToPlanActivities(itinerary),
    };
  }

  const mergedWarnings = [...new Set(allWarnings.filter(Boolean))];
  reply = buildReplyWithNotices(reply, mergedWarnings, modelNotice, modelFlag);

  const endDatePreview =
    next.length > 0 ? formatYmd(addCalendarDays(startAnchor, Math.max(0, next.length - 1))) : null;

  return {
    success: true,
    reply,
    plan_days_preview: recomputeBudgets(next, totalBudget, spendOffset),
    optimization_warnings: mergedWarnings,
    day_schedules_preview: schedules,
    end_date_preview: endDatePreview,
    coach_extra_spend_total_preview: spendOffset,
  };
}
