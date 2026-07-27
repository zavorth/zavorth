import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginMcpBridgeService } from '../../src/services/PluginMcpBridgeService.js';

describe('PluginMcpBridgeService activation', () => {
  let root: string;
  let configPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-bridge-'));
    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    configPath = path.join(configDir, 'mcp-servers.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        [
          {
            id: 'filesystem',
            enabled: false,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
            capability: 'filesystem',
          },
          {
            id: 'playwright',
            enabled: false,
            command: 'npx',
            args: ['-y', '@playwright/mcp'],
            capability: 'browser',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists servers and builds an enablement plan without mutating config', () => {
    const service = new PluginMcpBridgeService({ projectRoot: root });
    const servers = service.listServers({ root });
    expect(servers.map((server) => server.id)).toEqual(['filesystem', 'playwright']);

    const plan = service.buildActivationPlan('playwright', { root });
    expect(plan.ok).toBe(true);
    expect(plan.enabled).toBe(false);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.nextCommands.some((command) => command.includes('mcp_enable'))).toBe(true);

    const still = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{ enabled: boolean }>;
    expect(still.every((entry) => entry.enabled === false)).toBe(true);
  });

  it('requires confirmed=true before enabling and then writes the manifest', () => {
    const service = new PluginMcpBridgeService({ projectRoot: root });
    const preview = service.setServerEnabled('filesystem', true, { root, confirmed: false });
    expect(preview.ok).toBe(false);
    expect(preview.reason).toBe('needs_confirmation');

    const applied = service.setServerEnabled('filesystem', true, { root, confirmed: true });
    expect(applied.ok).toBe(true);
    expect(applied.enabled).toBe(true);

    const written = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Array<{ id: string; enabled: boolean }>;
    expect(written.find((entry) => entry.id === 'filesystem')?.enabled).toBe(true);
    expect(written.find((entry) => entry.id === 'playwright')?.enabled).toBe(false);
  });

  it('formats an agent catalog including on-demand guidance', () => {
    const service = new PluginMcpBridgeService({ projectRoot: root });
    const text = service.formatCatalogForAgent({ root, max: 4 });
    expect(text).toContain('filesystem');
    expect(text).toContain('disabled');
    expect(text).toContain('mcp_enable');
  });
});
