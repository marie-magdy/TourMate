import React from 'react';
import { render } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_EXCHANGE_API_KEY = 'test-key';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    convertPrice: (n: number) => `${n} EGP`,
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@/store/bookingStore', () => ({
  useBookingStore: () => ({ selectedHotel: null }),
}));

jest.mock('@/components/BottomTab', () => () => null);

jest.mock('../components/DesertTriangles', () => () => null);

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return () => <View testID="datetime-picker" />;
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
    json: async () => ({
      result: 'success',
      conversion_rate: 50,
      daily: {
        time: ['2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23'],
        weathercode: [0, 1, 2, 3, 0],
        temperature_2m_max: [30, 31, 29, 28, 32],
        temperature_2m_min: [20, 21, 19, 18, 22],
      },
    }),
  });
});

import PlanScreen from '../app/(main)/plan';


describe('PlanScreen', () => {

  it('renders without crashing and shows the default Alexandria city', async () => {
    const { findAllByText } = render(<PlanScreen />);
    const matches = await findAllByText(/Alexandria/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders the interest tags from the INTERESTS list', async () => {
    const { findByText } = render(<PlanScreen />);
    expect(await findByText('Adventure')).toBeTruthy();
    expect(await findByText('Diving')).toBeTruthy();
    expect(await findByText('History')).toBeTruthy();
    expect(await findByText('Culture')).toBeTruthy();
  });

  it('calls the weather forecast API on mount', async () => {
    render(<PlanScreen />);
    // The forecast fetch should run as part of useEffect.
    await new Promise(r => setTimeout(r, 50));
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('open-meteo.com'))).toBe(true);
  });

  it('fetches the EGP exchange rate on mount when budget currency defaults to EGP (no API call)', async () => {
    render(<PlanScreen />);
    await new Promise(r => setTimeout(r, 50));
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
    // Default budget currency is EGP so no exchangerate-api call should be made.
    expect(calls.some(u => u.includes('exchangerate-api.com'))).toBe(false);
  });
});
