// app/(main)/home.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, FlatList, ActivityIndicator,
  StatusBar, Modal, Dimensions, Animated,
  PanResponder, Linking, Platform,
  TouchableWithoutFeedback,Pressable,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Attraction } from '../../constants/types';
import { useApp } from '../../constants/AppContext';
import * as Location from 'expo-location';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const EXCHANGE_KEY = process.env.EXPO_PUBLIC_EXCHANGE_API_KEY;


// ── Safely parse categories from DB (may come as string or array) ────
const parseCategories = (cats: any): string[] => {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c: string) => c.toLowerCase());
  if (typeof cats === 'string') {
    // PostgreSQL array format: "{historical,culture}" or "historical,culture"
    return cats.replace(/[{}]/g, '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

const getWeatherInfo = (code: number) => {
  if (code === 0)  return { icon: '☀️', label: 'Clear' };
  if (code <= 2)   return { icon: '⛅', label: 'Partly Cloudy' };
  if (code === 3)  return { icon: '☁️', label: 'Cloudy' };
  if (code <= 49)  return { icon: '🌫️', label: 'Foggy' };
  if (code <= 59)  return { icon: '🌦️', label: 'Drizzle' };
  if (code <= 69)  return { icon: '🌧️', label: 'Rainy' };
  if (code <= 79)  return { icon: '❄️', label: 'Snowy' };
  if (code <= 99)  return { icon: '⛈️', label: 'Stormy' };
  return { icon: '🌡️', label: 'Unknown' };
};

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',       flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',            flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',   flag: '🇬🇧' },
  { code: 'SAR', name: 'Saudi Riyal',     flag: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham',      flag: '🇦🇪' },
  { code: 'KWD', name: 'Kuwaiti Dinar',   flag: '🇰🇼' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'JPY', name: 'Japanese Yen',    flag: '🇯🇵' },
];

const CATEGORY_COLORS: Record<string, string> = {
  historical: '#8B4513',
  beaches:    '#0077B6',
  restaurants:'#E63946',
  shopping:   '#9B2335',
  nature:     '#2D6A4F',
  diving:     '#023E8A',
  culture:    '#6D3B8E',
  nightlife:  '#1A1A2E',
  adventure:  '#D62828',
};

const ALL_CATEGORIES = ['Historical', 'Beaches', 'Restaurants', 'Shopping', 'Nature', 'Diving', 'Culture', 'Nightlife', 'Adventure'];
const PRICE_PRESETS = [
  { label: 'Any', max: null },
  { label: '< $50', max: 50 },
  { label: '< $100', max: 100 },
  { label: '< $200', max: 200 },
];

// ── Filter Sheet ──────────────────────────────────────────────────────
interface FilterState {
  categories: string[];
  maxPrice: number | null;
  minRating: number;
}

const DEFAULT_FILTERS: FilterState = { categories: [], maxPrice: null, minRating: 0 };

interface FilterSheetProps {
  visible: boolean;
  initial: FilterState;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

const FilterSheet: React.FC<FilterSheetProps> = ({ visible, initial, onApply, onClose }) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [draft, setDraft] = useState<FilterState>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 260, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleCategory = (cat: string) => {
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const activeFilterCount =
    draft.categories.length +
    (draft.maxPrice !== null ? 1 : 0) +
    (draft.minRating > 0 ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.sheetBackdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.filterSheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filter Attractions</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterActiveBadge}>
              <Text style={styles.filterActiveBadgeText}>{activeFilterCount} active</Text>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={styles.filterCloseBtn}>
            <Text style={styles.filterCloseBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

          {/* Category */}
          <Text style={styles.filterSectionLabel}>CATEGORY</Text>
          <View style={styles.filterChipsWrap}>
            {ALL_CATEGORIES.map(cat => {
              const key = cat.toLowerCase();
              const active = draft.categories.includes(key);
              const color = CATEGORY_COLORS[key] ?? '#E67E22';
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    active && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => toggleCategory(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price */}
          <Text style={styles.filterSectionLabel}>MAX PRICE</Text>
          <View style={styles.filterPriceRow}>
            {PRICE_PRESETS.map(preset => {
              const active = draft.maxPrice === preset.max;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.filterPriceBtn, active && styles.filterPriceBtnActive]}
                  onPress={() => setDraft(prev => ({ ...prev, maxPrice: preset.max }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPriceBtnText, active && styles.filterPriceBtnTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Rating */}
          <Text style={styles.filterSectionLabel}>MINIMUM RATING</Text>
          <View style={styles.filterStarRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setDraft(prev => ({ ...prev, minRating: prev.minRating === star ? 0 : star }))}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterStar,
                  star <= draft.minRating && styles.filterStarActive,
                ]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.filterStarLabel}>
              {draft.minRating > 0 ? `${draft.minRating}+ stars` : 'Any'}
            </Text>
          </View>

        </ScrollView>

        {/* Actions */}
        <View style={styles.filterActions}>
          <TouchableOpacity
            style={styles.filterResetBtn}
            onPress={() => setDraft(DEFAULT_FILTERS)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterResetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterApplyBtn}
            onPress={() => { onApply(draft); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
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


// ── Weather Widget (uses coordinates, NOT city) ─────────────────────
const WeatherWidget: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
  const [weather, setWeather] = useState<{ temp: number; icon: string; label: string } | null>(null);

  useEffect(() => {
    if (!latitude || !longitude) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );

        const data = await res.json();
        const info = getWeatherInfo(data.current_weather.weathercode);

        setWeather({
          temp: Math.round(data.current_weather.temperature),
          icon: info.icon,
          label: info.label,
        });
      } catch (err) {
        console.log(err);
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  if (!weather) return null;

  return (
    <View style={styles.weatherChip}>
      <Text style={styles.weatherChipIcon}>{weather.icon}</Text>
      <Text style={styles.weatherChipTemp}>{weather.temp}°C</Text>
      <Text style={styles.weatherChipDot}>·</Text>
      <Text style={styles.weatherChipLabel}>{weather.label}</Text>
    </View>
  );
};

// ── Attraction Bottom Sheet ───────────────────────────────────────────
interface AttractionSheetProps {
  attraction: Attraction | null;
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}

const AttractionSheet: React.FC<AttractionSheetProps> = ({ attraction, visible, onClose, userLocation }) => {
  
  const { t, convertPrice } = useApp();
  const slideAnim  = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [isFavorited, setIsFavorited] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  // ── Audio Guide state ─────────────────────────────────────────────
  const [audioLang, setAudioLang] = useState<'en' | 'ar'>('en');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioScript, setAudioScript] = useState('');
  const [showScript, setShowScript] = useState(false);
  const soundRef = useRef<any>(null);

  // ── Get There state ───────────────────────────────────────────────
  const [rideInfo, setRideInfo] = useState<{ distance: string; duration: string; fare: string } | null>(null);
  const [rideLoading, setRideLoading] = useState(false);

  
  useEffect(() => {
    if (visible && attraction) {
      fetchImages(attraction.id);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      stopAudio();
      setAudioScript('');
      setShowScript(false);
      setRideInfo(null);
      Animated.parallel([
        Animated.timing(slideAnim,  { toValue: height, duration: 280, useNativeDriver: true }),
        Animated.timing(opacityAnim,{ toValue: 0,      duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, attraction]);

  // Reset audio when language changes
  useEffect(() => {
    stopAudio();
    setAudioScript('');
    setShowScript(false);
  }, [audioLang]);

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setAudioPlaying(false);
  };

  // ── Get There helpers ─────────────────────────────────────────────
  const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

  // Egypt ride fare estimate: ~5 EGP/km base, minimum 30 EGP
  const estimateFare = (distanceMeters: number) => {
    const km = distanceMeters / 1000;
    const egp = Math.max(30, Math.round(km * 5));
    return `~${egp}–${egp + 20} EGP`;
  };

  const fetchAttractionCoordinates = async (name: string, city?: string) => {
    try {
      const query = city ? `${name}, ${city}` : name;
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: query, format: 'json', limit: 1 },
        headers: {
          'User-Agent': 'TourMateApp/1.0 (tourmate@gmail.com)',
        },
      });
      if (res.data?.length > 0) {
        return {
          lat: parseFloat(res.data[0].lat),
          lon: parseFloat(res.data[0].lon),
        };
      } else {
        return null;
      }
    } catch {
      return null;
    }
  };

  const fetchRideInfo = async () => {
    if (!attraction || rideInfo || !userLocation) return;
    setRideLoading(true);

    try {
      // Origin: user's current location
      const origin = { lat: userLocation.latitude, lon: userLocation.longitude };

      // Destination: fetch dynamically from OpenStreetMap
      const destCoord = await fetchAttractionCoordinates(attraction.name, attraction.city);
      if (!destCoord) {
        setRideInfo({ distance: 'Varies', duration: 'Varies', fare: '~30–80 EGP' });
        setRideLoading(false);
        return;
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lon}&destinations=${destCoord.lat},${destCoord.lon}&mode=driving&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const element = data.rows?.[0]?.elements?.[0];

      if (element?.status === 'OK') {
        setRideInfo({
          distance: element.distance.text,
          duration: element.duration.text,
          fare: estimateFare(element.distance.value),
        });
      } else {
        setRideInfo({ distance: 'N/A', duration: 'N/A', fare: '~30–80 EGP' });
      }
    } catch {
      setRideInfo({ distance: 'N/A', duration: 'N/A', fare: '~30–80 EGP' });
    } finally {
      setRideLoading(false);
    }
  };

  const openUber = async () => {
    if (!attraction || !userLocation) return;

    try {
      // Origin: user's current location
      const origin = { lat: userLocation.latitude, lon: userLocation.longitude };

      // Destination: fetch dynamically from OpenStreetMap
      const dest = await fetchAttractionCoordinates(attraction.name, attraction.city);

      const uberUrl = dest
        ? `uber://?action=setPickup&pickup[latitude]=${origin.lat}&pickup[longitude]=${origin.lon}&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[nickname]=${encodeURIComponent(attraction.name)}`
        : `uber://`;

      // App Store / Play Store links for Uber
      const uberIOS = 'itms-apps://itunes.apple.com/app/id368677368';
      const uberAndroid = 'https://play.google.com/store/apps/details?id=com.ubercab';

      const canOpen = await Linking.canOpenURL(uberUrl);
      if (canOpen) {
        Linking.openURL(uberUrl);
      } else {
        const storeUrl = Platform.OS === 'ios' ? uberIOS : uberAndroid;
        Linking.openURL(storeUrl).catch(() =>
          Linking.openURL('https://apps.apple.com/app/id368677368')
        );
      }
    } catch (err) {
      console.warn('Failed to open Uber:', err);
    }
  };

  const openCareem = async () => {
    if (!attraction || !userLocation) return;

    try {
      // Pickup: user's current location
      const origin = { lat: userLocation.latitude, lon: userLocation.longitude };

      // Destination: fetch dynamically from OpenStreetMap
      const dest = await fetchAttractionCoordinates(attraction.name, attraction.city);

      const careemUrl = dest
        ? `careem://ride?pickup_lat=${origin.lat}&pickup_lng=${origin.lon}&dropoff_lat=${dest.lat}&dropoff_lng=${dest.lon}&dropoff_name=${encodeURIComponent(attraction.name)}`
        : `careem://`;

      // App Store / Play Store links for Careem
      const careemIOS = 'itms-apps://itunes.apple.com/app/id592978487';
      const careemAndroid = 'https://play.google.com/store/apps/details?id=com.careem.acma';

      const canOpen = await Linking.canOpenURL(careemUrl);
      if (canOpen) {
        Linking.openURL(careemUrl);
      } else {
        const storeUrl = Platform.OS === 'ios' ? careemIOS : careemAndroid;
        Linking.openURL(storeUrl).catch(() =>
          Linking.openURL('https://apps.apple.com/app/id592978487')
        );
      }
    } catch (err) {
      console.warn('Failed to open Careem:', err);
    }
  };
  const fetchImages = async (id: number) => {
    try {
      const res  = await fetch(`${API_BASE}/attractions/${id}/images`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setImages(data.data.map((img: any) => img.image_url));
      } else {
          setImages(attraction?.primary_image ? [attraction.primary_image] : []);
      }
      setActiveImage(0);
    } catch {
      setImages(attraction?.primary_image ? [attraction.primary_image] : []);
    }
  };

  const toggleFavorite = async () => {
    setIsFavorited(prev => !prev);
    try {
      await fetch(`${API_BASE}/attractions/${attraction?.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1 }),
      });
    } catch {
      setIsFavorited(prev => !prev);
    }
  };

  const handleAudioGuide = async () => {
    if (!attraction) return;
    if (audioPlaying) { await stopAudio(); return; }

    setAudioLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: attraction.name,
          city: attraction.city,
          category: parseCategories(attraction.categories)[0] ?? attraction.category,
          description: attraction.description,
          price_from: attraction.price_from,
          opening_hours: attraction.opening_hours,
          language: audioLang,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error('TTS failed');

      setAudioScript(data.script);

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${data.audio}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setAudioPlaying(true);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setAudioPlaying(false);
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error('Audio guide error:', err);
    } finally {
      setAudioLoading(false);
    }
  };

  if (!attraction) return null;

  const firstCategory = parseCategories(attraction.categories)[0] ?? attraction.category ?? '';
  const categoryColor = CATEGORY_COLORS[firstCategory] ?? '#E67E22';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.sheetBackdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>

        {/* Drag handle */}
        <View style={styles.sheetHandle} />

        {/* Image Gallery */}
        <View style={styles.galleryContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {(images.length > 0 ? images : [attraction.image_url]).map((img, i) => (
              <Image key={i} source={{ uri: img }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Image dots */}
          {images.length > 1 && (
            <View style={styles.imageDots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.imageDot, i === activeImage && styles.imageDotActive]} />
              ))}
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Favorite button */}
          <TouchableOpacity style={styles.sheetFavBtn} onPress={toggleFavorite}>
            <Text style={[styles.sheetFavIcon, isFavorited && { color: '#E74C3C' }]}>
              {isFavorited ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>

          {/* Category badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryBadgeText}>{firstCategory}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>

          {/* Name & Location */}
          <Text style={styles.sheetName}>{attraction.name}</Text>
          <View style={styles.sheetLocationRow}>
            <Text style={styles.sheetLocationIcon}>📍</Text>
            <Text style={styles.sheetLocationText}>{attraction.city}, Egypt</Text>
          </View>

          {/* Rating row */}
          <View style={styles.sheetRatingRow}>
            <StarRating rating={Number(attraction.rating)} size={14} />
          </View>

          {/* Info pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.infoPillsRow}>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillIcon}>💰</Text>
              <View>
                <Text style={styles.infoPillLabel}>{t('priceFrom')}</Text>
                <Text style={styles.infoPillValue}>{convertPrice(attraction.price_from)}</Text>
              </View>
            </View>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillIcon}>🕐</Text>
              <View>
                <Text style={styles.infoPillLabel}>{t('hours')}</Text>
                <Text style={styles.infoPillValue} numberOfLines={1}>{attraction.opening_hours ?? t('seeWebsite')}</Text>
              </View>
            </View>
            <View style={styles.infoPill}>
              <Text style={styles.infoPillIcon}>🏷️</Text>
              <View>
                <Text style={styles.infoPillLabel}>{t('category')}</Text>
                <Text style={[styles.infoPillValue, { textTransform: 'capitalize' }]}>
                  {parseCategories(attraction.categories).join(', ') || attraction.category}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* ── Audio Guide ── */}
          <View style={styles.audioGuideBox}>
            <View style={styles.audioGuideHeader}>
              <Text style={styles.audioGuideTitle}>🎧 Audio Guide</Text>
              {/* Language toggle */}
              <View style={styles.langToggle}>
                <TouchableOpacity
                  style={[styles.langBtn, audioLang === 'en' && styles.langBtnActive]}
                  onPress={() => setAudioLang('en')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, audioLang === 'en' && styles.langBtnTextActive]}>🇬🇧 EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, audioLang === 'ar' && styles.langBtnActive]}
                  onPress={() => setAudioLang('ar')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, audioLang === 'ar' && styles.langBtnTextActive]}>🇪🇬 AR</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Play button */}
            <TouchableOpacity
              style={[styles.audioPlayBtn, audioPlaying && styles.audioPlayBtnActive]}
              onPress={handleAudioGuide}
              activeOpacity={0.85}
              disabled={audioLoading}
            >
              {audioLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.audioPlayBtnText}>
                  {audioPlaying ? '⏹ Stop' : '▶ Play Guide'}
                </Text>
              )}
            </TouchableOpacity>

            {audioLoading && (
              <Text style={styles.audioLoadingText}>
                {audioLang === 'ar' ? 'جاري توليد الدليل الصوتي...' : 'Generating your audio guide...'}
              </Text>
            )}

            {/* Script toggle */}
            {audioScript.length > 0 && (
              <TouchableOpacity onPress={() => setShowScript(p => !p)} activeOpacity={0.7}>
                <Text style={styles.audioScriptToggle}>
                  {showScript ? '▲ Hide script' : '▼ Show script'}
                </Text>
              </TouchableOpacity>
            )}
            {showScript && audioScript.length > 0 && (
              <Text style={[styles.audioScriptText, audioLang === 'ar' && { textAlign: 'right' }]}>
                {audioScript}
              </Text>
            )}
          </View>

          {/* Description */}
          <Text style={styles.sheetAboutTitle}>{t('about')}</Text>
          <Text style={styles.sheetAboutText}>{attraction.description}</Text>

          {/* ── Get There ───────────────────────────────────────── */}
          <View style={styles.getRideSection}>
            <View style={styles.getRideHeader}>
              <Text style={styles.getRideTitle}>🚗 Get There</Text>
              {!rideInfo && !rideLoading && (
                <TouchableOpacity style={styles.getRideEstimateBtn} onPress={fetchRideInfo}>
                  <Text style={styles.getRideEstimateBtnText}>Check ride</Text>
                </TouchableOpacity>
              )}
            </View>

            {rideLoading && (
              <View style={styles.getRideLoading}>
                <ActivityIndicator size="small" color="#E67E22" />
                <Text style={styles.getRideLoadingText}>Estimating ride...</Text>
              </View>
            )}

            {rideInfo && !rideLoading && (
              <View style={styles.getRideInfo}>
                <View style={styles.getRidePill}>
                  <Text style={styles.getRidePillIcon}>📍</Text>
                  <Text style={styles.getRidePillValue}>{rideInfo.distance}</Text>
                </View>
                <View style={styles.getRidePill}>
                  <Text style={styles.getRidePillIcon}>⏱</Text>
                  <Text style={styles.getRidePillValue}>{rideInfo.duration}</Text>
                </View>
                <View style={styles.getRidePill}>
                  <Text style={styles.getRidePillIcon}>💰</Text>
                  <Text style={styles.getRidePillValue}>{rideInfo.fare}</Text>
                </View>
              </View>
            )}

            <View style={styles.getRideBtns}>
              <TouchableOpacity style={styles.uberBtn} onPress={openUber} activeOpacity={0.85}>
                <Text style={styles.uberBtnText}>🖤 Uber</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.careemBtn} onPress={openCareem} activeOpacity={0.85}>
                <Text style={styles.careemBtnText}>🟢 Careem</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.getRideNote}>App installed → opens with destination pre-filled · Not installed → download from store</Text>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.sheetFavoritesBtn}
            onPress={toggleFavorite}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetFavoritesBtnText}>
              {isFavorited ? t('saved') : t('save')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sheetPlanBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetPlanBtnText}>{t('addToPlan')}</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Modal>
  );
};

// ── Popular Card — cinematic tall rectangle ───────────────────────────
const PopularCard: React.FC<{ item: Attraction; onPress: (item: Attraction) => void }> = ({ item, onPress }) => {
  const { convertPrice } = useApp();
  return (
    <TouchableOpacity style={styles.popularCard} onPress={() => onPress(item)} activeOpacity={0.88}>
      <Image source={{ uri: item.primary_image }} style={styles.popularImage} />
      {/* Gradient overlay via layered Views */}
      <View style={styles.popularGradient} />
      <View style={styles.popularOverlay}>
        <View style={styles.popularRatingBadge}>
          <Text style={styles.popularRatingText}>⭐ {Number(item.rating).toFixed(1)}</Text>
        </View>
        <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.popularFooter}>
          <Text style={styles.popularPrice}>from {convertPrice(item.price_from)}</Text>
          <View style={styles.popularArrow}>
            <Text style={styles.popularArrowText}>→</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Nearest Card — horizontal list item ──────────────────────────────
const NearestCard: React.FC<{ item: Attraction; onPress: (item: Attraction) => void }> = ({ item, onPress }) => {
  const { convertPrice } = useApp();
  const firstCategory = parseCategories(item.categories)[0] ?? item.category ?? '';
  const catColor = CATEGORY_COLORS[firstCategory] ?? '#C4873A';
  return (
    <TouchableOpacity style={styles.nearestCard} onPress={() => onPress(item)} activeOpacity={0.88}>
      <Image source={{ uri: item.primary_image }} style={styles.nearestImage} />
      <View style={styles.nearestInfo}>
        <View style={[styles.nearestCategoryDot, { backgroundColor: catColor }]} />
        <Text style={styles.nearestName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.nearestCity}>{item.city}</Text>
        <View style={styles.nearestFooter}>
          <StarRating rating={Number(item.rating)} size={10} color="#F0A500" />
          <Text style={styles.nearestPrice}>{convertPrice(item.price_from)}</Text>
        </View>
      </View>
      <Text style={styles.nearestChevron}>›</Text>
    </TouchableOpacity>
  );
};

// ── Bottom Tab — floating pill style ──────────────────────────────────
const BottomTab: React.FC<{ active: string }> = ({ active }) => {
  const router = useRouter();
  const tabs = [
    { name: 'Home',      icon: '⌂',  route: '/(main)/home' },
    { name: 'Plan',      icon: '✦',  route: '/(main)/plan' },
    { name: 'Tour Mate', icon: '◈',  route: '/(main)/tourmate-ai' },
    { name: 'Favorites', icon: '♡',  route: '/(main)/favorites' },
    { name: 'Map',       icon: '◉',  route: '/(main)/map' },
  ];
  return (
    <View style={styles.bottomTabWrap}>
      <View style={styles.bottomTab}>
        {tabs.map(tab => {
          const isActive = tab.name === active;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => { if (!isActive) router.push(tab.route as any); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              {isActive && <Text style={styles.tabLabel}>{tab.name}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ── Currency Modal ────────────────────────────────────────────────────
const CurrencyModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [amount, setAmount]                     = useState('1');
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0]);
  const [rate, setRate]                         = useState<number | null>(null);
  const [loading, setLoading]                   = useState(false);
  const [lastUpdated, setLastUpdated]           = useState('');
  const [showPicker, setShowPicker]             = useState(false);

  useEffect(() => { if (visible) fetchRate(selectedCurrency.code); }, [visible]);

  const fetchRate = async (code: string) => {
    setLoading(true); setRate(null);
    try {
      const res  = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_KEY}/pair/${code}/EGP`);
      const data = await res.json();
      if (data.result === 'success') {
        setRate(data.conversion_rate);
        const d = new Date(data.time_last_update_utc);
        setLastUpdated(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const selectCurrency = (c: typeof CURRENCIES[0]) => { setSelectedCurrency(c); setShowPicker(false); fetchRate(c.code); };
  const converted = rate && amount ? (parseFloat(amount || '0') * rate).toFixed(2) : '—';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* ✅ Backdrop as a simple Pressable — no nesting issues */}
      <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>

        {/* ✅ Stop press from bubbling to backdrop */}
        <Pressable style={styles.currencySheet} onPress={Keyboard.dismiss}>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>💱 Currency Exchange</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live rate</Text>
            {lastUpdated ? <Text style={styles.liveDate}> · Updated {lastUpdated}</Text> : null}
          </View>
          <Text style={styles.currencyLabel}>From</Text>
          <TouchableOpacity style={styles.currencySelector} onPress={() => setShowPicker(!showPicker)}>
            <Text style={styles.currencyFlag}>{selectedCurrency.flag}</Text>
            <View style={styles.currencySelectorText}>
              <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
              <Text style={styles.currencyName}>{selectedCurrency.name}</Text>
            </View>
            <Text style={styles.currencySelectorArrow}>▾</Text>
          </TouchableOpacity>
          {showPicker && (
            <View style={styles.pickerDropdown}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                {CURRENCIES.map(c => (
                  <TouchableOpacity key={c.code} style={[styles.pickerItem, selectedCurrency.code === c.code && styles.pickerItemActive]} onPress={() => selectCurrency(c)}>
                    <Text style={styles.pickerFlag}>{c.flag}</Text>
                    <Text style={styles.pickerCode}>{c.code}</Text>
                    <Text style={styles.pickerName}>{c.name}</Text>
                    {selectedCurrency.code === c.code && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <Text style={styles.currencyLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrencyCode}>{selectedCurrency.code}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="#AAA"
            />
          </View>
          <View style={styles.convertArrow}><Text style={styles.convertArrowIcon}>↓</Text></View>
          <Text style={styles.currencyLabel}>To</Text>
          <View style={styles.resultBox}>
            <Text style={styles.resultFlag}>🇪🇬</Text>
            <View style={styles.resultTextBox}>
              <Text style={styles.resultCode}>EGP</Text>
              <Text style={styles.resultName}>Egyptian Pound</Text>
            </View>
            {loading ? <ActivityIndicator size="small" color="#E67E22" /> : <Text style={styles.resultAmount}>{converted}</Text>}
          </View>
          {rate && <Text style={styles.rateInfo}>1 {selectedCurrency.code} = {rate.toFixed(4)} EGP</Text>}

        </Pressable>
      </Pressable>
    </Modal>
  );
};
// ── HOME SCREEN ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const [locationText, setLocationText] = useState('Detecting...');
  const router = useRouter();
  const { t, convertPrice } = useApp();
  const [popular, setPopular]             = useState<Attraction[]>([]);
  const [nearest, setNearest]             = useState<Attraction[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<Attraction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showCurrency, setShowCurrency]   = useState(false);
  const [coords, setCoords]               = useState<{ latitude: number; longitude: number } | null>(null);

  // Filter state
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilter, setShowFilter]       = useState(false);

  // Bottom sheet state
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [showSheet, setShowSheet]                   = useState(false);

  // User points state
  const [userPoints, setUserPoints] = useState<number | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationText('Permission denied');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

        const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: { format: 'json', lat: loc.coords.latitude, lon: loc.coords.longitude },
          headers: { 'User-Agent': 'TourMateApp/1.0', 'Accept-Language': 'en' },
          timeout: 10000,
        });

        const city = res.data.address.city || res.data.address.town || res.data.address.village || '';
        const country = res.data.address.country || '';
        setLocationText(`${city}${city && country ? ', ' : ''}${country}` || 'Unknown');

      } catch {
        setLocationText('Unknown');
      }
    })();
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [popRes, nearRes, pointsRes] = await Promise.all([
        fetch(`${API_BASE}/attractions/popular`),
        fetch(`${API_BASE}/attractions/nearest?city=Alexandria`),
        fetch(`${API_BASE}/points/1`),
      ]);
      const popData    = await popRes.json();
      const nearData   = await nearRes.json();
      const pointsData = await pointsRes.json();

      setPopular(popData.data  ?? []);
      setNearest(nearData.data ?? []);
      if (pointsData.success) {
        setUserPoints(pointsData.data.points);
      }
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) { setSearchResults([]); return; }
    try {
      const res  = await fetch(`${API_BASE}/attractions/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
    } catch {}
  };

  const openAttraction = (item: Attraction) => {
    setSelectedAttraction(item);
    setShowSheet(true);
  };

  // ── Apply active filters ────────────────────────────────────────────
  const applyFilters = (list: Attraction[]) => {
    return list.filter(item => {
      if (activeFilters.categories.length > 0) {
        const itemCats = parseCategories(item.categories);
        const hasMatch = activeFilters.categories.some(f => itemCats.includes(f));
        if (!hasMatch) return false;
      }
      if (activeFilters.maxPrice !== null && Number(item.price_from) > activeFilters.maxPrice) return false;
      if (activeFilters.minRating > 0 && Number(item.rating) < activeFilters.minRating) return false;
      return true;
    });
  };

  const filteredPopular = applyFilters(popular);
  const filteredNearest = applyFilters(nearest);
  const filteredSearch  = applyFilters(searchResults);

  const activeFilterCount =
    activeFilters.categories.length +
    (activeFilters.maxPrice !== null ? 1 : 0) +
    (activeFilters.minRating > 0 ? 1 : 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

const triangleCount = 35;

const triangles = Array.from({ length: triangleCount }).map((_, i) => {
  const size = Math.random() * 16 + 10;

  // spread vertically evenly
  const top = i * 80 + Math.random() * 30;

  // alternate left/right zones (prevents clustering)
  const left =
    i % 3 === 0
      ? Math.random() * 30          // left
      : i % 3 === 1
      ? 35 + Math.random() * 30     // middle
      : 70 + Math.random() * 25;    // right

  const opacity = Math.random() * 0.2 + 0.08;

  return (
    <View
      key={i}
      style={{
        position: 'absolute',
        left: `${left}%`,
        top,
        width: 0,
        height: 0,
        borderLeftWidth: size,
        borderRightWidth: size,
        borderBottomWidth: size * 1.4,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: `rgba(224,123,57,${opacity})`,
      }}
    />
  );
});

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A0A00" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ position: 'relative', flex: 1 }}>
        {triangles}

        {/* ── Hero Banner ── */}
        <View style={styles.heroBanner}>
          
          {/* Pyramid shapes */}
          <View style={styles.heroPyramid1} />
          <View style={styles.heroPyramid2} />
          <View style={styles.heroPyramid3} />

          {/* Top row: location + weather + actions */}
          <View style={styles.heroTopRow}>

            {/* LEFT SIDE (location + weather stacked) */}
            <View>
              <TouchableOpacity
                style={styles.locationPill}
                onPress={() => router.push('/(main)/map' as any)}
              >
                <Text style={styles.locationPillText}>{locationText}</Text>
                <Text style={styles.locationChevron}>›</Text>
              </TouchableOpacity>

              {/* ✅ Weather UNDER location */}
              <View style={{ marginTop: 4 }}>
              {userLocation && (
                <WeatherWidget
                  latitude={userLocation.latitude}
                  longitude={userLocation.longitude}
                />
              )}
              </View>
            </View>

            {/* RIGHT SIDE */}
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.pointsPill}
                onPress={() => router.push('/(main)/rewards' as any)}
              >
                <Text style={styles.pointsPillText}>
                  {userPoints !== null ? userPoints : '—'} Points
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarBtn}
                onPress={() => router.push('/(main)/settings' as any)}
              >
                <Text style={styles.avatarIcon}>Profile</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Hero title */}
          <Text style={styles.heroGreeting}>Good day, explorer</Text>
          <Text style={styles.heroTitle}>{t('planYourTrip')}</Text>


          </View>

          {/* ── Search Bar ── */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                {...{placeholder: t('search')}}
                placeholderTextColor="#C0A882"
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)} activeOpacity={0.85}>
              <Text style={styles.filterIcon}>⚙</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Search Dropdown ── */}
          {filteredSearch.length > 0 && (
            <View style={styles.searchDropdown}>
              {filteredSearch.map(item => (
                <TouchableOpacity key={item.id} style={styles.searchResultItem} onPress={() => openAttraction(item)}>
                  <View style={styles.searchResultLeft}>
                    <Text style={styles.searchResultIcon}>🏛</Text>
                    <View>
                      <Text style={styles.searchResultText}>{item.name}</Text>
                      <Text style={styles.searchResultSub}>{item.city}, Egypt</Text>
                    </View>
                  </View>
                  <Text style={styles.searchResultArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Quick Info Strip: Currency ── */}
          <TouchableOpacity style={styles.infoStrip} onPress={() => setShowCurrency(true)} activeOpacity={0.85}>
            <View style={styles.infoStripLeft}>
              <View style={styles.infoStripIconBox}>
                <Text style={styles.infoStripIconText}>💱</Text>
              </View>
              <View>
                <Text style={styles.infoStripTitle}>Currency Exchange</Text>
                <Text style={styles.infoStripSub}>Live EGP rates · Tap to convert</Text>
              </View>
            </View>
            <Text style={styles.infoStripArrow}>›</Text>
          </TouchableOpacity>

          {/* ── Popular ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Popular Locations</Text>
            </View>
            {activeFilterCount > 0 && (
              <Text style={styles.sectionFilterNote}>{filteredPopular.length} found</Text>
            )}
          </View>
          {filteredPopular.length === 0
            ? <Text style={styles.emptyFilterText}>No popular places match your filters.</Text>
            : <FlatList
                data={filteredPopular}
                keyExtractor={item => String(item.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
                renderItem={({ item }) => <PopularCard item={item} onPress={openAttraction} />}
              />
          }

          {/* ── Nearest ── */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: '#E07B39' }]} />
              <Text style={styles.sectionTitle}>Nearby Places</Text>
            </View>
            {activeFilterCount > 0 && (
              <Text style={styles.sectionFilterNote}>{filteredNearest.length} found</Text>
            )}
          </View>
          {filteredNearest.length === 0
            ? <Text style={styles.emptyFilterText}>No nearby places match your filters.</Text>
            : <FlatList
                data={filteredNearest}
                keyExtractor={item => String(item.id)}
                horizontal={false}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                renderItem={({ item }) => <NearestCard item={item} onPress={openAttraction} />}
              />
          }
        </View> 
      </ScrollView>

      <BottomTab active="Home" />

      {/* ── Modals ── */}
      <CurrencyModal visible={showCurrency} onClose={() => setShowCurrency(false)} />
      <AttractionSheet
        attraction={selectedAttraction}
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        userLocation={coords} // <- your current coords state from expo-location
      />
      <FilterSheet
        visible={showFilter}
        initial={activeFilters}
        onApply={setActiveFilters}
        onClose={() => setShowFilter(false)}
      />
    </SafeAreaView>
  );
}


// ── STYLES — Desert Horizon Egyptian Design ───────────────────────────
const styles = StyleSheet.create({

  // ── Base ──────────────────────────────────────────────────────────
  safeArea:  { flex: 1, backgroundColor: '#FDF8F0' },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },

  // ── Hero Banner ───────────────────────────────────────────────────
  
  heroBanner: {
    backgroundColor: '#1A0A00',
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    marginBottom: 0,
    position: 'relative',
  },

  // Bigger pyramids
  heroPyramid1: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 80,
    borderRightWidth: 80,
    borderBottomWidth: 120,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(224,123,57,0.4)',
    transform: [{ rotate: '-5deg' }],
  },
  heroPyramid2: {
    position: 'absolute',
    bottom: 0,
    right: 40,
    width: 0,
    height: 0,
    borderLeftWidth: 60,
    borderRightWidth: 60,
    borderBottomWidth: 100,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(196,135,58,0.3)',
    transform: [{ rotate: '3deg' }],
  },
  heroPyramid3: {
    position: 'absolute',
    bottom: 0,
    left: 120,
    width: 0,
    height: 0,
    borderLeftWidth: 50,
    borderRightWidth: 50,
    borderBottomWidth: 80,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(240,165,0,0.25)',
  },

  // Hero top row
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 22,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  locationPinIcon: { fontSize: 12 },
  locationPillText: { fontSize: 13, color: '#F5D98B', fontWeight: '600' },
  locationChevron:  { fontSize: 16, color: 'rgba(245,217,139,0.6)', marginLeft: 2 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsPill: {
    backgroundColor: 'rgba(196,135,58,0.25)', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(196,135,58,0.4)',
  },
  pointsPillText: { fontSize: 12, color: '#F5D98B', fontWeight: '800' },
  avatarBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22,
    padding: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarIcon: { fontSize: 14 },

  // Hero text
  heroGreeting: { fontSize: 13, color: 'rgba(245,217,139,0.7)', fontWeight: '500', marginBottom: 4, letterSpacing: 0.5 },
  heroTitle:    { fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginBottom: 16, letterSpacing: -0.8, lineHeight: 36 },

  // Weather chip — inline in hero
  weatherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  weatherChipIcon:  { fontSize: 16 },
  weatherChipTemp:  { fontSize: 15, fontWeight: '800', color: '#FFF' },
  weatherChipDot:   { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  weatherChipLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  // ── Search ────────────────────────────────────────────────────────
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginTop: -22,
    marginBottom: 16, gap: 10,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 30,
    paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#C4873A', shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
    borderWidth: 1, borderColor: '#F0E2C8',
  },
  searchIcon:  { fontSize: 14, marginRight: 10, color: '#C4873A' },
  searchInput: { flex: 1, fontSize: 14, color: '#2C1810', fontWeight: '500' },
  filterBtn: {
    backgroundColor: '#C4873A', borderRadius: 28, padding: 15,
    shadowColor: '#C4873A', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
  },
  filterIcon:      { fontSize: 15, color: '#FFF' },
  filterBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: '#E05C2A', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  // Search dropdown
  searchDropdown: {
    marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    marginBottom: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0E2C8',
  },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#FBF5EB' },
  searchResultLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchResultIcon: { fontSize: 20 },
  searchResultText: { fontSize: 14, fontWeight: '700', color: '#2C1810' },
  searchResultSub:  { fontSize: 12, color: '#A08060', marginTop: 2 },
  searchResultArrow:{ fontSize: 20, color: '#C4873A', fontWeight: '700' },

  // ── Info Strip (Currency) ─────────────────────────────────────────
  infoStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: '#FFF', borderRadius: 20, padding: 16,
    shadowColor: '#C4873A', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
    borderWidth: 1, borderColor: '#F0E2C8',
  },
  infoStripLeft:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoStripIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  infoStripIconText:{ fontSize: 22 },
  infoStripTitle:   { fontSize: 14, fontWeight: '800', color: '#2C1810' },
  infoStripSub:     { fontSize: 12, color: '#A08060', marginTop: 2 },
  infoStripArrow:   { fontSize: 22, color: '#C4873A', fontWeight: '700' },

  // ── Sections ──────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 14, marginTop: 8,
  },
  sectionTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionAccent:     { width: 4, height: 22, borderRadius: 2, backgroundColor: '#C4873A' },
  sectionTitle:      { fontSize: 19, fontWeight: '900', color: '#2C1810', letterSpacing: -0.4 },
  sectionFilterNote: { fontSize: 12, color: '#C4873A', fontWeight: '700' },
  emptyFilterText:   { fontSize: 13, color: '#C0A882', paddingHorizontal: 20, marginBottom: 12, fontStyle: 'italic' },

  // ── Popular Cards — cinematic ─────────────────────────────────────
  popularCard: {
    width: 210, height: 270, borderRadius: 24, overflow: 'hidden',
    marginRight: 14,
    shadowColor: '#1A0A00', shadowOpacity: 0.2, shadowRadius: 14, elevation: 6,
  },
  popularImage:    { width: '100%', height: '100%', position: 'absolute' },
  popularGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(26,10,0,0)',
    // Simulate gradient with border radius
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  popularOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 18,
    backgroundColor: 'rgba(26,10,0,0.62)',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  popularRatingBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(196,135,58,0.9)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  popularRatingText: { fontSize: 11, color: '#FFF', fontWeight: '800' },
  popularName:       { fontSize: 16, fontWeight: '900', color: '#FFF', marginBottom: 8, letterSpacing: -0.3 },
  popularFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  popularPrice:      { fontSize: 12, color: '#F5D98B', fontWeight: '700' },
  popularArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  popularArrowText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // ── Nearest Cards — horizontal list items ─────────────────────────
  nearestCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#C4873A', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
    borderWidth: 1, borderColor: '#F0E2C8',
  },
  nearestImage:   { width: 90, height: 90 },
  nearestInfo:    { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  nearestCategoryDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  nearestName:    { fontSize: 14, fontWeight: '800', color: '#2C1810', marginBottom: 3 },
  nearestCity:    { fontSize: 12, color: '#A08060', fontWeight: '500', marginBottom: 6 },
  nearestFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nearestPrice:   { fontSize: 12, color: '#C4873A', fontWeight: '700' },
  nearestChevron: { fontSize: 24, color: '#DDD0BC', paddingRight: 16, fontWeight: '300' },

  // ── Bottom Tab — floating pill ─────────────────────────────────────
  bottomTabWrap: {
    position: 'absolute', bottom: 20, left: 24, right: 24,
    alignItems: 'center',
  },
  bottomTab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A0A00',
    borderRadius: 40, paddingVertical: 8, paddingHorizontal: 8,
    shadowColor: '#1A0A00', shadowOpacity: 0.35, shadowRadius: 20, elevation: 14,
    gap: 4,
  },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 32, gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#C4873A',
    paddingHorizontal: 18,
  },
  tabIcon:       { fontSize: 17, color: 'rgba(255,255,255,0.45)' },
  tabIconActive: { color: '#FFF' },
  tabLabel:      { fontSize: 12, color: '#FFF', fontWeight: '800', letterSpacing: 0.2 },

  // ── Attraction Sheet ──────────────────────────────────────────────
  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,10,0,0.65)' },
  sheetContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FDF8F0', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: height * 0.88, overflow: 'hidden',
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: '#DDD0BC',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  galleryContainer:  { width, height: 250, position: 'relative' },
  galleryImage:      { width, height: 250 },
  imageDots:         { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6, left: 0, right: 0, justifyContent: 'center' },
  imageDot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  imageDotActive:    { backgroundColor: '#F5D98B', width: 20 },
  sheetCloseBtn:     { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(26,10,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  sheetCloseBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  sheetFavBtn:       { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(26,10,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  sheetFavIcon:      { color: '#FFF', fontSize: 18 },
  categoryBadge:     { position: 'absolute', bottom: 16, left: 16, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  categoryBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'capitalize', letterSpacing: 0.3 },

  sheetContent:      { paddingHorizontal: 22, paddingTop: 18 },
  sheetName:         { fontSize: 24, fontWeight: '900', color: '#2C1810', marginBottom: 6, letterSpacing: -0.5 },
  sheetLocationRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sheetLocationIcon: { fontSize: 13, marginRight: 5 },
  sheetLocationText: { fontSize: 13, color: '#A08060', fontWeight: '600' },
  sheetRatingRow:    { marginBottom: 16 },
  infoPillsRow:      { marginBottom: 18 },
  infoPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, gap: 10,
    borderWidth: 1, borderColor: '#F0E2C8',
    shadowColor: '#C4873A', shadowOpacity: 0.07, shadowRadius: 4, elevation: 1,
  },
  infoPillIcon:  { fontSize: 18 },
  infoPillLabel: { fontSize: 10, color: '#C0A882', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoPillValue: { fontSize: 13, fontWeight: '800', color: '#2C1810', maxWidth: 100 },
  sheetAboutTitle: { fontSize: 16, fontWeight: '800', color: '#2C1810', marginBottom: 8 },
  sheetAboutText:  { fontSize: 14, color: '#6B5040', lineHeight: 23 },

  getRideSection: {
    marginTop: 24, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#F0E2C8',
    shadowColor: '#C4873A', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  getRideHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  getRideTitle:       { fontSize: 15, fontWeight: '800', color: '#2C1810' },
  getRideEstimateBtn: { backgroundColor: '#FFF3E0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#F0E2C8' },
  getRideEstimateBtnText: { fontSize: 12, color: '#C4873A', fontWeight: '800' },
  getRideLoading:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  getRideLoadingText: { fontSize: 13, color: '#A08060' },
  getRideInfo:        { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  getRidePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FBF5EB', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F0E2C8',
  },
  getRidePillIcon:  { fontSize: 12 },
  getRidePillValue: { fontSize: 12, fontWeight: '700', color: '#2C1810' },
  getRideBtns:      { flexDirection: 'row', gap: 10 },
  uberBtn:     { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  uberBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  careemBtn:     { flex: 1, backgroundColor: '#0D9E5B', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  careemBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  getRideNote: { fontSize: 10, color: '#C0A882', textAlign: 'center', marginTop: 10 },

  sheetActions: {
    flexDirection: 'row', paddingHorizontal: 22, paddingVertical: 18,
    paddingBottom: 34, gap: 12,
    borderTopWidth: 1, borderTopColor: '#F0E2C8',
    backgroundColor: '#FDF8F0',
  },
  sheetFavoritesBtn:     { flex: 1, borderWidth: 2, borderColor: '#C4873A', borderRadius: 30, paddingVertical: 15, alignItems: 'center' },
  sheetFavoritesBtnText: { color: '#C4873A', fontSize: 15, fontWeight: '800' },
  sheetPlanBtn:          { flex: 2, backgroundColor: '#1A0A00', borderRadius: 30, paddingVertical: 15, alignItems: 'center', shadowColor: '#1A0A00', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sheetPlanBtnText:      { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Currency modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(26,10,0,0.6)', justifyContent: 'flex-end' },
  currencySheet:  { backgroundColor: '#FDF8F0', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 44 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle:     { fontSize: 18, fontWeight: '900', color: '#2C1810' },
  modalClose:     { fontSize: 18, color: '#A08060', fontWeight: '700' },
  liveBadge:      { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  liveDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#27AE60', marginRight: 7 },
  liveText:       { fontSize: 12, color: '#27AE60', fontWeight: '800' },
  liveDate:       { fontSize: 12, color: '#A08060' },
  currencyLabel:  { fontSize: 11, fontWeight: '800', color: '#A08060', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  currencySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: '#F0E2C8' },
  currencyFlag:          { fontSize: 28 },
  currencySelectorText:  { flex: 1 },
  currencyCode:          { fontSize: 16, fontWeight: '800', color: '#2C1810' },
  currencyName:          { fontSize: 12, color: '#A08060', marginTop: 2 },
  currencySelectorArrow: { fontSize: 14, color: '#A08060' },
  pickerDropdown:   { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#F0E2C8', marginBottom: 12, overflow: 'hidden' },
  pickerItem:       { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10, borderBottomWidth: 1, borderBottomColor: '#FBF5EB' },
  pickerItemActive: { backgroundColor: '#FBF5EB' },
  pickerFlag:       { fontSize: 20 },
  pickerCode:       { fontSize: 13, fontWeight: '800', color: '#2C1810', width: 42 },
  pickerName:       { flex: 1, fontSize: 12, color: '#6B5040' },
  pickerCheck:      { fontSize: 13, color: '#C4873A', fontWeight: '800' },
  amountRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10, borderWidth: 1, borderColor: '#F0E2C8', gap: 10 },
  amountCurrencyCode: { fontSize: 15, fontWeight: '800', color: '#C4873A' },
  amountInput:        { flex: 1, fontSize: 22, fontWeight: '800', color: '#2C1810' },
  convertArrow:       { alignItems: 'center', marginVertical: 8 },
  convertArrowIcon:   { fontSize: 22, color: '#C4873A', fontWeight: '800' },
  resultBox:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A0A00', borderRadius: 18, padding: 16, marginBottom: 10, gap: 12 },
  resultFlag:         { fontSize: 28 },
  resultTextBox:      { flex: 1 },
  resultCode:         { fontSize: 16, fontWeight: '800', color: '#F5D98B' },
  resultName:         { fontSize: 12, color: 'rgba(245,217,139,0.65)', marginTop: 2 },
  resultAmount:       { fontSize: 24, fontWeight: '900', color: '#F5D98B' },
  rateInfo:           { fontSize: 12, color: '#A08060', textAlign: 'center', marginTop: 4 },

  // Filter sheet
  filterSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FDF8F0', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: height * 0.80, overflow: 'hidden', paddingHorizontal: 22 },
  filterHeader:          { flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 18 },
  filterTitle:           { fontSize: 19, fontWeight: '900', color: '#2C1810', flex: 1, letterSpacing: -0.3 },
  filterActiveBadge:     { backgroundColor: '#FFF3E0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
  filterActiveBadgeText: { color: '#C4873A', fontSize: 11, fontWeight: '800' },
  filterCloseBtn:        { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0E2C8', justifyContent: 'center', alignItems: 'center' },
  filterCloseBtnText:    { fontSize: 13, color: '#5C3A1E', fontWeight: '800' },
  filterSectionLabel:    { fontSize: 11, fontWeight: '800', color: '#A08060', letterSpacing: 1, marginBottom: 12, marginTop: 4, textTransform: 'uppercase' },
  filterChipsWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  filterChip:            { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, borderColor: '#DDD0BC', backgroundColor: '#FFF' },
  filterChipText:        { fontSize: 13, color: '#5C3A1E', fontWeight: '600' },
  filterChipTextActive:  { color: '#FFF' },
  filterPriceRow:        { flexDirection: 'row', gap: 10, marginBottom: 22 },
  filterPriceBtn:        { flex: 1, borderRadius: 16, paddingVertical: 11, borderWidth: 1.5, borderColor: '#DDD0BC', alignItems: 'center', backgroundColor: '#FFF' },
  filterPriceBtnActive:  { backgroundColor: '#1A0A00', borderColor: '#1A0A00' },
  filterPriceBtnText:    { fontSize: 13, color: '#5C3A1E', fontWeight: '700' },
  filterPriceBtnTextActive: { color: '#FFF' },
  filterStarRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  filterStar:            { fontSize: 30, color: '#DDD0BC' },
  filterStarActive:      { color: '#F0A500' },
  filterStarLabel:       { fontSize: 13, color: '#A08060', fontWeight: '600', marginLeft: 4 },
  filterActions:         { flexDirection: 'row', gap: 12, paddingVertical: 18, paddingBottom: 34, borderTopWidth: 1, borderTopColor: '#F0E2C8' },
  filterResetBtn:        { flex: 1, borderWidth: 2, borderColor: '#C4873A', borderRadius: 30, paddingVertical: 15, alignItems: 'center' },
  filterResetBtnText:    { color: '#C4873A', fontSize: 15, fontWeight: '800' },
  filterApplyBtn:        { flex: 2, backgroundColor: '#1A0A00', borderRadius: 30, paddingVertical: 15, alignItems: 'center', shadowColor: '#1A0A00', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  filterApplyBtnText:    { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Audio Guide
  audioGuideBox: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 22,
    borderWidth: 1, borderColor: '#F0E2C8',
    shadowColor: '#C4873A', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  audioGuideHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  audioGuideTitle:    { fontSize: 15, fontWeight: '800', color: '#2C1810' },
  langToggle:         { flexDirection: 'row', backgroundColor: '#F0E2C8', borderRadius: 22, padding: 3, gap: 2 },
  langBtn:            { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  langBtnActive:      { backgroundColor: '#1A0A00' },
  langBtnText:        { fontSize: 11, fontWeight: '700', color: '#A08060' },
  langBtnTextActive:  { color: '#F5D98B' },
  audioPlayBtn:       { backgroundColor: '#C4873A', borderRadius: 30, paddingVertical: 13, alignItems: 'center', marginBottom: 8, shadowColor: '#C4873A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  audioPlayBtnActive: { backgroundColor: '#C0392B' },
  audioPlayBtnText:   { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  audioLoadingText:   { fontSize: 12, color: '#A08060', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  audioScriptToggle:  { fontSize: 12, color: '#C4873A', fontWeight: '800', textAlign: 'center', marginTop: 4, marginBottom: 8 },
  audioScriptText:    { fontSize: 13, color: '#6B5040', lineHeight: 21, fontStyle: 'italic' },

  // Unused legacy (kept to avoid TS errors)
  weatherWidget: { display: 'none' },
  weatherIcon:   { display: 'none' },
  weatherTemp:   { display: 'none' },
  weatherLabel:  { display: 'none' },
  floatingCurrencyBtn:      { display: 'none' },
  floatingCurrencyIcon:     { display: 'none' },
  floatingCurrencyTitle:    { display: 'none' },
  floatingCurrencySubtitle: { display: 'none' },
  header:      { display: 'none' },
  locationRow: { display: 'none' },
  locationPin: { display: 'none' },
  locationText: { display: 'none' },
  headerRight:  { display: 'none' },
  pointsBadge:  { display: 'none' },
  pointsText:   { display: 'none' },
});
