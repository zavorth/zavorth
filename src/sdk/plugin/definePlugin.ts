import type {
  ZavorthPluginCapabilityBinding,
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
} from '../../contracts/PluginManifestContract.js';
import type {
  ZavorthPluginCapabilityHandler,
  ZavorthPluginRegistrationContext,
  ZavorthPluginRuntimeHookEvent,
} from '../../contracts/core/PluginRuntimeContract.js';
import {
  createZavorthModuleManifest,
  createZavorthCapabilityBinding,
} from '../module/index.js';
import { resolvePluginPermissions } from './permissionPresets.js';

const TOOL_BIND_KINDS: ZavorthPluginModuleKind[] = [
  'tool',
  'module',
  'search',
  'diagnostics',
  'qa',
];

export type DefinePluginToolSpec = ZavorthPluginCapabilityHandler | {
  handler: ZavorthPluginCapabilityHandler;
  name?: string;
  description?: string;
  label?: string;
  intent?: string;
  summary?: string;
};

export type DefinePluginHookHandler = (payload: {
  event: ZavorthPluginRuntimeHookEvent;
  context: Record<string, unknown>;
}) => void | Promise<void>;

export type DefinePluginInput = {
  id: string;
  label?: string;
  version?: string;
  kind?: ZavorthPluginModuleKind;
  summary?: string;
  description?: string;
  tags?: string[];
  capabilities?: Array<string | (Partial<ZavorthPluginCapabilityBinding> & { id: string })>;
  tools?: Record<string, DefinePluginToolSpec>;
  hooks?: Partial<Record<ZavorthPluginRuntimeHookEvent, DefinePluginHookHandler>>
    | Array<{ event: ZavorthPluginRuntimeHookEvent; handler: DefinePluginHookHandler }>;
  permissions?: ZavorthPluginPermission[] | 'auto';
  policy?: Partial<ZavorthPluginManifest['policy']>;
  entrypoint?: Partial<ZavorthPluginManifest['entrypoint']>;
  setup?: (ctx: ZavorthPluginRegistrationContext) => void | Promise<void>;
  zavorthVersion?: string;
};

export type DefinedPlugin = {
  kind: 'zavorth.defined-plugin';
  manifest: ZavorthPluginManifest;
  register: (ctx: ZavorthPluginRegistrationContext) => void | Promise<void>;
  input: DefinePluginInput;
};

