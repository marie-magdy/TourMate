import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE } from '../constants/api';
import { Theme } from '../constants/theme';

interface ProUpgradeModalProps {
  visible: boolean;
  userId: number;
  onClose: () => void;
  onUpgraded: () => void;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function ProUpgradeModal({
  visible,
  userId,
  onClose,
  onUpgraded,
}: ProUpgradeModalProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const cvvRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setCardName('');
      Keyboard.dismiss();
    }
  }, [visible]);

  const dismissKeyboard = () => Keyboard.dismiss();

  const handleUpgrade = async () => {
    dismissKeyboard();
    if (!userId) {
      Alert.alert('Sign in required', 'Please log in to upgrade to TourMate Pro.');
      return;
    }
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13) {
      Alert.alert('Invalid card', 'Please enter your full card number.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      Alert.alert('Invalid expiry', 'Enter expiry as MM/YY.');
      return;
    }
    if (cvv.replace(/\D/g, '').length < 3) {
      Alert.alert('Invalid CVV', 'Enter the 3- or 4-digit security code on your card.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          card_number: cardNumber,
          expiry: expiry.trim(),
          cvv: cvv.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Payment successful', 'Welcome to TourMate Pro! All premium features are now unlocked.');
        onUpgraded();
        onClose();
      } else {
        Alert.alert('Payment declined', data.message ?? 'Could not process your card. Please check the details and try again.');
      }
    } catch {
      Alert.alert('Connection error', 'Could not reach the payment service. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        dismissKeyboard();
        onClose();
      }}
    >
      <Pressable style={styles.overlay} onPress={dismissKeyboard}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              bounces
              nestedScrollEnabled
            >
              <View style={styles.sheet}>
                <View style={styles.secureRow}>
                  <MaterialCommunityIcons name="lock" size={16} color="#27AE60" />
                  <Text style={styles.secureText}>Secure checkout</Text>
                </View>

                <MaterialCommunityIcons name="crown" size={40} color="#E67E22" />
                <Text style={styles.title}>TourMate Pro</Text>
                <Text style={styles.subtitle}>99 EGP / month · Cancel anytime</Text>

                <View style={styles.benefitsBox}>
                  {[
                    'Unlimited AI chat',
                    'Voice chat mode',
                    'Landmark photo recognition',
                    'Smart glasses / AR mode',
                    'Unlimited plan coach',
                  ].map(line => (
                    <Text key={line} style={styles.benefitLine}>✓ {line}</Text>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Name on card</Text>
                <TextInput
                  style={styles.input}
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="As shown on card"
                  placeholderTextColor="#AAA"
                  autoCapitalize="words"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => expiryRef.current?.focus()}
                />

                <Text style={styles.fieldLabel}>Card number</Text>
                <TextInput
                  style={styles.input}
                  value={cardNumber}
                  onChangeText={t => setCardNumber(formatCardNumber(t))}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor="#AAA"
                  keyboardType="number-pad"
                  maxLength={19}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => expiryRef.current?.focus()}
                />

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>Expiry</Text>
                    <TextInput
                      ref={expiryRef}
                      style={styles.input}
                      value={expiry}
                      onChangeText={t => setExpiry(formatExpiry(t))}
                      placeholder="MM/YY"
                      placeholderTextColor="#AAA"
                      keyboardType="number-pad"
                      maxLength={5}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => cvvRef.current?.focus()}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>CVV</Text>
                    <TextInput
                      ref={cvvRef}
                      style={styles.input}
                      value={cvv}
                      onChangeText={t => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••"
                      placeholderTextColor="#AAA"
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={dismissKeyboard}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleUpgrade}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="credit-card-check" size={20} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryBtnText}>Pay 99 EGP</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    dismissKeyboard();
                    onClose();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  sheet: {
    backgroundColor: Theme.colors.card,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  secureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#27AE60',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Theme.colors.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 4,
  },
  benefitsBox: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  benefitLine: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: '600',
  },
  fieldLabel: {
    alignSelf: 'stretch',
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: Theme.colors.text,
    backgroundColor: '#FAFAFA',
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
  },
  half: { flex: 1 },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#E67E22',
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 12,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 10,
    padding: 8,
  },
  secondaryBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
