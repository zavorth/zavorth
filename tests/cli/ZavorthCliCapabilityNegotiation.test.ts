import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildCapabilityNegotiationCliSnapshot,
  formatCapabilityNegotiationSnapshot,
  resolveCapabilityNegotiationCliText,
} from '../../src/cli/ZavorthCliCapabilityNegotiationRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-capability-negotiation',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Capability Negotiation', () => {
  it('parses negotiated task text after subcommands', () => {
    expect(resolveCapabilityNegotiationCliText('scope "corrigir e testar"')).toBe('corrigir e testar');
  });

  it('renders negotiation JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'negotiate',
      normalized: 'negotiate',
      args: 'scope "corrigir e testar"',
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
      contractVersion: '2026-05-03.capability-negotiation',
      status: 'proposal',
      summary: expect.objectContaining({
        approvalRequired: true,
        sensitiveTask: true,
      }),
      policy: expect.objectContaining({
        noExecutionPerformed: true,
        approvedScopeLimitsTools: true,
      }),
    }));
    expect(payload.scope.allowedToolIds).toEqual(expect.arrayContaining(['write_file', 'shell.exec']));
    expect(payload.surface.cliCommand).toContain('zavorth negotiate');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildCapabilityNegotiationCliSnapshot({
      text: 'corrigir e testar',
      userId: 'grey',
      sessionId: 'session-cli-capability-negotiation-human',
    });

    const text = formatCapabilityNegotiationSnapshot(snapshot);

    expect(text).toContain('Capability Negotiation - Capability Negotiation');
    expect(text).toContain('Escopo');
    expect(text).toContain('negotiation nao executa tools');
    expect(text).toContain('Dashboard: /dashboard?sector=skills');
  });
});
