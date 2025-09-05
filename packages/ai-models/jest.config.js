module.exports = {
  displayName: 'ai-models',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.{test,spec}.{ts,tsx}'],
  moduleNameMapping: {
    '^@liveworldtv/shared-types$': '<rootDir>/../shared-types/src',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};