import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.setTimeout(20000);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-asset', () => ({
  Asset: { loadAsync: jest.fn().mockResolvedValue([]) },
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '../app/index';

// Helper: configure AsyncStorage.getItem to return a value per key. Returns null for any
// key not in `values`.
function configureStorage(values: Record<string, string | null>) {
  (AsyncStorage.getItem as jest.Mock).mockReset();
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(values[key] ?? null),
  );
}

beforeEach(() => {
  mockReplace.mockClear();
});


describe('SplashScreen routing', () => {

  it('routes admin users to /(admin)/dashboard when a token + admin user is present', async () => {
    configureStorage({
      token: 'tok',
      user: JSON.stringify({ id: 1, role: 'admin' }),
    });

    render(<SplashScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(admin)/dashboard');
    }, { timeout: 10000 });
  });

  it('routes regular users to /(main)/home', async () => {
    configureStorage({
      token: 'tok',
      user: JSON.stringify({ id: 5, role: 'user' }),
    });

    render(<SplashScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(main)/home');
    }, { timeout: 10000 });
  });

  it('routes to /onboarding when neither a token nor hasOnboarded is set', async () => {
    configureStorage({});

    render(<SplashScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding');
    }, { timeout: 10000 });
  });

  it('routes to /(auth)/login when no token but hasOnboarded is set', async () => {
    configureStorage({ hasOnboarded: 'true' });

    render(<SplashScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    }, { timeout: 10000 });
  });

  it('routes to /(auth)/login when AsyncStorage throws (graceful fallback)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage failure'));

    render(<SplashScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    }, { timeout: 10000 });
  });
});
