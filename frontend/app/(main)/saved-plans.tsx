// app/(main)/saved-plans.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface SavedPlan {
  id: number;
  city: string;
  start_date: string;
  end_date: string;
  budget: string;
  created_at: string;
  itinerary?: DayPlan[];
}

interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
}

interface Activity {
  id: string;
  time: string;
  title: string;
  icon: string;
  cost_egp?: number;
}

// ── helpers ───────────────────────────────────────────────────────────
const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateRange = (start: string, end: string): string => {
  if (!start) return '';
  const s = new Date(start);
  const e = new Date(end);
  const sLabel = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eLabel = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return start === end ? eLabel : `${sLabel} – ${eLabel}`;
};

const CITY_ICONS: Record<string, MCIconName> = {
  cairo:            'city-variant',
  alexandria:       'waves',
  hurghada:         'beach',
  luxor:            'pillar',
  aswan:            'pyramid',
  'sharm el sheikh':'diving-scuba',
  dahab:            'fish',
  'marsa matrouh':  'waves',
  siwa:             'palm-tree',
  'el gouna':       'island',
};

const cityIcon = (city: string): MCIconName =>
  CITY_ICONS[city?.toLowerCase()] ?? 'map-marker';

// ── Plan Card ─────────────────────────────────────────────────────────
const PlanCard: React.FC<{
  plan: SavedPlan;
  onPress: () => void;
  onDelete: () => void;
}> = ({ plan, onPress, onDelete }) => {
  const days: DayPlan[] = plan.itinerary ?? [];
  const totalStops = days.reduce((s, d) =>
    s + d.activities.filter(a => a.id !== 'start' && a.id !== 'end').length, 0);

  return (
    <TouchableOpacity style={cardStyles.wrap} onPress={onPress} activeOpacity={0.82}>
      <View style={cardStyles.header}>
        <View style={cardStyles.cityIconBox}>
          <MaterialCommunityIcons name={cityIcon(plan.city)} size={26} color="#C4873A" />
        </View>

        <View style={cardStyles.headerMid}>
          <Text style={cardStyles.city}>
            {plan.city.charAt(0).toUpperCase() + plan.city.slice(1)}
          </Text>
          <Text style={cardStyles.dates}>{formatDateRange(plan.start_date, plan.end_date)}</Text>
          <View style={cardStyles.metaRow}>
            <View style={cardStyles.metaChip}>
              <MaterialCommunityIcons name="calendar-range" size={11} color="#A08060" />
              <Text style={cardStyles.metaText}>{days.length} day{days.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={cardStyles.metaChip}>
              <MaterialCommunityIcons name="map-marker-check" size={11} color="#A08060" />
              <Text style={cardStyles.metaText}>{totalStops} stops</Text>
            </View>
            {plan.budget ? (
              <View style={cardStyles.metaChip}>
                <MaterialCommunityIcons name="cash" size={11} color="#A08060" />
                <Text style={cardStyles.metaText}>{plan.budget} EGP</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={cardStyles.headerRight}>
          <Text style={cardStyles.savedDate}>{formatDate(plan.created_at)}</Text>
          <View style={cardStyles.actionRow}>
            <TouchableOpacity
              style={cardStyles.deleteBtn}
              onPress={e => { e.stopPropagation?.(); onDelete(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#E07B39" />
            </TouchableOpacity>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#C4873A" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0E2C8',
    shadowColor: '#C4873A',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cityIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#F0E2C8',
  },
  headerMid: { flex: 1 },
  city: { fontSize: 16, fontWeight: '800', color: '#2C1810', marginBottom: 3 },
  dates: { fontSize: 12, color: '#A08060', fontWeight: '600', marginBottom: 7 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBF5EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: { fontSize: 11, color: '#A08060', fontWeight: '600' },
  headerRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  savedDate: { fontSize: 10, color: '#C0A882' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },
  body: {
    borderTopWidth: 1,
    borderTopColor: '#FBF5EB',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
  },
  emptyText: { fontSize: 13, color: '#C0A882', fontStyle: 'italic' },
  dayBlock: { marginBottom: 14 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dayTitle: { fontSize: 13, fontWeight: '800', color: '#C4873A' },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#F0E2C8',
    marginLeft: 6,
    paddingRight: 4,
  },
  stopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C4873A',
    marginLeft: -5,
    flexShrink: 0,
  },
  stopInfo: { flex: 1 },
  stopTime: { fontSize: 10, color: '#A08060', fontWeight: '600' },
  stopName: { fontSize: 13, color: '#2C1810', fontWeight: '600' },
  stopCost: { fontSize: 11, color: '#C4873A', fontWeight: '700', flexShrink: 0 },
});

// ── SAVED PLANS SCREEN ────────────────────────────────────────────────
export default function SavedPlansScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load userId from AsyncStorage on mount
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const id = raw ? JSON.parse(raw).id : 1;
        setUserId(id);
      } catch (err) {
        console.error('UserId load error:', err);
        setUserId(1);
      }
    };
    loadUserId();
  }, []);

  const fetchPlans = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/plans/${userId}`);
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        console.error('[SavedPlans] non-JSON response:', res.status);
        return;
      }
      const data = await res.json();
      if (data.success) setPlans(data.data ?? []);
    } catch (err) {
      console.error('[SavedPlans] fetch error:', err);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPlans();
      setLoading(false);
    })();
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlans();
    setRefreshing(false);
  }, [fetchPlans]);

  const deletePlan = (id: number) => {
    Alert.alert('Delete plan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' });
            const contentType = res.headers.get('content-type') ?? '';
            const data = contentType.includes('application/json') ? await res.json() : null;
            if (!res.ok || (data && !data.success)) {
              Alert.alert('Error', 'Could not delete plan. Please try again.');
              return;
            }
            setPlans(prev => prev.filter(p => p.id !== id));
          } catch (err) {
            console.error('[SavedPlans] delete error:', err);
            Alert.alert('Error', 'Could not delete plan. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#2C1810" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="bookmark-multiple" size={22} color="#C4873A" />
          <Text style={styles.headerTitle}>My Saved Plans</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#C4873A" />
          <Text style={styles.loadingText}>Loading your plans…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C4873A"
            />
          }
        >
          {plans.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bookmark-off-outline" size={64} color="#DDD0BC" />
              <Text style={styles.emptyTitle}>No saved plans yet</Text>
              <Text style={styles.emptySubtitle}>
                Generate an itinerary and tap the bookmark icon to save it here.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(main)/plan' as any)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="calendar-plus" size={18} color="#FFF" />
                <Text style={styles.emptyBtnText}>Plan a Trip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.countLabel}>
                {plans.length} saved {plans.length === 1 ? 'plan' : 'plans'}
              </Text>
              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onDelete={() => deletePlan(plan.id)}
                  onPress={() =>
                    router.push({
                      pathname: '/(main)/itinerary' as any,
                      params: {
                        planId: String(plan.id),
                        city: plan.city,
                        startDate: plan.start_date,
                        endDate: plan.end_date,
                        budget: plan.budget ?? '0',
                        savedItinerary: JSON.stringify(plan.itinerary ?? []),
                      },
                    })
                  }
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF8F0' },

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

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: '#A08060' },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  countLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A08060',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2C1810',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#A08060',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C4873A',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 12,
    shadowColor: '#C4873A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
