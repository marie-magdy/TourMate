import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

/** Web build: native maps are unavailable; Expo resolves this file instead of `map.tsx`. */
export default function MapWebScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.card}>
        <Text style={styles.title}>Map is mobile-only</Text>
        <Text style={styles.body}>
          This screen uses native map components. Use the iOS or Android app for the full map.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F1E8', padding: 24, justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    top: 24,
    left: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  backText: { color: '#333333', fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2937' },
  body: { fontSize: 15, lineHeight: 22, color: '#5B6470' },
});
