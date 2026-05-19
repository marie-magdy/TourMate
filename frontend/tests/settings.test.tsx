import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

const mockSetLanguage = jest.fn();
const mockSetCurrency = jest.fn();
const mockSetUser = jest.fn();
jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    language: 'en',
    setLanguage: mockSetLanguage,
    currency: 'EGP',
    setCurrency: mockSetCurrency,
    isRTL: false,
    userId: 42,
    setUser: mockSetUser,
    user: { id: 42, username: 'john', email: 'j@t.c', role: 'user', voice_chat_enabled: false },
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
  };
});

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

import SettingsScreen from '../app/(main)/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';


describe('SettingsScreen', () => {

  it('renders the section headers', async () => {
    const { findByText } = render(<SettingsScreen />);
    expect(await findByText('account')).toBeTruthy();
    expect(await findByText('preferences')).toBeTruthy();
  });

  it('opens the language Alert picker with 4 language choices', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SettingsScreen />);

    fireEvent.press(getByText('language'));

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const labels = buttons.map(b => b.text);
    expect(labels).toEqual(
      expect.arrayContaining(['English', 'العربية', 'Français', 'Deutsch']),
    );
    alertSpy.mockRestore();
  });

  it('calls setLanguage("ar") when the Arabic option is chosen', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'العربية').onPress();
    });
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('language'));
    expect(mockSetLanguage).toHaveBeenCalledWith('ar');
    alertSpy.mockRestore();
  });

  it('opens the currency Alert picker with 5 currencies', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SettingsScreen />);

    fireEvent.press(getByText('currency'));

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const labels = buttons.map(b => b.text);
    expect(labels).toEqual(
      expect.arrayContaining(['USD ($)', 'EGP (ج.م)', 'EUR (€)', 'GBP (£)', 'SAR (ر.س)']),
    );
    alertSpy.mockRestore();
  });

  it('calls setCurrency("USD") when USD is chosen', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'USD ($)').onPress();
    });
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('currency'));
    expect(mockSetCurrency).toHaveBeenCalledWith('USD');
    alertSpy.mockRestore();
  });

  it('logout confirms with Alert and on confirm clears storage + navigates to login', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'Logout').onPress();
    });
    const { getByText } = render(<SettingsScreen />);

    fireEvent.press(getByText('logout'));

    await waitFor(() => {
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['token', 'user']);
      expect(mockSetUser).toHaveBeenCalledWith(null);
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
    alertSpy.mockRestore();
  });
});
