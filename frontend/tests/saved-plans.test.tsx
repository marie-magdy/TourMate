import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(JSON.stringify({ id: 42 })),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../components/DesertTriangles', () => () => null);
jest.mock('@/components/BottomTab', () => () => null);

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

import SavedPlansScreen from '../app/(main)/saved-plans';

const samplePlan = {
  id: 1,
  city: 'cairo',
  start_date: '2026-06-01',
  end_date: '2026-06-03',
  budget: '5000',
  created_at: '2026-05-19',
  itinerary: [{ day: 1, date: '2026-06-01', activities: [{ id: 'a', time: '09:00', title: 'Pyramids', icon: '🏛', cost_egp: 200 }] }],
};

const jsonRes = (body: any) => ({
  ok: true,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

describe('SavedPlansScreen', () => {

  it('fetches /plans/:userId after loading the userId from AsyncStorage', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonRes({ success: true, data: [] })) as any;
    render(<SavedPlansScreen />);
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(calls.some(u => u.includes('/plans/42'))).toBe(true);
    });
  });

  it('renders a plan card with the city name and date range', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonRes({
      success: true,
      data: [samplePlan],
    })) as any;
    const { findByText } = render(<SavedPlansScreen />);
    expect(await findByText('Cairo')).toBeTruthy();
    expect(await findByText(/Jun 1.*Jun 3.*2026/)).toBeTruthy();
  });

  it('falls back to "Cairo" capitalization when no custom name is set', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonRes({
      success: true,
      data: [samplePlan],
    })) as any;
    const { findByText } = render(<SavedPlansScreen />);
    expect(await findByText('Cairo')).toBeTruthy();
  });

  it('uses the plan.name field when provided instead of the city', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonRes({
      success: true,
      data: [{ ...samplePlan, name: 'My Egypt Trip' }],
    })) as any;
    const { findByText } = render(<SavedPlansScreen />);
    expect(await findByText('My Egypt Trip')).toBeTruthy();
  });

  it('shows the total number of stops across days', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonRes({
      success: true,
      data: [{
        ...samplePlan,
        itinerary: [
          { day: 1, date: '2026-06-01', activities: [
            { id: 'a', time: '09:00', title: 'P1', icon: '', cost_egp: 100 },
            { id: 'b', time: '12:00', title: 'P2', icon: '', cost_egp: 50 },
          ]},
          { day: 2, date: '2026-06-02', activities: [
            { id: 'start', time: '08:00', title: 'Start', icon: '' },
            { id: 'c', time: '10:00', title: 'P3', icon: '', cost_egp: 75 },
            { id: 'end', time: '18:00', title: 'End', icon: '' },
          ]},
        ],
      }],
    })) as any;
    const { findByText } = render(<SavedPlansScreen />);
    // 3 real stops total (Start/End excluded).
    expect(await findByText('3 stops')).toBeTruthy();
  });

  it('confirms with Alert before deleting a plan', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue(jsonRes({
      success: true,
      data: [samplePlan],
    })) as any;

    const { findAllByText } = render(<SavedPlansScreen />);
    const trashIcons = await findAllByText('icon:trash-can-outline');
    fireEvent.press(trashIcons[0], { stopPropagation: () => {} });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete plan?',
      'This cannot be undone.',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('DELETEs the plan and removes it from the list when user confirms', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _msg, buttons: any) => {
      const del = buttons?.find((b: any) => b.text === 'Delete');
      del?.onPress?.();
    });

    const fetchMock = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'DELETE') {
        return Promise.resolve(jsonRes({ success: true }));
      }
      return Promise.resolve(jsonRes({ success: true, data: [samplePlan] }));
    });
    global.fetch = fetchMock as any;

    const { findAllByText, queryByText } = render(<SavedPlansScreen />);
    const trashIcons = await findAllByText('icon:trash-can-outline');
    fireEvent.press(trashIcons[0], { stopPropagation: () => {} });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.find(c => c[1]?.method === 'DELETE');
      expect(calls).toBeDefined();
      expect(String(calls![0])).toContain('/plans/1');
    });

    await waitFor(() => {
      expect(queryByText('Cairo')).toBeNull();
    });

    alertSpy.mockRestore();
  });
});
