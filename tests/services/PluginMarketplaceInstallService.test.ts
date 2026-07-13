import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import { PluginDiscoveryService } from '../../src/services/PluginDiscoveryService.js';
import { PluginMarketplaceInstallService } from '../../src/services/PluginMarketplaceInstallService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

const FIXED_NOW = () => new Date('2026-07-12T20:00:00.000Z');

describe('PluginMarketplaceInstallService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function track(root: string): string {
    tempRoots.push(root);
    return root;
  }

  it('materializes a Plugin OS package and marks it installed through the bridge', () => {
    const projectRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mkt-install-')));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    const service = new PluginMarketplaceInstallService({ now: FIXED_NOW, projectRoot, bridge });

    const result = service.materialize({
      id: 'zavorth-plugin-webhook-actions',
      name: 'Webhook Actions',
      summary: 'Governed webhook action bridge.',
      version: '1.0.0',
      moduleKind: 'bridge',
      permissions: ['network:http'],
    });

    expect(result.created).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(result.entryPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8')) as {
      schemaVersion: string;
      id: string;
      entrypoint: { exportName: string };
    };
    expect(manifest.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
    expect(manifest.id).toBe('zavorth-plugin-webhook-actions');
    expect(manifest.entrypoint.exportName).toBe('register');

    expect(result.bridged.installed).toBe(true);
    expect(result.bridged.enabled).toBe(false);
    expect(result.bridged.runtimeState).toBe('disabled');
  });

  it('enables marketplace package when requested and becomes loadEligible after discovery', () => {
    const projectRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mkt-enable-')));
    const userHome = track(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mkt-home-')));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    const service = new PluginMarketplaceInstallService({ now: FIXED_NOW, projectRoot, bridge });

    const installed = service.materialize({
      id: 'zavorth-plugin-workspace-inspector',
      name: 'Workspace Inspector',
      summary: 'Read-only workspace analysis plugin.',
      version: '1.0.0',
      moduleKind: 'tool',
      permissions: ['workspace:read'],
    }, { enable: true });

    expect(installed.bridged.enabled).toBe(true);
    expect(installed.bridged.runtimeState).toBe('enabled');

    const discovery = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: projectRoot,
      userHome,
      stateLookup: bridge.asStateLookup(),
    });
    const snapshot = discovery.discover();
    const plugin = snapshot.plugins.find((entry) => entry.pluginId === 'zavorth-plugin-workspace-inspector');
    expect(plugin).toBeTruthy();
    expect(plugin?.sourceKind).toBe('workspace');
    expect(plugin?.validation.ok).toBe(true);
    expect(plugin?.loadEligible).toBe(true);
  });
});
