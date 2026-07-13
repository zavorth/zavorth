'use strict';

function createPermission(kind, scope, reason, required) {
  return {
    kind,
    scope,
    reason: String(reason || 'Declared plugin permission.'),
    required: required !== false,
  };
}

function permissionPresetForModuleKind(kind) {
  switch (kind) {
    case 'tool':
    case 'module':
    case 'search':
    case 'diagnostics':
    case 'qa':
      return [createPermission('filesystem.read', 'workspace', 'Read workspace files for plugin operation.', true)];
    case 'channel':
    case 'bridge':
      return [
        createPermission('channel.send', 'workspace', 'Send messages through the channel adapter surface.', true),
        createPermission('network.external', 'external', 'Reach external channel or bridge endpoints.', true),
      ];
    case 'memory':
      return [
        createPermission('memory.read', 'workspace', 'Read memory backend entries.', true),
        createPermission('memory.write', 'workspace', 'Write memory backend entries.', true),
      ];
    case 'provider':
      return [createPermission('provider.call', 'external', 'Invoke an external model or provider API.', true)];
    case 'sandbox':
      return [
        createPermission('process.spawn', 'local', 'Spawn sandboxed local processes.', true),
        createPermission('filesystem.read', 'workspace', 'Read workspace files inside the sandbox profile.', true),
      ];
    case 'media':
    case 'voice':
      return [createPermission('network.external', 'external', 'Fetch or stream media and voice payloads.', true)];
    case 'agent':
    case 'workspace':
      return [
        createPermission('filesystem.read', 'workspace', 'Read workspace files for agent or workspace operations.', true),
        createPermission('filesystem.write', 'workspace', 'Write workspace files when explicitly approved.', false),
      ];
    default:
      return [createPermission('filesystem.read', 'workspace', 'Default workspace read access for plugin operation.', true)];
  }
}

function resolvePluginPermissions(input) {
  const base = Array.isArray(input.permissions)
    ? input.permissions
    : permissionPresetForModuleKind(input.moduleKind);
  const extra = Array.isArray(input.extra) ? input.extra : [];
  return mergePermissions([...base, ...extra]);
}

function mergePermissions(permissions) {
  const byKey = new Map();
  for (const permission of permissions) {
    if (!permission || !permission.kind || !permission.scope) continue;
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

module.exports = {
  permissionPresetForModuleKind,
  resolvePluginPermissions,
};
