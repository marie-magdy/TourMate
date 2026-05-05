// app/(main)/plan.tsx
import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Modal, FlatList, Image,
  ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { useRouter , useLocalSearchParams } from 'expo-router';
import { useApp } from '../../constants/AppContext';
import * as Location from 'expo-location';

import DateTimePicker from '@react-native-community/datetimepicker';

import DesertTriangles from '../../components/DesertTriangles';
import { Theme } from '../../constants/theme';
import { useBookingStore } from '@/store/bookingStore';
import BottomTab from '@/components/BottomTab';


const { width } = Dimensions.get('window');

// ── Egyptian Cities ───────────────────────────────────────────────────
const EGYPTIAN_CITIES = [
  {
    name: 'Hurghada',
    image: 'https://cdn.magzter.com/1387351795/1659543263/articles/M589TSHUD1660125370805/SHOAL-BUSINESS.jpg',
    lat: 27.2579,
    lon: 33.8116
  },
  {
    name: 'Cairo',
    image: 'https://c8.alamy.com/comp/2BR4300/the-mosque-madrassa-of-sultan-hassan-and-the-pyramids-in-the-background-cairo-egypt-2BR4300.jpg',
    lat: 30.0444,
    lon: 31.2357
  },
  {
    name: 'Alexandria',
    image: 'https://www.egypttoursportal.com/images/2017/11/Alexandria-Library-Egypt-Tours-Portal.jpg',
    lat: 31.2001,
    lon: 29.9187
  },
  {
    name: 'Luxor',
    image: 'https://www.en-vols.com/wp-content/uploads/afmm/2023/01/shutterstock_1997301695.jpg',
    lat: 25.6872,
    lon: 32.6396
  },
  {
    name: 'Aswan',
    image: 'https://r-xx.bstatic.com/xdata/images/city/1680x840/633155.webp?k=9c0e7cebc054516c31d7856a820f04a120fbc179172f38cd3310025a265d8ab9&o=',
    lat: 24.0889,
    lon: 32.8998
  },
  {
    name: 'Sharm El Sheikh',
    image: 'https://egyptescapes.com/wp-content/uploads/2019/12/sharm-el-sheihk.jpg',
    lat: 27.9158,
    lon: 34.3300
  },
  {
    name: 'Dahab',
    image: 'https://www.scuba.com/blog/wp-content/uploads/2017/07/dahab-blue-hole-shutterstock_1748271710.jpg',
    lat: 28.5096,
    lon: 34.5179
  },

  {
    name: 'Siwa',
    image: 'https://d3rr2gvhjw0wwy.cloudfront.net/uploads/activity_galleries/61004/2000x2000-0-70-2a5f725ac8aaf04bcbdf66da09b9d04b.jpg',
    lat: 29.2031,
    lon: 25.5195
  },

];

// ── Interest Tags ─────────────────────────────────────────────────────
const INTERESTS = [
  'Adventure', 'Diving', 'Food', 'Party', 'History',
  'Shopping', 'Nature', 'Nightlife', 'Family', 'Culture',
];

// ── Calendar helpers ──────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const getDaysInMonth = (month: number, year: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (month: number, year: number): number => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

// ── Weather helpers ───────────────────────────────────────────────────
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

interface DayForecast {
  date: string;
  day: string;
  maxTemp: number;
  minTemp: number;
  iconName: MCIconName;
  iconColor: string;
  label: string;
}

