import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY = 'test-key';

// ── Mocks ───────────────────────────────────────────────────────────
const mockSetUser = jest.fn();
const mockConvertPrice = jest.fn((n: number) => `${n} EGP`);
const mockT = jest.fn((k: string) => k);

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: mockT,
    convertPrice: mockConvertPrice,
    setUser: mockSetUser,
    refreshFeatures: jest.fn(),
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// const mockSound = {
//   stopAsync: jest.fn(),
//   unloadAsync: jest.fn(),
//   setOnPlaybackStatusUpdate: jest.fn(),
// };
// jest.mock('expo-av', () => ({
//   Audio: {
//     setAudioModeAsync: jest.fn(),
//     Sound: { createAsync: jest.fn(async () => ({ sound: mockSound })) },
//   },
// }));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
// import { Audio } from 'expo-av';
import AttractionSheet, {
  parseCategories,
  CATEGORY_COLORS,
  StarRating,
} from '../components/AttractionSheet';

jest.setTimeout(15000);

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

const attraction: any = {
  id: 5,
  name: 'Pyramids of Giza',
  city: 'Giza',
  description: 'Ancient wonder.',
  rating: 4.6,
  price_from: 200,
  primary_image: 'https://x/p.jpg',
  categories: ['historical', 'culture'],
  opening_hours: '9-5',
};


// ── parseCategories (pure) ──────────────────────────────────────────
describe('parseCategories', () => {
  it('returns [] for null/undefined/empty', () => {
    expect(parseCategories(null)).toEqual([]);
    expect(parseCategories(undefined)).toEqual([]);
    expect(parseCategories('')).toEqual([]);
  });

  it('lowercases an array input', () => {
    expect(parseCategories(['Historical', 'CULTURE'])).toEqual(['historical', 'culture']);
  });

  it('parses Postgres-style {a,b,c} string', () => {
    expect(parseCategories('{Historical,Culture}')).toEqual(['historical', 'culture']);
  });

  it('parses CSV string and trims whitespace', () => {
    expect(parseCategories(' historical , culture ')).toEqual(['historical', 'culture']);
  });

  it('filters out empty segments', () => {
    expect(parseCategories('historical,,culture,')).toEqual(['historical', 'culture']);
  });

  it('returns [] for unsupported input type (number)', () => {
    expect(parseCategories(42 as any)).toEqual([]);
  });
});


