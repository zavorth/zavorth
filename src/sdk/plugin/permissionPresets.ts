import type {
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
} from '../../contracts/PluginManifestContract.js';
import { createZavorthPermission } from '../module/index.js';

export function permissionPresetForModuleKind(
  kind: ZavorthPluginModuleKind,
): ZavorthPluginPermission[] {
  switch (kind) {
    case 'tool':
    case 'module':
    case 'search':
    case 'diagnostics':
    case 'qa':
      return [
        createZavorthPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files for plugin operation.',
          true,
        ),
      ];
    case 'channel':
    case 'bridge':
      return [
        createZavorthPermission(
          'channel.send',
          'workspace',
          'Send messages through the channel adapter surface.',
          true,
        ),
        createZavorthPermission(
          'network.external',
          'external',
          'Reach external channel or bridge endpoints.',
          true,
        ),
      ];
    case 'memory':
      return [
        createZavorthPermission(
          'memory.read',
          'workspace',
          'Read memory backend entries.',
          true,
        ),
        createZavorthPermission(
          'memory.write',
          'workspace',
          'Write memory backend entries.',
          true,
        ),
      ];
    case 'provider':
      return [
        createZavorthPermission(
          'provider.call',
          'external',
          'Invoke an external model or provider API.',
          true,
        ),
      ];
    case 'sandbox':
      return [
        createZavorthPermission(
          'process.spawn',
          'local',
          'Spawn sandboxed local processes.',
          true,
        ),
        createZavorthPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files inside the sandbox profile.',
          true,
        ),
      ];
    case 'media':
    case 'voice':
      return [
        createZavorthPermission(
          'network.external',
          'external',
          'Fetch or stream media and voice payloads.',
          true,
        ),
      ];
    case 'agent':
    case 'workspace':
      return [
        createZavorthPermission(
          'filesystem.read',
          'workspace',
          'Read workspace files for agent or workspace operations.',
          true,
        ),
        createZavorthPermission(
          'filesystem.write',
          'workspace',
          'Write workspace files when explicitly approved.',
          false,
        ),
      ];
    default:
      return [
        createZavorthPermission(
          'filesystem.read',
          'workspace',
          'Default workspace read access for plugin operation.',
          true,
        ),
      ];
  }
}

export function resolvePluginPermissions(input: {
  moduleKind: ZavorthPluginModuleKind;
  permissions?: ZavorthPluginPermission[] | 'auto' | null;
  extra?: ZavorthPluginPermission[];
}): ZavorthPluginPermission[] {
  const base =
    Array.isArray(input.permissions)
      ? input.permissions
      : permissionPresetForModuleKind(input.moduleKind);
  const extra = Array.isArray(input.extra) ? input.extra : [];
  return mergePermissions([...base, ...extra]);
}

function mergePermissions(permissions: ZavorthPluginPermission[]): ZavorthPluginPermission[] {
  const byKey = new Map<string, ZavorthPluginPermission>();
  for (const permission of permissions) {
    if (!permission || !permission.kind || !permission.scope) {
      continue;
    }
    const key = `${permission.kind}::${permission.scope}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        kind: permission.kind,
        scope: permission.scope,
        reason: String(permission.reason || '').trim() || 'Declared plugin permission.',
        required: permission.required !== false,
      });
      continue;
    }
    byKey.set(key, {
      kind: existing.kind,
      scope: existing.scope,
      reason: existing.reason || permission.reason,
      required: existing.required || permission.required === true,
    });
  }
  return Array.from(byKey.values());
}
