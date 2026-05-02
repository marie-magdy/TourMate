import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function MapWebScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.title}>Map View Is Mobile Only</Text>
        <Text style={styles.body}>
          This screen uses native map components, so it is available in Expo Go on
          Android/iPhone but not in the browser.
        </Text>
        <Text style={styles.body}>
          You can still test the rest of the app on web, then use the phone later
          for the full map experience.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(`http://${process.env.EXPO_PUBLIC_API_URL}:3000`)}
        >
          <Text style={styles.buttonText}>Open Backend URL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F1E8',
    padding: 24,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 24,
    left: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  backText: {
    color: '#333333',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5B6470',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#D97706',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
