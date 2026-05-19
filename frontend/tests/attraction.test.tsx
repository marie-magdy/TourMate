import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ id: '5' }),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    convertPrice: (n: number) => `${n} EGP`,
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
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

import AsyncStorage from '@react-native-async-storage/async-storage';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

import AttractionDetailsScreen from '../app/(main)/attraction';

const attraction = {
  id: 5,
  name: 'Pyramids of Giza',
  city: 'Giza',
  description: 'Ancient wonder.',
  rating: 4.6,
  review_count: 1200,
  price_from: 200,
  primary_image: 'https://x/p.jpg',
  categories: ['historical'],
  opening_hours: '9-5',
};


describe('AttractionDetailsScreen', () => {

  it('renders loading spinner before details resolve', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    const { UNSAFE_getAllByType } = render(<AttractionDetailsScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('fetches /attractions/:id on mount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, data: attraction }),
    }) as any;
    render(<AttractionDetailsScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/attractions/5'))).toBe(true);
    });
  });

  it('renders the attraction name and description after loading', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, data: attraction }),
    }) as any;
    const { findByText, findAllByText } = render(<AttractionDetailsScreen />);
    expect(await findByText('Pyramids of Giza')).toBeTruthy();
    // Description appears twice (hero + About section).
    expect((await findAllByText('Ancient wonder.')).length).toBeGreaterThan(0);
  });

  it('shows the review count formatted with parentheses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, data: attraction }),
    }) as any;
    const { findByText } = render(<AttractionDetailsScreen />);
    expect(await findByText('(1200 reviews)')).toBeTruthy();
  });

  it('back button calls router.back()', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, data: attraction }),
    }) as any;
    const { findAllByText } = render(<AttractionDetailsScreen />);

    // Wait for content to render.
    await findAllByText('Pyramids of Giza');
    fireEvent.press((await findAllByText('icon:arrow-left'))[0]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('POSTs to /favorite when favorite icon is tapped, using user id from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ id: 77 }),
    );
    const fetchCalls: any[] = [];
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      fetchCalls.push({ url, opts });
      if (url.includes('/attractions/5')) {
        return Promise.resolve({ json: async () => ({ success: true, data: attraction }) });
      }
      if (url.endsWith('/favorite')) {
        return Promise.resolve({ json: async () => ({ success: true, favorited: true }) });
      }
      return Promise.resolve({ json: async () => ({}) });
    }) as any;

    const { findAllByText } = render(<AttractionDetailsScreen />);
    await findAllByText('Pyramids of Giza');

    const heart = (await findAllByText('icon:heart-outline'))[0];
    fireEvent.press(heart);

    await waitFor(() => {
      const favCall = fetchCalls.find(c => c.url.endsWith('/favorite'));
      expect(favCall).toBeDefined();
      expect(favCall.opts.method).toBe('POST');
      expect(JSON.parse(favCall.opts.body)).toEqual({ user_id: 77 });
    });
  });
});
