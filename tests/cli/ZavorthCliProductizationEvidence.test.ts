import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildProductizationEvidenceCliSnapshot,
  formatProductizationEvidenceSnapshot,
  resolveProductizationEvidenceCliText,
} from '../../src/cli/ZavorthCliProductizationEvidenceRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-productization-evidence',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI productization evidence Channel mesh6', () => {
  it('parses release readiness text after aliases', () => {
    expect(resolveProductizationEvidenceCliText('release-readiness "auditar produto"')).toBe('auditar produto');
    expect(resolveProductizationEvidenceCliText('productization-evidence latest')).toBe('');
  });

  it('renders productization evidence JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'productization-evidence',
      normalized: 'productization-evidence',
      args: 'productization-evidence "auditar readiness"',
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
      contractVersion: '2026-05-04.product-evidence',
      source: 'ProductizationEvidenceService',
      summary: expect.objectContaining({
        productizationContractLinked: true,
        releasePreviewReady: true,
        stableReleaseAllowed: false,
      }),
      releaseReadiness: expect.objectContaining({
        status: 'preview-ready',
        noReleasePublished: true,
        noInstallerExecuted: true,
      }),
      policy: expect.objectContaining({
        stableRequiresRealRelease: true,
        productizationClaimsNeedReceipts: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth productization-evidence');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildProductizationEvidenceCliSnapshot({
      text: 'auditar readiness',
      userId: 'grey',
      sessionId: 'session-cli-productization-evidence-human',
    });

    const text = formatProductizationEvidenceSnapshot(snapshot);

    expect(text).toContain('Productization Evidence & Release Readiness - Channel mesh6');
    expect(text).toContain('noReleasePublished');
    expect(text).toContain('stable requer release real');
    expect(text).toContain('Dashboard: /zavorthControl?runId=');
  });
});
