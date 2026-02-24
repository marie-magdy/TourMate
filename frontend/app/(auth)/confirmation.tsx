import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { COLORS } from '../../constants/colors';

export default function Confirmation() {
  const { username, email } = useLocalSearchParams<{
    username: string;
    email: string;
  }>();

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        {username}
      </Text>

      <Text style={{ marginTop: 20, color: '#777' }}>
        E-mail address
      </Text>
      <TextInput
        value={email}
        editable={false}
        style={{
          borderWidth: 1,
          marginTop: 8,
          padding: 12,
          borderRadius: 20,
          backgroundColor: '#f5f5f5',
        }}
      />

      <Text style={{ marginTop: 20, color: '#777' }}>
        Password
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value="************"
          editable={false}
          secureTextEntry
          style={{
            flex: 1,
            borderWidth: 1,
            marginTop: 8,
            padding: 12,
            borderRadius: 20,
            backgroundColor: '#f5f5f5',
          }}
        />

        <TouchableOpacity
          style={{
            backgroundColor: COLORS.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            marginLeft: 10,
            marginTop: 8,
          }}
        >
          <Text style={{ fontWeight: 'bold' }}>Change</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: COLORS.primary,
          padding: 16,
          borderRadius: 30,
          marginTop: 40,
        }}
      >
        <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>
          Save Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}