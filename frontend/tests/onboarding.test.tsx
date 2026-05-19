import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-asset', () => ({
  Asset: { loadAsync: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    MaterialCommunityIcons: ({ name }: any) => <Text>{`icon:${name}`}</Text>,
  };
});

jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  // eslint-disable-next-line react/display-name
  const PagerView = React.forwardRef(({ children }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      setPage: (global as any).__mockSetPage,
    }));
    return <View testID="pager-view">{children}</View>;
  });
  return {
    __esModule: true,
    default: PagerView,
  };
});

const mockSetPage = jest.fn();
(global as any).__mockSetPage = mockSetPage;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
});

import Onboarding from '../app/onboarding';


describe('Onboarding', () => {

  it('renders all 4 slide titles after image preload', async () => {
    const { findByText } = render(<Onboarding />);
    expect(await findByText(/Plan Your Perfect Egyptian Adventure/)).toBeTruthy();
    expect(await findByText(/Instantly Learn About Every Landmark/)).toBeTruthy();
    expect(await findByText(/Chat with your personal AI tour guide/)).toBeTruthy();
    expect(await findByText(/Eco-Smart Routes/)).toBeTruthy();
  });

  it('calls pager.setPage(next) when the right-arrow is pressed on a non-final slide', async () => {
    const { findAllByText } = render(<Onboarding />);
    const arrows = await findAllByText('icon:arrow-right');
    expect(arrows.length).toBeGreaterThan(0);
    fireEvent.press(arrows[0]);
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('replaces to /login when Start is pressed on the last slide', async () => {
    const { findByText } = render(<Onboarding />);
    const startBtn = await findByText('Start');
    fireEvent.press(startBtn);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders Start text only on the last slide (not earlier slides)', async () => {
    const { findAllByText } = render(<Onboarding />);
    const starts = await findAllByText('Start');
    expect(starts).toHaveLength(1);
  });
});
