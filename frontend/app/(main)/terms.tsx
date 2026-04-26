import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: April 20, 2026</Text>

        <Text style={styles.h2}>Using the app</Text>
        <Text style={styles.p}>
          By using TourMate, you agree to use the app responsibly and comply with applicable laws.
        </Text>

        <Text style={styles.h2}>Accounts</Text>
        <Text style={styles.p}>
          You’re responsible for keeping your account information accurate and your login credentials secure.
        </Text>

        <Text style={styles.h2}>Points & rewards</Text>
        <Text style={styles.p}>
          Points are provided as a feature of the app and may change over time. Abusive behavior (including cheating walk verification) may result in loss
          of points or account actions.
        </Text>

        <Text style={styles.h2}>Content & availability</Text>
        <Text style={styles.p}>
          We work to keep the app reliable, but we don’t guarantee uninterrupted availability or that all information is always correct.
        </Text>

        <Text style={styles.h2}>Contact</Text>
        <Text style={styles.p}>
          Questions? Contact support@tourmate.com.
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
