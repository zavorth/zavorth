'use strict';

const { resolvePluginPermissions } = require('./permissionPresets.js');

const TOOL_BIND_KINDS = new Set(['tool', 'module', 'search', 'diagnostics', 'qa']);
const MODULE_KINDS = new Set([
  'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
  'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
]);

function definePlugin(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('definePlugin requires an input object.');
  }
  const id = normalizeId(input.id);
  const moduleKind = normalizeModuleKind(input.kind || 'tool');
  const label = String(input.label || id).trim() || id;
  const summary = String(input.summary || `${label} plugin`).trim();
  const description = String(input.description || summary).trim();
  const version = String(input.version || '0.1.0').trim() || '0.1.0';

  const toolEntries = normalizeToolEntries(input.tools || {});
  const capabilities = buildCapabilities({
    moduleKind,
    toolEntries,
    capabilities: input.capabilities || [],
  });

  const permissions = resolvePluginPermissions({
    moduleKind,
    permissions: input.permissions === undefined ? 'auto' : input.permissions,
  });

  const hasNetwork = permissions.some((permission) => permission.kind === 'network.external');
  const requiresApproval = permissions.some((permission) => permission.required);

  const manifest = {
    schemaVersion: 'zavorth.plugin-os.v1',
    id,
    label,
    version,
    moduleKind,
    summary,
    description,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [moduleKind],
    source: {
      kind: 'local',
      locator: `local://${id}`,
      digest: null,
      trusted: false,
    },
    compatibility: {
      zavorthVersion: String(input.zavorthVersion || '>=1.1.0'),
      pluginApiVersion: 'zavorth.plugin-os.v1',
    },
    capabilities,
    permissions,
    entrypoint: {
      module: (input.entrypoint && input.entrypoint.module) || './index.js',
      exportName: (input.entrypoint && input.entrypoint.exportName) || 'register',
      runtime: (input.entrypoint && input.entrypoint.runtime) || 'node',
    },
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
      defaultAction: 'invoke',
    },
    policy: {
      defaultTrust: (input.policy && input.policy.defaultTrust) || 'review',
      requiresApproval: (input.policy && input.policy.requiresApproval !== undefined)
        ? input.policy.requiresApproval
        : requiresApproval,
      allowNetworkByDefault: (input.policy && input.policy.allowNetworkByDefault) || false,
      allowFilesystemWriteByDefault: (input.policy && input.policy.allowFilesystemWriteByDefault) || false,
      allowProcessSpawnByDefault: (input.policy && input.policy.allowProcessSpawnByDefault) || false,
      sandboxProfile: (input.policy && input.policy.sandboxProfile)
        || (hasNetwork ? 'networked' : 'restricted'),
    },
    artifactKinds: [],
    receiptKinds: [`${id}.receipt`],
  };

  const hookEntries = normalizeHookEntries(input.hooks);
  const setup = typeof input.setup === 'function' ? input.setup : null;

  const register = async (ctx) => {
    for (const tool of toolEntries) {
      if (TOOL_BIND_KINDS.has(moduleKind) && typeof ctx.bindTool === 'function') {
        ctx.bindTool({
          capabilityId: tool.id,
          name: tool.name,
          description: tool.description,
          handler: tool.handler,
        });
      } else if (typeof ctx.bindCapability === 'function') {
        ctx.bindCapability(tool.id, tool.handler);
      }
    }
    for (const hook of hookEntries) {
      if (typeof ctx.registerHook === 'function') {
        ctx.registerHook(hook.event, hook.handler);
      }
    }
    if (setup) {
      await setup(ctx);
    }
  };

  return {
    kind: 'zavorth.defined-plugin',
    manifest,
    register,
    input: { ...input, id, kind: moduleKind },
  };
}

function isDefinedPlugin(value) {
  if (!value || typeof value !== 'object') return false;
  return value.kind === 'zavorth.defined-plugin'
    && Boolean(value.manifest)
    && typeof value.register === 'function';
}

function toPluginRegisterExport(defined) {
  return {
    register: defined.register,
    manifest: defined.manifest,
  };
}

function normalizeToolEntries(tools) {
  return Object.entries(tools || {}).map(([key, spec]) => {
    const id = String(key || '').trim();
    if (!id) throw new Error('definePlugin tools keys must be non-empty capability ids.');
    if (typeof spec === 'function') {
      return {
        id,
        label: humanizeId(id),
        intent: id,
        summary: `${humanizeId(id)} capability.`,
        handler: spec,
      };
    }
    if (!spec || typeof spec.handler !== 'function') {
      throw new Error(`definePlugin tool "${id}" requires a handler function.`);
    }
    const label = String(spec.label || spec.name || humanizeId(id)).trim() || humanizeId(id);
    const summary = String(spec.summary || spec.description || `${label} capability.`).trim();
    return {
      id,
      name: spec.name ? String(spec.name).trim() : undefined,
      description: spec.description ? String(spec.description).trim() : undefined,
      label,
      intent: String(spec.intent || '').trim() || id,
      summary,
      handler: spec.handler,
    };
  });
}

function buildCapabilities(input) {
  const byId = new Map();
  for (const tool of input.toolEntries) {
    byId.set(tool.id, {
      id: tool.id,
      intent: tool.intent.includes('.') ? tool.intent : `${input.moduleKind}.${tool.id}`,
      label: tool.label,
      summary: tool.summary,
      artifactKinds: [],
      command: {
        name: (tool.name || tool.id).replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
        aliases: [],
        usage: null,
      },
    });
  }
  for (const entry of input.capabilities) {
    if (typeof entry === 'string') {
      const id = String(entry || '').trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, stubCapability(id, input.moduleKind));
      continue;
    }
    const id = String((entry && entry.id) || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    byId.set(id, {
      id,
      intent: String((entry && entry.intent) || (existing && existing.intent) || `${input.moduleKind}.${id}`).trim(),
      label: String((entry && entry.label) || (existing && existing.label) || humanizeId(id)).trim(),
      summary: String((entry && entry.summary) || (existing && existing.summary) || `${humanizeId(id)} capability.`).trim(),
      artifactKinds: (entry && entry.artifactKinds) || (existing && existing.artifactKinds) || [],
      command: (entry && entry.command !== undefined)
        ? entry.command
        : ((existing && existing.command) || {
          name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
          aliases: [],
          usage: null,
        }),
    });
  }
  if (byId.size === 0) {
    byId.set('main.run', stubCapability('main.run', input.moduleKind));
  }
  return Array.from(byId.values());
}

function stubCapability(id, moduleKind) {
  return {
    id,
    intent: `${moduleKind}.${id}`,
    label: humanizeId(id),
    summary: `${humanizeId(id)} capability.`,
    artifactKinds: [],
    command: {
      name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
      aliases: [],
      usage: null,
    },
  };
}

function normalizeHookEntries(hooks) {
  if (!hooks) return [];
  if (Array.isArray(hooks)) {
    return hooks
      .filter((entry) => entry && typeof entry.handler === 'function' && entry.event)
      .map((entry) => ({ event: entry.event, handler: entry.handler }));
  }
  return Object.entries(hooks)
    .filter((entry) => entry[0] && typeof entry[1] === 'function')
    .map(([event, handler]) => ({ event, handler }));
}

function normalizeModuleKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  return MODULE_KINDS.has(kind) ? kind : 'tool';
}

function normalizeId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized) throw new Error('definePlugin id is required.');
  return normalized;
}

function humanizeId(value) {
  return String(value || '')
    .split(/[._-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || value;
}

module.exports = {
  definePlugin,
  isDefinedPlugin,
  toPluginRegisterExport,
};
