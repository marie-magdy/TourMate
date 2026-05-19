import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
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

});
