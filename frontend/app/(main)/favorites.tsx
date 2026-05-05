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
import BottomTab from '@/components/BottomTab';
import { Theme } from '../../constants/theme';

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
      <MaterialCommunityIcons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={i <= Math.round(rating) ? color : '#DDD'} />
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


// ── FAVORITES SCREEN ──────────────────────────────────────────────────
export default function FavoritesScreen() {
  const router = useRouter();
  const { t, userId } = useApp();
  const [favorites, setFavorites]               = useState<Attraction[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [showSheet, setShowSheet]               = useState(false);
  // const [userId, setUserId]                     = useState<number>(1);
  const [userLocation, setUserLocation]         = useState<{ latitude: number; longitude: number } | null>(null);

  // // Load userId once on mount
  // useEffect(() => {
  //   const loadUserId = async () => {
  //     try {
  //       const raw = await AsyncStorage.getItem('user');
  //       const id = raw ? JSON.parse(raw).id : 1;
  //       setUserId(id);
  //     } catch (err) {
  //       console.error('UserId load error:', err);
  //     }
  //   };
  //   loadUserId();
    
  useEffect(() => {
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
                  <View style={styles.headerCenter}>
                     <Text style={styles.headerTitle}>{t('favoritesTitle')}</Text>
                  </View>
                  <View style={{ width: 40 }} />
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
    headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C1810',

  },
    headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  countBadge:     { backgroundColor: '#E67E22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  countBadgeText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  grid:    { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 4 },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },

  card: {
    width: CARD_WIDTH,
    backgroundColor: Theme.colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Theme.colors.hero,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  cardImage: {
    width: '100%',
    height: 130,
  },

  categoryBadgeCard: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Theme.colors.primary,
  },

  categoryBadgeText: {
    color: Theme.colors.card,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  cardContent: {
    padding: 10,
  },

  cardName: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 4,
  },

  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  cardLocationIcon: {
    fontSize: 10,
    marginRight: 3,
    color: Theme.colors.muted,
  },

  cardLocationText: {
    fontSize: 11,
    color: Theme.colors.muted,
  },

cardFooter: {
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gap: 2,
  marginTop: 6,
},

cardPrice: {
  fontSize: 10,
  fontWeight: '700',
  color: Theme.colors.primary,
  marginTop: 2,
},
  // ── Empty State (cinematic version) ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
    backgroundColor: Theme.colors.background,
  },

  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.hero,
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: Theme.colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },

  exploreBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },

  exploreBtnText: {
    color: Theme.colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
});