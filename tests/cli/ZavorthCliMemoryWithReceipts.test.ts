import { handleZavorthCliRegistrySessionsCommand } from '../../src/cli/ZavorthCliRegistrySessions.js';
import {
  buildMemoryWithReceiptsCliSnapshot,
  formatMemoryWithReceiptsSnapshot,
  resolveMemoryWithReceiptsCliText,
} from '../../src/cli/ZavorthCliMemoryWithReceiptsRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-memory-receipts',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Memory With Receipts', () => {
  it('parses memory receipt text after the subcommand', () => {
    expect(resolveMemoryWithReceiptsCliText('receipts "de onde veio isso-"')).toBe('de onde veio isso-');
  });

  it('renders memory receipts JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistrySessionsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'memory',
      args: 'receipts "lembre tone preference"',
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
      contractVersion: '2026-05-03.memory-receipts',
      audit: expect.objectContaining({
        allMemoryHasReceipt: true,
        canForgetOrCorrect: true,
      }),
    }));
    expect(payload.receipts[0]).toEqual(expect.objectContaining({
      memoryId: 'cli-memory-signal',
      actions: expect.objectContaining({
        askSourceCommand: 'zavorth memory source cli-memory-signal',
      }),
    }));
  });

  it('formats a compact human summary', () => {
    const snapshot = buildMemoryWithReceiptsCliSnapshot({
      text: 'tone preference',
      userId: 'grey',
      sessionId: 'session-cli-memory-human',
    });

    const text = formatMemoryWithReceiptsSnapshot(snapshot);

    expect(text).toContain('Memory With Receipts - Memory Receipts');
    expect(text).toContain('Receipts');
    expect(text).toContain('forget: zavorth memory forget');
    expect(text).toContain('ZavorthControl: /zavorthControl...sector=dreams');
  });
});
