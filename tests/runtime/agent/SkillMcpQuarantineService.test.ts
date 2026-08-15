import {
  SKILL_MCP_QUARANTINE_CONTRACT_VERSION,
  SkillMcpQuarantineService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-quarantine-1',
    traceId: 'trace-quarantine-1',
    requestId: 'request-quarantine-1',
    sessionId: 'session-quarantine-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Quarantine run',
    input: 'use skill importada',
    status: 'completed',
    createdAt: '2026-05-03T23:40:00.000Z',
    updatedAt: '2026-05-03T23:40:00.000Z',
    summary: 'Quarentena auditada.',
    events: [],
    toolExposure: {
      mode: 'restricted',
      summary: 'tools importadas bloqueadas',
      tools: [],
      blockedTools: [
        {
          id: 'unsafe_imported_tool',
          label: 'Unsafe imported tool',
          reason: 'blocked-by-imported-capability-trust',
        },
      ],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'provider',
      modelLabel: 'model',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      importedCapabilityTrust: {
        source: 'ColdContextResolver',
        riskReports: [
          {
            kind: 'skill',
            id: 'imported-draft',
            toolNames: ['unsafe_imported_tool'],
            trustState: 'quarantined',
            riskLevel: 'high',
            quarantined: true,
            requiresReview: true,
            canExposeToModel: false,
            canExposeTools: false,
            reasons: ['capability-quarantined'],
          },
          {
            kind: 'mcp',
            id: 'filesystem',
            toolNames: ['read_file'],
            trustState: 'safe',
            riskLevel: 'medium',
            quarantined: false,
            requiresReview: false,
            canExposeToModel: true,
            canExposeTools: true,
            reasons: ['capability-safe'],
          },
        ],
        toolExposureGatedByImportedCapabilityTrust: true,
      },
      coldContext: {
        skillContext: {
          source: 'SkillScanner',
          directory: 'skills/imported-draft',
        },
        mcpContext: {
          source: 'McpRuntimeService.readSnapshot',
          manifestPath: 'config/mcp-servers.json',
        },
      },
    },
    ...overrides,
  };
}

describe('SkillMcpQuarantineService Skill MCP Quarantine', () => {
  it('builds product quarantine snapshot with origin, trust and promotion actions', () => {
    const snapshot = new SkillMcpQuarantineService({
      now: () => new Date('2026-05-03T23:41:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: SKILL_MCP_QUARANTINE_CONTRACT_VERSION,
      source: 'SkillMcpQuarantineService',
      summary: expect.objectContaining({
        total: 2,
        safe: 1,
        quarantined: 1,
        reviewRequired: 1,
        blockedToolCount: 1,
      }),
      policy: expect.objectContaining({
        externalImportsNeverTrustedAutomatically: true,
        quarantinedToolsHidden: true,
        toolExposureGatedByImportedCapabilityTrust: true,
        noMarketplaceInstallPerformed: true,
        naturalLanguageDoesNotBypassQuarantine: true,
      }),
    }));
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'imported-draft',
        kind: 'skill',
        trustState: 'quarantined',
        riskLevel: 'high',
        origin: expect.objectContaining({
          source: 'SkillScanner',
          ref: 'skills/imported-draft',
        }),
        actions: expect.objectContaining({
          promoteCommand: 'zavorth quarantine promote skill:imported-draft --confirm',
          keepQuarantinedCommand: 'zavorth quarantine keep skill:imported-draft',
        }),
      }),
    ]));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'quarantine:policy',
      }),
    ]));
  });

  it('returns an honest empty product snapshot when no imported capability exists', () => {
    const snapshot = new SkillMcpQuarantineService().buildSnapshot({
      run: createRun({
        toolExposure: {
          mode: 'read_only',
          summary: 'sem imports',
          tools: [],
        },
        metadata: {},
      }),
    });

    expect(snapshot.summary.total).toBe(0);
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.nextSafeAction).toContain('No imported skill/MCP');
    expect(snapshot.policy.noMarketplaceInstallPerformed).toBe(true);
  });
});
