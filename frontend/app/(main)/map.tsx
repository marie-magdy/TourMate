// app/(main)/map.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────
interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  address?: string;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

// ── Map Screen ───────────────────────────────────────────────────────
export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<RoutePoint | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[]>([]);
  const [nearbyAttractions, setNearbyAttractions] = useState<Place[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [routeMode, setRouteMode] = useState<'fastest' | 'eco'>('fastest');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);

  // Sample nearby attractions (replace with your backend API later)
  const sampleAttractions: Place[] = [
    { id: '1', name: 'Citadel of Qaitbay', latitude: 31.2138, longitude: 29.8854, type: 'attraction' },
    { id: '2', name: 'Catacombs of Kom El Shoqafa', latitude: 31.1856, longitude: 29.8947, type: 'attraction' },
    { id: '3', name: 'Roman Amphitheatre', latitude: 31.1990, longitude: 29.9060, type: 'attraction' },
    { id: '4', name: 'Montaza Palace', latitude: 31.2876, longitude: 30.0118, type: 'attraction' },
    { id: '5', name: 'Library of Alexandria', latitude: 31.2089, longitude: 29.9092, type: 'attraction' },
  ];

  // ── Get user location ─────────────────────────────────────────────
  useEffect(() => {
    getUserLocation();
    setNearbyAttractions(sampleAttractions);
  }, []);

  const getUserLocation = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please allow location access to use the map features.',
          [{ text: 'OK' }]
        );
        // Default to Alexandria if permission denied
        setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);

      // Animate map to user location
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);

    } catch (err) {
      console.error('Location error:', err);
      setUserLocation({ latitude: 31.2001, longitude: 29.9187 });
    } finally {
      setLoadingLocation(false);
    }
  };

  // ── Search places using Nominatim (OpenStreetMap) ─────────────────
  const searchPlaces = async (query: string): Promise<void> => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=eg`,
        {
          headers: {
            'User-Agent': 'TourMateApp/1.0',
          },
        }
      );
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  // ── Select a place from search results ───────────────────────────
  const selectPlace = (result: SearchResult): void => {
    const place: Place = {
      id: result.place_id,
      name: result.display_name.split(',')[0],
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    };

    // Add to selected places (max 5)
    if (selectedPlaces.length >= 5) {
      Alert.alert('Maximum places', 'You can add up to 5 places to your route.');
      return;
    }

    // Check if already added
    if (selectedPlaces.find(p => p.id === place.id)) {
      Alert.alert('Already added', 'This place is already in your route.');
      return;
    }

    const newPlaces = [...selectedPlaces, place];
    setSelectedPlaces(newPlaces);
    setSearchQuery('');
    setShowSearchResults(false);

    // Animate to selected place
    mapRef.current?.animateToRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 800);

    // Auto fetch route if 2+ places selected
    if (newPlaces.length >= 2) {
      fetchRoute(newPlaces, routeMode);
    }
  };

  // ── Add attraction pin to route ───────────────────────────────────
  const addAttractionToRoute = (attraction: Place): void => {
    if (selectedPlaces.find(p => p.id === attraction.id)) {
      Alert.alert('Already added', 'This attraction is already in your route.');
      return;
    }
    if (selectedPlaces.length >= 5) {
      Alert.alert('Maximum places', 'You can add up to 5 places to your route.');
      return;
    }
    const newPlaces = [...selectedPlaces, attraction];
    setSelectedPlaces(newPlaces);
    if (newPlaces.length >= 2) {
      fetchRoute(newPlaces, routeMode);
    }
  };

  // ── Fetch route using OSRM (free, no API key needed) ─────────────
  const fetchRoute = async (places: Place[], mode: 'fastest' | 'eco'): Promise<void> => {
    if (places.length < 2) return;

    setLoadingRoute(true);
    setRouteCoords([]);

    try {
      // Build coordinates string for OSRM
      const coords = places
        .map(p => `${p.longitude},${p.latitude}`)
        .join(';');

      // OSRM routing — free, no API key needed
      // fastest = driving, eco = uses less fuel (also driving but optimized)
      const profile = 'driving';
      const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];

        // Extract polyline coordinates
        const coords: RoutePoint[] = route.geometry.coordinates.map(
          (coord: number[]) => ({
            latitude: coord[1],
            longitude: coord[0],
          })
        );

        setRouteCoords(coords);

        // Set distance and duration
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        setRouteDistance(`${distanceKm} km`);
        setRouteDuration(`${durationMin} min`);

        // Fit map to show full route
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
          animated: true,
        });
      }
    } catch (err) {
      console.error('Route error:', err);
      Alert.alert('Route Error', 'Could not fetch route. Please check your internet connection.');
    } finally {
      setLoadingRoute(false);
    }
  };

  // ── Switch route mode ─────────────────────────────────────────────
  const switchRouteMode = (mode: 'fastest' | 'eco'): void => {
    setRouteMode(mode);
    if (selectedPlaces.length >= 2) {
      fetchRoute(selectedPlaces, mode);
    }
  };

  // ── Remove a place from route ─────────────────────────────────────
  const removePlace = (placeId: string): void => {
    const newPlaces = selectedPlaces.filter(p => p.id !== placeId);
    setSelectedPlaces(newPlaces);
    if (newPlaces.length >= 2) {
      fetchRoute(newPlaces, routeMode);
    } else {
      setRouteCoords([]);
      setRouteDistance(null);
      setRouteDuration(null);
    }
  };

  // ── Clear everything ──────────────────────────────────────────────
  const clearRoute = (): void => {
    setSelectedPlaces([]);
    setRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  if (loadingLocation) {
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
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
      >
        {/* User location marker */}
        {userLocation && (
          <Marker coordinate={userLocation} title="You are here" pinColor="#E67E22" />
        )}

        {/* Nearby attraction markers */}
        {nearbyAttractions.map(attraction => (
          <Marker
            key={attraction.id}
            coordinate={{ latitude: attraction.latitude, longitude: attraction.longitude }}
            title={attraction.name}
            pinColor="#3498DB"
            onCalloutPress={() => addAttractionToRoute(attraction)}
          >
          </Marker>
        ))}

        {/* Selected place markers */}
        {selectedPlaces.map((place, index) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={`${index + 1}. ${place.name}`}
            pinColor="#E67E22"
          />
        ))}

        {/* Route polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeMode === 'eco' ? '#27AE60' : '#E67E22'}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* ── Top Search Bar ── */}
      <SafeAreaView style={styles.topOverlay}>
        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search places in Egypt..."
              placeholderTextColor="#AAA"
              value={searchQuery}
              onChangeText={searchPlaces}
            />
            {loadingSearch && <ActivityIndicator size="small" color="#E67E22" />}
          </View>
          <TouchableOpacity style={styles.locationBtn} onPress={getUserLocation}>
            <Text style={styles.locationBtnIcon}>📍</Text>
          </TouchableOpacity>
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.map(result => (
              <TouchableOpacity
                key={result.place_id}
                style={styles.searchResultItem}
                onPress={() => selectPlace(result)}
              >
                <Text style={styles.searchResultIcon}>📍</Text>
                <View style={styles.searchResultText}>
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {result.display_name.split(',')[0]}
                  </Text>
                  <Text style={styles.searchResultAddress} numberOfLines={1}>
                    {result.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* ── Bottom Panel ── */}
      <View style={styles.bottomPanel}>

        {/* Route mode toggle */}
        <View style={styles.routeModeRow}>
          <TouchableOpacity
            style={[styles.routeModeBtn, routeMode === 'fastest' && styles.routeModeBtnActive]}
            onPress={() => switchRouteMode('fastest')}
          >
            <Text style={styles.routeModeIcon}>⚡</Text>
            <Text style={[styles.routeModeText, routeMode === 'fastest' && styles.routeModeTextActive]}>
              Fastest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.routeModeBtn, routeMode === 'eco' && styles.routeModeBtnActiveEco]}
            onPress={() => switchRouteMode('eco')}
          >
            <Text style={styles.routeModeIcon}>🌿</Text>
            <Text style={[styles.routeModeText, routeMode === 'eco' && styles.routeModeTextActiveEco]}>
              Eco
            </Text>
          </TouchableOpacity>
        </View>

        {/* Route info */}
        {routeDistance && routeDuration && (
          <View style={styles.routeInfo}>
            <View style={styles.routeInfoItem}>
              <Text style={styles.routeInfoIcon}>🛣️</Text>
              <Text style={styles.routeInfoValue}>{routeDistance}</Text>
            </View>
            <View style={styles.routeInfoDivider} />
            <View style={styles.routeInfoItem}>
              <Text style={styles.routeInfoIcon}>⏱️</Text>
              <Text style={styles.routeInfoValue}>{routeDuration}</Text>
            </View>
            {loadingRoute && <ActivityIndicator size="small" color="#E67E22" style={{ marginLeft: 10 }} />}
          </View>
        )}

        {/* Selected places list */}
        {selectedPlaces.length > 0 && (
          <View style={styles.selectedPlacesContainer}>
            <View style={styles.selectedPlacesHeader}>
              <Text style={styles.selectedPlacesTitle}>
                Your Route ({selectedPlaces.length} stops)
              </Text>
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

        {/* Empty state */}
        {selectedPlaces.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              🗺️ Search for places or tap a blue pin to build your route
            </Text>
          </View>
        )}

        {/* Get route button */}
        {selectedPlaces.length >= 2 && routeCoords.length === 0 && !loadingRoute && (
          <TouchableOpacity
            style={styles.getRouteBtn}
            onPress={() => fetchRoute(selectedPlaces, routeMode)}
          >
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
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F0' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  backIcon: { fontSize: 20, fontWeight: '700', color: '#333' },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  locationBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  locationBtnIcon: { fontSize: 18 },

  // Search dropdown
  searchDropdown: {
    backgroundColor: '#FFF', borderRadius: 16, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  searchResultIcon: { fontSize: 16, marginRight: 10 },
  searchResultText: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: '600', color: '#333' },
  searchResultAddress: { fontSize: 11, color: '#999', marginTop: 2 },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },

  // Route mode
  routeModeRow: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
  },
  routeModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 30,
    paddingVertical: 10, gap: 6,
  },
  routeModeBtnActive: { backgroundColor: '#FFF3E0' },
  routeModeBtnActiveEco: { backgroundColor: '#E8F8F0' },
  routeModeIcon: { fontSize: 16 },
  routeModeText: { fontSize: 14, fontWeight: '600', color: '#999' },
  routeModeTextActive: { color: '#E67E22' },
  routeModeTextActiveEco: { color: '#27AE60' },

  // Route info
  routeInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9F5F0', borderRadius: 16,
    paddingVertical: 10, marginBottom: 12,
  },
  routeInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  routeInfoIcon: { fontSize: 16 },
  routeInfoValue: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  routeInfoDivider: { width: 1, height: 20, backgroundColor: '#DDD' },

  // Selected places
  selectedPlacesContainer: { marginBottom: 12 },
  selectedPlacesHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  selectedPlacesTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  clearBtn: { fontSize: 13, color: '#E74C3C', fontWeight: '600' },
  placeChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF3E0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    marginRight: 8, gap: 6,
  },
  placeChipNumber: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E67E22', color: '#FFF',
    fontSize: 11, fontWeight: '700',
    textAlign: 'center', lineHeight: 20,
  },
  placeChipName: { fontSize: 13, fontWeight: '600', color: '#333', maxWidth: 100 },
  placeChipRemove: { fontSize: 12, color: '#E74C3C', fontWeight: '700' },

  // Empty state
  emptyState: {
    paddingVertical: 12, alignItems: 'center',
  },
  emptyStateText: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },

  // Get route button
  getRouteBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  getRouteBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Loading route
  loadingRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  loadingRouteText: { fontSize: 13, color: '#666' },
});
