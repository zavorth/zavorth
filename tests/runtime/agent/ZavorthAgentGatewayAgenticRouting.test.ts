import { config } from '../../../src/config';
import { ZavorthAgentGateway } from '../../../src/runtime/agent';

describe('ZavorthAgentGateway agentic routing', () => {
  const originalManagedEnabled = (config as any).geminiManagedAgentsEnabled;

  afterEach(() => {
    (config as any).geminiManagedAgentsEnabled = originalManagedEnabled;
  });

  it('opens a governed approval preview before remote managed-agent execution', async () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const gateway = new ZavorthAgentGateway({
      idFactory: (() => {
        let i = 0;
        return (prefix: string) => `${prefix}-${++i}`;
      })(),
    });

    const result = await gateway.handle({
      userId: 'operator',
      channel: 'web',
      text: 'Rode esse pacote suspeito em sandbox sem tocar no meu PC.',
      sessionId: 'main',
    });

    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.approvals).toHaveLength(1);
    expect(result.run.metadata.agenticRoute).toMatchObject({
      selectedRoute: 'remote-agent-preview',
      approvalId: result.run.approvals[0].id,
    });
    expect(result.run.events.some((event) => event.metadata?.noRemoteCallPerformed === true)).toBe(true);
    expect(result.replies[0].text).toContain('need your approval first');
  });
});
