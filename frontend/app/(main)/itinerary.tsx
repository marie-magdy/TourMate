// app/(main)/itinerary.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Modal, TextInput,
  Alert, Dimensions, KeyboardAvoidingView, Platform, Keyboard,
  FlatList, Pressable,Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../constants/AppContext';
import { Attraction } from '../../constants/types';
import AttractionSheet from '../../components/AttractionSheet';
import { Theme } from '../../constants/theme';
import BottomTab from '@/components/BottomTab';
import { useBookingStore, Hotel, Flight } from '@/store/bookingStore';
import { scheduleItineraryNotifications, cancelItineraryNotifications } from '../../notifications';

const NOTIF_IDS_STORAGE_KEY = (planId: string) => `@itinerary_notif_ids_${planId}`;


const { height: screenHeight } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const PLAN_COACH_SUGGESTIONS = [
  'What can you do with my plan?',
  'Start tomorrow at 11:00 instead of 9:00 — adjust the times',
  'Remove the last stop for today',
  'Add another full day using my interests (database only)',
  'I spent 200 EGP on a taxi — update my budget',
  'Remove one whole day from the trip',
];

export function simplifyCoachWarning(w: string): string {
  const t = String(w || '').trim();
  if (!t) return '';

  // Budget overage
  // Example: "This day's stops cost about 281 EGP ... above the roughly 250 EGP day budget ..."
  const mBudget = t.match(/cost about\s+(\d+)\s*EGP[\s\S]*above the roughly\s+(\d+)\s*EGP/i);
  if (mBudget) return `Budget: ~${mBudget[1]} EGP (over ~${mBudget[2]} EGP/day).`;

  // Dropped stops due to time window
  // Example: "Day 1: 1 stop(s) could not fit your day hours and were removed in the preview: 123…"
  const mDrop = t.match(/^Day\s+(\d+):\s+(\d+)\s+stop\(s\)[\s\S]*removed[\s\S]*:\s*(.+)$/i);
  if (mDrop) return `Day ${mDrop[1]}: removed ${mDrop[2]} stop(s) that didn’t fit the time window (${mDrop[3]}).`;

  // Route not optimized
  if (t.toLowerCase().includes('not route-optimized') || t.toLowerCase().includes('more driving distance')) {
    return 'Note: this change increases travel time compared to an optimized route.';
  }

  // Default: keep but shorten long text
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

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
  image_url?: string;
  open_hour?: number;
  close_hour?: number;
  price_from?: number;
  detour_note?: string;
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
  image_url?: string;
  open?: number;
  close?: number;
  price_from?: number;
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
  const isWalk = mode === 'Walk';
  const costText = isWalk
    ? 'Free · walking'
    : costs
      ? `${costs.taxi_low}–${costs.taxi_high} EGP · Taxi`
      : null;
  const parts = [dur, costText].filter(Boolean).join('  ·  ');
  const travelIcon = isWalk
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
  onPress: () => void;
  isLiked?: boolean;
}> = ({ activity, onPress, isLiked }) => (
  <View style={styles.activityRow}>
    <View style={styles.activityTimeCol}>
      <Text style={styles.activityTime}>{formatTime12(activity.time)}</Text>
    </View>
    <View style={styles.activityLine}>
      <View style={styles.activityDot} />
      <View style={styles.activityConnector} />
    </View>
    <TouchableOpacity style={styles.activityContent} onPress={onPress} activeOpacity={0.72}>
      <Text style={styles.activityTitle}>
        {activity.title}{isLiked && <>{' '}<MaterialCommunityIcons name="star" size={14} color="#F5A623" /></>}
      </Text>
      {(activity.categories ?? []).length > 0 && (
        <View style={styles.activityCatsRow}>
          {(activity.categories ?? []).slice(0, 2).map(cat => (
            <View key={cat} style={styles.activityCatPill}>
              <Text style={styles.activityCatText}>{cat}</Text>
            </View>
          ))}
        </View>
      )}
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
      {!!activity.detour_note && (
        <View style={styles.detourNote}>
          <MaterialCommunityIcons name="information-outline" size={12} color="#A06020" />
          <Text style={styles.detourNoteText}>{activity.detour_note}</Text>
        </View>
      )}
      <Text style={styles.activityTapHint}>Tap for details →</Text>
    </TouchableOpacity>
    <View style={styles.activityIconBox}>
      {getCategoryIcon(activity.icon)}
    </View>
  </View>
);

