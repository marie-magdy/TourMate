import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: April 20, 2026</Text>

        <Text style={styles.h2}>What we collect</Text>
        <Text style={styles.p}>
          TourMate may collect basic account information (name, email) and app usage data required to provide features like rewards/points.
        </Text>

        <Text style={styles.h2}>Location</Text>
        <Text style={styles.p}>
          If you enable Location Services, we use your device location to show your position on the map and to power walkability features. You can disable
          this anytime in Settings.
        </Text>

        <Text style={styles.h2}>How we use data</Text>
        <Text style={styles.p}>
          We use your data to operate the app, improve features, and keep your account secure. We do not sell your personal data.
        </Text>

        <Text style={styles.h2}>Third‑party services</Text>
        <Text style={styles.p}>
          TourMate may use third‑party APIs for maps, routing, search, and exchange rates. These services may process network requests needed to provide
          the feature.
        </Text>

        <Text style={styles.h2}>Contact</Text>
        <Text style={styles.p}>
          If you have questions about privacy, contact us at support@tourmate.com.
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

  updated: { fontSize: 12, color: '#888', marginBottom: 14, fontWeight: '600' },
  h2: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 14, marginBottom: 6 },
  p: { fontSize: 13, color: '#444', lineHeight: 20 },
});
