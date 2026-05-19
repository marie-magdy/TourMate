import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
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

import Dashboard from '../app/(admin)/dashboard';

const STATS = {
  total_users: 12,
  total_attractions: 50,
  total_favorites: 100,
  total_points: 5000,
  top_attractions: [{ name: 'Pyramids', city: 'Giza', favorites: 80 }],
};

const USERS = [
  { id: 1, username: 'superadmin', email: 'a@t.c', role: 'admin', voice_chat_enabled: true, points: 1000, total_earned: 2000, favorites_count: 5, created_at: '' },
  { id: 2, username: 'jane',       email: 'j@t.c', role: 'user',  voice_chat_enabled: false, points: 200,  total_earned: 300,  favorites_count: 3, created_at: '' },
];

function setupFetch(opts: { stats?: any; users?: any[] } = {}) {
  const { stats = STATS, users = USERS } = opts;
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes('/admin/stats')) return Promise.resolve({ json: async () => ({ success: true, data: stats }) });
    if (url.includes('/admin/users') && options?.method === 'DELETE') {
      return Promise.resolve({ json: async () => ({ success: true }) });
    }
    if (url.includes('/admin/users') && options?.method === 'PUT') {
      return Promise.resolve({ json: async () => ({ success: true }) });
    }
    if (url.includes('/admin/users')) return Promise.resolve({ json: async () => ({ success: true, data: users }) });
    return Promise.resolve({ json: async () => ({}) });
  }) as any;
}


describe('Admin Dashboard', () => {

  it('fetches /admin/stats and /admin/users on mount', async () => {
    setupFetch();
    render(<Dashboard />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/admin/stats'))).toBe(true);
      expect(calls.some(u => u.includes('/admin/users'))).toBe(true);
    });
  });

  it('renders stat values from the API response', async () => {
    setupFetch();
    const { findByText } = render(<Dashboard />);
    expect(await findByText('12')).toBeTruthy();
    expect(await findByText('50')).toBeTruthy();
    expect(await findByText('100')).toBeTruthy();
  });

  it('renders each non-super-admin user with their role badge', async () => {
    setupFetch();
    const { findByText, findAllByText } = render(<Dashboard />);
    // Switch to the Users tab.
    fireEvent.press(await findByText('Users'));
    await findAllByText('superadmin');
    expect(await findByText('jane')).toBeTruthy();
  });

  it('confirms before deleting a user and calls DELETE /admin/users/:id', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'Delete').onPress();
    });

    setupFetch();
    const { findAllByText, findByText } = render(<Dashboard />);
    fireEvent.press(await findByText('Users'));
    const deleteButtons = await findAllByText('Delete');
    fireEvent.press(deleteButtons[0]); // First non-protected user (jane).

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(
        c => /\/admin\/users\/2$/.test(String(c[0])) && c[1]?.method === 'DELETE',
      );
      expect(call).toBeDefined();
    });

    alertSpy.mockRestore();
  });

  it('PUTs role change when Promote is confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'Promote' || b.text === 'Demote').onPress();
    });

    setupFetch();
    const { findByText } = render(<Dashboard />);
    fireEvent.press(await findByText('Users'));
    fireEvent.press(await findByText('Promote'));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(
        c => /\/admin\/users\/2\/role$/.test(String(c[0])) && c[1]?.method === 'PUT',
      );
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ role: 'admin' });
    });

    alertSpy.mockRestore();
  });

  it('PUTs voice-access change when Enable Voice is confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      buttons.find((b: any) => b.text === 'Enable' || b.text === 'Disable').onPress();
    });

    setupFetch();
    const { findByText } = render(<Dashboard />);
    fireEvent.press(await findByText('Users'));
    fireEvent.press(await findByText('Enable Voice'));

    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(
        c => /\/admin\/users\/2\/voice-access$/.test(String(c[0])) && c[1]?.method === 'PUT',
      );
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ enabled: true });
    });

    alertSpy.mockRestore();
  });

  it('does NOT render Promote/Delete/Voice buttons for the protected super-admin (id=1)', async () => {
    setupFetch();
    const { findAllByText, queryAllByText, findByText } = render(<Dashboard />);
    fireEvent.press(await findByText('Users'));
    await findAllByText('superadmin');

    // Only jane (id=2) should have these buttons → 1 Delete button total.
    expect(queryAllByText('Delete').length).toBe(1);
    expect(queryAllByText('Promote').length).toBe(1);
    expect(queryAllByText('Enable Voice').length).toBe(1);
  });
});
