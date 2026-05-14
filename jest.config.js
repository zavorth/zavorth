module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/data/vendor-worktrees/',
    '/third_party/',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1', // Mapeamento para imports com extensao .js no TypeScript
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: false,
      },
    ],
  },
};
