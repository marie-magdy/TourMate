// app/(auth)/login.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, BackHandler, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '@/components/ScreenWrapper';
import { useApp } from '../../constants/AppContext';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from '../../constants/api';
import { Theme } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_ID = '1091318160461-6gaei76c5f9c7ktsm0crab5le3um6nt7.apps.googleusercontent.com';

export default function Login() {
  const { setUser, refreshFeatures } = useApp();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({ email: '', password: '', general: '' });
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'tourmate' });

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_ID,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleLogin(authentication.accessToken);
      }
    }
  }, [response]);

  const handleGoogleLogin = async (accessToken: string) => {
    setGoogleLoading(true);
    try {
      const profileRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();

      const res  = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_id:  profile.id,
          email:      profile.email,
          username:   profile.name,
          avatar_url: profile.picture,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        Alert.alert('Error', data.message ?? 'Google login failed.');
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await setUser(data.user);
      await refreshFeatures(data.user.id);
      router.replace('/(main)/home' as any);
    } catch (err) {
      console.error('Google login error:', err);
      Alert.alert('Error', 'Google login failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    const newErrors = { email: '', password: '', general: '' };
    let hasError = false;

    if (!email) { newErrors.email = 'Email is required'; hasError = true; }
    else if (!validateEmail(email)) { newErrors.email = 'Enter a valid email address'; hasError = true; }
    if (!password) { newErrors.password = 'Password is required'; hasError = true; }

    setErrors(newErrors);
    if (hasError) return;

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors(prev => ({ ...prev, general: data.error ?? 'Invalid credentials.' }));
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await setUser(data.user);
      await refreshFeatures(data.user.id);

      if (data.user.role === 'admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(main)/home' as any);
      }
    } catch {
      setErrors(prev => ({ ...prev, general: 'Could not connect to server. Check your connection.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScreenWrapper>
      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>TourMate</Text>
          <Text style={styles.logoSubtitle}>Your AI Travel Companion</Text>
        </View>

        <Text style={styles.title}>Sign in</Text>



        {/* General error */}
        {errors.general ? (
          <View style={styles.generalError}>
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </View>
        ) : null}

        {/* Email */}
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
            if (errors.general) setErrors(prev => ({ ...prev, general: '' }));
          }}
  onEndEditing={(e) => {
    const val = e.nativeEvent.text.trim();
    if (!val) setErrors(prev => ({ ...prev, email: 'Email is required' }));
    else if (!validateEmail(val)) setErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
    else setEmail(val); // ← make sure state has autofilled value
  }}
          style={[styles.input, errors.email ? styles.inputError : null]}
          placeholderTextColor={Theme.colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        {/* Password */}
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
              if (errors.general) setErrors(prev => ({ ...prev, general: '' }));
            }}
  onEndEditing={(e) => {
    const val = e.nativeEvent.text.trim();
    if (!val) setErrors(prev => ({ ...prev, password: 'Password is required' }));
    else setPassword(val); // ← make sure state has autofilled value
  }}
            style={[styles.passwordInput, errors.password ? styles.inputError : null]}
            placeholderTextColor={Theme.colors.placeholder}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
            testID="toggle-password"
          >
            <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color={Theme.colors.muted} />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        
        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

                {/* Google Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={() => promptAsync()}
          disabled={!request || googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color={Theme.colors.primary} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

                {/* Signup */}
        <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)}>
          <Text style={styles.signupText}>
            Don't have an account? <Text style={styles.signupLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>


        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          style={styles.loginButton}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Theme.colors.white} />
            : <Text style={styles.loginButtonText}>Continue</Text>
          }
        </TouchableOpacity>



      </View>
    </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '900',
    color: Theme.colors.text,
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 14,
    color: Theme.colors.muted,
    marginTop: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 16,
  },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: 30,
    padding: 14,
    gap: 10,
    backgroundColor: Theme.colors.card,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.darkText,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '600',
  },

  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    color: Theme.colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.inputBorder,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.inputBg,
  },
  inputError: {
    borderColor: Theme.colors.error,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 14,
  },
  generalError: {
    backgroundColor: Theme.colors.errorBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  generalErrorText: {
    color: Theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.inputBorder,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.inputBg,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
  },

  loginButton: {
    backgroundColor: Theme.colors.primary,
    padding: 16,
    borderRadius: 30,
    marginTop: 24,
    alignItems: 'center',
  },
  loginButtonText: {
    fontWeight: '800',
    color: Theme.colors.white,
    fontSize: 16,
  },

  signupText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: Theme.colors.muted,
  },
  signupLink: {
    textDecorationLine: 'underline',
    color: Theme.colors.primary,
    fontWeight: '600',
  },
});