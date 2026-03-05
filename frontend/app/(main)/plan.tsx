// app/(main)/plan.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Modal,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// ── Egyptian Cities ───────────────────────────────────────────────────
const EGYPTIAN_CITIES = [
  { name: 'Hurghada', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Hurghada_city.jpg/1280px-Hurghada_city.jpg' },
  { name: 'Cairo', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Cairo_from_the_Nile.jpg/1280px-Cairo_from_the_Nile.jpg' },
  { name: 'Alexandria', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Alexandria_montage.jpg/1280px-Alexandria_montage.jpg' },
  { name: 'Luxor', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Valley_of_the_Kings_from_the_air.jpg/1280px-Valley_of_the_Kings_from_the_air.jpg' },
  { name: 'Aswan', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Aswan_-_panoramio.jpg/1280px-Aswan_-_panoramio.jpg' },
  { name: 'Sharm El Sheikh', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Sharm_el-Sheikh_bay.jpg/1280px-Sharm_el-Sheikh_bay.jpg' },
  { name: 'Dahab', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Dahab_-_panoramio.jpg/1280px-Dahab_-_panoramio.jpg' },
  { name: 'Marsa Matrouh', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Marsa_Matruh.jpg/1280px-Marsa_Matruh.jpg' },
  { name: 'Siwa', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Siwa_Oasis.jpg/1280px-Siwa_Oasis.jpg' },
  { name: 'El Gouna', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Hurghada_city.jpg/1280px-Hurghada_city.jpg' },
  { name: 'Nuweiba', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Sharm_el-Sheikh_bay.jpg/1280px-Sharm_el-Sheikh_bay.jpg' },
  { name: 'Taba', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Sharm_el-Sheikh_bay.jpg/1280px-Sharm_el-Sheikh_bay.jpg' },
];

// ── Interest Tags ─────────────────────────────────────────────────────
const INTERESTS = [
  { label: 'Adventure', icon: '🏔️' },
  { label: 'Diving', icon: '🤿' },
  { label: 'Food', icon: '🍽️' },
  { label: 'Party', icon: '🎉' },
  { label: 'History', icon: '🏛️' },
  { label: 'Shopping', icon: '🛍️' },
  { label: 'Nature', icon: '🌿' },
  { label: 'Nightlife', icon: '🌙' },
  { label: 'Family', icon: '👨‍👩‍👧' },
  { label: 'Culture', icon: '🎭' },
];

// ── Calendar helpers ──────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const getDaysInMonth = (month: number, year: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (month: number, year: number): number => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday-based
};

// ── PLAN SCREEN ───────────────────────────────────────────────────────
export default function PlanScreen() {
  const router = useRouter();

  // City
  const [selectedCity, setSelectedCity] = useState(EGYPTIAN_CITIES[0]);
  const [showCityModal, setShowCityModal] = useState(false);

  // Calendar
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [startDate, setStartDate] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<number | null>(null);

  // Budget
  const [budget, setBudget] = useState('');

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // ── Calendar logic ────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const handleDayPress = (day: number) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(day);
      setEndDate(null);
    } else {
      if (day < startDate) {
        setStartDate(day);
        setEndDate(null);
      } else {
        setEndDate(day);
      }
    }
  };

  const isDaySelected = (day: number) => day === startDate || day === endDate;
  const isDayInRange = (day: number) =>
    startDate && endDate && day > startDate && day < endDate;
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

  // ── Interest toggle ───────────────────────────────────────────────
  const toggleInterest = (label: string) => {
    setSelectedInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  // ── Validation & Next ─────────────────────────────────────────────
  const handleNext = () => {
    if (!startDate || !endDate) {
      alert('Please select your travel dates.');
      return;
    }
    if (!budget) {
      alert('Please enter your budget.');
      return;
    }
    if (selectedInterests.length === 0) {
      alert('Please select at least one interest.');
      return;
    }

    // Pass data to next page
    router.push({
      pathname: '/(main)/pick-spots' as any,
      params: {
        city: selectedCity.name,
        startDate: `${currentYear}-${currentMonth + 1}-${startDate}`,
        endDate: `${currentYear}-${currentMonth + 1}-${endDate}`,
        budget,
        interests: selectedInterests.join(','),
      },
    });
  };

  // ── Calendar grid ─────────────────────────────────────────────────
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── City Selector ── */}
        <TouchableOpacity style={styles.cityCard} onPress={() => setShowCityModal(true)} activeOpacity={0.9}>
          <Image source={{ uri: selectedCity.image }} style={styles.cityImage} />
          <View style={styles.cityOverlay}>
            <View style={styles.cityPill}>
              <Text style={styles.cityPillIcon}>📍</Text>
              <Text style={styles.cityPillText}>{selectedCity.name}, Egypt</Text>
              <Text style={styles.cityPillArrow}>▾</Text>
            </View>
          </View>
          <Text style={styles.cityName}>{selectedCity.name}</Text>
        </TouchableOpacity>

        {/* ── Calendar ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select dates</Text>

          {/* Month navigation */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthArrowBtn}>
              <Text style={styles.monthArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[currentMonth]} {currentYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthArrowBtn}>
              <Text style={styles.monthArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {calendarCells.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  day ? (isDaySelected(day) ? styles.dayCellSelected : null) : null,
                  day ? (isDayInRange(day) ? styles.dayCellInRange : null) : null,
                  day ? (isDayToday(day) && !isDaySelected(day) ? styles.dayCellToday : null) : null,
                ]}
                onPress={() => day && handleDayPress(day)}
                disabled={!day}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayCellText,
                  day ? (isDaySelected(day) ? styles.dayCellTextSelected : null) : null,
                  day ? (isDayInRange(day) ? styles.dayCellTextRange : null) : null,
                ]}>
                  {day ?? ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected range display */}
          {startDate && (
            <Text style={styles.selectedRange}>
              {startDate && endDate
                ? `${MONTHS[currentMonth]} ${startDate} → ${MONTHS[currentMonth]} ${endDate}`
                : `From: ${MONTHS[currentMonth]} ${startDate} — select end date`}
            </Text>
          )}
        </View>

        {/* ── Budget ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Budget</Text>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetCurrency}>$</Text>
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

        {/* ── Interests ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Interests</Text>
          <View style={styles.interestsGrid}>
            {INTERESTS.map(interest => (
              <TouchableOpacity
                key={interest.label}
                style={[
                  styles.interestTag,
                  selectedInterests.includes(interest.label) && styles.interestTagSelected,
                ]}
                onPress={() => toggleInterest(interest.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.interestIcon}>{interest.icon}</Text>
                <Text style={[
                  styles.interestLabel,
                  selectedInterests.includes(interest.label) && styles.interestLabelSelected,
                ]}>
                  {interest.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Next Step Button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Next step</Text>
        </TouchableOpacity>
      </View>

      {/* ── City Modal ── */}
      <Modal visible={showCityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={EGYPTIAN_CITIES}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.cityOption,
                    selectedCity.name === item.name && styles.cityOptionSelected,
                  ]}
                  onPress={() => { setSelectedCity(item); setShowCityModal(false); }}
                >
                  <Image source={{ uri: item.image }} style={styles.cityOptionImage} />
                  <Text style={[
                    styles.cityOptionText,
                    selectedCity.name === item.name && styles.cityOptionTextSelected,
                  ]}>
                    {item.name}
                  </Text>
                  {selectedCity.name === item.name && (
                    <Text style={styles.cityOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const CELL_SIZE = (width - 40 - 32) / 7;

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  container: { flex: 1 },

  // City card
  cityCard: { margin: 16, borderRadius: 20, overflow: 'hidden', height: 160 },
  cityImage: { width: '100%', height: '100%' },
  cityOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start', alignItems: 'flex-start',
    padding: 12,
  },
  cityPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, gap: 4,
  },
  cityPillIcon: { fontSize: 12 },
  cityPillText: { fontSize: 13, fontWeight: '600', color: '#333' },
  cityPillArrow: { fontSize: 12, color: '#666' },
  cityName: {
    position: 'absolute', bottom: 14, left: 16,
    fontSize: 28, fontWeight: '800', color: '#FFF',
  },

  // Card
  card: {
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },

  // Calendar
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthArrowBtn: { padding: 8 },
  monthArrow: { fontSize: 22, color: '#333', fontWeight: '600' },
  monthLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  dayHeaders: { flexDirection: 'row', marginBottom: 6 },
  dayHeader: { width: CELL_SIZE, textAlign: 'center', fontSize: 11, color: '#AAA', fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: CELL_SIZE, height: CELL_SIZE,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  dayCellSelected: { backgroundColor: '#E67E22' },
  dayCellInRange: { backgroundColor: '#FFF3E0', borderRadius: 0 },
  dayCellToday: { borderWidth: 1.5, borderColor: '#E67E22' },
  dayCellText: { fontSize: 13, color: '#333', fontWeight: '500' },
  dayCellTextSelected: { color: '#FFF', fontWeight: '700' },
  dayCellTextRange: { color: '#E67E22' },
  selectedRange: { marginTop: 10, fontSize: 13, color: '#E67E22', fontWeight: '600', textAlign: 'center' },

  // Budget
  budgetRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#EEE', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  budgetCurrency: { fontSize: 18, fontWeight: '700', color: '#333', marginRight: 8 },
  budgetInput: { flex: 1, fontSize: 16, color: '#333' },

  // Interests
  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F5F5', borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  interestTagSelected: { backgroundColor: '#FFF3E0', borderColor: '#E67E22' },
  interestIcon: { fontSize: 14 },
  interestLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  interestLabelSelected: { color: '#E67E22', fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 16,
    paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  nextBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // City modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '70%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  modalClose: { fontSize: 18, color: '#999', fontWeight: '600' },
  cityOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F8F8F8', gap: 12,
  },
  cityOptionSelected: { backgroundColor: '#FFF8F0' },
  cityOptionImage: { width: 44, height: 44, borderRadius: 10 },
  cityOptionText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  cityOptionTextSelected: { color: '#E67E22', fontWeight: '700' },
  cityOptionCheck: { fontSize: 16, color: '#E67E22', fontWeight: '700' },
});