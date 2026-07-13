import {
  permissionPresetForModuleKind,
  resolvePluginPermissions,
} from '../../../src/sdk/plugin/permissionPresets.js';
import { createZavorthPermission } from '../../../src/sdk/module/index.js';

describe('permissionPresets', () => {
  it('returns filesystem.read for tool-like kinds', () => {
    for (const kind of ['tool', 'module', 'search', 'diagnostics', 'qa'] as const) {
      const preset = permissionPresetForModuleKind(kind);
      expect(preset.some((permission) => permission.kind === 'filesystem.read' && permission.scope === 'workspace')).toBe(true);
    }
  });

  it('returns channel + network for channel/bridge', () => {
    for (const kind of ['channel', 'bridge'] as const) {
      const kinds = permissionPresetForModuleKind(kind).map((permission) => permission.kind);
      expect(kinds).toContain('channel.send');
      expect(kinds).toContain('network.external');
    }
  });

  it('returns memory read/write for memory', () => {
    const kinds = permissionPresetForModuleKind('memory').map((permission) => permission.kind);
    expect(kinds).toEqual(expect.arrayContaining(['memory.read', 'memory.write']));
  });

  it('returns provider.call for provider', () => {
    const preset = permissionPresetForModuleKind('provider');
    expect(preset[0]?.kind).toBe('provider.call');
    expect(preset[0]?.scope).toBe('external');
  });

  it('returns process.spawn for sandbox', () => {
    const kinds = permissionPresetForModuleKind('sandbox').map((permission) => permission.kind);
    expect(kinds).toContain('process.spawn');
    expect(kinds).toContain('filesystem.read');
  });

  it('marks agent/workspace write as optional', () => {
    const write = permissionPresetForModuleKind('agent').find(
      (permission) => permission.kind === 'filesystem.write',
    );
    expect(write?.required).toBe(false);
  });

  it('resolvePluginPermissions uses auto preset and merges extra uniquely', () => {
    const resolved = resolvePluginPermissions({
      moduleKind: 'tool',
      permissions: 'auto',
      extra: [
        createZavorthPermission('filesystem.read', 'workspace', 'duplicate', true),
        createZavorthPermission('artifact.read', 'workspace', 'extra artifact', true),
      ],
    });
    const readCount = resolved.filter((permission) => permission.kind === 'filesystem.read').length;
    expect(readCount).toBe(1);
    expect(resolved.some((permission) => permission.kind === 'artifact.read')).toBe(true);
  });

  it('resolvePluginPermissions respects explicit permission arrays', () => {
    const explicit = [
      createZavorthPermission('secret.read', 'local', 'explicit secret', true),
    ];
    const resolved = resolvePluginPermissions({
      moduleKind: 'tool',
      permissions: explicit,
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.kind).toBe('secret.read');
  });
});
