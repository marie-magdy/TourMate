import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../api', () => ({
  api: {
    post: jest.fn(),
    put: jest.fn(),
    get: jest.fn(),
  },
}));

// Pull a reference to the mocked function after the mock is in place.
const { api: mockedApi } = require('../api');
const mockApiPost = mockedApi.post as jest.Mock;

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

jest.mock('../components/ScreenWrapper', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
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
  // mockClear does not drain the mockResolvedValueOnce/mockRejectedValueOnce queue.
  // Reset the implementation to clear it cleanly between tests.
  mockApiPost.mockReset();
});

import SignUp from '../app/(auth)/signup';


describe('SignUp — validation', () => {

  it('renders all inputs and Continue button', () => {
    const { getByPlaceholderText, getByText } = render(<SignUp />);
    expect(getByPlaceholderText('Enter your username')).toBeTruthy();
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Create a password')).toBeTruthy();
    expect(getByPlaceholderText('Repeat your password')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('shows "Username is required" when username is empty', async () => {
    const { getByText, findByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Username is required')).toBeTruthy();
  });

  it('shows "Email is required" when email is empty', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Email is required')).toBeTruthy();
  });

  it('shows "Enter a valid email address" for invalid email format', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'not-an-email');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Enter a valid email address')).toBeTruthy();
  });

  it('shows "Password is required" when password is empty', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Password is required')).toBeTruthy();
  });

  it('shows "Password must be at least 6 characters" for short password', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Password must be at least 6 characters')).toBeTruthy();
  });

  it('shows "Please repeat your password" when repeat is empty', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Please repeat your password')).toBeTruthy();
  });

  it('shows "Passwords do not match" when passwords differ', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(getByPlaceholderText('Repeat your password'), 'different');
    fireEvent.press(getByText('Continue'));
    expect(await findByText('Passwords do not match')).toBeTruthy();
  });

  it('does NOT call the API when validation fails', async () => {
    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => {
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  it('clears username error when user starts typing', async () => {
    const { getByText, getByPlaceholderText, queryByText, findByText } = render(<SignUp />);
    fireEvent.press(getByText('Continue'));
    await findByText('Username is required');
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'j');
    await waitFor(() => expect(queryByText('Username is required')).toBeNull());
  });
});


describe('SignUp — onBlur validation', () => {
  it('validates username on blur (required + min length)', async () => {
    const { getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your username'), 'ab');
    fireEvent(getByPlaceholderText('Enter your username'), 'blur');
    expect(
      await findByText('Username must be at least 3 characters'),
    ).toBeTruthy();
  });

  it('validates email format on blur', async () => {
    const { getByPlaceholderText, findByText } = render(<SignUp />);
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'bad-email');
    fireEvent(getByPlaceholderText('Enter your email'), 'blur');
    expect(await findByText('Enter a valid email address')).toBeTruthy();
  });
});


describe('SignUp — API integration', () => {

  function fillValidForm(utils: ReturnType<typeof render>) {
    fireEvent.changeText(utils.getByPlaceholderText('Enter your username'), 'john');
    fireEvent.changeText(utils.getByPlaceholderText('Enter your email'), 'john@test.com');
    fireEvent.changeText(utils.getByPlaceholderText('Create a password'), '123456');
    fireEvent.changeText(utils.getByPlaceholderText('Repeat your password'), '123456');
  }

  it('saves token + user to AsyncStorage on success', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { token: 'tok', id: 1, username: 'john', email: 'john@test.com', role: 'user' },
    });
    const utils = render(<SignUp />);
    fillValidForm(utils);
    fireEvent.press(utils.getByText('Continue'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'tok');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify({ id: 1, username: 'john', email: 'john@test.com', role: 'user' }),
      );
    });
  });

  it('navigates to /confirmation with route params on success', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { token: 'tok', id: 7, username: 'john', email: 'john@test.com', role: 'user' },
    });
    const utils = render(<SignUp />);
    fillValidForm(utils);
    fireEvent.press(utils.getByText('Continue'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(auth)/confirmation',
        params: {
          username: 'john',
          email: 'john@test.com',
          userId: 7,
          token: 'tok',
        },
      });
    });
  });

  it('shows server-provided error message in the email field on response failure', async () => {
    mockApiPost.mockRejectedValueOnce({
      response: { data: { error: 'Email already in use' } },
    });
    const utils = render(<SignUp />);
    fillValidForm(utils);
    fireEvent.press(utils.getByText('Continue'));

    expect(await utils.findByText('Email already in use')).toBeTruthy();
  });

  it('retries up to 2 times on network errors (no response field)', async () => {
    mockApiPost
      .mockRejectedValueOnce(new Error('Network'))  // attempt 1
      .mockRejectedValueOnce(new Error('Network'))  // attempt 2 (retry 1)
      .mockResolvedValueOnce({                       // attempt 3 (retry 0) succeeds
        data: { token: 't', id: 9, username: 'john', email: 'john@test.com', role: 'user' },
      });

    const utils = render(<SignUp />);
    fillValidForm(utils);
    fireEvent.press(utils.getByText('Continue'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalled();
    });
  });

  it('falls back to generic "Sign up failed" message when error response has no body', async () => {
    mockApiPost.mockRejectedValueOnce({ response: { data: {} } });
    const utils = render(<SignUp />);
    fillValidForm(utils);
    fireEvent.press(utils.getByText('Continue'));
    expect(await utils.findByText('Sign up failed')).toBeTruthy();
  });
});


describe('SignUp — navigation', () => {
  it('navigates to login when "Login" link is pressed', () => {
    const { getByText } = render(<SignUp />);
    fireEvent.press(getByText('Login'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });
});
