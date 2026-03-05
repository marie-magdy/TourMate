// app/(main)/itinerary.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Modal, TextInput,
  Alert, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

// ── Types ─────────────────────────────────────────────────────────────
interface Activity {
  id: string;
  time: string;
  title: string;
  icon: string;
  category: string;
}

interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
}

// ── Activity icons by category ────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  morning: '🌅',
  food: '🍽️',
  beach: '🏖️',
  adventure: '🏔️',
  history: '🏛️',
  shopping: '🛍️',
  nightlife: '🌙',
  transport: '🚗',
  hotel: '🏨',
  nature: '🌿',
  culture: '🎭',
  diving: '🤿',
  default: '📍',
};

// ── Generate itinerary based on interests + spots ─────────────────────
const generateItinerary = (
  startDate: string,
  endDate: string,
  interests: string[],
  city: string
): DayPlan[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const baseActivities: Activity[][] = [
    // Day template 1
    [
      { id: '1', time: '7:00', title: 'Wake up & freshen up', icon: '🌅', category: 'morning' },
      { id: '2', time: '7:30', title: 'Breakfast at hotel', icon: '🍳', category: 'food' },
      { id: '3', time: '9:00', title: `Explore ${city} old town`, icon: '🏛️', category: 'history' },
      { id: '4', time: '11:00', title: 'Visit local market', icon: '🛍️', category: 'shopping' },
      { id: '5', time: '13:00', title: 'Lunch at local restaurant', icon: '🍽️', category: 'food' },
      { id: '6', time: '15:00', title: 'Beach relaxation', icon: '🏖️', category: 'beach' },
      { id: '7', time: '18:00', title: 'Sunset watching', icon: '🌅', category: 'nature' },
      { id: '8', time: '20:00', title: 'Dinner & evening walk', icon: '🌙', category: 'nightlife' },
    ],
    // Day template 2
    [
      { id: '1', time: '7:00', title: 'Morning workout', icon: '🏃', category: 'morning' },
      { id: '2', time: '8:00', title: 'Breakfast', icon: '🍳', category: 'food' },
      { id: '3', time: '9:30', title: 'Water sports & diving', icon: '🤿', category: 'diving' },
      { id: '4', time: '12:00', title: 'Snorkeling trip', icon: '🐠', category: 'adventure' },
      { id: '5', time: '14:00', title: 'Seafood lunch', icon: '🦞', category: 'food' },
      { id: '6', time: '16:00', title: 'Desert safari', icon: '🏜️', category: 'adventure' },
      { id: '7', time: '19:00', title: 'Bedouin dinner', icon: '🏕️', category: 'culture' },
      { id: '8', time: '21:00', title: 'Night adventures', icon: '🌙', category: 'nightlife' },
    ],
    // Day template 3
    [
      { id: '1', time: '7:00', title: 'Early morning yoga', icon: '🧘', category: 'morning' },
      { id: '2', time: '8:30', title: 'Breakfast buffet', icon: '🥐', category: 'food' },
      { id: '3', time: '10:00', title: 'Historical site tour', icon: '🏛️', category: 'history' },
      { id: '4', time: '12:30', title: 'Cultural museum visit', icon: '🎭', category: 'culture' },
      { id: '5', time: '14:00', title: 'Traditional lunch', icon: '🍽️', category: 'food' },
      { id: '6', time: '16:00', title: 'Shopping in bazaar', icon: '🛍️', category: 'shopping' },
      { id: '7', time: '18:30', title: 'Nature walk', icon: '🌿', category: 'nature' },
      { id: '8', time: '20:30', title: 'Farewell dinner', icon: '🥂', category: 'food' },
    ],
  ];

  // Customize based on interests
  const customizeForInterests = (activities: Activity[]): Activity[] => {
    return activities.map(a => {
      if (interests.includes('Diving') && a.category === 'beach') {
        return { ...a, title: 'Diving & Snorkeling', icon: '🤿', category: 'diving' };
      }
      if (interests.includes('History') && a.category === 'nature') {
        return { ...a, title: 'Archaeological site visit', icon: '🏛️', category: 'history' };
      }
      if (interests.includes('Food') && a.category === 'shopping') {
        return { ...a, title: 'Street food tour', icon: '🍢', category: 'food' };
      }
      if (interests.includes('Adventure') && a.category === 'nightlife') {
        return { ...a, title: 'Night adventure tour', icon: '🌙', category: 'adventure' };
      }
      return a;
    });
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return Array.from({ length: Math.min(dayCount, 7) }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const template = baseActivities[i % baseActivities.length];

    return {
      day: i + 1,
      date: `${MONTHS[date.getMonth()]} ${date.getDate()}`,
      activities: customizeForInterests(
        template.map(a => ({ ...a, id: `${i}-${a.id}` }))
      ),
    };
  });
};

