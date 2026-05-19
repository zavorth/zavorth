import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildToolRehearsalCliSnapshot,
  formatToolRehearsalSnapshot,
  resolveToolRehearsalCliText,
} from '../../src/cli/ZavorthCliToolRehearsalRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-tool-rehearsal',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Tool Rehearsal', () => {
  it('parses rehearsal text after subcommands', () => {
    expect(resolveToolRehearsalCliText('calls "editar e testar"')).toBe('editar e testar');
  });

  it('renders rehearsal JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'rehearse',
      normalized: 'rehearse',
      args: 'calls "editar e testar"',
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
      contractVersion: '2026-05-03.tool-rehearsal',
      status: 'proposal',
      summary: expect.objectContaining({
        callCount: 3,
        scopeApproved: true,
      }),
      policy: expect.objectContaining({
        noToolExecuted: true,
        noShellSpawned: true,
        realExecutionLimitedToRehearsedScope: true,
      }),
    }));
    expect(payload.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolId: 'shell.exec',
      }),
    ]));
    expect(payload.surface.cliCommand).toContain('zavorth rehearse');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildToolRehearsalCliSnapshot({
      text: 'editar e testar',
      userId: 'grey',
      sessionId: 'session-cli-tool-rehearsal-human',
    });

    const text = formatToolRehearsalSnapshot(snapshot);

    expect(text).toContain('Tool Rehearsal - Tool Rehearsal');
    expect(text).toContain('Calls');
    expect(text).toContain('rehearsal nao executa tools');
    expect(text).toContain('Command Center: /control?sector=skills');
  });
});
