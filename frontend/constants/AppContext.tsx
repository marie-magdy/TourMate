// constants/AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from './i18n';

// ── Currency rates (against EGP as base) ─────────────────────────────
const EXCHANGE_KEY = process.env.EXPO_PUBLIC_EXCHANGE_API_KEY;

export type CurrencyCode = 'USD' | 'EGP' | 'EUR' | 'GBP' | 'SAR';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$', EGP: 'EGP ', EUR: '€', GBP: '£', SAR: 'SR',
};

// ── User type ─────────────────────────────────────────────────────────
export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AppContextType {
  // User
  user: AppUser | null;
  userId: number;
  userReady: boolean;
  setUser: (user: AppUser | null) => void;
  logout: () => Promise<void>;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;

  // Currency
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  convertPrice: (priceInUSD: number) => string;
  currencySymbol: string;
  exchangeRate: number;
}

const AppContext = createContext<AppContextType>({
  user: null,
  userId: 0,
  userReady: false,
  setUser: () => {},
  logout: async () => {},
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  isRTL: false,
  currency: 'EGP',
  setCurrency: () => {},
  convertPrice: (p) => `EGP ${p}`,
  currencySymbol: 'EGP ',
  exchangeRate: 1,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [userReady, setUserReady] = useState(false);
  const [language, setLanguageState] = useState<Language>('en');
  const [currency, setCurrencyState] = useState<CurrencyCode>('EGP');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });

  useEffect(() => {
    loadPreferences();
    loadUser();
    fetchRates();
  }, []);

  // ── Load logged-in user from AsyncStorage ─────────────────────────
  const loadUser = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) setUserState(JSON.parse(raw));
    } catch {}
    finally { setUserReady(true); }
  };

  const setUser = async (u: AppUser | null) => {
    setUserState(u);
    try {
      if (u) await AsyncStorage.setItem('user', JSON.stringify(u));
      else await AsyncStorage.removeItem('user');
    } catch {}
  };

  const logout = async () => {
    setUserState(null);
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
    } catch {}
  };

  const loadPreferences = async () => {
    try {
      const raw = await AsyncStorage.getItem('preferences');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.language) setLanguageState(langCodeMap(p.language));
        if (p.currency) setCurrencyState(p.currency as CurrencyCode);
      }
    } catch {}
  };

  const langCodeMap = (name: string): Language => {
    if (name === 'العربية') return 'ar';
    if (name === 'Français') return 'fr';
    if (name === 'Deutsch') return 'de';
    return 'en';
  };

  const fetchRates = async () => {
    try {
      const res  = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_KEY}/latest/USD`);
      const data = await res.json();
      if (data.result === 'success') setExchangeRates(data.conversion_rates);
    } catch {}
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    const displayMap: Record<Language, string> = { en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch' };
    try {
      const raw   = await AsyncStorage.getItem('preferences');
      const prefs = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem('preferences', JSON.stringify({ ...prefs, language: displayMap[lang] }));
    } catch {}
  };

  const setCurrency = async (c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      const raw   = await AsyncStorage.getItem('preferences');
      const prefs = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem('preferences', JSON.stringify({ ...prefs, currency: c }));
    } catch {}
  };

  // price is in EGP (as stored in the DB)
  const convertPrice = (priceInEGP: number): string => {
    if (currency === 'EGP') return `EGP ${priceInEGP}`;
    // Convert EGP → USD first, then USD → target currency
    const egpPerUsd = exchangeRates['EGP'] ?? 50;
    const usdPrice = priceInEGP / egpPerUsd;
    const converted = (usdPrice * (exchangeRates[currency] ?? 1)).toFixed(0);
    return `${CURRENCY_SYMBOLS[currency]}${converted}`;
  };

  const t = (key: string): string => {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  };

  const isRTL = language === 'ar';
  const exchangeRate = exchangeRates[currency] ?? 1;

  const userId = user?.id ?? 0;

  return (
    <AppContext.Provider value={{
      user, userId, userReady, setUser, logout,
      language, setLanguage, t, isRTL,
      currency, setCurrency, convertPrice,
      currencySymbol: CURRENCY_SYMBOLS[currency],
      exchangeRate,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

export { Language };
