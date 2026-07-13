import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PluginOsPromptInjectionService,
  softInjectPluginOsPrompt,
} from '../../src/services/PluginOsPromptInjectionService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsPromptInjectionService', () => {
  const tempRoots: string[] = [];
  const prevPrompt = process.env.ZAVORTH_PLUGIN_OS_PROMPT;
  const prevRuntime = process.env.ZAVORTH_PLUGIN_OS_RUNTIME;

  afterEach(() => {
    if (prevPrompt === undefined) delete process.env.ZAVORTH_PLUGIN_OS_PROMPT;
    else process.env.ZAVORTH_PLUGIN_OS_PROMPT = prevPrompt;
    if (prevRuntime === undefined) delete process.env.ZAVORTH_PLUGIN_OS_RUNTIME;
    else process.env.ZAVORTH_PLUGIN_OS_RUNTIME = prevRuntime;
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p6-prompt-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({
        id: 'web-search',
        summary: 'Search the web',
        tags: ['search'],
        capabilities: [{ id: 'search.query' }],
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        { id: 'web-search', name: 'Web Search', summary: 'Search the web', tier: 'first-party', tags: ['search'] },
      ]),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-onboarding.json'),
      JSON.stringify({ injectAgentSurface: true, defaultProfile: 'recommended', profiles: {} }),
      'utf8',
    );
    return root;
  }

  it('injects plugin os block into system prompt', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({ pluginId: 'web-search', enable: true, trust: 'trusted' });

    const service = new PluginOsPromptInjectionService({ projectRoot: root });
    const result = service.appendToSystemPrompt('You are Zavorth.', {
      root,
      recordTelemetry: false,
    });
    expect(result.injection.injected).toBe(true);
    expect(result.prompt).toContain('You are Zavorth.');
    expect(result.prompt).toContain('Plugin OS');
    expect(result.prompt).toContain('web-search');
  });

  it('respects kill switch ZAVORTH_PLUGIN_OS_PROMPT=0', () => {
    process.env.ZAVORTH_PLUGIN_OS_PROMPT = '0';
    const root = makeRoot();
    const service = new PluginOsPromptInjectionService({
      projectRoot: root,
      env: process.env,
    });
    const result = service.buildInjection({ root, recordTelemetry: false });
    expect(result.injected).toBe(false);
    expect(softInjectPluginOsPrompt('base only')).toBe('base only');
  });
});
