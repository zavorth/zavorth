import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildReleaseInstallerRollbackCliSnapshot,
  formatReleaseInstallerRollbackSnapshot,
  resolveReleaseInstallerRollbackCliText,
} from '../../src/cli/ZavorthCliReleaseInstallerRollbackRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-release-path',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Release Installer Rollback Channel mesh8', () => {
  it('parses release-path text after aliases', () => {
    expect(resolveReleaseInstallerRollbackCliText('release-path "preparar installer"')).toBe('preparar installer');
    expect(resolveReleaseInstallerRollbackCliText('release-installer latest')).toBe('');
  });

  it('renders release path JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'release-path',
      normalized: 'release-path',
      args: 'release-path "preparar installer"',
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
      contractVersion: '2026-05-04.release-rollback',
      source: 'ReleaseInstallerRollbackPathService',
      status: 'preview-ready',
      release: expect.objectContaining({
        releaseBundleLinked: true,
        releaseBundleStatus: 'ready',
      }),
      installer: expect.objectContaining({
        previewAvailable: true,
        installerExecuted: false,
      }),
      readiness: expect.objectContaining({
        productEntryRuntimeLinked: true,
        productizationEvidenceLinked: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noReleasePublished: true,
        noInstallerExecuted: true,
        noStableTagMoved: true,
        rollbackRequiresExplicitCommand: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth release-path');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildReleaseInstallerRollbackCliSnapshot({
      text: 'preparar installer',
      userId: 'grey',
      sessionId: 'session-cli-release-path-human',
    });

    const text = formatReleaseInstallerRollbackSnapshot(snapshot);

    expect(text).toContain('Release / Installer / Rollback Path - Channel mesh8');
    expect(text).toMatch(/release|was not publicdo|not published|Installer|Rollback/i);
    expect(text).toContain('rollback exige comando explicito');
    expect(text).toContain('Dashboard: /zavorthControl-runId=');
  });
});
