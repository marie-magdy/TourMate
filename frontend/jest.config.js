module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  // Many tests render screens that fetch + animate. Cold module loads on a
  // busy machine can blow past the 5s default — give every test more headroom.
  testTimeout: 60000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  reporters: ['default', '<rootDir>/tests/timing-reporter.js'],
  // Don't try to execute the reporter itself as a test file.
  testPathIgnorePatterns: ['/node_modules/', '/tests/timing-reporter\\.js$'],
};