module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  workerIdleMemoryLimit: '512MB',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/data/vendor-worktrees/',
    '/third_party/',
    // Retired HubNativeShell architecture; its replacement is covered by the current desktop shell tests.
    '/tests/apps/zavorth-desktop/(DesktopProductReadyCockpit|DesktopHermesInspiredShellArchitecture|DesktopChatReferenceAndContextualPreview|DesktopNewChatAndConversationSurface)\\.test\\.ts$',
  ],
  moduleNameMapper: {
    '^@zavorth/(.*)\\.js$': '<rootDir>/src/$1',
    '^@zavorth/(.*)$': '<rootDir>/src/$1',
    '/presentation/(TerminalSpinner|TerminalPanel|TerminalMarkdown|TerminalDiff|TerminalPrompt|TerminalTimeline)\\.js$': '<rootDir>/tests/cli/mocks/$1.mock.ts',
    // Telegram moved under gateways/channels; keep legacy test/src import paths working.
    '^.*src/telegram/(.*)\\.js$': '<rootDir>/src/gateways/channels/telegram/$1',
    '^.*src/telegram/(.*)$': '<rootDir>/src/gateways/channels/telegram/$1',
    // Channel adapters moved under gateways/channels/<channel>/
    '^.*src/channels/adapters/SlackChannelAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/slack/SlackChannelAdapter',
    '^.*src/channels/adapters/WhatsAppChannelAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/whatsapp/WhatsAppChannelAdapter',
    '^.*src/channels/adapters/SignalChannelAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/signal/SignalChannelAdapter',
    '^.*src/channels/adapters/IMessageMacBridgeAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/imessage/IMessageMacBridgeAdapter',
    '^.*src/channels/adapters/TeamsChannelAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/teams/TeamsChannelAdapter',
    '^.*src/channels/adapters/EmailChannelAdapter(\\.js)?$': '<rootDir>/src/gateways/channels/email/EmailChannelAdapter',
    '^.*src/zavorth-control/app/\\(dashboard\\)/dashboard/dashboard/.*\\.js$': '<rootDir>/tests/zavorth-control/dashboard/commandCenterLegacyFacade.ts',
    '^.*src/zavorth-control/app/\\(dashboard\\)/dashboard/dashboardPageClient\\.utils$': '<rootDir>/src/zavorth-control/app/(dashboard)/control/controlPageClient.utils.ts',
    '^.*src/zavorth-control/app/\\(zavorthControl\\)/control/zavorth-control/.*\\.js$': '<rootDir>/src/ai-gateway/app/(zavorthControl)/control/zavorth-control/',
    '^.*src/zavorth-control/app/\\(zavorthControl\\)/control/.*\\.js$': '<rootDir>/src/ai-gateway/app/(zavorthControl)/control/',
    '^.*src/zavorth-control/(.*)\\.js$': '<rootDir>/src/ai-gateway/$1',
    // Prefer desktop-local deps when present; fall back to monorepo root for CI.
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/client$': '<rootDir>/node_modules/react-dom/client',
    '^electron$': '<rootDir>/node_modules/electron',
    // Legacy absolute relative imports used by older desktop tests
    '^.*/apps/zavorth-desktop/node_modules/react$': '<rootDir>/node_modules/react',
    '^.*/apps/zavorth-desktop/node_modules/react-dom$': '<rootDir>/node_modules/react-dom',
    '^.*/apps/zavorth-desktop/node_modules/react-dom/client$': '<rootDir>/node_modules/react-dom/client',
    '^.*/apps/zavorth-desktop/node_modules/electron$': '<rootDir>/node_modules/electron',
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
  // Cobertura de código unificada (Fase 4: Unified Code Coverage)
  coverageDirectory: 'coverage/jest',
  coverageReporters: ['json', 'lcov', 'text', 'text-summary'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/zavorth-control/**',
    '!src/**/*.spec.ts',
  ],
};
