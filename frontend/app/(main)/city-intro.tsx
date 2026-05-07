// app/(main)/city-intro.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, Dimensions, Linking, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../constants/AppContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import DesertTriangles from '../../components/DesertTriangles';
import { Theme } from '../../constants/theme';
import { useBookingStore } from '@/store/bookingStore';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const { width } = Dimensions.get('window');



// ── Airport codes per city ────────────────────────────────────────────
const CITY_AIRPORTS: Record<string, { code: string; name: string }> = {
  'Hurghada':        { code: 'HRG', name: 'Hurghada International' },
  'Cairo':           { code: 'CAI', name: 'Cairo International' },
  'Alexandria':      { code: 'HBE', name: 'Borg El Arab' },
  'Luxor':           { code: 'LXR', name: 'Luxor International' },
  'Aswan':           { code: 'ASW', name: 'Aswan International' },
  'Sharm El Sheikh': { code: 'SSH', name: 'Sharm El Sheikh International' },
};

// ── Departure cities ──────────────────────────────────────────────────
const DEPARTURE_CITIES = [
  { city: 'Alexandria', code: 'HBE' },
  { city: 'Cairo',      code: 'CAI' },
  { city: 'Dubai',      code: 'DXB' },
  { city: 'London',     code: 'LHR' },
  { city: 'Riyadh',     code: 'RUH' },
  { city: 'Kuwait',     code: 'KWI' },
];

// ── Flight booking platforms ──────────────────────────────────────────
interface FlightPlatform {
  id: string;
  name: string;
  tagline: string;
  rating: number;
  reviews: string;
  badge: string;
  badgeColor: string;
  icon: MCIconName;
  iconColor: string;
  bgColor: string;
  buildUrl: (from: string, to: string, depart: string, ret: string) => string;
}

const FLIGHT_PLATFORMS: FlightPlatform[] = [
  {
    id: 'google_flights',
    name: 'Google Flights',
    tagline: 'Best price comparison & date flexibility',
    rating: 4.8,
    reviews: '2.1M',
    badge: '#1 Recommended',
    badgeColor: '#E67E22',
    icon: 'google',
    iconColor: '#4285F4',
    bgColor: '#EEF4FF',
    buildUrl: (from, to, depart, ret) =>
      `https://www.google.com/travel/flights?q=Flights%20from%20${from}%20to%20${to}%20departing%20${depart}%20returning%20${ret}`,
  },
  {
    id: 'skyscanner',
    name: 'Skyscanner',
    tagline: 'Cheapest month view & flexible search',
    rating: 4.7,
    reviews: '1.8M',
    badge: 'Best Deals',
    badgeColor: '#0770E3',
    icon: 'airplane-search',
    iconColor: '#0770E3',
    bgColor: '#EFF6FF',
    buildUrl: (from, to, depart, ret) =>
      `https://www.skyscanner.com/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${depart.replace(/-/g, '')}/${ret.replace(/-/g, '')}/`,
  },
  {
    id: 'kayak',
    name: 'Kayak',
    tagline: 'Price alerts & hacker fare bundles',
    rating: 4.6,
    reviews: '980K',
    badge: 'Price Alerts',
    badgeColor: '#FF690F',
    icon: 'tag-search',
    iconColor: '#FF690F',
    bgColor: '#FFF4EE',
    buildUrl: (from, to, depart, ret) =>
      `https://www.kayak.com/flights/${from}-${to}/${depart}/${ret}`,
  },
  {
    id: 'expedia',
    name: 'Expedia',
    tagline: 'Bundle flight + hotel for extra savings',
    rating: 4.5,
    reviews: '1.2M',
    badge: 'Bundle & Save',
    badgeColor: '#1B2F80',
    icon: 'package-variant',
    iconColor: '#1B2F80',
    bgColor: '#F0F1FA',
    buildUrl: (from, to, depart, ret) =>
      `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=from%3A${from}%2Cto%3A${to}%2Cdeparture%3A${depart}&leg2=from%3A${to}%2Cto%3A${from}%2Cdeparture%3A${ret}`,
  },
];

// ── Hotel booking platforms ───────────────────────────────────────────
interface HotelPlatform {
  id: string;
  name: string;
  tagline: string;
  rating: number;
  reviews: string;
  badge: string;
  badgeColor: string;
  icon: MCIconName;
  iconColor: string;
  bgColor: string;
  buildUrl: (city: string, checkin: string, checkout: string) => string;
}

