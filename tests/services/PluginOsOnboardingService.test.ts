import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsOnboardingService } from '../../src/services/PluginOsOnboardingService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsOnboardingService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p6-onboard-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    for (const id of ['web-search', 'security-guidance', 'plugin-router-ai', 'mcp-bridge', 'gmail']) {
      const dir = path.join(root, 'plugins', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'manifest.json'),
        JSON.stringify({
          schemaVersion: 'zavorth.plugin-os.v1',
          id,
          label: id,
          version: '1.0.0',
          moduleKind: 'tool',
          summary: id,
          capabilities: [{ id: `${id}.run`, intent: id, label: id, summary: id }],
          entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
          lifecycle: { actions: ['invoke'], defaultAction: 'invoke' },
          policy: { defaultTrust: 'trusted' },
          compatibility: { zavorthVersion: '>=1.1.0', pluginApiVersion: 'zavorth.plugin-os.v1' },
        }),
        'utf8',
      );
    }
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        { id: 'web-search', name: 'Web Search', tier: 'first-party' },
        { id: 'security-guidance', name: 'Security', tier: 'first-party' },
        { id: 'plugin-router-ai', name: 'Router', tier: 'first-party' },
        { id: 'mcp-bridge', name: 'MCP', tier: 'first-party' },
        { id: 'gmail', name: 'Gmail', tier: 'first-party' },
      ]),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-onboarding.json'),
      JSON.stringify({
        defaultProfile: 'recommended',
        injectAgentSurface: true,
        optionalIds: ['gmail'],
        profiles: {
          minimal: {
            label: 'Minimal',
            summary: 'min',
            includeIds: ['plugin-router-ai', 'security-guidance', 'mcp-bridge'],
            excludeOptional: true,
          },
          recommended: {
            label: 'Recommended',
            summary: 'rec',
            includeTiers: ['first-party'],
            excludeIds: ['gmail'],
            excludeOptional: true,
          },
          full: {
            label: 'Full',
            summary: 'full',
            includeTiers: ['first-party'],
            excludeOptional: false,
          },
        },
      }),
      'utf8',
    );
    return root;
  }

  it('plans recommended without gmail and applies with approval', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const service = new PluginOsOnboardingService({ projectRoot: root, stateBridge: bridge });

    const plan = service.plan('recommended', { root });
    expect(plan.ok).toBe(true);
    expect(plan.targetIds).toContain('web-search');
    expect(plan.targetIds).not.toContain('gmail');

    const denied = service.apply('recommended', { root, approved: false });
    expect(denied.ok).toBe(false);

    const applied = service.apply('recommended', { root, approved: true });
    expect(applied.ok).toBe(true);
    expect(applied.enabled.length).toBeGreaterThan(0);
    expect(bridge.resolve('web-search').enabled).toBe(true);
    expect(bridge.resolve('gmail').enabled).toBe(false);

    const status = service.status(root);
    expect(status.completed).toBe(true);
    expect(status.profile).toBe('recommended');
  });

  it('includes optional plugins when selected', () => {
    const root = makeRoot();
    const service = new PluginOsOnboardingService({ projectRoot: root });
    const plan = service.plan('recommended', { root, optionalIds: ['gmail'] });
    expect(plan.targetIds).toContain('gmail');
    expect(plan.optionalIds).toContain('gmail');
  });

  it('undo disables plugins from last onboarding enabledIds without deleting packages', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const service = new PluginOsOnboardingService({ projectRoot: root, stateBridge: bridge });

    const applied = service.apply('minimal', { root, approved: true });
    expect(applied.ok).toBe(true);
    expect(applied.enabled.length).toBeGreaterThan(0);
    for (const id of applied.enabled) {
      expect(bridge.resolve(id).enabled).toBe(true);
      expect(fs.existsSync(path.join(root, 'plugins', id, 'manifest.json'))).toBe(true);
    }

    const denied = service.undo({ root, approved: false });
    expect(denied.ok).toBe(false);

    const undone = service.undo({ root, approved: true });
    expect(undone.ok).toBe(true);
    expect(undone.disabled.length).toBeGreaterThan(0);
    for (const id of applied.enabled) {
      expect(bridge.resolve(id).enabled).toBe(false);
      expect(fs.existsSync(path.join(root, 'plugins', id, 'manifest.json'))).toBe(true);
    }

    const status = service.status(root);
    expect(status.completed).toBe(false);
    expect(status.undoneAt).toBeTruthy();
    expect(status.enabledIds).toEqual([]);
  });
});
