import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { ToolEffectDescriptor, ToolEffectLevel } from './ToolEffectDescriptor.js';
import { descriptorToIntentKind, normalizeToolName } from './ToolEffectDescriptor.js';

const OBSERVATION_TOOLS = new Set([
  'get_datetime',
  'datetime',
  'time.now',
  'read_file',
  'workspace.read',
  'workspace.list',
  'list_directory',
  'ls',
  'grep',
  'glob',
  'memory.read',
  'sessions.history',
  'sessions.list',
]);

const DRAFT_TOOLS = new Set([
  'selfmod.preview',
  'patch.preview',
  'diff.preview',
]);

const WORKSPACE_MUTATION_TOOLS = new Set([
  'create_file',
  'write_file',
  'workspace.write',
  'workspace.edit',
  'apply_patch',
  'edit',
  'multiedit',
  'notebookedit',
]);

const EXTERNAL_EGRESS_TOOLS = new Set([
  'network_fetch',
  'web.search',
  'web_search',
  'browser.open',
  'report.send',
  'email.send',
  'slack.send',
  'telegram.send',
  'publish',
]);

const CREDENTIAL_TOOLS = new Set([
  'configure_llm_profile',
  'provider.configure',
  'secret.read',
  'secret.write',
  'credential.configure',
]);

const DESTRUCTIVE_TOOLS = new Set([
  'delete_file',
  'workspace.delete',
  'git.reset',
  'system.delete',
  'shell.exec',
  'bash.exec',
  'powershell.exec',
  'bash',
  'remote_shell',
  'npm_install',
  'deploy',
  'modify_production_db',
]);

export class ToolEffectRegistry {
  private readonly descriptors = new Map<string, ToolEffectDescriptor>();

  constructor(input: {
    descriptors?: ToolEffectDescriptor[];
    toolDefinitions?: ToolDefinition[];
  } = {}) {
    for (const descriptor of buildDefaultToolEffectDescriptors()) {
      this.register(descriptor);
    }
    for (const definition of input.toolDefinitions || []) {
      this.register(inferToolEffectDescriptor(definition));
    }
    for (const descriptor of input.descriptors || []) {
      this.register(descriptor);
    }
  }

  public register(descriptor: ToolEffectDescriptor): ToolEffectDescriptor {
    const normalized = {
      ...descriptor,
      toolName: normalizeToolName(descriptor.toolName),
      aliases: descriptor.aliases?.map(normalizeToolName),
    };
    this.descriptors.set(normalized.toolName, normalized);
    for (const alias of normalized.aliases || []) {
      this.descriptors.set(alias, normalized);
    }
    return normalized;
  }

  public resolve(toolName: string): ToolEffectDescriptor {
    const normalized = normalizeToolName(toolName);
    return this.descriptors.get(normalized) || inferToolEffectDescriptor({ name: normalized } as ToolDefinition);
  }

  public list(): ToolEffectDescriptor[] {
    return Array.from(new Set(this.descriptors.values()));
  }
}

export function buildDefaultToolEffectDescriptors(): ToolEffectDescriptor[] {
  return [
    descriptor('get_datetime', 'observation', 'read current date/time', 'time', 'Current time lookup.'),
    descriptor('read_file', 'observation', 'read file', 'workspace', 'Workspace file read.'),
    descriptor('list_directory', 'observation', 'list directory', 'workspace', 'Workspace directory listing.'),
    descriptor('workspace.read', 'observation', 'read workspace', 'workspace', 'Workspace read.'),
    descriptor('workspace.list', 'observation', 'list workspace', 'workspace', 'Workspace listing.'),
    descriptor('web.search', 'external_egress', 'web search', 'network', 'Network search or fetch.'),
    descriptor('network_fetch', 'external_egress', 'network fetch', 'network', 'Network fetch.'),
    descriptor('write_file', 'workspace_mutation', 'write file', 'workspace', 'Workspace file write.'),
    descriptor('create_file', 'workspace_mutation', 'create file', 'workspace', 'Workspace file creation.'),
    descriptor('apply_patch', 'workspace_mutation', 'apply patch', 'workspace', 'Workspace patch application.'),
    descriptor('shell.exec', 'irreversible_or_destructive', 'spawn shell', 'process', 'Host shell execution.'),
    descriptor('bash.exec', 'irreversible_or_destructive', 'spawn bash', 'process', 'Host bash execution.'),
    descriptor('powershell.exec', 'irreversible_or_destructive', 'spawn powershell', 'process', 'Host PowerShell execution.'),
    descriptor('email.send', 'external_egress', 'send email', 'channel', 'External human-visible email send.'),
    descriptor('telegram.send', 'external_egress', 'send telegram message', 'channel', 'External Telegram send.'),
    descriptor('secret.read', 'credential_or_config', 'read secret', 'secret', 'Secret access.', 'secret'),
  ];
}

