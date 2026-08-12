import { AgentRunService, UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-universal-preview-${++index}`;
}

describe('AgentRunService Universal Preview Mode', () => {
  it('short-circuits preview-only requests before approvals, proposals or executor calls', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T21:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-preview-only',
      text: 'simule corrigir o arquivo e rode testes sem executar',
      requestedTools: ['write_file', 'shell.exec'],
      metadata: {
        universalPreviewMode: {
          enabled: true,
        },
      },
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('completed');
    expect(result.run.approvals).toEqual([]);
    expect(result.run.metadata.universalPreviewMode).toEqual(
      expect.objectContaining({
        contractVersion: UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION,
        mode: 'preview-only',
        previewOnly: true,
        executorBlocked: true,
        safety: expect.objectContaining({
          noExecutionPerformed: true,
          executorBlockedInPreviewMode: true,
          toolsActuallyCalled: [],
        }),
        risk: expect.objectContaining({
          highestRisk: 'danger',
          requiresApproval: true,
        }),
      }),
    );
    expect(result.replies[0].text).toContain('Universal Preview Mode - Universal Preview');
    expect(result.replies[0].text).toContain('nenhuma ferramenta foi executada');
  });

  it('keeps ordinary dangerous requests on the approval path while storing runtime preview metadata', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T21:15:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-runtime-preview',
      text: 'corrija o arquivo e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.universalPreviewMode).toEqual(
      expect.objectContaining({
        contractVersion: UNIVERSAL_PREVIEW_MODE_CONTRACT_VERSION,
        mode: 'runtime-preview',
        safety: expect.objectContaining({
          noExecutionPerformed: true,
          executorBlockedInPreviewMode: false,
        }),
        risk: expect.objectContaining({
          requiresApproval: true,
        }),
      }),
    );
    expect(result.run.approvals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
        }),
      ]),
    );
  });
});
