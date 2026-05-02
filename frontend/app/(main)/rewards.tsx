// app/(main)/rewards.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Dimensions,
  Animated, Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

interface UserPoints { points: number; total_earned: number; }
interface Reward { id: number; title: string; description: string; points_required: number; category: string; icon: string; }
interface HistoryItem { id: number; points: number; action: string; description: string; created_at: string; }

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const LEVELS: { name: string; min: number; max: number; color: string; iconName: MCIconName }[] = [
  { name: 'Explorer',    min: 0,     max: 500,   color: '#8B7355', iconName: 'compass-outline' },
  { name: 'Adventurer',  min: 500,   max: 1500,  color: '#2D6A4F', iconName: 'tent' },
  { name: 'Trailblazer', min: 1500,  max: 3000,  color: '#0077B6', iconName: 'lightning-bolt' },
  { name: 'Legend',      min: 3000,  max: 99999, color: '#E67E22', iconName: 'crown' },
];

const getLevel = (total: number) => LEVELS.find(l => total >= l.min && total < l.max) ?? LEVELS[0];

// ── Celebration Modal ─────────────────────────────────────────────────
const CelebrationModal: React.FC<{ visible: boolean; reward: Reward | null; onClose: () => void }> = ({ visible, reward, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      // Reset animation first
      scaleAnim.setValue(0);
      
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 150,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        // Animate out before closing
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onClose()); // ← close AFTER animation finishes
      }, 3000);

      return () => clearTimeout(timer);

    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]); // ← remove onClose from dependencies

  return (
    <Modal   
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    >
      <View style={styles.celebrationOverlay}>
        <Animated.View style={[styles.celebrationCard, { transform: [{ scale: scaleAnim }] }]}>
          <MaterialCommunityIcons name="party-popper" size={48} color="#E67E22" style={{ marginBottom: 8 }} />
          <Text style={styles.celebrationTitle}>Reward Redeemed!</Text>
          <Text style={styles.celebrationRewardIcon}>{reward?.icon}</Text>
          <Text style={styles.celebrationRewardName}>{reward?.title}</Text>
          <Text style={styles.celebrationDesc}>{reward?.description}</Text>
          <Text style={styles.celebrationNote}>Show this screen at any partner location to claim your reward!</Text>
          <TouchableOpacity style={styles.celebrationBtn} onPress={onClose}>
            <Text style={styles.celebrationBtnText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Reward Card ───────────────────────────────────────────────────────
const RewardCard: React.FC<{
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
}> = ({ reward, userPoints, onRedeem }) => {
  const canAfford  = userPoints >= reward.points_required;
  const progress   = Math.min(userPoints / reward.points_required, 1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 800, useNativeDriver: false }).start();
  }, [progress]);

  return (
    <View style={[styles.rewardCard, !canAfford && styles.rewardCardLocked]}>
      <View style={styles.rewardCardTop}>
        <View style={[styles.rewardIconBox, canAfford && styles.rewardIconBoxActive]}>
          <Text style={styles.rewardIcon}>{reward.icon}</Text>
        </View>
        <View style={styles.rewardInfo}>
          <Text style={styles.rewardTitle}>{reward.title}</Text>
          <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description}</Text>
        </View>
        <View style={styles.rewardPointsBadge}>
          <Text style={styles.rewardPointsNum}>{reward.points_required}</Text>
          <Text style={styles.rewardPointsLabel}>pts</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, {
          width: progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }),
          backgroundColor: canAfford ? '#27AE60' : '#E67E22',
        }]} />
      </View>
      <Text style={styles.progressLabel}>
        {canAfford ? '✓ Ready to redeem!' : `${reward.points_required - userPoints} more points needed`}
      </Text>

      <TouchableOpacity
        style={[styles.redeemBtn, !canAfford && styles.redeemBtnDisabled]}
        onPress={() => canAfford && onRedeem(reward)}
        disabled={!canAfford}
        activeOpacity={0.85}
      >
        <Text style={[styles.redeemBtnText, !canAfford && styles.redeemBtnTextDisabled]}>
          {canAfford ? 'Redeem Now' : 'Locked'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ── History Item ──────────────────────────────────────────────────────
const HistoryRow: React.FC<{ item: HistoryItem }> = ({ item }) => {
  const isEarn   = item.points > 0;
  const date     = new Date(item.created_at);
  const dateStr  = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ACTION_ICONS: Record<string, MCIconName> = {
    walk: 'walk', checkin: 'map-marker', favorite: 'heart', plan: 'map', redeem: 'gift-outline', visit: 'airplane-takeoff', default: 'star',
  };
  const iconName: MCIconName = ACTION_ICONS[item.action] ?? ACTION_ICONS.default;

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIconBox}>
        <MaterialCommunityIcons name={iconName} size={18} color={isEarn ? '#27AE60' : '#E67E22'} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyAction}>{item.description ?? item.action}</Text>
        <Text style={styles.historyDate}>{dateStr}</Text>
      </View>
      <Text style={[styles.historyPoints, { color: isEarn ? '#27AE60' : '#E74C3C' }]}>
        {isEarn ? '+' : ''}{item.points} pts
      </Text>
    </View>
  );
};

