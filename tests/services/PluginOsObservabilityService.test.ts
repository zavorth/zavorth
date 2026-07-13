import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsObservabilityService } from '../../src/services/PluginOsObservabilityService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsObservabilityService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p5-metrics-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({
        schemaVersion: 'zavorth.plugin-os.v1',
        id: 'web-search',
        label: 'Web Search',
        version: '1.0.0',
        moduleKind: 'search',
        summary: 'search',
        capabilities: [{ id: 'search.query', intent: 'search', label: 'Search', summary: 's' }],
        entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
        lifecycle: { actions: ['invoke'], defaultAction: 'invoke' },
        policy: { defaultTrust: 'trusted' },
        compatibility: { zavorthVersion: '>=1.1.0', pluginApiVersion: 'zavorth.plugin-os.v1' },
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        { id: 'web-search', name: 'Web Search', tier: 'first-party', version: '1.0.0' },
        { id: 'github', name: 'GitHub', tier: 'first-party', version: '1.0.0' },
      ]),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-bootstrap.json'),
      JSON.stringify({ autoEnableFirstParty: true }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'mcp-servers.json'),
      JSON.stringify([{ id: 'filesystem', enabled: false, command: 'npx', args: [] }]),
      'utf8',
    );
    return root;
  }

  it('builds funnel + marketplace + mcp metrics', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'web-search',
      revision: '1.0.0',
      trust: 'trusted',
      enable: true,
    });

    const metrics = new PluginOsObservabilityService({
      projectRoot: root,
      stateBridge: bridge,
    }).buildSnapshot(root);

    expect(metrics.funnel.enabled).toBeGreaterThanOrEqual(1);
    expect(metrics.marketplace.firstPartyTotal).toBe(2);
    expect(metrics.marketplace.firstPartyEnabled).toBeGreaterThanOrEqual(1);
    expect(metrics.mcp.serversConfigured).toBe(1);
    expect(metrics.deepLinks.some((line) => line.includes('plugins metrics'))).toBe(true);
    expect(metrics.formatText()).toContain('Plugin OS metrics');
  });

  it('persists metrics receipt and records bootstrap', () => {
    const root = makeRoot();
    const service = new PluginOsObservabilityService({ projectRoot: root });
    service.recordBootstrapResult({
      enabled: ['web-search'],
      skipped: [],
      missing: ['github'],
      configPath: 'config/plugin-os-bootstrap.json',
    }, root);

    const written = service.persistSnapshot(root);
    expect(written.ok).toBe(true);
    expect(written.path).toBeTruthy();
    expect(fs.existsSync(path.join(root, written.path!))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'receipts', 'plugins.jsonl'))).toBe(true);

    const again = service.buildSnapshot(root);
    expect(again.bootstrap.lastEnabledCount).toBe(1);
    expect(again.bootstrap.lastMissingCount).toBe(1);
  });
});
