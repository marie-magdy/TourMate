// frontend/app/(auth)/login.tsx
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../../api';
import { COLORS } from '../../constants/colors';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    await api.post('/auth/login', { email, password });
  };

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Sign in</Text>

      <TextInput
        placeholder="Enter e-mail address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginTop: 20, padding: 12, borderRadius: 10 }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, marginTop: 12, padding: 12, borderRadius: 10 }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          backgroundColor: COLORS.primary,
          padding: 16,
          borderRadius: 30,
          marginTop: 30,
        }}
      >
        <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}