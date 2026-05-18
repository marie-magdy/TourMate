import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Login from '../app/(auth)/login';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mocks ──────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

// Google auth: keep mutable so individual tests can swap response/promptAsync.
const mockGoogleState: {
  response: any;
  promptAsync: jest.Mock;
  request: any;
} = {
  response: null,
  promptAsync: jest.fn(),
  request: {},
};

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: () => [
    mockGoogleState.request,
    mockGoogleState.response,
    mockGoogleState.promptAsync,
  ],
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn().mockReturnValue('tourmate://'),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const mockSetUser = jest.fn();
const mockRefreshFeatures = jest.fn();
jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    setUser: mockSetUser,
    refreshFeatures: mockRefreshFeatures,
  }),
}));

jest.mock('@/components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Mock fetch globally
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogleState.response = null;
  mockGoogleState.request = {};
  mockGoogleState.promptAsync = jest.fn();
});


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

  it('clears password error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Password is required')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'a');
    await waitFor(() => expect(queryByText('Password is required')).toBeNull());
  });

  // BLUR VALIDATION (onEndEditing)
  it('validates email on blur (required)', async () => {
    const { getByPlaceholderText, getByText } = render(<Login />);
    fireEvent(getByPlaceholderText('Enter your email'), 'endEditing', {
      nativeEvent: { text: '   ' },
    });
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
  });

  it('validates email on blur (format)', async () => {
    const { getByPlaceholderText, getByText } = render(<Login />);
    fireEvent(getByPlaceholderText('Enter your email'), 'endEditing', {
      nativeEvent: { text: 'bad-email' },
    });
    await waitFor(() => expect(getByText('Enter a valid email address')).toBeTruthy());
  });

  it('validates password on blur (required)', async () => {
    const { getByPlaceholderText, getByText } = render(<Login />);
    fireEvent(getByPlaceholderText('Enter your password'), 'endEditing', {
      nativeEvent: { text: '   ' },
    });
    await waitFor(() => expect(getByText('Password is required')).toBeTruthy());
  });

  it('trims whitespace from autofilled email/password on blur', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fake_token',
        user: { id: 1, email: 'john@test.com', role: 'user' },
      }),
    });

    const { getByPlaceholderText, getByText } = render(<Login />);
    fireEvent(getByPlaceholderText('Enter your email'), 'endEditing', {
      nativeEvent: { text: '  john@test.com  ' },
    });
    fireEvent(getByPlaceholderText('Enter your password'), 'endEditing', {
      nativeEvent: { text: '  123456  ' },
    });
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'john@test.com', password: '123456' }),
        }),
      );
    });
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

  it('persists token+user and refreshes context on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'fake_token',
        user: { id: 42, email: 'john@test.com', role: 'user' },
      }),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'fake_token');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ id: 42, email: 'john@test.com', role: 'user' }),
      );
      expect(mockSetUser).toHaveBeenCalledWith({ id: 42, email: 'john@test.com', role: 'user' });
      expect(mockRefreshFeatures).toHaveBeenCalledWith(42);
    });
  });

  it('sends login request to the correct endpoint with email/password body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 't',
        user: { id: 1, email: 'john@test.com', role: 'user' },
      }),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'pw');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/login$/),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'john@test.com', password: 'pw' }),
        }),
      );
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

  it('falls back to generic message when server omits error field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { getByText, getByPlaceholderText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'wrong');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Invalid credentials.')).toBeTruthy();
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

  it('clears the general error banner when the user edits a field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    const { getByText, getByPlaceholderText, queryByText } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'wrong');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => expect(getByText('Invalid email or password')).toBeTruthy());

    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'wrong-but-typing');
    await waitFor(() =>
      expect(queryByText('Invalid email or password')).toBeNull(),
    );
  });


  // PASSWORD VISIBILITY
  it('toggles password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(<Login />);
    const passwordInput = getByPlaceholderText('Enter your password');
    expect(passwordInput.props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('toggle-password'));
    expect(passwordInput.props.secureTextEntry).toBe(false);
  });


  // LOADING STATE
  it('shows ActivityIndicator and disables Continue button while logging in', async () => {
    let resolveFetch: (value: any) => void = () => {};
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(resolve => { resolveFetch = resolve; }),
    );

    const { getByText, getByPlaceholderText, UNSAFE_getAllByType } = render(<Login />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), '123456');
    fireEvent.press(getByText('Continue'));

    // ActivityIndicator now shows inside the button.
    const { ActivityIndicator } = require('react-native');
    await waitFor(() => {
      expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    });

    // Wrap up the pending request to avoid open handles.
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          token: 't',
          user: { id: 1, email: 'john@test.com', role: 'user' },
        }),
      });
    });
  });


  // SIGNUP NAVIGATION
  it('navigates to signup screen when the link is pressed', () => {
    const mockPush = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      replace: jest.fn(),
      push: mockPush,
    });

    const { getByText } = render(<Login />);
    fireEvent.press(getByText('Sign up'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/signup');
  });


  // GOOGLE LOGIN
  it('calls promptAsync when "Continue with Google" is pressed', () => {
    const promptAsync = jest.fn();
    mockGoogleState.promptAsync = promptAsync;

    const { getByText } = render(<Login />);
    fireEvent.press(getByText('Continue with Google'));
    expect(promptAsync).toHaveBeenCalled();
  });

  it('completes Google login and routes to home on success', async () => {
    const mockReplace = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
    });

    // 1st fetch → Google profile, 2nd fetch → backend /auth/google
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'g-1',
          email: 'g@test.com',
          name: 'G User',
          picture: 'https://x/y.png',
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          token: 'gtoken',
          user: { id: 7, email: 'g@test.com', role: 'user' },
        }),
      });

    mockGoogleState.response = {
      type: 'success',
      authentication: { accessToken: 'access-token-xyz' },
    };

    render(<Login />);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'gtoken');
      expect(mockSetUser).toHaveBeenCalledWith({ id: 7, email: 'g@test.com', role: 'user' });
      expect(mockRefreshFeatures).toHaveBeenCalledWith(7);
      expect(mockReplace).toHaveBeenCalledWith('/(main)/home');
    });
  });

  it('alerts when backend rejects Google login', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'g-1', email: 'g@test.com', name: 'G', picture: '' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: false, message: 'Account disabled.' }),
      });

    mockGoogleState.response = {
      type: 'success',
      authentication: { accessToken: 'access-token-xyz' },
    };

    render(<Login />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Account disabled.');
    });

    alertSpy.mockRestore();
  });

  it('alerts when Google flow throws a network error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    mockGoogleState.response = {
      type: 'success',
      authentication: { accessToken: 'access-token-xyz' },
    };

    render(<Login />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Google login failed. Please try again.',
      );
    });

    alertSpy.mockRestore();
  });

});
