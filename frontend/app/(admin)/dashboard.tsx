// app/(admin)/dashboard.tsx
import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, RefreshControl,
  Alert, TextInput, Modal, Dimensions,
} from 'react-native';
import {
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

interface Stats {
  total_users: number;
  total_attractions: number;
  total_favorites: number;
  total_points: number;
  top_attractions: { name: string; city: string; favorites: number }[];
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  voice_chat_enabled?: boolean;
  is_pro?: boolean;
  cv_enabled?: boolean;
  ar_enabled?: boolean;
  points: number;
  total_earned: number;
  favorites_count: number;
  created_at: string;
}

// ── Stat Card ─────────────────────────────────────────────────────────
const StatCard: React.FC<{ iconName: MCIconName; label: string; value: string | number; color: string }> = ({ iconName, label, value, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <MaterialCommunityIcons name={iconName} size={24} color={color} style={{ marginBottom: 8 }} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ── User Row ──────────────────────────────────────────────────────────
const UserRow: React.FC<{
  user: User;
  onDelete: (id: number, name: string) => void;
  onAddPoints: (user: User) => void;
  onToggleRole: (user: User) => void;
  onManageFeatures: (user: User) => void;
}> = ({ user, onDelete, onAddPoints, onToggleRole, onManageFeatures }) => (
  <View style={styles.userRow}>
    {/* Top: avatar + info */}
    <View style={styles.userRowTop}>
      <View style={[styles.userAvatar, user.role === 'admin' && styles.userAvatarAdmin]}>
        <MaterialCommunityIcons name={user.role === 'admin' ? 'crown' : 'account'} size={20} color={user.role === 'admin' ? '#E67E22' : '#666'} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{user.username}</Text>
          <View style={[styles.roleBadge, user.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
            <Text style={styles.roleBadgeText}>{user.role}</Text>
          </View>
        </View>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Text style={styles.userMeta}>
          <MaterialCommunityIcons name="star" size={12} color="#F39C12" /> {user.points} pts · <MaterialCommunityIcons name="heart" size={12} color="#E74C3C" /> {user.favorites_count} saved
        </Text>
        <Text style={[styles.userMeta, { marginTop: 4 }]}>
          {user.is_pro ? '👑 Pro' : 'Free'}
          {' · '}
          <MaterialCommunityIcons name={user.voice_chat_enabled ? 'microphone' : 'microphone-off'} size={12} color={user.voice_chat_enabled ? '#27AE60' : '#999'} /> Voice
          {' · '}
          <MaterialCommunityIcons name="camera" size={12} color={user.cv_enabled ? '#27AE60' : '#999'} /> CV
          {' · '}
          <MaterialCommunityIcons name="glasses" size={12} color={user.ar_enabled ? '#27AE60' : '#999'} /> AR
        </Text>
      </View>
    </View>

    {/* Bottom: action buttons */}
    <View style={styles.userRowActions}>
      <TouchableOpacity style={[styles.addPtsBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => onAddPoints(user)}>
        <MaterialCommunityIcons name="star-plus" size={14} color="#27AE60" />
        <Text style={styles.addPtsBtnText}>Add pts</Text>
      </TouchableOpacity>

      {/* id=1 is the protected super-admin, can't be touched */}
      {user.id !== 1 && (
        <>
          <TouchableOpacity
            style={[styles.roleBtn, user.role === 'admin' ? styles.roleBtnDemote : styles.roleBtnPromote, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
            onPress={() => onToggleRole(user)}
          >
            <MaterialCommunityIcons name={user.role === 'admin' ? 'arrow-down-bold' : 'arrow-up-bold'} size={14} color="#555" />
            <Text style={styles.roleBtnText}>
              {user.role === 'admin' ? 'Demote' : 'Promote'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voiceAccessBtn, styles.voiceAccessBtnEnable, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
            onPress={() => onManageFeatures(user)}
          >
            <MaterialCommunityIcons name="toggle-switch" size={14} color="#1F7A44" />
            <Text style={[styles.voiceAccessBtnText, styles.voiceAccessBtnTextEnable]}>
              Features
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.deleteUserBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => onDelete(user.id, user.username)}>
            <MaterialCommunityIcons name="trash-can" size={14} color="#E74C3C" />
            <Text style={styles.deleteUserBtnText}>Delete</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
);

// ── Add Points Modal ──────────────────────────────────────────────────
const AddPointsModal: React.FC<{
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (points: number, reason: string) => void;
}> = ({ visible, user, onClose, onConfirm }) => {
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Dismiss keyboard when tapping outside */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>

          {/* KeyboardAvoidingView INSIDE the modal */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  Add Points to {user?.username}
                </Text>

                <Text style={styles.modalLabel}>Points amount</Text>
                <TextInput
                  style={styles.modalInput}
                  value={points}
                  onChangeText={setPoints}
                  keyboardType="numeric"
                  placeholder="e.g. 100"
                  placeholderTextColor="#AAA"
                  returnKeyType="next"
                />

                <Text style={styles.modalLabel}>Reason</Text>
                <TextInput
                  style={styles.modalInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Welcome bonus"
                  placeholderTextColor="#AAA"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      onClose();
                      setPoints('');
                      setReason('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      onConfirm(parseInt(points), reason);
                      setPoints('');
                      setReason('');
                    }}
                  >
                    <Text style={styles.modalConfirmText}>Add Points</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>

        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'attractions'>('overview');
  const [addPtsModal, setAddPtsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [featuresModal, setFeaturesModal] = useState(false);
  const [featureUser, setFeatureUser] = useState<User | null>(null);
  const [featureDraft, setFeatureDraft] = useState({
    is_pro: false,
    voice_chat_enabled: false,
    cv_enabled: false,
    ar_enabled: false,
  });
  const [savingFeatures, setSavingFeatures] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setAdminError(null);
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/auth/admin/stats`),
        fetch(`${API_BASE}/auth/admin/users`),
      ]);
      const [statsData, usersData] = await Promise.all([statsRes.json(), usersRes.json()]);
      if (statsData.success) setStats(statsData.data);
      if (usersData.success) setUsers(usersData.data);
      if (!statsData.success || !usersData.success) {
        setAdminError('Could not load all dashboard data. Pull to refresh.');
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
      setAdminError('Could not connect to admin services. Pull to refresh.');
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const handleDeleteUser = (id: number, name: string) => {
    Alert.alert('Delete User', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/auth/admin/users/${id}`, { method: 'DELETE' });
            setUsers(prev => prev.filter(u => u.id !== id));
            Alert.alert('Done ✓', 'User deleted.');
          } catch { Alert.alert('Error', 'Could not delete user.'); }
        },
      },
    ]);
  };

  const handleToggleRole = (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'promote' : 'demote';
    Alert.alert(
      `${action === 'promote' ? 'Promote' : 'Demote'} User`,
      `Are you sure you want to ${action} "${user.username}" to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'promote' ? 'Promote' : 'Demote',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/auth/admin/users/${user.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
              });
              const data = await res.json();
              if (data.success) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
                Alert.alert('Done ✓', `${user.username} is now a ${newRole}.`);
              }
            } catch { Alert.alert('Error', 'Could not update role.'); }
          },
        },
      ]
    );
  };

  const handleAddPoints = (user: User) => { setSelectedUser(user); setAddPtsModal(true); };

  const handleManageFeatures = (user: User) => {
    setFeatureUser(user);
    setFeatureDraft({
      is_pro: Boolean(user.is_pro),
      voice_chat_enabled: Boolean(user.voice_chat_enabled),
      cv_enabled: Boolean(user.cv_enabled),
      ar_enabled: Boolean(user.ar_enabled),
    });
    setFeaturesModal(true);
  };

  const saveUserFeatures = async () => {
    if (!featureUser) return;
    setSavingFeatures(true);
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${featureUser.id}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featureDraft),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === featureUser.id ? { ...u, ...featureDraft } : u));
        setFeaturesModal(false);
        setFeatureUser(null);
        Alert.alert('Done ✓', `Features updated for ${featureUser.username}.`);
      } else {
        Alert.alert('Error', data.message ?? 'Could not update features.');
      }
    } catch {
      Alert.alert('Error', 'Could not update features.');
    } finally {
      setSavingFeatures(false);
    }
  };

  const confirmAddPoints = async (points: number, reason: string) => {
    if (!selectedUser || isNaN(points) || points <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${selectedUser.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, reason }),
      });
      const data = await res.json();
      if (data.success) {
        setAddPtsModal(false);
        setSelectedUser(null);
        fetchAll();
        Alert.alert('Done ✓', `${points} points added to ${selectedUser.username}!`);
      }
    } catch { Alert.alert('Error', 'Could not add points.'); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.multiRemove(['token', 'user']);
            // setUsers(null);
            router.replace('/(auth)/login');
          } catch (e) {
            Alert.alert('Error', 'Logout failed. Please try again.');
          }
        } },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E67E22" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="crown" size={24} color="#F1C40F" />
            <Text style={styles.headerTitle}>Admin Panel</Text>
          </View>
          <Text style={styles.headerSubtitle}>TourMate Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        {(['overview', 'users', 'attractions'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons 
                name={tab === 'overview' ? 'chart-bar' : tab === 'users' ? 'account-group' : 'bank'} 
                size={16} 
                color={activeTab === tab ? '#FFF' : 'rgba(255,255,255,0.5)'} 
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overview' ? 'Overview' : tab === 'users' ? 'Users' : 'Attractions'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E67E22" />}
      >
        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && stats && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>App Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard iconName="account-group" label="Total Users" value={stats.total_users} color="#3498DB" />
              <StatCard iconName="bank" label="Attractions" value={stats.total_attractions} color="#E67E22" />
              <StatCard iconName="heart" label="Total Favorites" value={stats.total_favorites} color="#E74C3C" />
              <StatCard iconName="star" label="Points Earned" value={stats.total_points} color="#F39C12" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 12 }}>
              <MaterialCommunityIcons name="trophy" size={20} color="#E67E22" />
              <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Most Favorited Attractions</Text>
            </View>
            {stats.top_attractions.map((a, i) => (
              <View key={i} style={styles.topAttractionRow}>
                <Text style={styles.topAttractionRank}>#{i + 1}</Text>
                <View style={styles.topAttractionInfo}>
                  <Text style={styles.topAttractionName}>{a.name}</Text>
                  <Text style={styles.topAttractionCity}>{a.city}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="heart" size={14} color="#E74C3C" />
                  <Text style={styles.topAttractionFavs}>{a.favorites}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.viewAsUserBtn}
              onPress={() => router.push('/(main)/home' as any)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="account-eye" size={18} color="#FFF" />
              <Text style={styles.viewAsUserText}>Preview as User</Text>
            </TouchableOpacity>
          </View>
        )}
        {activeTab === 'overview' && !stats && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                {adminError ?? 'No overview data available yet.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchAll}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>{users.length} Registered Users</Text>
            {users.map(user => (
              <UserRow
                key={user.id}
                user={user}
                onDelete={handleDeleteUser}
                onAddPoints={handleAddPoints}
                onToggleRole={handleToggleRole}
                onManageFeatures={handleManageFeatures}
              />
            ))}
          </View>
        )}

        {/* ── Attractions Tab ── */}
        {activeTab === 'attractions' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Manage Attractions</Text>
            <TouchableOpacity style={[styles.manageBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]} onPress={() => router.push('/(admin)/attractions' as any)}>
              <MaterialCommunityIcons name="bank" size={18} color="#FFF" />
              <Text style={styles.manageBtnText}>View & Edit All Attractions →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddPointsModal
        visible={addPtsModal}
        user={selectedUser}
        onClose={() => { setAddPtsModal(false); setSelectedUser(null); }}
        onConfirm={confirmAddPoints}
      />

      <Modal visible={featuresModal} transparent animationType="slide" onRequestClose={() => setFeaturesModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 32 }]}>
            <Text style={styles.modalTitle}>Features — {featureUser?.username}</Text>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
              Toggle individually or grant full Pro (unlocks all features for the user).
            </Text>
            {([
              ['is_pro', 'TourMate Pro (all features)'],
              ['voice_chat_enabled', 'Voice chat override'],
              ['cv_enabled', 'Computer vision override'],
              ['ar_enabled', 'AR glasses override'],
            ] as const).map(([key, label]) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', flex: 1 }}>{label}</Text>
                <TouchableOpacity
                  onPress={() => setFeatureDraft(d => ({ ...d, [key]: !d[key] }))}
                  style={{
                    backgroundColor: featureDraft[key] ? '#E8F8F0' : '#F5F5F5',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontWeight: '800', color: featureDraft[key] ? '#1F7A44' : '#999' }}>
                    {featureDraft[key] ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFeaturesModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={saveUserFeatures} disabled={savingFeatures}>
                {savingFeatures ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  loadingText: { color: '#FFF', marginTop: 12, fontSize: 14 },

  header: { backgroundColor: '#1A1A1A', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  logoutBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  tabs: { flexDirection: 'row', backgroundColor: '#1A1A1A', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: '#E67E22' },
  tabText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: '#FFF', fontWeight: '800' },

  tabContent: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 12, marginTop: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: (width - 44) / 2, backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },

  topAttractionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  topAttractionRank: { fontSize: 18, fontWeight: '900', color: '#E67E22', width: 30 },
  topAttractionInfo: { flex: 1 },
  topAttractionName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  topAttractionCity: { fontSize: 12, color: '#999', marginTop: 2 },
  topAttractionFavs: { fontSize: 13, fontWeight: '700', color: '#E74C3C' },

  userRow: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  userRowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  userAvatarAdmin: { backgroundColor: '#FFF3E0' },
  userAvatarText: { fontSize: 20 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  roleBadgeAdmin: { backgroundColor: '#FFF3E0' },
  roleBadgeUser: { backgroundColor: '#EEF4FF' },
  roleBadgeText: { fontSize: 10, fontWeight: '800', color: '#E67E22' },
  userEmail: { fontSize: 12, color: '#999', marginTop: 2 },
  userMeta: { fontSize: 11, color: '#BBB', marginTop: 2 },

  userRowActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  addPtsBtn: { backgroundColor: '#E8F8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addPtsBtnText: { color: '#27AE60', fontSize: 12, fontWeight: '800' },
  roleBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  roleBtnPromote: { backgroundColor: '#EEF4FF' },
  roleBtnDemote: { backgroundColor: '#FFF3E0' },
  roleBtnText: { fontSize: 12, fontWeight: '800', color: '#555' },
  voiceAccessBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  voiceAccessBtnEnable: { backgroundColor: '#E8F8F0' },
  voiceAccessBtnDisable: { backgroundColor: '#FDECEC' },
  voiceAccessBtnText: { fontSize: 12, fontWeight: '800' },
  voiceAccessBtnTextEnable: { color: '#1F7A44' },
  voiceAccessBtnTextDisable: { color: '#9B2C2C' },
  deleteUserBtn: { backgroundColor: '#FEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  deleteUserBtnText: { color: '#E74C3C', fontSize: 12, fontWeight: '800' },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  emptyCardText: { fontSize: 13, color: '#777', lineHeight: 20 },
  retryBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#E67E22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  retryBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  manageBtn: { backgroundColor: '#E67E22', borderRadius: 16, padding: 16, alignItems: 'center' },
  manageBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  modalInput: { borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 14, fontSize: 15, color: '#1A1A1A', marginBottom: 16, backgroundColor: '#FAFAFA' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, borderWidth: 2, borderColor: '#EEE', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: '#999', fontSize: 15, fontWeight: '700' },
  modalConfirmBtn: { flex: 2, backgroundColor: '#E67E22', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  viewAsUserBtn: {
  marginTop: 16,
  backgroundColor: '#1A1A1A', // matches header
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 18,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,

  // subtle shadow like cards
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
},

viewAsUserText: {
  color: '#FFF',
  fontSize: 14,
  fontWeight: '800',
},
});