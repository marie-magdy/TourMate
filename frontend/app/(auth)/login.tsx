// app/(auth)/login.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenWrapper from '@/components/ScreenWrapper';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const [errors, setErrors] = useState({ email: '', password: '', general: '' });

  const router = useRouter();

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    const newErrors = { email: '', password: '', general: '' };
    let hasError = false;

    if (!email) {
      newErrors.email = 'Email is required';
      hasError = true;
    } else if (!validateEmail(email)) {
      newErrors.email = 'Enter a valid email address';
      hasError = true;
    }
    if (!password) {
      newErrors.password = 'Password is required';
      hasError = true;
    }

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
        // ✅ server errors show inline instead of Alert
        setErrors(prev => ({ ...prev, general: data.error ?? 'Invalid credentials.' }));
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(main)/home' as any);
      }
    } catch (err) {
      console.error(err);
      setErrors(prev => ({ ...prev, general: 'Could not connect to server. Check your connection.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="briefcase-outline" size={52} color="#E67E22" style={{ marginBottom: 8 }} />
          <Text style={styles.logoText}>TourMate</Text>
          <Text style={styles.logoSubtitle}>Your Egyptian adventure awaits</Text>
        </View>

        <Text style={styles.title}>Sign in</Text>

        {/* General error (wrong credentials / network) */}
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
          onBlur={() => {
            if (!email) setErrors(prev => ({ ...prev, email: 'Email is required' }));
            else if (!validateEmail(email)) setErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
          }}
          style={[styles.input, errors.email ? styles.inputError : null]}
          placeholderTextColor="#999"
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
            onBlur={() => {
              if (!password) setErrors(prev => ({ ...prev, password: 'Password is required' }));
            }}
            style={[styles.passwordInput, errors.password ? styles.inputError : null]}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={24} color="#888" />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FFF', justifyContent: 'center' },

  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoEmoji:     { fontSize: 48, marginBottom: 8 },
  logoText:      { fontSize: 28, fontWeight: '900', color: '#1A1A1A' },
  logoSubtitle:  { fontSize: 14, color: '#999', marginTop: 4 },

  title:      { fontSize: 26, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  inputLabel: { fontSize: 15, fontWeight: '600', marginTop: 16, color: '#333', marginBottom: 6 },

  input:         { borderWidth: 1, borderColor: '#E0E0E0', padding: 14, borderRadius: 14, fontSize: 16, color: '#000', backgroundColor: '#FAFAFA' },
  inputError:    { borderColor: '#E53935' },
  errorText:     { color: '#E53935', fontSize: 12, marginTop: 4, marginLeft: 14 },

  // ✅ new: banner for server errors like "Invalid credentials"
  generalError:     { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginBottom: 8 },
  generalErrorText: { color: '#C62828', fontSize: 14, textAlign: 'center' },

  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  passwordInput:     { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', padding: 14, borderRadius: 14, fontSize: 16, color: '#000', backgroundColor: '#FAFAFA' },
  eyeIcon:           { position: 'absolute', right: 16 },

  loginButton:     { backgroundColor: '#E67E22', padding: 16, borderRadius: 30, marginTop: 28, alignItems: 'center' },
  loginButtonText: { fontWeight: '800', color: '#FFF', fontSize: 16 },

  signupText: { marginTop: 16, textAlign: 'center', fontSize: 14, color: '#444' },
  signupLink: { textDecorationLine: 'underline', color: '#E67E22', fontWeight: '600' },
});