export function definePlugin(input: DefinePluginInput): DefinedPlugin {
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
    permissions: input.permissions ?? 'auto',
  });

  const hasNetwork = permissions.some((permission) => permission.kind === 'network.external');
  const requiresApproval = permissions.some((permission) => permission.required);

  const manifest = createZavorthModuleManifest({
    id,
    label,
    version,
    moduleKind,
    summary,
    description,
    tags: input.tags,
    capabilities,
    permissions,
    entrypoint: {
      module: input.entrypoint?.module || './index.js',
      exportName: input.entrypoint?.exportName || 'register',
      runtime: input.entrypoint?.runtime || 'node',
    },
    policy: {
      defaultTrust: input.policy?.defaultTrust || 'review',
      requiresApproval: input.policy?.requiresApproval ?? requiresApproval,
      allowNetworkByDefault: input.policy?.allowNetworkByDefault ?? false,
      allowFilesystemWriteByDefault: input.policy?.allowFilesystemWriteByDefault ?? false,
      allowProcessSpawnByDefault: input.policy?.allowProcessSpawnByDefault ?? false,
      sandboxProfile: input.policy?.sandboxProfile
        || (hasNetwork ? 'networked' : 'restricted'),
    },
    zavorthVersion: input.zavorthVersion,
  });

  const hookEntries = normalizeHookEntries(input.hooks);
  const setup = typeof input.setup === 'function' ? input.setup : null;

  const register = async (ctx: ZavorthPluginRegistrationContext): Promise<void> => {
    for (const tool of toolEntries) {
      if (TOOL_BIND_KINDS.includes(moduleKind)) {
        ctx.bindTool({
          capabilityId: tool.id,
          name: tool.name,
          description: tool.description,
          handler: tool.handler,
        });
      } else {
        ctx.bindCapability(tool.id, tool.handler);
      }
    }

    for (const hook of hookEntries) {
      ctx.registerHook(hook.event, hook.handler);
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

export function isDefinedPlugin(value: unknown): value is DefinedPlugin {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<DefinedPlugin>;
  return candidate.kind === 'zavorth.defined-plugin'
    && Boolean(candidate.manifest)
    && typeof candidate.register === 'function';
}

export function toPluginRegisterExport(defined: DefinedPlugin): {
  register: (ctx: ZavorthPluginRegistrationContext) => void | Promise<void>;
  manifest: ZavorthPluginManifest;
} {
  return {
    register: defined.register,
    manifest: defined.manifest,
  };
}

type NormalizedToolEntry = {
  id: string;
  name?: string;
  description?: string;
  label: string;
  intent: string;
  summary: string;
  handler: ZavorthPluginCapabilityHandler;
};

function normalizeToolEntries(
  tools: Record<string, DefinePluginToolSpec>,
): NormalizedToolEntry[] {
  return Object.entries(tools || {}).map(([key, spec]) => {
    const id = String(key || '').trim();
    if (!id) {
      throw new Error('definePlugin tools keys must be non-empty capability ids.');
    }
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

function buildCapabilities(input: {
  moduleKind: ZavorthPluginModuleKind;
  toolEntries: NormalizedToolEntry[];
  capabilities: Array<string | (Partial<ZavorthPluginCapabilityBinding> & { id: string })>;
}): ZavorthPluginCapabilityBinding[] {
  const byId = new Map<string, ZavorthPluginCapabilityBinding>();

  for (const tool of input.toolEntries) {
    byId.set(tool.id, createZavorthCapabilityBinding({
      id: tool.id,
      intent: tool.intent.includes('.')
        ? tool.intent
        : `${input.moduleKind}.${tool.id}`,
      label: tool.label,
      summary: tool.summary,
      command: tool.name
        ? {
          name: tool.name,
          aliases: [],
          usage: null,
        }
        : {
          name: tool.id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
          aliases: [],
          usage: null,
        },
    }));
  }

  for (const entry of input.capabilities) {
    if (typeof entry === 'string') {
      const id = String(entry || '').trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, createZavorthCapabilityBinding({
        id,
        intent: `${input.moduleKind}.${id}`,
        label: humanizeId(id),
        summary: `${humanizeId(id)} capability.`,
        command: {
          name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
          aliases: [],
          usage: null,
        },
      }));
      continue;
    }
    const id = String(entry?.id || '').trim();
    if (!id) {
      continue;
    }
    const existing = byId.get(id);
    byId.set(id, createZavorthCapabilityBinding({
      id,
      intent: String(entry.intent || existing?.intent || `${input.moduleKind}.${id}`).trim(),
      label: String(entry.label || existing?.label || humanizeId(id)).trim(),
      summary: String(entry.summary || existing?.summary || `${humanizeId(id)} capability.`).trim(),
      artifactKinds: entry.artifactKinds || existing?.artifactKinds || [],
      command: entry.command !== undefined ? entry.command : (existing?.command ?? {
        name: id.replace(/[^a-z0-9]+/giu, '_').toLowerCase(),
        aliases: [],
        usage: null,
      }),
    }));
  }

  if (byId.size === 0) {
    byId.set('main.run', createZavorthCapabilityBinding({
      id: 'main.run',
      intent: `${input.moduleKind}.run`,
      label: 'Main',
      summary: 'Primary capability for this plugin.',
      command: {
        name: 'main_run',
        aliases: [],
        usage: null,
      },
    }));
  }

  return Array.from(byId.values());
}

function normalizeHookEntries(
  hooks: DefinePluginInput['hooks'],
): Array<{ event: ZavorthPluginRuntimeHookEvent; handler: DefinePluginHookHandler }> {
  if (!hooks) {
    return [];
  }
  if (Array.isArray(hooks)) {
    return hooks
      .filter((entry) => entry && typeof entry.handler === 'function' && entry.event)
      .map((entry) => ({
        event: entry.event,
        handler: entry.handler,
      }));
  }
  return Object.entries(hooks)
    .filter((entry): entry is [ZavorthPluginRuntimeHookEvent, DefinePluginHookHandler] => {
      return Boolean(entry[0]) && typeof entry[1] === 'function';
    })
    .map(([event, handler]) => ({ event, handler }));
}

function normalizeModuleKind(value: string): ZavorthPluginModuleKind {
  const kind = String(value || '').trim().toLowerCase();
  const allowed = new Set<ZavorthPluginModuleKind>([
    'agent', 'provider', 'channel', 'sandbox', 'tool', 'media', 'voice',
    'search', 'memory', 'diagnostics', 'qa', 'bridge', 'workspace', 'module',
  ]);
  return (allowed.has(kind as ZavorthPluginModuleKind)
    ? kind
    : 'tool') as ZavorthPluginModuleKind;
}

function normalizeId(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized) {
    throw new Error('definePlugin id is required.');
  }
  return normalized;
}

function humanizeId(value: string): string {
  return String(value || '')
    .split(/[._-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || value;
}
