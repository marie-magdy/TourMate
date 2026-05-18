import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

jest.setTimeout(20000);

// ── env: home.tsx builds API_BASE from EXPO_PUBLIC_API_URL ─────────
process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_EXCHANGE_API_KEY = 'test-key';

// ── Mocks ─────────────────────────────────────────────────────────
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const mockSetUser = jest.fn();
const mockRefreshFeatures = jest.fn();
const mockConvertPrice = jest.fn((n: number) => `${n} EGP`);
const mockT = jest.fn((key: string) => {
  const map: Record<string, string> = {
    planYourTrip: 'Plan your trip',
    search: 'Search attractions',
  };
  return map[key] ?? key;
});

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: mockT,
    convertPrice: mockConvertPrice,
    setUser: mockSetUser,
    refreshFeatures: mockRefreshFeatures,
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
    setAudioModeAsync: jest.fn(),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  get: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
    Ionicons: ({ name }: any) => <Text>{`ion:${name}`}</Text>,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// AttractionSheet → stub that reports open/closed + selected name.
jest.mock('../components/AttractionSheet', () => {
  const { Text } = require('react-native');
  return ({ attraction, visible }: any) =>
    visible && attraction ? (
      <Text testID="attraction-sheet">{`SHEET:${attraction.name}`}</Text>
    ) : null;
});

// Silence noisy logs.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

import HomeScreen from '../app/(main)/home';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Fixtures ──────────────────────────────────────────────────────
const POPULAR = [
  {
    id: 1,
    name: 'Pyramids of Giza',
    city: 'Giza',
    categories: ['historical', 'culture'],
    description: '',
    primary_image: 'https://x/p1.jpg',
    rating: 4.8,
    price_from: 200,
  },
  {
    id: 2,
    name: 'Khan el-Khalili',
    city: 'Cairo',
    categories: '{shopping,culture}',
    description: '',
    primary_image: 'https://x/p2.jpg',
    rating: 4.2,
    price_from: 50,
  },
];

const NEAREST = [
  {
    id: 10,
    name: 'Alexandria Library',
    city: 'Alexandria',
    categories: 'culture,historical',
    description: '',
    primary_image: 'https://x/n1.jpg',
    rating: 4.6,
    price_from: 150,
  },
  {
    id: 11,
    name: 'Stanley Beach',
    city: 'Alexandria',
    categories: ['beaches'],
    description: '',
    primary_image: 'https://x/n2.jpg',
    rating: 3.5,
    price_from: 0,
  },
];

const POINTS = { success: true, data: { points: 1250 } };

// ── Helpers ───────────────────────────────────────────────────────
const okJson = (data: any) =>
  Promise.resolve({ ok: true, json: async () => data });

function setupHappyFetch(overrides: Partial<{
  popular: any[];
  nearest: any[];
  points: any;
  search: any[];
  weather: any;
}> = {}) {
  const {
    popular = POPULAR,
    nearest = NEAREST,
    points = POINTS,
    search = [],
    weather = {
      current_weather: { temperature: 28, weathercode: 0 },
    },
  } = overrides;

  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/attractions/popular')) return okJson({ data: popular });
    if (url.includes('/attractions/nearest')) return okJson({ data: nearest });
    if (url.includes('/attractions/search')) return okJson({ data: search });
    if (url.includes('/points/')) return okJson(points);
    if (url.includes('open-meteo.com')) return okJson(weather);
    if (url.includes('exchangerate-api.com'))
      return okJson({
        result: 'success',
        conversion_rate: 50,
        time_last_update_utc: '2026-01-01T00:00:00Z',
      });
    return okJson({});
  });
}

function setupLocationGranted() {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: 'granted',
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    coords: { latitude: 30.05, longitude: 31.25 },
  });
  (axios.get as jest.Mock).mockResolvedValue({
    data: { address: { city: 'Cairo', country: 'Egypt' } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
    JSON.stringify({ id: 99, email: 'u@test.com', role: 'user' }),
  );
});


