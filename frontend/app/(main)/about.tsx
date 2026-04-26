import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

const getAppVersionLabel = (): string => {
  // Expo SDK 49+ exposes both `expoConfig` (dev) and `manifest` (classic).
  const version =
    (Constants.expoConfig as any)?.version ??
    (Constants.manifest as any)?.version ??
    '1.0.0';

  const build =
    (Constants.expoConfig as any)?.ios?.buildNumber ??
    (Constants.expoConfig as any)?.android?.versionCode ??
    undefined;

  return build ? `${version} (${build})` : version;
};

export default function AboutTourMateScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About TourMate</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandCard}>
          <Text style={styles.brandEmoji}>🧳</Text>
          <Text style={styles.brandTitle}>TourMate</Text>
          <Text style={styles.brandSub}>Your ultimate guide to exploring Egypt</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaPill}>Version {getAppVersionLabel()}</Text>
            <Text style={styles.metaPill}>{Platform.OS.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Quick links</Text>
        <View style={styles.linkCard}>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(main)/privacy' as any)} activeOpacity={0.8}>
            <Text style={styles.linkIcon}>📋</Text>
            <Text style={styles.linkLabel}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(main)/terms' as any)} activeOpacity={0.8}>
            <Text style={styles.linkIcon}>📄</Text>
            <Text style={styles.linkLabel}>Terms of Service</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.h2}>Support</Text>
        <Text style={styles.p}>
          Need help? Use Settings → Contact Us, or email support@tourmate.com.
        </Text>

        <Text style={styles.h2}>Credits</Text>
        <Text style={styles.p}>
          Built with Expo + React Native. Map search uses OpenStreetMap (Nominatim) and routing uses OSRM.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  brandCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  brandEmoji: { fontSize: 36, marginBottom: 6 },
  brandTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A' },
  brandSub: { fontSize: 12, color: '#888', marginTop: 4, textAlign: 'center', fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaPill: { backgroundColor: '#FFF3E0', color: '#8A5A00', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '800' },

  h2: { fontSize: 13, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginTop: 22, marginBottom: 10 },
  p: { fontSize: 13, color: '#444', lineHeight: 20 },

  linkCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  linkIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  linkLabel: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  linkArrow: { fontSize: 22, color: '#CCC' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 52 },
});

