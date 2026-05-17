import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUp from '../app/(auth)/signup';

// ── Mocks ──────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

jest.mock('@/components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

jest.mock('../api', () => ({
  api: {
    post: jest.fn(),
  },
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => jest.clearAllMocks());


// ── Tests ──────────────────────────────────────────────────────────
describe('SignUp Screen', () => {

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    expect(getByPlaceholderText('Enter your username')).toBeTruthy();
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Create a password')).toBeTruthy();
    expect(getByPlaceholderText('Repeat your password')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('renders login link', () => {
    const { getByText } = render(<SignUp />);
    expect(getByText('Login')).toBeTruthy();
  });


  // ─────────────────────────────────────────
  // VALIDATION - USERNAME
  // ─────────────────────────────────────────
  it('shows error if username is empty', async () => {
    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Username is required')).toBeTruthy();
    });
  });

  it('shows username error on blur if empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent(getByPlaceholderText('Enter your username'), 'blur');
    await waitFor(() => {
      expect(getByText('Username is required')).toBeTruthy();
    });
  });

  it('shows username error on blur if less than 3 characters', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'ab');
    fireEvent(getByPlaceholderText('Enter your username'), 'blur');
    await waitFor(() => {
      expect(getByText('Username must be at least 3 characters')).toBeTruthy();
    });
  });

  it('clears username error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Username is required')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'j');
    await waitFor(() => expect(queryByText('Username is required')).toBeNull());
  });


  // ─────────────────────────────────────────
  // VALIDATION - EMAIL
  // ─────────────────────────────────────────
  it('shows error if email is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows error if email format is invalid', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'not-an-email');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Enter a valid email address')).toBeTruthy();
    });
  });

  it('shows email error on blur if empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent(getByPlaceholderText('Enter your email'), 'blur');
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });

  it('shows email error on blur if format is invalid', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'bad-email');
    fireEvent(getByPlaceholderText('Enter your email'), 'blur');
    await waitFor(() => {
      expect(getByText('Enter a valid email address')).toBeTruthy();
    });
  });

  it('clears email error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'j');
    await waitFor(() => expect(queryByText('Email is required')).toBeNull());
  });

  it('accepts valid email with subdomain', async () => {
    const { api } = require('../api');
    api.post.mockResolvedValueOnce({
      data: { token: 'fake_token', id: 1, username: 'john', email: 'john@mail.co.uk', role: 'user' },
    });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@mail.co.uk');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });


  // ─────────────────────────────────────────
  // VALIDATION - PASSWORD
  // ─────────────────────────────────────────
  it('shows error if password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows error if password is less than 6 characters', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Password must be at least 6 characters')).toBeTruthy();
    });
  });

  it('accepts password with exactly 6 characters', async () => {
    const { api } = require('../api');
    api.post.mockResolvedValueOnce({
      data: { token: 'fake_token', id: 1, username: 'john', email: 'john@test.com', role: 'user' },
    });

    const { getByText, getByPlaceholderText, queryByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(queryByText('Password must be at least 6 characters')).toBeNull();
    });
  });

  it('shows password error on blur if empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent(getByPlaceholderText('Create a password'), 'blur');
    await waitFor(() => {
      expect(getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows password error on blur if too short', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123');
    fireEvent(getByPlaceholderText('Create a password'), 'blur');
    await waitFor(() => {
      expect(getByText('Password must be at least 6 characters')).toBeTruthy();
    });
  });

  it('clears password error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Password is required')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Create a password'), '1');
    await waitFor(() => expect(queryByText('Password is required')).toBeNull());
  });


  // ─────────────────────────────────────────
  // VALIDATION - REPEAT PASSWORD
  // ─────────────────────────────────────────
  it('shows error if repeat password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Please repeat your password')).toBeTruthy();
    });
  });

  it('shows error if passwords do not match', async () => {
    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), 'different');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('shows repeat password error on blur if empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent(getByPlaceholderText('Repeat your password'), 'blur');
    await waitFor(() => {
      expect(getByText('Please repeat your password')).toBeTruthy();
    });
  });

  it('shows repeat password error on blur if passwords do not match', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), 'abcdef');
    fireEvent(getByPlaceholderText('Repeat your password'), 'blur');
    await waitFor(() => {
      expect(getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('clears repeat password error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Please repeat your password')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '1');
    await waitFor(() => expect(queryByText('Please repeat your password')).toBeNull());
  });

  it('shows all validation errors at once if all fields are empty', async () => {
    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(getByText('Username is required')).toBeTruthy();
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
      expect(getByText('Please repeat your password')).toBeTruthy();
    });
  });

  it('does not call api if validation fails', async () => {
    const { api } = require('../api');
    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
    });
  });


  // ─────────────────────────────────────────
  // SIGNUP SUCCESS
  // ─────────────────────────────────────────
  it('navigates to confirmation on successful signup', async () => {
    const mockPush = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
    });

    const { api } = require('../api');
    api.post.mockResolvedValueOnce({
      data: { token: 'fake_token', id: 1, username: 'john', email: 'john@test.com', role: 'user' },
    });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
        pathname: '/(auth)/confirmation',
        params: expect.objectContaining({
          username: 'john',
          email: 'john@test.com',
        }),
      }));
    });
  });

  it('saves token and user to AsyncStorage on success', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const { api } = require('../api');
    api.post.mockResolvedValueOnce({
      data: { token: 'fake_token', id: 1, username: 'john', email: 'john@test.com', role: 'user' },
    });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'fake_token');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
    });
  });


  // ─────────────────────────────────────────
  // SIGNUP FAILURE
  // ─────────────────────────────────────────
  it('shows server error if email already exists', async () => {
    const { api } = require('../api');
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'This email is already registered' } },
    });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('This email is already registered')).toBeTruthy();
    });
  });

  it('shows generic error if server fails with no message', async () => {
    const { api } = require('../api');
    api.post.mockRejectedValueOnce({
      response: { data: {} },
    });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(getByText('Sign up failed')).toBeTruthy();
    });
  });

  it('retries on network error and eventually shows error', async () => {
    const { api } = require('../api');
    // No response = network error → triggers retry logic
    api.post.mockRejectedValue({ response: undefined });

    const { getByText, getByPlaceholderText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), '123456');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      // After retries exhausted, shows fallback error
      expect(getByText('Sign up failed')).toBeTruthy();
      // api.post called 3 times: original + 2 retries
      expect(api.post).toHaveBeenCalledTimes(3);
    }, { timeout: 5000 });
  });


  // ─────────────────────────────────────────
  // PASSWORD VISIBILITY
  // ─────────────────────────────────────────
  it('toggles password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(<SignUp />);
    const passwordInput = getByPlaceholderText('Create a password');
    expect(passwordInput.props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('toggle-password'));
    expect(passwordInput.props.secureTextEntry).toBe(false);
  });

  it('toggles repeat password visibility', () => {
    const { getByPlaceholderText, getByTestId } = render(<SignUp />);
    const repeatPasswordInput = getByPlaceholderText('Repeat your password');
    expect(repeatPasswordInput.props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('toggle-repeat-password'));
    expect(repeatPasswordInput.props.secureTextEntry).toBe(false);
  });


  // ─────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────
  it('navigates to login when login link is pressed', () => {
    const mockPush = jest.fn();
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
    });

    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Login'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

});
