import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => any) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return cleanup;
    }, []);
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    convertPrice: (n: number) => `${n} EGP`,
    userId: 42, // Source ignores userId 0 or 1, so use 42 to exercise fetch.
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../components/AttractionSheet', () => () => null);
jest.mock('@/components/BottomTab', () => () => null);

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

import FavoritesScreen from '../app/(main)/favorites';

const fav = (id: number, name: string) => ({
  id,
  name,
  city: 'Cairo',
  description: '',
  primary_image: 'https://x/p.jpg',
  image_url: '',
  rating: 4.5,
  price_from: 100,
  categories: ['historical'],
});


describe('FavoritesScreen', () => {

  it('fetches /attractions/favorites/:userId on focus', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: [] }),
    }) as any;

    render(<FavoritesScreen />);

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/attractions/favorites/42'))).toBe(true);
    });
  });

  it('renders FavoriteCards for each returned favorite', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: [fav(1, 'Pyramids'), fav(2, 'Sphinx')] }),
    }) as any;

    const { findByText } = render(<FavoritesScreen />);
    expect(await findByText('Pyramids')).toBeTruthy();
    expect(await findByText('Sphinx')).toBeTruthy();
  });

  it('shows the empty state when no favorites exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: [] }),
    }) as any;

    const { findByText } = render(<FavoritesScreen />);
    expect(await findByText('noFavorites')).toBeTruthy();
    expect(await findByText('explore')).toBeTruthy();
  });

  it('navigates to /home when Explore is tapped from the empty state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: [] }),
    }) as any;

    const { findByText } = render(<FavoritesScreen />);
    fireEvent.press(await findByText('explore'));
    expect(mockPush).toHaveBeenCalledWith('/(main)/home');
  });

  it('shows the count badge with the number of favorites', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ data: [fav(1, 'A'), fav(2, 'B'), fav(3, 'C')] }),
    }) as any;

    const { findAllByText } = render(<FavoritesScreen />);
    // "3" appears in the count badge.
    const threes = await findAllByText('3');
    expect(threes.length).toBeGreaterThan(0);
  });

  it('handles fetch errors silently and stops loading', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;

    const { findByText } = render(<FavoritesScreen />);
    // Should land on empty state (no favorites loaded).
    expect(await findByText('noFavorites')).toBeTruthy();
  });
});