// ── PLAN SCREEN ───────────────────────────────────────────────────────
export default function PlanScreen() {
  

  const params = useLocalSearchParams<{
  autoFillLocation?: string;
  autoFillCity?: string;
}>();

  const router = useRouter();
  const { t } = useApp();

  const [selectedCity, setSelectedCity] = useState(EGYPTIAN_CITIES.find(c => c.name === 'Alexandria') || EGYPTIAN_CITIES[0]);
  const [showCityModal, setShowCityModal] = useState(false);

  // Calendar
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate]     = useState<Date | null>(null);

  //Time
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pickerType, setPickerType] = useState<'start' | 'end' | null>(null);

  // Budget & interests
  const [budget, setBudget] = useState('');
 const [daySchedules, setDaySchedules] = useState<{ start: Date; end: Date }[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isForeigner, setIsForeigner] = useState(false);

  // Starting location
  const [locationLabel, setLocationLabel] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationSearching, setLocationSearching] = useState(false);

  // Weather
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const { selectedHotel } = useBookingStore();

useEffect(() => {
  const applyBookedHotel = async () => {
    if (!selectedHotel) return;

    try {
      const query = `${selectedHotel.name}, ${selectedHotel.city}, Egypt`;

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });

      const data = await res.json();

      if (data.length) {
        const { lat, lon } = data[0];

        setLocationCoords({
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        });

        setLocationLabel(selectedHotel.name);
        setLocationInput(selectedHotel.name);
      }
    } catch (err) {
      console.error('Hotel geocode failed:', err);
    }

    useBookingStore.setState({
      selectedHotel: null,
    });
  };

  applyBookedHotel();
}, [selectedHotel]);

  useEffect(() => {
    fetchForecast(selectedCity);
  }, [selectedCity]);

  // Reset per-day hours whenever the date range changes
  useEffect(() => {
    if (startDate && endDate && endDate >= startDate) {
      const count = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      setDaySchedules(prev =>
        Array.from({ length: count }, (_, i) =>
          prev[i] ?? {
            start: new Date(new Date().setHours(9, 0, 0, 0)),   // 9:00 AM
            end: new Date(new Date().setHours(21, 0, 0, 0)),    // 9:00 PM
          }
        )
      );
    } else {
      setDaySchedules([]);
    }
  }, [startDate, endDate]);

    useEffect(() => {
    if (params.autoFillLocation) {
      setLocationLabel(params.autoFillLocation);
      // Geocode the hotel name to get coordinates
      (async () => {
        try {
          const query = `${params.autoFillLocation}, ${params.autoFillCity ?? selectedCity.name}, Egypt`;
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
          const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          if (data.length > 0) {
            setLocationCoords({
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon),
            });
          }
        } catch {
          // coords not found, label still fills
        }
      })();
    }
  }, [params.autoFillLocation]);

  // ── Fetch 5-day forecast ──────────────────────────────────────────
  const fetchForecast = async (city: typeof EGYPTIAN_CITIES[0]): Promise<void> => {
    setWeatherLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Africa%2FCairo&forecast_days=5`
      );
      const data = await res.json();
      const days: DayForecast[] = data.daily.time.map((date: string, i: number) => {
        const d = new Date(date);
        const info = getWeatherInfo(data.daily.weathercode[i]);
        return {
          date,
          day: SHORT_DAYS[d.getDay()],
          maxTemp: Math.round(data.daily.temperature_2m_max[i]),
          minTemp: Math.round(data.daily.temperature_2m_min[i]),
          iconName:  info.iconName,
          iconColor: info.iconColor,
          label:     info.label,
        };
      });
      setForecast(days);
    } catch (err) {
      console.error('Forecast error:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  // ── Calendar logic ────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

  const isPastDay = (day: number) => {
    const today = new Date();
    const cellDate = new Date(currentYear, currentMonth, day);

    // remove time part (important)
    today.setHours(0, 0, 0, 0);
    cellDate.setHours(0, 0, 0, 0);

    return cellDate < today;
  };

  const handleDayPress = (day: number) => {
    const tapped = new Date(currentYear, currentMonth, day);
    if (!startDate || (startDate && endDate)) {
      setStartDate(tapped);
      setEndDate(null);
    } else {
      if (tapped < startDate) {
        setStartDate(tapped);
        setEndDate(null);
      } else if (tapped.getTime() === startDate.getTime()) {
        // deselect if same day tapped
        setStartDate(null);
        setEndDate(null);
      } else {
        setEndDate(tapped);
      }
    }
  };

  const isDaySelected = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    return (startDate !== null && d.getTime() === startDate.getTime()) ||
          (endDate   !== null && d.getTime() === endDate.getTime());
  };

  const isDayInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const d = new Date(currentYear, currentMonth, day);
    return d > startDate && d < endDate;
  };

  const isDayToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const toggleInterest = (label: string) => {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  // ── Location helpers ─────────────────────────────────────────────────
  const applyGPS = async (): Promise<void> => {
    setLocationSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      setLocationLabel('My GPS Location');
    } catch {
      Alert.alert('Error', 'Could not get your GPS location.');
    } finally {
      setLocationSearching(false);
    }
  };

  const applyAddress = async (): Promise<void> => {
    const query = locationInput.trim();
    if (!query) return;
    setLocationSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data.length) {
        Alert.alert('Not found', 'Could not find that address. Try being more specific.');
        return;
      }
      const { lat, lon, display_name } = data[0];
      setLocationCoords({ lat: parseFloat(lat), lon: parseFloat(lon) });
      const shortLabel = display_name.split(',').slice(0, 2).join(', ');
      setLocationLabel(shortLabel);
      setLocationInput('');
    } catch {
      Alert.alert('Error', 'Could not geocode address.');
    } finally {
      setLocationSearching(false);
    }
  };

  const handleNext = () => {
    if (!startDate || !endDate) { alert('Please select your travel dates.'); return; }
    if (!budget) { alert('Please enter your budget.'); return; }
    if (selectedInterests.length === 0) { alert('Please select at least one interest.'); return; }

    const isValid = daySchedules.every(s => {
      const start = s.start?.getHours();
      const end = s.end?.getHours();
      return s.start && s.end && start !== end;
    });

    if (!isValid) { alert('Please set valid start and end hours for each day.'); return; }

    const formattedSchedules = daySchedules.map(d => ({
      start_hour: d.start.getHours(),
      end_hour: d.end.getHours(),
    }));

    router.push({
      pathname: '/(main)/pick-spots' as any,
      params: {
        city: selectedCity.name,
        startDate: `${startDate!.getFullYear()}-${String(startDate!.getMonth() + 1).padStart(2,'0')}-${String(startDate!.getDate()).padStart(2,'0')}`,
        endDate:   `${endDate!.getFullYear()}-${String(endDate!.getMonth() + 1).padStart(2,'0')}-${String(endDate!.getDate()).padStart(2,'0')}`,
        budget,

        daySchedules: JSON.stringify(formattedSchedules),

        interests: selectedInterests.join(','),
        isForeigner: String(isForeigner),

        ...(locationCoords && {
          startLat: String(locationCoords.lat),
          startLon: String(locationCoords.lon),
          startLabel: locationLabel,
        }),
      },
    });
    // RESET AFTER sending
  setTimeout(() => {
    useBookingStore.setState({
      selectedHotel: null,
      selectedFlight: null,
    });

    setLocationLabel('');
    setLocationInput('');
    setLocationCoords(null);
  }, 100);
  };

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const CELL_SIZE = (width - 40 - 32) / 7;

  return (
<View style={{ flex: 1, backgroundColor: Theme.colors.background }}>
  
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <DesertTriangles />
  </View>

  {/* CONTENT LAYER */}
  <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('plan')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── City Selector ── */}
        <TouchableOpacity style={styles.cityCard} onPress={() => setShowCityModal(true)} activeOpacity={0.9}>
          <Image source={{ uri: selectedCity.image }} style={styles.cityImage} />
          <View style={styles.cityOverlay}>
            <View style={styles.cityPill}>
              <MaterialCommunityIcons name="map-marker" size={13} color="#555" />
              <Text style={styles.cityPillText}>{selectedCity.name}, Egypt</Text>
              <Text style={styles.cityPillArrow}>▾</Text>
            </View>
          </View>
          <Text style={styles.cityName}>{selectedCity.name}</Text>
        </TouchableOpacity>

        {/* ── 5-Day Weather Forecast ── */}
        <View style={styles.card}>
          <View style={styles.forecastHeader}>
            <Text style={styles.cardTitle}>{t('weather')} — {selectedCity.name}</Text>
            <Text style={styles.forecastSubtitle}>{t('forecast')}</Text>
          </View>
          {weatherLoading ? (
            <ActivityIndicator size="small" color="#E67E22" style={{ marginVertical: 10 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {forecast.map((day, index) => (
                <View
                  key={index}
                  style={[styles.forecastDay, index === 0 && styles.forecastDayToday]}
                >
                  <Text style={[styles.forecastDayName, index === 0 && styles.forecastDayNameToday]}>
                    {index === 0 ? 'Today' : day.day}
                  </Text>
                  <MaterialCommunityIcons
                    name={day.iconName}
                    size={28}
                    color={index === 0 ? day.iconColor : day.iconColor}
                    style={styles.forecastIconMCI}
                  />
                  <Text style={[styles.forecastLabel, index === 0 && styles.forecastLabelToday]}>
                    {day.label}
                  </Text>
                  <View style={styles.forecastTemps}>
                    <Text style={[styles.forecastMax, index === 0 && styles.forecastMaxToday]}>
                      {day.maxTemp}°
                    </Text>
                    <Text style={styles.forecastTempSep}>/</Text>
                    <Text style={styles.forecastMin}>{day.minTemp}°</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Calendar ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Dates</Text>
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthArrowBtn}>
              <Text style={styles.monthArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[currentMonth]} {currentYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthArrowBtn}>
              <Text style={styles.monthArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={[styles.dayHeader, { width: CELL_SIZE }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarCells.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  { width: CELL_SIZE, height: CELL_SIZE },
                  (day && isDaySelected(day)) ? styles.dayCellSelected : null,
                  (day && isDayInRange(day)) ? styles.dayCellInRange : null,
                  (day && isDayToday(day) && !isDaySelected(day)) ? styles.dayCellToday : undefined,
                ]}
                onPress={() => day && handleDayPress(day)}
                disabled={!day || isPastDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayCellText,
                  ...(day && isDaySelected(day) ? [styles.dayCellTextSelected] : []),
                  ...(day && isDayInRange(day) ? [styles.dayCellTextRange] : []),
                ]}>
                  {day ?? ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {startDate && (
            <Text style={styles.selectedRange}>
              {startDate && endDate
                ? `${MONTHS[startDate.getMonth()]} ${startDate.getDate()} → ${MONTHS[endDate.getMonth()]} ${endDate.getDate()}`
                : `From: ${MONTHS[startDate.getMonth()]} ${startDate.getDate()} — select end date`}
            </Text>
          )}
        </View>

        {/* ── Visitor Type ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="passport" size={18} color="#1A1A1A" />
            <Text style={styles.cardTitleText}>Visitor Type</Text>
          </View>
          <View style={styles.nationalityRow}>
            <TouchableOpacity
              style={[styles.nationalityBtn, !isForeigner && styles.nationalityBtnSelected]}
              onPress={() => setIsForeigner(false)}
            >
              <Text style={[styles.nationalityBtnText, !isForeigner && styles.nationalityBtnTextSelected]}>Egyptian</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nationalityBtn, isForeigner && styles.nationalityBtnSelected]}
              onPress={() => setIsForeigner(true)}
            >
              <Text style={[styles.nationalityBtnText, isForeigner && styles.nationalityBtnTextSelected]}>Foreigner</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Starting Location ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color="#1A1A1A" />
            <Text style={styles.cardTitleText}>Starting Location</Text>
          </View>
          <Text style={styles.helperText}>Where will you start your trip from?</Text>

          {/* Book Button */}
          <TouchableOpacity
            style={styles.bookingBtn}
            onPress={() => router.push({
              pathname: '/(main)/city-intro' as any,
              params: {
                city: selectedCity.name,
                startDate: startDate ? formatLocalDate(startDate) : '',
                endDate: endDate ? formatLocalDate(endDate) : '',
                budget,
                
              },
            })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="airplane" size={16} color="#E67E22" />
            <Text style={styles.bookingBtnText}>Book Flight & Hotel</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color="#E67E22" />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or enter manually</Text>
            <View style={styles.orLine} />
          </View>

          {/* Confirmed location */}
          {locationLabel ? (
            <View style={styles.locationConfirmed}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#27AE60" />
              <Text style={styles.locationConfirmedText} numberOfLines={1}>{locationLabel}</Text>
              <TouchableOpacity onPress={() => { setLocationLabel(''); setLocationCoords(null); }}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#CCC" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Manual address input */}
          <View style={styles.locationInputRow}>
            <TextInput
              style={styles.locationInput}
              placeholder="Enter your hotel address or location"
              placeholderTextColor="#AAA"
              value={locationInput}
              onChangeText={setLocationInput}
              onSubmitEditing={applyAddress}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.locationSearchBtn}
              onPress={applyAddress}
              disabled={locationSearching}
            >
              {locationSearching
                ? <ActivityIndicator size="small" color="#FFF" />
                : <MaterialCommunityIcons name="magnify" size={18} color="#FFF" />}
            </TouchableOpacity>
          </View>

          {/* GPS button */}
          <TouchableOpacity style={styles.gpsBtn} onPress={applyGPS} disabled={locationSearching}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#E67E22" />
            <Text style={styles.gpsBtnText}>Use my current GPS location</Text>
          </TouchableOpacity>

        </View>

        {/* ── Budget ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="cash-multiple" size={18} color="#1A1A1A" />
            <Text style={styles.cardTitleText}>Budget</Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetCurrency}>EGP</Text>
            <TextInput
              style={styles.budgetInput}
              placeholder="Enter your budget"
              placeholderTextColor="#AAA"
              keyboardType="numeric"
              value={budget}
              onChangeText={setBudget}
            />
          </View>
        </View>

        {startDate && endDate && daySchedules.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="clock-time-four-outline" size={18} color="#1A1A1A" />
              <Text style={styles.cardTitleText}>Daily Schedule</Text>
            </View>

            <Text style={styles.helperText}>
              Set the start and end time for your exploration.
            </Text>

            {daySchedules.map((sched, i) => {
              const d = new Date(currentYear, currentMonth, startDate.getDate() + i);
              const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;

              return (
                <View key={i} style={styles.dayHourRow}>
                  
                  {/* Day Label */}
                  <Text style={styles.dayHourLabel}>
                    Day {i + 1} ({label})
                  </Text>

                  {/* Time Pickers */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>

                    {/* Start Time */}
                    <TouchableOpacity
                      style={styles.dayHourInputBox}
                      onPress={() => {
                        setActiveIndex(i);
                        setPickerType('start');
                      }}
                    >
                      <Text style={styles.dayHourUnit}>From</Text>
                      <Text style={styles.dayHourText}>
                        {sched.start.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </TouchableOpacity>

                    {/* End Time */}
                    <TouchableOpacity
                      style={styles.dayHourInputBox}
                      onPress={() => {
                        setActiveIndex(i);
                        setPickerType('end');
                      }}
                    >
                      <Text style={styles.dayHourUnit}>To</Text>
                      <Text style={styles.dayHourText}>
                        {sched.end.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </TouchableOpacity>

                  </View>
                </View>
              );
            })}

            {/* Time picker modal */}
            <Modal
              visible={activeIndex !== null && pickerType !== null}
              transparent
              animationType="fade"
              onRequestClose={() => { setActiveIndex(null); setPickerType(null); }}
            >
              <TouchableOpacity
                style={styles.timePickerOverlay}
                activeOpacity={1}
                onPress={() => { setActiveIndex(null); setPickerType(null); }}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={styles.timePickerSheet}>
                  <View style={styles.timePickerHeader}>
                    <Text style={styles.timePickerTitle}>
                      {pickerType === 'start' ? 'Start Time' : 'End Time'}
                    </Text>
                    <TouchableOpacity onPress={() => { setActiveIndex(null); setPickerType(null); }}>
                      <Text style={styles.timePickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  {activeIndex !== null && pickerType && (
                    <DateTimePicker
                      value={
                        pickerType === 'start'
                          ? daySchedules[activeIndex].start
                          : daySchedules[activeIndex].end
                      }
                      mode="time"
                      is24Hour={false}
                      display="spinner"
                      themeVariant="light"
                      onChange={(event, selectedDate) => {
                        if (!selectedDate) return;
                        setDaySchedules(prev => {
                          const next = [...prev];
                          next[activeIndex!] = {
                            ...next[activeIndex!],
                            [pickerType!]: selectedDate,
                          };
                          return next;
                        });
                      }}
                      style={{ width: '100%' }}
                    />
                  )}
                </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </View>
        )}

        {/* ── Interests ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Interests</Text>
          <View style={styles.interestsGrid}>
            {INTERESTS.map(interest => (
              <TouchableOpacity
                key={interest}
                style={[
                  styles.interestTag,
                  selectedInterests.includes(interest) && styles.interestTagSelected,
                ]}
                onPress={() => toggleInterest(interest)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.interestLabel,
                  selectedInterests.includes(interest) && styles.interestLabelSelected,
                ]}>
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Next Step ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{t('Generate Plan')} →</Text>
        </TouchableOpacity>
      </View>
      {/* Navigation */}
      <BottomTab active="Plan" />

      {/* ── City Modal ── */}
      <Modal visible={showCityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('whereTo')}</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={EGYPTIAN_CITIES}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cityOption, selectedCity.name === item.name && styles.cityOptionSelected]}
                  onPress={() => { setSelectedCity(item); setShowCityModal(false); }}
                >
                  <Image source={{ uri: item.image }} style={styles.cityOptionImage} />
                  <Text style={[styles.cityOptionText, selectedCity.name === item.name && styles.cityOptionTextSelected]}>
                    {item.name}
                  </Text>
                  {selectedCity.name === item.name && <Text style={styles.cityOptionCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C1810',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  container: {
    flex: 1,
  },

  // ── Booking chips ───────────────────────────────────────────────
  bookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,

    backgroundColor: Theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 13,

    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    marginBottom: 16,
  },

  bookingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },

  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  orText: {
    fontSize: 11,
    color: Theme.colors.muted,
    fontWeight: '500',
  },

  // ── City card ───────────────────────────────────────────────
  cityCard: {
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    height: 160,
  },

  cityImage: {
    width: '100%',
    height: '100%',
  },

  cityOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 12,
  },

  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },

  cityPillIcon: { fontSize: 12 },

  cityPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
  },

  cityPillArrow: {
    fontSize: 12,
    color: Theme.colors.muted,
  },

  cityName: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },

  // ── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: Theme.colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 14,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },

  cardTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  // ── Forecast ───────────────────────────────────────────────
  forecastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  forecastSubtitle: {
    fontSize: 12,
    color: Theme.colors.muted,
  },

  forecastDay: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: '#F7F7F7',
    minWidth: 72,
  },

  forecastDayToday: {
    backgroundColor: Theme.colors.primary + '22',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
  },

  forecastDayName: {
    fontSize: 11,
    color: Theme.colors.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  forecastDayNameToday: {
    color: Theme.colors.primary,
  },

  forecastIconMCI: {
    marginBottom: 6,
  },

  forecastLabel: {
    fontSize: 10,
    color: Theme.colors.muted,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },

  forecastLabelToday: {
    color: Theme.colors.primary,
  },

  forecastTemps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  forecastMax: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.colors.text,
  },

  forecastMaxToday: {
    color: Theme.colors.primary,
  },

  forecastTempSep: {
    fontSize: 12,
    color: Theme.colors.muted,
  },

  forecastMin: {
    fontSize: 13,
    color: Theme.colors.muted,
  },

  // ── Calendar ───────────────────────────────────────────────
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  monthArrowBtn: {
    padding: 8,
  },

  monthArrow: {
    fontSize: 22,
    color: Theme.colors.text,
  },

  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  dayHeader: {
    textAlign: 'center',
    fontSize: 11,
    color: Theme.colors.muted,
    fontWeight: '600',
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },

  dayCellSelected: {
    backgroundColor: Theme.colors.primary,
  },

  dayCellInRange: {
    backgroundColor: Theme.colors.primary + '22',
    borderRadius: 0,
  },

  dayCellToday: {
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
  },

  dayCellText: {
    fontSize: 13,
    color: Theme.colors.text,
    fontWeight: '500',
  },

  dayCellTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },

  dayCellTextRange: {
    color: Theme.colors.primary,
  },

  selectedRange: {
    marginTop: 10,
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Budget ───────────────────────────────────────────────
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  budgetCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginRight: 8,
  },

  budgetInput: {
    flex: 1,
    fontSize: 16,
    color: Theme.colors.text,
  },

  helperText: {
    fontSize: 13,
    color: Theme.colors.muted,
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 18,
  },

  dayHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },

  dayHourLabel: {
    fontSize: 14,
    color: Theme.colors.text,
    fontWeight: '500',
  },

  dayHourInputBox: {
    flex: 0,
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
    minHeight: 20,
  },

  dayHourText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
  },

  dayHourUnit: {
    fontSize: 10,
    color: Theme.colors.muted,
  },

  // ── Location ───────────────────────────────────────────────
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FBF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },

  locationConfirmedText: {
    flex: 1,
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '600',
  },

  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  locationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Theme.colors.text,
  },

  locationSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },

  gpsBtnText: {
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '600',
  },

  // ── Interests ───────────────────────────────────────────────
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  interestTagSelected: {
    backgroundColor: Theme.colors.primary + '22',
    borderColor: Theme.colors.primary,
  },

  interestIcon: {
    fontSize: 14,
  },

  interestLabel: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '500',
  },

  interestLabelSelected: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },

  // ── Bottom bar ───────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },

  nextBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },

  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Modal ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    paddingBottom: 30,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  modalClose: {
    fontSize: 18,
    color: Theme.colors.muted,
    fontWeight: '600',
  },

  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
    gap: 12,
  },

  cityOptionSelected: {
    backgroundColor: Theme.colors.primary + '22',
  },

  cityOptionImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },

  cityOptionText: {
    flex: 1,
    fontSize: 15,
    color: Theme.colors.text,
    fontWeight: '500',
  },

  cityOptionTextSelected: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },

  cityOptionCheck: {
    fontSize: 16,
    color: Theme.colors.primary,
    fontWeight: '700',
  },

  // ── Time Picker Modal ────────────────────────────────────────────
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  timePickerSheet: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },

  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  timePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },

  timePickerDone: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.primary,
  },

  // ── Nationality ───────────────────────────────────────────────
  nationalityRow: {
    flexDirection: 'row',
    gap: 10,
  },

  nationalityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  nationalityBtnSelected: {
    backgroundColor: Theme.colors.primary + '22',
    borderColor: Theme.colors.primary,
  },

  nationalityBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.muted,
  },

  nationalityBtnTextSelected: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },
});