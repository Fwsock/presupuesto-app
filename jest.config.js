module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    'react-native-get-random-values': '<rootDir>/__mocks__/rn-get-random-values-mock.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/__mocks__/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native-get-random-values)/)',
  ],
};
