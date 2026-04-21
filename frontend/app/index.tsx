// app/index.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../constants/AppContext'; 

export default function SplashScreen() {
  const router = useRouter();
  // const { setUser } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      // router.replace("/onboarding");
      checkAndRedirect(); // ✅ smart redirect instead of always going to onboarding
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkAndRedirect = async () => {
    try {
      const token        = await AsyncStorage.getItem('token');
      const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');

      if (token) {
        router.replace('/(main)/home' as any);      // already logged in
      } else if (hasOnboarded) {
        router.replace('/(auth)/login' as any);     // seen onboarding before
      } else {
        router.replace('/onboarding' as any);       // first time ever
      }
    } catch {
      router.replace('/(auth)/login' as any);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Tour Mate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8D8B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#3E2A1F',
    letterSpacing: 1,
  },
});