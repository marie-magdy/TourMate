import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
  Dimensions, ScrollView, Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../constants/AppContext';

const { width, height } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const WALKABLE_DISTANCE_KM = 1.0; // 1km threshold
const ARRIVAL_RADIUS_M = 100;  // metres — considered "arrived" at destination
const MAX_WALK_SPEED_MS = 3.0;  // m/s (~11 km/h) — above this = vehicle detected, no points
const MIN_WALK_DURATION_MS = 3 * 60 * 1000; // 3 minutes minimum for valid walk
const MIN_WALK_PROGRESS_RATIO = 0.6; // user must complete at least 60% of initial distance
const MAX_GPS_ACCURACY_M = 45; // ignore/flag noisy GPS points above this accuracy radius
const MAX_CONSECUTIVE_BAD_ACCURACY = 5; // cancel if signal is poor for too long
const SPEED_WINDOW_SIZE = 6; // rolling sample window size
const MIN_SPEED_SAMPLES_FOR_DECISION = 3;
const MAX_HIGH_SPEED_SAMPLES = 2; // if too many high-speed samples in window => likely vehicle

interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  address?: string;
  distance_km?: number;
}

interface RoutePoint { latitude: number; longitude: number; }

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

interface WalkableBanner {
  visible: boolean;
  place: Place | null;
  distance_km: number;
}

interface PlannedActivity {
  id: string;
  time: string;
  title: string;
  latitude?: number;
  longitude?: number;
  duration_hrs?: number;
  cost_egp?: number;
}

interface PlannedDay {
  day: number;
  date: string;
  activities: PlannedActivity[];
}

interface MappedStop extends PlannedActivity {
  day: number;
  date: string;
  dayOrder: number;
  key: string;
  /** 1-based index across the whole trip when viewing “All” days; same as dayOrder when a single day is selected */
  globalOrder?: number;
}

interface StopLegInfo {
  distanceText: string;
  durationText: string;
  distanceKm: number;
  durationMin: number;
}

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const WALKING_TIPS = [
  'Walking reduces stress and boosts mood instantly!',
  'A 15-min walk burns around 80 calories!',
  'Walking instead of driving reduces CO₂ emissions!',
  'Regular walking lowers the risk of heart disease by 30%!',
  'Walking improves memory and creative thinking!',
  'You\'ll see more of Egypt\'s beauty on foot!',
];

