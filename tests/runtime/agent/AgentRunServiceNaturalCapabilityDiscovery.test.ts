import { AgentRunService, NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION } from '../../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-discovery-${++index}`;
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService Natural Capability Discovery', () => {
  it('stores discovery metadata and gates inferred dangerous tools behind approval', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T20:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-discovery-danger',
      text: 'corrija o arquivo e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.naturalCapabilityDiscovery).toEqual(
      expect.objectContaining({
        contractVersion: NATURAL_CAPABILITY_DISCOVERY_CONTRACT_VERSION,
        recommendedToolNames: expect.arrayContaining(['write_file', 'shell.exec']),
        safety: expect.objectContaining({
          noExecutionPerformed: true,
          naturalLanguageDoesNotBypassPolicy: true,
          requiresApproval: true,
        }),
      }),
    );
    expect(result.run.toolExposure.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'write_file', requiresApproval: true }),
        expect.objectContaining({ id: 'shell.exec', requiresApproval: true }),
      ]),
    );
    expect(result.run.approvals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          risk: 'danger',
        }),
      ]),
    );
  });

  it('uses discovery as a read-only hint for inspection requests', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Inspection completed.',
      replyText: 'ok',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T20:15:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-discovery-read',
      text: 'analise o repositorio e resuma os arquivos principais',
      requestedTools: ['read_file'],
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.naturalCapabilityDiscovery).toEqual(
      expect.objectContaining({
        intentCategory: 'workspace-inspection',
        recommendedToolNames: expect.arrayContaining(['read_file']),
      }),
    );
    expect(result.run.toolExposure.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'read_file', requiresApproval: false })]),
    );
  });
});
