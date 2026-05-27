export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['./jest.setup.js'],
  reporters: ['default', '<rootDir>/tests/timing-reporter.cjs'],
  // benchmark.test.js is a perf script — opt-in only via --testPathPattern.
  testPathIgnorePatterns: ['/node_modules/', '/tests/benchmark\\.test\\.js$'],
};