// ── CATEGORY_COLORS ─────────────────────────────────────────────────
describe('CATEGORY_COLORS', () => {
  it('exposes a hex color for every known category key', () => {
    ['historical', 'beaches', 'restaurants', 'shopping', 'nature',
     'diving', 'culture', 'nightlife', 'adventure'].forEach(k => {
       expect(CATEGORY_COLORS[k]).toMatch(/^#[0-9A-Fa-f]{6}$/);
     });
  });
});


// ── StarRating ──────────────────────────────────────────────────────
describe('StarRating', () => {
  it('renders 5 solid stars for rating ≥ 4.5 (rounds to 5)', () => {
    const { getAllByText, queryAllByText } = render(<StarRating rating={4.8} />);
    expect(getAllByText('icon:star')).toHaveLength(5);
    expect(queryAllByText('icon:star-outline')).toHaveLength(0);
  });

  it('renders 4 solid + 1 outline for rating 3.5 (rounds to 4)', () => {
    const { getAllByText } = render(<StarRating rating={3.5} />);
    expect(getAllByText('icon:star')).toHaveLength(4);
    expect(getAllByText('icon:star-outline')).toHaveLength(1);
  });

  it('renders 0 solid + 5 outlines for rating 0', () => {
    const { getAllByText } = render(<StarRating rating={0} />);
    expect(getAllByText('icon:star-outline')).toHaveLength(5);
  });
});


// ── AttractionSheet ─────────────────────────────────────────────────
describe('AttractionSheet', () => {

  it('renders nothing when attraction is null', () => {
    const { toJSON } = render(
      <AttractionSheet
        attraction={null}
        visible={true}
        onClose={() => {}}
        userLocation={null}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the attraction name and city', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true, data: [] }),
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ data: [] }),
    });

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');
    expect(await findByText('Giza, Egypt')).toBeTruthy();
  });

  it('renders the description and category badge', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: [] }),
    });

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Ancient wonder.');
    expect(await findByText('historical')).toBeTruthy();
  });

  it('shows favorite=true when the attraction id is among the user favorites', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) {
        return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes('/favorites/1')) {
        return Promise.resolve({ json: async () => ({ data: [{ id: 5 }, { id: 9 }] }) });
      }
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('icon:heart');
  });

  it('shows outline heart when the attraction is not favorited', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/1')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('icon:heart-outline');
  });

  it('toggleFavorite POSTs to /favorite with user_id', async () => {
    const fetchCalls: string[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: any) => {
      fetchCalls.push(url);
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/1')) return Promise.resolve({ json: async () => ({ data: [] }) });
      if (url.includes('/favorite')) return Promise.resolve({ json: async () => ({ success: true, favorited: true }) });
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText, getAllByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    // The favorite button is the heart icon.
    const heart = getAllByText('icon:heart-outline')[0];
    fireEvent.press(heart);

    await waitFor(() => {
      // Match the POST endpoint /attractions/:id/favorite (no trailing "s"),
      // not the GET /attractions/favorites/:user_id list endpoint.
      const fav = (global.fetch as jest.Mock).mock.calls.find(
        c => /\/favorite$/.test(String(c[0])),
      );
      expect(fav).toBeDefined();
      expect(fav[1].method).toBe('POST');
      expect(JSON.parse(fav[1].body)).toEqual({ user_id: 1 });
    });
  });

  it('toggleFavorite reverts UI state when the request fails', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/1')) return Promise.resolve({ json: async () => ({ data: [] }) });
      if (url.includes('/favorite')) return Promise.reject(new Error('boom'));
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText, getAllByText, queryAllByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    fireEvent.press(getAllByText('icon:heart-outline')[0]);

    await waitFor(() => {
      // Reverted back to outline.
      expect(queryAllByText('icon:heart-outline').length).toBeGreaterThan(0);
    });
  });

  it('reads user id from AsyncStorage when prop userId is not provided', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ id: 77 }),
    );
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/77')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });

    render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
      />,
    );

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/favorites/77'))).toBe(true);
    });
  });

  // it('Audio Guide button calls TTS and starts playback', async () => {
  //   (global.fetch as jest.Mock).mockImplementation((url: string) => {
  //     if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
  //     if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
  //     if (url.includes('/tts')) {
  //       return Promise.resolve({
  //         json: async () => ({ success: true, script: 'The Pyramids stand…', audio: 'BASE64AUDIO' }),
  //       });
  //     }
  //     return Promise.reject(new Error('unexpected'));
  //   });

  //   const { findByText } = render(
  //     <AttractionSheet
  //       attraction={attraction}
  //       visible={true}
  //       onClose={() => {}}
  //       userLocation={null}
  //       userId={1}
  //     />,
  //   );
  //   await findByText('Pyramids of Giza');

  //   fireEvent.press(await findByText('Play Guide'));

  //   await waitFor(() => {
  //     expect(Audio.setAudioModeAsync).toHaveBeenCalled();
  //     expect(Audio.Sound.createAsync).toHaveBeenCalled();
  //     const ttsCall = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/tts'));
  //     expect(JSON.parse(ttsCall[1].body)).toMatchObject({
  //       name: 'Pyramids of Giza',
  //       city: 'Giza',
  //       category: 'historical',
  //       language: 'en',
  //     });
  //   });
  //   expect(await findByText('Stop')).toBeTruthy();
  // });

  // it('toggling audio language to AR sends language=ar in the TTS payload', async () => {
  //   (global.fetch as jest.Mock).mockImplementation((url: string) => {
  //     if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
  //     if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
  //     if (url.includes('/tts')) {
  //       return Promise.resolve({ json: async () => ({ success: true, script: 's', audio: 'A' }) });
  //     }
  //     return Promise.reject(new Error('unexpected'));
  //   });

  //   const { findByText } = render(
  //     <AttractionSheet
  //       attraction={attraction}
  //       visible={true}
  //       onClose={() => {}}
  //       userLocation={null}
  //       userId={1}
  //     />,
  //   );
  //   await findByText('Pyramids of Giza');
  //   fireEvent.press(await findByText('AR'));
  //   fireEvent.press(await findByText('Play Guide'));

  //   await waitFor(() => {
  //     const ttsCall = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/tts'));
  //     expect(JSON.parse(ttsCall[1].body).language).toBe('ar');
  //   });
  // });

  it('openUber builds an uber:// deep link with origin/destination coords', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });
    (axios.get as jest.Mock).mockResolvedValue({
      data: [{ lat: '29.9792', lon: '31.1342' }],
    });
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy    = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={{ latitude: 30.05, longitude: 31.25 }}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');
    fireEvent.press(await findByText('Uber'));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
    const url = (openSpy as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('uber://');
    expect(url).toContain('pickup[latitude]=30.05');
    expect(url).toContain('dropoff[latitude]=29.9792');
    expect(url).toContain('Pyramids%20of%20Giza');

    canOpenSpy.mockRestore();
    openSpy.mockRestore();
  });

  it('openUber falls back to the app-store URL when Uber is not installed', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });
    (axios.get as jest.Mock).mockResolvedValue({ data: [{ lat: '29.97', lon: '31.13' }] });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={{ latitude: 30, longitude: 31 }}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');
    fireEvent.press(await findByText('Uber'));

    await waitFor(() => {
      const url = openSpy.mock.calls[0][0] as string;
      // Either the iOS App Store or Play Store URL — both are acceptable.
      expect(url).toMatch(/(itms-apps:\/\/|play\.google\.com)/);
    });

    openSpy.mockRestore();
  });

  it('openCareem builds a careem:// deep link with destination coords', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });
    (axios.get as jest.Mock).mockResolvedValue({ data: [{ lat: '29.97', lon: '31.13' }] });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={{ latitude: 30, longitude: 31 }}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');
    fireEvent.press(await findByText('Careem'));

    await waitFor(() => {
      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain('careem://');
      expect(url).toContain('dropoff_lat=29.97');
    });

    openSpy.mockRestore();
  });

  it('Check ride button calls the Google Distance Matrix API and shows the estimate', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      if (url.includes('maps.googleapis.com')) {
        return Promise.resolve({
          json: async () => ({
            rows: [{
              elements: [{
                status: 'OK',
                distance: { text: '12 km', value: 12000 },
                duration: { text: '25 mins' },
              }],
            }],
          }),
        });
      }
      return Promise.reject(new Error('unexpected'));
    });
    (axios.get as jest.Mock).mockResolvedValue({
      data: [{ lat: '29.97', lon: '31.13' }],
    });

    const { findByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={{ latitude: 30, longitude: 31 }}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    fireEvent.press(await findByText('Check ride'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com'),
      );
    });

    expect(await findByText('12 km')).toBeTruthy();
    expect(await findByText('25 mins')).toBeTruthy();
    // Fare formula: km * 5, min 30, range +20
    // 12 km * 5 = 60 → "~60–80 EGP"
    expect(await findByText('~60–80 EGP')).toBeTruthy();
  });

  it('falls back to primary_image when /images returns no rows', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) return Promise.resolve({ json: async () => ({ success: true, data: [] }) });
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText, UNSAFE_getAllByType } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    const { Image } = require('react-native');
    const images = UNSAFE_getAllByType(Image);
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0].props.source.uri).toBe('https://x/p.jpg');
  });

  it('converts a Google Drive share URL to a direct-view URL when rendering', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/images')) {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: [{ image_url: 'https://drive.google.com/file/d/ABC123/view' }],
          }),
        });
      }
      if (url.includes('/favorites/')) return Promise.resolve({ json: async () => ({ data: [] }) });
      return Promise.reject(new Error('unexpected'));
    });

    const { findByText, UNSAFE_getAllByType } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={() => {}}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    const { Image } = require('react-native');
    await waitFor(() => {
      const images = UNSAFE_getAllByType(Image);
      expect(images[0].props.source.uri).toBe(
        'https://drive.google.com/uc?export=view&id=ABC123',
      );
    });
  });

  it('close button triggers onClose', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ json: async () => ({ data: [] }) });

    const onClose = jest.fn();
    const { findByText, getAllByText } = render(
      <AttractionSheet
        attraction={attraction}
        visible={true}
        onClose={onClose}
        userLocation={null}
        userId={1}
      />,
    );
    await findByText('Pyramids of Giza');

    fireEvent.press(getAllByText('icon:close')[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
