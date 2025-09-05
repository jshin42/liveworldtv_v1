module.exports = {
  displayName: 'shared-types',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.{test,spec}.{ts,tsx}'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};