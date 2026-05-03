// app/(main)/itinerary.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Modal, TextInput,
  Alert, Dimensions, KeyboardAvoidingView, Platform,Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../constants/AppContext';
import { Attraction } from '../../constants/types';
import AttractionSheet from '../../components/AttractionSheet';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

// ── Types ─────────────────────────────────────────────────────────────
interface Activity {
  id: string;
  time: string;
  title: string;
  icon: string;
  category: string;
  latitude?: number;
  longitude?: number;
  duration_hrs?: number;
  cost_egp?: number;
  transport?: any;
  description?: string;
  rating?: number;
  address?: string;
  categories?: string[];
}

interface RecommendationStop {
  id?: string;
  time: string;
  departure_time?: string;
  type: string;
  name: string;
  latitude?: number;
  longitude?: number;
  duration_hrs?: number;
  cost_egp?: number;
  travel_duration_min?: number;
  transport?: any;
  description?: string;
  rating?: number;
  address?: string;
  categories?: string[];
}

interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
  budget_spent?: number;
  budget_remaining?: number;
  summary?: string;
}

// ── 24h → 12h clock ──────────────────────────────────────────────────
const formatTime12 = (time: string): string => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
};

// ── Category → vector icon ────────────────────────────────────────────
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_MAP: Record<string, { name: MCIconName; color: string }> = {
  breakfast:  { name: 'silverware-fork-knife',  color: '#FF8C00' },
  food:       { name: 'silverware-fork-knife',  color: '#FF8C00' },
  dinner:     { name: 'silverware-fork-knife',  color: '#FF8C00' },
  coffee:     { name: 'coffee',                 color: '#A0522D' },
  attraction: { name: 'map-marker-radius',      color: '#FF8C00' },
  transport:  { name: 'car-side',               color: '#666666' },
  end:        { name: 'moon-waning-crescent',   color: '#483D8B' },
  default:    { name: 'map-marker',             color: '#E67E22' },
};

const getCategoryIcon = (iconType: string, size = 20) => {
  const entry = ICON_MAP[iconType] ?? ICON_MAP.default;
  return <MaterialCommunityIcons name={entry.name} size={size} color={entry.color} />;
};

// ── Travel Connector (shown between stops) ────────────────────────────
const TravelConnector: React.FC<{ transport: any }> = ({ transport }) => {
  const dur      = transport?.duration_min ? `${Math.round(transport.duration_min)} min` : null;
  const mode     = transport?.mode ?? '';
  const costs    = transport?.costs;
  const costText = mode === 'Walk'
    ? 'Free · walking'
    : costs
      ? `${costs.taxi_low}–${costs.taxi_high} EGP · Taxi`
      : null;
  const parts = [dur, costText].filter(Boolean).join('  ·  ');
  const travelIcon = mode === 'Walk'
    ? <MaterialCommunityIcons name="walk"     size={14} color="#A06020" />
    : <MaterialCommunityIcons name="car-side" size={14} color="#A06020" />;

  return (
    <View style={travelStyles.connector}>
      <View style={travelStyles.line} />
      <View style={travelStyles.badge}>
        {travelIcon}
        <Text style={travelStyles.text}>{parts}</Text>
      </View>
      <View style={travelStyles.line} />
    </View>
  );
};

const travelStyles = StyleSheet.create({
  connector: { flexDirection: 'row', alignItems: 'center', marginLeft: 60, marginVertical: 2, marginRight: 16 },
  line:   { flex: 1, height: 1, backgroundColor: '#EEE' },
  badge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F9F5F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 6 },
  icon:   { fontSize: 13 },
  text:   { fontSize: 11, fontWeight: '600', color: '#A06020' },
});

// ── Starting Location Row ─────────────────────────────────────────────
const StartRow: React.FC<{ time: string; label?: string; onPress: () => void }> = ({ time, label, onPress }) => (
  <View style={startStyles.row}>
    <View style={startStyles.timeCol}>
      <Text style={startStyles.time}>{formatTime12(time)}</Text>
    </View>
    <View style={startStyles.line}>
      <View style={startStyles.dot} />
    </View>
    <TouchableOpacity style={startStyles.card} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name="map-marker" size={18} color="#E67E22" />
      <Text style={startStyles.label} numberOfLines={1}>{label ?? 'Your Location'}</Text>
      <Text style={startStyles.editHint}>✎</Text>
    </TouchableOpacity>
  </View>
);

const startStyles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timeCol:  { width: 48, paddingTop: 4 },
  time:     { fontSize: 12, color: '#999', fontWeight: '500' },
  editHint: { fontSize: 13, color: '#E67E22', marginLeft: 'auto' },
  line:    { width: 24, alignItems: 'center', paddingTop: 6 },
  dot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E67E22', borderWidth: 3, borderColor: '#FFF3E0' },
  card:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 10, marginLeft: 8 },
  icon:    { fontSize: 16 },
  label:   { fontSize: 14, fontWeight: '700', color: '#E67E22' },
});

// ── End of Day Row ────────────────────────────────────────────────────
const EndOfDayRow: React.FC<{ time?: string }> = ({ time }) => (
  <View style={eodStyles.row}>
    <View style={eodStyles.timeCol}>
      {time ? <Text style={eodStyles.time}>{formatTime12(time)}</Text> : null}
    </View>
    <View style={eodStyles.line}>
      <View style={eodStyles.dot} />
    </View>
    <View style={eodStyles.card}>
      <MaterialCommunityIcons name="moon-waning-crescent" size={18} color="#3949AB" />
      <Text style={eodStyles.label}>End of Day</Text>
    </View>
  </View>
);

const eodStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16 },
  timeCol: { width: 48, paddingTop: 4 },
  time:    { fontSize: 12, color: '#999', fontWeight: '500' },
  line:    { width: 24, alignItems: 'center', paddingTop: 6 },
  dot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: '#5C6BC0', borderWidth: 3, borderColor: '#EEF0FF' },
  card:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF0FF', borderRadius: 12, padding: 10, marginLeft: 8 },
  icon:    { fontSize: 16 },
  label:   { fontSize: 14, fontWeight: '700', color: '#3949AB' },
});

