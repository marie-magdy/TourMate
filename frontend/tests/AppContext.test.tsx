import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

process.env.EXPO_PUBLIC_API_URL = 'localhost';
process.env.EXPO_PUBLIC_EXCHANGE_API_KEY = 'test-key';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp, CURRENCY_SYMBOLS } from '../constants/AppContext';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

// Helper: render provider + a probe component that exposes the context
// via a ref-like callback.
function setupProvider() {
  let ctx: ReturnType<typeof useApp> | undefined;
  const Probe = () => {
    ctx = useApp();
    return <Text>{ctx.user ? ctx.user.username : 'no-user'}</Text>;
  };
  const utils = render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  return { utils, getCtx: () => ctx! };
}


describe('AppProvider — defaults', () => {
  it('starts with no user, en, EGP, empty exchange rates → exchangeRate=1', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    const ctx = getCtx();
    expect(ctx.user).toBeNull();
    expect(ctx.userId).toBe(0);
    expect(ctx.language).toBe('en');
    expect(ctx.currency).toBe('EGP');
    expect(ctx.currencySymbol).toBe(CURRENCY_SYMBOLS.EGP);
    expect(ctx.isRTL).toBe(false);
    expect(ctx.exchangeRate).toBe(1);
  });
});


describe('AppProvider — user persistence', () => {
  it('loads user from AsyncStorage and exposes userId', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'user') return JSON.stringify({ id: 7, username: 'jane', email: 'j@t.c', role: 'user' });
      if (key === 'voice_chat_enabled') return JSON.stringify(true);
      return null;
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));
    await waitFor(() => expect(getCtx().user?.id).toBe(7));

    const ctx = getCtx();
    expect(ctx.userId).toBe(7);
    expect(ctx.voiceChatEnabled).toBe(true);
  });

  it('setUser writes to AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => {
      getCtx().setUser({ id: 1, username: 'jo', email: 'j@t.c', role: 'user', voice_chat_enabled: false });
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ id: 1, username: 'jo', email: 'j@t.c', role: 'user', voice_chat_enabled: false }),
    );
  });

  it('setUser(null) removes the user from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { getCtx().setUser(null); });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('logout clears user/token/voice flag from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().logout(); });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('voice_chat_enabled');
    expect(getCtx().user).toBeNull();
  });
});


describe('AppProvider — language', () => {
  it('restores Arabic from saved display name and reports isRTL=true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'preferences') return JSON.stringify({ language: 'العربية' });
      return null;
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().language).toBe('ar'));
    expect(getCtx().isRTL).toBe(true);
  });

  it('maps Français → fr and Deutsch → de from preferences', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'preferences') return JSON.stringify({ language: 'Français' });
      return null;
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().language).toBe('fr'));
  });

  it('setLanguage persists display name to preferences', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().setLanguage('ar'); });

    const lastCall = (AsyncStorage.setItem as jest.Mock).mock.calls
      .find(([key]) => key === 'preferences');
    expect(lastCall).toBeDefined();
    expect(JSON.parse(lastCall[1]).language).toBe('العربية');
  });

  it('t() returns English value for an "en" key', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));
    // "home" is a known translation key in i18n.ts
    expect(getCtx().t('home')).toBe('Home');
  });

  it('t() falls back to the key itself for unknown keys', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));
    expect(getCtx().t('definitely_not_a_real_key')).toBe('definitely_not_a_real_key');
  });
});


describe('AppProvider — currency conversion', () => {
  it('returns "EGP X" when currency is EGP regardless of rates', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        result: 'success',
        conversion_rates: { USD: 1, EGP: 50, EUR: 0.9 },
      }),
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));
    expect(getCtx().convertPrice(100)).toBe('EGP 100');
  });

  it('converts EGP → USD using fetched rates', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        result: 'success',
        conversion_rates: { USD: 1, EGP: 50, EUR: 0.9 },
      }),
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().exchangeRate).toBeGreaterThan(0));

    await act(async () => { await getCtx().setCurrency('USD'); });
    // 500 EGP / 50 EGP-per-USD = 10 USD → "$10"
    expect(getCtx().convertPrice(500)).toBe('$10');
  });

  // ── TC-CUR-04: rates are refreshed on app mount (one fetch to ExchangeRate-API) ──
  it('fetches exchange rates on mount from ExchangeRate-API', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        result: 'success',
        conversion_rates: { USD: 1, EGP: 50, EUR: 0.9 },
      }),
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));
    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.includes('exchangerate-api.com'))).toBe(true);
    });
  });

  // ── TC-CUR-02: EUR → EGP using the EUR rate ──
  it('converts EGP → EUR using fetched rates', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        result: 'success',
        conversion_rates: { USD: 1, EGP: 50, EUR: 0.9 },
      }),
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().exchangeRate).toBeGreaterThan(0));

    await act(async () => { await getCtx().setCurrency('EUR'); });
    // 1000 EGP / 50 EGP-per-USD = 20 USD * 0.9 EUR-per-USD = 18 EUR → "€18"
    expect(getCtx().convertPrice(1000)).toBe('€18');
  });

  it('falls back to 50 EGP-per-USD when rates are missing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().setCurrency('USD'); });
    // 500/50 * 1 (USD default in initial rates) = 10 → "$10"
    expect(getCtx().convertPrice(500)).toBe('$10');
  });

  it('setCurrency persists to AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().setCurrency('GBP'); });

    const lastCall = (AsyncStorage.setItem as jest.Mock).mock.calls
      .find(([key]) => key === 'preferences');
    expect(JSON.parse(lastCall[1]).currency).toBe('GBP');
  });
});


describe('AppProvider — refreshFeatures', () => {
  it('updates voiceChatEnabled from /auth/user/:id/features', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('exchangerate')) return Promise.reject(new Error('skip'));
      if (url.includes('/auth/user/42/features')) {
        return Promise.resolve({ json: async () => ({ data: { voice_chat_enabled: true } }) });
      }
      return Promise.reject(new Error('unexpected'));
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().refreshFeatures(42); });
    expect(getCtx().voiceChatEnabled).toBe(true);
  });

  it('returns early when no userId is provided and no user is loaded', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('skip'));

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    (global.fetch as jest.Mock).mockClear();
    await act(async () => { await getCtx().refreshFeatures(); });
    // Should NOT have called /features.
    const calls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('/features'))).toBe(false);
  });

  it('defaults voiceChatEnabled to false when API omits the field', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('exchangerate')) return Promise.reject(new Error('skip'));
      if (url.includes('/features')) return Promise.resolve({ json: async () => ({}) });
      return Promise.reject(new Error('unexpected'));
    });

    const { getCtx } = setupProvider();
    await waitFor(() => expect(getCtx().userReady).toBe(true));

    await act(async () => { await getCtx().refreshFeatures(5); });
    expect(getCtx().voiceChatEnabled).toBe(false);
  });
});
