import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildAskBeforeAssumptionPolicyCliSnapshot,
  formatAskBeforeAssumptionPolicySnapshot,
  resolveAskBeforeAssumptionPolicyCliText,
} from '../../src/cli/ZavorthCliAskBeforeAssumptionPolicyRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-ask-policy',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Ask Before Assumption Policy', () => {
  it('parses assumption text after subcommands', () => {
    expect(resolveAskBeforeAssumptionPolicyCliText('ask-first "apague isso"')).toBe('apague isso');
  });

  it('renders ask-before-assumption JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'assumptions',
      normalized: 'assumptions',
      args: 'ask-first "apague isso"',
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
      contractVersion: '2026-05-03.wave-42',
      source: 'AskBeforeAssumptionPolicyService',
      status: 'blocked',
      summary: expect.objectContaining({
        questionCount: expect.any(Number),
        blockerCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth assumptions');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildAskBeforeAssumptionPolicyCliSnapshot({
      text: 'publique isso do jeito certo',
      userId: 'grey',
      sessionId: 'session-cli-ask-policy-human',
    });

    const text = formatAskBeforeAssumptionPolicySnapshot(snapshot);

    expect(text).toContain('Ask Before Assumption Policy - Wave 42');
    expect(text).toContain('Perguntas');
    expect(text).toContain('nenhuma assuncao foi executada');
    expect(text).toContain('Command Center: /control?sector=config');
  });
});
