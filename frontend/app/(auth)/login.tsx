// frontend/app/(auth)/login.tsx
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../constants/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const raw = process.env.EXPO_PUBLIC_API_URL ?? 'localhost';
const baseURL = raw.startsWith('http') ? `${raw}/api` : `http://${raw}:3000/api`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const router = useRouter();
  const { setUser, refreshFeatures } = useApp();

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email || email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!password || password.trim() === '') {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.error || 'Login failed. Please try again.' });
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      setUser(data.user);
      await refreshFeatures();

      if (data.user.role === 'admin') {
        (router as any).replace('/(admin)/dashboard');
      } else {
        (router as any).replace('/(main)/home');
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') console.error('Login error:', err);
      setErrors({ general: 'Could not connect to server. Check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      {/* General Error */}
      {errors.general && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errors.general}</Text>
        </View>
      )}

      {/* Email Field */}
      <Text style={styles.inputLabel}>Email</Text>
      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
        }}
        style={[styles.input, errors.email ? styles.inputError : null]}
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

      {/* Password Field */}
      <Text style={styles.inputLabel}>Password</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
          }}
          style={[styles.passwordInput, errors.password ? styles.inputError : null]}
          placeholderTextColor="#999"
          editable={!loading}
        />
        <TouchableOpacity
          testID="toggle-password"
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
          disabled={loading}
        >
          <Ionicons
            name={showPassword ? 'eye' : 'eye-off'}
            size={24}
            color={loading ? '#ccc' : '#888'}
          />
        </TouchableOpacity>
      </View>
      {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

      <TouchableOpacity
        onPress={handleLogin}
        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginButtonText}>Continue</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading}
      >
        <Text style={[styles.signupText, loading && { opacity: 0.5 }]}>
          Don&apos;t have an account? <Text style={styles.signupLink}>Sign up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldError: {
    color: '#c33',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 6,
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#000',
  },
  inputError: {
    borderColor: '#f44',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 30,
    marginTop: 30,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 16,
  },
  signupText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: '#444',
  },
  signupLink: {
    textDecorationLine: 'underline',
    color: '#007AFF',
    fontWeight: '600',
  },
});
