// app/(auth)/login.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../constants/AppContext';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { API_BASE } from '../../constants/api';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_ID = '1091318160461-6gaei76c5f9c7ktsm0crab5le3um6nt7.apps.googleusercontent.com';

export default function Login() {
  const { setUser } = useApp();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  // ── Google Auth ───────────────────────────────────────────────────
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'tourmate',
  });

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
      // Fetch user info from Google
      const profileRes  = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();

      // Send to our backend to create/login the user
      const res  = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_id: profile.id,
          email: profile.email,
          username: profile.name,
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

      router.replace('/(main)/home' as any);
    } catch (err) {
      console.error('Google login error:', err);
      Alert.alert('Error', 'Google login failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email Login ───────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Login Failed', data.error ?? 'Invalid credentials.');
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await setUser(data.user);

      if (data.user.role === 'admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(main)/home' as any);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not connect to server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoEmoji}>🧳</Text>
        <Text style={styles.logoText}>TourMate</Text>
        <Text style={styles.logoSubtitle}>Your Egyptian adventure awaits</Text>
      </View>

      <Text style={styles.title}>Sign in</Text>

      {/* Google Button */}
      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => promptAsync()}
        disabled={!request || googleLoading}
        activeOpacity={0.85}
      >
        {googleLoading ? (
          <ActivityIndicator color="#333" />
        ) : (
          <>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email */}
      <Text style={styles.inputLabel}>Email</Text>
      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password */}
      <Text style={styles.inputLabel}>Password</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={styles.passwordInput}
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Login Button */}
      <TouchableOpacity onPress={handleLogin} style={styles.loginButton} disabled={loading} activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.loginButtonText}>Continue</Text>
        }
      </TouchableOpacity>

      {/* Signup */}
      <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)}>
        <Text style={styles.signupText}>
          Don't have an account? <Text style={styles.signupLink}>Sign up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FFF', justifyContent: 'center' },

  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoEmoji:     { fontSize: 48, marginBottom: 8 },
  logoText:      { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  logoSubtitle:  { fontSize: 14, color: '#999', marginTop: 4 },

  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', marginBottom: 16 },

  // Google button
  googleButton:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 30, padding: 14, gap: 10, backgroundColor: '#FFF' },
  googleIcon:       { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleButtonText: { fontSize: 15, fontWeight: '700', color: '#333' },

  // Divider
  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { fontSize: 13, color: '#999', fontWeight: '600' },

  inputLabel: { fontSize: 15, fontWeight: '600', marginTop: 4, color: '#333', marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: '#E0E0E0', padding: 14, borderRadius: 14, fontSize: 16, color: '#000', backgroundColor: '#FAFAFA' },

  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  passwordInput:     { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', padding: 14, borderRadius: 14, fontSize: 16, color: '#000', backgroundColor: '#FAFAFA' },
  eyeIcon:           { position: 'absolute', right: 16 },

  loginButton:     { backgroundColor: '#E67E22', padding: 16, borderRadius: 30, marginTop: 24, alignItems: 'center' },
  loginButtonText: { fontWeight: '800', color: '#FFF', fontSize: 16 },

  signupText: { marginTop: 16, textAlign: 'center', fontSize: 14, color: '#444' },
  signupLink: { textDecorationLine: 'underline', color: '#E67E22', fontWeight: '600' },
});