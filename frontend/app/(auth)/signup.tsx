// frontend/app/(auth)/signup.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { api } from '../../api';
import { COLORS } from '../../constants/colors';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  // ✅ one error state per field
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
  });

  const router = useRouter();

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSignUp = async () => {
    // reset all errors first
    const newErrors = { username: '', email: '', password: '', repeatPassword: '' };
    let hasError = false;

    if (!username) {
      newErrors.username = 'Username is required';
      hasError = true;
    }
    
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
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      hasError = true;
    }
    if (!repeatPassword) {
      newErrors.repeatPassword = 'Please repeat your password';
      hasError = true;
    } else if (password !== repeatPassword) {
      newErrors.repeatPassword = 'Passwords do not match';
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) return; // ✅ stops here instantly, no server call

    // inside handleSignUp, replace the try block with:
    try {
      const res = await api.post('/auth/register', { username, email, password });
      
      // ← save user to AsyncStorage just like login does
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('user', JSON.stringify({
        id: res.data.id,
        username: res.data.username,
        email: res.data.email,
        role: res.data.role,
      }));

      (router as any).push({
        pathname: '/(auth)/confirmation',
        params: { username, email, userId: res.data.id, token: res.data.token },
      });
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Sign up failed';
      setErrors(prev => ({ ...prev, email: message }));
    }
  };

  return (
    <ScreenWrapper scroll>
      <View style={styles.container}>
        <Text style={styles.title}>Sign up</Text>

        {/* Username */}
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput
          placeholder="Enter your username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
          }}
          onBlur={() => {                                               // fires when user leaves field
            if (!username) setErrors(prev => ({ ...prev, username: 'Username is required' }));
            if (username.length < 3) setErrors(prev => ({ ...prev, username: 'Username must be at least 3 characters' }));

          }}
          style={[styles.input, errors.username ? styles.inputError : null]}
          placeholderTextColor="#999"
        />
        {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

        {/* Email */}
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
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
            placeholder="Create a password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
            }}
            onBlur={() => {                                           
              if (!password) setErrors(prev => ({ ...prev, password: 'Password is required' }));
              else if (password.length < 6) setErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
            }}
            style={[styles.passwordInput, errors.password ? styles.inputError : null]}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <MaterialCommunityIcons name={showPassword ? 'eye' : 'eye-off'} size={24} color="#888" />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        {/* Repeat Password */}
        <Text style={styles.inputLabel}>Repeat Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Repeat your password"
            secureTextEntry={!showRepeatPassword}
            value={repeatPassword}
            onChangeText={(text) => {
              setRepeatPassword(text);
              if (errors.repeatPassword) setErrors(prev => ({ ...prev, repeatPassword: '' }));
            }}
            onBlur={() => {                                             // ✅
              if (!repeatPassword) setErrors(prev => ({ ...prev, repeatPassword: 'Please repeat your password' }));
              else if (password !== repeatPassword) setErrors(prev => ({ ...prev, repeatPassword: 'Passwords do not match' }));
            }}
            style={[styles.passwordInput, errors.repeatPassword ? styles.inputError : null]}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowRepeatPassword(!showRepeatPassword)} style={styles.eyeIcon}>
            <MaterialCommunityIcons name={showRepeatPassword ? 'eye' : 'eye-off'} size={24} color="#888" />
          </TouchableOpacity>
        </View>
        {errors.repeatPassword ? <Text style={styles.errorText}>{errors.repeatPassword}</Text> : null}
        <TouchableOpacity onPress={handleSignUp} style={styles.signupButton}>
          <Text style={styles.signupButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  inputLabel: { fontSize: 16, fontWeight: '600', marginTop: 16, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ccc', marginTop: 6,
    padding: 14, borderRadius: 20, fontSize: 16, color: '#000',
  },
  inputError: {
    borderColor: '#E53935', 
  },
  errorText: {
    color: '#E53935',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 14,
  },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  passwordInput: {
    flex: 1, borderWidth: 1, borderColor: '#ccc',
    padding: 14, borderRadius: 20, fontSize: 16, color: '#000',
  },
  eyeIcon: { position: 'absolute', right: 20 },
  signupButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 30, marginTop: 30 },
  signupButtonText: { textAlign: 'center', fontWeight: 'bold', color: '#fff', fontSize: 16 },
  loginText: { marginTop: 16, textAlign: 'center', fontSize: 14, color: '#444' },
  loginLink: { textDecorationLine: 'underline', color: '#007AFF', fontWeight: '600' },
});