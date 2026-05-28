// components/AttractionSheet.tsx
// Shared full-featured attraction bottom sheet (photo gallery, audio guide, Get There, Uber/Careem)
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Modal, Animated, Dimensions, ActivityIndicator,
  Linking, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Attraction } from '../constants/types';
import { useApp } from '../constants/AppContext';

const { width, height } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api`;

// ── Safely parse categories ───────────────────────────────────────────
export const parseCategories = (cats: any): string[] => {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c: string) => c.toLowerCase());
  if (typeof cats === 'string') {
    return cats.replace(/[{}]/g, '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

export const CATEGORY_COLORS: Record<string, string> = {
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

// ── Star Rating ───────────────────────────────────────────────────────
export const StarRating: React.FC<{ rating: number; size?: number; color?: string }> = ({
  rating, size = 11, color = '#FFC107',
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
    {[1,2,3,4,5].map(i => (
      <MaterialCommunityIcons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={color}
      />
    ))}
  </View>
);

// ── Props ─────────────────────────────────────────────────────────────
interface AttractionSheetProps {
  attraction: Attraction | null;
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  userId?: number | null;
  onRemove?: (id: number) => void;
  onGetDirections?: (destination: { latitude: number; longitude: number; name: string }) => void;
}

const AttractionSheet: React.FC<AttractionSheetProps> = ({ attraction, visible, onClose, userLocation, userId: propUserId, onRemove, onGetDirections }) => {
  const { t, convertPrice } = useApp();
  const slideAnim   = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [isFavorited, setIsFavorited] = useState(false);
  const [images, setImages]           = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  // const [audioLang, setAudioLang]       = useState<'en' | 'ar'>('en');
  // const [audioLoading, setAudioLoading] = useState(false);
  // const [audioPlaying, setAudioPlaying] = useState(false);
  // const [audioScript, setAudioScript]   = useState('');
  // const [showScript, setShowScript]     = useState(false);
  // const soundRef = useRef<any>(null);

  const [rideInfo, setRideInfo]       = useState<{ distance: string; duration: string; fare: string } | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const [userId, setUserId]           = useState<number | null>(null);

  useEffect(() => {
    if (visible && attraction) {
      fetchImages(attraction.id);
      checkFavoriteStatus(attraction.id);
      Animated.parallel([
        Animated.spring(slideAnim,  { toValue: 0,      damping: 18, stiffness: 120, useNativeDriver: true }),
        Animated.timing(opacityAnim,{ toValue: 1,      duration: 200,              useNativeDriver: true }),
      ]).start();
    } else {
      // stopAudio();
      // setAudioScript('');
      // setShowScript(false);
      setRideInfo(null);
      Animated.parallel([
        Animated.timing(slideAnim,  { toValue: height, duration: 280, useNativeDriver: true }),
        Animated.timing(opacityAnim,{ toValue: 0,      duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, attraction]);

  const checkFavoriteStatus = async (attractionId: number) => {
    try {
      let currentUserId = propUserId;
      if (!currentUserId) {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const storedUser = JSON.parse(raw);
          currentUserId = storedUser.id;
          setUserId(currentUserId);
        }
      }
      
      if (!currentUserId) {
        setIsFavorited(false);
        return;
      }
      
      const res  = await fetch(`${API_BASE}/attractions/favorites/${currentUserId}`);
      const data = await res.json();
      const ids: number[] = (data.data ?? []).map((a: any) => Number(a.id));
      setIsFavorited(ids.includes(Number(attractionId)));
    } catch (err) {
      console.error('Favorite status check error:', err);
      setIsFavorited(false);
    }
  };

  // useEffect(() => {
  //   stopAudio();
  //   setAudioScript('');
  //   setShowScript(false);
  // }, [audioLang]);

  // const stopAudio = async () => {
  //   if (soundRef.current) {
  //     try {
  //       await soundRef.current.stopAsync();
  //       await soundRef.current.unloadAsync();
  //     } catch {}
  //     soundRef.current = null;
  //   }
  //   setAudioPlaying(false);
  // };

  const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

  const estimateFare = (distanceMeters: number) => {
    const km  = distanceMeters / 1000;
    const egp = Math.max(30, Math.round(km * 5));
    return `~${egp}–${egp + 20} EGP`;
  };

  const fetchAttractionCoordinates = async (name: string, city?: string) => {
    try {
      const query = city ? `${name}, ${city}` : name;
      const res   = await axios.get('https://nominatim.openstreetmap.org/search', {
        params:  { q: query, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'TourMateApp/1.0 (tourmate@gmail.com)' },
      });
      if (res.data?.length > 0) {
        return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  };

  const fetchRideInfo = async () => {
    if (!attraction || rideInfo || !userLocation) return;
    setRideLoading(true);
    try {
      const origin    = { lat: userLocation.latitude, lon: userLocation.longitude };
      const destCoord = await fetchAttractionCoordinates(attraction.name, attraction.city);
      if (!destCoord) {
        setRideInfo({ distance: 'Varies', duration: 'Varies', fare: '~30–80 EGP' });
        setRideLoading(false);
        return;
      }
      const url  = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lon}&destinations=${destCoord.lat},${destCoord.lon}&mode=driving&key=${GOOGLE_MAPS_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      const element = data.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK') {
        setRideInfo({
          distance: element.distance.text,
          duration: element.duration.text,
          fare:     estimateFare(element.distance.value),
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
      const origin = { lat: userLocation.latitude, lon: userLocation.longitude };
      const dest   = await fetchAttractionCoordinates(attraction.name, attraction.city);
      const uberUrl = dest
        ? `uber://?action=setPickup&pickup[latitude]=${origin.lat}&pickup[longitude]=${origin.lon}&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[nickname]=${encodeURIComponent(attraction.name)}`
        : `uber://`;
      const canOpen = await Linking.canOpenURL(uberUrl);
      if (canOpen) {
        Linking.openURL(uberUrl);
      } else {
        const storeUrl = Platform.OS === 'ios'
          ? 'itms-apps://itunes.apple.com/app/id368677368'
          : 'https://play.google.com/store/apps/details?id=com.ubercab';
        Linking.openURL(storeUrl);
      }
    } catch (err) {
      console.warn('Failed to open Uber:', err);
    }
  };

  const openCareem = async () => {
    if (!attraction || !userLocation) return;
    try {
      const origin = { lat: userLocation.latitude, lon: userLocation.longitude };
      const dest   = await fetchAttractionCoordinates(attraction.name, attraction.city);
      const careemUrl = dest
        ? `careem://ride?pickup_lat=${origin.lat}&pickup_lng=${origin.lon}&dropoff_lat=${dest.lat}&dropoff_lng=${dest.lon}&dropoff_name=${encodeURIComponent(attraction.name)}`
        : `careem://`;
      const canOpen = await Linking.canOpenURL(careemUrl);
      if (canOpen) {
        Linking.openURL(careemUrl);
      } else {
        const storeUrl = Platform.OS === 'ios'
          ? 'itms-apps://itunes.apple.com/app/id592978487'
          : 'https://play.google.com/store/apps/details?id=com.careem.acma';
        Linking.openURL(storeUrl);
      }
    } catch (err) {
      console.warn('Failed to open Careem:', err);
    }
  };

  // Convert Google Drive share links to direct-load URLs
  const toDirect = (url: string | undefined | null): string | null => {
    if (!url) return null;
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return url;
  };

  const fetchImages = async (id: number) => {
    try {
      const res  = await fetch(`${API_BASE}/attractions/${id}/images`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setImages(data.data.map((img: any) => img.image_url).filter(Boolean));
      } else {
        // Fall back to primary_image, then image_url (converting Drive links)
        const fallback = toDirect(attraction?.primary_image) ?? toDirect(attraction?.image_url);
        setImages(fallback ? [fallback] : []);
      }
      setActiveImage(0);
    } catch {
      const fallback = toDirect(attraction?.primary_image) ?? toDirect(attraction?.image_url);
      setImages(fallback ? [fallback] : []);
    }
  };

  const toggleFavorite = async () => {
    let currentUserId = propUserId;
    if (!currentUserId) {
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        const storedUser = JSON.parse(raw);
        currentUserId = storedUser.id;
        setUserId(currentUserId);
      }
    }
    
    if (!currentUserId) {
      alert('Please log in first');
      return;
    }

    const optimistic = !isFavorited;
    setIsFavorited(optimistic);
    try {
      const res  = await fetch(`${API_BASE}/attractions/${attraction?.id}/favorite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: currentUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setIsFavorited(data.favorited);
        // If unfavorited and onRemove provided, call it and close
        if (!data.favorited && !optimistic && onRemove && attraction) {
          onRemove(attraction.id);
          onClose();
        }
      }
    } catch {
      setIsFavorited(!optimistic);
    }
  };

  // const handleAudioGuide = async () => {
  //   if (!attraction) return;
  //   if (audioPlaying) { await stopAudio(); return; }
  //   setAudioLoading(true);
  //   try {
  //     await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  //     const res  = await fetch(`${API_BASE}/tts`, {
  //       method:  'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body:    JSON.stringify({
  //         name:          attraction.name,
  //         city:          attraction.city,
  //         category:      parseCategories(attraction.categories)[0] ?? '',
  //         description:   attraction.description,
  //         price_from:    attraction.price_from,
  //         opening_hours: attraction.opening_hours,
  //         language:      audioLang,
  //       }),
  //     });
  //     const data = await res.json();
  //     if (!data.success) throw new Error('TTS failed');
  //     setAudioScript(data.script);
  //     const { sound } = await Audio.Sound.createAsync(
  //       { uri: `data:audio/mpeg;base64,${data.audio}` },
  //       { shouldPlay: true }
  //     );
  //     soundRef.current = sound;
  //     setAudioPlaying(true);
  //     sound.setOnPlaybackStatusUpdate((status: any) => {
  //       if (status.didJustFinish) {
  //         setAudioPlaying(false);
  //         soundRef.current = null;
  //       }
  //     });
  //   } catch (err) {
  //     console.error('Audio guide error:', err);
  //   } finally {
  //     setAudioLoading(false);
  //   }
  // };

  if (!attraction) return null;

  const firstCategory = parseCategories(attraction.categories)[0] ?? '';
  const categoryColor = CATEGORY_COLORS[firstCategory] ?? '#E67E22';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ss.sheetBackdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[ss.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
        <View style={ss.sheetHandle} />

        {/* Image Gallery */}
        <View style={ss.galleryContainer}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {(images.length > 0
              ? images.map(u => toDirect(u) ?? u)
              : [toDirect(attraction.primary_image) ?? toDirect(attraction.image_url) ?? '']
            ).map((img, i) => (
              img ? (
                <Image key={i} source={{ uri: img }} style={ss.galleryImage} resizeMode="cover" />
              ) : (
                <View key={i} style={[ss.galleryImage, { backgroundColor: '#F0E2C8', justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialCommunityIcons name="image-off-outline" size={48} color="#C4873A" />
                </View>
              )
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={ss.imageDots}>
              {images.map((_, i) => (
                <View key={i} style={[ss.imageDot, i === activeImage && ss.imageDotActive]} />
              ))}
            </View>
          )}
          <TouchableOpacity style={ss.sheetCloseBtn} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={ss.sheetFavBtn} onPress={toggleFavorite}>
            <MaterialCommunityIcons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={22} color={isFavorited ? '#E74C3C' : '#FFF'}
            />
          </TouchableOpacity>
          <View style={[ss.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={ss.categoryBadgeText}>{firstCategory}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={ss.sheetContent} showsVerticalScrollIndicator={false}>
          <Text style={ss.sheetName}>{attraction.name}</Text>
          <View style={ss.sheetLocationRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#E67E22" style={{ marginRight: 4 }} />
            <Text style={ss.sheetLocationText}>{attraction.city}, Egypt</Text>
          </View>
          <View style={ss.sheetRatingRow}>
            <StarRating rating={Number(attraction.rating)} size={14} />
          </View>

          {/* Info pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.infoPillsRow}>
            <View style={ss.infoPill}>
              <MaterialCommunityIcons name="cash" size={22} color="#E67E22" />
              <View>
                <Text style={ss.infoPillLabel}>{t('priceFrom')}</Text>
                <Text style={ss.infoPillValue}>{convertPrice(attraction.price_from)}</Text>
              </View>
            </View>
            <View style={ss.infoPill}>
              <MaterialCommunityIcons name="clock-outline" size={22} color="#E67E22" />
              <View>
                <Text style={ss.infoPillLabel}>{t('hours')}</Text>
                <Text style={ss.infoPillValue}>{attraction.opening_hours ?? t('seeWebsite')}</Text>
              </View>
            </View>
            <View style={ss.infoPill}>
              <MaterialCommunityIcons name="tag-outline" size={22} color="#E67E22" />
              <View>
                <Text style={ss.infoPillLabel}>{t('category')}</Text>
                <Text style={[ss.infoPillValue, { textTransform: 'capitalize' }]}>
                  {parseCategories(attraction.categories).join(', ') || '—'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Audio Guide
          <View style={ss.audioGuideBox}>
            <View style={ss.audioGuideHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="headphones" size={18} color="#1A1A1A" />
                <Text style={ss.audioGuideTitle}>Audio Guide</Text>
              </View>
              <View style={ss.langToggle}>
                <TouchableOpacity
                  style={[ss.langBtn, audioLang === 'en' && ss.langBtnActive]}
                  onPress={() => setAudioLang('en')} activeOpacity={0.8}
                >
                  <Text style={[ss.langBtnText, audioLang === 'en' && ss.langBtnTextActive]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ss.langBtn, audioLang === 'ar' && ss.langBtnActive]}
                  onPress={() => setAudioLang('ar')} activeOpacity={0.8}
                >
                  <Text style={[ss.langBtnText, audioLang === 'ar' && ss.langBtnTextActive]}>AR</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[ss.audioPlayBtn, audioPlaying && ss.audioPlayBtnActive]}
              onPress={handleAudioGuide} activeOpacity={0.85} disabled={audioLoading}
            >
              {audioLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name={audioPlaying ? 'stop' : 'play'} size={16} color="#FFF" />
                  <Text style={ss.audioPlayBtnText}>{audioPlaying ? 'Stop' : 'Play Guide'}</Text>
                </View>
              )}
            </TouchableOpacity>
            {audioLoading && (
              <Text style={ss.audioLoadingText}>
                {audioLang === 'ar' ? 'جاري توليد الدليل الصوتي...' : 'Generating your audio guide...'}
              </Text>
            )}
            {audioScript.length > 0 && (
              <TouchableOpacity onPress={() => setShowScript(p => !p)} activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name={showScript ? 'chevron-up' : 'chevron-down'} size={16} color="#E67E22" />
                <Text style={ss.audioScriptToggle}>{showScript ? 'Hide script' : 'Show script'}</Text>
              </TouchableOpacity>
            )}
            {showScript && audioScript.length > 0 && (
              <Text style={[ss.audioScriptText, audioLang === 'ar' && { textAlign: 'right' }]}>
                {audioScript}
              </Text>
            )}
          </View> */}

          {/* Description */}
          <Text style={ss.sheetAboutTitle}>{t('about')}</Text>
          <Text style={ss.sheetAboutText}>{attraction.description}</Text>

          {/* Get There */}
          <View style={ss.getRideSection}>
            <View style={ss.getRideHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="car" size={18} color="#1A1A1A" />
                <Text style={ss.getRideTitle}>Get There</Text>
              </View>
              {!rideInfo && !rideLoading && (
                <TouchableOpacity style={ss.getRideEstimateBtn} onPress={fetchRideInfo}>
                  <Text style={ss.getRideEstimateBtnText}>Check ride</Text>
                </TouchableOpacity>
              )}
            </View>
            {rideLoading && (
              <View style={ss.getRideLoading}>
                <ActivityIndicator size="small" color="#E67E22" />
                <Text style={ss.getRideLoadingText}>Estimating ride...</Text>
              </View>
            )}
            {rideInfo && !rideLoading && (
              <View style={ss.getRideInfo}>
                <View style={ss.getRidePill}>
                  <MaterialCommunityIcons name="map-marker" size={15} color="#E67E22" />
                  <Text style={ss.getRidePillValue}>{rideInfo.distance}</Text>
                </View>
                <View style={ss.getRidePill}>
                  <MaterialCommunityIcons name="timer-outline" size={15} color="#E67E22" />
                  <Text style={ss.getRidePillValue}>{rideInfo.duration}</Text>
                </View>
                <View style={ss.getRidePill}>
                  <MaterialCommunityIcons name="cash" size={15} color="#E67E22" />
                  <Text style={ss.getRidePillValue}>{rideInfo.fare}</Text>
                </View>
              </View>
            )}
            <View style={ss.getRideBtns}>
              <TouchableOpacity
                style={[ss.uberBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={openUber} activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="car" size={16} color="#FFF" />
                <Text style={ss.uberBtnText}>Uber</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ss.careemBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={openCareem} activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="car" size={16} color="#FFF" />
                <Text style={ss.careemBtnText}>Careem</Text>
              </TouchableOpacity>
            </View>
            <Text style={ss.getRideNote}>App installed → opens with destination pre-filled · Not installed → download from store</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Get Directions */}
        <View style={ss.sheetActions}>
          <TouchableOpacity
            style={ss.directionsBtn}
            activeOpacity={0.85}
            onPress={() => {
              onGetDirections?.({
                latitude: parseFloat(String(attraction.latitude)),
                longitude: parseFloat(String(attraction.longitude)),
                name: attraction.name,
              });
            }}
          >
            <MaterialCommunityIcons name="directions" size={20} color="#FFF" />
            <Text style={ss.directionsBtnText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

export default AttractionSheet;

// ── Styles (exported as sheetStyles for callers that need them) ────────
export const sheetStyles = StyleSheet.create({
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
  sheetFavBtn:       { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(26,10,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  categoryBadge:     { position: 'absolute', bottom: 16, left: 16, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  categoryBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'capitalize', letterSpacing: 0.3 },
  sheetContent:      { paddingHorizontal: 22, paddingTop: 18 },
  sheetName:         { fontSize: 24, fontWeight: '900', color: '#2C1810', marginBottom: 6, letterSpacing: -0.5 },
  sheetLocationRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
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
  infoPillLabel: { fontSize: 10, color: '#C0A882', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoPillValue: { fontSize: 13, fontWeight: '800', color: '#2C1810', maxWidth: 160, flexWrap: 'wrap' },
  sheetAboutTitle: { fontSize: 16, fontWeight: '800', color: '#2C1810', marginBottom: 8 },
  sheetAboutText:  { fontSize: 14, color: '#6B5040', lineHeight: 23 },
  // audioGuideBox: {
  //   marginBottom: 22, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
  //   borderWidth: 1, borderColor: '#F0E2C8',
  //   shadowColor: '#C4873A', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  // },
  // audioGuideHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  // audioGuideTitle:    { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  // langToggle:         { flexDirection: 'row', gap: 6 },
  // langBtn:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#DDD' },
  // langBtnActive:      { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  // langBtnText:        { fontSize: 12, fontWeight: '700', color: '#888' },
  // langBtnTextActive:  { color: '#FFF' },
  // audioPlayBtn:       { backgroundColor: '#E67E22', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  // audioPlayBtnActive: { backgroundColor: '#C0392B' },
  // audioPlayBtnText:   { color: '#FFF', fontWeight: '800', fontSize: 14 },
  // audioLoadingText:   { fontSize: 12, color: '#A08060', textAlign: 'center', marginBottom: 6 },
  // audioScriptToggle:  { fontSize: 12, color: '#E67E22', fontWeight: '700' },
  // audioScriptText:    { fontSize: 13, color: '#5A3E2B', lineHeight: 21, marginTop: 10 },
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
  getRidePillValue: { fontSize: 12, fontWeight: '700', color: '#2C1810' },
  getRideBtns:      { flexDirection: 'row', gap: 10 },
  uberBtn:          { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  uberBtnText:      { color: '#FFF', fontWeight: '800', fontSize: 14 },
  careemBtn:        { flex: 1, backgroundColor: '#0D9E5B', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  careemBtnText:    { color: '#FFF', fontWeight: '800', fontSize: 14 },
  getRideNote:      { fontSize: 10, color: '#C0A882', textAlign: 'center', marginTop: 10 },
  sheetActions: {
    paddingHorizontal: 22, paddingVertical: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: '#F0E2C8', backgroundColor: '#FDF8F0',
  },
  directionsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1A0A00', borderRadius: 30, paddingVertical: 15,
    shadowColor: '#1A0A00', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  directionsBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});

// Internal alias so JSX above doesn't need the long name
const ss = sheetStyles;
