module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
  moduleNameMapper: {
    'react-native-get-random-values': '<rootDir>/__mocks__/rn-get-random-values-mock.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage-mock.js',
    '\\.png$': '<rootDir>/__mocks__/file-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/__mocks__/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native-get-random-values)/)',
  ],
};