const HOTEL_PLATFORMS: HotelPlatform[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    tagline: 'Largest selection, free cancellation options',
    rating: 4.8,
    reviews: '3.5M',
    badge: '#1 Worldwide',
    badgeColor: '#003580',
    icon: 'bed',
    iconColor: '#003580',
    bgColor: '#EEF3FF',
    buildUrl: (city, checkin, checkout) =>
      `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&group_adults=2`,
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    tagline: 'Unique stays, apartments & villas',
    rating: 4.7,
    reviews: '2.2M',
    badge: 'Unique Stays',
    badgeColor: '#FF5A5F',
    icon: 'home-heart',
    iconColor: '#FF5A5F',
    bgColor: '#FFF0F0',
    buildUrl: (city, checkin, checkout) =>
      `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes?checkin=${checkin}&checkout=${checkout}&adults=2`,
  },
  {
    id: 'hotels_com',
    name: 'Hotels.com',
    tagline: 'Earn free nights with rewards program',
    rating: 4.6,
    reviews: '1.1M',
    badge: 'Earn Rewards',
    badgeColor: '#C8102E',
    icon: 'star-circle',
    iconColor: '#C8102E',
    bgColor: '#FFF0F2',
    buildUrl: (city, checkin, checkout) =>
      `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(city)}&q-check-in=${checkin}&q-check-out=${checkout}&q-rooms=1&q-room-0-adults=2`,
  },
  {
    id: 'agoda',
    name: 'Agoda',
    tagline: 'Best rates in Middle East & Africa',
    rating: 4.5,
    reviews: '890K',
    badge: 'Best in Region',
    badgeColor: '#5E2750',
    icon: 'map-marker-star',
    iconColor: '#5E2750',
    bgColor: '#F6EEF8',
    buildUrl: (city, checkin, checkout) =>
      `https://www.agoda.com/search?city=${encodeURIComponent(city)}&checkIn=${checkin}&checkOut=${checkout}&rooms=1&adults=2`,
  },
];

// ── Types for booked details ──────────────────────────────────────────
interface BookedFlightDetails {
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  bookingUrl: string;
}

interface BookedHotelDetails {
  name: string;
  checkIn: string;
  checkOut: string;
  pricePerNight: string;
  bookingUrl: string;
}

// ── Stars component ───────────────────────────────────────────────────
const Stars: React.FC<{ count: number; size?: number }> = ({ count, size = 12 }) => (
  <View style={{ flexDirection: 'row', gap: 1 }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <MaterialCommunityIcons
        key={i}
        name={i < Math.floor(count) ? 'star' : i < count ? 'star-half-full' : 'star-outline'}
        size={size}
        color={i < count ? '#FFC107' : '#DDD'}
      />
    ))}
  </View>
);

// ── MAIN SCREEN ───────────────────────────────────────────────────────
export default function CityIntroScreen() {
  const router = useRouter();
  const { t, convertPrice } = useApp();
  const params = useLocalSearchParams<{
    city: string; planId: string; startDate: string; endDate: string; budget: string;
  }>();
  const city = params.city ?? 'Hurghada';
  const planId = params.planId;

  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [selectedDeparture, setSelectedDeparture] = useState(DEPARTURE_CITIES[0]);

  // "Did you book?" state
  const [flightBooked, setFlightBooked] = useState<boolean | null>(null);
  const [hotelBooked, setHotelBooked] = useState<boolean | null>(null);

  // Booked detail forms
const [flightDetails, setFlightDetails] = useState<BookedFlightDetails>({
  airline: '', flightNumber: '', departureTime: '', arrivalTime: '', price: '', bookingUrl: '',
});

const [hotelDetails, setHotelDetails] = useState<BookedHotelDetails>({
  name: '', checkIn: formatDate(params.startDate), checkOut: formatDate(params.endDate), pricePerNight: '', bookingUrl: '',
});

  // Which platform was tapped (for highlight)
  const [selectedFlightPlatform, setSelectedFlightPlatform] = useState<string | null>(null);
  const [selectedHotelPlatform, setSelectedHotelPlatform] = useState<string | null>(null);

  function formatDate(date: string | undefined): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  }

  const depart = formatDate(params.startDate);
  const ret = formatDate(params.endDate);
  const toCode = CITY_AIRPORTS[city]?.code ?? 'HRG';

  const openFlightPlatform = async (platform: FlightPlatform) => {
    setSelectedFlightPlatform(platform.id);
    const url = platform.buildUrl(selectedDeparture.code, toCode, depart, ret);
    await Linking.openURL(url);
  };

  const openHotelPlatform = async (platform: HotelPlatform) => {
    setSelectedHotelPlatform(platform.id);
    const url = platform.buildUrl(city, depart, ret);
    await Linking.openURL(url);
  };

  const getNights = (): number => {
    if (!params.startDate || !params.endDate) return 3;
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };
  const nights = getNights();

  const flightDetailsComplete =
    flightDetails.airline.trim() && flightDetails.flightNumber.trim();
  const hotelDetailsComplete = hotelDetails.name.trim();

