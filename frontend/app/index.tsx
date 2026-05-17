import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';

const LOGO = require('../assets/logo.png');

export default function SplashScreen() {
  const router = useRouter();
  const [logoReady, setLogoReady] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Step 1 — preload logo first
  useEffect(() => {
    Asset.loadAsync([LOGO]).then(() => setLogoReady(true));
  }, []);

  // Step 2 — only start animation + timer once logo is ready
  useEffect(() => {
    if (!logoReady) return;

    // Start animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    // Timer + auth check in parallel
    Promise.all([
      new Promise(resolve => setTimeout(resolve, 3500)),
      checkAndRedirect(),
    ]).then(([, route]) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        router.replace(route as any);
      });
    });
  }, [logoReady]);

  const checkAndRedirect = async (): Promise<string> => {
    try {
      const token        = await AsyncStorage.getItem('token');
      const userStr      = await AsyncStorage.getItem('user');
      const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        return user.role === 'admin' ? '/(admin)/dashboard' : '/(main)/home';
      } else if (hasOnboarded) {
        return '/(auth)/login';
      } else {
        return '/onboarding';
      }
    } catch {
      return '/(auth)/login';
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  });

  // Show nothing until logo is preloaded
  if (!logoReady) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { rotate: spin }],
          alignItems: 'center',
        }}
      >
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        Tour Mate
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
        Your AI Travel Companion
      </Animated.Text>
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
    width: 300,
    height: 300,
    marginBottom: 24,
  },
  title: {
    fontSize: 46,
    fontWeight: '800',
    color: '#3E2A1F',
    letterSpacing: 2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#8B6F47',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
});