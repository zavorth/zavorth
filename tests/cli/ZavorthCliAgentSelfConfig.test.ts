import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildSelfConfigCliSnapshot,
  formatSelfConfigSnapshot,
  resolveSelfConfigCliText,
} from '../../src/cli/ZavorthCliSelfConfigRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-agent-self-config',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Agent Self Config', () => {
  it('parses self config text after subcommands', () => {
    expect(resolveSelfConfigCliText('review "identity and memory"')).toBe('identity and memory');
  });

  it('renders self config JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'selfing',
      normalized: 'selfing',
      args: 'review "identity and memory"',
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
      contractVersion: '2026-05-03.agent-self-config',
      source: 'AgentSelfConfigService',
      summary: expect.objectContaining({
        identityFileCount: 3,
        memoryReceiptCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        readOnlySnapshot: true,
        noIdentityChanged: true,
        changesRequirePreview: true,
        changesAreVersioned: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth selfing');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildSelfConfigCliSnapshot({
      text: 'identity and memory',
      userId: 'grey',
      sessionId: 'session-cli-agent-self-config-human',
    });

    const text = formatSelfConfigSnapshot(snapshot);

    expect(text).toContain('Agent Self-Configuration');
    expect(text).toContain('Cards');
    expect(text).toContain('snapshot read-only');
    expect(text).toContain('Control: /control?sector=identity');
  });
});
