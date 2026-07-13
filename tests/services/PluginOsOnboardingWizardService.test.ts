import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsOnboardingWizardService } from '../../src/services/PluginOsOnboardingWizardService.js';
import { PluginOsOnboardingService } from '../../src/services/PluginOsOnboardingService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsOnboardingWizardService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p7-wizard-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    for (const id of ['web-search', 'plugin-router-ai', 'security-guidance', 'mcp-bridge', 'gmail']) {
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
        { id: 'plugin-router-ai', name: 'Router', tier: 'first-party' },
        { id: 'security-guidance', name: 'Security', tier: 'first-party' },
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
          recommended: {
            label: 'Recommended',
            summary: 'rec',
            includeTiers: ['first-party'],
            excludeIds: ['gmail'],
            excludeOptional: true,
          },
        },
      }),
      'utf8',
    );
    return root;
  }

  it('walks steps, toggles optionals, and applies', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const wizard = new PluginOsOnboardingWizardService({
      projectRoot: root,
      onboarding: new PluginOsOnboardingService({ projectRoot: root, stateBridge: bridge }),
    });

    let state = wizard.start({ root });
    expect(state.step).toBe('welcome');
    state = wizard.next(state, { root });
    expect(state.step).toBe('profile');
    state = wizard.setProfile(state, 'recommended', { root });
    state = wizard.next(state, { root });
    expect(state.step).toBe('optionals');
    state = wizard.setOptional(state, 'gmail', true, { root });
    expect(state.optionalIds).toContain('gmail');
    state = wizard.setInject(state, 'compact', 100, { root });
    state = wizard.next(state, { root }); // inject
    state = wizard.next(state, { root }); // review

    const applied = wizard.apply(state, { root, approved: true });
    expect(applied.result.ok).toBe(true);
    expect(applied.state.step).toBe('done');
    expect(bridge.resolve('web-search').enabled).toBe(true);
    expect(bridge.resolve('gmail').enabled).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugin-os-prompt.json'))).toBe(true);
  });
});
