// app/(main)/settings.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';

// ── Types ─────────────────────────────────────────────────────────────
interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

interface ToggleRowProps {
  icon: string;
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}

// ── Setting Row ───────────────────────────────────────────────────────
const SettingRow: React.FC<SettingRowProps> = ({
  icon, label, value, onPress, showArrow = true, danger = false,
}) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.settingLeft}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <Text style={[styles.settingLabel, danger && styles.dangerText]}>{label}</Text>
    </View>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {showArrow && <Text style={[styles.settingArrow, danger && styles.dangerText]}>›</Text>}
    </View>
  </TouchableOpacity>
);

// ── Toggle Row ────────────────────────────────────────────────────────
const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#DDD', true: '#E67E22' }}
      thumbColor="#FFF"
    />
  </View>
);

// ── Section Header ────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

// ── SETTINGS SCREEN ───────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();

  // Preferences state
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('USD');

  // ── Language picker ───────────────────────────────────────────────
  const handleLanguage = () => {
    Alert.alert(
      'Select Language',
      '',
      [
        { text: 'English', onPress: () => setLanguage('English') },
        { text: 'العربية', onPress: () => setLanguage('العربية') },
        { text: 'Français', onPress: () => setLanguage('Français') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Currency picker ───────────────────────────────────────────────
  const handleCurrency = () => {
    Alert.alert(
      'Select Currency',
      '',
      [
        { text: 'USD ($)', onPress: () => setCurrency('USD') },
        { text: 'EGP (ج.م)', onPress: () => setCurrency('EGP') },
        { text: 'EUR (€)', onPress: () => setCurrency('EUR') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Clear cache ───────────────────────────────────────────────────
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the app cache?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => Alert.alert('Done', 'Cache cleared successfully.'),
        },
      ]
    );
  };

  // ── Logout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => router.replace('/(auth)/login' as any),
        },
      ]
    );
  };

  // ── Change password ───────────────────────────────────────────────
  const handleChangePassword = () => {
    Alert.alert('Coming Soon', 'Change password will be available soon.');
  };

  // ── Contact ───────────────────────────────────────────────────────
  const handleContact = () => {
    Alert.alert('Contact Us', 'Email us at: support@tourmate.com');
  };

  // ── Rate app ──────────────────────────────────────────────────────
  const handleRate = () => {
    Alert.alert('Rate TourMate', 'Thank you for supporting us! ⭐');
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Profile Card ── */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.85}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Your Name</Text>
            <Text style={styles.profileEmail}>your@email.com</Text>
          </View>
          <Text style={styles.profileArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <SettingRow
            icon="👤"
            label="Edit Profile"
            onPress={() => Alert.alert('Coming Soon', 'Edit profile will be available soon.')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🔒"
            label="Change Password"
            onPress={handleChangePassword}
          />
        </View>

        {/* ── Preferences ── */}
        <SectionHeader title="Preferences" />
        <View style={styles.section}>
          <SettingRow
            icon="🌐"
            label="Language"
            value={language}
            onPress={handleLanguage}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="💰"
            label="Currency"
            value={currency}
            onPress={handleCurrency}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="🔔"
            label="Notifications"
            value={notifications}
            onToggle={setNotifications}
          />
        </View>

        {/* ── App ── */}
        <SectionHeader title="App" />
        <View style={styles.section}>
          <ToggleRow
            icon="🌙"
            label="Dark Mode"
            value={darkMode}
            onToggle={setDarkMode}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🗑️"
            label="Clear Cache"
            onPress={handleClearCache}
          />
        </View>

        {/* ── Support ── */}
        <SectionHeader title="Support" />
        <View style={styles.section}>
          <SettingRow
            icon="ℹ️"
            label="About TourMate"
            onPress={() => Alert.alert('TourMate', 'Version 1.0.0\nMade with ❤️ in Egypt')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="⭐"
            label="Rate the App"
            onPress={handleRate}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="📧"
            label="Contact Us"
            onPress={handleContact}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="🐛"
            label="Report a Bug"
            onPress={() => Alert.alert('Report Bug', 'Email us at: bugs@tourmate.com')}
          />
        </View>

        {/* ── Logout ── */}
        <View style={styles.section}>
          <SettingRow
            icon="🚪"
            label="Logout"
            onPress={handleLogout}
            showArrow={false}
            danger
          />
        </View>

        {/* Version */}
        <Text style={styles.version}>TourMate v1.0.0</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  container: { flex: 1 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  profileEmail: { fontSize: 13, color: '#999', marginTop: 2 },
  profileArrow: { fontSize: 22, color: '#CCC' },

  // Section
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginLeft: 52,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  settingLabel: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: 14, color: '#999' },
  settingArrow: { fontSize: 22, color: '#CCC' },
  dangerText: { color: '#E74C3C' },

  // Version
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#CCC',
    marginTop: 24,
  },
});