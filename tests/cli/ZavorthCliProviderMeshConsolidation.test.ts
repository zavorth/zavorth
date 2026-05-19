import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildProviderMeshConsolidationCliSnapshot,
  formatProviderMeshConsolidationSnapshot,
  resolveProviderMeshConsolidationCliText,
} from '../../src/cli/ZavorthCliProviderMeshConsolidationRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-provider-mesh',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Provider Mesh Consolidation', () => {
  it('parses provider-mesh text after subcommands', () => {
    expect(resolveProviderMeshConsolidationCliText('model-picker "coding"')).toBe('coding');
  });

  it('renders provider mesh JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'provider-mesh',
      normalized: 'provider-mesh',
      args: 'model-picker "coding"',
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
      contractVersion: '2026-05-04.provider-mesh',
      source: 'ProviderMeshConsolidationService',
      summary: expect.objectContaining({
        routeCount: expect.any(Number),
        modelCount: expect.any(Number),
      }),
      p0ExtraCoverage: expect.objectContaining({
        modelPicker: true,
        modelSelection: true,
        providerFactory: true,
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth provider-mesh');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildProviderMeshConsolidationCliSnapshot({
      text: 'melhor modelo para coding',
      userId: 'grey',
      sessionId: 'session-cli-provider-mesh-human',
    });

    const text = formatProviderMeshConsolidationSnapshot(snapshot);

    expect(text).toContain('Provider Mesh / Model Picker Consolidation - Channel mesh3');
    expect(text).toContain('P0-extra');
    expect(text).toContain('nenhum provider foi executado');
    expect(text).toContain('Command Center: /control?sector=config');
  });
});
