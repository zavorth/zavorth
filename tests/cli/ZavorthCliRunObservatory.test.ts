import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  formatRunObservatorySnapshot,
  resolveRunObservatoryCliQuery,
} from '../../src/cli/ZavorthCliRunObservatoryRenderer.js';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cli-observatory-${++index}`;
}

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-observatory',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Run Observatory', () => {
  it('parses run observatory filters for run, trace, session, status and limit', () => {
    expect(resolveRunObservatoryCliQuery('trace trace-1 status failed limit 3')).toEqual({
      traceId: 'trace-1',
      status: 'failed',
      limit: 3,
    });
    expect(resolveRunObservatoryCliQuery('--run=run-1 --session=session-1 --status=completed')).toEqual({
      runId: 'run-1',
      sessionId: 'session-1',
      status: 'completed',
    });
  });

  it('renders the gateway run observatory through the ops registry command', async () => {
    const writes: string[] = [];
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T19:10:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ request }) => ({
        status: request.text.includes('falhe') ? 'failed' : 'completed',
        summary: request.text.includes('falhe') ? 'Falha registrada.' : 'Run concluida.',
        replyText: 'ok',
      }),
    });

    await gateway.handle({
      requestId: 'request-cli-observatory-a',
      traceId: 'trace-cli-observatory-a',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cli-observatory',
      text: 'falhe para a cli observar',
      requestedTools: [],
    });

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {
        agentGateway: gateway,
      } as any,
      effectiveFlags: createFlags(true),
      commandName: 'observatory',
      normalized: 'observatory',
      args: 'status failed',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.run-observatory',
      matchedRuns: 1,
      health: expect.objectContaining({
        status: 'degraded',
      }),
      replay: expect.objectContaining({
        available: true,
      }),
    }));
  });

  it('formats a compact human summary with receipts and replay', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T19:12:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'Run humana pronta.',
        replyText: 'ok',
        events: [
          {
            kind: 'artifact',
            title: 'Diff preview pronto',
            detail: 'Rascunho aguardando aprovacao visual.',
            status: 'done',
            metadata: {
              planId: 'plan-cli-diff-preview',
              status: 'waiting_approval',
              approvalRequired: true,
              diffReceiptText: 'Previa de alteracao\nResumo: 1 arquivo, 1 hunk.',
              diffReceipt: {
                summary: '1 arquivo, 1 hunk.',
                files: [
                  {
                    path: 'notes/cli.txt',
                    operation: 'write',
                    status: 'passed',
                    hunkCount: 1,
                  },
                ],
              },
            },
          },
        ],
      }),
    });

    await gateway.handle({
      requestId: 'request-cli-observatory-human',
      traceId: 'trace-cli-observatory-human',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cli-observatory-human',
      text: 'resuma observabilidade',
      requestedTools: [],
    });

    const text = formatRunObservatorySnapshot(gateway.queryRuns());

    expect(text).toContain('Run Observatory - Run Observatory');
    expect(text).toContain('Receipts:');
    expect(text).toContain('Previas de alteracao:');
    expect(text).toContain('aplicar rascunho plan-cli-diff-preview');
    expect(text).toContain('Replay: disponivel');
    expect(text).toContain('Dashboard: /dashboard');
  });
});
