import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsPermissionPreviewService } from '../../src/services/PluginOsPermissionPreviewService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsPermissionPreviewService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-perm-preview-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        { id: 'web-search', name: 'Web Search', tier: 'first-party' },
        { id: 'gmail', name: 'Gmail', tier: 'first-party' },
      ]),
      'utf8',
    );
    return root;
  }

  function writePlugin(
    root: string,
    id: string,
    manifest: Record<string, unknown>,
    subdir: 'plugins' | 'plugins/examples' | '.zavorth/plugins' = 'plugins',
  ): void {
    const dir = path.join(root, ...subdir.split('/'), id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
  }

  it('previews permissions and risks from a package manifest', () => {
    const root = makeRoot();
    writePlugin(root, 'web-search', {
      schemaVersion: 'zavorth.plugin-os.v1',
      id: 'web-search',
      label: 'Web Search',
      moduleKind: 'search',
      policy: { defaultTrust: 'review', requiresApproval: true },
      permissions: [
        {
          kind: 'network.external',
          scope: 'external',
          reason: 'Call search backends',
          required: false,
        },
      ],
    });

    const service = new PluginOsPermissionPreviewService({ projectRoot: root });
    const preview = service.preview('web-search', root);

    expect(preview.ok).toBe(true);
    expect(preview.pluginId).toBe('web-search');
    expect(preview.label).toBe('Web Search');
    expect(preview.tier).toBe('first-party');
    expect(preview.permissions).toHaveLength(1);
    expect(preview.permissions[0].kind).toBe('network.external');
    expect(preview.risks).toContain('May access network');
    expect(preview.risks).toContain('Sensitive actions require approval');
    expect(preview.needsCredentials).toBe(false);
    expect(preview.signed).toBe(false);
    expect(preview.formatText()).toContain('Permission preview');
    expect(preview.formatText()).toContain('never auto-enable');
  });

  it('flags credential-heavy plugins and soft-fails when missing', () => {
    const root = makeRoot();
    writePlugin(root, 'gmail', {
      id: 'gmail',
      label: 'Gmail',
      moduleKind: 'bridge',
      policy: { defaultTrust: 'review' },
      permissions: [
        { kind: 'network.external', scope: 'external', reason: 'Gmail API', required: false },
        { kind: 'filesystem.write', scope: 'workspace', reason: 'Drafts', required: false },
      ],
    });

    const service = new PluginOsPermissionPreviewService({ projectRoot: root });
    const gmail = service.preview('gmail', root);
    expect(gmail.ok).toBe(true);
    expect(gmail.needsCredentials).toBe(true);
    expect(gmail.risks).toEqual(expect.arrayContaining([
      'May access network',
      'May write files',
    ]));

    const missing = service.preview('does-not-exist', root);
    expect(missing.ok).toBe(false);
    expect(missing.permissions).toEqual([]);
    expect(missing.findings?.some((line) => line.includes('package not found'))).toBe(true);
  });

  it('reads bridge trust and example package locations', () => {
    const root = makeRoot();
    writePlugin(root, 'hello-world', {
      id: 'hello-world',
      label: 'Hello',
      moduleKind: 'tool',
      policy: { defaultTrust: 'trusted' },
      permissions: [],
    }, 'plugins/examples');

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'hello-world',
      revision: '1.0.0',
      trust: 'trusted',
      enable: false,
      sourceLocator: './plugins/examples/hello-world',
    });

    const service = new PluginOsPermissionPreviewService({
      projectRoot: root,
      stateBridge: bridge,
    });
    const preview = service.preview('hello-world', root);
    expect(preview.ok).toBe(true);
    expect(preview.trust).toBe('trusted');
    expect(preview.sourceLocator).toContain('hello-world');
    expect(preview.risks.some((line) => line.toLowerCase().includes('no declared'))).toBe(true);
  });
});