// ── Activity Row ──────────────────────────────────────────────────────
const ActivityRow: React.FC<{
  activity: Activity;
  onDelete: (id: string) => void;
}> = ({ activity, onDelete }) => (
  <View style={styles.activityRow}>
    <View style={styles.activityTimeCol}>
      <Text style={styles.activityTime}>{activity.time}</Text>
    </View>
    <View style={styles.activityLine}>
      <View style={styles.activityDot} />
      <View style={styles.activityConnector} />
    </View>
    <View style={styles.activityContent}>
      <Text style={styles.activityTitle}>{activity.title}</Text>
    </View>
    <View style={styles.activityIconBox}>
      <Text style={styles.activityIcon}>{activity.icon}</Text>
    </View>
    <TouchableOpacity onPress={() => onDelete(activity.id)} style={styles.deleteBtn}>
      <Text style={styles.deleteIcon}>✕</Text>
    </TouchableOpacity>
  </View>
);

// ── ITINERARY SCREEN ──────────────────────────────────────────────────
export default function ItineraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    city: string;
    startDate: string;
    endDate: string;
    budget: string;
    interests: string;
    spotIds: string;
  }>();

  const city = params.city ?? 'Hurghada';
  const interests = params.interests?.split(',') ?? [];
  const startDate = params.startDate ?? new Date().toISOString();
  const endDate = params.endDate ?? new Date().toISOString();

  const [days, setDays] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [newActivityTime, setNewActivityTime] = useState('');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    generatePlan();
  }, []);

  const generatePlan = async (): Promise<void> => {
    setLoading(true);
    // Simulate AI generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    const generated = generateItinerary(startDate, endDate, interests, city);
    setDays(generated);
    setLoading(false);
  };

  // ── Delete activity ───────────────────────────────────────────────
  const deleteActivity = (dayIndex: number, activityId: string): void => {
    setDays(prev => prev.map((d, i) =>
      i === dayIndex
        ? { ...d, activities: d.activities.filter(a => a.id !== activityId) }
        : d
    ));
  };

  // ── Add activity ──────────────────────────────────────────────────
  const addActivity = (): void => {
    if (!newActivityTime || !newActivityTitle) {
      Alert.alert('Missing info', 'Please enter both time and activity name.');
      return;
    }
    const newActivity: Activity = {
      id: `custom-${Date.now()}`,
      time: newActivityTime,
      title: newActivityTitle,
      icon: '📍',
      category: 'default',
    };
    setDays(prev => prev.map((d, i) =>
      i === activeDay
        ? {
            ...d,
            activities: [...d.activities, newActivity].sort((a, b) =>
              a.time.localeCompare(b.time)
            ),
          }
        : d
    ));
    setNewActivityTime('');
    setNewActivityTitle('');
    setShowAddModal(false);
  };

  // ── AI chat ───────────────────────────────────────────────────────
  const sendAIMessage = async (): Promise<void> => {
    if (!aiMessage.trim()) return;
    setAiLoading(true);
    setAiResponse('');

    // Placeholder AI response — replace with real API call later
    await new Promise(resolve => setTimeout(resolve, 1000));
    const responses = [
      `Great choice visiting ${city}! I recommend starting with the most popular spots early in the morning to avoid crowds.`,
      `Based on your interests in ${interests.join(', ')}, I suggest adding a local food tour on Day 1!`,
      `The best time to visit the beach in ${city} is early morning or late afternoon for perfect weather.`,
      `I can help you optimize your route to save time between attractions. Would you like me to reorder your activities?`,
    ];
    setAiResponse(responses[Math.floor(Math.random() * responses.length)]);
    setAiLoading(false);
    setAiMessage('');
  };

  // ── Save plan to backend ──────────────────────────────────────────
  const savePlan = async (): Promise<void> => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          start_date: startDate,
          end_date: endDate,
          budget: params.budget,
          interests,
          spot_ids: params.spotIds?.split(',').map(Number) ?? [],
          itinerary: days,
          user_id: 1, // replace with real user id from auth later
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push({
          pathname: '/(main)/city-intro' as any,
          params: { city, planId: data.data?.id },
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      console.error('Save plan error:', err);
      // If backend not ready yet, still navigate forward
      Alert.alert(
        'Save failed',
        'Could not save to server. Continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => router.push({ pathname: '/(main)/city-intro' as any, params: { city } }),
          },
        ]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingTitle}>✨ Generating your plan...</Text>
        <Text style={styles.loadingSubtitle}>
          Creating a personalized itinerary for {city} based on your interests
        </Text>
      </View>
    );
  }

  const currentDay = days[activeDay];

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add itinerary</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Day tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayTabsScroll}
        contentContainerStyle={styles.dayTabs}
      >
        {days.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.dayTab, activeDay === index && styles.dayTabActive]}
            onPress={() => setActiveDay(index)}
          >
            <Text style={[styles.dayTabLabel, activeDay === index && styles.dayTabLabelActive]}>
              Day {day.day}
            </Text>
            <Text style={[styles.dayTabDate, activeDay === index && styles.dayTabDateActive]}>
              {day.date}
            </Text>
            {activeDay === index && <View style={styles.dayTabUnderline} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Activities list ── */}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {currentDay?.activities.map(activity => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            onDelete={(id) => deleteActivity(activeDay, id)}
          />
        ))}

        {/* Add activity button */}
        <TouchableOpacity
          style={styles.addActivityBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addActivityText}>+ Add activity</Text>
        </TouchableOpacity>

        {/* AI assistant bubble */}
        <TouchableOpacity
          style={styles.aiBubble}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.85}
        >
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarIcon}>🤖</Text>
          </View>
          <View style={styles.aiTextBubble}>
            <Text style={styles.aiText}>Would you like any help with your plan?</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Next Step button ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={savePlan}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.nextBtnText}>Next step</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Add Activity Modal ── */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Activity</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Time (e.g. 14:00)</Text>
            <TextInput
              style={styles.input}
              placeholder="14:00"
              placeholderTextColor="#AAA"
              value={newActivityTime}
              onChangeText={setNewActivityTime}
            />
            <Text style={styles.inputLabel}>Activity name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Visit the museum"
              placeholderTextColor="#AAA"
              value={newActivityTitle}
              onChangeText={setNewActivityTitle}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={addActivity}>
              <Text style={styles.modalBtnText}>Add Activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── AI Chat Modal ── */}
      <Modal visible={showAIChat} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.aiModalTitle}>
                <Text style={styles.aiModalIcon}>🤖</Text>
                <Text style={styles.modalTitle}>Tour Mate AI</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAIChat(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {aiResponse ? (
              <View style={styles.aiResponseBox}>
                <Text style={styles.aiResponseText}>{aiResponse}</Text>
              </View>
            ) : (
              <Text style={styles.aiPlaceholder}>
                Ask me anything about your {city} trip! I can suggest activities, restaurants, or help optimize your schedule.
              </Text>
            )}

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiInput}
                placeholder="Ask Tour Mate AI..."
                placeholderTextColor="#AAA"
                value={aiMessage}
                onChangeText={setAiMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.aiSendBtn, aiLoading && { opacity: 0.6 }]}
                onPress={sendAIMessage}
                disabled={aiLoading}
              >
                {aiLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.aiSendIcon}>→</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },

  // Loading
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9F5F0', paddingHorizontal: 40,
  },
  loadingTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 16, textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  // Day tabs
  dayTabsScroll: { backgroundColor: '#FFF', maxHeight: 70 },
  dayTabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  dayTab: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 12, alignItems: 'center', position: 'relative',
  },
  dayTabActive: { backgroundColor: '#FFF8F0' },
  dayTabLabel: { fontSize: 14, fontWeight: '600', color: '#999' },
  dayTabLabelActive: { color: '#E67E22' },
  dayTabDate: { fontSize: 11, color: '#BBB', marginTop: 2 },
  dayTabDateActive: { color: '#E67E22' },
  dayTabUnderline: {
    position: 'absolute', bottom: 0, left: 10, right: 10,
    height: 2, backgroundColor: '#E67E22', borderRadius: 1,
  },

  // Activities
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 4, minHeight: 52,
  },
  activityTimeCol: { width: 48, paddingTop: 4 },
  activityTime: { fontSize: 12, color: '#999', fontWeight: '500' },
  activityLine: { width: 24, alignItems: 'center', paddingTop: 6 },
  activityDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E67E22', borderWidth: 2, borderColor: '#FFF3E0',
  },
  activityConnector: { width: 2, flex: 1, backgroundColor: '#F0E0D0', marginTop: 2 },
  activityContent: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 12,
    padding: 12, marginLeft: 8, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  activityTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  activityIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center',
    marginLeft: 8, marginTop: 4,
  },
  activityIcon: { fontSize: 16 },
  deleteBtn: { padding: 8, marginTop: 4 },
  deleteIcon: { fontSize: 12, color: '#CCC' },

  // Add activity button
  addActivityBtn: {
    backgroundColor: '#FFF3E0', borderRadius: 30,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#E67E22', borderStyle: 'dashed',
  },
  addActivityText: { fontSize: 15, color: '#E67E22', fontWeight: '700' },

  // AI bubble
  aiBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: 8, gap: 12,
  },
  aiAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center',
  },
  aiAvatarIcon: { fontSize: 22 },
  aiTextBubble: { flex: 1 },
  aiText: { fontSize: 14, color: '#555', lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 20,
    paddingVertical: 16, paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  nextBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#DDD' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  modalClose: { fontSize: 18, color: '#999' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#EEE', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#333', marginBottom: 14,
  },
  modalBtn: {
    backgroundColor: '#E67E22', borderRadius: 30,
    paddingVertical: 14, alignItems: 'center', marginTop: 6,
  },
  modalBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // AI modal
  aiModalTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiModalIcon: { fontSize: 22 },
  aiPlaceholder: { fontSize: 14, color: '#999', lineHeight: 22, marginBottom: 20 },
  aiResponseBox: {
    backgroundColor: '#FFF3E0', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  aiResponseText: { fontSize: 14, color: '#333', lineHeight: 22 },
  aiInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  aiInput: {
    flex: 1, borderWidth: 1, borderColor: '#EEE', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#333',
    maxHeight: 100,
  },
  aiSendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center',
  },
  aiSendIcon: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});