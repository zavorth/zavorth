import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildBlueprintCompletionCliSnapshot,
  formatBlueprintCompletionSnapshot,
  resolveBlueprintCompletionCliText,
} from '../../src/cli/ZavorthCliBlueprintCompletionRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-blueprint',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Blueprint Completion final gate', () => {
  it('parses blueprint completion text after aliases', () => {
    expect(resolveBlueprintCompletionCliText('blueprint-completion "fechar tudo"')).toBe('fechar tudo');
    expect(resolveBlueprintCompletionCliText('final-gate latest')).toBe('');
  });

  it('renders blueprint completion JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'blueprint-completion',
      normalized: 'blueprint-completion',
      args: 'blueprint-completion "fechar blueprint"',
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
      contractVersion: '2026-05-04.blueprint-complete',
      source: 'BlueprintCompletionGateService',
      status: 'blueprint-complete',
      summary: expect.objectContaining({
        completedGateCount: 5,
        blueprintComplete: true,
      }),
      policy: expect.objectContaining({
        noUngovernedDeploy: true,
        manualPromotionRequired: true,
        noAutoExecute: true,
        noSkipCanary: true,
        noSkipApproval: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth blueprint-completion');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildBlueprintCompletionCliSnapshot({
      text: 'fechar blueprint',
      userId: 'grey',
      sessionId: 'session-cli-blueprint-human',
    });

    const text = formatBlueprintCompletionSnapshot(snapshot);

    expect(text).toContain('Blueprint Completion Gate - Final');
    expect(text).toContain('sem deploy nao governado');
    expect(text).toContain('promocao manual obrigatoria');
    expect(text).toContain('sem auto-execute');
    expect(text).toContain('Final gate: npm run qa:blueprint-completion');
  });
});
