module.exports = {
  displayName: 'web',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [],
  testMatch: ['<rootDir>/src/**/*.{test,spec}.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@liveworldtv/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@liveworldtv/ai-models$': '<rootDir>/../../packages/ai-models/src',
    '^@liveworldtv/telemetry$': '<rootDir>/../../packages/telemetry/src',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
  ],
};