// Mock native modules before importing the screen (which triggers a side-effect import chain).
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../constants/AppContext', () => ({
  useApp: () => ({
    t: (k: string) => k,
    convertPrice: (n: number) => `${n} EGP`,
    user: null,
    userId: 1,
  }),
}));

jest.mock('../components/AttractionSheet', () => () => null);

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

jest.mock('@/components/BottomTab', () => () => null);
jest.mock('@/store/bookingStore', () => ({
  useBookingStore: () => ({ selectedHotel: null, selectedFlight: null }),
}));

import { simplifyCoachWarning } from '../app/(main)/itinerary';

describe('simplifyCoachWarning', () => {
  it('returns empty string for empty input', () => {
    expect(simplifyCoachWarning('')).toBe('');
    expect(simplifyCoachWarning('   ')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(simplifyCoachWarning(null as any)).toBe('');
    expect(simplifyCoachWarning(undefined as any)).toBe('');
  });

  it('extracts budget overage figures into a compact summary', () => {
    const input =
      "This day's stops cost about 281 EGP, which is above the roughly 250 EGP day budget.";
    expect(simplifyCoachWarning(input)).toBe('Budget: ~281 EGP (over ~250 EGP/day).');
  });

  it('extracts budget summary even with multi-line text in between', () => {
    const input =
      'Day 2 stops cost about 600 EGP\nwhich is somewhat above the roughly 450 EGP/day budget set.';
    expect(simplifyCoachWarning(input)).toBe('Budget: ~600 EGP (over ~450 EGP/day).');
  });

  it('extracts dropped-stop information including the day, count, and stop list', () => {
    const input =
      'Day 1: 2 stop(s) could not fit your day hours and were removed in the preview: Pyramids, Sphinx';
    expect(simplifyCoachWarning(input)).toBe(
      'Day 1: removed 2 stop(s) that didn’t fit the time window (Pyramids, Sphinx).',
    );
  });

  it('detects "not route-optimized" and returns the travel-time hint', () => {
    expect(simplifyCoachWarning('This is not route-optimized.')).toBe(
      'Note: this change increases travel time compared to an optimized route.',
    );
  });

  it('detects "more driving distance" and returns the travel-time hint', () => {
    expect(simplifyCoachWarning('This has more driving distance than the previous route.')).toBe(
      'Note: this change increases travel time compared to an optimized route.',
    );
  });

  it('passes through short generic warnings untouched (after trim)', () => {
    expect(simplifyCoachWarning('Heads up.')).toBe('Heads up.');
    expect(simplifyCoachWarning('  Heads up.  ')).toBe('Heads up.');
  });

  it('truncates long generic warnings to 117 chars + ellipsis', () => {
    const long = 'x'.repeat(200);
    const result = simplifyCoachWarning(long);
    expect(result).toHaveLength(118); // 117 + ellipsis char
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns warnings at exactly 120 chars unchanged', () => {
    const exactly120 = 'a'.repeat(120);
    expect(simplifyCoachWarning(exactly120)).toBe(exactly120);
  });

  it('truncates warnings at 121+ chars', () => {
    const longer = 'a'.repeat(121);
    const out = simplifyCoachWarning(longer);
    expect(out).toHaveLength(118);
    expect(out.endsWith('…')).toBe(true);
  });

  it('is case-insensitive on the budget regex', () => {
    const input = 'cost ABOUT 100 EGP for this day, above the ROUGHLY 80 EGP/day budget';
    expect(simplifyCoachWarning(input)).toBe('Budget: ~100 EGP (over ~80 EGP/day).');
  });
});
