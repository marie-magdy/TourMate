// app/(main)/pick-spots.tsx
import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, ActivityIndicator, SafeAreaView, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useApp } from '../../constants/AppContext';
import { Attraction } from '../../constants/types';
import AttractionSheet from '../../components/AttractionSheet';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api`;

// ── Types ─────────────────────────────────────────────────────────────
interface Spot {
  id: string;   // API returns "ATT001"-style strings — NOT a number
  name: string;
  image_url: string;
  price_from: number;
  rating: number;
  category: string;
  city: string;
  description: string;
}

// ── Category tabs (keys match Excel categories) ───────────────────────
const CATEGORIES = [
  { key: 'all',           label: 'All'           },
  { key: 'historical',    label: 'Historical'    },
  { key: 'restaurant',    label: 'Restaurants'   },
  { key: 'beach',         label: 'Beaches'       },
  { key: 'museum',        label: 'Museums'       },
  { key: 'nature',        label: 'Nature'        },
  { key: 'shopping',      label: 'Shopping'      },
  { key: 'cafe',          label: 'Cafés'         },
  { key: 'entertainment', label: 'Entertainment' },
];

// Maps every Excel category tag → one of the CATEGORIES keys above
const CAT_MAP: Record<string, string> = {
  ancient: 'historical', cultural: 'historical', religious: 'historical',
  landmark: 'historical', historical: 'historical',
  museum: 'museum',
  restaurant: 'restaurant', food: 'restaurant', grills: 'restaurant',
  seafood: 'restaurant', local: 'restaurant', international: 'restaurant',
  beach: 'beach', coastal: 'beach', waterfront: 'beach',
  nature: 'nature', outdoor: 'nature', park: 'nature',
  shopping: 'shopping', mall: 'shopping', modern: 'shopping',
  cafe: 'cafe', dessert: 'cafe', bakery: 'cafe',
  entertainment: 'entertainment', cinema: 'entertainment', theater: 'entertainment',
};

// Fallback background color per display category (used when no real image is available)
const CAT_IMAGE: Record<string, string> = {};

const CAT_COLOR: Record<string, string> = {
  historical:    '#8B7355',
  restaurant:    '#E67E22',
  beach:         '#3498DB',
  museum:        '#9B59B6',
  nature:        '#27AE60',
  shopping:      '#E74C3C',
  cafe:          '#F39C12',
  entertainment: '#1ABC9C',
};

// ── Spot Card ─────────────────────────────────────────────────────────
const SpotCard: React.FC<{
  item: Spot;
  isAdded: boolean;
  isFavorited: boolean;
  onAdd: (item: Spot) => void;
  onFavorite: (item: Spot) => void;
  onPress: (item: Spot) => void;
}> = ({ item, isAdded, isFavorited, onAdd, onFavorite, onPress }) => {
  const { convertPrice } = useApp();
  return (
  <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.9}>
    {item.image_url ? (
      <Image
        source={{ uri: item.image_url }}
        style={styles.cardImage}
      />
    ) : (
      <View style={[styles.cardImage, { backgroundColor: CAT_COLOR[item.category] ?? '#CCCCCC', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{item.category}</Text>
      </View>
    )}

    {/* Favorite button */}
    <TouchableOpacity
      style={styles.favoriteBtn}
      onPress={() => onFavorite(item)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialCommunityIcons name={isFavorited ? "heart" : "heart-outline"} size={16} color={isFavorited ? "#E74C3C" : "#CCC"} />
    </TouchableOpacity>

    {/* Add to plan button */}
    <TouchableOpacity
      style={[styles.addBtn, isAdded && styles.addBtnActive]}
      onPress={() => onAdd(item)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialCommunityIcons name={isAdded ? "check" : "plus"} size={18} color={isAdded ? "#FFF" : "#333"} />
    </TouchableOpacity>

    {/* Card info */}
    <View style={styles.cardInfo}>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardPrice}>from {convertPrice(item.price_from)}</Text>
        <View style={styles.cardRating}>
          <MaterialCommunityIcons name="star" size={12} color="#FFC107" />
          <Text style={styles.cardRatingText}>{item.rating}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
  );
};

// ── PICK SPOTS SCREEN ─────────────────────────────────────────────────
export default function PickSpotsScreen() {
  const router = useRouter();
  const { t, convertPrice } = useApp();
  const params = useLocalSearchParams<{
    city: string;
    startDate: string;
    endDate: string;
    budget: string;
    daySchedules: string;
    interests: string;
    startLat?: string;
    startLon?: string;
    startLabel?: string;
  }>();

  const city = params.city ?? 'Hurghada';
  const interests = params.interests?.split(',') ?? [];

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [addedSpots, setAddedSpots] = useState<string[]>([]);
  const [favoritedSpots, setFavoritedSpots] = useState<string[]>([]);

  const [sheetAttraction, setSheetAttraction] = useState<Attraction | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then(loc => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const openSheet = async (item: Spot) => {
    setSheetLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/attractions/${item.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSheetAttraction(data.data);
        setShowSheet(true);
      }
    } catch {
      // silently ignore — sheet just won't open
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, [city, activeCategory]);

  const normalizeSpots = (items: any[]): Spot[] =>
    items.map((item: any) => {
      const cats: string[] = Array.isArray(item.categories)
        ? item.categories.map((c: string) => String(c).toLowerCase())
        : [];
      let displayCat = 'historical';
      for (const c of cats) {
        if (CAT_MAP[c]) { displayCat = CAT_MAP[c]; break; }
      }
      return {
        id:          item.id,
        name:        item.name,
        image_url:   item.image_url || CAT_IMAGE[displayCat] || '',
        price_from:  item.price_from ?? item.price_avg ?? 0,
        rating:      item.rating ?? item.avg_rating ?? 0,
        category:    displayCat,
        city:        item.city ?? city,
        description: item.description ?? '',
      };
    });

  const fetchSpots = async (): Promise<void> => {
    setLoading(true);
    setFetchError(null);
    try {
      const categoryParam = activeCategory !== 'all' ? `&category=${activeCategory}` : '';

      // Single source of truth: Excel file via the recommendation service.
      // PostgreSQL fallback was intentionally removed — it returns integer IDs (1, 2, 3)
      // which never match the recommender's Excel IDs ("ATT001", "ATT002"), causing
      // favorited spots to silently disappear from generated plans.
      const res  = await fetch(
        `${API_BASE}/recommendations/attractions?city=${encodeURIComponent(city)}${categoryParam}`
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && data.data?.length > 0) {
        // STEP 1 DEBUG — confirm string IDs from Excel, e.g. ["ATT001", "ATT002"]
        console.log('[PICK-SPOTS] Loaded from DB. Sample IDs:', data.data.slice(0, 5).map((x: any) => x.id));
        setSpots(normalizeSpots(data.data));
      } else {
        throw new Error('Empty response from recommendation service');
      }
    } catch (err) {
      console.error('[PICK-SPOTS] Failed to load attractions:', err);
      setFetchError('Could not load attractions. Please check your connection and try again.');
      setSpots([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdd = (item: Spot): void => {
    setAddedSpots(prev =>
      prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
    );
  };

  const toggleFavorite = (item: Spot): void => {
    const newState = favoritedSpots.includes(item.id)
      ? favoritedSpots.filter(id => id !== item.id)
      : [...favoritedSpots, item.id];
    // DEBUG — confirm the exact ID being stored
    console.log('[FAVORITES] toggled:', { id: item.id, name: item.name, isFavorited: !favoritedSpots.includes(item.id) });
    console.log('[FAVORITES] full list after toggle:', newState);
    setFavoritedSpots(newState);
  };

  const goToAttractionDetails = (item: Spot): void => {
    openSheet(item);
  };

  const handleNext = (): void => {
    const navParams = {
      ...params,
      spotIds:      addedSpots.join(','),
      favoritedIds: favoritedSpots.join(','),
    };
    // STEP 1 — confirm exact IDs just before navigation, e.g. ["ATT001", "ATT023"]
    console.log('[PICK-SPOTS] Added IDs   :', addedSpots);
    console.log('[PICK-SPOTS] Favorited IDs:', favoritedSpots);
    router.push({ pathname: '/(main)/itinerary' as any, params: navParams });
  };

  // Maps interest labels (from plan.tsx) → display categories used by CAT_MAP above
  const INTEREST_DISPLAY_MAP: Record<string, string[]> = {
    adventure: ['nature', 'historical'],
    diving:    ['beach'],
    food:      ['restaurant', 'cafe'],
    party:     ['restaurant', 'cafe', 'shopping'],
    history:   ['historical', 'museum'],
    shopping:  ['shopping'],
    nature:    ['nature', 'beach'],
    nightlife: ['restaurant', 'cafe', 'shopping'],
    family:    ['nature', 'museum', 'historical'],
    culture:        ['historical', 'museum'],
    entertainment:  ['entertainment'],
  };

  // Display categories relevant to selected interests (empty = no filter)
  const interestCategorySet = new Set(
    interests.flatMap(i => INTEREST_DISPLAY_MAP[i.toLowerCase()] ?? [])
  );

  // Base pool: apply interest filter when no specific tab is active
  const baseSpots = (activeCategory === 'all' && interestCategorySet.size > 0)
    ? spots.filter(s => interestCategorySet.has(s.category))
    : spots;

  // Group spots by category for the "All" grouped view
  const groupedSpots = CATEGORIES.filter(c => c.key !== 'all').map(cat => ({
    ...cat,
    data: baseSpots.filter(s => s.category === cat.key),
  })).filter(group => group.data.length > 0);

  const displaySpots = activeCategory === 'all'
    ? baseSpots
    : spots.filter(s => s.category === activeCategory);

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.locationPill}>
          <MaterialCommunityIcons name="map-marker" size={13} color="#555" />
          <Text style={styles.locationText}>{city}, Egypt</Text>
        </View>
        {addedSpots.length > 0 && (
          <View style={styles.addedBadge}>
            <Text style={styles.addedBadgeText}>{addedSpots.length}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Title ── */}
        <Text style={styles.title}>{t('plan')}</Text>

        {/* ── Category tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryTab, activeCategory === cat.key && styles.categoryTabActive]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <Text style={[
                styles.categoryTabText,
                activeCategory === cat.key && styles.categoryTabTextActive,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E67E22" />
          </View>
        ) : fetchError ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert" size={40} color="#E67E22" />
            <Text style={styles.errorText}>{fetchError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchSpots} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : spots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No spots found for {city}</Text>
            <Text style={styles.emptySubText}>Try a different category</Text>
          </View>
        ) : activeCategory === 'all' ? (
          // Grouped by category view
          <>
            {groupedSpots.map(group => (
              <View key={group.key}>
                <Text style={styles.sectionTitle}>
                  {group.icon} {group.label}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
                >
                  {group.data.map(item => (
                    <SpotCard
                      key={String(item.id)}
                      item={item}
                      isAdded={addedSpots.includes(item.id)}
                      isFavorited={favoritedSpots.includes(item.id)}
                      onAdd={toggleAdd}
                      onFavorite={toggleFavorite}
                      onPress={goToAttractionDetails}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        ) : (
          // Single category grid view
          <View style={styles.gridContainer}>
            {displaySpots.map(item => (
              <SpotCard
                key={item.id}
                item={item}
                isAdded={addedSpots.includes(item.id)}
                isFavorited={favoritedSpots.includes(item.id)}
                onAdd={toggleAdd}
                onFavorite={toggleFavorite}
                onPress={goToAttractionDetails}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomBarLabel}>{t('favorites')}</Text>
          <Text style={styles.bottomBarCount}>{addedSpots.length} {t('plan')}</Text>
        </View>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Next step →</Text>
        </TouchableOpacity>
      </View>


      <AttractionSheet
        attraction={sheetAttraction}
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        userLocation={userLocation}
        onGetDirections={({ latitude, longitude, name }) => {
          setShowSheet(false);
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

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const CARD_WIDTH = 180;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF3E0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  locationIcon: { fontSize: 12 },
  locationText: { fontSize: 13, fontWeight: '600', color: '#E67E22' },
  addedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center',
  },
  addedBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  container: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },

  // Category tabs
  categoryTabs: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  categoryTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF', borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  categoryTabActive: { backgroundColor: '#FFF3E0', borderColor: '#E67E22' },
  categoryTabIcon: { fontSize: 14 },
  categoryTabText: { fontSize: 13, color: '#666', fontWeight: '500' },
  categoryTabTextActive: { color: '#E67E22', fontWeight: '700' },

  // Section title
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },

  // Card
  card: {
    width: CARD_WIDTH, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#FFF', marginRight: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    marginBottom: 12,
  },
  cardImage: { width: CARD_WIDTH, height: 130 },
  favoriteBtn: {
    position: 'absolute', top: 10, left: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  favoriteIcon: { fontSize: 16, color: '#CCC' },
  favoritedIcon: { color: '#E74C3C' },
  addBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnActive: { backgroundColor: '#E67E22' },
  addIcon: { fontSize: 18, color: '#333', fontWeight: '700' },
  addIconActive: { color: '#FFF' },
  cardInfo: { padding: 10 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 12, color: '#E67E22', fontWeight: '600' },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardRatingStar: { color: '#FFC107', fontSize: 12 },
  cardRatingText: { fontSize: 12, color: '#666', fontWeight: '600' },

  // Grid
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },

  // Loading / empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#333' },
  errorContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  errorIcon: { fontSize: 40, marginBottom: 16 },
  errorText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: { backgroundColor: '#E67E22', borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12 },
  retryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  emptySubText: { fontSize: 13, color: '#999', marginTop: 6 },

  sheetLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center', zIndex: 99,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  bottomBarLeft: { flex: 1 },
  bottomBarLabel: { fontSize: 12, color: '#999' },
  bottomBarCount: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  nextBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  nextBtnDisabled: { backgroundColor: '#DDD' },
  nextBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
