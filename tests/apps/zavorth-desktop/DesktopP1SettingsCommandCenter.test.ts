import fs from 'node:fs';
import path from 'node:path';
import {
  buildCommandCenterItems,
  filterCommandCenterItems,
  groupCommandCenterItems,
} from '../../../apps/zavorth-desktop/src/command-center/commandCenter.js';

import {
  buildSettingsModules,
  filterSettingsModules,
  flattenSettingsModules,
  resolveSettingsDeepLink,
} from '../../../apps/zavorth-desktop/src/settings/settingsModules.js';

describe('Desktop P1 settings and command center contract', () => {
  it('builds deep-linkable settings modules with real searchable status', () => {
    const groups = buildSettingsModules({
      runtimeRunning: true,
      providerCount: 0,
      mcpServerCount: 2,
      trustedMcpServerCount: 1,
      automationCount: 3,
      customProfileCount: 2,
      approvalsCount: 1,
      memoryCount: 4,
      channelCount: 0,
      workspacePath: 'C:\\repo',
    });
    const modules = flattenSettingsModules(groups);

    expect(modules.map(module => module.id)).toEqual(expect.arrayContaining([
      'general',
      'identity',
      'providers',
      'mcp',
      'automations',
      'sessions',
      'pets',
      'memory',
      'diagnostics',
    ]));
    expect(modules.find(module => module.id === 'providers')).toMatchObject({
      status: 'attention',
      deepLink: 'zavorth://settings/providers',
    });
    expect(modules.find(module => module.id === 'mcp')?.statusLabel).toContain('1/2');
    expect(modules.find(module => module.id === 'workspace')).toMatchObject({ status: 'ready' });
    expect(filterSettingsModules(groups, 'voice user rules')[0].items[0]).toMatchObject({ id: 'identity' });
    expect(filterSettingsModules(groups, 'no channels')[0].items[0]).toMatchObject({ id: 'channels' });
  });

  it('resolves settings deep links from protocol, hash, query and slash style paths', () => {
    expect(resolveSettingsDeepLink('zavorth://settings/identity')).toBe('identity');
    expect(resolveSettingsDeepLink('#settings/pets')).toBe('pets');
    expect(resolveSettingsDeepLink('zavorth://desktop-settings=mcp')).toBe('mcp');
    expect(resolveSettingsDeepLink('/settings/providers')).toBe('providers');
    expect(resolveSettingsDeepLink('zavorth://settings/unknown')).toBe(null);
  });

  it('creates a dynamic command center across settings, providers, MCP, automations, sessions, profiles, logs and quick actions', () => {
    const settingsGroups = buildSettingsModules({
      runtimeRunning: false,
      providerCount: 0,
      mcpServerCount: 1,
      trustedMcpServerCount: 0,
      automationCount: 2,
      customProfileCount: 1,
      approvalsCount: 0,
      memoryCount: 2,
      channelCount: 1,
      workspacePath: null,
    });

    const items = buildCommandCenterItems({
      settingsGroups,
      providerCount: 0,
      mcpServerCount: 1,
      automationCount: 2,
      sessionCount: 3,
      customProfileCount: 1,
      runtimeRunning: false,
      kaelActive: false,
    });

    expect(groupCommandCenterItems(items).map(group => group.category)).toEqual(expect.arrayContaining([
      'Settings',
      'Providers',
      'MCP',
      'Automations',
      'Sessions',
      'Profiles',
      'Logs',
      'Quick Actions',
    ]));
    expect(items.map(item => item.id)).toEqual(expect.arrayContaining([
      'settings:identity',
      'providers:add',
      'mcp:trust',
      'automations:create',
      'sessions:new',
      'profiles:identity',
      'logs:open',
      'quick:toggle-kael',
    ]));
    expect(filterCommandCenterItems(items, 'identity studio')).toEqual([
      expect.objectContaining({ id: 'settings:identity' }),
      expect.objectContaining({ id: 'profiles:identity' }),
    ]);
    expect(filterCommandCenterItems(items, 'runtime offline')[0]).toMatchObject({ id: 'quick:start-runtime' });
  });

  it('wires settings modules, command center and deep links into the desktop source', () => {
    const settingsOverlay = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/components/SettingsOverlay.tsx'),
      'utf8',
    );
    const commandPalette = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/overlays/CommandPalette.tsx'),
      'utf8',
    );
    const app = fs.readFileSync(
      path.resolve('apps/zavorth-desktop/src/App.tsx'),
      'utf8',
    );

    expect(settingsOverlay).toContain('buildSettingsModules');
    expect(settingsOverlay).toContain('data-settings-tab');
    expect(settingsOverlay).toContain('data-settings-status');
    expect(settingsOverlay).toContain('<IdentityStudioPanel');
    expect(commandPalette).toContain('buildCommandCenterItems');
    expect(commandPalette).toContain('zvd-command-center-category');
    expect(commandPalette).toContain('onSettings');
    expect(app).toContain('resolveSettingsDeepLink');
    expect(app).toContain('onDeepLink');
    expect(app).toContain("'identity'");
  });
});
