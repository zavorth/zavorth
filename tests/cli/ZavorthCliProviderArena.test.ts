import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildProviderArenaCliSnapshot,
  formatProviderArenaSnapshot,
  resolveProviderArenaCliText,
} from '../../src/cli/ZavorthCliProviderArenaRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-provider-arena',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Provider Arena', () => {
  it('parses arena text after subcommands', () => {
    expect(resolveProviderArenaCliText('compare "provider para coding"')).toBe('provider para coding');
  });

  it('renders provider arena JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'arena',
      normalized: 'arena',
      args: 'compare "provider para coding"',
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
      contractVersion: '2026-05-03.provider-arena',
      summary: expect.objectContaining({
        hasProviderEvidence: true,
        decisionSource: 'learned',
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        doesNotOverrideModelPicker: true,
      }),
    }));
    expect(payload.candidates.length).toBeGreaterThan(1);
    expect(payload.surface.cliCommand).toContain('zavorth arena');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildProviderArenaCliSnapshot({
      text: 'provider para coding',
      userId: 'grey',
      sessionId: 'session-cli-provider-arena-human',
    });

    const text = formatProviderArenaSnapshot(snapshot);

    expect(text).toContain('Provider Arena - Provider Arena');
    expect(text).toContain('Candidatos');
    expect(text).toMatch(/arena read-only|read-only arena/i);
    expect(text).toMatch(/Dashboard: \/dashboard\?sector=config|ZavorthControl: \/zavorthControl\?sector=config/i);
  });
});
