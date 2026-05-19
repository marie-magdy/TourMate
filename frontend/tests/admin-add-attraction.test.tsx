import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY = 'gpk-test';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

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

import AddAttractionScreen from '../app/(admin)/add-attraction';


describe('Admin Add-Attraction screen', () => {

  it('alerts when name is empty on Save', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    global.fetch = jest.fn() as any;

    const { getByText } = render(<AddAttractionScreen />);
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Name is required.');
    });
    expect(global.fetch).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('alerts when no image has been added even with a name', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    global.fetch = jest.fn() as any;

    const { getByText, getByPlaceholderText } = render(<AddAttractionScreen />);
    // The first text input is the name field — fill it.
    const nameInput = getByPlaceholderText(/Type a name|Pyramids|Hilton/i);
    fireEvent.changeText(nameInput, 'My Place');
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      const calls = alertSpy.mock.calls;
      expect(calls.some(c => c[0] === 'Error' && /image/i.test(String(c[1])))).toBe(true);
    });
    expect(global.fetch).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('triggers Google Places autocomplete only when query is at least 3 chars', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ predictions: [] }),
    }) as any;

    const { getByPlaceholderText } = render(<AddAttractionScreen />);
    const nameInput = getByPlaceholderText(/Type a name|Pyramids|Hilton/i);

    fireEvent.changeText(nameInput, 'ab'); // < 3 chars
    jest.advanceTimersByTime(700);
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.changeText(nameInput, 'abc'); // ≥ 3 chars
    jest.advanceTimersByTime(700);
    await Promise.resolve();
    expect((global.fetch as jest.Mock).mock.calls.some(
      c => String(c[0]).includes('place/autocomplete'),
    )).toBe(true);

    jest.useRealTimers();
  });
});
