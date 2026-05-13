import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Login from '../app/(auth)/login';

// ── Mocks ──────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [null, null, jest.fn()],
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn().mockReturnValue('tourmate://'),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    setUser: jest.fn(),
    refreshFeatures: jest.fn(),
  }),
}));

jest.mock('@/components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

// Mock fetch globally
global.fetch = jest.fn();

beforeEach(() => jest.clearAllMocks());


// RENDER
describe('Login Screen', () => {

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(<Login />);
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });


  // VALIDATION
  it('shows error if email is empty', async () => {
    const { getByText } = render(<Login />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows error if password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows error if email format is invalid', async () => {
    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'not-an-email');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Enter a valid email address')).toBeTruthy();
    });
  });

  it('clears email error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<Login />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'j');
    await waitFor(() => expect(queryByText('Email is required')).toBeNull());
  });


  
  // LOGIN SUCCESS
  it('navigates to home for regular user on success', async () => {
    const mockReplace = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fake_token',
        user: { id: 1, email: 'john@test.com', role: 'user' },
      }),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(main)/home');
    });
  });

  it('navigates to admin dashboard for admin user', async () => {
    const mockReplace = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fake_token',
        user: { id: 1, email: 'admin@test.com', role: 'admin' },
      }),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'admin@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(admin)/dashboard');
    });
  });


  // LOGIN FAILURE
  it('shows error message on invalid credentials', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'wrongpass');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Invalid email or password')).toBeTruthy();
    });
  });

  it('shows network error if server is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Could not connect to server. Check your connection.')).toBeTruthy();
    });
  });


  // PASSWORD VISIBILITY
  it('toggles password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(<Login />);
    const passwordInput = getByPlaceholderText('Enter your password');
    expect(passwordInput.props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('toggle-password'));
    expect(passwordInput.props.secureTextEntry).toBe(false);
  });
  
});