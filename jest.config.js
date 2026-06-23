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
    '/tests/providers/(?!ProviderCatalog)',
    '/tests/services/providers/catalog/',
    // Retired HubNativeShell architecture; its replacement is covered by the current desktop shell tests.
    '/tests/apps/zavorth-desktop/(DesktopProductReadyCockpit|DesktopHermesInspiredShellArchitecture|DesktopChatReferenceAndContextualPreview|DesktopNewChatAndConversationSurface)\\.test\\.ts$',
    // Allowlist pattern: only run tests for tools/services listed below. All other tool tests are excluded.
    // To add a new tool test, append its name to this list.
    '/tests/tools/(?!(DatabaseQueryTool|EmailTool|MultiBackendTerminalTool|ExtendedToolRealExecution|ZavorthCronSchedulerTool|ZavorthDelegateTool|ZavorthComputerUseTool|ZavorthVoiceModeTool|ZavorthSessionSearchTool|ZavorthChannelSendTool|ZavorthDocumentExtractorTool|ZavorthTtsTool|ZavorthSttTool|ZavorthReceiptSearchTool|ZavorthPolicyEnforcerTool|ZavorthApiClientTool|ZavorthTrajectoryExportTool|ZavorthDockerComposeTool|ZavorthCodeIntelligenceTool|ZavorthChartGeneratorTool|ZavorthFileWatcherTool|ZavorthNetworkTool|ZavorthWebhookReceiverTool|MemoryLanceDBService|MemoryHonchoService|DiagnosticsOtelService|AchievementsService|SkinEngineService|TrajectoryResearchService|ActiveMemoryService|DiagnosticsPrometheusService|KanbanDispatcherService|KanbanSQLiteDispatcherService|HighPriorityPlugins|MediumPriorityPlugins|LowPriorityPlugins|ToolsDeepCoverage|PluginsDeepCoverage|LLMServices|Phase2Tools|ExistingTools|SkillLibraryValidation|InnovativeTools|MediumPriorityTools|LowPriorityTools|AllToolsDeep|ErrorHandling|GapClosingTools|TerminalBackends|LLMServicesAdvanced|AutoSkillGeneratorService|StreamingLLMService|MultimodalServices|AnalyticsInsights|CollaborationTeams|ResilienceReliability|PluginMarketplace)\\.test\\.ts)',
  ],
  moduleNameMapper: {
    '^@zavorth/(.*)\\.js$': '<rootDir>/src/$1',
    '^@zavorth/(.*)$': '<rootDir>/src/$1',
    '/presentation/(TerminalSpinner|TerminalPanel|TerminalMarkdown|TerminalDiff|TerminalPrompt|TerminalTimeline)\\.js$': '<rootDir>/tests/cli/mocks/$1.mock.ts',
    '^.*src/zavorth-control/app/\\(dashboard\\)/dashboard/dashboard/.*\\.js$': '<rootDir>/tests/zavorth-control/dashboard/commandCenterLegacyFacade.ts',
    '^.*src/zavorth-control/app/\\(dashboard\\)/dashboard/dashboardPageClient\\.utils$': '<rootDir>/src/zavorth-control/app/(dashboard)/control/controlPageClient.utils.ts',
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
