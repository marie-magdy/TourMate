// app/(main)/favorites.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Attraction } from '../../constants/types';
import { useApp } from '../../constants/AppContext';
import AttractionSheet from '../../components/AttractionSheet';

const { width, height } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

const CATEGORY_COLORS: Record<string, string> = {
  historical:  '#8B4513',
  beaches:     '#0077B6',
  restaurants: '#E63946',
  shopping:    '#9B2335',
  nature:      '#2D6A4F',
  diving:      '#023E8A',
  culture:     '#6D3B8E',
  nightlife:   '#1A1A2E',
  adventure:   '#D62828',
};

// ── Parse categories (may come as string or array) ────────────────────
const parseCategories = (cats: any): string[] => {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c: string) => c.toLowerCase());
  if (typeof cats === 'string') {
    return cats.replace(/[{}]/g, '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

// ── Star Rating ───────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number; color?: string }> = ({
  rating, size = 11, color = '#FFC107',
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
    {[1,2,3,4,5].map(i => (
      <Text key={i} style={{ color: i <= Math.round(rating) ? color : '#DDD', fontSize: size }}>★</Text>
    ))}
    <Text style={{ color: '#888', fontSize: size - 1, marginLeft: 3 }}>{rating}</Text>
  </View>
);

// ── Favorite Card ─────────────────────────────────────────────────────
const FavoriteCard: React.FC<{
  item: Attraction;
  onPress: (item: Attraction) => void;
}> = ({ item, onPress }) => {
  const firstCategory = parseCategories(item.categories)[0] ?? '';
  const categoryColor = CATEGORY_COLORS[firstCategory] ?? '#E67E22';
  const { convertPrice } = useApp();
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.92}>
      <Image source={{ uri: item.primary_image || item.image_url }} style={styles.cardImage} resizeMode="cover" />
      <View style={[styles.categoryBadgeCard, { backgroundColor: categoryColor }]}>
        <Text style={styles.categoryBadgeText}>{firstCategory}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.cardLocationRow}>
          <MaterialCommunityIcons name="map-marker" size={10} color="#999" style={{ marginRight: 3 }} />
          <Text style={styles.cardLocationText}>{item.city}, Egypt</Text>
        </View>
        <View style={styles.cardFooter}>
          <StarRating rating={Number(item.rating)} />
          <Text style={styles.cardPrice}>From {convertPrice(item.price_from)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Empty State ───────────────────────────────────────────────────────
const EmptyState: React.FC<{ onExplore: () => void }> = ({ onExplore }) => {
  const { t } = useApp();
  return (
  <View style={styles.emptyContainer}>
    <MaterialCommunityIcons name="heart-off-outline" size={64} color="#DDD" style={{ marginBottom: 16 }} />
    <Text style={styles.emptyTitle}>{t('noFavorites')}</Text>
    <Text style={styles.emptySubtitle}>{t('noFavoritesMsg')}</Text>
    <TouchableOpacity style={styles.exploreBtn} onPress={onExplore} activeOpacity={0.85}>
      <Text style={styles.exploreBtnText}>{t('explore')}</Text>
    </TouchableOpacity>
  </View>
  );
};

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Bottom Tab — same floating pill style as home ─────────────────────
interface TabItem { name: string; label: string; iconDefault: MCIconName; iconActive: MCIconName; route: string; }

const TABS: TabItem[] = [
  { name: 'Home',      label: 'Home',   iconDefault: 'home-outline',               iconActive: 'home',                  route: '/(main)/home' },
  { name: 'Plan',      label: 'Plan',   iconDefault: 'calendar-plus-outline',      iconActive: 'calendar-plus',         route: '/(main)/plan' },
  { name: 'Tour Mate', label: 'AI',     iconDefault: 'robot-outline',              iconActive: 'robot',                 route: '/(main)/tourmate-ai' },
  { name: 'Favorites', label: 'Saved',  iconDefault: 'heart-outline',              iconActive: 'heart',                 route: '/(main)/favorites' },
  { name: 'My Plans',  label: 'Plans',  iconDefault: 'bookmark-multiple-outline',  iconActive: 'bookmark-multiple',     route: '/(main)/saved-plans' },
  { name: 'View Map',  label: 'Map',    iconDefault: 'map-marker-outline',         iconActive: 'map-marker',            route: '/(main)/map' },
];

const BottomTab: React.FC<{ active: string }> = ({ active }) => {
  const router = useRouter();
  return (
    <View style={styles.bottomTabWrap}>
      <View style={styles.bottomTab}>
        {TABS.map(tab => {
          const isActive = tab.name === active;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => { if (!isActive) router.push(tab.route as any); }}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name={isActive ? tab.iconActive : tab.iconDefault}
                size={22}
                color={isActive ? '#FFF' : 'rgba(255,255,255,0.45)'}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ── FAVORITES SCREEN ──────────────────────────────────────────────────
export default function FavoritesScreen() {
  const router = useRouter();
  const { t } = useApp();
  const [favorites, setFavorites]               = useState<Attraction[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [showSheet, setShowSheet]               = useState(false);
  const [userId, setUserId]                     = useState<number>(1);
  const [userLocation, setUserLocation]         = useState<{ latitude: number; longitude: number } | null>(null);

  // Load userId once on mount
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const id = raw ? JSON.parse(raw).id : 1;
        setUserId(id);
      } catch (err) {
        console.error('UserId load error:', err);
      }
    };
    loadUserId();
    
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Refetch favorites on page focus (use the loaded userId)
  useFocusEffect(
    useCallback(() => { 
      const fetchFavs = async () => {
        if (!userId || userId === 1) return; // Wait for userId to load, or skip if default
        try {
          setLoading(true);
          const res = await fetch(`${API_BASE}/attractions/favorites/${userId}`);
          const data = await res.json();
          setFavorites(data.data ?? []);
        } catch (err) {
          console.error('Favorites fetch error on focus:', err);
        } finally {
          setLoading(false);
        }
      };
      
      fetchFavs();
    }, [userId])
  );

  const openAttraction = (item: Attraction) => {
    setSelectedAttraction(item);
    setShowSheet(true);
  };

  const removeFavorite = (attractionId: number) => {
    // Remove from local state
    setFavorites(prev => prev.filter(f => f.id !== attractionId));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F5F0" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('favoritesTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {favorites.length > 0 ? `${favorites.length} saved place${favorites.length > 1 ? 's' : ''}` : 'Your saved places'}
          </Text>
        </View>
        {favorites.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{favorites.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E67E22" />
        </View>
      ) : favorites.length === 0 ? (
        <EmptyState onExplore={() => router.push('/(main)/home' as any)} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FavoriteCard item={item} onPress={openAttraction} />
          )}
        />
      )}

      <BottomTab active="Favorites" />

      <AttractionSheet
        attraction={selectedAttraction}
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        userLocation={userLocation}
        userId={userId}
        onRemove={removeFavorite}
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────
const CARD_WIDTH = (width - 48) / 2;

const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#F9F5F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle:    { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  countBadge:     { backgroundColor: '#E67E22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  countBadgeText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  grid:    { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 4 },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },

  card:             { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  cardImage:        { width: '100%', height: 130 },
  categoryBadgeCard:{ position: 'absolute', top: 10, left: 10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText:{ color: '#FFF', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  cardContent:      { padding: 10 },
  cardName:         { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardLocationRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardLocationIcon: { fontSize: 10, marginRight: 3 },
  cardLocationText: { fontSize: 11, color: '#999' },
  cardFooter:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice:        { fontSize: 11, fontWeight: '700', color: '#E67E22' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyEmoji:     { fontSize: 64, marginBottom: 16 },
  emptyTitle:     { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle:  { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  exploreBtn:     { backgroundColor: '#E67E22', borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14 },
  exploreBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  bottomTabWrap:  { position: 'absolute', bottom: 20, left: 16, right: 16, alignItems: 'center' },
  bottomTab:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A0A00', borderRadius: 28, paddingVertical: 10, paddingHorizontal: 6, shadowColor: '#1A0A00', shadowOpacity: 0.4, shadowRadius: 24, elevation: 16, width: '100%', justifyContent: 'space-around' },
  tabItem:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 20, gap: 3 },
  tabItemActive:  { backgroundColor: '#C4873A' },
  tabLabel:       { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 0.2 },
  tabLabelActive: { color: '#FFF', fontWeight: '800' },

  // Bottom Sheet
  sheetBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetContainer:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.88, overflow: 'hidden' },
  sheetHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  galleryContainer: { width, height: 240 },
  galleryImage:     { width, height: 240 },
  imageDots:        { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  imageDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  imageDotActive:   { backgroundColor: '#FFF', width: 18 },
  sheetCloseBtn:    { position: 'absolute', top: 14, left: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheetCloseBtnText:{ color: '#FFF', fontSize: 14, fontWeight: '700' },
  sheetFavBtn:      { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheetFavIcon:     { fontSize: 18 },
  categoryBadge:    { position: 'absolute', bottom: 14, left: 14, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  sheetContent:     { paddingHorizontal: 20, paddingTop: 16 },
  sheetName:        { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  sheetLocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sheetLocationIcon:{ fontSize: 13, marginRight: 4 },
  sheetLocationText:{ fontSize: 13, color: '#888', fontWeight: '500' },
  sheetRatingRow:   { marginBottom: 14 },
  infoPillsRow:     { marginBottom: 16 },
  infoPill:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, gap: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  infoPillIcon:     { fontSize: 18 },
  infoPillLabel:    { fontSize: 10, color: '#AAA', fontWeight: '600' },
  infoPillValue:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A', maxWidth: 100 },
  sheetAboutTitle:  { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  sheetAboutText:   { fontSize: 14, color: '#666', lineHeight: 22 },
  sheetActions:         { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32, gap: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  sheetFavoritesBtn:    { flex: 1, borderWidth: 2, borderColor: '#E67E22', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  sheetFavoritesBtnText:{ color: '#E67E22', fontSize: 15, fontWeight: '700' },
  sheetPlanBtn:         { flex: 2, backgroundColor: '#E67E22', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  sheetPlanBtnText:     { color: '#FFF', fontSize: 15, fontWeight: '700' },
});