// ── Activity Row ──────────────────────────────────────────────────────
const ActivityRow: React.FC<{
  activity: Activity;
  onDelete: (id: string) => void;
  onPress: () => void;
}> = ({ activity, onDelete, onPress }) => (
  <View style={styles.activityRow}>
    <View style={styles.activityTimeCol}>
      <Text style={styles.activityTime}>{formatTime12(activity.time)}</Text>
    </View>
    <View style={styles.activityLine}>
      <View style={styles.activityDot} />
      <View style={styles.activityConnector} />
    </View>
    <TouchableOpacity style={styles.activityContent} onPress={onPress} activeOpacity={0.72}>
      <Text style={styles.activityTitle}>{activity.title}</Text>
      {(activity.duration_hrs != null || activity.cost_egp != null) && (
        <View style={styles.activityMeta}>
          {activity.duration_hrs != null && (
            <View style={styles.activityMetaChip}>
              <Text style={styles.activityMetaText}>
                {activity.duration_hrs >= 1
                  ? `${activity.duration_hrs.toFixed(1)} hr`
                  : `${Math.round(activity.duration_hrs * 60)} min`}
              </Text>
            </View>
          )}
          {activity.cost_egp != null && activity.cost_egp > 0 && (
            <View style={[styles.activityMetaChip, styles.activityMetaChipCost]}>
              <Text style={[styles.activityMetaText, styles.activityMetaTextCost]}>
                ~{Math.round(activity.cost_egp)} EGP
              </Text>
            </View>
          )}
          {activity.cost_egp === 0 && (
            <View style={[styles.activityMetaChip, styles.activityMetaChipFree]}>
              <Text style={[styles.activityMetaText, styles.activityMetaTextFree]}>Free</Text>
            </View>
          )}
        </View>
      )}
      <Text style={styles.activityTapHint}>Tap for details →</Text>
    </TouchableOpacity>
    <View style={styles.activityIconBox}>
      {getCategoryIcon(activity.icon)}
    </View>
    <TouchableOpacity onPress={() => onDelete(activity.id)} style={styles.deleteBtn}>
      <Text style={styles.deleteIcon}>✕</Text>
    </TouchableOpacity>
  </View>
);