// ── ITINERARY SCREEN ──────────────────────────────────────────────────
export default function ItineraryScreen() {
  const router = useRouter();
  const { t, features, refreshFeatures, userId: ctxUserId } = useApp();
  const params = useLocalSearchParams<{
    planId?: string;
    city: string;
    startDate: string;
    endDate: string;
    daySchedules?: string;
    budget: string;
    interests: string;
    spotIds: string;
    favoritedIds: string;
    savedItinerary: string;
    startLat?: string;
    startLon?: string;
    startLabel?: string;
    isForeigner?: string;
  }>();
  const existingPlanId = params.planId ? String(params.planId) : undefined;

  const {
  selectedHotel,
  selectedFlight,
  setSelectedHotel,
  setSelectedFlight,
} = useBookingStore();


  const city = params.city ?? 'Hurghada';
  const [fetchedInterests, setFetchedInterests] = useState<string[] | null>(null);
  const [fetchedSpotIds, setFetchedSpotIds] = useState<string[] | null>(null);
  const interests = fetchedInterests ?? (params.interests?.split(',')?.filter(Boolean) ?? []);
  const spotIdsForApi =
    fetchedSpotIds ??
    (params.spotIds?.split(',').filter(Boolean) ?? []);
  const startDate = params.startDate ?? new Date().toISOString();
  const endDate = params.endDate ?? new Date().toISOString();

  const baseDaySchedules = useMemo((): { start_hour: number; end_hour: number }[] => {
    try {
      const j = JSON.parse(params.daySchedules || '[]');
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }, [params.daySchedules]);

  const userLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  const [days, setDays] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [likedIdSet, setLikedIdSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  /** True once bookmark saved, or when opened from an existing saved plan */
  const [planSaved, setPlanSaved] = useState(() => Boolean(existingPlanId));
  const [serverPlanId, setServerPlanId] = useState<string | undefined>(existingPlanId);
  const [showAIChat, setShowAIChat] = useState(false);
  const [planCoachInput, setPlanCoachInput] = useState('');
  const [planCoachMessages, setPlanCoachMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [planCoachLoading, setPlanCoachLoading] = useState(false);
  const planCoachListRef = useRef<FlatList<{ role: 'user' | 'assistant'; content: string }>>(null);
  const [planCoachPreview, setPlanCoachPreview] = useState<{
    days: DayPlan[];
    warnings: string[];
    day_schedules?: { start_hour: number; end_hour: number }[] | null;
    end_date?: string | null;
    coach_extra_spend?: number | null;
  } | null>(null);
  const [coachDaySchedules, setCoachDaySchedules] = useState<
    { start_hour: number; end_hour: number }[] | null
  >(null);
  const [coachEndDate, setCoachEndDate] = useState<string | null>(null);
  const [coachExtraSpendEgp, setCoachExtraSpendEgp] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);

  const effectiveDaySchedules = coachDaySchedules ?? baseDaySchedules;
  const effectiveEndDate = (coachEndDate ?? endDate).toString().split('T')[0];

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // ── Full attraction sheet (photo gallery, audio guide, etc.) ─────────
  const [sheetAttraction, setSheetAttraction]   = useState<Attraction | null>(null);
  const [showAttractionSheet, setShowAttractionSheet] = useState(false);
  const [sheetLoading, setSheetLoading]         = useState(false);
  const [userLocation, setUserLocation]         = useState<{ latitude: number; longitude: number } | null>(null);

// ── State ──────────────────────────────────────────────────────────
const [flightExpanded, setFlightExpanded] = useState(false);
const [hotelExpanded, setHotelExpanded] = useState(false);
const [editingFlight, setEditingFlight] = useState(false);
const [editingHotel, setEditingHotel] = useState(false);
const [flightForm, setFlightForm] = useState({
  airline: '', flightNumber: '', departureTime: '',
  arrivalTime: '', price: '', bookingUrl: '',
});
const [hotelForm, setHotelForm] = useState({
  name: '', checkIn: '', checkOut: '', pricePerNight: '', bookingUrl: '',
});

// ── Read store ONCE on mount ────────────────────────────────────────
useEffect(() => {
  const f = useBookingStore.getState().selectedFlight;
  const h = useBookingStore.getState().selectedHotel;
  if (f) setFlightForm({
    airline: f.airline ?? '',
    flightNumber: f.flightNumber ?? '',
    departureTime: f.departureTime ?? '',
    arrivalTime: f.arrivalTime ?? '',
    price: String(f.price ?? ''),
    bookingUrl: f.bookingUrl ?? '',
  });
  if (h) setHotelForm({
    name: h.name ?? '',
    checkIn: h.checkIn ?? '',
    checkOut: h.checkOut ?? '',
    pricePerNight: String(h.price_per_night ?? ''),
    bookingUrl: h.bookingUrl ?? '',
  });

  // Clean up store when leaving so it doesn't bleed into other plans
  return () => {
    useBookingStore.setState({ selectedFlight: null, selectedHotel: null });
  };
}, []);

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

  // Schedule OS-level notifications for the active day's activities.
  // Date-trigger notifications fire even when the app is backgrounded, suspended,
  // or killed. We deliberately do NOT cancel on unmount — only when the same plan
  // is re-scheduled (so navigating away keeps reminders armed).
  useEffect(() => {
    if (loading || !days.length) return;
    const activities = days[activeDay]?.activities ?? [];
    if (!activities.length) return;

    const planDate = new Date(startDate);
    planDate.setDate(planDate.getDate() + activeDay);
    const planId = `${city}-${startDate}-${activeDay}`;
    const idsKey = NOTIF_IDS_STORAGE_KEY(planId);

    const scheduled = activities
      .filter((a: any) => a.time && a.id !== 'start' && a.id !== 'end')
      .map((a: any) => ({
        id: String(a.id),
        time: a.time as string,
        title: a.title as string,
        category: (a.category ?? 'attraction') as string,
      }));

    let cancelled = false;
    (async () => {
      try {
        const prevRaw = await AsyncStorage.getItem(idsKey);
        const prevIds: string[] = prevRaw ? JSON.parse(prevRaw) : [];
        if (prevIds.length) await cancelItineraryNotifications(prevIds);

        const newIds = await scheduleItineraryNotifications(scheduled, planDate, 10);
        if (cancelled) {
          await cancelItineraryNotifications(newIds);
          return;
        }
        await AsyncStorage.setItem(idsKey, JSON.stringify(newIds));
        console.log(`[Itinerary] Scheduled ${newIds.length} notifications for plan ${planId}`);
      } catch (err) {
        console.warn('[Itinerary] Failed to schedule notifications:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, days, activeDay, startDate, city, userId]);

  // Load saved plan by id (no regeneration), else hydrate from params, else generate from recommender
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const primeLocation = async (): Promise<void> => {
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
            /* GPS unavailable — recommender falls back to city centre */
          }
        }
      };

      try {
        if (existingPlanId) {
          const res = await fetch(`${API_BASE}/plans/item/${existingPlanId}`);
          const ct = res.headers.get('content-type') ?? '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            const row = data.success ? data.data : null;
            const it = row?.itinerary;
            const parsedIt =
              typeof it === 'string'
                ? JSON.parse(it)
                : Array.isArray(it)
                  ? it
                  : null;
            if (!cancelled && Array.isArray(parsedIt) && parsedIt.length > 0) {
              setDays(parsedIt as DayPlan[]);
              setServerPlanId(String(row.id));
              setPlanSaved(true);
                // ← Add this block here
if (row.flight_details) {
  const fd = typeof row.flight_details === 'string'
    ? JSON.parse(row.flight_details)
    : row.flight_details;
  useBookingStore.getState().setSelectedFlight(fd);
}
if (row.hotel_details) {
  const hd = typeof row.hotel_details === 'string'
    ? JSON.parse(row.hotel_details)
    : row.hotel_details;
  useBookingStore.getState().setSelectedHotel(hd);
}

              if (row.interests != null) {
                const fi = Array.isArray(row.interests)
                  ? row.interests.map(String)
                  : typeof row.interests === 'string'
                    ? JSON.parse(row.interests)
                    : [];
                if (Array.isArray(fi)) setFetchedInterests(fi.map(String));
              }
              if (row.spot_ids != null) {
                const raw = row.spot_ids;
                const arr = Array.isArray(raw)
                  ? raw
                  : typeof raw === 'string'
                    ? JSON.parse(raw)
                    : [];
                if (Array.isArray(arr))
                  // setFetchedSpotIds(arr.map((x: unknown) => Number(x)).filter(n => !Number.isNaN(n)));
                setFetchedSpotIds(arr.map((x: unknown) => String(x)).filter(Boolean));
              }
              if (row.day_hours != null) {
                try {
                  const dh =
                    typeof row.day_hours === 'string' ? JSON.parse(row.day_hours) : row.day_hours;
                  if (Array.isArray(dh))
                    setCoachDaySchedules(
                      dh.map((s: { start_hour?: number; end_hour?: number }) => ({
                        start_hour: Number(s?.start_hour ?? 9),
                        end_hour: Number(s?.end_hour ?? 21),
                      })),
                    );
                } catch (_) {}
              }
              if (row.end_date) {
                const ed = String(row.end_date).split('T')[0];
                setCoachEndDate(ed);
              }
              await primeLocation();
              setLoading(false);
              return;
            }
          }
        }
      } catch (_) {
        /* fall through to params / generate */
      }

      try {
        const raw = params.savedItinerary;
        if (raw && String(raw).trim() && String(raw) !== 'undefined') {
          const parsed = JSON.parse(String(raw)) as DayPlan[];
          if (Array.isArray(parsed) && parsed.length > 0 && !cancelled) {
            setDays(parsed);
            setPlanSaved(Boolean(existingPlanId));
            await primeLocation();
            setLoading(false);
            return;
          }
        }
      } catch (_) {
        /* generate */
      }

      await primeLocation();
      if (!cancelled) await generatePlan();
    })();
    return () => {
      cancelled = true;
    };
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
        image_url: stop.image_url,
        open_hour: stop.open,
        close_hour: stop.close,
        price_from: stop.price_from,
        detour_note: (stop as any).detour_note ?? '',
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

          const earlyLiked = result[earlyDay].activities.filter(a => likedIds.includes(a.id) && isRealActivity(a) && a.latitude && a.longitude);
          if (!earlyLiked.length) continue;

          let nearestAct: Activity | null = null;
          let nearestDist = Infinity;
          for (const ea of earlyLiked) {
            const dist = haversineKm(ea.latitude!, ea.longitude!, lateAct.latitude, lateAct.longitude);
            if (dist < nearestDist) { nearestDist = dist; nearestAct = ea; }
          }
          if (!nearestAct || nearestDist > 2) continue;

          if (result[earlyDay].activities.some(a => a.id === lateAct.id)) continue;

          const earlySpent = result[earlyDay].activities.filter(isRealActivity).reduce((s, a) => s + (a.cost_egp ?? 0), 0);
          const earlyBudget = result[earlyDay].budget_remaining ?? 0;
          if (earlySpent + (lateAct.cost_egp ?? 0) > (earlyBudget + earlySpent)) continue;

          lateActivities.splice(li, 1);
          const insertIdx = result[earlyDay].activities.findIndex(a => a.id === nearestAct!.id) + 1;
          result[earlyDay].activities.splice(insertIdx, 0, lateAct);
        }
      }
    }
    return result;
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

      const prompt =
  `You are a local from ${city} who loves your city. ` +
  `Tell a story of this specific journey: ${stops.join(' -> ')}. ` +
  `make it 60 words max` +
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

  const generatePlan = async (): Promise<void> => {
    setLoading(true);
    setCoachDaySchedules(null);
    setCoachEndDate(null);
    setCoachExtraSpendEgp(0);
    try {
      // Compute schedules locally from params — not from outer reactive state
      const localSchedules: { start_hour: number; end_hour: number }[] = (() => {
        try {
          const j = JSON.parse(params.daySchedules || '[]');
          return Array.isArray(j) ? j : [];
        } catch {
          return [];
        }
      })();

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

      const addedIds0 = spotIdsForApi.map(String).filter(Boolean);
      const favIds0   = params.favoritedIds?.split(',').filter(Boolean) ?? [];
      const likedIds0 = [...new Set([...addedIds0, ...favIds0])];
      const stripAttPrefix = (id: string) => id.replace(/^ATT0*/i, '');
      setLikedIdSet(new Set(likedIds0.map(stripAttPrefix)));

      const scheduledLikedIds = new Set<string>();
      let areaHint: { preferred_area_lat: number; preferred_area_lon: number; preferred_area_radius_km: number } | null = null;
      const eatenMealCategories: string[] = [];

      for (let d = 0; d < dayCount; d++) {
        const dayDate = new Date(start);
        dayDate.setDate(start.getDate() + d);
        const label = `${MONTH_LABELS[dayDate.getMonth()]} ${dayDate.getDate()}`;

        const remainingBudget = totalBudget - cumulativeSpent;
        const remainingDays   = dayCount - d;
        const budgetToday     = Math.floor(remainingBudget / remainingDays);

        // const dayVisited = visitedIds.filter(id =>
        //   !likedIds0.includes(id) || scheduledLikedIds.has(id)
        // );
        const dayVisited = [...visitedIds];

        try {
          const daySchedule =
            localSchedules[d] ??
            localSchedules[localSchedules.length - 1] ??
            { start_hour: 9, end_hour: 21 };

          let startHour = daySchedule?.start_hour ?? 9;
          let endHour   = daySchedule?.end_hour ?? 21;
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
            available_hours: availableHoursToday,
            liked_ids: likedIds0,
            visited_ids: dayVisited,
            top_n: Math.max(20, Math.ceil(availableHoursToday * 3) + likedIds0.length),
            browse_n: 5,
            start_hour: startHour,
            end_hour: endHour,
            is_foreigner: params.isForeigner === 'true',
            day_index: d,
            n_days: dayCount,
            ...(userLocationRef.current && {
              current_lat: userLocationRef.current.lat,
              current_lon: userLocationRef.current.lon,
            }),
            ...(d > 0 && areaHint ? areaHint : {}),
            ...(d > 0 && eatenMealCategories.length ? { eaten_meal_categories: eatenMealCategories } : {}),
          };

          const response = await fetch(`${API_BASE}/recommendations/itinerary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itineraryPayload),
            // signal: AbortSignal.timeout(d === 0 ? 30000 : 15000),
            
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
              if (likedIds0.includes(stop.id)) {
                scheduledLikedIds.add(stop.id);
              }
              if (!visitedIds.includes(stop.id)) visitedIds.push(stop.id);
              const isMeal = stop.type?.includes('Lunch') || stop.type?.includes('Dinner');
              if (isMeal && stop.categories) {
                stop.categories
                  .map(c => c.toLowerCase())
                  .filter(c => CUISINE_DIVERSITY_CATS.has(c) && !eatenMealCategories.includes(c))
                  .forEach(c => eatenMealCategories.push(c));
              }
            }

            if (d === 0 && data.recommended_attractions?.length) {
              const recs = data.recommended_attractions as Array<{ id?: string; latitude?: number; longitude?: number }>;
              const withCoords = recs.filter(r => r.latitude && r.longitude);
              if (withCoords.length) {
                const centerLat = withCoords.reduce((s, r) => s + (r.latitude ?? 0), 0) / withCoords.length;
                const centerLon = withCoords.reduce((s, r) => s + (r.longitude ?? 0), 0) / withCoords.length;
                areaHint = { preferred_area_lat: centerLat, preferred_area_lon: centerLon, preferred_area_radius_km: 5 };
              }
            }

          } else {
            allDays.push({ day: d + 1, date: label, activities: [] });
          }

        } catch (_) {
          // console.error(`[DAY ${d + 1}] fetch failed:`, err);
          allDays.push({ day: d + 1, date: label, activities: [] });
        }
      }

      console.log('[DEBUG] allDays before filter:', allDays.map(d => ({
        day: d.day,
        actCount: d.activities.length,
        ids: d.activities.map(a => a.id),
      })));

      const realDays = consolidateLikedAttractions(allDays, likedIds0)
        .filter(d => d.activities.length > 2)
        .filter((d, i, arr) => arr.findIndex(x => x.day === d.day) === i);

      setDays(realDays);
      setActiveDay(prev => Math.min(prev, Math.max(0, realDays.length - 1)));
      generateDaySummaries(realDays);
    } catch (err) {
      console.error('Plan generation error:', err);
      setDays([]);
    } finally {
      setLoading(false);
    }
  };

  // const generatePlan = async (): Promise<void> => {
  //   setLoading(true);
  //   setCoachDaySchedules(null);
  //   setCoachEndDate(null);
  //   setCoachExtraSpendEgp(0);
  //   try {
  //     const parseDate = (str: string): Date => {
  //       const parts = str.split('-').map(Number);
  //       return new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
  //     };
  //     const start    = parseDate(startDate);
  //     const end      = parseDate(endDate);
  //     const dayCount = Math.max(1, Math.round(
  //       (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  //     ) + 1);
  //     const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  //     const totalBudget = Number(params.budget ?? 1000);

  //     const allDays: DayPlan[]   = [];
  //     const visitedIds: string[] = [];
  //     let cumulativeSpent = 0;

  //     const addedIds0 = spotIdsForApi.map(String).filter(Boolean);
  //     const favIds0   = params.favoritedIds?.split(',').filter(Boolean) ?? [];
  //     const likedIds0 = [...new Set([...addedIds0, ...favIds0])];
  //     const stripAttPrefix = (id: string) => id.replace(/^ATT0*/i, '');
  //     setLikedIdSet(new Set(likedIds0.map(stripAttPrefix)));

  //     const scheduledLikedIds = new Set<string>();

  //     let areaHint: { preferred_area_lat: number; preferred_area_lon: number; preferred_area_radius_km: number } | null = null;
  //     const eatenMealCategories: string[] = [];

  //     for (let d = 0; d < dayCount; d++) {
  //       const dayDate = new Date(start);
  //       dayDate.setDate(start.getDate() + d);
  //       const label = `${MONTH_LABELS[dayDate.getMonth()]} ${dayDate.getDate()}`;

  //       const remainingBudget = totalBudget - cumulativeSpent;
  //       const remainingDays   = dayCount - d;
  //       const budgetToday     = Math.floor(remainingBudget / remainingDays);

  //       const dayVisited = visitedIds.filter(id =>
  //         !likedIds0.includes(id) || scheduledLikedIds.has(id)
  //       );

  //       try {
  //         // const daySchedule =
  //         //   effectiveDaySchedules[d] ??
  //         //   effectiveDaySchedules[effectiveDaySchedules.length - 1];
  //         const generatePlan = async (): Promise<void> => {
  //         // Compute schedules locally from params — not from outer reactive state
  //         const localSchedules: { start_hour: number; end_hour: number }[] = (() => {
  //           try {
  //             const j = JSON.parse(params.daySchedules || '[]');
  //             return Array.isArray(j) ? j : [];
  //           } catch {
  //             return [];
  //           }
  //         })();

  //           const daySchedule =
  //             localSchedules[d] ??
  //             localSchedules[localSchedules.length - 1] ??
  //             { start_hour: 9, end_hour: 21 };

  //         let startHour = daySchedule?.start_hour ?? 9;
  //         let endHour   = daySchedule?.end_hour ?? 21;
  //         let availableHoursToday = endHour - startHour;

  //         if (endHour <= startHour) {
  //           endHour += 24;
  //         }

  //         const itineraryPayload: Record<string, any> = {
  //           user_id: 1,
  //           name: 'TourMate User',
  //           city,
  //           interests,
  //           budget_egp: budgetToday,
  //           available_hours: availableHoursToday,
  //           liked_ids: likedIds0,
  //           visited_ids: dayVisited,
  //           top_n: Math.max(20, Math.ceil(availableHoursToday * 3) + likedIds0.length),
  //           browse_n: 5,
  //           start_hour: startHour,
  //           end_hour: endHour,
  //           is_foreigner: params.isForeigner === 'true',
  //           day_index: d,
  //           n_days: dayCount,
  //           ...(userLocationRef.current && {
  //             current_lat: userLocationRef.current.lat,
  //             current_lon: userLocationRef.current.lon,
  //           }),
  //           ...(d > 0 && areaHint ? areaHint : {}),
  //           ...(d > 0 && eatenMealCategories.length ? { eaten_meal_categories: eatenMealCategories } : {}),
  //         };

  //         console.log(`[ITINERARY] Day ${d + 1} API payload:`);
  //         console.log('  liked_ids (added):', addedIds0);
  //         console.log('  liked_ids (favorited):', favIds0);
  //         console.log('  liked_ids (merged):', likedIds0);
  //         console.log('  visited_ids (dayVisited):', dayVisited);
  //         console.log('  budget_egp:', budgetToday, '| available_hours:', availableHoursToday);
  //         if (d > 0 && areaHint) console.log('  areaHint:', areaHint);

  //         const response = await fetch(`${API_BASE}/recommendations/itinerary`, {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify(itineraryPayload),
  //         });

  //         const payload = await response.json();

  //         if (payload.success && payload.data?.itinerary?.length) {
  //           const data      = payload.data;
  //           const itinerary = data.itinerary as RecommendationStop[];
  //           const daySpent  = Number(data.stats?.total_cost_egp ?? 0);
  //           cumulativeSpent += daySpent;

  //           allDays.push({
  //             day:              d + 1,
  //             date:             label,
  //             activities:       stopsToActivities(itinerary),
  //             budget_spent:     daySpent,
  //             budget_remaining: totalBudget - cumulativeSpent,
  //           });

  //           const CUISINE_DIVERSITY_CATS = new Set(['seafood','grills','nile view','waterfront','bakery','dessert','cafe']);
  //           for (const stop of itinerary) {
  //             if (!stop.id) continue;
  //             if (likedIds0.includes(stop.id)) {
  //               scheduledLikedIds.add(stop.id);
  //               console.log(`[LIKED] ✓ Scheduled on Day ${d + 1}: "${stop.name}" (${stop.id})`);
  //             }
  //             if (!visitedIds.includes(stop.id)) visitedIds.push(stop.id);
  //             const isMeal = stop.type?.includes('Lunch') || stop.type?.includes('Dinner');
  //             if (isMeal && stop.categories) {
  //               stop.categories
  //                 .map(c => c.toLowerCase())
  //                 .filter(c => CUISINE_DIVERSITY_CATS.has(c) && !eatenMealCategories.includes(c))
  //                 .forEach(c => eatenMealCategories.push(c));
  //             }
  //           }

  //           if (d === 0 && data.recommended_attractions?.length) {
  //             const recs = data.recommended_attractions as Array<{ id?: string; latitude?: number; longitude?: number }>;
  //             const withCoords = recs.filter(r => r.latitude && r.longitude);
  //             if (withCoords.length) {
  //               const centerLat = withCoords.reduce((s, r) => s + (r.latitude ?? 0), 0) / withCoords.length;
  //               const centerLon = withCoords.reduce((s, r) => s + (r.longitude ?? 0), 0) / withCoords.length;
  //               areaHint = { preferred_area_lat: centerLat, preferred_area_lon: centerLon, preferred_area_radius_km: 5 };
  //               console.log('[ITINERARY] Built area hint for Day 2+:', areaHint);
  //             }
  //           }

  //         } else {
  //           allDays.push({ day: d + 1, date: label, activities: [] });
  //         }

  //         const pendingLiked = likedIds0.filter(id => !scheduledLikedIds.has(id));
  //         console.log(`[LIKED] After Day ${d + 1} — scheduled: [${[...scheduledLikedIds].join(', ')}] | still pending: [${pendingLiked.join(', ')}]`);

  //       } catch (_) {
  //         allDays.push({ day: d + 1, date: label, activities: [] });
  //       }
  //     }

  //     const consolidateLikedAttractions = (days: DayPlan[], likedIds: string[]): DayPlan[] => {
  //       const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  //         const R = 6371;
  //         const dLat = (lat2 - lat1) * Math.PI / 180;
  //         const dLon = (lon2 - lon1) * Math.PI / 180;
  //         const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  //         return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  //       };
  //       const isRealActivity = (a: Activity) => a.id !== 'start' && a.id !== 'end' && a.category !== 'transport';
  //       const result = days.map(d => ({ ...d, activities: [...d.activities] }));

  //       for (let earlyDay = 0; earlyDay < result.length - 1; earlyDay++) {
  //         for (let lateDay = earlyDay + 1; lateDay < result.length; lateDay++) {
  //           const lateActivities = result[lateDay].activities;
  //           for (let li = lateActivities.length - 1; li >= 0; li--) {
  //             const lateAct = lateActivities[li];
  //             if (!likedIds.includes(lateAct.id) || !isRealActivity(lateAct)) continue;
  //             if (!lateAct.latitude || !lateAct.longitude) continue;

  //             const earlyLiked = result[earlyDay].activities.filter(a => likedIds.includes(a.id) && isRealActivity(a) && a.latitude && a.longitude);
  //             if (!earlyLiked.length) continue;

  //             let nearestAct: Activity | null = null;
  //             let nearestDist = Infinity;
  //             for (const ea of earlyLiked) {
  //               const dist = haversineKm(ea.latitude!, ea.longitude!, lateAct.latitude, lateAct.longitude);
  //               if (dist < nearestDist) { nearestDist = dist; nearestAct = ea; }
  //             }
  //             if (!nearestAct || nearestDist > 2) continue;

  //             if (result[earlyDay].activities.some(a => a.id === lateAct.id)) continue;

  //             const earlySpent = result[earlyDay].activities.filter(isRealActivity).reduce((s, a) => s + (a.cost_egp ?? 0), 0);
  //             const earlyBudget = result[earlyDay].budget_remaining ?? 0;
  //             if (earlySpent + (lateAct.cost_egp ?? 0) > (earlyBudget + earlySpent)) continue;

  //             lateActivities.splice(li, 1);
  //             const insertIdx = result[earlyDay].activities.findIndex(a => a.id === nearestAct!.id) + 1;
  //             result[earlyDay].activities.splice(insertIdx, 0, lateAct);
  //             console.log(`[ITINERARY] Consolidated '${lateAct.title}' → Day ${earlyDay + 1} (${nearestDist.toFixed(1)} km from '${nearestAct.title}')`);
  //           }
  //         }
  //       }
  //       return result;
  //     };

  //     console.log('[DEBUG] allDays before filter:', allDays.map(d => ({
  //       day: d.day,
  //       actCount: d.activities.length,
  //       ids: d.activities.map(a => a.id)
  //     })));

  //     const realDays = consolidateLikedAttractions(allDays, likedIds0)
  //       // .filter(d => d.activities.some(a => a.id !== 'start' && a.id !== 'end'))
  //       .filter(d => d.activities.length > 2)  // at minimum: start + 1 real stop + end
  //       .filter((d, i, arr) => arr.findIndex(x => x.day === d.day) === i);

  //     setDays(realDays);
  //     setActiveDay(prev => Math.min(prev, Math.max(0, realDays.length - 1)));
  //     generateDaySummaries(realDays);
  //   } catch (err) {
  //     console.error('Plan generation error:', err);
  //     setDays([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // ── Plan coach ────────────────────────────────────────────────────
  const sendPlanCoachMessage = async (preset?: string): Promise<void> => {
    const raw =
      typeof preset === 'string' ? preset : planCoachInput;
    const text = (typeof raw === 'string' ? raw : String(raw ?? '')).trim();
    if (!text || planCoachLoading) return;

    const coachUserId = userId ?? ctxUserId ?? 0;
    const latest = await refreshFeatures(coachUserId || undefined);
    if (latest.plan_coach_remaining <= 0) {
      Alert.alert(
        'Plan coach limit',
        `Free accounts get ${latest.plan_coach_limit} plan coach messages per day. Upgrade to TourMate Pro for unlimited edits.`,
      );
      return;
    }

    setPlanCoachPreview(null);
    if (typeof preset === 'string') setPlanCoachInput('');

    const startLat =
      params.startLat != null ? parseFloat(String(params.startLat)) : userLocation?.latitude;
    const startLon =
      params.startLon != null ? parseFloat(String(params.startLon)) : userLocation?.longitude;

    const nextMessages = [...planCoachMessages, { role: 'user' as const, content: text }];
    setPlanCoachMessages(nextMessages);
    setPlanCoachInput('');
    setPlanCoachLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ai/plan-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: coachUserId,
          messages: nextMessages,
          plan_days: days,
          city,
          interests,
          day_schedules: effectiveDaySchedules,
          is_foreigner: params.isForeigner === 'true',
          start_lat: Number.isFinite(startLat) ? startLat : undefined,
          start_lon: Number.isFinite(startLon) ? startLon : undefined,
          budget: Number(params.budget ?? 0),
          start_date: startDate.toString().split('T')[0],
          existing_coach_extra_spend_egp: coachExtraSpendEgp,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.code === 'PLAN_COACH_LIMIT') await refreshFeatures(coachUserId || undefined);
        setPlanCoachMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.error || 'Something went wrong. Try again.' },
        ]);
        return;
      }
      await refreshFeatures(coachUserId || undefined);
      setPlanCoachMessages(prev => [...prev, { role: 'assistant', content: String(data.reply || '') }]);
      if (Array.isArray(data.plan_days_preview) && data.plan_days_preview.length > 0) {
        setPlanCoachPreview({
          days: data.plan_days_preview as DayPlan[],
          warnings: Array.isArray(data.optimization_warnings) ? data.optimization_warnings : [],
          day_schedules: Array.isArray(data.day_schedules_preview) ? data.day_schedules_preview : null,
          end_date: data.end_date_preview != null ? String(data.end_date_preview) : null,
          coach_extra_spend:
            typeof data.coach_extra_spend_total_preview === 'number'
              ? data.coach_extra_spend_total_preview
              : null,
        });
      }
    } catch {
      setPlanCoachMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Network error. Check your connection and try again.' },
      ]);
    } finally {
      setPlanCoachLoading(false);
    }
  };

  const applyPlanCoachPreview = (): void => {
    if (!planCoachPreview) return;
    const appliedDaysSnapshot = planCoachPreview.days;
    setDays(appliedDaysSnapshot);
    if (
      Array.isArray(planCoachPreview.day_schedules) &&
      planCoachPreview.day_schedules.length === planCoachPreview.days.length
    ) {
      setCoachDaySchedules(planCoachPreview.day_schedules);
    }
    if (planCoachPreview.end_date) {
      setCoachEndDate(planCoachPreview.end_date);
    }
    if (planCoachPreview.coach_extra_spend != null) {
      setCoachExtraSpendEgp(planCoachPreview.coach_extra_spend);
    }
    setActiveDay(prev =>
      Math.min(prev, Math.max(0, planCoachPreview.days.length - 1)),
    );
    setPlanCoachPreview(null);
    setPlanCoachMessages(prev => [
      ...prev,
      { role: 'assistant', content: 'Changes applied to your plan.' },
    ]);
    void (async () => {
      setPlanSaving(true);
      const id = await upsertPlanToServer(appliedDaysSnapshot);
      setPlanSaving(false);
      if (id) {
        setServerPlanId(id);
        setPlanSaved(true);
      }
    })();
  };

  useEffect(() => {
    if (showAIChat && planCoachMessages.length > 0) {
      requestAnimationFrame(() => {
        planCoachListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [planCoachMessages, showAIChat]);

  // ── Save / update plan on server (POST new or PUT when plan already exists) ──
const upsertPlanToServer = async (itineraryOverride?: DayPlan[]): Promise<string | undefined> => {
  const targetId = serverPlanId ?? existingPlanId;
  const itineraryPayload = itineraryOverride ?? days;
  const selectedFlight = useBookingStore.getState().selectedFlight;
  const selectedHotel = useBookingStore.getState().selectedHotel;

  const payload = {
    city,
    start_date: startDate.toString().split('T')[0],
    end_date: effectiveEndDate,
    budget: params.budget,
    day_hours: JSON.stringify(effectiveDaySchedules),
    interests,
    spot_ids: spotIdsForApi,
    itinerary: itineraryPayload,
    user_id: userId ?? 1,
    flight_details: selectedFlight ?? null,
    hotel_details: selectedHotel ?? null,
  };

  try {
    if (targetId) {
      const res = await fetch(`${API_BASE}/plans/item/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const t = await res.text();
        throw new Error(`Unexpected response (${res.status}): ${t.slice(0, 120)}`);
      }
      const data = await res.json();
      if (data.success) return String(targetId);
      throw new Error(data.message);
    }

    const res = await fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    if (data.success && data.data?.id) {
      const nid = String(data.data.id);
      setServerPlanId(nid);
      return nid;
    }
    throw new Error(data.message);
  } catch (err) {
    console.error('Save plan error:', err);
    return undefined;
  }
};

  const savePlan = async (): Promise<void> => {
    if (planSaving) return;
    setPlanSaving(true);
    const planId = await upsertPlanToServer();
    setPlanSaving(false);
    if (planId) {
      setPlanSaved(true);
    } else {
      Alert.alert('Could not save', 'Something went wrong. Please try again.');
    }
  };

  const openMap = async (): Promise<void> => {
    setSaving(true);
    const planId = serverPlanId ?? existingPlanId ?? (await upsertPlanToServer());
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
    const planId = serverPlanId ?? existingPlanId ?? (await upsertPlanToServer());
    setSaving(false);

    router.push({
      pathname: '/(main)/city-intro' as any,
      params: {
        city,
        planId,
        startDate: startDate.toString().split('T')[0],
        endDate: effectiveEndDate,
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
          disabled={planSaving}
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
                isLiked={likedIdSet.has(activity.id.replace(/^ATT0*/i, ''))}
                onPress={() => {
                  const hasRealId = activity.id && !activity.id.startsWith('rec-') && activity.id !== 'start' && activity.id !== 'end';
                  if (hasRealId) {
                    openAttractionSheet(activity);
                  } else {
                    setSelectedActivity(activity);
                  }
                }}
              />
            </React.Fragment>
          );
        })}

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
              {totalRemaining < 0 && (
                <View style={styles.budgetWarning}>
                  <MaterialCommunityIcons name="alert" size={14} color="#92400E" />
                  <Text style={styles.budgetWarningText}>
                    You've gone over budget by {Math.abs(Math.round(totalRemaining))} EGP to keep your preferred stops. Increase the budget or remove an activity to stay within limits.
                  </Text>
                </View>
              )}
              {totalRemaining >= 0 && (
                <View style={styles.budgetBar}>
                  <View style={[styles.budgetBarFill, { width: `${pct}%` as any }]} />
                </View>
              )}
            </View>
          );
        })()}

        {(() => {
          const realActivities = currentDay?.activities.filter(
            a => a.id !== 'start' && a.id !== 'end'
          ) ?? [];
          const lastStop = realActivities[realActivities.length - 1];
          if (!lastStop?.time) return null;
          const toHr = (t: string) => {
            const [h, m] = t.split(':');
            return parseInt(h, 10) + parseInt(m ?? '0', 10) / 60;
          };
          const lastStopEndHr = toHr(lastStop.time) + (lastStop.duration_hrs ?? 0);
          const configuredEndHr = baseDaySchedules[activeDay]?.end_hour ?? 21;
          if (configuredEndHr - lastStopEndHr < 2) return null;
          return (
            <View style={styles.shortDayNotice}>
              <MaterialCommunityIcons name="information-outline" size={15} color="#92400E" />
              <Text style={styles.shortDayNoticeText}>
                This day is a bit light. It looks like we ran out of places that match your interests nearby — try adding more interests or reducing the number of days for a fuller schedule.
              </Text>
            </View>
          );
        })()}

