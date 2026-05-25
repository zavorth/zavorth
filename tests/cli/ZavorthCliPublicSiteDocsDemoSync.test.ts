import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildPublicSiteDocsDemoSyncCliSnapshot,
  formatPublicSiteDocsDemoSyncSnapshot,
  resolvePublicSiteDocsDemoSyncCliText,
} from '../../src/cli/ZavorthCliPublicSiteDocsDemoSyncRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-public-sync',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Public Site Docs Demo Sync Channel mesh9', () => {
  it('parses public-sync text after aliases', () => {
    expect(resolvePublicSiteDocsDemoSyncCliText('public-sync "alinhar docs"')).toBe('alinhar docs');
    expect(resolvePublicSiteDocsDemoSyncCliText('site-docs-demo latest')).toBe('');
  });

  it('renders public sync JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'public-sync',
      normalized: 'public-sync',
      args: 'public-sync "alinhar docs"',
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
      contractVersion: '2026-05-04.docs-demo',
      source: 'PublicSiteDocsDemoSyncService',
      status: 'synced-preview',
      sync: expect.objectContaining({
        releasePathLinked: true,
        websiteLinked: true,
        docsLinked: true,
        demoLinked: true,
        releaseBundleLinked: true,
      }),
      readiness: expect.objectContaining({
        canPublishSitePreview: true,
        canAnnounceStable: false,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noWebsiteBuildExecuted: true,
        noPublicDeployExecuted: true,
        noDemoLiveExecution: true,
        noStableClaimPublished: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth public-sync');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildPublicSiteDocsDemoSyncCliSnapshot({
      text: 'alinhar docs',
      userId: 'grey',
      sessionId: 'session-cli-public-sync-human',
    });

    const text = formatPublicSiteDocsDemoSyncSnapshot(snapshot);

    expect(text).toContain('Public Site / Docs / Demo Sync - Channel mesh9');
    expect(text).toContain('build publico nao foi executado');
    expect(text).toContain('stable claim nao foi publicado');
    expect(text).toContain('Dashboard: /dashboard?runId=');
  });
});
