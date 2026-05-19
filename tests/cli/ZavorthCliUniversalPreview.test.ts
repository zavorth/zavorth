import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildUniversalPreviewCliSnapshot,
  formatUniversalPreviewModeSnapshot,
  resolveUniversalPreviewCliText,
} from '../../src/cli/ZavorthCliUniversalPreviewRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-preview',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Universal Preview Mode', () => {
  it('parses quoted preview input', () => {
    expect(resolveUniversalPreviewCliText('"simule corrigir arquivo"')).toBe('simule corrigir arquivo');
  });

  it('renders preview JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'preview',
      normalized: 'preview',
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
      contractVersion: '2026-05-03.universal-preview',
      mode: 'preview-only',
      safety: expect.objectContaining({
        noExecutionPerformed: true,
        toolsActuallyCalled: [],
      }),
    }));
    expect(payload.risk.approvalRequiredToolIds).toEqual(expect.arrayContaining(['write_file', 'shell.exec']));
  });

  it('formats a compact human summary', () => {
    const snapshot = buildUniversalPreviewCliSnapshot({
      text: 'simule aplicar selfmod',
      userId: 'grey',
      sessionId: 'session-cli-preview-human',
    });

    const text = formatUniversalPreviewModeSnapshot(snapshot);

    expect(text).toContain('Universal Preview Mode - Universal Preview');
    expect(text).toContain('chamadas reais: 0');
    expect(text).toContain('Command Center: /control?sector=overview');
  });
});
