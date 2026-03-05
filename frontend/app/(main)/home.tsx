// app/(main)/home.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Attraction } from '../../constants/types';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:5000/api`;// 🔁 replace with your LAN IP (run ipconfig in terminal)

// ── Star Rating ──────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <View style={styles.stars}>
    {[1, 2, 3, 4, 5].map(i => (
      <Text key={i} style={{ color: i <= Math.round(rating) ? '#FFC107' : '#ddd', fontSize: 10 }}>
        ★
      </Text>
    ))}
    <Text style={styles.ratingText}>{rating}</Text>
  </View>
);

// ── Popular Card (wide horizontal) ───────────────────────────────────
const PopularCard: React.FC<{ item: Attraction; onPress: (item: Attraction) => void }> = ({ item, onPress }) => (
  <TouchableOpacity style={styles.popularCard} onPress={() => onPress(item)} activeOpacity={0.9}>
    <Image source={{ uri: item.image_url }} style={styles.popularImage} />
    <View style={styles.popularOverlay}>
      <Text style={styles.popularName}>{item.name}</Text>
      <Text style={styles.popularPrice}>from ${item.price_from}</Text>
      <StarRating rating={item.rating} />
    </View>
  </TouchableOpacity>
);

// ── Nearest Card (small square) ───────────────────────────────────────
const NearestCard: React.FC<{ item: Attraction; onPress: (item: Attraction) => void }> = ({ item, onPress }) => (
  <TouchableOpacity style={styles.nearestCard} onPress={() => onPress(item)} activeOpacity={0.9}>
    <Image source={{ uri: item.image_url }} style={styles.nearestImage} />
    <View style={styles.nearestOverlay}>
      <Text style={styles.nearestName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.nearestPrice}>From ${item.price_from}</Text>
      <StarRating rating={item.rating} />
    </View>
  </TouchableOpacity>
);

// ── Bottom Tab Bar ────────────────────────────────────────────────────
const BottomTab: React.FC<{ active: string }> = ({ active }) => {
  const router = useRouter();
  const tabs = [
    { name: 'Home', icon: '🏠', route: '/(main)/home' },
    { name: 'Plan', icon: '🗺️', route: '/(main)/plan' },
    { name: 'Tour Mate', icon: '🧳', route: '/(main)/home' },
    { name: 'Favorites', icon: '♡', route: '/(main)/home' },
    { name: 'View Map', icon: '📍', route: '/(main)/map' },
  ];
  return (
    <View style={styles.bottomTab}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tabItem}
          onPress={() => router.push(tab.route as any)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, tab.name === active && styles.tabLabelActive]}>
            {tab.name}
          </Text>
          {tab.name === active && <View style={styles.tabDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ── HOME SCREEN ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();

  const [popular, setPopular] = useState<Attraction[]>([]);
  const [nearest, setNearest] = useState<Attraction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (): Promise<void> => {
    try {
      const [popRes, nearRes] = await Promise.all([
        fetch(`${API_BASE}/attractions/popular`),
        fetch(`${API_BASE}/attractions/nearest?city=Alexandria`),
      ]);
      const popData = await popRes.json();
      const nearData = await nearRes.json();
      setPopular(popData.data ?? []);
      setNearest(nearData.data ?? []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string): Promise<void> => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/attractions/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  const goToDetails = (item: Attraction): void => {
    (router as any).push({
      pathname: '/(main)/attraction',
      params: { id: item.id },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F5F0" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity 
           style={styles.locationRow}
           onPress={() => router.push('/(main)/map' as any)}
>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>Alexandria, Egypt</Text>
</TouchableOpacity>
          <View style={styles.headerRight}>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>100 ⭐</Text>
            </View>
            <TouchableOpacity 
  style={styles.avatarBtn}
  onPress={() => router.push('/(main)/settings' as any)}
>
  <Text style={styles.avatarIcon}>👤</Text>
</TouchableOpacity>
          </View>
        </View>

        {/* ── Title ── */}
        <Text style={styles.heroTitle}>Plan your next trip »</Text>

        {/* ── Search Bar ── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#AAA"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search Dropdown ── */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.searchResultItem}
                onPress={() => goToDetails(item)}
              >
                <Text style={styles.searchResultText}>{item.name}</Text>
                <Text style={styles.searchResultSub}>{item.city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Popular Locations ── */}
        <Text style={styles.sectionTitle}>Popular locations</Text>
        <FlatList
          data={popular}
          keyExtractor={item => String(item.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
          renderItem={({ item }) => <PopularCard item={item} onPress={goToDetails} />}
        />

        {/* ── Nearest Places ── */}
        <Text style={styles.sectionTitle}>Nearest Places</Text>
        <FlatList
          data={nearest}
          keyExtractor={item => String(item.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 10, paddingBottom: 10 }}
          renderItem={({ item }) => <NearestCard item={item} onPress={goToDetails} />}
        />

        <View style={{ height: 90 }} />
      </ScrollView>

      <BottomTab active="Home" />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F5F0',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F5F0',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEBE8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationPin: { fontSize: 12, marginRight: 4 },
  locationText: { fontSize: 13, color: '#555', fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pointsText: { fontSize: 13, color: '#E67E22', fontWeight: '700' },
  avatarBtn: { backgroundColor: '#EEE', borderRadius: 20, padding: 8 },
  avatarIcon: { fontSize: 14 },

  // Hero title
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 16,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  filterBtn: { backgroundColor: '#E67E22', borderRadius: 30, padding: 14 },
  filterIcon: { fontSize: 16 },

  // Search dropdown
  searchDropdown: {
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  searchResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultText: { fontSize: 14, fontWeight: '600', color: '#333' },
  searchResultSub: { fontSize: 12, color: '#999', marginTop: 2 },

  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },

  // Popular cards
  popularCard: {
    width: 190,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  popularImage: { width: '100%', height: '100%' },
  popularOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  popularName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  popularPrice: { color: '#FFE0A0', fontSize: 11, marginTop: 1 },

  // Nearest cards
  nearestCard: {
    width: 130,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
  },
  nearestImage: { width: '100%', height: '100%' },
  nearestOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  nearestName: { color: '#FFF', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  nearestPrice: { color: '#FFE0A0', fontSize: 10, marginTop: 2 },

  // Stars
  stars: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  ratingText: { color: '#FFF', fontSize: 10, marginLeft: 3 },

  // Bottom tab
  bottomTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 10, color: '#AAA', marginTop: 2 },
  tabLabelActive: { color: '#E67E22', fontWeight: '700' },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E67E22',
    marginTop: 2,
  },
});
