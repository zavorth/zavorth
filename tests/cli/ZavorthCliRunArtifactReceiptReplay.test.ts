import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildRunArtifactReceiptReplayCliSnapshot,
  formatRunArtifactReceiptReplaySnapshot,
  resolveRunArtifactReceiptReplayCliText,
} from '../../src/cli/ZavorthCliRunArtifactReceiptReplayRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-replay-hardening',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI run/artifact/receipt replay hardening', () => {
  it('parses replay text after aliases', () => {
    expect(resolveRunArtifactReceiptReplayCliText('replay "auditar run"')).toBe('auditar run');
    expect(resolveRunArtifactReceiptReplayCliText('receipt-replay latest')).toBe('');
  });

  it('renders replay hardening JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'replay',
      normalized: 'replay',
      args: 'replay "auditar artifacts"',
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
      contractVersion: '2026-05-04.receipt-replay',
      source: 'RunArtifactReceiptReplayService',
      summary: expect.objectContaining({
        frameCount: expect.any(Number),
        artifactLinkCount: 1,
        replayable: true,
      }),
      policy: expect.objectContaining({
        replayUsesReceiptsOnly: true,
        noFilesystemReadPerformed: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth replay');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildRunArtifactReceiptReplayCliSnapshot({
      text: 'auditar artifact',
      userId: 'grey',
      sessionId: 'session-cli-replay-hardening-human',
    });

    const text = formatRunArtifactReceiptReplaySnapshot(snapshot);

    expect(text).toContain('Run / Artifact / Receipt Replay Hardening - Channel mesh5');
    expect(text).toContain('replay nao executa tools');
    expect(text).toContain('conteudo de artifact nao foi inventado');
    expect(text).toContain('Command Center: /control?runId=');
  });
});
