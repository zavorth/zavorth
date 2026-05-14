import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  formatNaturalCapabilityDiscoverySnapshot,
  resolveCapabilityDiscoveryCliText,
} from '../../src/cli/ZavorthCliCapabilityDiscoveryRenderer.js';
import { NaturalCapabilityDiscoveryService } from '../../src/runtime/agent/index.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-discovery',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Natural Capability Discovery', () => {
  it('parses quoted natural language input', () => {
    expect(resolveCapabilityDiscoveryCliText('"corrija arquivo"')).toBe('corrija arquivo');
  });

  it('renders discovery JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'discover',
      normalized: 'discover',
      args: 'corrija arquivo e rode testes',
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
      contractVersion: '2026-05-03.wave-29',
      recommendedToolNames: expect.arrayContaining(['write_file', 'shell.exec']),
      safety: expect.objectContaining({
        noExecutionPerformed: true,
      }),
    }));
  });

  it('formats a compact human summary', () => {
    const snapshot = new NaturalCapabilityDiscoveryService({
      now: () => new Date('2026-05-03T20:20:00.000Z'),
    }).discover({
      text: 'melhore o Zavorth com selfmod',
      surface: 'cli',
      requestedTools: [],
    });

    const text = formatNaturalCapabilityDiscoverySnapshot(snapshot);

    expect(text).toContain('Natural Capability Discovery - Wave 29');
    expect(text).toContain('selfmod.preview');
    expect(text).toContain('Command Center: /control?sector=skills');
  });
});
