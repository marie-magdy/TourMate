// app/(main)/home.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, FlatList, ActivityIndicator,
  StatusBar, Modal, Dimensions, Animated,
  PanResponder, Linking, Platform,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Attraction } from '../../constants/types';
import { useApp } from '../../constants/AppContext';
import * as Location from 'expo-location';
import axios from 'axios';
import AttractionSheet from '../../components/AttractionSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const getWeatherInfo = (code: number): { iconName: MCIconName; iconColor: string; label: string } => {
  if (code === 0)  return { iconName: 'weather-sunny',           iconColor: '#F5A623', label: 'Clear' };
  if (code <= 2)   return { iconName: 'weather-partly-cloudy',   iconColor: '#78909C', label: 'Partly Cloudy' };
  if (code === 3)  return { iconName: 'weather-cloudy',          iconColor: '#90A4AE', label: 'Cloudy' };
  if (code <= 49)  return { iconName: 'weather-fog',             iconColor: '#B0BEC5', label: 'Foggy' };
  if (code <= 59)  return { iconName: 'weather-rainy',           iconColor: '#64B5F6', label: 'Drizzle' };
  if (code <= 69)  return { iconName: 'weather-pouring',         iconColor: '#42A5F5', label: 'Rainy' };
  if (code <= 79)  return { iconName: 'weather-snowy',           iconColor: '#90CAF9', label: 'Snowy' };
  if (code <= 99)  return { iconName: 'weather-lightning-rainy', iconColor: '#5C6BC0', label: 'Stormy' };
  return           { iconName: 'weather-cloudy',                 iconColor: '#90A4AE', label: 'Unknown' };
};

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
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

// Use the same canonical interest keys as the backend INTEREST_CATEGORY_MAP
// Keys are used as filter values; friendly labels are shown in the UI.
const ALL_CATEGORIES = [
  'adventure', 'diving', 'food', 'party', 'history',
  'shopping', 'nature', 'nightlife', 'family', 'culture', 'entertainment'
];

const CATEGORY_LABELS: Record<string, string> = {
  adventure: 'Adventure',
  diving: 'Diving',
  food: 'Food',
  party: 'Party',
  history: 'History',
  shopping: 'Shopping',
  nature: 'Nature',
  nightlife: 'Nightlife',
  family: 'Family',
  culture: 'Culture',
  entertainment: 'Entertainment',
};
const PRICE_PRESETS = [
  { label: 'Any',        max: null },
  { label: '< 100 EGP',  max: 100  },
  { label: '< 300 EGP',  max: 300  },
  { label: '< 600 EGP',  max: 600  },
];

const CITIES = ['Alexandria', 'Cairo', 'Hurghada', 'Luxor', 'Aswan', 'Sharm El Sheikh'];

// ── Filter Sheet ──────────────────────────────────────────────────────
interface FilterState {
  categories: string[];
  maxPrice: number | null;
  minRating: number;
  city?: string;
}

