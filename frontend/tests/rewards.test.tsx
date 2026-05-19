import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(JSON.stringify({ id: 42 })),
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

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

import RewardsScreen from '../app/(main)/rewards';

const REWARDS = [
  { id: 1, title: 'Free coffee', description: 'At any cafe', points_required: 100, category: 'food', icon: '☕' },
  { id: 2, title: 'Big trip',    description: 'Free hotel',   points_required: 3000, category: 'travel', icon: '🏨' },
];

function setupFetch(opts: {
  points?: { points: number; total_earned: number };
  rewards?: any[];
  history?: any[];
  redeem?: any;
} = {}) {
  const {
    points = { points: 1200, total_earned: 1200 },
    rewards = REWARDS,
    history = [],
    redeem,
  } = opts;
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes('/points/rewards/all')) return Promise.resolve({ json: async () => ({ success: true, data: rewards }) });
    if (url.includes('/history')) return Promise.resolve({ json: async () => ({ success: true, data: history }) });
    if (url.includes('/redeem') && options?.method === 'POST')
      return Promise.resolve({ json: async () => redeem ?? { success: true, data: { points: 100 }, reward: rewards[0] } });
    if (url.includes('/points/')) return Promise.resolve({ json: async () => ({ success: true, data: points }) });
    return Promise.resolve({ json: async () => ({}) });
  }) as any;
}


describe('RewardsScreen', () => {

  it('fetches points + rewards on mount for the stored user', async () => {
    setupFetch();
    render(<RewardsScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/points/42'))).toBe(true);
      expect(calls.some(u => u.includes('/points/rewards/all'))).toBe(true);
    });
  });

  it('shows the user point balance', async () => {
    setupFetch({ points: { points: 1200, total_earned: 1200 } });
    const { findAllByText } = render(<RewardsScreen />);
    const matches = await findAllByText(/1200/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('classifies total 250 points → Explorer tier', async () => {
    setupFetch({ points: { points: 250, total_earned: 250 } });
    const { findByText } = render(<RewardsScreen />);
    expect(await findByText('Explorer')).toBeTruthy();
  });

  it('classifies total 800 points → Adventurer tier', async () => {
    setupFetch({ points: { points: 800, total_earned: 800 } });
    const { findByText } = render(<RewardsScreen />);
    expect(await findByText('Adventurer')).toBeTruthy();
  });

  it('classifies total 2000 points → Trailblazer tier', async () => {
    setupFetch({ points: { points: 2000, total_earned: 2000 } });
    const { findByText } = render(<RewardsScreen />);
    expect(await findByText('Trailblazer')).toBeTruthy();
  });

  it('classifies total 5000 points → Legend tier', async () => {
    setupFetch({ points: { points: 5000, total_earned: 5000 } });
    const { findByText } = render(<RewardsScreen />);
    expect(await findByText('Legend')).toBeTruthy();
  });

  it('renders rewards from the API', async () => {
    setupFetch();
    const { findByText } = render(<RewardsScreen />);
    expect(await findByText('Free coffee')).toBeTruthy();
    expect(await findByText('Big trip')).toBeTruthy();
  });
});