{/* ── Booking Details ── */}
<View style={bookingStyles.container}>

  {/* ── FLIGHT CARD ── */}
  <TouchableOpacity
    style={bookingStyles.dropdownHeader}
    onPress={() => setFlightExpanded(p => !p)}
    activeOpacity={0.8}
  >
    <View style={bookingStyles.dropdownLeft}>
      <MaterialCommunityIcons name="airplane" size={18} color="#E67E22" />
      <Text style={bookingStyles.dropdownTitle}>Flight Details</Text>
      {selectedFlight && !flightExpanded && (
        <View style={bookingStyles.filledBadge}>
          <Text style={bookingStyles.filledBadgeText}>✓ Saved</Text>
        </View>
      )}
    </View>
    <MaterialCommunityIcons
      name={flightExpanded ? 'chevron-up' : 'chevron-down'}
      size={20}
      color="#999"
    />
  </TouchableOpacity>

  {flightExpanded && (
    <View style={bookingStyles.dropdownBody}>
      {selectedFlight && !editingFlight ? (
        // ── Display mode ──
        <View>
          <View style={bookingStyles.detailRow}>
            <Text style={bookingStyles.detailLabel}>Airline</Text>
            <Text style={bookingStyles.detailValue}>{selectedFlight.airline}</Text>
          </View>
          <View style={bookingStyles.detailRow}>
            <Text style={bookingStyles.detailLabel}>Flight No.</Text>
            <Text style={bookingStyles.detailValue}>{selectedFlight.flightNumber}</Text>
          </View>
          {!!selectedFlight.departureTime && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Departure</Text>
              <Text style={bookingStyles.detailValue}>{selectedFlight.departureTime}</Text>
            </View>
          )}
          {!!selectedFlight.arrivalTime && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Arrival</Text>
              <Text style={bookingStyles.detailValue}>{selectedFlight.arrivalTime}</Text>
            </View>
          )}
          {!!selectedFlight.price && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Price</Text>
              <Text style={bookingStyles.detailValue}>{selectedFlight.price} EGP</Text>
            </View>
          )}
          {!!selectedFlight.bookingUrl && (
            <TouchableOpacity
              style={bookingStyles.linkRow}
              onPress={() => Linking.openURL(selectedFlight.bookingUrl!)}
            >
              <MaterialCommunityIcons name="link-variant" size={14} color="#E67E22" />
              <Text style={bookingStyles.linkText} numberOfLines={1}>
                {selectedFlight.bookingUrl}
              </Text>
              <MaterialCommunityIcons name="open-in-new" size={14} color="#E67E22" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={bookingStyles.editBtn}
            onPress={() => {
              setFlightForm({
                airline: selectedFlight.airline ?? '',
                flightNumber: selectedFlight.flightNumber ?? '',
                departureTime: selectedFlight.departureTime ?? '',
                arrivalTime: selectedFlight.arrivalTime ?? '',
                price: String(selectedFlight.price ?? ''),
                bookingUrl: selectedFlight.bookingUrl ?? '',
              });
              setEditingFlight(true);
            }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={14} color="#E67E22" />
            <Text style={bookingStyles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── Edit / Empty form ──
        <View>
          <View style={bookingStyles.inputRow}>
            <View style={[bookingStyles.inputGroup, { flex: 1.5 }]}>
              <Text style={bookingStyles.inputLabel}>Airline *</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="e.g. EgyptAir"
                value={flightForm.airline}
                onChangeText={v => setFlightForm(p => ({ ...p, airline: v }))}
              />
            </View>
            <View style={[bookingStyles.inputGroup, { flex: 1 }]}>
              <Text style={bookingStyles.inputLabel}>Flight No. *</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="e.g. MS302"
                value={flightForm.flightNumber}
                onChangeText={v => setFlightForm(p => ({ ...p, flightNumber: v }))}
              />
            </View>
          </View>

          <View style={bookingStyles.inputRow}>
            <View style={bookingStyles.inputGroup}>
              <Text style={bookingStyles.inputLabel}>Departure Time</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="e.g. 08:00 AM"
                value={flightForm.departureTime}
                onChangeText={v => setFlightForm(p => ({ ...p, departureTime: v }))}
              />
            </View>
            <View style={bookingStyles.inputGroup}>
              <Text style={bookingStyles.inputLabel}>Arrival Time</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="e.g. 10:30 AM"
                value={flightForm.arrivalTime}
                onChangeText={v => setFlightForm(p => ({ ...p, arrivalTime: v }))}
              />
            </View>
          </View>

          <View style={bookingStyles.inputGroup}>
            <Text style={bookingStyles.inputLabel}>Total Price (EGP)</Text>
            <TextInput
              style={bookingStyles.input}
              placeholder="e.g. 12000"
              keyboardType="numeric"
              value={flightForm.price}
              onChangeText={v => setFlightForm(p => ({ ...p, price: v }))}
            />
          </View>

          <View style={bookingStyles.inputGroup}>
            <Text style={bookingStyles.inputLabel}>Booking URL</Text>
            <TextInput
              style={bookingStyles.input}
              placeholder="e.g. https://www.google.com/flights/..."
              value={flightForm.bookingUrl}
              onChangeText={v => setFlightForm(p => ({ ...p, bookingUrl: v }))}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={bookingStyles.formActions}>
            <TouchableOpacity
              style={bookingStyles.saveFormBtn}
              onPress={async () => {
                const updatedFlight: Flight = {
                  airline: flightForm.airline,
                  flightNumber: flightForm.flightNumber,
                  departure: '',
                  arrival: '',
                  departureTime: flightForm.departureTime,
                  arrivalTime: flightForm.arrivalTime,
                  duration: '',
                  class: 'Economy',
                  price: parseFloat(flightForm.price) || 0,
                  bookingUrl: flightForm.bookingUrl,
                };
                setEditingFlight(false);
                setSelectedFlight(updatedFlight);
                await upsertPlanToServer();
              }}
              disabled={!flightForm.airline.trim() || !flightForm.flightNumber.trim()}
            >
              <Text style={bookingStyles.saveFormBtnText}>Save Flight</Text>
            </TouchableOpacity>
            {selectedFlight && (
              <TouchableOpacity
                style={bookingStyles.cancelBtn}
                onPress={() => setEditingFlight(false)}
              >
                <Text style={bookingStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  )}

  <View style={bookingStyles.divider} />

  {/* ── HOTEL CARD ── */}
  <TouchableOpacity
    style={bookingStyles.dropdownHeader}
    onPress={() => setHotelExpanded(p => !p)}
    activeOpacity={0.8}
  >
    <View style={bookingStyles.dropdownLeft}>
      <MaterialCommunityIcons name="bed" size={18} color="#E67E22" />
      <Text style={bookingStyles.dropdownTitle}>Hotel Details</Text>
      {selectedHotel && !hotelExpanded && (
        <View style={bookingStyles.filledBadge}>
          <Text style={bookingStyles.filledBadgeText}>✓ Saved</Text>
        </View>
      )}
    </View>
    <MaterialCommunityIcons
      name={hotelExpanded ? 'chevron-up' : 'chevron-down'}
      size={20}
      color="#999"
    />
  </TouchableOpacity>

  {hotelExpanded && (
    <View style={bookingStyles.dropdownBody}>
      {selectedHotel && !editingHotel ? (
        // ── Display mode ──
        <View>
          <View style={bookingStyles.detailRow}>
            <Text style={bookingStyles.detailLabel}>Hotel</Text>
            <Text style={bookingStyles.detailValue}>{selectedHotel.name}</Text>
          </View>
          {!!selectedHotel.checkIn && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Check-in</Text>
              <Text style={bookingStyles.detailValue}>{selectedHotel.checkIn}</Text>
            </View>
          )}
          {!!selectedHotel.checkOut && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Check-out</Text>
              <Text style={bookingStyles.detailValue}>{selectedHotel.checkOut}</Text>
            </View>
          )}
          {!!selectedHotel.price_per_night && (
            <View style={bookingStyles.detailRow}>
              <Text style={bookingStyles.detailLabel}>Per Night</Text>
              <Text style={bookingStyles.detailValue}>{selectedHotel.price_per_night} EGP</Text>
            </View>
          )}
          {!!selectedHotel.bookingUrl && (
            <TouchableOpacity
              style={bookingStyles.linkRow}
              onPress={() => Linking.openURL(selectedHotel.bookingUrl!)}
            >
              <MaterialCommunityIcons name="link-variant" size={14} color="#E67E22" />
              <Text style={bookingStyles.linkText} numberOfLines={1}>
                {selectedHotel.bookingUrl}
              </Text>
              <MaterialCommunityIcons name="open-in-new" size={14} color="#E67E22" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={bookingStyles.editBtn}
            onPress={() => {
              setHotelForm({
                name: selectedHotel.name ?? '',
                checkIn: selectedHotel.checkIn ?? '',
                checkOut: selectedHotel.checkOut ?? '',
                pricePerNight: String(selectedHotel.price_per_night ?? ''),
                bookingUrl: selectedHotel.bookingUrl ?? '',
              });
              setEditingHotel(true);
            }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={14} color="#E67E22" />
            <Text style={bookingStyles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── Edit / Empty form ──
        <View>
          <View style={bookingStyles.inputGroup}>
            <Text style={bookingStyles.inputLabel}>Hotel Name *</Text>
            <TextInput
              style={bookingStyles.input}
              placeholder="e.g. Marriott Hurghada"
              value={hotelForm.name}
              onChangeText={v => setHotelForm(p => ({ ...p, name: v }))}
            />
          </View>

          <View style={bookingStyles.inputRow}>
            <View style={bookingStyles.inputGroup}>
              <Text style={bookingStyles.inputLabel}>Check-in</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="YYYY-MM-DD"
                value={hotelForm.checkIn}
                onChangeText={v => setHotelForm(p => ({ ...p, checkIn: v }))}
              />
            </View>
            <View style={bookingStyles.inputGroup}>
              <Text style={bookingStyles.inputLabel}>Check-out</Text>
              <TextInput
                style={bookingStyles.input}
                placeholder="YYYY-MM-DD"
                value={hotelForm.checkOut}
                onChangeText={v => setHotelForm(p => ({ ...p, checkOut: v }))}
              />
            </View>
          </View>

          <View style={bookingStyles.inputGroup}>
            <Text style={bookingStyles.inputLabel}>Price Per Night (EGP)</Text>
            <TextInput
              style={bookingStyles.input}
              placeholder="e.g. 1500"
              keyboardType="numeric"
              value={hotelForm.pricePerNight}
              onChangeText={v => setHotelForm(p => ({ ...p, pricePerNight: v }))}
            />
          </View>

          <View style={bookingStyles.inputGroup}>
            <Text style={bookingStyles.inputLabel}>Booking URL</Text>
            <TextInput
              style={bookingStyles.input}
              placeholder="e.g. https://www.booking.com/..."
              value={hotelForm.bookingUrl}
              onChangeText={v => setHotelForm(p => ({ ...p, bookingUrl: v }))}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={bookingStyles.formActions}>
            <TouchableOpacity
              style={bookingStyles.saveFormBtn}
              onPress={async () => {
                const updatedHotel: Hotel = {
                  id: selectedHotel?.id ?? Date.now(),
                  name: hotelForm.name,
                  city,
                  stars: selectedHotel?.stars ?? 4,
                  price_per_night: parseFloat(hotelForm.pricePerNight) || 0,
                  image_url: selectedHotel?.image_url ?? '',
                  rating: selectedHotel?.rating ?? 4.5,
                  bookingUrl: hotelForm.bookingUrl,
                  checkIn: hotelForm.checkIn,
                  checkOut: hotelForm.checkOut,
                };
                setEditingHotel(false);
                setSelectedHotel(updatedHotel);
                await upsertPlanToServer();
              }}
              disabled={!hotelForm.name.trim()}
            >
              <Text style={bookingStyles.saveFormBtnText}>Save Hotel</Text>
            </TouchableOpacity>
            {selectedHotel && (
              <TouchableOpacity
                style={bookingStyles.cancelBtn}
                onPress={() => setEditingHotel(false)}
              >
                <Text style={bookingStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  )}

</View>

{/* ── AI Plan Coach ── */}
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

      {/* ── Plan coach modal ── */}
      <Modal visible={showAIChat} animationType="slide" transparent onRequestClose={() => setShowAIChat(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              setShowAIChat(false);
            }}
          />
          <View style={styles.planCoachSheet}>
            <View style={styles.planCoachGrabber} />
            <View style={styles.modalHeader}>
              <View style={styles.aiModalTitle}>
                <MaterialCommunityIcons name="map-search-outline" size={22} color="#E67E22" />
                <Text style={styles.modalTitle}>Plan coach</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAIChat(false);
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.planCoachSubtitle}>
              Change stops, hours, or whole days; add a day from our list; log extra taxi spend; or ask local tips — only places we have in {city}.
            </Text>

            {planCoachPreview && (
              <View style={styles.planCoachPreviewBanner}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#B45309" />
                <View style={styles.planCoachPreviewMid}>
                  <Text style={styles.planCoachPreviewTitle}>Proposed changes</Text>
                  {planCoachPreview.warnings.length > 0 && (
                    <View style={styles.planCoachWarnList}>
                      {planCoachPreview.warnings
                        .map(simplifyCoachWarning)
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((w, i) => (
                          <Text key={i} style={styles.planCoachWarnItem}>
                            {w}
                          </Text>
                        ))}
                    </View>
                  )}
                  <Text style={styles.planCoachPreviewHint}>
                    Your plan will not change until you press Apply.
                  </Text>
                </View>
                <View style={styles.planCoachPreviewActions}>
                  <TouchableOpacity style={styles.planCoachApplyBtn} onPress={applyPlanCoachPreview} activeOpacity={0.85}>
                    <Text style={styles.planCoachApplyBtnText}>Apply</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.planCoachDiscardBtn}
                    onPress={() => setPlanCoachPreview(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.planCoachDiscardBtnText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <FlatList
              ref={planCoachListRef}
              data={planCoachMessages}
              keyExtractor={(_, i) => `m-${i}`}
              style={styles.planCoachList}
              contentContainerStyle={styles.planCoachListContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.planCoachBubble,
                    item.role === 'user' ? styles.planCoachBubbleUser : styles.planCoachBubbleAssistant,
                  ]}
                >
                  <Text style={styles.planCoachBubbleText}>{item.content}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.planCoachEmptyWrap}>
                  <Text style={styles.aiPlaceholder}>
                    Tap a suggestion below or type your own — edits stay on database places for {city}.
                  </Text>
                  <Text style={styles.planCoachSuggestionsTitle}>Try:</Text>
                  <View style={styles.planCoachSuggestionsGrid}>
                    {PLAN_COACH_SUGGESTIONS.map((label, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.planCoachSuggestionChip}
                        onPress={() => sendPlanCoachMessage(label)}
                        activeOpacity={0.85}
                        disabled={planCoachLoading}
                      >
                        <Text style={styles.planCoachSuggestionChipText}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
            />

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="Message plan coach..."
                placeholderTextColor="#AAA"
                value={planCoachInput}
                onChangeText={setPlanCoachInput}
                multiline
                editable={!planCoachLoading}
              />
              <TouchableOpacity
                style={[styles.aiSendBtn, planCoachLoading && { opacity: 0.6 }]}
                onPress={() => void sendPlanCoachMessage()}
                disabled={planCoachLoading}
              >
                {planCoachLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.aiSendIcon}>→</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Full Attraction Sheet ── */}
     <AttractionSheet
      attraction={sheetAttraction}
      visible={showAttractionSheet}
      onClose={() => setShowAttractionSheet(false)}
      userLocation={userLocation}
      onGetDirections={({ latitude, longitude, name }) => {
        setShowAttractionSheet(false);
        router.push({
          pathname: '/(main)/map',
          params: {
            destLat: String(latitude),
            destLng: String(longitude),
            destName: name,
          },
        } as any);
      }}
    />

      {/* ── Activity Detail Modal ── */}
      <Modal
        visible={!!selectedActivity}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedActivity(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedActivity(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={detailStyles.sheet}>
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

            {selectedActivity?.categories && selectedActivity.categories.length > 0 && (
              <View style={detailStyles.tagsRow}>
                {selectedActivity.categories.map((cat, i) => (
                  <View key={i} style={detailStyles.tag}>
                    <Text style={detailStyles.tagText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}

            <ScrollView style={detailStyles.descScroll} showsVerticalScrollIndicator={false}>
              {selectedActivity?.description ? (
                <Text style={detailStyles.description}>{selectedActivity.description}</Text>
              ) : (
                <Text style={detailStyles.descriptionEmpty}>No description available.</Text>
              )}
            </ScrollView>

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
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '85%',
    width: '100%',
    marginBottom: 0,
  },
  header:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconBox:   { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  iconEmoji: {},
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
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: Theme.colors.muted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Header
 header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2C8',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C1810',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  // Day tabs
  dayTabsScroll: { backgroundColor: Theme.colors.card, maxHeight: 70 },
  dayTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },

  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  dayTabActive: {
    backgroundColor: Theme.colors.background,
  },
  dayTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.muted,
  },
  dayTabLabelActive: {
    color: Theme.colors.primary,
  },
  dayTabDate: {
    fontSize: 11,
    color: Theme.colors.muted,
    marginTop: 2,
  },
  dayTabDateActive: {
    color: Theme.colors.primary,
  },
  dayTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: Theme.colors.primary,
    borderRadius: 1,
  },

  daySummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.primary,
  },
  daySummaryIcon: { fontSize: 16 },
  daySummaryText: {
    flex: 1,
    fontSize: 13,
    color: Theme.colors.text,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    minHeight: 52,
  },
  activityTimeCol: { width: 48, paddingTop: 4 },
  activityTime: {
    fontSize: 12,
    color: Theme.colors.muted,
    fontWeight: '500',
  },

  activityLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 6,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.primary,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  activityConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E8DCCF',
    marginTop: 2,
  },

  activityContent: {
    flex: 1,
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    padding: 12,
    marginLeft: 8,
    marginBottom: 8,
    shadowColor: Theme.colors.hero,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
    marginBottom: 4,
  },

  activityCatsRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    marginBottom: 5,
  },

  activityCatPill: {
    backgroundColor: Theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activityCatText: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.primary,
    textTransform: 'capitalize',
  },

  activityMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  activityMetaChip: {
    backgroundColor: '#F3F0EC',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activityMetaChipCost: {
    backgroundColor: Theme.colors.background,
  },
  activityMetaChipFree: {
    backgroundColor: '#EAF6EC',
  },

  activityMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.muted,
  },
  activityMetaTextCost: {
    color: Theme.colors.primary,
  },
  activityMetaTextFree: {
    color: '#27AE60',
  },

  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 4,
  },
activityIcon: {},
  activityTapHint: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: '500',
    marginTop: 5,
  },
  detourNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 5,
    backgroundColor: '#FFF8EE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  detourNoteText: {
    fontSize: 11,
    color: '#A06020',
    flexShrink: 1,
    lineHeight: 15,
  },

  deleteBtn: { padding: 8, marginTop: 4 },
  deleteIcon: { fontSize: 12, color: Theme.colors.muted },

  budgetCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Theme.colors.hero,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  budgetLabel: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '500',
  },
  budgetSpent: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  budgetRemaining: {
    fontSize: 14,
    fontWeight: '700',
    color: '#27AE60',
  },
  budgetOver: {
    color: '#E74C3C',
  },

  budgetWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F5D98B',
  },

  budgetWarningText: {
    flex: 1,
    fontSize: 12,
    color: Theme.colors.hero,
    lineHeight: 18,
  },

  shortDayNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#FFF8EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F5D98B',
  },

  shortDayNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },

  budgetDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 10,
  },

  budgetBar: {
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },

  budgetBarFill: {
    height: 6,
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },

  aiBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    padding: 14,
    shadowColor: Theme.colors.hero,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 8,
    gap: 12,
  },

  aiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  aiAvatarIcon: { fontSize: 22 },

  aiTextBubble: { flex: 1 },
  aiText: {
    fontSize: 14,
    color: Theme.colors.muted,
    lineHeight: 20,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 30,
    gap: 10,
    shadowColor: Theme.colors.hero,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },

  nextBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#DDD' },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryBtn: {
    backgroundColor: Theme.colors.background,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
  },
  secondaryBtnText: {
    color: Theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtnSubtext: {
    color: Theme.colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  homeBtnText: {
    color: Theme.colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    width: '100%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  modalClose: { fontSize: 18, color: Theme.colors.muted },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.muted,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Theme.colors.text,
    marginBottom: 14,
  },

  modalBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },

  modalBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  aiModalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  //aiModalIcon: { fontSize: 22 },
  //aiPlaceholder: { fontSize: 14, color: '#999', lineHeight: 22, marginBottom: 12 },
  planCoachEmptyWrap: { paddingBottom: 4 },
  planCoachSuggestionsTitle: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 10 },
  planCoachSuggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planCoachSuggestionChip: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  planCoachSuggestionChipText: { fontSize: 13, color: '#555', fontWeight: '500', maxWidth: 280 },
  // aiResponseBox: {
  //   backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 16,
  // },

  aiModalIcon: { fontSize: 22 },

  aiPlaceholder: {
    fontSize: 14,
    color: Theme.colors.muted,
    lineHeight: 22,
    marginBottom: 20,
  },

  aiResponseBox: {
    backgroundColor: Theme.colors.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },

  aiResponseText: {
    fontSize: 14,
    color: Theme.colors.text,
    lineHeight: 22,
  },

  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },

  aiInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Theme.colors.text,
    maxHeight: 100,
  },

  aiSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSendIcon: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    saveBtn: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
},

  planCoachSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    width: '100%',
    maxHeight: Math.round(screenHeight * 0.9),
  },
  planCoachGrabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEDEDE',
    marginBottom: 10,
  },
  planCoachSubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    lineHeight: 17,
  },
  planCoachList: {
    maxHeight: Math.round(screenHeight * 0.42),
    minHeight: 120,
    marginBottom: 8,
  },
  planCoachListContent: {
    paddingBottom: 8,
    gap: 10,
  },
  planCoachBubble: {
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  planCoachBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFF3E0',
  },
  planCoachBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
  },
  planCoachBubbleText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 21,
  },

  planCoachPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    marginBottom: 8,
  },
  planCoachPreviewMid: { flex: 1 },
  planCoachPreviewTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  planCoachWarnList: { marginBottom: 4, gap: 4 },
  planCoachWarnItem: { fontSize: 11, color: '#78350F', lineHeight: 16 },
  planCoachPreviewHint: { fontSize: 10, color: '#A16207', fontStyle: 'italic' },
  planCoachPreviewActions: { justifyContent: 'center', gap: 8 },
  planCoachApplyBtn: {
    backgroundColor: '#E67E22',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  planCoachApplyBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  planCoachDiscardBtn: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planCoachDiscardBtnText: { color: '#666', fontSize: 12, fontWeight: '700' },
});
const bookingStyles = StyleSheet.create({
  container: {
    marginBottom: 20,
    backgroundColor: Theme.colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },

  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  dropdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  filledBadge: {
    backgroundColor: '#F0FBF4',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  filledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27AE60',
  },

  dropdownBody: {
    paddingTop: 12,
    paddingBottom: 8,
  },

  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: 8,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },

  detailLabel: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '600',
  },

  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.gold,
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
  },

  linkText: {
    flex: 1,
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600',
  },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDDCB5',
  },

  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E67E22',
  },

  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },

  inputGroup: {
    flex: 1,
    marginBottom: 14,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.muted,
    marginBottom: 5,
  },

  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },

  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },

  saveFormBtn: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },

  saveFormBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelBtnText: {
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});