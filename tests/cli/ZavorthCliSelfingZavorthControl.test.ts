import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildSelfingZavorthControlCliSnapshot,
  formatSelfingZavorthControlSnapshot,
  resolveSelfingZavorthControlCliText,
} from '../../src/cli/ZavorthCliSelfingZavorthControlRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-selfing-zavorthControl',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Selfing ZavorthControl', () => {
  it('parses selfing text after subcommands', () => {
    expect(resolveSelfingZavorthControlCliText('review "identity and memory"')).toBe('identity and memory');
  });

  it('renders selfing JSON through the registry command', async () => {
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
      contractVersion: '2026-05-03.selfing-zavorthControl',
      source: 'SelfingZavorthControlService',
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
    const snapshot = buildSelfingZavorthControlCliSnapshot({
      text: 'identity and memory',
      userId: 'grey',
      sessionId: 'session-cli-selfing-zavorthControl-human',
    });

    const text = formatSelfingZavorthControlSnapshot(snapshot);

    expect(text).toContain('Selfing ZavorthControl - Selfing ZavorthControl');
    expect(text).toContain('Cards');
    expect(text).toContain('snapshot read-only');
    expect(text).toContain('ZavorthControl: /control-sector=dreams');
  });
});