const DEFAULT_FILTERS: FilterState = { categories: [], maxPrice: null, minRating: 0, city: '' };

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
  const [showCityPicker, setShowCityPicker] = useState(false);

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
    (draft.minRating > 0 ? 1 : 0) +
    (draft.city && draft.city.trim() ? 1 : 0);

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
            <MaterialCommunityIcons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

          {/* Category */}
          <Text style={styles.filterSectionLabel}>CATEGORY</Text>
          <View style={[styles.filterChipsWrap, { marginBottom: 8 }]}>
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
                    {CATEGORY_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1))}
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
                <MaterialCommunityIcons
                  name={star <= draft.minRating ? 'star' : 'star-outline'}
                  size={26}
                  color={star <= draft.minRating ? '#FFC107' : '#DDD'}
                />
              </TouchableOpacity>
            ))}
            <Text style={styles.filterStarLabel}>
              {draft.minRating > 0 ? `${draft.minRating}+ stars` : 'Any'}
            </Text>
          </View>
          {/* City */}
          <Text style={styles.filterSectionLabel}>CITY</Text>
          <View style={styles.filterChipsWrap}>
            <TouchableOpacity
              style={[styles.filterChip, { justifyContent: 'center' }]}
              onPress={() => setShowCityPicker(!showCityPicker)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, !draft.city && { color: '#AAA' }]}>{draft.city || 'Select city'}</Text>
            </TouchableOpacity>
          </View>
          {showCityPicker && (
            <View style={{ backgroundColor: '#FFF', borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#F0E2C8', maxHeight: 180 }}>
              <ScrollView>
                {CITIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#FBF5EB' }}
                    onPress={() => { setDraft(prev => ({ ...prev, city: c })); setShowCityPicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontWeight: draft.city === c ? '800' : '600', color: draft.city === c ? '#C4873A' : '#333' }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
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
      <MaterialCommunityIcons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={i <= Math.round(rating) ? color : '#DDD'}
      />
    ))}
    <Text style={{ color: '#888', fontSize: size - 1, marginLeft: 3 }}>{rating}</Text>
  </View>
);


// ── Weather Widget (uses coordinates, NOT city) ─────────────────────
const WeatherWidget: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
  const [weather, setWeather] = useState<{ temp: number; iconName: MCIconName; iconColor: string; label: string } | null>(null);

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
          iconName:  info.iconName,
          iconColor: info.iconColor,
          label:     info.label,
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
      <MaterialCommunityIcons name={weather.iconName} size={16} color={weather.iconColor} />
      <Text style={styles.weatherChipTemp}>{weather.temp}°C</Text>
      <Text style={styles.weatherChipDot}>·</Text>
      <Text style={styles.weatherChipLabel}>{weather.label}</Text>
    </View>
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
          <MaterialCommunityIcons name="star" size={11} color="#FFC107" />
          <Text style={styles.popularRatingText}> {Number(item.rating).toFixed(1)}</Text>
        </View>
        <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.popularFooter}>
          <Text style={styles.popularPrice}>from {convertPrice(item.price_from)}</Text>
          <View style={styles.popularArrow}>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFF" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Nearest Card — horizontal list item ──────────────────────────────
const NearestCard: React.FC<{ item: Attraction; onPress: (item: Attraction) => void }> = ({ item, onPress }) => {
  const { convertPrice } = useApp();
  const firstCategory = parseCategories(item.categories)[0] ?? '';
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
      <MaterialCommunityIcons name="chevron-right" size={22} color="#CCC" />
    </TouchableOpacity>
  );
};

// ── Bottom Tab — floating pill style ──────────────────────────────────
interface TabItem {
  name: string;
  label: string;
  iconDefault: MCIconName;
  iconActive: MCIconName;
  route: string;
}

