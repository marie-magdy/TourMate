export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['./jest.setup.js'],
  reporters: ['default', '<rootDir>/tests/timing-reporter.cjs'],
};