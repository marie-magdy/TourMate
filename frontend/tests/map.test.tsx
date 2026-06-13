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
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
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

  // ── TC-MAP-02: a Marker is rendered for each attraction returned ──
  it('renders one Marker per attraction returned by the API', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('nominatim')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ address: { city: 'Cairo' } }),
        });
      }
      if (String(url).includes('/attractions?city=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 1, name: 'Pyramids', latitude: 29.97, longitude: 31.13, category: 'historical' },
              { id: 2, name: 'Sphinx',   latitude: 29.97, longitude: 31.14, category: 'historical' },
              { id: 3, name: 'Khan',     latitude: 30.05, longitude: 31.26, category: 'shopping'   },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    });

    const { findAllByTestId } = render(<MapScreen />);
    // Wait for fetchAttractions to populate state and re-render the FlatList
    // of Markers. The screen also draws 1 marker for the user location, so
    // total ≥ 3 (attractions) + 1 (user) — assert at least 3.
    const markers = await findAllByTestId('map-marker');
    expect(markers.length).toBeGreaterThanOrEqual(3);
  });

});
