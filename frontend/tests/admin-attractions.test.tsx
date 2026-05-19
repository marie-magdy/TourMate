import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

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

import AdminAttractions from '../app/(admin)/attractions';

const ATTRACTIONS = [
  {
    id: 1, name: 'Pyramids', city: 'Giza', description: 'Wonder', primary_image: '',
    rating: 4.8, price_from: 200, opening_hours: '9-5', is_popular: true,
    latitude: 30, longitude: 31, categories: ['historical'],
  },
  {
    id: 2, name: 'Sphinx', city: 'Giza', description: '', primary_image: '',
    rating: 4.5, price_from: 100, opening_hours: '9-5', is_popular: false,
    latitude: 30, longitude: 31, categories: ['historical'],
  },
];

function setupFetch(opts: { attractions?: any[]; deleteOk?: boolean } = {}) {
  const { attractions = ATTRACTIONS, deleteOk = true } = opts;
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    if (options?.method === 'DELETE') {
      return deleteOk
        ? Promise.resolve({ json: async () => ({ success: true }) })
        : Promise.reject(new Error('fail'));
    }
    if (url.endsWith('/attractions')) {
      return Promise.resolve({ json: async () => ({ success: true, data: attractions }) });
    }
    return Promise.resolve({ json: async () => ({}) });
  }) as any;
}


describe('Admin Attractions screen', () => {

  it('fetches /attractions on mount', async () => {
    setupFetch();
    render(<AdminAttractions />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.endsWith('/attractions'))).toBe(true);
    });
  });

  it('renders attractions returned from the API', async () => {
    setupFetch();
    const { findByText } = render(<AdminAttractions />);
    expect(await findByText('Pyramids')).toBeTruthy();
    expect(await findByText('Sphinx')).toBeTruthy();
  });

  it('shows a confirm dialog when delete is pressed', async () => {
    setupFetch();
    const { findAllByText, findByText } = render(<AdminAttractions />);
    await findByText('Pyramids');

    const trashIcons = await findAllByText('icon:trash-can');
    fireEvent.press(trashIcons[0]);

    expect(await findByText(/Delete "Pyramids"/)).toBeTruthy();
  });

  it('DELETEs the attraction and removes it from the list when confirmed', async () => {
    setupFetch();
    const { findAllByText, findByText, queryByText, getByText } = render(<AdminAttractions />);
    await findByText('Pyramids');

    const trashIcons = await findAllByText('icon:trash-can');
    fireEvent.press(trashIcons[0]);

    // Confirm dialog uses "Delete" as the confirm-action label.
    const confirmButtons = await findAllByText('Delete');
    // First is the trash icon's text (handled), second is the modal action.
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
        c => /\/attractions\/1$/.test(String(c[0])) && c[1]?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });

    await waitFor(() => {
      expect(queryByText('Pyramids')).toBeNull();
    });
  });
});
