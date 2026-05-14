import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-quarantine-${++index}`;
}

describe('Command Center Skill/MCP Quarantine Wave 33', () => {
  it('projects skillMcpQuarantine metadata into the dashboard view model', () => {
    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-quarantine',
        status: 'completed',
        metadata: {
          skillMcpQuarantine: {
            contractVersion: '2026-05-03.wave-33',
            generatedAt: '2026-05-03T23:50:00.000Z',
            identifiers: {
              runId: 'run-quarantine',
              traceId: 'trace-quarantine',
              requestId: 'request-quarantine',
              sessionId: 'session-quarantine',
            },
            summary: {
              total: 1,
              trusted: 0,
              safe: 0,
              quarantined: 1,
              reviewRequired: 1,
              blockedToolCount: 1,
            },
            entries: [
              {
                id: 'imported-draft',
                kind: 'skill',
                trustState: 'quarantined',
                riskLevel: 'high',
                quarantined: true,
                requiresReview: true,
                canExposeToModel: false,
                canExposeTools: false,
                toolNames: ['unsafe_imported_tool'],
                reasons: ['capability-quarantined'],
                origin: {
                  source: 'SkillScanner',
                  ref: 'skills/imported-draft',
                },
                actions: {
                  inspectCommand: 'zavorth quarantine inspect skill:imported-draft',
                  reviewCommand: 'zavorth quarantine review skill:imported-draft',
                  promoteCommand: 'zavorth quarantine promote skill:imported-draft --confirm',
                  keepQuarantinedCommand: 'zavorth quarantine keep skill:imported-draft',
                },
              },
            ],
            receipts: [
              {
                id: 'quarantine:skill:imported-draft',
                kind: 'skill',
                detail: 'imported-draft esta quarantined.',
              },
            ],
            policy: {
              externalImportsNeverTrustedAutomatically: true,
              quarantinedToolsHidden: true,
              toolExposureGatedByImportedCapabilityTrust: true,
              noMarketplaceInstallPerformed: true,
              promotionsRequireExplicitOperatorAction: true,
              naturalLanguageDoesNotBypassQuarantine: true,
            },
            surface: {
              cliCommand: 'zavorth quarantine run run-quarantine --json',
              commandCenterPath: '/control?sector=skills',
              reviewHint: 'Revise origem e risco.',
            },
            nextSafeAction: 'Manter tools importadas em quarentena.',
          },
        },
      },
    });

    expect(viewModel.skillMcpQuarantine).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-33',
      summary: expect.objectContaining({
        quarantined: 1,
        blockedToolCount: 1,
      }),
      policy: expect.objectContaining({
        externalImportsNeverTrustedAutomatically: true,
        naturalLanguageDoesNotBypassQuarantine: true,
      }),
    }));
    expect(viewModel.skillMcpQuarantine?.entries[0]).toEqual(expect.objectContaining({
      trustState: 'quarantined',
      origin: expect.objectContaining({
        source: 'SkillScanner',
      }),
    }));
  });

  it('maps gateway snapshots with quarantine into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T23:55:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cc-quarantine',
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
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.skillMcpQuarantine).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-33',
      summary: expect.objectContaining({
        quarantined: 1,
      }),
      policy: expect.objectContaining({
        toolExposureGatedByImportedCapabilityTrust: true,
      }),
    }));
    expect(projection.skillMcpQuarantine?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'imported-draft',
        kind: 'skill',
      }),
    ]));
  });
});
