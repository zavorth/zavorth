import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildSelfingDashboardCliSnapshot,
  formatSelfingDashboardSnapshot,
  resolveSelfingDashboardCliText,
} from '../../src/cli/ZavorthCliSelfingDashboardRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-selfing-dashboard',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Selfing Dashboard', () => {
  it('parses selfing text after subcommands', () => {
    expect(resolveSelfingDashboardCliText('review "identidade e memoria"')).toBe('identidade e memoria');
  });

  it('renders selfing JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'selfing',
      normalized: 'selfing',
      args: 'review "identidade e memoria"',
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
      contractVersion: '2026-05-03.selfing-dashboard',
      source: 'SelfingDashboardService',
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
    const snapshot = buildSelfingDashboardCliSnapshot({
      text: 'identidade e memoria',
      userId: 'grey',
      sessionId: 'session-cli-selfing-dashboard-human',
    });

    const text = formatSelfingDashboardSnapshot(snapshot);

    expect(text).toContain('Selfing Dashboard - Selfing Dashboard');
    expect(text).toContain('Cards');
    expect(text).toContain('snapshot read-only');
    expect(text).toContain('Dashboard: /dashboard?sector=dreams');
  });
});