// ── ITINERARY SCREEN ──────────────────────────────────────────────────
export default function ItineraryScreen() {
  const router = useRouter();
  const { t } = useApp();
  const params = useLocalSearchParams<{
    planId?: string;
    city: string;
    startDate: string;
    endDate: string;
    daySchedules?: string;
    budget: string;
    startTime?: string;  // ← ADD
    endTime?: string;
    dayHours: string;
    interests: string;
    spotIds: string;
    favoritedIds: string;
    savedItinerary: string; // JSON-encoded DayPlan[] passed from saved-plans screen
    startLat?: string;
    startLon?: string;
    startLabel?: string;
  }>();
  const existingPlanId = params.planId ? String(params.planId) : undefined;

  const city = params.city ?? 'Hurghada';
  const interests = params.interests?.split(',') ?? [];
  const startDate = params.startDate ?? new Date().toISOString();
  const endDate = params.endDate ?? new Date().toISOString();

  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  const [days, setDays] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // ── Full attraction sheet (photo gallery, audio guide, etc.) ─────────
  const [sheetAttraction, setSheetAttraction]   = useState<Attraction | null>(null);
  const [showAttractionSheet, setShowAttractionSheet] = useState(false);
  const [sheetLoading, setSheetLoading]         = useState(false);
  const [userLocation, setUserLocation]         = useState<{ latitude: number; longitude: number } | null>(null);

  // Capture userLocation once for "Get There"
  useEffect(() => {
    if (params.startLat && params.startLon) {
      setUserLocation({ latitude: parseFloat(params.startLat), longitude: parseFloat(params.startLon) });
    } else {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status === 'granted') {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => {
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  // Fetch full attraction and open the rich sheet
  const openAttractionSheet = async (activity: Activity) => {
    setSheetLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/attractions/${activity.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSheetAttraction(data.data);
        setShowAttractionSheet(true);
      } else {
        // Fallback: show simple detail modal
        setSelectedActivity(activity);
      }
    } catch {
      setSelectedActivity(activity);
    } finally {
      setSheetLoading(false);
    }
  };

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationLabel, setLocationLabel] = useState(params.startLabel ?? 'Your Location');
  const [locationInput, setLocationInput] = useState('');
  const [locationSearching, setLocationSearching] = useState(false);

  // Load userId from AsyncStorage on mount
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const id = raw ? JSON.parse(raw).id : 1;
        setUserId(id);
      } catch (err) {
        console.error('UserId load error:', err);
        setUserId(1);
      }
    };
    loadUserId();
  }, []);

  useEffect(() => {
    // If a saved itinerary was passed in, load it directly — skip the API call
    try {
      if (params.savedItinerary) {
        const saved = JSON.parse(params.savedItinerary) as DayPlan[];
        // Only treat as a saved plan when it's a genuine non-empty array
        if (Array.isArray(saved) && saved.length > 0) {
          setDays(saved);
          setPlanSaved(true);
          const needsSummary = saved.some(
            d => !d.summary && d.activities.some(a => a.id !== 'start' && a.id !== 'end')
          );
          if (needsSummary) generateDaySummaries(saved);
          setLoading(false);
          return;
        }
      }
    } catch {
      // malformed JSON — fall through to generatePlan
    }

    (async () => {
      // If the plan form already captured the user's location, use it directly
      if (params.startLat && params.startLon) {
        userLocationRef.current = { lat: parseFloat(params.startLat), lon: parseFloat(params.startLon) };
      } else {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            userLocationRef.current = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          }
        } catch (_) {
          // GPS unavailable — recommender falls back to city centre
        }
      }
      generatePlan();
    })();
  }, []);

  // Convert one day's API stops → Activity[]
  const stopsToActivities = (stops: RecommendationStop[]): Activity[] => {
    const activities: Activity[] = [];
    if (stops.length > 0) {
      activities.push({
        id: 'start',
        time: stops[0].departure_time ?? '',
        title: 'Your Location',
        icon: '📍',
        category: 'start',
      });
    }
    const seenIds = new Set<string>();
    stops.forEach((stop, index) => {
      const rawId = stop.id ?? `rec-${index}`;
      // Deduplicate: if the backend somehow returns the same stop twice, skip the second
      if (seenIds.has(rawId)) return;
      seenIds.add(rawId);
      activities.push({
        id: rawId,
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
        icon: (() => {
          if (stop.type.includes('Breakfast')) return 'breakfast';
          if (stop.type.includes('Lunch'))     return 'food';
          if (stop.type.includes('Dinner'))    return 'dinner';
          if (stop.type.includes('Coffee'))    return 'coffee';
          if (stop.type.includes('Attraction')) {
            const FOOD_CATS = new Set(['restaurant','cafe','food','seafood','grills','local','international','bakery','dessert']);
            const isFood = stop.categories?.some(c => FOOD_CATS.has(c.toLowerCase()));
            return isFood ? 'food' : 'attraction';
          }
          return 'default';
        })(),
        category: stop.type,
      });
    });

    // Compute end-of-day time: last stop's arrival + duration
    if (stops.length > 0) {
      const last = stops[stops.length - 1];
      let endTime = '';
      if (last.time && last.duration_hrs != null) {
        const [hStr, mStr] = last.time.split(':');
        const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr ?? '0', 10) + Math.round(last.duration_hrs * 60);
        endTime = `${Math.floor(totalMins / 60) % 24}:${String(totalMins % 60).padStart(2, '0')}`;
      }
      activities.push({ id: 'end', time: endTime, title: 'End of Day', icon: '🌙', category: 'end' });
    }

    return activities;
  };

  // ── Location helpers ─────────────────────────────────────────────────
  const applyGPS = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      userLocationRef.current = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setLocationLabel('Your Location');
      setShowLocationModal(false);
      generatePlan();
    } catch {
      Alert.alert('Error', 'Could not get GPS location.');
    }
  };

  const applyAddress = async (): Promise<void> => {
    const query = locationInput.trim();
    if (!query) return;
    setLocationSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'TourMate/1.0' } });
      const data = await res.json();
      if (!data.length) { Alert.alert('Not found', 'Could not find that address. Try being more specific.'); return; }
      const { lat, lon, display_name } = data[0];
      userLocationRef.current = { lat: parseFloat(lat), lon: parseFloat(lon) };
      const shortLabel = display_name.split(',').slice(0, 2).join(', ');
      setLocationLabel(shortLabel);
      setLocationInput('');
      setShowLocationModal(false);
      generatePlan();
    } catch {
      Alert.alert('Error', 'Could not geocode address.');
    } finally {
      setLocationSearching(false);
    }
  };

  const generatePlan = async (): Promise<void> => {
    setLoading(true);
    try {
      // Parse dates safely — handles both "2025-04-05" and "2025-4-5" formats
      const parseDate = (str: string): Date => {
        const parts = str.split('-').map(Number);
        return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
      };
      const start    = parseDate(startDate);
      const end      = parseDate(endDate);
      const dayCount = Math.max(1, Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1);
      const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const totalBudget = Number(params.budget ?? 1000);

      const allDays: DayPlan[]   = [];
      const visitedIds: string[] = [];
      let cumulativeSpent = 0;

      // Liked IDs are fixed for the entire trip — compute once outside the loop
      const addedIds0 = params.spotIds?.split(',').filter(Boolean) ?? [];
      const favIds0   = params.favoritedIds?.split(',').filter(Boolean) ?? [];

      // Also include attractions the user saved from the home screen
      let savedFavIds: string[] = [];
      try {
        const favRes  = await fetch(`${API_BASE}/attractions/favorites/${userId ?? 1}`);
        const favData = await favRes.json();
        savedFavIds   = (favData.data ?? [])
          .map((a: any) => a.attraction_id)
          .filter(Boolean);
      } catch { /* favorites fetch failure is non-fatal */ }

      const likedIds0 = [...new Set([...addedIds0, ...favIds0, ...savedFavIds])];

      // Tracks liked attractions that have actually been placed in a day's itinerary.
      // Unscheduled liked IDs stay OUT of visited_ids so the backend can still place them.
      // Once scheduled they go IN so they don't repeat on subsequent days.
      const scheduledLikedIds = new Set<string>();

      // Area hints built after Day 1 for subsequent days
      let areaHint: { preferred_area_lat: number; preferred_area_lon: number; preferred_area_radius_km: number } | null = null;
      // Cuisine categories already eaten — passed to each day so the backend avoids repeating them
      const eatenMealCategories: string[] = [];

      for (let d = 0; d < dayCount; d++) {
        const dayDate = new Date(start);
        dayDate.setDate(start.getDate() + d);
        const label = `${MONTH_LABELS[dayDate.getMonth()]} ${dayDate.getDate()}`;

        const remainingBudget = totalBudget - cumulativeSpent;
        const remainingDays   = dayCount - d;
        const budgetToday     = Math.floor(remainingBudget / remainingDays);

        // Liked attractions that are already scheduled go into visited_ids (no repeats).
        // Liked attractions not yet scheduled stay out (backend can still place them).
        const dayVisited = visitedIds.filter(id =>
          !likedIds0.includes(id) || scheduledLikedIds.has(id)
        );

        try {
          // Parse start/end time from params e.g. "09:00" → 9.0
          const parsedSchedules = JSON.parse(params.daySchedules || '[]');

          const daySchedule = parsedSchedules[d];

          let startHour = daySchedule?.start_hour ?? 9;
          let endHour   = daySchedule?.end_hour ?? 21;

          // ✅ handle overnight (e.g. 18 → 1 AM)
          let availableHoursToday = endHour - startHour;

          if (endHour <= startHour) {
            endHour += 24;
          }
          
          const itineraryPayload: Record<string, any> = {
            user_id: 1,
            name: 'TourMate User',
            city,
            interests,
            budget_egp: budgetToday,
            available_hours: availableHoursToday,  // ← from time range
            liked_ids: likedIds0,
            visited_ids: dayVisited,
            top_n: Math.max(20, Math.ceil(availableHoursToday * 3) + likedIds0.length),
            browse_n: 5,
            start_hour: startHour,   // ← from time range
            end_hour: endHour,       // ← NEW
            ...(userLocationRef.current && {
              current_lat: userLocationRef.current.lat,
              current_lon: userLocationRef.current.lon,
            }),
            ...(d > 0 && areaHint ? areaHint : {}),
            ...(d > 0 && eatenMealCategories.length ? { eaten_meal_categories: eatenMealCategories } : {}),
          };

          // DEBUG — confirm liked_ids reaches the API correctly
          console.log(`[ITINERARY] Day ${d + 1} API payload:`);
          console.log('  liked_ids (added):', addedIds0);
          console.log('  liked_ids (favorited):', favIds0);
          console.log('  liked_ids (merged):', likedIds0);
          console.log('  visited_ids (dayVisited):', dayVisited);
          console.log('  budget_egp:', budgetToday, '| available_hours:', availableHoursToday);
          if (d > 0 && areaHint) console.log('  areaHint:', areaHint);

          const response = await fetch(`${API_BASE}/recommendations/itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itineraryPayload),
          });

          const payload = await response.json();

          if (payload.success && payload.data?.itinerary?.length) {
            const data      = payload.data;
            const itinerary = data.itinerary as RecommendationStop[];
            const daySpent  = Number(data.stats?.total_cost_egp ?? 0);
            cumulativeSpent += daySpent;

            allDays.push({
              day:              d + 1,
              date:             label,
              activities:       stopsToActivities(itinerary),
              budget_spent:     daySpent,
              budget_remaining: totalBudget - cumulativeSpent,
            });

            const CUISINE_DIVERSITY_CATS = new Set(['seafood','grills','nile view','waterfront','bakery','dessert','cafe']);
            for (const stop of itinerary) {
              if (!stop.id) continue;
              // Mark liked attractions as scheduled so they won't repeat on later days
              if (likedIds0.includes(stop.id)) {
                scheduledLikedIds.add(stop.id);
                console.log(`[LIKED] ✓ Scheduled on Day ${d + 1}: "${stop.name}" (${stop.id}) — removed from pending liked pool`);
              }
              if (!visitedIds.includes(stop.id)) visitedIds.push(stop.id);
              // Collect cuisine categories from meal stops for cross-day diversity
              const isMeal = stop.type?.includes('Lunch') || stop.type?.includes('Dinner');
              if (isMeal && stop.categories) {
                stop.categories
                  .map(c => c.toLowerCase())
                  .filter(c => CUISINE_DIVERSITY_CATS.has(c) && !eatenMealCategories.includes(c))
                  .forEach(c => eatenMealCategories.push(c));
              }
            }

            // After Day 1: cluster the recommended attractions by proximity → area hint for Day 2+
            if (d === 0 && data.recommended_attractions?.length) {
              const recs = data.recommended_attractions as Array<{ id?: string; latitude?: number; longitude?: number }>;
              const withCoords = recs.filter(r => r.latitude && r.longitude);
              if (withCoords.length) {
                const centerLat = withCoords.reduce((s, r) => s + (r.latitude ?? 0), 0) / withCoords.length;
                const centerLon = withCoords.reduce((s, r) => s + (r.longitude ?? 0), 0) / withCoords.length;
                areaHint = { preferred_area_lat: centerLat, preferred_area_lon: centerLon, preferred_area_radius_km: 5 };
                console.log('[ITINERARY] Built area hint for Day 2+:', areaHint);
              }
            }

          } else {
            allDays.push({ day: d + 1, date: label, activities: [] });
          }

          const pendingLiked = likedIds0.filter(id => !scheduledLikedIds.has(id));
          console.log(`[LIKED] After Day ${d + 1} — scheduled: [${[...scheduledLikedIds].join(', ')}] | still pending: [${pendingLiked.join(', ')}]`);

        } catch (_) {
          allDays.push({ day: d + 1, date: label, activities: [] });
        }
      }

      // Post-generation: consolidate nearby liked attractions onto the same day
      const consolidateLikedAttractions = (days: DayPlan[], likedIds: string[]): DayPlan[] => {
        const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        const isRealActivity = (a: Activity) => a.id !== 'start' && a.id !== 'end' && a.category !== 'transport';
        const result = days.map(d => ({ ...d, activities: [...d.activities] }));

        for (let earlyDay = 0; earlyDay < result.length - 1; earlyDay++) {
          for (let lateDay = earlyDay + 1; lateDay < result.length; lateDay++) {
            const lateActivities = result[lateDay].activities;
            for (let li = lateActivities.length - 1; li >= 0; li--) {
              const lateAct = lateActivities[li];
              if (!likedIds.includes(lateAct.id) || !isRealActivity(lateAct)) continue;
              if (!lateAct.latitude || !lateAct.longitude) continue;

              // Find nearest liked activity on early day
              const earlyLiked = result[earlyDay].activities.filter(a => likedIds.includes(a.id) && isRealActivity(a) && a.latitude && a.longitude);
              if (!earlyLiked.length) continue;

              let nearestAct: Activity | null = null;
              let nearestDist = Infinity;
              for (const ea of earlyLiked) {
                const dist = haversineKm(ea.latitude!, ea.longitude!, lateAct.latitude, lateAct.longitude);
                if (dist < nearestDist) { nearestDist = dist; nearestAct = ea; }
              }
              if (!nearestAct || nearestDist > 2) continue;

              // Don't move if this attraction is already on the early day (distance = 0)
              if (result[earlyDay].activities.some(a => a.id === lateAct.id)) continue;

              // Check budget on early day
              const earlySpent = result[earlyDay].activities.filter(isRealActivity).reduce((s, a) => s + (a.cost_egp ?? 0), 0);
              const earlyBudget = result[earlyDay].budget_remaining ?? 0;
              if (earlySpent + (lateAct.cost_egp ?? 0) > (earlyBudget + earlySpent)) continue;

              // Move lateAct to early day right after nearestAct
              lateActivities.splice(li, 1);
              const insertIdx = result[earlyDay].activities.findIndex(a => a.id === nearestAct!.id) + 1;
              result[earlyDay].activities.splice(insertIdx, 0, lateAct);
              console.log(`[ITINERARY] Consolidated '${lateAct.title}' → Day ${earlyDay + 1} (${nearestDist.toFixed(1)} km from '${nearestAct.title}')`);
            }
          }
        }
        return result;
      };

      // Remove days with no real activities (catches failed/empty API responses)
      // and deduplicate by day number (guards against concurrent generatePlan calls).
      const realDays = consolidateLikedAttractions(allDays, likedIds0)
        .filter(d => d.activities.some(a => a.id !== 'start' && a.id !== 'end'))
        .filter((d, i, arr) => arr.findIndex(x => x.day === d.day) === i);

      setDays(realDays);
      // Clamp activeDay in case the new plan has fewer days than before
      setActiveDay(prev => Math.min(prev, Math.max(0, realDays.length - 1)));

      // Generate AI day summaries non-blocking — update each day as its response arrives
      generateDaySummaries(realDays);
    } catch (err) {
      console.error('Plan generation error:', err);
      setDays([]);
    } finally {
      setLoading(false);
    }
  };

  // ── AI day summary ────────────────────────────────────────────────
  const getDayOrdinal = (n: number): string => {
    const words: Record<number, string> = {
      1: 'first', 2: 'second', 3: 'third', 4: 'fourth',
      5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth',
      9: 'ninth', 10: 'tenth',
    };
    if (words[n]) return words[n];
    const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st'
                 : n % 10 === 2 && n % 100 !== 12 ? 'nd'
                 : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
    return `${n}${suffix}`;
  };

  const generateDaySummaries = async (planDays: DayPlan[]): Promise<void> => {
    for (const day of planDays) {
      const stops = day.activities
        .filter(a => a.id !== 'start' && a.id !== 'end')
        .map(a => a.title);
      if (!stops.length) continue;

      const totalCost = day.activities
        .filter(a => a.id !== 'start' && a.id !== 'end')
        .reduce((sum, a) => sum + (a.cost_egp ?? 0), 0);

      const prompt = 
  `You are a local from ${city} who loves your city. ` +
  `Tell a story of this specific journey: ${stops.join(' -> ')}. ` +
  `make it 60 words max`+
  `Start with "On your ${getDayOrdinal(day.day)} day...", walk through every single location, and explain why the food choices (like seafood or traditional grills) are the heart of the experience here. ` +
  `End the day at ${stops[stops.length - 1]} with a reason why it's the perfect finish. ` +
  `Make it sound like a person talking, not a list. No emojis.`;
      try {
        const res = await fetch(`${API_BASE}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        });
        const data = await res.json();
        if (data.success && data.message) {
          setDays(prev => prev.map(d =>
            d.day === day.day ? { ...d, summary: data.message.trim() } : d
          ));
        }
      } catch {
        // Summary is optional — silently skip on error
      }
    }
  };

  // ── Delete activity ───────────────────────────────────────────────
  const deleteActivity = (dayIndex: number, activityId: string): void => {
    setDays(prev => prev.map((d, i) =>
      i === dayIndex
        ? { ...d, activities: d.activities.filter(a => a.id !== activityId) }
        : d
    ));
  };

  // ── AI chat ───────────────────────────────────────────────────────
  const sendAIMessage = async (): Promise<void> => {
    if (!aiMessage.trim()) return;
    setAiLoading(true);
    setAiResponse('');

    // Placeholder AI response — replace with real API call later
    await new Promise(resolve => setTimeout(resolve, 1000));
    const responses = [
      `Great choice visiting ${city}! I recommend starting with the most popular spots early in the morning to avoid crowds.`,
      `Based on your interests in ${interests.join(', ')}, I suggest adding a local food tour on Day 1!`,
      `The best time to visit the beach in ${city} is early morning or late afternoon for perfect weather.`,
      `I can help you optimize your route to save time between attractions. Would you like me to reorder your activities?`,
    ];
    setAiResponse(responses[Math.floor(Math.random() * responses.length)]);
    setAiLoading(false);
    setAiMessage('');
  };

  // ── Save plan to backend ──────────────────────────────────────────
  const persistPlan = async (): Promise<string | undefined> => {
    try {
      const res = await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          start_date: startDate,
          end_date: endDate,
          budget: params.budget,
          day_hours: params.dayHours,
          interests,
          spot_ids: params.spotIds?.split(',').map(Number) ?? [],
          itinerary: days,
          user_id: userId ?? 1,
        }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 120)}`);
      }
      const data = await res.json();
      if (data.success) {
        return data.data?.id ? String(data.data.id) : undefined;
      }
      throw new Error(data.message);
    } catch (err) {
      console.error('Save plan error:', err);
      return undefined;
    }
  };

  const savePlan = async (): Promise<void> => {
    if (planSaved || planSaving) return;
    setPlanSaving(true);
    const planId = await persistPlan();
    setPlanSaving(false);
    if (planId) {
      setPlanSaved(true);
    } else {
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    }
  };

  const openMap = async (): Promise<void> => {
    setSaving(true);
    const planId = existingPlanId ?? await persistPlan();
    setSaving(false);

    router.push({
      pathname: '/(main)/map' as any,
      params: {
        city,
        planId,
        itineraryData: JSON.stringify(days),
      },
    });
  };

  const openTravelOptions = async (): Promise<void> => {
    setSaving(true);
    const planId = existingPlanId ?? await persistPlan();
    setSaving(false);

    router.push({
      pathname: '/(main)/city-intro' as any,
      params: {
        city,
        planId,
        startDate,
        endDate,
        budget: params.budget,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingTitle}>Generating your plan...</Text>
        <Text style={styles.loadingSubtitle}>
          Creating a personalized plan for {city} based on your interests
        </Text>
      </View>
    );
  }

  const currentDay = days[activeDay];

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('plan')}</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={savePlan}
          disabled={planSaving || planSaved}
          activeOpacity={0.7}
        >
          {planSaving
            ? <ActivityIndicator size="small" color="#E67E22" />
            : <MaterialCommunityIcons
                name={planSaved ? 'bookmark-check' : 'bookmark-plus-outline'}
                size={26}
                color={planSaved ? '#27AE60' : '#E67E22'}
              />
          }
        </TouchableOpacity>
      </View>

      {/* ── Day tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayTabsScroll}
        contentContainerStyle={styles.dayTabs}
      >
        {days.map((day, index) => (
          <TouchableOpacity
            key={`day-${day.day}`}
            style={[styles.dayTab, activeDay === index && styles.dayTabActive]}
            onPress={() => setActiveDay(index)}
          >
            <Text style={[styles.dayTabLabel, activeDay === index && styles.dayTabLabelActive]}>
              Day {day.day}
            </Text>
            <Text style={[styles.dayTabDate, activeDay === index && styles.dayTabDateActive]}>
              {day.date}
            </Text>
            {activeDay === index && <View style={styles.dayTabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Activities list ── */}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Day summary generated by AI */}
        {currentDay?.summary ? (
          <View style={styles.daySummaryCard}>
            <MaterialCommunityIcons name="shimmer" size={18} color="#E67E22" />
            <Text style={styles.daySummaryText}>{currentDay.summary}</Text>
          </View>
        ) : (
          <View style={styles.daySummaryCard}>
            <MaterialCommunityIcons name="shimmer" size={18} color="#CCC" />
            <Text style={[styles.daySummaryText, { color: '#CCC' }]}>Crafting your day summary…</Text>
          </View>
        )}

        {currentDay?.activities.map((activity, index) => {
          if (activity.category === 'start') {
            return <StartRow key={activity.id} time={activity.time} label={locationLabel} onPress={() => setShowLocationModal(true)} />;
          }
          if (activity.category === 'end') {
            return <EndOfDayRow key={activity.id} time={activity.time} />;
          }
          return (
            <React.Fragment key={activity.id}>
              {activity.transport && (
                <TravelConnector transport={activity.transport} />
              )}
              <ActivityRow
                activity={activity}
                onDelete={(id) => deleteActivity(activeDay, id)}
                onPress={() => {
                  const FOOD_CATS = new Set(['restaurant','cafe','food','seafood','grills','local','international','bakery','dessert']);
                  const isFood = activity.categories?.some(c => FOOD_CATS.has(c.toLowerCase()));
                  const isAttractionType = activity.icon === 'attraction' || (!isFood && activity.id !== 'start' && activity.id !== 'end' && activity.category !== 'transport');
                  if (isAttractionType && activity.id && !activity.id.startsWith('rec-')) {
                    openAttractionSheet(activity);
                  } else {
                    setSelectedActivity(activity);
                  }
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Budget summary — day spent vs total remaining */}
        {currentDay && (() => {
          const activityCost = (d: DayPlan) =>
            d.activities
              .filter(a => a.id !== 'start' && a.id !== 'end')
              .reduce((sum, a) => sum + (a.cost_egp ?? 0) + (a.transport?.cost_egp ?? 0), 0);
          const totalBudget    = Number(params.budget ?? 0);
          const daySpent       = activityCost(currentDay);
          const spentSoFar     = days.slice(0, activeDay + 1).reduce((sum, d) => sum + activityCost(d), 0);
          const totalRemaining = totalBudget - spentSoFar;
          const pct = Math.min(100, Math.max(0, (totalRemaining / Math.max(1, totalBudget)) * 100));

          return (
            <View style={styles.budgetCard}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Day {currentDay.day} spent</Text>
                <Text style={styles.budgetSpent}>{Math.round(daySpent)} EGP</Text>
              </View>
              <View style={styles.budgetDivider} />
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Remaining budget</Text>
                <Text style={[styles.budgetRemaining, totalRemaining < 0 && styles.budgetOver]}>
                  {Math.round(totalRemaining)} EGP
                </Text>
              </View>
              {totalRemaining >= 0 && (
                <View style={styles.budgetBar}>
                  <View style={[styles.budgetBarFill, { width: `${pct}%` as any }]} />
                </View>
              )}
            </View>
          );
        })()}

        {/* AI assistant bubble */}
        <TouchableOpacity
          style={styles.aiBubble}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.85}
        >
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="robot-outline" size={24} color="#E67E22" />
          </View>
          <View style={styles.aiTextBubble}>
            <Text style={styles.aiText}>Would you like any help with your plan?</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Next Step buttons ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={openMap}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.nextBtnText}>Show on map</Text>
          }
        </TouchableOpacity>

        {/* Back to Home — pops all screens back to home (swipes left/back) */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.dismissAll()}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="home-outline" size={18} color="#888" />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      {/* ── Change Location Modal ── */}
      <Modal visible={showLocationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Starting Location</Text>
              <TouchableOpacity onPress={() => { setShowLocationModal(false); setLocationInput(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* GPS option */}
            <TouchableOpacity style={locStyles.gpsBtn} onPress={applyGPS}>
              <MaterialCommunityIcons name="crosshairs-gps" size={26} color="#E67E22" />
              <View>
                <Text style={locStyles.gpsBtnTitle}>Use my current GPS location</Text>
                <Text style={locStyles.gpsBtnSub}>Tap to detect automatically</Text>
              </View>
            </TouchableOpacity>

            <Text style={locStyles.orText}>— or enter an address —</Text>

            <TextInput
              style={styles.input}
              placeholder={`e.g. Cairo Tower, ${city}`}
              placeholderTextColor="#AAA"
              value={locationInput}
              onChangeText={setLocationInput}
              onSubmitEditing={applyAddress}
              returnKeyType="search"
            />

            <TouchableOpacity
              style={[styles.modalBtn, (!locationInput.trim() || locationSearching) && { opacity: 0.5 }]}
              onPress={applyAddress}
              disabled={!locationInput.trim() || locationSearching}
            >
              <Text style={styles.modalBtnText}>
                {locationSearching ? 'Searching...' : 'Set Location & Regenerate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* ── AI Chat Modal ── */}
      <Modal visible={showAIChat} animationType="slide" transparent onRequestClose={() => setShowAIChat(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Outer wrapper: Catches background taps, closes keyboard and modal */}
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => {
              Keyboard.dismiss();
              setShowAIChat(false);
            }} 
          />
          
          {/* Inner wrapper: Catches taps inside the card to dismiss keyboard without closing modal */}
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={Keyboard.dismiss}>
            <View style={styles.modalHeader}>
              <View style={styles.aiModalTitle}>
                <MaterialCommunityIcons name="robot-outline" size={22} color="#E67E22" />
                <Text style={styles.modalTitle}>Tour Mate AI</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAIChat(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {aiResponse ? (
              <View style={styles.aiResponseBox}>
                <Text style={styles.aiResponseText}>{aiResponse}</Text>
              </View>
            ) : (
              <Text style={styles.aiPlaceholder}>
                Ask me anything about your {city} trip! I can suggest activities, restaurants, or help optimize your schedule.
              </Text>
            )}

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="Ask Tour Mate AI..."
                placeholderTextColor="#AAA"
                value={aiMessage}
                onChangeText={setAiMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.aiSendBtn, aiLoading && { opacity: 0.6 }]}
                onPress={sendAIMessage}
                disabled={aiLoading}
              >
                {aiLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.aiSendIcon}>→</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Full Attraction Sheet (photo gallery, audio guide, etc.) ── */}
      <AttractionSheet
        attraction={sheetAttraction}
        visible={showAttractionSheet}
        onClose={() => setShowAttractionSheet(false)}
        userLocation={userLocation}
      />

      {/* Sheet loading overlay */}
      {sheetLoading && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#E67E22" />
        </View>
      )}

      {/* ── Activity Detail Modal ── */}
      <Modal
        visible={!!selectedActivity}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedActivity(null)}
      >
        {/* Outer Wrapper: Closes modal when background is tapped */}
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedActivity(null)}>
          
          {/* Inner Wrapper: Holds the UI and stops the tap from closing the modal */}
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={detailStyles.sheet}>
            
            {/* Header row: icon + name + rating + close */}
            <View style={detailStyles.header}>
              <View style={detailStyles.iconBox}>
                {getCategoryIcon(selectedActivity?.icon ?? 'default', 26)}
              </View>
              <View style={detailStyles.headerMid}>
                <Text style={detailStyles.name} numberOfLines={2}>{selectedActivity?.title}</Text>
                {!!selectedActivity?.rating && selectedActivity.rating > 0 && (
                  <View style={detailStyles.ratingRow}>
                    <Text style={detailStyles.ratingStar}>★</Text>
                    <Text style={detailStyles.ratingText}>{selectedActivity.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedActivity(null)} style={detailStyles.closeBtn}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Cost / duration chips */}
            <View style={detailStyles.chipsRow}>
              {selectedActivity?.duration_hrs != null && (
                <View style={[styles.activityMetaChip, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <MaterialCommunityIcons name="clock-outline" size={12} color="#777" />
                  <Text style={styles.activityMetaText}>
                    {selectedActivity.duration_hrs >= 1
                      ? `${selectedActivity.duration_hrs.toFixed(1)} hr`
                      : `${Math.round(selectedActivity.duration_hrs * 60)} min`}
                  </Text>
                </View>
              )}
              {selectedActivity?.cost_egp != null && selectedActivity.cost_egp > 0 && (
                <View style={[styles.activityMetaChip, styles.activityMetaChipCost, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  <MaterialCommunityIcons name="currency-usd" size={12} color="#E67E22" />
                  <Text style={[styles.activityMetaText, styles.activityMetaTextCost]}>
                    ~{Math.round(selectedActivity.cost_egp)} EGP
                  </Text>
                </View>
              )}
              {selectedActivity?.cost_egp === 0 && (
                <View style={[styles.activityMetaChip, styles.activityMetaChipFree]}>
                  <Text style={[styles.activityMetaText, styles.activityMetaTextFree]}>Free entry</Text>
                </View>
              )}
            </View>

            {/* Category tags */}
            {selectedActivity?.categories && selectedActivity.categories.length > 0 && (
              <View style={detailStyles.tagsRow}>
                {selectedActivity.categories.map((cat, i) => (
                  <View key={i} style={detailStyles.tag}>
                    <Text style={detailStyles.tagText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Description */}
            <ScrollView style={detailStyles.descScroll} showsVerticalScrollIndicator={false}>
              {selectedActivity?.description ? (
                <Text style={detailStyles.description}>{selectedActivity.description}</Text>
              ) : (
                <Text style={detailStyles.descriptionEmpty}>No description available.</Text>
              )}
            </ScrollView>

            {/* Address */}
            {!!selectedActivity?.address && (
              <View style={detailStyles.addressRow}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#888" />
                <Text style={detailStyles.addressText} numberOfLines={2}>
                  {selectedActivity.address}
                </Text>
              </View>
            )}

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ── Detail modal styles ───────────────────────────────────────────────
const detailStyles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, // Enforce sharp bottom corners
    borderBottomRightRadius: 0, // Enforce sharp bottom corners
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Avoid home indicator
    maxHeight: '85%',
    width: '100%', // Kills the weird horizontal gaps
    marginBottom: 0, // Forces it to the absolute bottom
  },
  header:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconBox:   { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  iconEmoji: {},  // kept for layout; content replaced by vector icon
  headerMid: { flex: 1 },
  name:      { fontSize: 17, fontWeight: '700', color: '#1A1A1A', lineHeight: 22 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingStar:{ fontSize: 13, color: '#F5A623' },
  ratingText:{ fontSize: 13, fontWeight: '700', color: '#F5A623' },
  closeBtn:  { padding: 4 },
  chipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag:       { backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:   { fontSize: 12, color: '#555', fontWeight: '500', textTransform: 'capitalize' },
  descScroll:{ maxHeight: 160, marginBottom: 14 },
  description:     { fontSize: 14, color: '#444', lineHeight: 22 },
  descriptionEmpty:{ fontSize: 14, color: '#BBB', fontStyle: 'italic' },
  addressRow:{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  addressPin:{ fontSize: 14, marginTop: 1 },
  addressText:{ flex: 1, fontSize: 13, color: '#666', lineHeight: 18 },
});

const locStyles = StyleSheet.create({
  gpsBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 16 },
  gpsBtnIcon:  { fontSize: 24 },
  gpsBtnTitle: { fontSize: 14, fontWeight: '700', color: '#E67E22' },
  gpsBtnSub:   { fontSize: 12, color: '#999', marginTop: 2 },
  orText:      { textAlign: 'center', color: '#BBB', fontSize: 12, marginBottom: 14 },
});

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },

  // Loading
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9F5F0', paddingHorizontal: 40,
  },
  loadingTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 16, textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  // Day tabs
  dayTabsScroll: { backgroundColor: '#FFF', maxHeight: 70 },
  dayTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  dayTab: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 12, alignItems: 'center', position: 'relative',
  },
  dayTabActive: { backgroundColor: '#FFF8F0' },
  dayTabLabel: { fontSize: 14, fontWeight: '600', color: '#999' },
  dayTabLabelActive: { color: '#E67E22' },
  dayTabDate: { fontSize: 11, color: '#BBB', marginTop: 2 },
  dayTabDateActive: { color: '#E67E22' },
  dayTabUnderline: {
    position: 'absolute', bottom: 0, left: 10, right: 10,
    height: 2, backgroundColor: '#E67E22', borderRadius: 1,
  },

  // Day summary card
  daySummaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8F0', borderRadius: 12, padding: 12,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#E67E22',
  },
  daySummaryIcon: { fontSize: 16 },
  daySummaryText: { flex: 1, fontSize: 13, color: '#5A3A1A', lineHeight: 18, fontStyle: 'italic' },

  // Activities
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 4, minHeight: 52,
  },
  activityTimeCol: { width: 48, paddingTop: 4 },
  activityTime: { fontSize: 12, color: '#999', fontWeight: '500' },
  activityLine: { width: 24, alignItems: 'center', paddingTop: 6 },
  activityDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E67E22', borderWidth: 2, borderColor: '#FFF3E0',
  },
  activityConnector: { width: 2, flex: 1, backgroundColor: '#F0E0D0', marginTop: 2 },
  activityContent: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12,
    padding: 12, marginLeft: 8, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  activityTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  activityMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  activityMetaChip: {
    backgroundColor: '#F0F0F0', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  activityMetaChipCost: { backgroundColor: '#FFF3E0' },
  activityMetaChipFree: { backgroundColor: '#E8F5E9' },
  activityMetaText: { fontSize: 11, fontWeight: '600', color: '#777' },
  activityMetaTextCost: { color: '#E67E22' },
  activityMetaTextFree: { color: '#27AE60' },
  activityIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center',
    marginLeft: 8, marginTop: 4,
  },
  activityIcon: {},  // kept for layout; content replaced by vector icon
  activityTapHint: { fontSize: 11, color: '#E67E22', fontWeight: '500', marginTop: 5 },
  deleteBtn: { padding: 8, marginTop: 4 },
  deleteIcon: { fontSize: 12, color: '#CCC' },

  // Budget card
  budgetCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  budgetRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabel:     { fontSize: 13, color: '#888', fontWeight: '500' },
  budgetSpent:     { fontSize: 14, fontWeight: '700', color: '#333' },
  budgetRemaining: { fontSize: 14, fontWeight: '700', color: '#27AE60' },
  budgetOver:      { color: '#E74C3C' },
  budgetDivider:   { height: 1, backgroundColor: '#F5F5F5', marginVertical: 10 },
  budgetBar:       { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  budgetBarFill:   { height: 6, backgroundColor: '#E67E22', borderRadius: 3 },

  // AI bubble
  aiBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: 8, gap: 12,
  },
  aiAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center',
  },
  aiAvatarIcon: { fontSize: 22 },
  aiTextBubble: { flex: 1 },
  aiText: { fontSize: 14, color: '#555', lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 20,
    paddingVertical: 16, paddingBottom: 30,
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  nextBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#DDD' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#FFF3E0',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E67E22',
  },
  secondaryBtnText: { color: '#E67E22', fontSize: 15, fontWeight: '700' },
  secondaryBtnSubtext: { color: '#A6662B', fontSize: 12, marginTop: 2 },
  homeBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  homeBtnText:     { color: '#888', fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, // Enforce sharp bottom corners
    borderBottomRightRadius: 0, // Enforce sharp bottom corners
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Avoid home indicator
    width: '100%', // Kills the weird horizontal gaps
    marginBottom: 0, // Forces it to the absolute bottom
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  modalClose: { fontSize: 18, color: '#999' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#EEE', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#333', marginBottom: 14,
  },
  modalBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 14, alignItems: 'center', marginTop: 6,
  },
  modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // AI modal
  aiModalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiModalIcon: { fontSize: 22 },
  aiPlaceholder: { fontSize: 14, color: '#999', lineHeight: 22, marginBottom: 20 },
  aiResponseBox: {
    backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  aiResponseText: { fontSize: 14, color: '#333', lineHeight: 22 },
  aiInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  aiInput: {
    flex: 1, borderWidth: 1, borderColor: '#EEE', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#333',
    maxHeight: 100,
  },
  aiSendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center',
  },
  aiSendIcon: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
