import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_API_KEY = 'test';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => any) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return cleanup;
    }, []);
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: { createAsync: jest.fn(async () => ({ sound: { setOnPlaybackStatusUpdate: jest.fn(), unloadAsync: jest.fn() } })) },
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockRefreshFeatures = jest.fn();
jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    userId: 42,
    voiceChatEnabled: false,
    refreshFeatures: mockRefreshFeatures,
  }),
}));

jest.mock('../components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

jest.mock('../components/DesertTriangles', () => () => null);

jest.mock('@/components/BottomTab', () => () => null);

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
    Ellipse: View,
    Path: View,
    Rect: View,
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
    // tourmate-ai.tsx also uses Ionicons — without this, it resolves to
    // undefined and React throws "Element type is invalid".
    Ionicons: ({ name }: any) => <Text>{`ion:${name}`}</Text>,
  };
});

// VoiceScreen pulls in its own native dependencies. Stub it so loading the
// AI screen doesn't drag the whole voice subsystem into the test bundle.
jest.mock('../app/(main)/VoiceScreen', () => ({
  VoiceScreen: () => null,
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/points/')) {
      return Promise.resolve({ json: async () => ({ success: true, data: { points: 50 } }) });
    }
    if (url.includes('/ai/chat')) {
      return Promise.resolve({ json: async () => ({ success: true, message: 'Hello traveler!' }) });
    }
    return Promise.resolve({ json: async () => ({}) });
  }) as any;
});

import TourMateAIScreen from '../app/(main)/tourmate-ai';


describe('TourMateAIScreen', () => {

  it('renders the greeting message from the initial assistant turn', async () => {
    const { findByText } = render(<TourMateAIScreen />);
    expect(await findByText(/Hello! I'm Tour Mate/)).toBeTruthy();
  });

  it('loads user points from /points/:userId on mount', async () => {
    render(<TourMateAIScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/points/42'))).toBe(true);
    });
  });

  it('refreshes features on mount via context', async () => {
    render(<TourMateAIScreen />);
    await waitFor(() => {
      expect(mockRefreshFeatures).toHaveBeenCalled();
    });
  });

  it('renders the suggestion chips', async () => {
    const { findByText } = render(<TourMateAIScreen />);
    expect(await findByText(/Tell me about the Pyramids/)).toBeTruthy();
    expect(await findByText(/Plan 3 days in Cairo/)).toBeTruthy();
  });

  it('renders without crashing and triggers the initial points fetch effect', async () => {
    render(<TourMateAIScreen />);
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });
  });
});
