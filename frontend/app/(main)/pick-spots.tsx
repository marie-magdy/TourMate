// app/(main)/pick-spots.tsx
import React, { useState, useEffect }  from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, ActivityIndicator, SafeAreaView, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

// ── Types ─────────────────────────────────────────────────────────────
interface Spot {
  id: number;
  name: string;
  image_url: string;
  price_from: number;
  rating: number;
  category: string;
  city: string;
  description: string;
}

// ── Category tabs ─────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🌟' },
  { key: 'restaurants', label: 'Restaurants', icon: '🍽️' },
  { key: 'beaches', label: 'Beaches', icon: '🏖️' },
  { key: 'night_adventures', label: 'Night Adventures', icon: '🌙' },
  { key: 'hotels', label: 'Hotels', icon: '🏨' },
  { key: 'historical', label: 'Historical', icon: '🏛️' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
];

// ── Spot Card ─────────────────────────────────────────────────────────
const SpotCard: React.FC<{
  item: Spot;
  isAdded: boolean;
  isFavorited: boolean;
  onAdd: (item: Spot) => void;
  onFavorite: (item: Spot) => void;
  onPress: (item: Spot) => void;
}> = ({ item, isAdded, isFavorited, onAdd, onFavorite, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.9}>
    <Image source={{ uri: item.image_url }} style={styles.cardImage} />

    {/* Favorite button */}
    <TouchableOpacity
      style={styles.favoriteBtn}
      onPress={() => onFavorite(item)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[styles.favoriteIcon, isFavorited && styles.favoritedIcon]}>
        {isFavorited ? '♥' : '♡'}
      </Text>
    </TouchableOpacity>

    {/* Add to plan button */}
    <TouchableOpacity
      style={[styles.addBtn, isAdded && styles.addBtnActive]}
      onPress={() => onAdd(item)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[styles.addIcon, isAdded && styles.addIconActive]}>
        {isAdded ? '✓' : '+'}
      </Text>
    </TouchableOpacity>

    {/* Card info */}
    <View style={styles.cardInfo}>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardPrice}>from ${item.price_from}</Text>
        <View style={styles.cardRating}>
          <Text style={styles.cardRatingStar}>★</Text>
          <Text style={styles.cardRatingText}>{item.rating}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

// ── PICK SPOTS SCREEN ─────────────────────────────────────────────────
export default function PickSpotsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    city: string;
    startDate: string;
    endDate: string;
    budget: string;
    interests: string;
  }>();

  const city = params.city ?? 'Hurghada';
  const interests = params.interests?.split(',') ?? [];

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [addedSpots, setAddedSpots] = useState<number[]>([]);
  const [favoritedSpots, setFavoritedSpots] = useState<number[]>([]);

  useEffect(() => {
    fetchSpots();
  }, [city, activeCategory]);

  const fetchSpots = async (): Promise<void> => {
    setLoading(true);
    try {
      const categoryParam = activeCategory !== 'all' ? `&category=${activeCategory}` : '';
      const res = await fetch(`${API_BASE}/attractions?city=${encodeURIComponent(city)}${categoryParam}`);
      const data = await res.json();
      setSpots(data.data ?? []);
    } catch (err) {
      console.error('Fetch spots error:', err);
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
    setFavoritedSpots(prev =>
      prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
    );
  };

  const goToAttractionDetails = (item: Spot): void => {
    router.push(`/(main)/attraction?id=${item.id}` as any);
  };

  const handleNext = (): void => {
    if (addedSpots.length === 0) {
      alert('Please add at least one spot to your plan.');
      return;
    }
    router.push({
      pathname: '/(main)/itinerary' as any,
      params: {
        ...params,
        spotIds: addedSpots.join(','),
      },
    });
  };

  // Group spots by category for display
  const groupedSpots = CATEGORIES.filter(c => c.key !== 'all').map(cat => ({
    ...cat,
    data: spots.filter(s => s.category === cat.key),
  })).filter(group => group.data.length > 0);

  const displaySpots = activeCategory === 'all'
    ? spots
    : spots.filter(s => s.category === activeCategory);

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.locationPill}>
          <Text style={styles.locationIcon}>📍</Text>
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
        <Text style={styles.title}>Pick Your Spots</Text>

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
              <Text style={styles.categoryTabIcon}>{cat.icon}</Text>
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
                <FlatList
                  data={group.data}
                  keyExtractor={item => String(item.id)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
                  renderItem={({ item }) => (
                    <SpotCard
                      item={item}
                      isAdded={addedSpots.includes(item.id)}
                      isFavorited={favoritedSpots.includes(item.id)}
                      onAdd={toggleAdd}
                      onFavorite={toggleFavorite}
                      onPress={goToAttractionDetails}
                    />
                  )}
                />
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
          <Text style={styles.bottomBarLabel}>Selected spots</Text>
          <Text style={styles.bottomBarCount}>{addedSpots.length} spots added</Text>
        </View>
        <TouchableOpacity
          style={[styles.nextBtn, addedSpots.length === 0 && styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Next step →</Text>
        </TouchableOpacity>
      </View>

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
  emptySubText: { fontSize: 13, color: '#999', marginTop: 6 },

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