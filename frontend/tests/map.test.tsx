import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
const mockSearchParams = { city: 'Cairo' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 6, BestForNavigation: 7 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    userId: 42,
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: any) => <View testID="map-view">{children}</View>,
    Marker: ({ children }: any) => <View testID="map-marker">{children}</View>,
    Polyline: () => <View testID="map-polyline" />,
    PROVIDER_DEFAULT: 'default',
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
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  }) as any;
});

import MapScreen from '../app/(main)/map';


describe('MapScreen', () => {

  it('renders the MapView component', async () => {
    const { findByTestId } = render(<MapScreen />);
    expect(await findByTestId('map-view')).toBeTruthy();
  });

  // ── TC-MAP-07: handle GPS disabled — denied permission still loads the
  // map with an Alexandria fallback (via the reverse-geocode + /attractions
  // chain) instead of crashing or staying empty.
  it('falls back gracefully and still calls /attractions when permission is denied', async () => {
    render(<MapScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/attractions?city='))).toBe(true);
    });
  });

});
