import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({
    username: 'john',
    email: 'john@test.com',
    userId: '42',
    token: 'fake_token',
  }),
}));

jest.mock('../api', () => ({
  api: { put: jest.fn(), post: jest.fn(), get: jest.fn() },
}));

const { api: mockedApi } = require('../api');
const mockApiPut = mockedApi.put as jest.Mock;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => jest.clearAllMocks());

import Confirmation from '../app/(auth)/confirmation';


describe('Confirmation', () => {

  it('renders username, email and password fields seeded from route params', () => {
    const { getByDisplayValue, getAllByDisplayValue } = render(<Confirmation />);
    expect(getAllByDisplayValue('john').length).toBeGreaterThan(0);
    expect(getByDisplayValue('john@test.com')).toBeTruthy();
  });

  it('toggles password fields on Change → Cancel', () => {
    const { getByText, queryByText, queryByPlaceholderText } = render(<Confirmation />);
    expect(queryByPlaceholderText('Enter current password')).toBeNull();

    fireEvent.press(getByText('Change'));
    expect(queryByPlaceholderText('Enter current password')).toBeTruthy();
    expect(queryByPlaceholderText('Enter new password')).toBeTruthy();

    fireEvent.press(getByText('Cancel'));
    expect(queryByPlaceholderText('Enter current password')).toBeNull();
    expect(queryByText('Change')).toBeTruthy();
  });

  it('alerts when password fields are empty on Save Password', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<Confirmation />);

    fireEvent.press(getByText('Change'));
    fireEvent.press(getByText('Save Password'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please fill in both password fields');
    expect(mockApiPut).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('alerts when new password is shorter than 6 characters', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = render(<Confirmation />);

    fireEvent.press(getByText('Change'));
    fireEvent.changeText(getByPlaceholderText('Enter current password'), 'oldpw');
    fireEvent.changeText(getByPlaceholderText('Enter new password'), 'abc');
    fireEvent.press(getByText('Save Password'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'New password must be at least 6 characters');
    expect(mockApiPut).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('PUTs /auth/user/:id/password with current/new password on success', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApiPut.mockResolvedValueOnce({ data: {} });

    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<Confirmation />);

    fireEvent.press(getByText('Change'));
    fireEvent.changeText(getByPlaceholderText('Enter current password'), 'oldpw');
    fireEvent.changeText(getByPlaceholderText('Enter new password'), 'newpass');
    fireEvent.press(getByText('Save Password'));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/auth/user/42/password', {
        current_password: 'oldpw',
        new_password: 'newpass',
      });
      expect(alertSpy).toHaveBeenCalledWith('Success', 'Password updated successfully');
    });

    // Password fields collapse after success.
    await waitFor(() => {
      expect(queryByPlaceholderText('Enter current password')).toBeNull();
    });
    alertSpy.mockRestore();
  });

  it('alerts with server message when password change fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApiPut.mockRejectedValueOnce({
      response: { data: { message: 'Current password is incorrect' } },
    });

    const { getByText, getByPlaceholderText } = render(<Confirmation />);
    fireEvent.press(getByText('Change'));
    fireEvent.changeText(getByPlaceholderText('Enter current password'), 'oldpw');
    fireEvent.changeText(getByPlaceholderText('Enter new password'), 'newpass');
    fireEvent.press(getByText('Save Password'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Current password is incorrect');
    });
    alertSpy.mockRestore();
  });

  it('alerts when username/email are emptied on Save Settings', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByDisplayValue, getByText } = render(<Confirmation />);

    fireEvent.changeText(getByDisplayValue('john@test.com'), '');
    fireEvent.press(getByText('Save Settings'));

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Username and email are required');
    expect(mockApiPut).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('PUTs /auth/user/:id with edited username/email and replaces to home', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons?: any) => {
      // simulate user tapping OK
      const ok = buttons?.find((b: any) => b.text === 'OK');
      ok?.onPress?.();
    });
    mockApiPut.mockResolvedValueOnce({ data: {} });

    const { getByText, getByDisplayValue } = render(<Confirmation />);
    fireEvent.changeText(getByDisplayValue('john@test.com'), 'new@test.com');
    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/auth/user/42', {
        username: 'john',
        email: 'new@test.com',
      });
      expect(mockReplace).toHaveBeenCalledWith('/(main)/home');
    });
    alertSpy.mockRestore();
  });

  it('alerts on Save Settings failure with server-provided message', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApiPut.mockRejectedValueOnce({
      response: { data: { message: 'Email already in use' } },
    });

    const { getByText } = render(<Confirmation />);
    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Email already in use');
    });
    alertSpy.mockRestore();
  });

  it('disables Save Settings while loading', async () => {
    let resolveReq: any;
    mockApiPut.mockImplementationOnce(() => new Promise(r => { resolveReq = r; }));

    const { getByText, findByText } = render(<Confirmation />);
    fireEvent.press(getByText('Save Settings'));

    expect(await findByText('Saving...')).toBeTruthy();
    resolveReq({ data: {} });
  });
});
