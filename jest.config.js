/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  setupFiles: ['<rootDir>/src/__tests__/setEnv.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 15000,
  forceExit: true,
};
