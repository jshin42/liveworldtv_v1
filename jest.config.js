module.exports = {
  projects: [
    '<rootDir>/apps/web/jest.config.js',
    '<rootDir>/apps/api/jest.config.js',
    '<rootDir>/apps/extension/jest.config.js',
    '<rootDir>/packages/*/jest.config.js',
  ],
  collectCoverageFrom: [
    'apps/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.config.{js,ts}',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};