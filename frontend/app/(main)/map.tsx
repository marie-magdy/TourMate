// app/(main)/map.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, SafeAreaView, Alert,
  Dimensions, ScrollView, Animated, Modal,
  Keyboard,
} from 'react-native';
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

// ── Types ─────────────────────────────────────────────────────────────
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

// ── Distance calculator (Haversine formula) ───────────────────────────
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Walking tips ──────────────────────────────────────────────────────
const WALKING_TIPS = [
  'Walking reduces stress and boosts mood instantly!',
  'A 15-min walk burns around 80 calories!',
  'Walking instead of driving reduces CO₂ emissions!',
  'Regular walking lowers the risk of heart disease by 30%!',
  'Walking improves memory and creative thinking!',
  'You\'ll see more of Egypt\'s beauty on foot!',
];

// ── Walkable Banner Modal ─────────────────────────────────────────────
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
      {/* Header */}
      <View style={styles.walkBannerHeader}>
        <View style={styles.walkBannerLeft}>
          <MaterialCommunityIcons name="walk" size={28} color="#27AE60" />
          <View>
            <Text style={styles.walkBannerTitle}>You can walk here!</Text>
            <Text style={styles.walkBannerSubtitle}>{banner.place.name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.walkBannerClose}>
          <Text style={styles.walkBannerCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Distance & time */}
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

      {/* Health tip */}
      <View style={styles.walkTip}>
        <Text style={styles.walkTipText}>{tip}</Text>
      </View>

      {/* Actions */}
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

// ── Points Toast ──────────────────────────────────────────────────────
  const PointsToast: React.FC<{ visible: boolean; points: number }> = ({ visible, points }) => {
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.7)).current;
    const [rendered, setRendered] = useState(false);

    useEffect(() => {
      if (visible) {
        setRendered(true);
        // Reset
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.7);

        Animated.sequence([
          // Pop in
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true
            }),
            Animated.timing(fadeAnim, {
              toValue: 1, duration: 250, useNativeDriver: true
            }),
          ]),
          Animated.delay(2500),
          // Fade out
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

