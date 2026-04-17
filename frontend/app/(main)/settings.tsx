// app/(main)/settings.tsx
import React, { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, SafeAreaView, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp, CurrencyCode, Language } from '../../constants/AppContext';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const USER_ID  = 1;

interface SettingRowProps {
  icon: React.ReactNode; label: string; value?: string;
  onPress?: () => void; showArrow?: boolean; danger?: boolean;
}
interface ToggleRowProps {
  icon: React.ReactNode; label: string; value: boolean; onToggle: (v: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, value, onPress, showArrow = true, danger = false }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.settingLeft}>
      <View style={styles.settingIconView}>{icon}</View>
      <Text style={[styles.settingLabel, danger && styles.dangerText]}>{label}</Text>
    </View>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {showArrow && <Text style={[styles.settingArrow, danger && styles.dangerText]}>›</Text>}
    </View>
  </TouchableOpacity>
);

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <View style={styles.settingIconView}>{icon}</View>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    <Switch value={value} onValueChange={onToggle} trackColor={{ false: '#DDD', true: '#E67E22' }} thumbColor="#FFF" />
  </View>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const Divider = () => <View style={styles.divider} />;

// ── Change Password Modal ─────────────────────────────────────────────
const ChangePasswordModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const reset = () => { setCurrent(''); setNewPass(''); setConfirm(''); };

  const handleSave = async () => {
    if (!current || !newPass || !confirm) { Alert.alert('Error', 'All fields are required.'); return; }
    if (newPass !== confirm) { Alert.alert('Error', 'New passwords do not match.'); return; }
    if (newPass.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/user/${USER_ID}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: newPass }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success ✓', 'Password changed successfully!');
        reset(); onClose();
      } else {
        Alert.alert('Error', data.message ?? 'Could not change password.');
      }
    } catch { Alert.alert('Error', 'Could not connect to server.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Change Password</Text>
          {[
            { label: 'Current Password', value: current, setter: setCurrent },
            { label: 'New Password',     value: newPass, setter: setNewPass },
            { label: 'Confirm New Password', value: confirm, setter: setConfirm },
          ].map(f => (
            <View key={f.label} style={styles.modalFieldGroup}>
              <Text style={styles.modalFieldLabel}>{f.label}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={f.value}
                  onChangeText={f.setter}
                  secureTextEntry={!showPass}
                  placeholder="••••••••"
                  placeholderTextColor="#AAA"
                  autoCapitalize="none"
                />
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={() => setShowPass(p => !p)} style={{ marginBottom: 16 }}>
            <Text style={{ color: '#E67E22', fontSize: 13, fontWeight: '600' }}>
              {showPass ? 'Hide passwords' : 'Show passwords'}
            </Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalConfirmText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Edit Profile Modal ────────────────────────────────────────────────
const EditProfileModal: React.FC<{
  visible: boolean; onClose: () => void;
  currentName: string; currentEmail: string;
  onSaved: (name: string, email: string) => void;
}> = ({ visible, onClose, currentName, currentEmail, onSaved }) => {
  const [name, setName]   = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setName(currentName); setEmail(currentEmail); }, [currentName, currentEmail]);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) { Alert.alert('Error', 'Name and email are required.'); return; }
    if (!email.includes('@')) { Alert.alert('Error', 'Please enter a valid email.'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/user/${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved(name.trim(), email.trim());
        Alert.alert('Saved ✓', 'Profile updated!');
        onClose();
      } else {
        Alert.alert('Error', data.message ?? 'Could not update profile.');
      }
    } catch { Alert.alert('Error', 'Could not connect to server.'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <View style={styles.modalFieldGroup}>
            <Text style={styles.modalFieldLabel}>Display Name</Text>
            <TextInput style={styles.modalInput} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#AAA" />
          </View>
          <View style={styles.modalFieldGroup}>
            <Text style={styles.modalFieldLabel}>Email</Text>
            <TextInput style={styles.modalInput} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor="#AAA" keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalConfirmText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── MAIN SETTINGS SCREEN ──────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage, currency, setCurrency, isRTL } = useApp();

  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPoints, setUserPoints] = useState(0);
  const [loadingUser, setLoadingUser] = useState(true);

  const [showEditProfile, setShowEditProfile]       = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [notifications, setNotifications]       = useState(true);
  const [darkMode, setDarkMode]                 = useState(false);
  const [locationServices, setLocationServices] = useState(true);

  useEffect(() => { fetchUser(); loadPreferences(); }, []);

  const fetchUser = async () => {
    try {
      const [userRes, pointsRes] = await Promise.all([
        fetch(`${API_BASE}/auth/user/${USER_ID}`),
        fetch(`${API_BASE}/points/${USER_ID}`),
      ]);
      const userData   = await userRes.json();
      const pointsData = await pointsRes.json();
      if (userData.success)   { setUserName(userData.data.name); setUserEmail(userData.data.email); }
      if (pointsData.success) setUserPoints(pointsData.data?.points ?? 0);
    } catch { setUserName('Traveler'); setUserEmail(''); }
    finally { setLoadingUser(false); }
  };

  const loadPreferences = async () => {
    try {
      const raw = await AsyncStorage.getItem('preferences');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.notifications    !== undefined) setNotifications(p.notifications);
        if (p.darkMode         !== undefined) setDarkMode(p.darkMode);
        if (p.locationServices !== undefined) setLocationServices(p.locationServices);
      }
    } catch {}
  };

  const savePref = async (update: object) => {
    try {
      const raw   = await AsyncStorage.getItem('preferences');
      const prefs = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem('preferences', JSON.stringify({ ...prefs, ...update }));
    } catch {}
  };

  const handleToggleNotifications = (val: boolean) => {
    setNotifications(val); savePref({ notifications: val });
    Alert.alert(val ? 'Notifications On' : 'Notifications Off', val ? 'You will receive travel tips and updates.' : 'You will no longer receive notifications.');
  };

  const handleToggleDarkMode = (val: boolean) => {
    setDarkMode(val); savePref({ darkMode: val });
    Alert.alert(val ? 'Dark Mode Enabled' : 'Light Mode Enabled', 'Restart the app to apply the theme change.');
  };

  const handleToggleLocation = (val: boolean) => {
    setLocationServices(val); savePref({ locationServices: val });
    if (!val) Alert.alert('Location Off', 'Map and walkability features require location services.');
  };

  const LANG_DISPLAY: Record<Language, string> = { en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch' };

  const handleLanguage = () => {
    Alert.alert(t('selectLanguage'), '', [
      { text: 'English',  onPress: () => setLanguage('en') },
      { text: 'العربية',  onPress: () => setLanguage('ar') },
      { text: 'Français', onPress: () => setLanguage('fr') },
      { text: 'Deutsch',  onPress: () => setLanguage('de') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const CURRENCY_DISPLAY: Record<CurrencyCode, string> = { USD: 'USD ($)', EGP: 'EGP (ج.م)', EUR: 'EUR (€)', GBP: 'GBP (£)', SAR: 'SAR (ر.س)' };

  const handleCurrency = () => {
    Alert.alert(t('selectCurrency'), '', [
      { text: 'USD ($)',    onPress: () => setCurrency('USD') },
      { text: 'EGP (ج.م)', onPress: () => setCurrency('EGP') },
      { text: 'EUR (€)',    onPress: () => setCurrency('EUR') },
      { text: 'GBP (£)',    onPress: () => setCurrency('GBP') },
      { text: 'SAR (ر.س)', onPress: () => setCurrency('SAR') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This clears temporary data. Your account and favorites are safe.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const user  = await AsyncStorage.getItem('user');
            const prefs = await AsyncStorage.getItem('preferences');
            await AsyncStorage.clear();
            if (token) await AsyncStorage.setItem('token', token);
            if (user)  await AsyncStorage.setItem('user', user);
            if (prefs) await AsyncStorage.setItem('preferences', prefs);
            Alert.alert('Done ✓', 'Cache cleared successfully.');
          } catch { Alert.alert('Error', 'Could not clear cache.'); }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently deletes your account, favorites, and all points. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Forever', style: 'destructive',
        onPress: async () => {
          try {
            const res  = await fetch(`${API_BASE}/auth/user/${USER_ID}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              await AsyncStorage.clear();
              Alert.alert('Deleted', 'Your account has been permanently deleted.', [
                { text: 'OK', onPress: () => router.replace('/(auth)/login' as any) },
              ]);
            } else { Alert.alert('Error', 'Could not delete account.'); }
          } catch { Alert.alert('Error', 'Could not connect to server.'); }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settingsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Profile Card ── */}
        {loadingUser ? (
          <View style={styles.profileCardLoading}><ActivityIndicator color="#E67E22" /></View>
        ) : (
          <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={() => setShowEditProfile(true)}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userName ? userName[0].toUpperCase() : '?'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName || 'Traveler'}</Text>
              <Text style={styles.profileEmail}>{userEmail || ''}</Text>
              <Text style={styles.profileEditHint}>{t('tapToEditProfile')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Rewards Banner ── */}
        <TouchableOpacity style={styles.rewardsBanner} onPress={() => router.push('/(main)/rewards' as any)} activeOpacity={0.85}>
          <View style={styles.rewardsBannerLeft}>
            <MaterialCommunityIcons name="star-circle" size={32} color="#E67E22" />
            <View>
              <Text style={styles.rewardsBannerTitle}>{t('yourPoints')}</Text>
              <Text style={styles.rewardsBannerSub}>{t('tapToViewRewards')}</Text>
            </View>
          </View>
          <View style={styles.rewardsBannerRight}>
            <Text style={styles.rewardsBannerPoints}>{userPoints}</Text>
            <Text style={styles.rewardsBannerPts}>{t('pts')}</Text>
          </View>
        </TouchableOpacity>

        {/* ── Account ── */}
        <SectionHeader title={t('account')} />
        <View style={styles.section}>
          <SettingRow icon={<MaterialCommunityIcons name="account-outline"    size={20} color="#555" />} label={t('editProfile')}     onPress={() => setShowEditProfile(true)} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="lock-outline"       size={20} color="#555" />} label={t('changePassword')}  onPress={() => setShowChangePassword(true)} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="gift-outline"       size={20} color="#555" />} label={t('rewardsPoints')} value={`${userPoints} ${t('pts')}`} onPress={() => router.push('/(main)/rewards' as any)} />
        </View>

        {/* ── Preferences ── */}
        <SectionHeader title={t('preferences')} />
        <View style={styles.section}>
          <SettingRow   icon={<MaterialCommunityIcons name="web"                  size={20} color="#555" />} label={t('language')}         value={LANG_DISPLAY[language]}     onPress={handleLanguage} />
          <Divider />
          <SettingRow   icon={<MaterialCommunityIcons name="currency-usd"        size={20} color="#555" />} label={t('currency')}         value={CURRENCY_DISPLAY[currency]} onPress={handleCurrency} />
          <Divider />
          <ToggleRow    icon={<MaterialCommunityIcons name="bell-outline"         size={20} color="#555" />} label={t('notifications')}    value={notifications}    onToggle={handleToggleNotifications} />
          <Divider />
          <ToggleRow    icon={<MaterialCommunityIcons name="map-marker-outline"   size={20} color="#555" />} label={t('locationServices')} value={locationServices} onToggle={handleToggleLocation} />
          <Divider />
          <ToggleRow    icon={<MaterialCommunityIcons name="weather-night"        size={20} color="#555" />} label={t('darkMode')}         value={darkMode}         onToggle={handleToggleDarkMode} />
        </View>

        {/* ── App ── */}
        <SectionHeader title={t('appSection')} />
        <View style={styles.section}>
          <SettingRow icon={<MaterialCommunityIcons name="delete-outline"          size={20} color="#555" />} label={t('clearCache')}    onPress={handleClearCache} showArrow={false} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="information-outline"    size={20} color="#555" />} label="About TourMate" value="v1.0.0" onPress={() => Alert.alert('TourMate v1.0.0', 'Your ultimate guide to exploring Egypt. Made with love in Egypt.')} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="shield-outline"         size={20} color="#555" />} label="Privacy Policy"  onPress={() => Alert.alert('Privacy Policy', 'We respect your privacy. Your data is never sold to third parties.')} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="file-document-outline"  size={20} color="#555" />} label="Terms of Service" onPress={() => Alert.alert('Terms of Service', 'By using TourMate you agree to use the app responsibly.')} />
        </View>

        {/* ── Support ── */}
        <SectionHeader title={t('support')} />
        <View style={styles.section}>
          <SettingRow icon={<MaterialCommunityIcons name="star-outline"   size={20} color="#555" />} label="Rate TourMate" onPress={() => Alert.alert('Rate TourMate', 'Thank you for your support!')} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="email-outline"  size={20} color="#555" />} label="Contact Us"    value="support@tourmate.com" onPress={() => Alert.alert('Contact Us', 'Email: support@tourmate.com\nWe reply within 24 hours!')} />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="bug-outline"    size={20} color="#555" />} label="Report a Bug"  onPress={() => Alert.alert('Report Bug', 'Email: bugs@tourmate.com\nThank you for helping us improve!')} />
        </View>

        {/* ── Account Actions ── */}
        <SectionHeader title={t('accountActions')} />
        <View style={styles.section}>
          <SettingRow icon={<MaterialCommunityIcons name="logout"        size={20} color="#E74C3C" />} label={t('logout')}         onPress={handleLogout}        showArrow={false} danger />
          <Divider />
          <SettingRow icon={<MaterialCommunityIcons name="alert-outline" size={20} color="#E74C3C" />} label={t('deleteAccount')} onPress={handleDeleteAccount} showArrow={false} danger />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLogo}>TourMate</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.footerMade}>Made with</Text>
            <MaterialCommunityIcons name="heart" size={13} color="#E74C3C" />
            <Text style={styles.footerMade}>in Egypt</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        currentName={userName}
        currentEmail={userEmail}
        onSaved={(name, email) => { setUserName(name); setUserEmail(email); }}
      />
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon:    { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  profileCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 20, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 14 },
  profileCardLoading: { height: 90, marginHorizontal: 16, marginTop: 20, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  avatarCircle:       { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center' },
  avatarInitial:      { fontSize: 26, fontWeight: '900', color: '#FFF' },
  profileInfo:        { flex: 1 },
  profileName:        { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  profileEmail:       { fontSize: 13, color: '#999', marginTop: 2 },
  profileEditHint:    { fontSize: 11, color: '#E67E22', marginTop: 4, fontWeight: '600' },

  rewardsBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', marginHorizontal: 16, marginTop: 14, borderRadius: 20, padding: 16 },
  rewardsBannerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardsBannerEmoji:  { fontSize: 28 },
  rewardsBannerTitle:  { fontSize: 15, fontWeight: '800', color: '#FFF' },
  rewardsBannerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  rewardsBannerRight:  { alignItems: 'center' },
  rewardsBannerPoints: { fontSize: 28, fontWeight: '900', color: '#E67E22' },
  rewardsBannerPts:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: -2 },

  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20, marginTop: 24, marginBottom: 8 },
  section:       { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  divider:       { height: 1, backgroundColor: '#F5F5F5', marginLeft: 52 },

  settingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon:  { fontSize: 20, width: 28, textAlign: 'center' },  // legacy – kept for safety
  settingIconView: { width: 28, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: 14, color: '#999' },
  settingArrow: { fontSize: 22, color: '#CCC' },
  dangerText:   { color: '#E74C3C' },

  footer:        { alignItems: 'center', paddingVertical: 28 },
  footerLogo:    { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginBottom: 4 },
  footerVersion: { fontSize: 12, color: '#CCC', marginBottom: 2 },
  footerMade:    { fontSize: 12, color: '#CCC' },

  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 20 },
  modalFieldGroup: { marginBottom: 16 },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  modalInput:      { borderWidth: 1, borderColor: '#EEE', borderRadius: 14, padding: 14, fontSize: 15, color: '#1A1A1A', backgroundColor: '#FAFAFA' },
  passwordRow:     { flexDirection: 'row', alignItems: 'center' },
  modalActions:    { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn:  { flex: 1, borderWidth: 2, borderColor: '#EEE', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: '#999', fontSize: 15, fontWeight: '700' },
  modalConfirmBtn: { flex: 2, backgroundColor: '#E67E22', borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText:{ color: '#FFF', fontSize: 15, fontWeight: '700' },
});