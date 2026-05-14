import {
  AgentRunService,
  SKILL_MCP_QUARANTINE_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-skill-mcp-quarantine-${++index}`;
}

describe('AgentRunService Skill/MCP Quarantine Wave 33', () => {
  it('attaches skillMcpQuarantine and blocks quarantined imported tools', () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T23:42:00.000Z'),
      idFactory: createIdFactory(),
    });

    const run = service.createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-quarantine',
      text: 'use a skill importada',
      requestedTools: ['unsafe_imported_tool'],
      metadata: {
        coldContext: {
          skillContext: {
            source: 'SkillScanner',
            directory: 'skills/imported-draft',
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
            ],
          },
        },
      },
    });

    const snapshot = run.metadata.skillMcpQuarantine as any;
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: SKILL_MCP_QUARANTINE_CONTRACT_VERSION,
      summary: expect.objectContaining({
        total: 1,
        quarantined: 1,
        blockedToolCount: 1,
      }),
      policy: expect.objectContaining({
        externalImportsNeverTrustedAutomatically: true,
        quarantinedToolsHidden: true,
        naturalLanguageDoesNotBypassQuarantine: true,
      }),
    }));
    expect(run.toolExposure.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'unsafe_imported_tool',
        reason: 'blocked-by-imported-capability-trust',
      }),
    ]));
    expect(snapshot.entries[0].actions.promoteCommand).toBe('zavorth quarantine promote skill:imported-draft --confirm');
  });
});
