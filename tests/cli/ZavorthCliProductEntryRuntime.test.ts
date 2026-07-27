import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildProductEntryRuntimeCliSnapshot,
  formatProductEntryRuntimeSnapshot,
  resolveProductEntryRuntimeCliText,
} from '../../src/cli/ZavorthCliProductEntryRuntimeRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-product-entry',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Product Entry Runtime Channel mesh7', () => {
  it('parses product-entry text after aliases', () => {
    expect(resolveProductEntryRuntimeCliText('product-entry "primeiro uso"')).toBe('primeiro uso');
    expect(resolveProductEntryRuntimeCliText('first-run-runtime latest')).toBe('');
  });

  it('renders product entry JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'product-entry',
      normalized: 'product-entry',
      args: 'product-entry "primeiro uso"',
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
      contractVersion: '2026-05-04.product-entry',
      source: 'ProductEntryRuntimeService',
      status: 'handoff_to_agent_runtime',
      firstRun: expect.objectContaining({
        profileConfigured: true,
        personalizationPending: false,
      }),
      readiness: expect.objectContaining({
        productizationEvidenceLinked: true,
        firstRunRequired: false,
        handoffToAgentRuntime: true,
      }),
      policy: expect.objectContaining({
        noProfileWritePerformed: true,
        noRuntimePersistentStart: true,
        firstRunStateSharedAcrossSurfaces: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth product-entry');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildProductEntryRuntimeCliSnapshot({
      text: 'primeiro uso',
      userId: 'grey',
      sessionId: 'session-cli-product-entry-human',
    });

    const text = formatProductEntryRuntimeSnapshot(snapshot);

    expect(text).toContain('Product Entry Runtime / First Run - Channel mesh7');
    expect(text).toMatch(/snapshot|profile|Product Entry|First Run/i);
    expect(text).toContain('first-run e estado shared');
    expect(text).toContain('Dashboard: /zavorthControl-runId=');
  });
});