// ── MAP SCREEN ────────────────────────────────────────────────────────
export default function MapScreen() {
  const params = useLocalSearchParams<{ itineraryData?: string; city?: string }>();
  const [itinerary, setItinerary]           = useState<any[]>([]);
  const [showItinerary, setShowItinerary]   = useState(false);
  const [selectedDay, setSelectedDay]       = useState<number | null>(null);
  const [plannedDays, setPlannedDays]       = useState<PlannedDay[]>([]);
  // const [userId, setUserId]                 = useState<number>(1); // Default to 1, will fetch from storage
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

  // Walkable banner state
  const [walkBanner, setWalkBanner] = useState<WalkableBanner>({ visible: false, place: null, distance_km: 0 });
  const [showPointsToast, setShowPointsToast] = useState(false);
  const [earnedPoints, setEarnedPoints]     = useState(0);
  const [walkedPlaces, setWalkedPlaces]     = useState<Set<string>>(new Set());
  const [walkingInProgress, setWalkingInProgress] = useState(false);
  const [walkTarget, setWalkTarget] = useState<Place | null>(null);
  const [walkDistanceLeft, setWalkDistanceLeft] = useState<number>(0);
  const [vehicleDetected, setVehicleDetected] = useState(false);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const walkInitialDistRef = useRef<number>(1);

  const DAY_COLORS = ['#E67E22', '#3498DB', '#27AE60', '#9B59B6', '#E74C3C', '#F39C12', '#1ABC9C'];
  const mapStops = plannedDays
    .filter(day => selectedDay === null || day.day === selectedDay)
    .flatMap(day =>
      day.activities
        .filter(activity => typeof activity.latitude === 'number' && typeof activity.longitude === 'number')
        .map(activity => ({
          ...activity,
          day: day.day,
          date: day.date,
        }))
    );

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
  // Add to your main useEffect
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
    const routePlaces: Place[] = mapStops.map((stop, index) => ({
      id: `${stop.id}-${index}`,
      name: stop.title,
      latitude: stop.latitude!,
      longitude: stop.longitude!,
    }));

    setSelectedPlaces(routePlaces);

    if (routePlaces.length >= 2) {
      fetchRoute(routePlaces, routeMode);
    } else {
      setRouteCoords([]);
      setRouteDistance(null);
      setRouteDuration(null);
    }
  }, [selectedDay, plannedDays, routeMode]);

  // ── Check walkable attractions when user location updates ─────────
  useEffect(() => {
    if (userLocation && nearbyAttractions.length > 0) {
      // Wait 3 seconds before showing walkable banner
      // so user has time to see the map first
      const timer = setTimeout(() => {
        checkWalkableAttractions();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [nearbyAttractions]); // ← only trigger when attractions load, NOT on every location update
  useEffect(() => () => { locationWatcherRef.current?.remove(); }, []);

  const checkWalkableAttractions = () => {
    if (!userLocation || bannerShownOnce) return; // ← don't show again
    for (const attraction of nearbyAttractions) {
      const dist = getDistanceKm(
        userLocation.latitude, userLocation.longitude,
        attraction.latitude, attraction.longitude
      );
      if (dist <= WALKABLE_DISTANCE_KM && !walkedPlaces.has(attraction.id)) {
        setWalkBanner({ visible: true, place: attraction, distance_km: dist });
        setBannerShownOnce(true); // ← mark as shown
        break;
      }
    }
  };

  // ── Get user location ─────────────────────────────────────────────
  const getUserLocation = async (): Promise<void> => {
  try {
    // Step 1: Show last known position instantly (no spinner needed)
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      const coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
      setUserLocation(coords);
      setLoadingLocation(false); // hide spinner immediately
      fetchAttractions(coords.latitude, coords.longitude);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);
    } else {
      // No cached position — fall back to Alexandria while we wait
      setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
      setLoadingLocation(false);
      fetchAttractions(31.2001, 29.9187);
    }

    // Step 2: Get accurate position in background (user already sees the map)
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced // was High — much faster
    });
    const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    setUserLocation(coords);
    mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);

    // Only re-fetch attractions if user is far from the cached position
    if (lastKnown) {
      const dist = getDistanceKm(
        lastKnown.coords.latitude, lastKnown.coords.longitude,
        coords.latitude, coords.longitude
      );
      if (dist > 0.5) fetchAttractions(coords.latitude, coords.longitude); // re-fetch only if moved >500m
    }

  } catch (err) {
    // Full fallback if everything fails
    setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
    fetchAttractions(31.2001, 29.9187);
    setLoadingLocation(false);
  }
};


  // ── Fetch real attractions from backend ───────────────────────────
  const fetchAttractions = async (lat: number, lon: number) => {
    try {
      // Reverse geocode to get city name
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

  // ── Handle walk choice ────────────────────────────────────────────
  // const handleWalk = async () => {
  //   if (!walkBanner.place) return;

  //   const place = walkBanner.place;
  //   setWalkBanner({ visible: false, place: null, distance_km: 0 });
  //   setWalkedPlaces(prev => new Set([...prev, place.id]));

  //   // Add walking route on map
  //   if (userLocation) {
  //     const walkPlace: Place = { ...place, id: `walk_${place.id}` };
  //     const newPlaces = [
  //       { id: 'user', name: 'Your Location', latitude: userLocation.latitude, longitude: userLocation.longitude },
  //       walkPlace,
  //     ];
  //     setSelectedPlaces(newPlaces);
  //     setRouteMode('walk');
  //     fetchRoute(newPlaces, 'walk');
  //   }

  //   // Award points
  //   try {
  //     const res  = await fetch(`${API_BASE}/points/earn`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         user_id:     userId,
  //         points:      50,
  //         action:      'walk',
  //         description: `Walked to ${place.name}`,
  //       }),
  //     });
  //     const data = await res.json();
  //     if (data.success) {
  //       setEarnedPoints(50);
  //       setShowPointsToast(true);
  //       setTimeout(() => setShowPointsToast(false), 3500);
  //     }
  //   } catch (err) {
  //     console.error('Points error:', err);
  //   }
  // };
  const handleWalk = async () => {
  if (!walkBanner.place) return;

  const place = walkBanner.place;
  setWalkBanner({ visible: false, place: null, distance_km: 0 });
  setWalkedPlaces(prev => new Set([...prev, place.id]));

    // Draw walking route on map
    if (userLocation) {
      const walkPlace: Place = { ...place, id: `walk_${place.id}` };
      const newPlaces = [
        { id: 'user', name: 'Your Location', latitude: userLocation.latitude, longitude: userLocation.longitude },
        walkPlace,
      ];
      setSelectedPlaces(newPlaces);
      setRouteMode('walk');
      fetchRoute(newPlaces, 'walk');
    }

    // ── Start GPS tracking to verify the walk ────────────────────────
    // Points are awarded ONLY when the user arrives within ARRIVAL_RADIUS_M.
    const initialDistM = Math.max(1, Math.round(walkBanner.distance_km * 1000));
    walkInitialDistRef.current = initialDistM;
    setWalkTarget(place);
    setWalkDistanceLeft(initialDistM);
    setVehicleDetected(false); // reset any previous detection
    setWalkingInProgress(true);

    stopLocationWatcher(); // clear any previous watcher

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // update every 10 m of movement
          timeInterval: 5000,
        },
        (loc) => {
          // ── Vehicle detection ─────────────────────────────────────
          const speed = loc.coords.speed ?? 0; // m/s (null on some devices → treat as 0)
          if (speed > MAX_WALK_SPEED_MS) {
            // User is clearly in a vehicle — cancel walk, no points
            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            setVehicleDetected(true);
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
            // User has arrived on foot — award points
            subscription.remove();
            locationWatcherRef.current = null;
            setWalkingInProgress(false);
            setWalkTarget(null);
            setWalkDistanceLeft(0);
            awardWalkPoints(place);
          }
        },
      );
      locationWatcherRef.current = subscription;
    } catch (err) {
      console.error('Location watcher error:', err);
      // If we cannot start the watcher, fall back to immediate award
      setWalkingInProgress(false);
      setWalkTarget(null);
      awardWalkPoints(place);
    }
  };

  // ── Search places ─────────────────────────────────────────────────
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

      // Check if any result is walkable
      if (userLocation && data.length > 0) {
        const first = data[0];
        const dist = getDistanceKm(
          userLocation.latitude, userLocation.longitude,
          parseFloat(first.lat), parseFloat(first.lon)
        );
        if (dist <= WALKABLE_DISTANCE_KM) {
          const place: Place = {
            id: first.place_id,
            name: first.display_name.split(',')[0],
            latitude: parseFloat(first.lat),
            longitude: parseFloat(first.lon),
            distance_km: dist,
          };
          setTimeout(() => setWalkBanner({ visible: true, place, distance_km: dist }), 500);
        }
      }
    } catch (err) { console.error('Search error:', err); }
    finally { setLoadingSearch(false); }
  };

  const selectPlace = (result: SearchResult): void => {
    const place: Place = {
      id: result.place_id,
      name: result.display_name.split(',')[0],
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    };

    if (selectedPlaces.length >= 5) { Alert.alert('Maximum places', 'You can add up to 5 places.'); return; }
    if (selectedPlaces.find(p => p.id === place.id)) { Alert.alert('Already added', 'This place is already in your route.'); return; }

    const newPlaces = [...selectedPlaces, place];
    setSelectedPlaces(newPlaces);
    setSearchQuery('');
    setShowSearchResults(false);
    mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
    if (newPlaces.length >= 2) fetchRoute(newPlaces, routeMode);
  };

  const addAttractionToRoute = (attraction: Place): void => {
    if (selectedPlaces.find(p => p.id === attraction.id)) return;
    if (selectedPlaces.length >= 5) { Alert.alert('Maximum places', 'You can add up to 5 places.'); return; }
    const newPlaces = [...selectedPlaces, attraction];
    setSelectedPlaces(newPlaces);
    if (newPlaces.length >= 2) fetchRoute(newPlaces, routeMode);

    // Check if walkable
    if (userLocation && attraction.distance_km && attraction.distance_km <= WALKABLE_DISTANCE_KM) {
      setWalkBanner({ visible: true, place: attraction, distance_km: attraction.distance_km });
    }
  };

  // ── Fetch route ───────────────────────────────────────────────────
  const fetchRoute = async (places: Place[], mode: 'fastest' | 'walk'): Promise<void> => {
    if (places.length < 2) return;
    setLoadingRoute(true);
    setRouteCoords([]);
    try {
      const coords = places.map(p => `${p.longitude},${p.latitude}`).join(';');
      // IMPORTANT:
      // `router.project-osrm.org` is a demo server and does not reliably support non-car profiles.
      // Use FOSSGIS public instances which serve separate backends for car/foot:
      // - car:  https://routing.openstreetmap.de/routed-car/route/v1/driving/...
      // - foot: https://routing.openstreetmap.de/routed-foot/route/v1/foot/...
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
        mapRef.current?.fitToCoordinates(routePoints, { edgePadding: { top: 100, right: 50, bottom: 260, left: 50 }, animated: true });
      } else {
        const message = data?.message ? `\n${data.message}` : '';
        Alert.alert('Route Error', `Could not fetch ${mode === 'walk' ? 'walking' : 'driving'} route.${message}`);
      }
    } catch (err) { Alert.alert('Route Error', 'Could not fetch route.'); }
    finally { setLoadingRoute(false); }
  };

  const switchRouteMode = (mode: 'fastest' | 'walk') => {
    setRouteMode(mode);
    if (selectedPlaces.length >= 2) fetchRoute(selectedPlaces, mode);
  };

  const removePlace = (placeId: string) => {
    const newPlaces = selectedPlaces.filter(p => p.id !== placeId);
    setSelectedPlaces(newPlaces);
    if (newPlaces.length >= 2) fetchRoute(newPlaces, routeMode);
    else { setRouteCoords([]); setRouteDistance(null); setRouteDuration(null); }
  };

  const clearRoute = () => { setSelectedPlaces([]); setRouteCoords([]); setRouteDistance(null); setRouteDuration(null); };

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
      {/* ── Map ── */}
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
              pinColor={
                isSelected  ? '#E67E22' :   // orange = selected
                isWalkable  ? '#27AE60' :   // green  = walkable
                              '#3498DB'     // blue   = normal
              }
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
          const dayColor = DAY_COLORS[((stop.day ?? 1) - 1) % DAY_COLORS.length];
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
              key={`planned_${stop.id}_${index}`}
              coordinate={{ latitude: stop.latitude!, longitude: stop.longitude! }}
              title={`${index + 1}. ${stop.title}`}
              description={descParts.join(' · ')}
              pinColor={dayColor}
              onCalloutPress={() => {
                if (!userLocation) return;
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
                fetchRoute([origin, destination], routeMode);
                mapRef.current?.animateToRegion({
                  latitude: stop.latitude!,
                  longitude: stop.longitude!,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 800);
              }}
            />
          );
        })}
        {/* ── Itinerary Day Markers ── */}
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

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeMode === 'walk' ? '#27AE60' : '#E67E22'}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* ── Points Toast ── */}
      <PointsToast visible={showPointsToast} points={earnedPoints} />

      {/* ── Top Search Bar ── */}
      <SafeAreaView style={styles.topOverlay}>
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
                onBlur={Keyboard.dismiss}     // ✅ dismiss when user taps away
                returnKeyType="search"        // ✅ shows search button on keyboard
                onSubmitEditing={Keyboard.dismiss} // ✅ dismiss when user presses search
            />
            {loadingSearch && <ActivityIndicator size="small" color="#E67E22" />}
          </View>
          <TouchableOpacity style={styles.locationBtn} onPress={getUserLocation}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#E67E22" />
          </TouchableOpacity>
        </View>

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

      {/* ── Walkable Banner ── */}
      {!walkBanner.visible && (
        <View style={styles.legendRow}>
          {plannedDays.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#E67E22' }]} />
              <Text style={styles.legendText}>Plan stop</Text>
            </View>
          )}
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

      {/* ── Walking In Progress Panel ─────────────────────────────── */}
      {walkingInProgress && walkTarget && (
        <View style={styles.walkingProgressPanel}>
          <View style={styles.walkingProgressHeader}>
            <Text style={styles.walkingProgressEmoji}>🚶</Text>
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
            <View
              style={[
                styles.walkingProgressBarFill,
                {
                  width: `${Math.max(0, Math.min(100, 100 - (walkDistanceLeft / walkInitialDistRef.current) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.walkingProgressHint}>🏆 You'll earn 50 pts when you arrive!</Text>
          <TouchableOpacity style={styles.cancelWalkBtn} onPress={cancelWalk}>
            <Text style={styles.cancelWalkBtnText}>Cancel Walk</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Vehicle Detected Panel ── */}
      {vehicleDetected && (
        <View style={styles.walkingProgressPanel}>
          <View style={styles.walkingProgressHeader}>
            <Text style={styles.walkingProgressEmoji}>🚗</Text>
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
      )
      }

      {/* ── Bottom Panel ── */}
      {
        !walkBanner.visible && !walkingInProgress && !vehicleDetected && (
          <View style={styles.bottomPanel}>
          {plannedDays.length > 0 && (
            <View style={styles.planSection}>
              <View style={styles.planSectionHeader}>
                <Text style={styles.planSectionTitle}>Your Plan on Map</Text>
                <Text style={styles.planSectionSubtitle}>{params.city ?? 'Trip plan'}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planDayTabs}>
                {plannedDays.map(day => (
                  <TouchableOpacity
                    key={day.day}
                    style={[styles.planDayChip, selectedDay === day.day && styles.planDayChipActive]}
                    onPress={() => setSelectedDay(day.day)}
                  >
                    <Text style={[styles.planDayChipText, selectedDay === day.day && styles.planDayChipTextActive]}>
                      Day {day.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={styles.planStopsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {mapStops.length === 0 ? (
                  <Text style={styles.planEmptyText}>This plan has no map coordinates yet for the selected day.</Text>
                ) : (
                  mapStops.map((stop, index) => {
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
                        style={styles.planStopRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!userLocation) return;
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
                        <View style={styles.planStopBadge}>
                          <Text style={styles.planStopBadgeText}>{index + 1}</Text>
                        </View>
                        <View style={styles.planStopText}>
                          <Text style={styles.planStopTitle} numberOfLines={1}>{stop.title}</Text>
                          {metaParts.length > 0 && (
                            <Text style={styles.planStopMeta}>{metaParts.join(' · ')}</Text>
                          )}
                        </View>
                        <Text style={styles.planStopArrow}>›</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
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
                    <View key={place.id} style={styles.placeChip}>
                      <Text style={styles.placeChipNumber}>{index + 1}</Text>
                      <Text style={styles.placeChipName} numberOfLines={1}>{place.name}</Text>
                      <TouchableOpacity onPress={() => removePlace(place.id)}>
                        <Text style={styles.placeChipRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

          {selectedPlaces.length === 0 && (
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
          </View>
        )
      }

      {/* ── Walking In Progress Panel ── */}
      {walkingInProgress && walkTarget && (
        <View style={styles.walkingProgressPanel}>
          <View style={styles.walkingProgressHeader}>
            <Text style={styles.walkingProgressEmoji}>🚶</Text>
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
          <Text style={styles.walkingProgressHint}>🏆 You'll earn 50 pts when you arrive!</Text>
          <TouchableOpacity style={styles.cancelWalkBtn} onPress={cancelWalk}>
            <Text style={styles.cancelWalkBtnText}>Cancel Walk</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Vehicle Detected Panel ── */}
      {vehicleDetected && (
        <View style={styles.walkingProgressPanel}>
          <View style={styles.walkingProgressHeader}>
            <Text style={styles.walkingProgressEmoji}>🚗</Text>
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

      {/* ── Walkable Banner ── */}
      <WalkableBannerModal
        banner={walkBanner}
        onWalk={handleWalk}
        onDismiss={() => setWalkBanner({ visible: false, place: null, distance_km: 0 })}
      />
    </View >
  );
}

// ── STYLES ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F0' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
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

  // Legend
  legendRow: { position: 'absolute', top: 100, right: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 10, gap: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#555', fontWeight: '600' },

  // Bottom panel
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 10 },
  planSection: { marginBottom: 14, backgroundColor: '#F9F5F0', borderRadius: 18, padding: 14 },
  planSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  planSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  planSectionSubtitle: { fontSize: 12, color: '#888' },
  planDayTabs: { gap: 8, paddingBottom: 10 },
  planDayChip: { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#EEE' },
  planDayChipActive: { backgroundColor: '#FFF3E0', borderColor: '#E67E22' },
  planDayChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  planDayChipTextActive: { color: '#E67E22' },
  planStopsList: { maxHeight: 180, gap: 8 },
  planEmptyText: { fontSize: 12, color: '#888', lineHeight: 18 },
  planStopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 10, marginBottom: 6,
  },
  planStopBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center' },
  planStopBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  planStopText: { flex: 1 },
  planStopTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  planStopMeta: { fontSize: 11, color: '#999', marginTop: 2 },
  planStopArrow: { fontSize: 20, color: '#CCC', fontWeight: '300', paddingHorizontal: 4 },
  routeModeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  routeModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 30, paddingVertical: 10, gap: 6 },
  routeModeBtnActive: { backgroundColor: '#FFF3E0' },
  routeModeBtnActiveEco: { backgroundColor: '#E8F8F0' },
  routeModeIcon: { fontSize: 16 },
  routeModeText: { fontSize: 14, fontWeight: '600', color: '#999' },
  routeModeTextActive: { color: '#E67E22' },
  routeModeTextActiveEco: { color: '#27AE60' },
  routeInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F5F0', borderRadius: 16, paddingVertical: 10, marginBottom: 12 },
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

  // Walkable banner
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

  // Points toast
  pointsToast: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: '#1A1A1A', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  pointsToastEmoji: { fontSize: 20 },
  pointsToastText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  pointsToastSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  walkingProgressPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
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
});
