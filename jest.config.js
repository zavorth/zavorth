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
    '/tests/providers/',
    '/tests/services/providers/catalog/',
    '/tests/tools/(?!(DatabaseQueryTool|EmailTool|MultiBackendTerminalTool|ExtendedToolRealExecution)\\.test\\.ts)',
  ],
  moduleNameMapper: {
    '/presentation/(TerminalSpinner|TerminalPanel|TerminalMarkdown|TerminalDiff|TerminalPrompt|TerminalTimeline)\\.js$': '<rootDir>/tests/cli/mocks/$1.mock.ts',
    '^.*src/ai-gateway/app/\\(dashboard\\)/dashboard/dashboard/.*\\.js$': '<rootDir>/tests/ai-gateway/dashboard/commandCenterLegacyFacade.ts',
    '^.*src/ai-gateway/app/\\(dashboard\\)/dashboard/dashboardPageClient\\.utils$': '<rootDir>/src/ai-gateway/app/(dashboard)/control/controlPageClient.utils.ts',
    '^react$': '<rootDir>/apps/zavorth-desktop/node_modules/react',
    '^react-dom$': '<rootDir>/apps/zavorth-desktop/node_modules/react-dom',
    '^(\\.{1,2}/.*)\\.js$': '$1', // Mapeamento para imports com extensao .js no TypeScript
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: false,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
};
