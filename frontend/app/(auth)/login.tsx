// frontend/app/(auth)/login.tsx
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { api } from '../../api';
import { COLORS } from '../../constants/colors';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/login', { email, password });
      // Store token if needed (you might want to use AsyncStorage)
      console.log('Login successful:', response.data);
      (router as any).replace('/(main)/home');
    } catch (error) {
      let errorMessage = 'Login failed. Please try again.';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout. Check your internet connection.';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          errorMessage = 'Cannot connect to server. Check your API_URL configuration.';
        } else if (error.response?.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (error.response?.status === 400) {
          errorMessage = error.response.data?.error || 'Invalid input.';
        } else if (error.response?.status === 404) {
          errorMessage = 'User not found.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message === 'Network Error') {
          errorMessage = 'Network error. Check your connection and API_URL.';
        }
      }
      
      setError(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Email Field */}
      <Text style={styles.inputLabel}>Email</Text>
      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />

      {/* Password Field */}
      <Text style={styles.inputLabel}>Password</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={styles.passwordInput}
          placeholderTextColor="#999"
          editable={!loading}
        />
        <TouchableOpacity
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

      {/* Small signup text below the button */}
      <TouchableOpacity 
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading}
      >
        <Text style={[styles.signupText, loading && { opacity: 0.5 }]}>
          Don't have an account? <Text style={styles.signupLink}>Sign up</Text>
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