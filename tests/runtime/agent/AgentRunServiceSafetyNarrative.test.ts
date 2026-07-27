import { AgentRunService, SAFETY_NARRATIVE_CONTRACT_VERSION } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-safety-narrative-${++index}`;
}

describe('AgentRunService Safety Narrative Safety Narrative', () => {
  it('attaches safety narrative when dangerous tools wait for approval', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T22:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-safety-approval',
      text: 'corrija o file e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.safetyNarrative).toEqual(
      expect.objectContaining({
        contractVersion: SAFETY_NARRATIVE_CONTRACT_VERSION,
        status: 'waiting-approval',
        highRiskBlockPresent: true,
        reasons: expect.arrayContaining([
          expect.objectContaining({
            kind: 'approval-required',
            risk: 'danger',
          }),
        ]),
        policy: expect.objectContaining({
          naturalLanguageDoesNotBypassPolicy: true,
          alternativesDoNotExecute: true,
          approvalsRemainRequired: true,
        }),
      }),
    );
    // Product surface prefers EN with locale fallback; narrative may mix locale copy.
    expect(result.replies[0].text).toMatch(/Approval required:\s*true|Approval requerido:\s*true/i);
    expect(result.replies[0].text).toMatch(/Bloqueei por security|Blocked for safety|safety/i);
    expect(result.replies[0].text).toMatch(/Alternativas seguras|Safe alternatives|alternatives/i);
  });

  it('does not recalculate unchanged evidence snapshots after safety narrative', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const providerMeshConsolidation = {
      buildSnapshot: jest.fn(() => ({
        contractVersion: 'test',
        generatedAt: '2026-05-03T22:05:00.000Z',
        status: 'ready',
        summary: {},
        providers: [],
        decisions: [],
        nextSafeAction: 'ok',
      })),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T22:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      providerMeshConsolidation: providerMeshConsolidation as any,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-no-redundant-snapshots',
      text: 'corrija o file e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
    });

    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.safetyNarrative).toBeDefined();
    expect(result.run.metadata.providerMeshConsolidation).toBeUndefined();
    expect(providerMeshConsolidation.buildSnapshot).toHaveBeenCalledTimes(1);
  });

  it('keeps material evidence snapshots in metadata', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const providerMeshConsolidation = {
      buildSnapshot: jest.fn(() => ({
        contractVersion: 'test',
        generatedAt: '2026-05-03T22:05:00.000Z',
        status: 'ready',
        summary: {
          routeCount: 1,
          readyRouteCount: 1,
        },
        routes: [{ id: 'route:test' }],
        receipts: [],
        nextSafeAction: 'ok',
      })),
    };
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T22:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      providerMeshConsolidation: providerMeshConsolidation as any,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-material-snapshots',
      text: 'corrija o file e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
    });

    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.providerMeshConsolidation).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ routeCount: 1 }),
        routes: [{ id: 'route:test' }],
      }),
    );
    expect(providerMeshConsolidation.buildSnapshot).toHaveBeenCalledTimes(1);
  });

  it('explains Trust Slider workspace escape without leaking raw paths', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T22:10:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-safety-trust',
      text: 'edite fora do workspace',
      requestedTools: ['write_file'],
      metadata: {
        trustSlider: {
          level: 'collaborator',
          workspaceRoot: 'C:\\repo\\zavorth',
          targetPath: 'C:\\outside\\secret.txt',
        },
      },
    });

    const narrative = result.run.metadata.safetyNarrative as any;
    expect(result.run.status).toBe('failed');
    expect(narrative).toEqual(
      expect.objectContaining({
        contractVersion: SAFETY_NARRATIVE_CONTRACT_VERSION,
        status: 'blocked',
        redaction: expect.objectContaining({
          rawSecretSerialized: false,
        }),
      }),
    );
    expect(narrative.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'trust-slider',
        }),
      ]),
    );
    expect(result.replies[0].text).toContain('Bloqueei por security');
    expect(result.replies[0].text).not.toContain('C:\\outside');
  });
});
