// frontend/app/(auth)/signup.tsx
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { api } from '../../api';
import { COLORS } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const handleSignUp = async () => {
    if (!name || !email || !password || !repeatPassword) {
      setError('Please fill all fields');
      return;
    }

    if (password !== repeatPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/register', { name, email, password });
      (router as any).push({
        pathname: '/(auth)/confirmation',
        params: { name, email },
      });
    } catch (error) {
      let errorMessage = 'Sign up failed. Please try again.';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout. Check your internet connection.';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          errorMessage = 'Cannot connect to server. Check your API_URL configuration.';
        } else if (error.response?.status === 400) {
          errorMessage = error.response.data?.error || 'Invalid input. Please check your details.';
        } else if (error.response?.status === 409) {
          errorMessage = 'Email already registered. Please use a different email.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message === 'Network Error') {
          errorMessage = 'Network error. Check your connection and API_URL.';
        }
      }
      
      setError(errorMessage);
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Sign up</Text>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Name */}
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          placeholder="Enter your full name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor="#999"
          editable={!loading}
        />

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
          editable={!loading}
        />

        {/* Password */}
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Create a password"
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

        {/* Repeat Password */}
        <Text style={styles.inputLabel}>Repeat Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Repeat your password"
            secureTextEntry={!showRepeatPassword}
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            style={styles.passwordInput}
            placeholderTextColor="#999"
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => setShowRepeatPassword(!showRepeatPassword)}
            style={styles.eyeIcon}
            disabled={loading}
          >
            <Ionicons
              name={showRepeatPassword ? 'eye' : 'eye-off'}
              size={24}
              color={loading ? '#ccc' : '#888'}
            />
          </TouchableOpacity>
        </View>

        {/* Sign up button */}
        <TouchableOpacity 
          onPress={handleSignUp} 
          style={[styles.signupButton, loading && styles.signupButtonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        

        {/* Already have account */}
        <TouchableOpacity 
          onPress={() => router.push('/(auth)/login')}
          disabled={loading}
        >
          <Text style={[styles.loginText, loading && { opacity: 0.5 }]}>
            Already have an account? <Text style={styles.loginLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
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
    borderRadius: 20,
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
    borderRadius: 20,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
  },
  signupButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 30,
    marginTop: 30,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 16,
  },
  loginText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: '#444',
  },
  loginLink: {
    textDecorationLine: 'underline',
    color: '#007AFF',
    fontWeight: '600',
  },
});