// app/(main)/attraction.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  StatusBar, Dimensions, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Attraction } from '../../constants/types';

const { width, height } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:5000/api`; // 🔁 replace with your LAN IP
const BOTTOM_SHEET_HEIGHT = 260;

// ── Star Rating ──────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 14 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Text
        key={i}
        style={{ color: i <= Math.round(rating) ? '#FFC107' : 'rgba(255,255,255,0.4)', fontSize: size }}
      >
        ★
      </Text>
    ))}
  </View>
);

// ── ATTRACTION DETAILS SCREEN ────────────────────────────────────────
export default function AttractionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  const fetchDetails = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/attractions/${id}`);
      const data = await res.json();
      if (data.success) setAttraction(data.data);
    } catch (err) {
      console.error('Fetch details error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (): Promise<void> => {
    setIsFavorited(prev => !prev);
    try {
      await fetch(`${API_BASE}/attractions/${attraction?.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1 }), // replace with real user id from your auth
      });
    } catch (err) {
      setIsFavorited(prev => !prev);
    }
  };

  if (loading || !attraction) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Hero Image ── */}
      <View style={styles.heroContainer}>
        <Image source={{ uri: attraction.image_url }} style={styles.heroImage} />
        <View style={styles.heroGradient} />

        {/* Top Buttons */}
        <SafeAreaView style={styles.topActions}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.favoriteBtn} onPress={toggleFavorite}>
            <Text style={[styles.favoriteIcon, isFavorited && { color: '#E74C3C' }]}>
              {isFavorited ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Info Overlay */}
        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle}>{attraction.name}</Text>
          <Text style={styles.heroDescription} numberOfLines={3}>
            {attraction.description}
          </Text>
          <View style={styles.heroMeta}>
            <StarRating rating={attraction.rating} size={14} />
            <Text style={styles.heroRatingNum}>{attraction.rating}</Text>
            <Text style={styles.heroDivider}>·</Text>
            <Text style={styles.heroReviews}>({attraction.review_count} reviews)</Text>
            <TouchableOpacity style={styles.seeReviewsBtn}>
              <Text style={styles.seeReviewsText}>See reviews</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Bottom Sheet ── */}
      <View style={styles.bottomSheet}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Location */}
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>
              {attraction.location ?? `${attraction.city}, ${attraction.country}`}
            </Text>
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Price from</Text>
              <Text style={styles.detailValue}>${attraction.price_from}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Rating</Text>
              <Text style={styles.detailValue}>{attraction.rating} ★</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Reviews</Text>
              <Text style={styles.detailValue}>{attraction.review_count}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{attraction.city}</Text>
            </View>
          </View>

          {/* About */}
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>{attraction.description}</Text>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* CTA Button */}
        <TouchableOpacity style={styles.viewMoreBtn} activeOpacity={0.85}>
          <Text style={styles.viewMoreText}>View more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F0' },
  heroContainer: { width, height: height - BOTTOM_SHEET_HEIGHT + 40 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '60%', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topActions: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  favoriteBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  favoriteIcon: { color: '#FFF', fontSize: 20 },
  heroInfo: { position: 'absolute', bottom: 50, left: 20, right: 20 },
  heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  heroDescription: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  heroRatingNum: { color: '#FFF', fontSize: 13, fontWeight: '700', marginLeft: 4 },
  heroDivider: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  heroReviews: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  seeReviewsBtn: { marginLeft: 'auto' },
  seeReviewsText: { color: '#FFD580', fontSize: 13, fontWeight: '600' },
  bottomSheet: {
    flex: 1, backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 20, paddingHorizontal: 24,
    marginTop: -30,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationPin: { fontSize: 14, marginRight: 6 },
  locationText: { fontSize: 14, color: '#555', fontWeight: '500' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  detailItem: {
    backgroundColor: '#FFF8F0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    minWidth: '44%', flex: 1,
  },
  detailLabel: { fontSize: 11, color: '#AAA', marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  aboutTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#666', lineHeight: 21 },
  viewMoreBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 30,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 24, marginTop: 8,
  },
  viewMoreText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