const handleConfirm = () => {
  if (flightBooked && flightDetailsComplete) {
    useBookingStore.getState().setSelectedFlight({
      airline: flightDetails.airline,
      flightNumber: flightDetails.flightNumber,
      departure: selectedDeparture.code,
      arrival: toCode,
      departureTime: flightDetails.departureTime,
      arrivalTime: flightDetails.arrivalTime,
      duration: '',
      class: 'Economy',
      price: parseFloat(flightDetails.price) || 0,
      bookingUrl: flightDetails.bookingUrl,
    });
  }
  if (hotelBooked && hotelDetailsComplete) {
    useBookingStore.getState().setSelectedHotel({
      id: Date.now(),
      name: hotelDetails.name,
      city,
      stars: 4,
      price_per_night: parseFloat(hotelDetails.pricePerNight) || 0,
      image_url: '',
      rating: 4.5,
      bookingUrl: hotelDetails.bookingUrl,
      checkIn: hotelDetails.checkIn,
      checkOut: hotelDetails.checkOut,
    });
  }
  router.back();
};

  const changeDeparture = (dep: typeof DEPARTURE_CITIES[0]) => {
    setSelectedDeparture(dep);
    setShowDepartureModal(false);
  };

  const confirmBtnLabel = () => {
    const f = flightBooked && flightDetailsComplete;
    const h = hotelBooked && hotelDetailsComplete;
    if (f && h) return 'Save Flight + Hotel →';
    if (f) return 'Save Flight →';
    if (h) return 'Save Hotel →';
    return 'Skip — Continue without booking';
  };

  return (
    <View style={{ flex: 1, backgroundColor: Theme.colors.background }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DesertTriangles />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('plan')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

            {/* ── Destination banner ── */}
            <View style={styles.destinationBanner}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#E67E22" />
              <Text style={styles.destinationText}>Traveling to {city}</Text>
              {planId && <Text style={styles.planId}>Plan #{planId}</Text>}
            </View>

            {/* ── Departure selector ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Departure City</Text>
              <TouchableOpacity
                style={styles.departureSelector}
                onPress={() => setShowDepartureModal(true)}
              >
                <MaterialCommunityIcons name="flag-variant" size={26} color="#E67E22" />
                <View style={styles.departureSelectorText}>
                  <Text style={styles.departureCityName}>{selectedDeparture.city}</Text>
                  <Text style={styles.departureCode}>{selectedDeparture.code} Airport</Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════
                ── FLIGHT BOOKING PLATFORMS ──
            ══════════════════════════════════════════ */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="airplane" size={18} color="#1A1A1A" />
                  <Text style={styles.sectionTitle}>Book Your Flight</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {selectedDeparture.code} → {toCode}
                </Text>
              </View>

              <Text style={styles.sectionHint}>
                Tap a platform to search & book — dates are pre-filled for you
              </Text>

              {FLIGHT_PLATFORMS.map(platform => (
                <TouchableOpacity
                  key={platform.id}
                  style={[
                    styles.platformCard,
                    { backgroundColor: platform.bgColor },
                    selectedFlightPlatform === platform.id && styles.platformCardSelected,
                  ]}
                  onPress={() => openFlightPlatform(platform)}
                  activeOpacity={0.82}
                >
                  {/* Badge */}
                  <View style={[styles.platformBadge, { backgroundColor: platform.badgeColor }]}>
                    <Text style={styles.platformBadgeText}>{platform.badge}</Text>
                  </View>

                  <View style={styles.platformRow}>
                    {/* Icon */}
                    <View style={[styles.platformIconBox, { borderColor: platform.iconColor + '30' }]}>
                      <MaterialCommunityIcons name={platform.icon} size={28} color={platform.iconColor} />
                    </View>

                    {/* Info */}
                    <View style={styles.platformInfo}>
                      <Text style={styles.platformName}>{platform.name}</Text>
                      <Text style={styles.platformTagline}>{platform.tagline}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Stars count={platform.rating} />
                        <Text style={styles.platformRating}>{platform.rating}</Text>
                        <Text style={styles.platformReviews}>({platform.reviews} reviews)</Text>
                      </View>
                    </View>

                    {/* Arrow */}
                    <MaterialCommunityIcons name="open-in-new" size={18} color="#999" />
                  </View>

                  {/* Pre-fill info */}
                  <View style={styles.prefillRow}>
                    <MaterialCommunityIcons name="calendar-check" size={13} color="#666" />
                    <Text style={styles.prefillText}>
                      {depart} → {ret} · {selectedDeparture.code} to {toCode}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* ── Did you book a flight? ── */}
              <View style={styles.didYouBookBox}>
                <MaterialCommunityIcons name="help-circle-outline" size={20} color="#E67E22" />
                <Text style={styles.didYouBookTitle}>Did you book a flight?</Text>
              </View>

              <View style={styles.yesNoRow}>
                <TouchableOpacity
                  style={[styles.yesBtn, flightBooked === true && styles.yesBtnActive]}
                  onPress={() => setFlightBooked(true)}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={flightBooked === true ? '#FFF' : '#27AE60'}
                  />
                  <Text style={[styles.yesBtnText, flightBooked === true && { color: '#FFF' }]}>
                    Yes, I booked!
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.noBtn, flightBooked === false && styles.noBtnActive]}
                  onPress={() => setFlightBooked(false)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={flightBooked === false ? '#FFF' : '#E74C3C'}
                  />
                  <Text style={[styles.noBtnText, flightBooked === false && { color: '#FFF' }]}>
                    Not yet
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Flight details form */}
              {flightBooked === true && (
                <View style={styles.detailsForm}>
                  <Text style={styles.detailsFormTitle}>Enter your flight details</Text>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1.5 }]}>
                      <Text style={styles.inputLabel}>Airline *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. EgyptAir"
                        value={flightDetails.airline}
                        onChangeText={v => setFlightDetails(p => ({ ...p, airline: v }))}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Flight No. *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. MS302"
                        value={flightDetails.flightNumber}
                        onChangeText={v => setFlightDetails(p => ({ ...p, flightNumber: v }))}
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Departure Time</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 08:00 AM"
                        value={flightDetails.departureTime}
                        onChangeText={v => setFlightDetails(p => ({ ...p, departureTime: v }))}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Arrival Time</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 10:30 AM"
                        value={flightDetails.arrivalTime}
                        onChangeText={v => setFlightDetails(p => ({ ...p, arrivalTime: v }))}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Total Price Paid (EGP)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 12000"
                      keyboardType="numeric"
                      value={flightDetails.price}
                      onChangeText={v => setFlightDetails(p => ({ ...p, price: v }))}
                    />
                  </View>
                  <View style={styles.inputGroup}>
  <Text style={styles.inputLabel}>Booking URL</Text>
  <TextInput
    style={styles.input}
    placeholder="e.g. https://www.booking.com/..."
    value={flightDetails.bookingUrl}
    onChangeText={v => setFlightDetails(p => ({ ...p, bookingUrl: v }))}
    autoCapitalize="none"
    keyboardType="url"
  />
</View>

                  {flightDetailsComplete && (
                    <View style={styles.confirmedBadge}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#27AE60" />
                      <Text style={styles.confirmedText}>
                        {flightDetails.airline} {flightDetails.flightNumber} saved ✓
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {flightBooked === false && (
                <View style={styles.notYetNote}>
                  <MaterialCommunityIcons name="information-outline" size={16} color="#999" />
                  <Text style={styles.notYetText}>
                    No problem — you can come back and add it later.
                  </Text>
                </View>
              )}
            </View>

            {/* ══════════════════════════════════════════
                ── HOTEL BOOKING PLATFORMS ──
            ══════════════════════════════════════════ */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="bed" size={18} color="#1A1A1A" />
                  <Text style={styles.sectionTitle}>Book Your Hotel</Text>
                </View>
                <Text style={styles.sectionSubtitle}>{nights} nights in {city}</Text>
              </View>

              <Text style={styles.sectionHint}>
                Tap a platform to search — city & dates are pre-filled
              </Text>

              {HOTEL_PLATFORMS.map(platform => (
                <TouchableOpacity
                  key={platform.id}
                  style={[
                    styles.platformCard,
                    { backgroundColor: platform.bgColor },
                    selectedHotelPlatform === platform.id && styles.platformCardSelected,
                  ]}
                  onPress={() => openHotelPlatform(platform)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.platformBadge, { backgroundColor: platform.badgeColor }]}>
                    <Text style={styles.platformBadgeText}>{platform.badge}</Text>
                  </View>

                  <View style={styles.platformRow}>
                    <View style={[styles.platformIconBox, { borderColor: platform.iconColor + '30' }]}>
                      <MaterialCommunityIcons name={platform.icon} size={28} color={platform.iconColor} />
                    </View>
                    <View style={styles.platformInfo}>
                      <Text style={styles.platformName}>{platform.name}</Text>
                      <Text style={styles.platformTagline}>{platform.tagline}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Stars count={platform.rating} />
                        <Text style={styles.platformRating}>{platform.rating}</Text>
                        <Text style={styles.platformReviews}>({platform.reviews} reviews)</Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="open-in-new" size={18} color="#999" />
                  </View>

                  <View style={styles.prefillRow}>
                    <MaterialCommunityIcons name="calendar-check" size={13} color="#666" />
                    <Text style={styles.prefillText}>
                      {depart} → {ret} · {city} · 2 adults
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* ── Did you book a hotel? ── */}
              <View style={styles.didYouBookBox}>
                <MaterialCommunityIcons name="help-circle-outline" size={20} color="#E67E22" />
                <Text style={styles.didYouBookTitle}>Did you book a hotel?</Text>
              </View>

              <View style={styles.yesNoRow}>
                <TouchableOpacity
                  style={[styles.yesBtn, hotelBooked === true && styles.yesBtnActive]}
                  onPress={() => setHotelBooked(true)}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={hotelBooked === true ? '#FFF' : '#27AE60'}
                  />
                  <Text style={[styles.yesBtnText, hotelBooked === true && { color: '#FFF' }]}>
                    Yes, I booked!
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.noBtn, hotelBooked === false && styles.noBtnActive]}
                  onPress={() => setHotelBooked(false)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={hotelBooked === false ? '#FFF' : '#E74C3C'}
                  />
                  <Text style={[styles.noBtnText, hotelBooked === false && { color: '#FFF' }]}>
                    Not yet
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Hotel details form */}
              {hotelBooked === true && (
                <View style={styles.detailsForm}>
                  <Text style={styles.detailsFormTitle}>Enter your hotel details</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Hotel Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Marriott Hurghada"
                      value={hotelDetails.name}
                      onChangeText={v => setHotelDetails(p => ({ ...p, name: v }))}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Check-in</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={hotelDetails.checkIn}
                        onChangeText={v => setHotelDetails(p => ({ ...p, checkIn: v }))}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Check-out</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={hotelDetails.checkOut}
                        onChangeText={v => setHotelDetails(p => ({ ...p, checkOut: v }))}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Price Per Night (EGP)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 1500"
                      keyboardType="numeric"
                      value={hotelDetails.pricePerNight}
                      onChangeText={v => setHotelDetails(p => ({ ...p, pricePerNight: v }))}
                    />
                  </View>

                  <View style={styles.inputGroup}>
  <Text style={styles.inputLabel}>Booking URL</Text>
  <TextInput
    style={styles.input}
    placeholder="e.g. https://www.booking.com/..."
    value={hotelDetails.bookingUrl}
    onChangeText={v => setHotelDetails(p => ({ ...p, bookingUrl: v }))}
    autoCapitalize="none"
    keyboardType="url"
  />
</View>

                  {hotelDetailsComplete && (
                    <View style={styles.confirmedBadge}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#27AE60" />
                      <Text style={styles.confirmedText}>
                        {hotelDetails.name} saved ✓
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {hotelBooked === false && (
                <View style={styles.notYetNote}>
                  <MaterialCommunityIcons name="information-outline" size={16} color="#999" />
                  <Text style={styles.notYetText}>
                    No problem — you can come back and add it later.
                  </Text>
                </View>
              )}
            </View>

            <View style={{ height: 140 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Bottom Bar ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.determineBtn} onPress={handleConfirm}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFF" />
              <Text style={styles.determineBtnText}>{confirmBtnLabel()}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Departure Modal ── */}
        <Modal visible={showDepartureModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Departure City</Text>
                <TouchableOpacity onPress={() => setShowDepartureModal(false)}>
                  <MaterialCommunityIcons name="close" size={22} color="#999" />
                </TouchableOpacity>
              </View>
              {DEPARTURE_CITIES.map(dep => (
                <TouchableOpacity
                  key={dep.code}
                  style={[styles.depOption, selectedDeparture.code === dep.code && styles.depOptionSelected]}
                  onPress={() => changeDeparture(dep)}
                >
                  <MaterialCommunityIcons name="flag-variant" size={22} color="#E67E22" />
                  <View style={styles.depOptionText}>
                    <Text style={styles.depCityName}>{dep.city}</Text>
                    <Text style={styles.depCode}>{dep.code} Airport</Text>
                  </View>
                  {selectedDeparture.code === dep.code && (
                    <MaterialCommunityIcons name="check" size={18} color="#E67E22" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },

  headerTitle: { fontSize: 18, fontWeight: '700', color: Theme.colors.text },

  container: { flex: 1 },

  destinationBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.gold,
    margin: 16, borderRadius: 16, padding: 14, gap: 8,
  },

  destinationText: { flex: 1, fontSize: 15, fontWeight: '700', color: Theme.colors.primary },
  planId: { fontSize: 12, color: Theme.colors.muted },

  section: { marginHorizontal: 16, marginBottom: 20 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: Theme.colors.muted },

  sectionHint: {
    fontSize: 12, color: '#888', marginBottom: 12,
    fontStyle: 'italic',
  },

  // Departure selector
  departureSelector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16, padding: 14, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  departureSelectorText: { flex: 1 },
  departureCityName: { fontSize: 15, fontWeight: '700', color: Theme.colors.text },
  departureCode: { fontSize: 12, color: Theme.colors.muted, marginTop: 2 },

  // Platform card
  platformCard: {
    borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  platformCardSelected: { borderColor: Theme.colors.primary },

  platformBadge: {
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10,
  },
  platformBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  platformRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  platformIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },

  platformInfo: { flex: 1 },
  platformName: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  platformTagline: { fontSize: 12, color: '#555', lineHeight: 16 },
  platformRating: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  platformReviews: { fontSize: 11, color: '#999' },

  prefillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  prefillText: { fontSize: 11, color: '#666' },

  // Did you book?
  didYouBookBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8F0', borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 10,
    borderWidth: 1, borderColor: '#FDDCB5',
  },
  didYouBookTitle: { fontSize: 15, fontWeight: '700', color: Theme.colors.text },

  yesNoRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },

  yesBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 12,
    backgroundColor: '#F0FBF4', borderWidth: 1.5, borderColor: '#27AE60',
  },
  yesBtnActive: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  yesBtnText: { fontSize: 14, fontWeight: '700', color: '#27AE60' },

  noBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 12,
    backgroundColor: '#FFF5F5', borderWidth: 1.5, borderColor: '#E74C3C',
  },
  noBtnActive: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  noBtnText: { fontSize: 14, fontWeight: '700', color: '#E74C3C' },

  // Details form
  detailsForm: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: '#E8F5E9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  detailsFormTitle: {
    fontSize: 14, fontWeight: '700', color: Theme.colors.text, marginBottom: 14,
  },

  inputRow: { flexDirection: 'row', gap: 10 },

  inputGroup: { flex: 1, marginBottom: 12 },

  inputLabel: { fontSize: 11, fontWeight: '600', color: '#666', marginBottom: 4 },

  input: {
    backgroundColor: '#F8F8F8', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1A1A1A',
    borderWidth: 1, borderColor: '#EBEBEB',
  },

  confirmedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FBF4', borderRadius: 10, padding: 10, marginTop: 4,
  },
  confirmedText: { fontSize: 13, fontWeight: '700', color: '#27AE60' },

  notYetNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8F8F8', borderRadius: 12, padding: 12,
  },
  notYetText: { fontSize: 12, color: '#999', flex: 1 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },

  determineBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 30, paddingVertical: 16, alignItems: 'center',
  },
  determineBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Theme.colors.text },

  depOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F8F8F8', gap: 12,
  },
  depOptionSelected: { backgroundColor: Theme.colors.gold },
  depOptionText: { flex: 1 },
  depCityName: { fontSize: 15, fontWeight: '600', color: Theme.colors.text },
  depCode: { fontSize: 12, color: Theme.colors.muted, marginTop: 2 },
});