export function inferToolEffectDescriptor(definition: Pick<ToolDefinition, 'name' | 'description' | 'dangerLevel' | 'requiresPermission'>): ToolEffectDescriptor {
  const name = normalizeToolName(definition.name);
  const level = inferToolEffectLevel(name, definition);
  return descriptor(
    name,
    level,
    definition.description || `${name} tool call.`,
    inferDefaultResourceKind(level, name),
    definition.description || `${name} tool call.`,
    level === 'credential_or_config' ? 'secret' : undefined,
    {
      dangerLevel: definition.dangerLevel,
      requiresPermission: definition.requiresPermission,
      inferred: true,
    },
  );
}

function inferToolEffectLevel(
  toolName: string,
  definition: Pick<ToolDefinition, 'dangerLevel' | 'requiresPermission'>,
): ToolEffectLevel {
  if (OBSERVATION_TOOLS.has(toolName) || /(^|[._-])(read|list|ls|grep|glob|datetime|time|history)([._-]|$)/.test(toolName)) {
    return 'observation';
  }
  if (DRAFT_TOOLS.has(toolName) || toolName.includes('preview') || toolName.includes('draft')) {
    return 'draft';
  }
  if (DESTRUCTIVE_TOOLS.has(toolName) || toolName.includes('delete') || toolName.includes('shell') || toolName.includes('bash') || toolName.includes('powershell')) {
    return 'irreversible_or_destructive';
  }
  if (CREDENTIAL_TOOLS.has(toolName) || toolName.includes('secret') || toolName.includes('credential') || toolName.includes('provider.configure')) {
    return 'credential_or_config';
  }
  if (WORKSPACE_MUTATION_TOOLS.has(toolName) || toolName.includes('write') || toolName.includes('edit') || toolName.includes('patch')) {
    return 'workspace_mutation';
  }
  if (EXTERNAL_EGRESS_TOOLS.has(toolName) || toolName.includes('send') || toolName.includes('publish') || toolName.includes('network') || toolName.includes('web')) {
    return 'external_egress';
  }
  if (definition.requiresPermission || String(definition.dangerLevel || '').toLowerCase() === 'danger') {
    return 'irreversible_or_destructive';
  }
  return 'unknown';
}

function descriptor(
  toolName: string,
  level: ToolEffectLevel,
  operation: string,
  defaultResourceKind: ToolEffectDescriptor['defaultResourceKind'],
  description: string,
  defaultSensitivity?: ToolEffectDescriptor['defaultSensitivity'],
  metadata?: Record<string, unknown>,
): ToolEffectDescriptor {
  return {
    toolName: normalizeToolName(toolName),
    level,
    intentKind: descriptorToIntentKind(level),
    operation,
    defaultResourceKind,
    ...(defaultSensitivity ? { defaultSensitivity } : {}),
    requiresEffectBoundary: level !== 'observation',
    safeObservation: level === 'observation',
    description,
    argumentResourceHints: defaultArgumentResourceHints(defaultResourceKind),
    ...(metadata ? { metadata } : {}),
  };
}

function inferDefaultResourceKind(
  level: ToolEffectLevel,
  toolName: string,
): ToolEffectDescriptor['defaultResourceKind'] {
  if (level === 'credential_or_config') {
    return 'secret';
  }
  if (level === 'external_egress') {
    return toolName.includes('send') || toolName.includes('telegram') || toolName.includes('slack') || toolName.includes('email')
      ? 'channel'
      : 'network';
  }
  if (level === 'irreversible_or_destructive' && (toolName.includes('shell') || toolName.includes('bash') || toolName.includes('powershell'))) {
    return 'process';
  }
  if (toolName.includes('time') || toolName.includes('datetime')) {
    return 'time';
  }
  return 'workspace';
}

function defaultArgumentResourceHints(kind: ToolEffectDescriptor['defaultResourceKind']): string[] {
  if (kind === 'network') {
    return ['url', 'uri', 'endpoint', 'query'];
  }
  if (kind === 'channel') {
    return ['channel', 'chatId', 'recipient', 'to', 'target', 'url'];
  }
  if (kind === 'process') {
    return ['command', 'cmd', 'script', 'shell'];
  }
  if (kind === 'secret') {
    return ['secret', 'secretName', 'key', 'env', 'provider'];
  }
  if (kind === 'time') {
    return ['timezone'];
  }
  return ['path', 'file', 'target', 'target_file', 'workspacePath', 'cwd'];
}
