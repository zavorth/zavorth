import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginOsPromptInjectionService } from '../../src/services/PluginOsPromptInjectionService.js';
import { CapabilityDiscoveryService } from '../../src/services/CapabilityDiscoveryService.js';


describe('PluginOsPromptInjectionService MCP catalog', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-prompt-mcp-'));
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'mcp-servers.json'),
      JSON.stringify([
        { id: 'filesystem', enabled: false, capability: 'filesystem' },
        { id: 'reasoning', enabled: false, capability: 'reasoning' },
      ]),
      'utf8',
    );
    fs.mkdirSync(path.join(root, '.zavorth'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.zavorth', 'plugin-os-prompt.json'),
      JSON.stringify({ injectMode: 'compact', injectSamplePercent: 100 }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('injects a compact MCP and integration hint without bloating the system prompt', () => {
    const service = new PluginOsPromptInjectionService({ projectRoot: root });
    const result = service.buildInjection({ root, mode: 'compact', recordTelemetry: false });
    expect(result.injected).toBe(true);
    expect(result.block).toContain('Plugin OS');
    expect(result.block).toContain('filesystem');
    expect(result.block).toContain('mcp_enable');
    expect(result.block.toLowerCase()).toContain('integration.connectors');
    expect(result.block.toLowerCase()).toContain('plugin_suggest');
    // Keep compact inject lean for every agent turn (~token budget).
    expect(result.block.length).toBeLessThan(700);
  });

  it('lists integration capabilities for discovery', () => {
    const discovery = new CapabilityDiscoveryService({ projectRoot: __dirname });
    const manifest = discovery.discover();
    const ids = new Set(manifest.capabilities.map((entry) => entry.id));
    expect(ids.has('integration-n8n')).toBe(true);
    expect(ids.has('integration-composio')).toBe(true);
    expect(ids.has('integration-obsidian')).toBe(true);
    expect(ids.has('skill-marketplace')).toBe(true);
  });
});