const TABS: TabItem[] = [
  { name: 'Home',      label: 'Home',   iconDefault: 'home-outline',               iconActive: 'home',                  route: '/(main)/home' },
  { name: 'Plan',      label: 'Plan',   iconDefault: 'calendar-plus-outline',      iconActive: 'calendar-plus',         route: '/(main)/plan' },
  { name: 'Tour Mate', label: 'AI',     iconDefault: 'robot-outline',              iconActive: 'robot',                 route: '/(main)/tourmate-ai' },
  { name: 'Favorites', label: 'Likes',  iconDefault: 'heart-outline',              iconActive: 'heart',                 route: '/(main)/favorites' },
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
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
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

        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.currencySheet}
            >

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Currency Exchange</Text>
            <TouchableOpacity onPress={onClose}><MaterialCommunityIcons name="close" size={22} color="#999" /></TouchableOpacity>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live rate</Text>
            {lastUpdated ? <Text style={styles.liveDate}> · Updated {lastUpdated}</Text> : null}
          </View>
          <Text style={styles.currencyLabel}>From</Text>
          <TouchableOpacity style={styles.currencySelector} onPress={() => setShowPicker(!showPicker)}>
            <MaterialCommunityIcons name="flag-variant" size={24} color="#888" />
            <View style={styles.currencySelectorText}>
              <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
              <Text style={styles.currencyName}>{selectedCurrency.name}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#999" />
          </TouchableOpacity>
          {showPicker && (
            <View style={styles.pickerDropdown}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                {CURRENCIES.map(c => (
                  <TouchableOpacity key={c.code} style={[styles.pickerItem, selectedCurrency.code === c.code && styles.pickerItemActive]} onPress={() => selectCurrency(c)}>
                    <MaterialCommunityIcons name="flag-variant" size={18} color="#888" />
                    <Text style={styles.pickerCode}>{c.code}</Text>
                    <Text style={styles.pickerName}>{c.name}</Text>
                    {selectedCurrency.code === c.code && <MaterialCommunityIcons name="check" size={16} color="#E67E22" />}
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
          <View style={styles.convertArrow}><MaterialCommunityIcons name="arrow-down" size={20} color="#E67E22" /></View>
          <Text style={styles.currencyLabel}>To</Text>
          <View style={styles.resultBox}>
            <MaterialCommunityIcons name="flag-variant" size={24} color="#E67E22" />
            <View style={styles.resultTextBox}>
              <Text style={styles.resultCode}>EGP</Text>
              <Text style={styles.resultName}>Egyptian Pound</Text>
            </View>
            {loading ? <ActivityIndicator size="small" color="#E67E22" /> : <Text style={styles.resultAmount}>{converted}</Text>}
          </View>
          {rate && <Text style={styles.rateInfo}>1 {selectedCurrency.code} = {rate.toFixed(4)} EGP</Text>}

          </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
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
  const [showLocationError, setShowLocationError] = useState(false);

  // Filter state (client-side filters for Popular/Nearest; server-side full results moved to dedicated screen)
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilter, setShowFilter]       = useState(false);

  // Bottom sheet state
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const [showSheet, setShowSheet]                   = useState(false);

  // User points state
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

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
        const coordsNow = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coordsNow);

        const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: { format: 'json', lat: loc.coords.latitude, lon: loc.coords.longitude },
          headers: { 'User-Agent': 'TourMateApp/1.0', 'Accept-Language': 'en' },
          timeout: 10000,
        });

        const city = res.data.address.city || res.data.address.town || res.data.address.village || '';
        const country = res.data.address.country || '';
        setLocationText(`${city}${city && country ? ', ' : ''}${country}` || 'Unknown');
        fetchData(city, coordsNow);

      } catch {
          setLocationText('Location unavailable');
          setNearest([]); // clear nearest
          setShowLocationError(true); // show a small banner
          fetchData('Alexandria', null); // still load something
      }
    })();
  }, []);

  // useEffect(() => { fetchData(); }, []);

  const fetchData = async (
    city: string,
    coordsOverride?: { latitude: number; longitude: number } | null,
  ) => {
    try {
      const raw = await AsyncStorage.getItem('user');
      const storedUser = raw ? JSON.parse(raw) : null;
      const loadedUserId = storedUser?.id ?? 1;
      setUserId(loadedUserId);

      const loc = coordsOverride ?? userLocation;
      const nearUrl = (() => {
        const base = `${API_BASE}/attractions/nearest`;
        const u = new URL(base);
        if (city) u.searchParams.set('city', city);
        if (loc?.latitude != null && loc?.longitude != null) {
          u.searchParams.set('lat', String(loc.latitude));
          u.searchParams.set('lon', String(loc.longitude));
        }
        return u.toString();
      })();

      const [popResult, nearResult, pointsResult] = await Promise.allSettled([
        fetch(`${API_BASE}/attractions/popular`).then(r => r.json()),
        fetch(nearUrl).then(r => r.json()),
        fetch(`${API_BASE}/points/${loadedUserId}`).then(r => r.json()),
      ]);

      if (popResult.status === 'fulfilled')    setPopular(popResult.value.data ?? []);
      if (nearResult.status === 'fulfilled')   setNearest(nearResult.value.data ?? []);
      if (pointsResult.status === 'fulfilled' && pointsResult.value.success)
        setUserPoints(pointsResult.value.data.points);
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.length < 2) { setSearchResults([]); return; }
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

  // Filters are applied only on the dedicated Filtered Results screen.
  // Home uses the raw lists so the main UI is unchanged by active filters.

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
                <MaterialCommunityIcons name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
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
              <MaterialCommunityIcons name="magnify" size={18} color="#C0A882" />
              <TextInput
                style={styles.searchInput}
                {...{placeholder: t('search')}}
                placeholderTextColor="#C0A882"
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)} activeOpacity={0.85}>
              <MaterialCommunityIcons name="tune-variant" size={18} color="#FFF" />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Search Dropdown ── */}
          {searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map(item => (
                <TouchableOpacity key={item.id} style={styles.searchResultItem} onPress={() => openAttraction(item)}>
                  <View style={styles.searchResultLeft}>
                    <MaterialCommunityIcons name="map-marker-radius" size={18} color="#E67E22" />
                    <View>
                      <Text style={styles.searchResultText}>{item.name}</Text>
                      <Text style={styles.searchResultSub}>{item.city}, Egypt</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#CCC" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Location Error Banner ── */}
          {showLocationError && (
            <TouchableOpacity
              style={styles.locationErrorBanner}
              onPress={() => {
                setShowLocationError(false);
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                  .then(loc => {
                    setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                  })
                  .catch(() => setShowLocationError(true));
              }}
            >
              <View style={{flexDirection:'row', alignItems:'center', gap:6, justifyContent:'center'}}>
                <MaterialCommunityIcons name="alert" size={12} color="#C4873A" />
                <Text style={styles.locationErrorText}>Showing Alexandria — tap to use your location</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Quick Info Strip: Currency ── */}
          <TouchableOpacity style={styles.infoStrip} onPress={() => setShowCurrency(true)} activeOpacity={0.85}>
            <View style={styles.infoStripLeft}>
              <View style={styles.infoStripIconBox}>
                <MaterialCommunityIcons name="swap-horizontal" size={22} color="#E67E22" />
              </View>
              <View>
                <Text style={styles.infoStripTitle}>Currency Exchange</Text>
                <Text style={styles.infoStripSub}>Live EGP rates · Tap to convert</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCC" />
          </TouchableOpacity>

          {/* ── Popular ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Popular Locations</Text>
            </View>
            {activeFilterCount > 0 && (
              <Text style={styles.sectionFilterNote}>{popular.length} found</Text>
            )}
          </View>
          {popular.length === 0
            ? <Text style={styles.emptyFilterText}>No popular places available.</Text>
            : <FlatList
                data={popular}
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
              <Text style={styles.sectionFilterNote}>{nearest.length} found</Text>
            )}
          </View>
          {nearest.length === 0
            ? <Text style={styles.emptyFilterText}>No nearby places available.</Text>
            : <FlatList
                data={nearest}
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
        userLocation={userLocation}
        userId={userId}
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
      <FilterSheet
        visible={showFilter}
        initial={activeFilters}
        onApply={(f: FilterState) => {
          setActiveFilters(f);
          // Navigate to the dedicated filtered results page with query params
          const params = new URLSearchParams();
          if (f.categories.length > 0) params.set('categories', f.categories.join(','));
          if (f.maxPrice !== null) params.set('maxPrice', String(f.maxPrice));
          if (f.minRating > 0) params.set('minRating', String(f.minRating));
          if (f.city && f.city.trim()) params.set('city', f.city.trim());
          const qs = params.toString();
          const path = `/(main)/filtered-results${qs ? `?${qs}` : ''}`;
          router.push(path as any);
        }}
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
    flexDirection: 'row', alignItems: 'center', gap: 3,
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

  locationErrorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F0E2C8',
  },
  locationErrorText: {
    fontSize: 12,
    color: '#C4873A',
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Bottom Tab — floating pill ─────────────────────────────────────
  bottomTabWrap: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    alignItems: 'center',
  },
  bottomTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0A00',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#1A0A00',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    width: '100%',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 20,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: '#C4873A',
  },
  tabLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFF',
    fontWeight: '800',
  },

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
  infoPillValue: { fontSize: 13, fontWeight: '800', color: '#2C1810', maxWidth: 160, flexWrap: 'wrap' },
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
  uberBtn:     { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  uberBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  careemBtn:     { flex: 1, backgroundColor: '#0D9E5B', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
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
  filterStarRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
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