// ────────────────────────────────────────────────────────────────────
describe('HomeScreen', () => {

  // RENDER + INITIAL LOAD
  it('renders loading spinner before data resolves', async () => {
    setupLocationGranted();
    // Block fetches so we stay in loading state.
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { UNSAFE_getAllByType } = render(<HomeScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renders hero, search and section headers after data loads', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { getByText, findByText } = render(<HomeScreen />);
    await findByText('Popular Locations');
    expect(getByText('Nearby Places')).toBeTruthy();
    expect(getByText('Plan your trip')).toBeTruthy();
    expect(getByText('Currency Exchange')).toBeTruthy();
  });

  it('shows resolved city/country in the location pill', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('Cairo, Egypt');
  });

  it('renders popular and nearest items from API', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');
    expect(getByText('Khan el-Khalili')).toBeTruthy();
    expect(getByText('Alexandria Library')).toBeTruthy();
    expect(getByText('Stanley Beach')).toBeTruthy();
  });

  it('uses convertPrice from context for popular cards', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');
    expect(mockConvertPrice).toHaveBeenCalledWith(200);
    expect(mockConvertPrice).toHaveBeenCalledWith(50);
  });


  // LOCATION
  it('does not fetch attractions when location permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    setupHappyFetch();

    const { UNSAFE_getAllByType } = render(<HomeScreen />);

    // Wait one tick for the permission promise to resolve.
    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    // No attraction fetches should have been dispatched.
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('/attractions/popular'))).toBe(false);
    expect(calls.some(u => u.includes('/attractions/nearest'))).toBe(false);

    // Screen stays on the loading spinner (current behavior).
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('shows location-error banner and loads Alexandria fallback when reverse-geocode fails', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 0, longitude: 0 },
    });
    (axios.get as jest.Mock).mockRejectedValue(new Error('offline'));
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('Showing Alexandria — tap to use your location');

    // Should still have fetched the nearest endpoint with city=Alexandria.
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some((u: string) => u.includes('/attractions/nearest') && u.includes('city=Alexandria'))).toBe(true);
    });
  });


  // SEARCH
  it('does not call search endpoint when query is shorter than 2 chars', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByPlaceholderText, queryByText } = render(<HomeScreen />);
    const input = await findByPlaceholderText('Search attractions');

    fireEvent.changeText(input, 'a');

    await waitFor(() => {
      const searchCalled = (global.fetch as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('/attractions/search'),
      );
      expect(searchCalled).toBe(false);
    });
    expect(queryByText('Pyramids of Giza')).toBeTruthy(); // still in popular list
  });

  it('calls /attractions/search and renders results when query >= 2 chars', async () => {
    setupLocationGranted();
    setupHappyFetch({
      search: [
        {
          id: 99,
          name: 'Sphinx',
          city: 'Giza',
          categories: ['historical'],
          description: '',
          primary_image: '',
          rating: 4.5,
          price_from: 100,
        },
      ],
    });

    const { findByPlaceholderText, findByText } = render(<HomeScreen />);
    const input = await findByPlaceholderText('Search attractions');

    fireEvent.changeText(input, 'sp');

    await findByText('Sphinx');
    expect(
      (global.fetch as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('/attractions/search?q=sp'),
      ),
    ).toBe(true);
  });

  it('opens AttractionSheet when a search result is tapped', async () => {
    setupLocationGranted();
    setupHappyFetch({
      search: [
        {
          id: 99,
          name: 'Sphinx',
          city: 'Giza',
          categories: ['historical'],
          description: '',
          primary_image: '',
          rating: 4.5,
          price_from: 100,
        },
      ],
    });

    const { findByPlaceholderText, findByText, getByTestId } = render(<HomeScreen />);
    const input = await findByPlaceholderText('Search attractions');
    fireEvent.changeText(input, 'sp');

    const result = await findByText('Sphinx');
    fireEvent.press(result);

    await waitFor(() => {
      expect(getByTestId('attraction-sheet').props.children).toBe('SHEET:Sphinx');
    });
  });


  // FILTERS — verifies parseCategories + applyFilters together
  it('filters attractions by category', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText, queryByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    // open filter sheet
    fireEvent.press(getByText('icon:tune-variant'));
    await findByText('Filter Attractions');

    // pick "Beaches" only
    fireEvent.press(getByText('Beaches'));
    fireEvent.press(getByText('Apply Filters'));

    await waitFor(() => {
      // Pyramids (historical/culture) filtered out
      expect(queryByText('Pyramids of Giza')).toBeNull();
      // Stanley Beach (beaches) remains
      expect(queryByText('Stanley Beach')).toBeTruthy();
    });
  });

  it('filters by minimum rating', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText, queryByText, getAllByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    fireEvent.press(getByText('icon:tune-variant'));
    await findByText('Filter Attractions');

    // Filter sheet renders 5 outlined stars at the end of the tree;
    // earlier 'star-outline' icons come from card StarRating components.
    const outlineStars = getAllByText('icon:star-outline');
    const filterStars = outlineStars.slice(-5);
    fireEvent.press(filterStars[3]); // 4th star → minRating 4
    fireEvent.press(getByText('Apply Filters'));

    await waitFor(() => {
      expect(queryByText('Pyramids of Giza')).toBeTruthy(); // 4.8
      expect(queryByText('Stanley Beach')).toBeNull();      // 3.5 → filtered
    });
  });

  it('Reset clears category selection', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText, queryByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    fireEvent.press(getByText('icon:tune-variant'));
    await findByText('Filter Attractions');
    fireEvent.press(getByText('Beaches'));
    fireEvent.press(getByText('Reset'));
    fireEvent.press(getByText('Apply Filters'));

    await waitFor(() => {
      expect(queryByText('Pyramids of Giza')).toBeTruthy();
      expect(queryByText('Stanley Beach')).toBeTruthy();
    });
  });

  it('shows empty-state text when no items match the filter', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    fireEvent.press(getByText('icon:tune-variant'));
    await findByText('Filter Attractions');
    fireEvent.press(getByText('Nightlife')); // no fixtures have this category
    fireEvent.press(getByText('Apply Filters'));

    await waitFor(() => {
      expect(getByText('No popular places match your filters.')).toBeTruthy();
      expect(getByText('No nearby places match your filters.')).toBeTruthy();
    });
  });


  // POINTS
  it('shows points value after successful fetch', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('1250 Points');
  });

  it('shows "— Points" when points fetch fails', async () => {
    setupLocationGranted();
    setupHappyFetch({ points: { success: false } });

    const { findByText } = render(<HomeScreen />);
    await findByText('— Points');
  });

  it('uses stored user id when fetching points', async () => {
    setupLocationGranted();
    setupHappyFetch();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ id: 77, email: 'x@test.com', role: 'user' }),
    );

    render(<HomeScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some((u: string) => u.includes('/points/77'))).toBe(true);
    });
  });

  it('falls back to user id 1 when AsyncStorage has no user', async () => {
    setupLocationGranted();
    setupHappyFetch();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some((u: string) => u.includes('/points/1'))).toBe(true);
    });
  });


  // CURRENCY MODAL
  it('opens currency modal and converts amount using the live rate', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText, getByText, getByPlaceholderText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    fireEvent.press(getByText('Currency Exchange'));
    await findByText('Live rate');

    await waitFor(() => {
      // 1 USD * rate 50 = 50.00
      expect(getByText('50.00')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('1'), '3');
    await waitFor(() => {
      expect(getByText('150.00')).toBeTruthy(); // 3 * 50
    });
  });


  // WEATHER WIDGET
  it('renders weather chip from open-meteo response', async () => {
    setupLocationGranted();
    setupHappyFetch({
      weather: { current_weather: { temperature: 30, weathercode: 0 } },
    });

    const { findByText } = render(<HomeScreen />);
    await findByText('30°C');
    expect(await findByText('Clear')).toBeTruthy();
  });

  it('maps weather codes to the expected label', async () => {
    setupLocationGranted();
    setupHappyFetch({
      weather: { current_weather: { temperature: 22, weathercode: 65 } },
    });

    const { findByText } = render(<HomeScreen />);
    await findByText('Rainy');
  });


  // NAVIGATION
  it('navigates to map screen when the location pill is tapped', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    const locationPill = await findByText('Cairo, Egypt');
    fireEvent.press(locationPill);
    expect(mockRouter.push).toHaveBeenCalledWith('/(main)/map');
  });

  it('navigates to rewards when the points pill is tapped', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    const points = await findByText('1250 Points');
    fireEvent.press(points);
    expect(mockRouter.push).toHaveBeenCalledWith('/(main)/rewards');
  });

  it('navigates to settings when the profile button is tapped', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    const profile = await findByText('Profile');
    fireEvent.press(profile);
    expect(mockRouter.push).toHaveBeenCalledWith('/(main)/settings');
  });

  it('navigates via the bottom tab when a non-active tab is pressed', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    const planLabel = await findByText('Plan');
    fireEvent.press(planLabel);
    expect(mockRouter.push).toHaveBeenCalledWith('/(main)/plan');
  });

  it('does not navigate when the active "Home" tab is pressed', async () => {
    setupLocationGranted();
    setupHappyFetch();

    const { findByText } = render(<HomeScreen />);
    await findByText('Pyramids of Giza');

    const homeTab = await findByText('Home');
    fireEvent.press(homeTab);
    expect(mockRouter.push).not.toHaveBeenCalledWith('/(main)/home');
  });

});