const WalkableBannerModal: React.FC<{
  banner: WalkableBanner;
  onWalk: () => void;
  onDismiss: () => void;
}> = ({ banner, onWalk, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const tip = WALKING_TIPS[Math.floor(Math.random() * WALKING_TIPS.length)];
  const walkMins = Math.round((banner.distance_km / 5) * 60); // avg 5km/h walking

  useEffect(() => {
    if (banner.visible) {
      Animated.spring(slideAnim, { toValue: 0, damping: 15, stiffness: 120, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }).start();
    }
  }, [banner.visible]);

  if (!banner.visible || !banner.place) return null;

  return (
    <Animated.View style={[styles.walkBanner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.walkBannerHeader}>
        <View style={styles.walkBannerLeft}>
          <MaterialCommunityIcons name="walk" size={28} color="#27AE60" />
          <View>
            <Text style={styles.walkBannerTitle}>You can walk here!</Text>
            <Text style={styles.walkBannerSubtitle}>{banner.place.name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.walkBannerClose}>
          <MaterialCommunityIcons name="close" size={14} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.walkStats}>
        <View style={styles.walkStat}>
          <MaterialCommunityIcons name="ruler" size={20} color="#555" />
          <Text style={styles.walkStatValue}>{banner.distance_km.toFixed(2)} km</Text>
          <Text style={styles.walkStatLabel}>distance</Text>
        </View>
        <View style={styles.walkStatDivider} />
        <View style={styles.walkStat}>
          <MaterialCommunityIcons name="clock-outline" size={20} color="#555" />
          <Text style={styles.walkStatValue}>~{walkMins} min</Text>
          <Text style={styles.walkStatLabel}>walk time</Text>
        </View>
        <View style={styles.walkStatDivider} />
        <View style={styles.walkStat}>
          <MaterialCommunityIcons name="star-outline" size={20} color="#E67E22" />
          <Text style={styles.walkStatValue}>+50 pts</Text>
          <Text style={styles.walkStatLabel}>you earn</Text>
        </View>
      </View>

      <View style={styles.walkTip}>
        <Text style={styles.walkTipText}>{tip}</Text>
      </View>

      <View style={styles.walkActions}>
        <TouchableOpacity style={styles.walkSkipBtn} onPress={onDismiss}>
          <Text style={styles.walkSkipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.walkGoBtn} onPress={onWalk} activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="walk" size={18} color="#FFF" />
            <Text style={styles.walkGoBtnText}>Walk & Earn 50pts</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const PointsToast: React.FC<{ visible: boolean; points: number }> = ({ visible, points }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.7);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 1, duration: 250, useNativeDriver: true
          }),
        ]),
        Animated.delay(2500),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.7, duration: 250, useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 0, duration: 250, useNativeDriver: true
          }),
        ]),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <Animated.View style={[
      styles.pointsToast,
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
    ]}>
      <MaterialCommunityIcons name="party-popper" size={22} color="#FFF" />
      <Text style={styles.pointsToastText}>+{points} points earned!</Text>
      <Text style={styles.pointsToastSubtext}>Keep walking to earn more!</Text>
    </Animated.View>
  );
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ itineraryData?: string; city?: string }>();
  const [itinerary, setItinerary]           = useState<any[]>([]);
  const [showItinerary, setShowItinerary]   = useState(false);
  const [selectedDay, setSelectedDay]       = useState<number | null>(null);
  const [plannedDays, setPlannedDays]       = useState<PlannedDay[]>([]);
  const [activeStopKey, setActiveStopKey]   = useState<string | null>(null);
  const router = useRouter();
  const { t, userId } = useApp();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<RoutePoint | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);
  const [nearbyAttractions, setNearbyAttractions] = useState<Place[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [routeMode, setRouteMode] = useState<'fastest' | 'walk'>('fastest');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [bannerShownOnce, setBannerShownOnce] = useState(false);

  const [walkBanner, setWalkBanner] = useState<WalkableBanner>({ visible: false, place: null, distance_km: 0 });
  const [showPointsToast, setShowPointsToast] = useState(false);
  const [earnedPoints, setEarnedPoints]     = useState(0);
  const [walkedPlaces, setWalkedPlaces]     = useState<Set<string>>(new Set());
  const [walkingInProgress, setWalkingInProgress] = useState(false);
  const [walkTarget, setWalkTarget] = useState<Place | null>(null);
  const [walkDistanceLeft, setWalkDistanceLeft] = useState<number>(0);
  const [vehicleDetected, setVehicleDetected] = useState(false);
  const [walkVerificationMessage, setWalkVerificationMessage] = useState<string | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const walkInitialDistRef = useRef<number>(1);
  const walkStartedAtRef = useRef<number | null>(null);
  const walkSpeedSamplesRef = useRef<number[]>([]);
  const walkConsecutiveBadAccuracyRef = useRef<number>(0);
  const walkValidSpeedSamplesRef = useRef<number>(0);
  const [visitedStops, setVisitedStops] = useState<Set<string>>(new Set());
  const [selectedStop, setSelectedStop] = useState<MappedStop | null>(null);
  const [stopLegs, setStopLegs] = useState<Record<string, StopLegInfo>>({});
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [topPlanToolsExpanded, setTopPlanToolsExpanded] = useState(false);
  const [dayStarted, setDayStarted] = useState(false);
  const [startDay, setStartDay] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [dayRouteCoords, setDayRouteCoords] = useState<Record<number, RoutePoint[]>>({});
  const [navigationRouteActive, setNavigationRouteActive] = useState(false);
  const SHEET_COLLAPSED = 132;
  const sheetMaxRef = useRef(Math.round(height * 0.82));
  sheetMaxRef.current = Math.round(Math.min(height * 0.82, height - insets.top - 32));
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetHeightRef = useRef(SHEET_COLLAPSED);
  const pulseAnim = useRef(new Animated.Value(0.45)).current;

  const DAY_COLORS = ['#E67E22', '#3498DB', '#27AE60', '#9B59B6', '#E74C3C', '#F39C12', '#1ABC9C'];
  const parseTimeToMinutes = (time?: string) => {
    if (!time) return Number.MAX_SAFE_INTEGER;
    const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return Number.MAX_SAFE_INTEGER;
    let hours = parseInt(m[1], 10);
    const mins = parseInt(m[2] ?? '0', 10);
    const meridiem = m[3]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return hours * 60 + mins;
  };

  const mapStops = useMemo<MappedStop[]>(() => {
    const raw = plannedDays
      .filter(day => selectedDay === null || day.day === selectedDay)
      .flatMap(day => day.activities
        .filter(activity => typeof activity.latitude === 'number' && typeof activity.longitude === 'number')
        .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time))
        .map((activity, index) => ({
          ...activity,
          day: day.day,
          date: day.date,
          dayOrder: index + 1,
          key: `day${day.day}-${activity.id}-${index}`,
        }))
      );
    if (selectedDay !== null) return raw;
    const sorted = [...raw].sort((a, b) => (a.day !== b.day ? a.day - b.day : a.dayOrder - b.dayOrder));
    return sorted.map((stop, i) => ({ ...stop, globalOrder: i + 1 }));
  }, [plannedDays, selectedDay]);

  const routeByDay = useMemo(() => {
    const grouped: Record<number, RoutePoint[]> = {};
    mapStops.forEach((stop) => {
      if (!grouped[stop.day]) grouped[stop.day] = [];
      grouped[stop.day].push({ latitude: stop.latitude!, longitude: stop.longitude! });
    });
    return grouped;
  }, [mapStops]);

  const stopsByDay = useMemo(() => {
    const grouped: Record<number, MappedStop[]> = {};
    mapStops.forEach((stop) => {
      if (!grouped[stop.day]) grouped[stop.day] = [];
      grouped[stop.day].push(stop);
    });
    return grouped;
  }, [mapStops]);

  const displayedDays = useMemo(() => {
    if (selectedDay === null) return Object.keys(stopsByDay).map(Number).sort((a, b) => a - b);
    return [selectedDay];
  }, [selectedDay, stopsByDay]);

  const firstUnvisitedStop = useMemo(() => {
    const day = startDay ?? selectedDay;
    if (day == null) return null;
    const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
    return dayStops.find((s) => !visitedStops.has(s.key)) ?? null;
  }, [startDay, selectedDay, stopsByDay, visitedStops]);

  const showPlanOverviewExtras = !navigationRouteActive;

  const selectedDaySummary = useMemo(() => {
    const day = selectedDay ?? mapStops[0]?.day ?? null;
    if (day == null) return null;
    const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
    if (dayStops.length === 0) return null;
    const totalDurationAtStops = dayStops.reduce((acc, s) => acc + (s.duration_hrs ?? 1), 0);
    let totalDriveMin = 0;
    let totalKm = 0;
    dayStops.forEach((s, idx) => {
      if (idx === 0) return;
      const leg = stopLegs[`${day}:${idx - 1}->${idx}`];
      if (leg) {
        totalDriveMin += leg.durationMin;
        totalKm += leg.distanceKm;
      }
    });
    const totalHours = totalDurationAtStops + totalDriveMin / 60;
    return {
      day,
      stopCount: dayStops.length,
      totalHours: Math.max(0.5, totalHours),
      totalKm,
    };
  }, [selectedDay, mapStops, stopLegs, stopsByDay]);

  const currentFlowDay = useMemo(() => selectedDay ?? plannedDays[0]?.day ?? null, [selectedDay, plannedDays]);
  const isCurrentDayComplete = useMemo(() => {
    const day = currentFlowDay;
    if (day == null) return false;
    const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
    if (dayStops.length === 0) return false;
    return dayStops.every((s) => visitedStops.has(s.key));
  }, [currentFlowDay, stopsByDay, visitedStops]);

  const fetchItinerary = async () => {
    try {
      const res = await fetch(`${API_BASE}/plans/${userId}`);
      
      if (!res.ok) {
        console.log('Plans endpoint not available');
        return;
      }

      const data = await res.json();

      if (data.success && data.data?.length > 0) {
        const active = data.data[0]; // most recent plan
        if (active.itinerary) {
          setItinerary(active.itinerary ?? []);
          setShowItinerary(true);
        }
      }
    } catch (err) {
      console.error('Itinerary fetch error:', err);
    }
  };

  useEffect(() => {
    getUserLocation();
    fetchItinerary();
  }, []);

  useEffect(() => {
    if (!params.itineraryData) return;
    try {
      const parsed = JSON.parse(params.itineraryData);
      if (Array.isArray(parsed)) {
        setPlannedDays(parsed);
        setSelectedDay(parsed[0]?.day ?? null);
      }
    } catch (err) {
      console.error('Could not parse itinerary map data:', err);
    }
  }, [params.itineraryData]);

  useEffect(() => {
    const loadPlanFromStorage = async () => {
      try {
        const raw = await AsyncStorage.getItem('travelPlan');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.days || !Array.isArray(parsed.days)) return;
        const normalized: PlannedDay[] = parsed.days.map((d: any, dayIdx: number) => ({
          day: Number(d.day ?? dayIdx + 1),
          date: d.date ?? '',
          activities: (d.places ?? []).map((p: any, idx: number) => ({
            id: String(p.id ?? `${d.day ?? dayIdx + 1}-${idx}`),
            time: p.time ?? '',
            title: p.name ?? p.title ?? `Stop ${idx + 1}`,
            latitude: typeof p.lat === 'number' ? p.lat : Number(p.lat),
            longitude: typeof p.lng === 'number' ? p.lng : Number(p.lng),
            duration_hrs: typeof p.duration_hours === 'number' ? p.duration_hours : (p.duration_hrs ?? 1),
            cost_egp: p.cost_egp,
          })),
        }));
        if (normalized.length > 0) {
          setPlannedDays((prev) => prev.length > 0 ? prev : normalized);
          setSelectedDay((prev) => prev ?? normalized[0]?.day ?? null);
        }
      } catch (err) {
        console.error('Could not load travelPlan from AsyncStorage:', err);
      }
    };
    loadPlanFromStorage();
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const fetchDayRoadRoutes = async () => {
      try {
        const next: Record<number, RoutePoint[]> = {};
        for (const day of Object.keys(stopsByDay).map(Number)) {
          const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
          if (dayStops.length < 2) continue;
          const coords = dayStops.map((s) => `${s.longitude},${s.latitude}`).join(';');
          const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (data?.code === 'Ok' && data?.routes?.[0]?.geometry?.coordinates?.length > 0) {
            next[day] = data.routes[0].geometry.coordinates.map((c: number[]) => ({
              latitude: c[1],
              longitude: c[0],
            }));
          }
        }
        setDayRouteCoords(next);
      } catch (err) {
        console.error('Day route fetch failed:', err);
      }
    };
    fetchDayRoadRoutes();
  }, [stopsByDay]);

  useEffect(() => {
    const id = sheetHeightAnim.addListener(({ value }) => {
      sheetHeightRef.current = value;
    });
    return () => sheetHeightAnim.removeListener(id);
  }, [sheetHeightAnim]);

  useEffect(() => {
    Animated.spring(sheetHeightAnim, {
      toValue: sheetExpanded ? sheetMaxRef.current : SHEET_COLLAPSED,
      useNativeDriver: false,
      damping: 22,
      stiffness: 140,
    }).start();
  }, [sheetExpanded, sheetHeightAnim, insets.top]);

  const topChromeCollapsePan = useRef(
    require('react-native').PanResponder.create({
      onMoveShouldSetPanResponder: (_evt: any, gestureState: any) =>
        gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx),
      onPanResponderRelease: (_evt: any, gestureState: any) => {
        if (gestureState.dy > 24) setTopPlanToolsExpanded(false);
      },
    })
  ).current;

  const sheetPanResponder = useRef(
    require('react-native').PanResponder.create({
      onPanResponderGrant: () => {
        sheetHeightAnim.stopAnimation((value: number) => {
          sheetHeightRef.current = value;
        });
      },
      onMoveShouldSetPanResponder: (_evt: any, gestureState: any) =>
        Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_evt: any, gestureState: any) => {
        const cap = sheetMaxRef.current;
        const next = Math.max(
          SHEET_COLLAPSED,
          Math.min(cap, sheetHeightRef.current - gestureState.dy)
        );
        sheetHeightAnim.setValue(next);
      },
      onPanResponderRelease: (_evt: any, gestureState: any) => {
        const cap = sheetMaxRef.current;
        const midpoint = (SHEET_COLLAPSED + cap) / 2;
        const shouldExpand = gestureState.vy < -0.1 || sheetHeightRef.current > midpoint;
        setSheetExpanded(shouldExpand);
      },
    })
  ).current;

  useEffect(() => {
    setDayStarted(false);
    setStartDay(null);
    setSelectedStop(null);
    setNavigationRouteActive(false);
    setSelectedPlaces([]);
    setRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
  }, [selectedDay]);

  useEffect(() => {
    const fetchLegEstimates = async () => {
      const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
      if (!key || mapStops.length < 2) return;
      setDistanceLoading(true);
      try {
        const nextLegs: Record<string, StopLegInfo> = {};
        for (const day of Object.keys(stopsByDay).map(Number)) {
          const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
          for (let i = 1; i < dayStops.length; i += 1) {
            const origin = dayStops[i - 1];
            const destination = dayStops[i];
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.latitude},${origin.longitude}&destinations=${destination.latitude},${destination.longitude}&mode=driving&key=${key}`;
            const res = await fetch(url);
            const data = await res.json();
            const element = data?.rows?.[0]?.elements?.[0];
            if (element?.status === 'OK') {
              const durationMin = Math.max(1, Math.round((element.duration.value ?? 0) / 60));
              const distanceKm = Math.max(0.1, Number(((element.distance.value ?? 0) / 1000).toFixed(1)));
              nextLegs[`${day}:${i - 1}->${i}`] = {
                distanceText: element.distance.text ?? `${distanceKm} km`,
                durationText: element.duration.text ?? `~${durationMin} min`,
                distanceKm,
                durationMin,
              };
            }
          }
        }
        setStopLegs(nextLegs);
      } catch (err) {
        console.error('Distance Matrix fetch failed:', err);
      } finally {
        setDistanceLoading(false);
      }
    };
    fetchLegEstimates();
  }, [stopsByDay, mapStops.length]);

  const dayColor = (day: number) => DAY_COLORS[(day - 1) % DAY_COLORS.length];

  const stopIndexInDay = (stop: MappedStop) => {
    const dayStops = (stopsByDay[stop.day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
    return dayStops.findIndex((s) => s.key === stop.key);
  };

  const legKeyForStop = (stop: MappedStop) => {
    const idx = stopIndexInDay(stop);
    if (idx <= 0) return null;
    return `${stop.day}:${idx - 1}->${idx}` as const;
  };

  const selectedStopLegFromPrev = useMemo(() => {
    if (!selectedStop) return null;
    const key = legKeyForStop(selectedStop);
    return key ? stopLegs[key] ?? null : null;
  }, [selectedStop, stopsByDay, stopLegs]);
  const openExternalNavigation = (lat: number, lng: number, mode: 'maps' | 'uber' | 'careem', navMode?: 'fastest' | 'walk') => {
    if (mode === 'maps') {
      const destination: Place = {
        id: `nav-${lat}-${lng}`,
        name: 'Selected destination',
        latitude: lat,
        longitude: lng,
      };
      if (userLocation) {
        const origin: Place = {
          id: 'user',
          name: 'Your Location',
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        };
        setSelectedPlaces([origin, destination]);
        setNavigationRouteActive(true);
        fetchRoute([origin, destination], navMode ?? routeMode);
      } else {
        setSelectedPlaces([destination]);
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 650);
      }
      return;
    }
    const { Linking } = require('react-native');
    const url =
      mode === 'uber'
          ? `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`
          : `careem://ride?dropoff_lat=${lat}&dropoff_lng=${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Open app', 'Unable to open this app on your device.'));
  };

  const navigateToSelectedStop = (mode: 'fastest' | 'walk') => {
    if (!selectedStop) return;
    if (!userLocation) {
      Alert.alert('Location needed', 'Turn on location to get directions from where you are.');
      return;
    }
    if (mode === 'fastest') cancelWalk();
    setRouteMode(mode);
    const destination: Place = {
      id: `stop-${selectedStop.key}`,
      name: selectedStop.title,
      latitude: selectedStop.latitude!,
      longitude: selectedStop.longitude!,
    };
    const origin: Place = {
      id: 'user',
      name: 'Your Location',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
    setSelectedPlaces([origin, destination]);
    setNavigationRouteActive(true);
    fetchRoute([origin, destination], mode);
    if (mode === 'walk') {
      const distKm = getDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        destination.latitude,
        destination.longitude
      );
      startWalkToPlace(destination, Math.max(0.05, distKm));
    }
  };

  const focusStop = (stop: MappedStop) => {
    setActiveStopKey(stop.key);
    setSelectedStop(stop);
    setNavigationRouteActive(false);
    setSelectedPlaces([]);
    setRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
    mapRef.current?.animateToRegion({
      latitude: stop.latitude!,
      longitude: stop.longitude!,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }, 650);
  };

  const markStopVisited = (stop: MappedStop) => {
    setVisitedStops((prev) => new Set([...prev, stop.key]));
  };

  const handleStartOrNext = () => {
    const day = selectedDay ?? mapStops[0]?.day ?? null;
    if (day == null) return;
    const sortedDayStops = [...(stopsByDay[day] ?? [])].sort((a, b) => a.dayOrder - b.dayOrder);
    if (!dayStarted) {
      setStartDay(day);
      setDayStarted(true);
      const first = sortedDayStops.find((s) => !visitedStops.has(s.key));
      if (first) focusStop(first);
      return;
    }
    if (selectedStop) markStopVisited(selectedStop);
    const visitedAfterCurrent = new Set(visitedStops);
    if (selectedStop) visitedAfterCurrent.add(selectedStop.key);
    const next = sortedDayStops.find((s) => !visitedAfterCurrent.has(s.key));
    if (next) focusStop(next);
    else {
      setDayStarted(false);
    }
  };

  useEffect(() => {
    if (userLocation && nearbyAttractions.length > 0) {
      const timer = setTimeout(() => {
        checkWalkableAttractions();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [nearbyAttractions]);
  useEffect(() => () => { locationWatcherRef.current?.remove(); }, []);

  const checkWalkableAttractions = () => {
    if (!userLocation || bannerShownOnce) return;
    for (const attraction of nearbyAttractions) {
      const dist = getDistanceKm(
        userLocation.latitude, userLocation.longitude,
        attraction.latitude, attraction.longitude
      );
      if (dist <= WALKABLE_DISTANCE_KM && !walkedPlaces.has(attraction.id)) {
        setWalkBanner({ visible: true, place: attraction, distance_km: dist });
        setBannerShownOnce(true);
        break;
      }
    }
  };

  const getUserLocation = async (): Promise<void> => {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
        setUserLocation(coords);
        setLoadingLocation(false);
        fetchAttractions(coords.latitude, coords.longitude);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);
      } else {
        setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
        setLoadingLocation(false);
        fetchAttractions(31.2001, 29.9187);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(coords);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);

      if (lastKnown) {
        const dist = getDistanceKm(
          lastKnown.coords.latitude, lastKnown.coords.longitude,
          coords.latitude, coords.longitude
        );
        if (dist > 0.5) fetchAttractions(coords.latitude, coords.longitude);
      }
    } catch (err) {
      setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
      fetchAttractions(31.2001, 29.9187);
      setLoadingLocation(false);
    }
  };

  const fetchAttractions = async (lat: number, lon: number) => {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { 'User-Agent': 'TourMateApp/1.0 (tourmate@gmail.com)' } }
      );
      const geoData = await geoRes.json();
      const city = geoData.address?.city || geoData.address?.town || 'Alexandria';

      const res = await fetch(`${API_BASE}/attractions?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (data.success) {
        const places: Place[] = data.data
          .filter((a: any) => a.latitude && a.longitude)
          .map((a: any) => ({
            id: String(a.id),
            name: a.name,
            latitude: parseFloat(a.latitude),
            longitude: parseFloat(a.longitude),
            type: a.category,
            distance_km: getDistanceKm(lat, lon, parseFloat(a.latitude), parseFloat(a.longitude)),
          }));
        setNearbyAttractions(places);
      }
    } catch (err) {
      console.error('Attractions fetch error:', err);
    }
  };


  const stopLocationWatcher = () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  };

  const cancelWalk = () => {
    stopLocationWatcher();
    setWalkingInProgress(false);
    setWalkTarget(null);
    setWalkDistanceLeft(0);
    setVehicleDetected(false);
    setWalkVerificationMessage(null);
  };

  const awardWalkPoints = async (place: Place) => {
    try {
      const res = await fetch(`${API_BASE}/points/earn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          points: 50,
          action: 'walk',
          description: `Walked to ${place.name}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEarnedPoints(50);
        setShowPointsToast(true);
        setTimeout(() => setShowPointsToast(false), 3500);
      }
    } catch (err) {
      console.error('Points error:', err);
    }
  };

  const handleWalk = async () => {
    if (!walkBanner.place) return;

    const place = walkBanner.place;
    const bannerDistKm = walkBanner.distance_km;
    setWalkBanner({ visible: false, place: null, distance_km: 0 });
    setWalkedPlaces(prev => new Set([...prev, place.id]));

    if (userLocation) {
      const walkPlace: Place = { ...place, id: `walk_${place.id}` };
      const newPlaces = [
        { id: 'user', name: 'Your Location', latitude: userLocation.latitude, longitude: userLocation.longitude },
        walkPlace,
      ];
      setSelectedPlaces(newPlaces);
      setRouteMode('walk');
      setNavigationRouteActive(true);
      fetchRoute(newPlaces, 'walk');
    }

    const initialDistM = Math.max(1, Math.round(bannerDistKm * 1000));
    walkInitialDistRef.current = initialDistM;
    walkStartedAtRef.current = Date.now();
    walkSpeedSamplesRef.current = [];
    walkConsecutiveBadAccuracyRef.current = 0;
    walkValidSpeedSamplesRef.current = 0;
    setWalkTarget(place);
    setWalkDistanceLeft(initialDistM);
    setVehicleDetected(false);
    setWalkVerificationMessage(null);
    setWalkingInProgress(true);

    stopLocationWatcher();

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (loc) => {
          const accuracy = loc.coords.accuracy ?? 999;
          if (accuracy > MAX_GPS_ACCURACY_M) {
            walkConsecutiveBadAccuracyRef.current += 1;
            if (walkConsecutiveBadAccuracyRef.current >= MAX_CONSECUTIVE_BAD_ACCURACY) {
              subscription.remove();
              locationWatcherRef.current = null;
              setWalkingInProgress(false);
              setWalkTarget(null);
              setWalkDistanceLeft(0);
              setWalkVerificationMessage('GPS signal is too weak to verify walking right now. Please try again in open sky.');
            }
            return;
          }
          walkConsecutiveBadAccuracyRef.current = 0;

          const speed = loc.coords.speed;
          if (speed == null) {
            return;
          }
          walkValidSpeedSamplesRef.current += 1;
          walkSpeedSamplesRef.current = [...walkSpeedSamplesRef.current, speed].slice(-SPEED_WINDOW_SIZE);

          const highSpeedCount = walkSpeedSamplesRef.current.filter(v => v > MAX_WALK_SPEED_MS).length;
          if (
            walkSpeedSamplesRef.current.length >= MIN_SPEED_SAMPLES_FOR_DECISION &&
            highSpeedCount >= MAX_HIGH_SPEED_SAMPLES
          ) {
            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            setVehicleDetected(true);
            setWalkVerificationMessage(null);
            return;
          }

          const dist = Math.round(
            getDistanceKm(
              loc.coords.latitude,
              loc.coords.longitude,
              place.latitude,
              place.longitude,
            ) * 1000,
          );
          setWalkDistanceLeft(dist);

          if (dist <= ARRIVAL_RADIUS_M) {
            const elapsed = walkStartedAtRef.current ? Date.now() - walkStartedAtRef.current : 0;
            const progressRatio = Math.max(0, Math.min(1, (walkInitialDistRef.current - dist) / walkInitialDistRef.current));
            const enoughSpeedSamples = walkValidSpeedSamplesRef.current >= MIN_SPEED_SAMPLES_FOR_DECISION;

            if (elapsed < MIN_WALK_DURATION_MS || progressRatio < MIN_WALK_PROGRESS_RATIO || !enoughSpeedSamples) {
              subscription.remove();
              locationWatcherRef.current = null;
              setWalkingInProgress(false);
              setWalkTarget(null);
              setWalkDistanceLeft(0);
              setWalkVerificationMessage('Walk could not be verified. Keep walking longer to earn points.');
              return;
            }

            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            setWalkVerificationMessage(null);
            awardWalkPoints(place);
          }
        },
      );
      locationWatcherRef.current = subscription;
    } catch (err) {
      console.error('Location watcher error:', err);
      setWalkingInProgress(false);
      setWalkTarget(null);
      setWalkDistanceLeft(0);
      setWalkVerificationMessage('Could not verify your walk right now. Please try again.');
    }
  };

  const startWalkToPlace = async (place: Place, distanceKm: number) => {
    setWalkedPlaces(prev => new Set([...prev, place.id]));
    if (userLocation) {
      const walkPlace: Place = { ...place, id: `walk_${place.id}` };
      const newPlaces = [
        { id: 'user', name: 'Your Location', latitude: userLocation.latitude, longitude: userLocation.longitude },
        walkPlace,
      ];
      setSelectedPlaces(newPlaces);
      setRouteMode('walk');
      setNavigationRouteActive(true);
      fetchRoute(newPlaces, 'walk');
    }
    const initialDistM = Math.max(1, Math.round(distanceKm * 1000));
    walkInitialDistRef.current = initialDistM;
    walkStartedAtRef.current = Date.now();
    walkSpeedSamplesRef.current = [];
    walkConsecutiveBadAccuracyRef.current = 0;
    walkValidSpeedSamplesRef.current = 0;
    setWalkTarget(place);
    setWalkDistanceLeft(initialDistM);
    setVehicleDetected(false);
    setWalkVerificationMessage(null);
    setWalkingInProgress(true);
    stopLocationWatcher();
    try {
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
        (loc) => {
          const accuracy = loc.coords.accuracy ?? 999;
          if (accuracy > MAX_GPS_ACCURACY_M) {
            walkConsecutiveBadAccuracyRef.current += 1;
            if (walkConsecutiveBadAccuracyRef.current >= MAX_CONSECUTIVE_BAD_ACCURACY) {
              subscription.remove();
              locationWatcherRef.current = null;
              setWalkingInProgress(false);
              setWalkTarget(null);
              setWalkDistanceLeft(0);
              setWalkVerificationMessage('GPS signal is too weak to verify walking right now. Please try again in open sky.');
            }
            return;
          }
          walkConsecutiveBadAccuracyRef.current = 0;
          const speed = loc.coords.speed;
          if (speed == null) return;
          walkValidSpeedSamplesRef.current += 1;
          walkSpeedSamplesRef.current = [...walkSpeedSamplesRef.current, speed].slice(-SPEED_WINDOW_SIZE);
          const highSpeedCount = walkSpeedSamplesRef.current.filter(v => v > MAX_WALK_SPEED_MS).length;
          if (walkSpeedSamplesRef.current.length >= MIN_SPEED_SAMPLES_FOR_DECISION && highSpeedCount >= MAX_HIGH_SPEED_SAMPLES) {
            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            setVehicleDetected(true);
            setWalkVerificationMessage(null);
            return;
          }
          const dist = Math.round(getDistanceKm(loc.coords.latitude, loc.coords.longitude, place.latitude, place.longitude) * 1000);
          setWalkDistanceLeft(dist);
          if (dist <= ARRIVAL_RADIUS_M) {
            const elapsed = walkStartedAtRef.current ? Date.now() - walkStartedAtRef.current : 0;
            const progressRatio = Math.max(0, Math.min(1, (walkInitialDistRef.current - dist) / walkInitialDistRef.current));
            const enoughSpeedSamples = walkValidSpeedSamplesRef.current >= MIN_SPEED_SAMPLES_FOR_DECISION;
            if (elapsed < MIN_WALK_DURATION_MS || progressRatio < MIN_WALK_PROGRESS_RATIO || !enoughSpeedSamples) {
              subscription.remove();
              locationWatcherRef.current = null;
              setWalkingInProgress(false);
              setWalkTarget(null);
              setWalkDistanceLeft(0);
              setWalkVerificationMessage('Walk could not be verified. Keep walking longer to earn points.');
              return;
            }
            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            setWalkVerificationMessage(null);
            awardWalkPoints(place);
          }
        },
      );
      locationWatcherRef.current = subscription;
    } catch (err) {
      console.error('Location watcher error:', err);
      setWalkingInProgress(false);
      setWalkTarget(null);
      setWalkDistanceLeft(0);
      setWalkVerificationMessage('Could not verify your walk right now. Please try again.');
    }
  };

  const searchPlaces = async (query: string): Promise<void> => {
    setSearchQuery(query);
    if (query.length < 3) { setSearchResults([]); setShowSearchResults(false); return; }
    setLoadingSearch(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=eg`,
        { headers: { 'User-Agent': 'TourMateApp/1.0' } }
      );
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (err) { console.error('Search error:', err); }
    finally { setLoadingSearch(false); }
  };

  const selectPlace = (result: SearchResult): void => {
    if (!userLocation) {
      Alert.alert('Location needed', 'Turn on location to get directions from where you are.');
      return;
    }
    setWalkBanner({ visible: false, place: null, distance_km: 0 });
    cancelWalk();
    const place: Place = {
      id: result.place_id,
      name: result.display_name.split(',')[0],
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    };

    const origin: Place = {
      id: 'user',
      name: 'Your Location',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
    setSelectedStop(null);
    setNavigationRouteActive(true);
    setSelectedPlaces([origin, place]);
    setSearchQuery('');
    setShowSearchResults(false);
    mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
    fetchRoute([origin, place], routeMode);
  };

  const addAttractionToRoute = (attraction: Place): void => {
    if (!userLocation) {
      Alert.alert('Location needed', 'Turn on location to get directions from where you are.');
      return;
    }
    const origin: Place = {
      id: 'user',
      name: 'Your Location',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
    setSelectedStop(null);
    setNavigationRouteActive(true);
    setSelectedPlaces([origin, attraction]);
    fetchRoute([origin, attraction], routeMode);

    if (attraction.distance_km != null && attraction.distance_km <= WALKABLE_DISTANCE_KM) {
      setWalkBanner({ visible: true, place: attraction, distance_km: attraction.distance_km });
    }
  };

  const fetchRoute = async (places: Place[], mode: 'fastest' | 'walk'): Promise<void> => {
    if (places.length < 2) return;
    setLoadingRoute(true);
    try {
      const coords = places.map(p => `${p.longitude},${p.latitude}`).join(';');
      const base = mode === 'walk'
        ? 'https://routing.openstreetmap.de/routed-foot'
        : 'https://routing.openstreetmap.de/routed-car';
      const profile = mode === 'walk' ? 'foot' : 'driving';
      const url = `${base}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        const routePoints: RoutePoint[] = route.geometry.coordinates.map((c: number[]) => ({ latitude: c[1], longitude: c[0] }));
        setRouteCoords(routePoints);
        setRouteDistance(`${(route.distance / 1000).toFixed(1)} km`);
        setRouteDuration(`${Math.round(route.duration / 60)} min`);
        mapRef.current?.fitToCoordinates(routePoints, { edgePadding: { top: 120, right: 50, bottom: 280, left: 50 }, animated: true });
      } else {
        setRouteCoords([]);
        setRouteDistance(null);
        setRouteDuration(null);
        const message = data?.message ? `\n${data.message}` : '';
        Alert.alert('Route Error', `Could not fetch ${mode === 'walk' ? 'walking' : 'driving'} route.${message}`);
      }
    } catch (err) {
      setRouteCoords([]);
      setRouteDistance(null);
      setRouteDuration(null);
      Alert.alert('Route Error', 'Could not fetch route.');
    }
    finally { setLoadingRoute(false); }
  };

  const switchRouteMode = (mode: 'fastest' | 'walk') => {
    cancelWalk();
    setRouteMode(mode);
    if (selectedPlaces.length >= 2) fetchRoute(selectedPlaces, mode);
  };

  const removePlace = (placeId: string) => {
    const newPlaces = selectedPlaces.filter(p => p.id !== placeId);
    setSelectedPlaces(newPlaces);
    if (newPlaces.length >= 2) fetchRoute(newPlaces, routeMode);
    else { setRouteCoords([]); setRouteDistance(null); setRouteDuration(null); }
  };

  const clearRoute = () => {
    setNavigationRouteActive(false);
    setSelectedPlaces([]);
    setRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  if (loadingLocation || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.latitude ?? 31.2001,
          longitude: userLocation?.longitude ?? 29.9187,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={locationEnabled}
        showsMyLocationButton={false}
        showsCompass
      >
        {locationEnabled && userLocation && <Marker coordinate={userLocation} title="You are here" pinColor="#E67E22" />}

        {nearbyAttractions.map(attraction => {
          const isWalkable = (attraction.distance_km ?? 99) <= WALKABLE_DISTANCE_KM;
          const isSelected = selectedPlaces.find(p => p.id === attraction.id);
          return (
            <Marker
              key={attraction.id}
              coordinate={{ latitude: attraction.latitude, longitude: attraction.longitude }}
              title={attraction.name}
              description={
                isWalkable
                  ? 'Walkable! Tap to add to route'
                  : 'Tap to add to route'
              }
              pinColor={isSelected ? '#E67E22' : isWalkable ? '#27AE60' : '#3498DB'}
              onCalloutPress={() => addAttractionToRoute(attraction)}
            />
          );
        })}

        {selectedPlaces.map((place, index) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={`${index + 1}. ${place.name}`}
            pinColor="#E67E22"
          />
        ))}
        {mapStops.map((stop, index) => {
          const stopDayColor = dayColor(stop.day ?? 1);
          const isVisited = visitedStops.has(stop.key);
          const shouldPulse = dayStarted && firstUnvisitedStop?.key === stop.key;
          const descParts: string[] = [];
          if (stop.time) descParts.push(stop.time);
          if (stop.duration_hrs != null) {
            descParts.push(
              stop.duration_hrs >= 1
                ? `${stop.duration_hrs.toFixed(1)} hr`
                : `${Math.round(stop.duration_hrs * 60)} min`
            );
          }
          if (stop.cost_egp != null) {
            descParts.push(stop.cost_egp === 0 ? 'Free' : `~${Math.round(stop.cost_egp)} EGP`);
          }
          return (
            <Marker
              key={stop.key}
              coordinate={{ latitude: stop.latitude!, longitude: stop.longitude! }}
              title={`Day ${stop.day} • ${stop.globalOrder ?? stop.dayOrder}. ${stop.title}`}
              description={descParts.join(' · ')}
              pinColor={stopDayColor}
              onCalloutPress={() => {
                if (!userLocation) return;
                setActiveStopKey(stop.key);
                setSelectedStop(stop);
                const destination: Place = {
                  id: `dest_${stop.id}_${index}`,
                  name: stop.title,
                  latitude: stop.latitude!,
                  longitude: stop.longitude!,
                };
                const origin: Place = {
                  id: 'user',
                  name: 'Your Location',
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                };
                setSelectedPlaces([origin, destination]);
                setNavigationRouteActive(true);
                fetchRoute([origin, destination], routeMode);
                mapRef.current?.animateToRegion({
                  latitude: stop.latitude!,
                  longitude: stop.longitude!,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 800);
              }}
            >
              <View>
                {shouldPulse && (
                  <Animated.View
                    style={[
                      styles.nextStopPulse,
                      { opacity: pulseAnim, transform: [{ scale: pulseAnim }] }
                    ]}
                  />
                )}
                <View style={[
                  styles.flowMarker,
                  { backgroundColor: isVisited ? '#A7A7A7' : stopDayColor, opacity: isVisited ? 0.8 : 1 },
                  activeStopKey === stop.key && styles.flowMarkerActive
                ]}>
                  {isVisited ? (
                    <MaterialCommunityIcons name="check" size={14} color="#FFF" />
                  ) : (
                    <Text style={styles.flowMarkerText}>{stop.globalOrder ?? stop.dayOrder}</Text>
                  )}
                </View>
              </View>
            </Marker>
          );
        })}
        {showItinerary && itinerary
          .filter(item => 
            item.attraction?.latitude && 
            item.attraction?.longitude &&
            (selectedDay === null || item.day_number === selectedDay)
          )
          .map((item, index) => {
            const dayColor = DAY_COLORS[(item.day_number - 1) % DAY_COLORS.length];
            return (
              <Marker
                key={`itinerary_${item.id}`}
                coordinate={{
                  latitude:  parseFloat(item.attraction.latitude),
                  longitude: parseFloat(item.attraction.longitude),
                }}
                title={`Day ${item.day_number}: ${item.attraction.name}`}
                description={`Stop ${item.visit_order} · ${item.scheduled_time ?? ''}`}
                pinColor={dayColor}
                onCalloutPress={() => addAttractionToRoute({
                  id:        String(item.attraction.id),
                  name:      item.attraction.name,
                  latitude:  parseFloat(item.attraction.latitude),
                  longitude: parseFloat(item.attraction.longitude),
                })}
              />
            );
          })
        }

        {showPlanOverviewExtras && Object.entries(routeByDay).map(([day, coords]) => (
          (dayRouteCoords[Number(day)]?.length ?? 0) >= 2 ? (
            <Polyline
              key={`day_route_${day}`}
              coordinates={dayRouteCoords[Number(day)]}
              strokeColor={dayColor(Number(day))}
              strokeWidth={5}
              lineDashPattern={[1, 0]}
              zIndex={5}
            />
          ) : null
        ))}

        {showPlanOverviewExtras && displayedDays.map((day) => {
          const dayStops = (stopsByDay[day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
          return dayStops.map((stop, idx) => {
            if (idx === 0) return null;
            const prev = dayStops[idx - 1];
            const leg = stopLegs[`${day}:${idx - 1}->${idx}`];
            if (!leg?.durationMin) return null;
            const latitude = (prev.latitude! + stop.latitude!) / 2;
            const longitude = (prev.longitude! + stop.longitude!) / 2;
            return (
              <Marker
                key={`leg-label-${day}-${idx}`}
                coordinate={{ latitude, longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.travelLabel}>
                  <Text style={styles.travelLabelText}>{`~${leg.durationMin} min`}</Text>
                </View>
              </Marker>
            );
          });
        })}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={navigationRouteActive ? '#00B4D8' : (routeMode === 'walk' ? '#27AE60' : '#E67E22')}
            strokeWidth={5}
            lineDashPattern={routeMode === 'walk' ? [1] : [10, 6]}
            zIndex={50}
          />
        )}
      </MapView>

      <View style={[styles.pointsToastWrap, { top: Math.min(insets.top + 200, height * 0.28) }]} pointerEvents="box-none">
        <PointsToast visible={showPointsToast} points={earnedPoints} />
      </View>

      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={16} color="#AAA" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              {...{ placeholder: t('search') }}
              placeholderTextColor="#AAA"
              value={searchQuery}
              onChangeText={searchPlaces}
              onBlur={Keyboard.dismiss}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            {loadingSearch && <ActivityIndicator size="small" color="#E67E22" />}
          </View>
          <TouchableOpacity style={styles.locationBtn} onPress={getUserLocation}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#E67E22" />
          </TouchableOpacity>
        </View>

        {plannedDays.length > 0 && !topPlanToolsExpanded && (
          <TouchableOpacity
            style={styles.topChromePeek}
            onPress={() => setTopPlanToolsExpanded(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#E67E22" />
            <Text style={styles.topChromePeekText}>Days & plan summary</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#666" />
          </TouchableOpacity>
        )}

        {plannedDays.length > 0 && topPlanToolsExpanded && (
          <View style={styles.topPlanToolsCard}>
            <View style={styles.topPlanToolsHeader}>
              <View style={styles.topChromeDragZone} {...topChromeCollapsePan.panHandlers}>
                <View style={styles.topChromeHandleBar} />
                <Text style={styles.topChromeDragHint}>Swipe down to hide</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTopPlanToolsExpanded(false)}
                style={styles.topChromeChevronBtn}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <MaterialCommunityIcons name="chevron-up" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.daySelectorBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll}>
                <TouchableOpacity
                  style={[styles.daySelectorPill, selectedDay === null && { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' }]}
                  onPress={() => setSelectedDay(null)}
                >
                  <Text style={[styles.daySelectorText, selectedDay === null && { color: '#FFF' }]}>All</Text>
                </TouchableOpacity>
                {plannedDays.map((day) => {
                  const dayNumber = Number(day.day) || 1;
                  const isSelected = selectedDay === dayNumber;
                  const dColor = dayColor(dayNumber);
                  return (
                    <TouchableOpacity
                      key={`selector-${dayNumber}`}
                      style={[styles.daySelectorPill, isSelected && { backgroundColor: dColor, borderColor: dColor }]}
                      onPress={() => setSelectedDay(dayNumber)}
                    >
                      <Text style={[styles.daySelectorText, isSelected && { color: '#FFF' }]}>Day {dayNumber}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {selectedDaySummary && (
                <View style={styles.daySummaryBar}>
                  <Text style={styles.daySummaryText} numberOfLines={2}>
                    Day {selectedDaySummary.day}: {selectedDaySummary.stopCount} stops · ~{selectedDaySummary.totalHours.toFixed(1)} hours · {selectedDaySummary.totalKm.toFixed(1)} km total
                  </Text>
                  {distanceLoading && <ActivityIndicator size="small" color="#E67E22" />}
                </View>
              )}
            </View>
            {!walkBanner.visible && (
              <View style={[styles.legendInline, styles.legendInCard]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#E67E22' }]} />
                  <Text style={styles.legendText}>Plan stop</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#27AE60' }]} />
                  <Text style={styles.legendText}>Walkable +50pts</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3498DB' }]} />
                  <Text style={styles.legendText}>Attraction</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {plannedDays.length === 0 && !walkBanner.visible && (
          <View style={[styles.legendInline, styles.legendFloating]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#27AE60' }]} />
              <Text style={styles.legendText}>Walkable +50pts</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3498DB' }]} />
              <Text style={styles.legendText}>Attraction</Text>
            </View>
          </View>
        )}

        {!locationEnabled && (
          <View style={styles.locationDisabledBanner}>
            <Text style={styles.locationDisabledText}>
              📍 Location Services are turned off in Settings. Enable it to use GPS and walkability.
            </Text>
          </View>
        )}

        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.map(result => (
              <TouchableOpacity key={result.place_id} style={styles.searchResultItem} onPress={() => selectPlace(result)}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color="#E67E22" style={{ marginRight: 10 }} />
                <View style={styles.searchResultText}>
                  <Text style={styles.searchResultName} numberOfLines={1}>{result.display_name.split(',')[0]}</Text>
                  <Text style={styles.searchResultAddress} numberOfLines={1}>{result.display_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>

      {walkVerificationMessage && (
        <View style={styles.walkVerificationBanner}>
          <Text style={styles.walkVerificationText}>{walkVerificationMessage}</Text>
          <TouchableOpacity onPress={() => setWalkVerificationMessage(null)}>
            <Text style={styles.walkVerificationDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {
        !walkBanner.visible && !walkingInProgress && !vehicleDetected && plannedDays.length > 0 && (
          <Animated.View
            style={[
              styles.bottomPanel,
              {
                height: sheetHeightAnim,
                paddingBottom: insets.bottom + 56,
              },
            ]}
            {...sheetPanResponder.panHandlers}
          >
          <TouchableOpacity
            style={styles.sheetHandle}
            onPress={() => setSheetExpanded((prev) => !prev)}
            {...sheetPanResponder.panHandlers}
          >
            <View style={styles.sheetHandleBar} />
          </TouchableOpacity>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
          {plannedDays.length > 0 && (
            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Text style={styles.planSectionTitle}>
                  Day {selectedDay ?? selectedDaySummary?.day ?? 1} — {mapStops.length} stops — ~{selectedDaySummary?.totalHours.toFixed(1) ?? '0.0'} hours total
                </Text>
                <Text style={styles.planSectionSubtitle}>{params.city ?? 'Trip plan'}</Text>
              </View>
              {selectedStop && (
                <View style={styles.sheetStopCard}>
                  <View style={styles.stopCardHeader}>
                    <Text style={styles.stopCardTitle} numberOfLines={1}>{selectedStop.title}</Text>
                    <TouchableOpacity onPress={() => setSelectedStop(null)}>
                      <Text style={styles.stopCardClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.stopCardMeta}>
                    From previous plan stop:{' '}
                    {selectedStopLegFromPrev
                      ? `${selectedStopLegFromPrev.durationText} · ${selectedStopLegFromPrev.distanceText}`
                      : stopIndexInDay(selectedStop) <= 0
                        ? 'First stop of the day'
                        : 'Estimate loading…'}
                  </Text>
                  <Text style={styles.stopCardMeta}>Stay time: ~{Math.round((selectedStop.duration_hrs ?? 1) * 60)} min</Text>
                  <View style={styles.stopModeRow}>
                    <TouchableOpacity
                      style={[styles.stopModeBtn, routeMode === 'fastest' && styles.stopModeBtnActive]}
                      onPress={() => navigateToSelectedStop('fastest')}
                    >
                      <Text style={[styles.stopModeText, routeMode === 'fastest' && styles.stopModeTextActive]}>🚗 Drive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.stopModeBtn, routeMode === 'walk' && styles.stopModeBtnActiveWalk]}
                      onPress={() => navigateToSelectedStop('walk')}
                    >
                      <Text style={[styles.stopModeText, routeMode === 'walk' && styles.stopModeTextActiveWalk]}>🚶 Walk + pts</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.stopCardActions}>
                    <TouchableOpacity style={styles.stopActionBtn} onPress={() => openExternalNavigation(selectedStop.latitude!, selectedStop.longitude!, 'maps')}>
                      <Text style={styles.stopActionText}>🗺️ Route On Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.stopActionBtn} onPress={() => openExternalNavigation(selectedStop.latitude!, selectedStop.longitude!, 'uber')}>
                      <Text style={styles.stopActionText}>🚗 Uber</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.stopActionBtn} onPress={() => openExternalNavigation(selectedStop.latitude!, selectedStop.longitude!, 'careem')}>
                      <Text style={styles.stopActionText}>🟢 Careem</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.markVisitedBtn} onPress={() => markStopVisited(selectedStop)}>
                    <Text style={styles.markVisitedText}>✅ Mark as visited</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.planStopsList}>
                {mapStops.length === 0 ? (
                  <Text style={styles.planEmptyText}>This plan has no map coordinates yet for the selected day.</Text>
                ) : (
                  mapStops.map((stop, index) => {
                    const rowDayColor = DAY_COLORS[(stop.day - 1) % DAY_COLORS.length];
                    const dayStopsSorted = (stopsByDay[stop.day] ?? []).sort((a, b) => a.dayOrder - b.dayOrder);
                    const idxInDay = dayStopsSorted.findIndex((s) => s.key === stop.key);
                    const prevPlanLeg = idxInDay > 0 ? stopLegs[`${stop.day}:${idxInDay - 1}->${idxInDay}`] : null;
                    const metaParts: string[] = [];
                    if (stop.time) metaParts.push(stop.time);
                    if (stop.duration_hrs != null) {
                      metaParts.push(
                        stop.duration_hrs >= 1
                          ? `${stop.duration_hrs.toFixed(1)} hr`
                          : `${Math.round(stop.duration_hrs * 60)} min`
                      );
                    }
                    if (stop.cost_egp != null) {
                      metaParts.push(stop.cost_egp === 0 ? 'Free' : `~${Math.round(stop.cost_egp)} EGP`);
                    }
                    return (
                      <TouchableOpacity
                        key={`${stop.id}-list-${index}`}
                        style={[
                          styles.planStopRow,
                          { borderLeftColor: rowDayColor },
                          activeStopKey === stop.key && styles.planStopRowActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!userLocation) return;
                          setActiveStopKey(stop.key);
                          setSelectedStop(stop);
                          const destination: Place = {
                            id: `dest_list_${stop.id}_${index}`,
                            name: stop.title,
                            latitude: stop.latitude!,
                            longitude: stop.longitude!,
                          };
                          const origin: Place = {
                            id: 'user',
                            name: 'Your Location',
                            latitude: userLocation.latitude,
                            longitude: userLocation.longitude,
                          };
                          setNavigationRouteActive(true);
                          setSelectedPlaces([origin, destination]);
                          fetchRoute([origin, destination], routeMode);
                          mapRef.current?.animateToRegion({
                            latitude: stop.latitude!,
                            longitude: stop.longitude!,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02,
                          }, 800);
                        }}
                      >
                        <View style={[styles.planStopBadge, { backgroundColor: rowDayColor }]}>
                          {visitedStops.has(stop.key) ? (
                            <MaterialCommunityIcons name="check" size={12} color="#FFF" />
                          ) : (
                            <Text style={styles.planStopBadgeText}>{stop.globalOrder ?? stop.dayOrder}</Text>
                          )}
                        </View>
                        <View style={styles.planStopText}>
                          <Text style={styles.planStopTitle} numberOfLines={1}>{stop.title}</Text>
                          <Text style={[styles.planStopDayTime, { color: rowDayColor }]}>
                            Day {stop.day}{stop.time ? ` • ${stop.time}` : ''}
                          </Text>
                          {idxInDay > 0 && (
                            <Text style={styles.planStopMeta}>
                              ~{prevPlanLeg?.durationMin ?? '--'} min between plan stops
                            </Text>
                          )}
                          {metaParts.length > 0 && (
                            <Text style={styles.planStopMeta}>{metaParts.join(' · ')}</Text>
                          )}
                        </View>
                        <Text style={styles.planStopArrow}>›</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}
            <View style={styles.routeModeRow}>
              <TouchableOpacity
                style={[styles.routeModeBtn, routeMode === 'fastest' && styles.routeModeBtnActive]}
                onPress={() => switchRouteMode('fastest')}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={16} color={routeMode === 'fastest' ? '#E67E22' : '#999'} />
                <Text style={[styles.routeModeText, routeMode === 'fastest' && styles.routeModeTextActive]}>Fastest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.routeModeBtn, routeMode === 'walk' && styles.routeModeBtnActiveEco]}
                onPress={() => switchRouteMode('walk')}
              >
                <MaterialCommunityIcons name="walk" size={16} color={routeMode === 'walk' ? '#27AE60' : '#999'} />
                <Text style={[styles.routeModeText, routeMode === 'walk' && styles.routeModeTextActiveEco]}>Walk +50pts</Text>
              </TouchableOpacity>
            </View>

            {routeDistance && routeDuration && (
              <View style={styles.routeInfo}>
                <View style={styles.routeInfoItem}>
                  <MaterialCommunityIcons name="road-variant" size={16} color="#555" />
                  <Text style={styles.routeInfoValue}>{routeDistance}</Text>
                </View>
                <View style={styles.routeInfoDivider} />
                <View style={styles.routeInfoItem}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#555" />
                  <Text style={styles.routeInfoValue}>{routeDuration}</Text>
                </View>
                {routeMode === 'walk' && (
                  <>
                    <View style={styles.routeInfoDivider} />
                    <View style={styles.routeInfoItem}>
                      <MaterialCommunityIcons name="star-outline" size={16} color="#E67E22" />
                      <Text style={[styles.routeInfoValue, { color: '#E67E22' }]}>+50 pts</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {selectedPlaces.length > 0 && (
              <View style={styles.selectedPlacesContainer}>
                <View style={styles.selectedPlacesHeader}>
                  <Text style={styles.selectedPlacesTitle}>Your Route ({selectedPlaces.length} stops)</Text>
                  <TouchableOpacity onPress={clearRoute}>
                    <Text style={styles.clearBtn}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedPlaces.map((place, index) => (
                    <View key={`${place.id}-${index}`} style={styles.placeChip}>
                      <Text style={styles.placeChipNumber}>{index + 1}</Text>
                      <Text style={styles.placeChipName} numberOfLines={1}>{place.name}</Text>
                      {place.id !== 'user' && (
                        <TouchableOpacity onPress={() => removePlace(place.id)}>
                          <Text style={styles.placeChipRemove}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

          {selectedPlaces.length === 0 && plannedDays.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Search or tap a pin to build your route{'\n'}
                <Text style={{ color: '#27AE60', fontWeight: '700' }}>Green pins = walkable & earn 50 pts!</Text>
              </Text>
            </View>
          )}

            {selectedPlaces.length >= 2 && routeCoords.length === 0 && !loadingRoute && (
              <TouchableOpacity style={styles.getRouteBtn} onPress={() => fetchRoute(selectedPlaces, routeMode)}>
                <Text style={styles.getRouteBtnText}>Get Route</Text>
              </TouchableOpacity>
            )}

            {loadingRoute && (
              <View style={styles.loadingRoute}>
                <ActivityIndicator size="small" color="#E67E22" />
                <Text style={styles.loadingRouteText}>Calculating route...</Text>
              </View>
            )}
          </ScrollView>
          </Animated.View>
        )
      }

      {!walkBanner.visible && !walkingInProgress && !vehicleDetected && plannedDays.length > 0 && !isCurrentDayComplete && (
        <TouchableOpacity style={[styles.startDayBtn, { bottom: insets.bottom + 10 }]} onPress={handleStartOrNext}>
          <Text style={styles.startDayBtnText}>
            {dayStarted && startDay === (selectedDay ?? plannedDays[0]?.day ?? 1)
              ? '➡️ Next Stop'
              : `▶ Start Day ${selectedDay ?? plannedDays[0]?.day ?? 1}`}
          </Text>
        </TouchableOpacity>
      )}
      {!walkBanner.visible && !walkingInProgress && !vehicleDetected && plannedDays.length > 0 && isCurrentDayComplete && (
        <View style={[styles.dayDoneBadge, { bottom: insets.bottom + 12 }]}>
          <Text style={styles.dayDoneText}>✅ Day completed</Text>
        </View>
      )}

      {walkingInProgress && walkTarget && (
        <View style={[styles.walkingProgressPanel, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.walkingProgressHeader}>
            <MaterialCommunityIcons name="walk" size={36} color="#27AE60" />
            <View style={{ flex: 1 }}>
              <Text style={styles.walkingProgressTitle}>Walking in progress…</Text>
              <Text style={styles.walkingProgressDest} numberOfLines={1}>{walkTarget.name}</Text>
            </View>
          </View>
          <View style={styles.walkingDistRow}>
            <Text style={styles.walkingDistLabel}>Distance remaining</Text>
            <Text style={styles.walkingDistValue}>
              {walkDistanceLeft >= 1000
                ? `${(walkDistanceLeft / 1000).toFixed(2)} km`
                : `${walkDistanceLeft} m`}
            </Text>
          </View>
          <View style={styles.walkingProgressBarTrack}>
            <View style={[styles.walkingProgressBarFill, {
              width: `${Math.max(0, Math.min(100, 100 - (walkDistanceLeft / walkInitialDistRef.current) * 100))}%`,
            }]} />
          </View>
          <View style={{flexDirection:'row', alignItems:'center', gap:6, justifyContent:'center'}}>
            <MaterialCommunityIcons name="trophy" size={13} color="#E67E22" />
            <Text style={styles.walkingProgressHint}>You'll earn 50 pts when you arrive!</Text>
          </View>
          <TouchableOpacity style={styles.cancelWalkBtn} onPress={cancelWalk}>
            <Text style={styles.cancelWalkBtnText}>Cancel Walk</Text>
          </TouchableOpacity>
        </View>
      )}

      {vehicleDetected && (
        <View style={[styles.walkingProgressPanel, { paddingBottom: insets.bottom + 22 }]}>
          <View style={styles.walkingProgressHeader}>
            <MaterialCommunityIcons name="car" size={36} color="#E74C3C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.walkingProgressTitle}>Vehicle Detected!</Text>
              <Text style={styles.walkingProgressDest}>Walk cancelled</Text>
            </View>
          </View>
          <Text style={[styles.walkingProgressHint, { color: '#E74C3C', marginBottom: 20 }]}>
            You're moving too fast! Points are only awarded for actually walking.
          </Text>
          <TouchableOpacity style={styles.cancelWalkBtn} onPress={() => setVehicleDetected(false)}>
            <Text style={styles.cancelWalkBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <WalkableBannerModal
        banner={walkBanner}
        onWalk={handleWalk}
        onDismiss={() => setWalkBanner({ visible: false, place: null, distance_km: 0 })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F0' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  topChromePeek: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  topChromePeekText: { fontSize: 13, fontWeight: '700', color: '#333' },
  topPlanToolsCard: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  topPlanToolsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  topChromeDragZone: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  topChromeHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CCC',
    marginBottom: 4,
  },
  topChromeDragHint: { fontSize: 11, color: '#888', fontWeight: '600' },
  topChromeChevronBtn: { padding: 4 },
  daySelectorBlock: { marginTop: 4, gap: 8 },
  pointsToastWrap: { position: 'absolute', left: 0, right: 0, zIndex: 40, alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  backIcon: { fontSize: 20, fontWeight: '700', color: '#333' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  locationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  locationBtnIcon: { fontSize: 18 },
  locationDisabledBanner: { marginTop: 10, backgroundColor: '#FFF3E0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  locationDisabledText: { fontSize: 12, color: '#8A5A00', fontWeight: '700', textAlign: 'center', lineHeight: 16 },

  searchDropdown: { backgroundColor: '#FFF', borderRadius: 16, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  searchResultIcon: { fontSize: 16, marginRight: 10 },
  searchResultText: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: '600', color: '#333' },
  searchResultAddress: { fontSize: 11, color: '#999', marginTop: 2 },

  legendInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  legendInCard: { marginTop: 8 },
  legendFloating: { alignSelf: 'flex-start', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#555', fontWeight: '600' },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 12,
    overflow: 'hidden',
  },
  planSection: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  sheetStopCard: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  planSectionHeader: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 10, gap: 2 },
  planSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  planSectionSubtitle: { fontSize: 12, color: '#777' },
  planDayTabs: { gap: 8, paddingBottom: 10 },
  planDayChip: { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center', gap: 6 },
  planDayChipActive: { backgroundColor: '#FFF3E0', borderColor: '#E67E22' },
  planDayChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  planDayChipTextActive: { color: '#E67E22' },
  dayChipDot: { width: 8, height: 8, borderRadius: 4 },
  planStopsList: { gap: 8 },
  planEmptyText: { fontSize: 12, color: '#888', lineHeight: 18 },
  planStopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 10, marginBottom: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
  },
  planStopRowActive: { borderWidth: 1, borderColor: '#F1C08F', backgroundColor: '#FFF8F0', shadowColor: '#E67E22', shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  planStopBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center' },
  planStopBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  planStopText: { flex: 1 },
  planStopTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  planStopDayTime: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  planStopMeta: { fontSize: 11, color: '#999', marginTop: 2 },
  planStopArrow: { fontSize: 20, color: '#CCC', fontWeight: '300', paddingHorizontal: 4 },
  routeModeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  routeModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 30, paddingVertical: 10, gap: 6 },
  routeModeBtnActive: { backgroundColor: '#FFF3E0' },
  routeModeBtnActiveEco: { backgroundColor: '#E8F8F0' },
  routeModeIcon: { fontSize: 16 },
  routeModeText: { fontSize: 14, fontWeight: '600', color: '#999' },
  routeModeTextActive: { color: '#E67E22' },
  routeModeTextActiveEco: { color: '#27AE60' },
  routeInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA', borderRadius: 14, paddingVertical: 9, marginBottom: 10, borderWidth: 1, borderColor: '#EAECEF' },
  routeInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  routeInfoIcon: { fontSize: 16 },
  routeInfoValue: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  routeInfoDivider: { width: 1, height: 20, backgroundColor: '#DDD' },
  selectedPlacesContainer: { marginBottom: 12 },
  selectedPlacesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectedPlacesTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  clearBtn: { fontSize: 13, color: '#E74C3C', fontWeight: '600' },
  placeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, gap: 6 },
  placeChipNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E67E22', color: '#FFF', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  placeChipName: { fontSize: 13, fontWeight: '600', color: '#333', maxWidth: 100 },
  placeChipRemove: { fontSize: 12, color: '#E74C3C', fontWeight: '700' },
  emptyState: { paddingVertical: 12, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 22 },
  getRouteBtn: { backgroundColor: '#E67E22', borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  getRouteBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  loadingRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  loadingRouteText: { fontSize: 13, color: '#666' },

  walkBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  walkBannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  walkBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walkBannerEmoji: { fontSize: 36 },
  walkBannerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  walkBannerSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  walkBannerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  walkBannerCloseText: { fontSize: 14, color: '#999', fontWeight: '700' },
  walkStats: { flexDirection: 'row', backgroundColor: '#F9F5F0', borderRadius: 16, padding: 14, marginBottom: 14, justifyContent: 'space-around' },
  walkStat: { alignItems: 'center', gap: 4 },
  walkStatIcon: { fontSize: 20 },
  walkStatValue: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  walkStatLabel: { fontSize: 11, color: '#999' },
  walkStatDivider: { width: 1, backgroundColor: '#EEE' },
  walkTip: { backgroundColor: '#E8F8F0', borderRadius: 14, padding: 12, marginBottom: 16 },
  walkTipText: { fontSize: 13, color: '#2D6A4F', fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  walkActions: { flexDirection: 'row', gap: 10 },
  walkSkipBtn: { flex: 1, borderWidth: 2, borderColor: '#EEE', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  walkSkipText: { fontSize: 14, fontWeight: '700', color: '#999' },
  walkGoBtn: { flex: 2, backgroundColor: '#27AE60', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  walkGoBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  pointsToast: { alignSelf: 'center', backgroundColor: '#1A1A1A', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  pointsToastEmoji: { fontSize: 20 },
  pointsToastText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  pointsToastSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  walkingProgressPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  walkingProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  walkingProgressEmoji: { fontSize: 36 },
  walkingProgressTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  walkingProgressDest: { fontSize: 13, color: '#888', marginTop: 2 },
  walkingDistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  walkingDistLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  walkingDistValue: { fontSize: 18, fontWeight: '900', color: '#27AE60' },
  walkingProgressBarTrack: { height: 8, backgroundColor: '#E8F8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  walkingProgressBarFill: { height: '100%', backgroundColor: '#27AE60', borderRadius: 4 },
  walkingProgressHint: { fontSize: 13, color: '#E67E22', fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  cancelWalkBtn: { borderWidth: 2, borderColor: '#EEE', borderRadius: 30, paddingVertical: 13, alignItems: 'center' },
  cancelWalkBtnText: { fontSize: 14, fontWeight: '700', color: '#E74C3C' },
  walkVerificationBanner: {
    position: 'absolute',
    bottom: 130,
    left: 16,
    right: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F1C08F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  walkVerificationText: {
    flex: 1,
    fontSize: 12,
    color: '#8A5A00',
    fontWeight: '600',
  },
  walkVerificationDismiss: {
    fontSize: 12,
    color: '#E67E22',
    fontWeight: '800',
  },
  flowMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowMarkerActive: {
    transform: [{ scale: 1.15 }],
    borderWidth: 3,
    borderColor: '#111',
  },
  flowMarkerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  nextStopPulse: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    left: -8,
    top: -8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  travelLabel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  travelLabelText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  daySelectorScroll: {
    gap: 8,
    paddingRight: 8,
  },
  daySelectorPill: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelectorText: {
    color: '#1A1A1A',
    fontWeight: '800',
    fontSize: 12,
  },
  daySummaryBar: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  daySummaryText: {
    color: '#1A1A1A',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  stopCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 430,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stopCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  stopCardClose: {
    fontSize: 14,
    color: '#999',
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  stopCardPhoto: {
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  stopCardPhotoImage: {
    width: '100%',
    height: '100%',
  },
  stopCardPhotoText: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
  },
  stopCardMeta: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  stopCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stopModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  stopModeBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    alignItems: 'center',
  },
  stopModeBtnActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#E67E22',
  },
  stopModeBtnActiveWalk: {
    backgroundColor: '#E8F8F0',
    borderColor: '#27AE60',
  },
  stopModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  stopModeTextActive: {
    color: '#E67E22',
  },
  stopModeTextActiveWalk: {
    color: '#27AE60',
  },
  stopActionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEE',
    paddingVertical: 8,
    alignItems: 'center',
  },
  stopActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  markVisitedBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#E8F8F0',
    paddingVertical: 10,
    alignItems: 'center',
  },
  markVisitedText: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetHandle: {
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetHandleBar: {
    width: 52,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#CFCFCF',
  },
  startDayBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#E67E22',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  startDayBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  dayDoneBadge: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    backgroundColor: '#E8F8F0',
    borderWidth: 1,
    borderColor: '#BEE8D1',
    paddingVertical: 12,
    alignItems: 'center',
  },
  dayDoneText: {
    color: '#1E7C4A',
    fontSize: 14,
    fontWeight: '800',
  },
});
