import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({
    city: 'Cairo',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    budget: '1000',
    daySchedules: '[{"start_hour":9,"end_hour":21}]',
    // No interests param so all spot categories show in "All" view.
    interests: '',
  }),
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
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../components/AttractionSheet', () => () => null);

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
});

const MOCK_SPOTS = [
  {
    id: 'ATT001',
    name: 'Pyramids',
    image_url: 'https://x/p.jpg',
    price_from: 200,
    rating: 4.8,
    categories: ['ancient', 'historical'],
  },
  {
    id: 'ATT002',
    name: 'Khan Bazaar',
    image_url: '',
    price_from: 0,
    rating: 4.2,
    categories: ['shopping'],
  },
];

function setupFetch(spots = MOCK_SPOTS) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/recommendations/attractions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: spots }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
  }) as any;
}

import PickSpotsScreen from '../app/(main)/pick-spots';


describe('PickSpotsScreen', () => {

  it('shows the city in the header', async () => {
    setupFetch();
    const { findByText } = render(<PickSpotsScreen />);
    expect(await findByText('Cairo, Egypt')).toBeTruthy();
  });

  it('renders category tabs (All, Cafés, etc.)', async () => {
    setupFetch();
    const { findByText } = render(<PickSpotsScreen />);
    expect(await findByText('All')).toBeTruthy();
    expect(await findByText('Cafés')).toBeTruthy();
    expect(await findByText('Restaurants')).toBeTruthy();
  });

  it('renders attraction cards returned by /recommendations/attractions', async () => {
    setupFetch();
    const { findByText } = render(<PickSpotsScreen />);
    expect(await findByText('Pyramids')).toBeTruthy();
    expect(await findByText('Khan Bazaar')).toBeTruthy();
  });

  it('shows the error state with a Retry button when the API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const { findByText } = render(<PickSpotsScreen />);
    expect(await findByText(/Could not load attractions/)).toBeTruthy();
    expect(await findByText('Retry')).toBeTruthy();
  });

  it('treats an empty data array from the API as an error (no DB fallback by design)', async () => {
    // Source intentionally throws when data.length === 0 because the recommendation
    // service is the single source of truth for plan IDs.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }) as any;
    const { findByText } = render(<PickSpotsScreen />);
    expect(await findByText(/Could not load attractions/)).toBeTruthy();
  });

  it('navigates to /itinerary when Next step is pressed, forwarding params + spot IDs', async () => {
    setupFetch();
    const { findByText } = render(<PickSpotsScreen />);
    await findByText('Pyramids');

    fireEvent.press(await findByText('Next step →'));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(main)/itinerary',
        params: expect.objectContaining({
          city: 'Cairo',
          startDate: '2026-06-01',
          endDate: '2026-06-03',
          budget: '1000',
          spotIds: '',
          favoritedIds: '',
        }),
      }),
    );
  });
});