// ── REWARDS SCREEN ────────────────────────────────────────────────────
export default function RewardsScreen() {
  const router = useRouter();
  const [userPoints, setUserPoints]   = useState<UserPoints | null>(null);
  const [rewards, setRewards]         = useState<Reward[]>([]);
  const [history, setHistory]         = useState<HistoryItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'rewards' | 'history'>('rewards');
  const [celebrating, setCelebrating] = useState(false);
  const [redeemedReward, setRedeemedReward] = useState<Reward | null>(null);
  const [userId, setUserId] = useState<number>(1);

  const pointsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchAll(); }, []);

  const handleCloseCelebration = () => {
    setCelebrating(false);
    // Small delay before clearing reward to avoid flicker
    setTimeout(() => setRedeemedReward(null), 300);
  };
  const fetchAll = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      const storedUser = raw ? JSON.parse(raw) : null;
      const userId = storedUser?.id ?? 1;

      const [pRes, rRes, hRes] = await Promise.all([
        fetch(`${API_BASE}/points/${userId}`),
        fetch(`${API_BASE}/points/rewards/all`),
        fetch(`${API_BASE}/points/${userId}/history`),
      ]);
      const [pData, rData, hData] = await Promise.all([pRes.json(), rRes.json(), hRes.json()]);
      setUserPoints(pData.data);
      setRewards(rData.data ?? []);
      setHistory(hData.data ?? []);
      setUserId(userId);

      // Animate points counter
      Animated.timing(pointsAnim, {
        toValue: pData.data?.points ?? 0,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    } catch (err) { console.error('Rewards fetch error:', err); }
    finally { setLoading(false); }
  };

  const handleRedeem = (reward: Reward) => {
    Alert.alert(
      'Redeem Reward',
      `Redeem "${reward.title}" for ${reward.points_required} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem!',
          onPress: async () => {
            try {
              const res  = await fetch(`${API_BASE}/points/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, reward_id: reward.id }),
              });
              const data = await res.json();
              if (data.success) {
                setUserPoints(data.data);
                setRedeemedReward(reward);
                setCelebrating(true);
                fetchAll();
              } else {
                Alert.alert('Error', data.message);
              }
            } catch { Alert.alert('Error', 'Could not redeem reward'); }
          },
        },
      ]
    );
  };

  const level     = getLevel(userPoints?.total_earned ?? 0);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const levelProgress = nextLevel
    ? (((userPoints?.total_earned ?? 0) - level.min) / (nextLevel.min - level.min))
    : 1;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Points Hero ── */}
        <View style={styles.pointsHero}>
          <View style={styles.levelBadge}>
            <MaterialCommunityIcons name={level.iconName} size={18} color="#FFD580" />
            <Text style={styles.levelName}>{level.name}</Text>
          </View>
          <Animated.Text style={styles.pointsNumber}>
            {pointsAnim.interpolate({ inputRange: [0, userPoints?.points ?? 0], outputRange: ['0', String(userPoints?.points ?? 0)] })}
          </Animated.Text>
          <Text style={styles.pointsLabel}>available points</Text>
          <Text style={styles.totalEarned}>Total earned: {userPoints?.total_earned ?? 0} pts</Text>

          {/* Level progress */}
          {nextLevel && (
            <View style={styles.levelProgress}>
              <View style={styles.levelProgressBar}>
                <View style={[styles.levelProgressFill, { width: `${levelProgress * 100}%`, backgroundColor: level.color }]} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Text style={styles.levelProgressLabel}>
                  {nextLevel.min - (userPoints?.total_earned ?? 0)} pts to
                </Text>
                <MaterialCommunityIcons name={nextLevel.iconName} size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.levelProgressLabel}>{nextLevel.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── How to Earn ── */}
        <View style={styles.howToEarn}>
          <Text style={styles.howToEarnTitle}>How to earn points</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.earnPills}>
            {([
              { iconName: 'walk'            as MCIconName, label: 'Walk to attraction', pts: '+50' },
              { iconName: 'map-marker'      as MCIconName, label: 'Check in',           pts: '+30' },
              { iconName: 'heart'           as MCIconName, label: 'Save favorite',      pts: '+10' },
              { iconName: 'map'             as MCIconName, label: 'Complete plan',      pts: '+100' },
              { iconName: 'airplane-takeoff'as MCIconName, label: 'Visit new city',     pts: '+75' },
            ]).map((item, i) => (
              <View key={i} style={styles.earnPill}>
                <MaterialCommunityIcons name={item.iconName} size={22} color="#E67E22" style={{ marginBottom: 4 }} />
                <Text style={styles.earnPillLabel}>{item.label}</Text>
                <Text style={styles.earnPillPts}>{item.pts}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rewards' && styles.tabActive]}
            onPress={() => setActiveTab('rewards')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="gift-outline" size={15} color={activeTab === 'rewards' ? '#1A1A1A' : '#999'} />
              <Text style={[styles.tabText, activeTab === 'rewards' && styles.tabTextActive]}>Rewards</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="clock-outline" size={15} color={activeTab === 'history' ? '#1A1A1A' : '#999'} />
              <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Rewards List ── */}
        {activeTab === 'rewards' && (
          <View style={styles.rewardsList}>
            {rewards.map(reward => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={userPoints?.points ?? 0}
                onRedeem={handleRedeem}
              />
            ))}
          </View>
        )}

        {/* ── History List ── */}
        {activeTab === 'history' && (
          <View style={styles.historyList}>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="#CCC" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyHistoryText}>No activity yet — start exploring to earn points!</Text>
              </View>
            ) : (
              history.map(item => <HistoryRow key={item.id} item={item} />)
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <CelebrationModal
        visible={celebrating}
        reward={redeemedReward}
        onClose= {handleCloseCelebration}
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#F9F5F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F5F0' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1A1A1A' },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backIcon:    { color: '#FFF', fontSize: 20, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  // Points hero
  pointsHero:    { backgroundColor: '#1A1A1A', paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8, alignItems: 'center' },
  levelBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, gap: 6, marginBottom: 16 },
  levelIcon:     { fontSize: 16 },
  levelName:     { color: '#FFD580', fontSize: 13, fontWeight: '700' },
  pointsNumber:  { fontSize: 64, fontWeight: '900', color: '#FFF', lineHeight: 70 },
  pointsLabel:   { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  totalEarned:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  levelProgress: { width: '100%' },
  levelProgressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  levelProgressFill: { height: '100%', borderRadius: 3 },
  levelProgressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  // How to earn
  howToEarn:      { backgroundColor: '#FFF', margin: 16, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  howToEarnTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  earnPills:      { flexDirection: 'row' },
  earnPill:       { alignItems: 'center', backgroundColor: '#F9F5F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, minWidth: 90 },
  earnPillIcon:   { fontSize: 22, marginBottom: 4 },
  earnPillLabel:  { fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 4 },
  earnPillPts:    { fontSize: 13, fontWeight: '800', color: '#E67E22' },

  // Tabs
  tabs:          { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#EDEBE8', borderRadius: 14, padding: 4, marginBottom: 16 },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive:     { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#1A1A1A', fontWeight: '700' },

  // Rewards
  rewardsList: { paddingHorizontal: 16, gap: 12 },
  rewardCard:  { backgroundColor: '#FFF', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 12 },
  rewardCardLocked: { opacity: 0.85 },
  rewardCardTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  rewardIconBox:    { width: 52, height: 52, borderRadius: 16, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  rewardIconBoxActive: { backgroundColor: '#FFF3E0' },
  rewardIcon:       { fontSize: 26 },
  rewardInfo:       { flex: 1 },
  rewardTitle:      { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  rewardDesc:       { fontSize: 12, color: '#888', lineHeight: 17 },
  rewardPointsBadge:{ alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  rewardPointsNum:  { fontSize: 18, fontWeight: '900', color: '#E67E22' },
  rewardPointsLabel:{ fontSize: 10, color: '#E67E22', fontWeight: '600' },
  progressBarBg:    { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill:  { height: '100%', borderRadius: 3 },
  progressLabel:    { fontSize: 11, color: '#999', marginBottom: 10 },
  redeemBtn:        { backgroundColor: '#E67E22', borderRadius: 30, paddingVertical: 12, alignItems: 'center' },
  redeemBtnDisabled:{ backgroundColor: '#F0F0F0' },
  redeemBtnText:    { color: '#FFF', fontSize: 14, fontWeight: '700' },
  redeemBtnTextDisabled: { color: '#BBB' },

  // History
  historyList:      { paddingHorizontal: 16 },
  historyRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  historyIconBox:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  historyIcon:      { fontSize: 18 },
  historyContent:   { flex: 1 },
  historyAction:    { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  historyDate:      { fontSize: 11, color: '#999', marginTop: 2 },
  historyPoints:    { fontSize: 15, fontWeight: '800' },
  emptyHistory:     { alignItems: 'center', paddingVertical: 40 },
  emptyHistoryEmoji:{ fontSize: 40, marginBottom: 12 },
  emptyHistoryText: { fontSize: 14, color: '#999', textAlign: 'center' },

  // Celebration
  celebrationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  celebrationCard:    { backgroundColor: '#FFF', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%' },
  celebrationEmoji:   { fontSize: 48, marginBottom: 8 },
  celebrationTitle:   { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginBottom: 16 },
  celebrationRewardIcon: { fontSize: 52, marginBottom: 8 },
  celebrationRewardName: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  celebrationDesc:    { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  celebrationNote:    { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18, marginBottom: 24, backgroundColor: '#F9F5F0', padding: 12, borderRadius: 12 },
  celebrationBtn:     { backgroundColor: '#E67E22', borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center' },
  celebrationBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});