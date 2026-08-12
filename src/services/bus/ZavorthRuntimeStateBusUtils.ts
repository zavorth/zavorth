import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';
import type {
ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
  ZavorthRuntimeStateBusState,
  ZavorthRuntimeCapabilitiesProjection,
  ZavorthRuntimeDynamicRoute,
  ZavorthRuntimeMcpTrustServer,
  ZavorthRuntimeModelSpec,
  ZavorthRuntimePermissionsMatrix,
  ZavorthRuntimePersonalConnector,
  ZavorthRuntimeProviderConnection,
  ZavorthRuntimeSkillHistoryEntry,
  ZavorthRuntimeStreamSession,
  ZavorthRuntimeWorkspaceKnowledge,
  ZavorthRuntimeStateDomain,
  ZavorthRuntimeStateDomainState,
  ZavorthRuntimeStateReceipt,
  ZavorthRuntimeStateReceiptStatus,
  ZavorthRuntimeStateSkill,
  ZavorthRuntimeStateStatus,
  ZavorthRuntimeStateWorkspace,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';

type RuntimeRecord = Record<string, unknown>;


export function emailDomain(value: unknown): string | null {
  const email = clean(value);
  const domain = email && email.includes('@') ? email.split('@').pop() : null;
  return domain ? safeId(domain) : null;
}

export function domainForAction(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateDomain {
  if (input.type === 'set-model') return 'model';
  if (input.type === 'set-effort') return 'effort';
  if (input.type === 'set-workspace') return 'workspace';
  if (input.type === 'select-model-spec' || input.type === 'route-model' || input.type === 'set-provider-connection') return 'model';
  if (input.type === 'set-workspace-knowledge') return 'context';
  if (input.type === 'register-personal-connector') return 'context';
  if (input.type === 'set-mcp-trust') return 'skills';
  if (input.type === 'recover-scheduled-jobs') return 'cron';
  if (input.type === 'resume-stream') return 'session';
  if (input.type === 'set-permission') return 'gateway';
  if (input.type === 'skill-lifecycle') return 'skills';
  if (input.type === 'sync-command') return 'session';
  const domain = normalizeDomain(record(input.payload?.domain)?.domain);
  return domain || 'gateway';
}

export function normalizePermissionDecision(value: unknown): 'allow' | 'approval' | 'block' | 'configure' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'allow' || normalized === 'approval' || normalized === 'block' || normalized === 'configure') {
    return normalized;
  }
  return 'approval';
}

export function normalizePermissionScope(value: unknown): 'global' | 'workspace' | 'provider' | 'connector' | 'mcp' | 'skill' {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'global'
    || normalized === 'workspace'
    || normalized === 'provider'
    || normalized === 'connector'
    || normalized === 'mcp'
    || normalized === 'skill'
  ) {
    return normalized;
  }
  return 'global';
}

export function normalizeModelSpecId(value: unknown): ZavorthRuntimeModelSpec['id'] | null {
  const normalized = safeId(value);
  if (
    normalized === 'daily'
    || normalized === 'coding'
    || normalized === 'research'
    || normalized === 'local-private'
    || normalized === 'budget'
  ) {
    return normalized;
  }
  return null;
}

export function normalizeCost(value: unknown): 'low' | 'medium' | 'high' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

export function normalizeRisk(value: unknown): 'low' | 'medium' | 'high' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

export function normalizeKnowledgeKind(value: unknown): 'document' | 'web' | 'email' | 'memory' {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'document' || normalized === 'web' || normalized === 'email' || normalized === 'memory') {
    return normalized;
  }
  return 'document';
}

export function normalizeWorkspaceIsolation(
  value: unknown,
  fallback: ZavorthRuntimeWorkspaceKnowledge['isolation'],
): ZavorthRuntimeWorkspaceKnowledge['isolation'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'chat'
    || normalized === 'runtime-local'
    || normalized === 'folder'
    || normalized === 'project'
    || normalized === 'zavorth-local'
  ) {
    return normalized;
  }
  return fallback;
}

export function normalizePersonalConnectorKind(value: unknown): ZavorthRuntimePersonalConnector['kind'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'calendar' || normalized === 'task') return normalized;
  return 'email';
}

export function normalizePersonalConnectorStatus(value: unknown): ZavorthRuntimePersonalConnector['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'configured' || normalized === 'needs-setup' || normalized === 'blocked') return normalized;
  return 'disabled';
}

export function normalizeProviderConnectionStatus(value: unknown): ZavorthRuntimeProviderConnection['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'configured' || normalized === 'needs-setup' || normalized === 'blocked') return normalized;
  return 'needs-setup';
}

export function normalizeMcpTrustState(value: unknown): ZavorthRuntimeMcpTrustServer['trustState'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'trusted' || normalized === 'review') return normalized;
  return 'blocked';
}

export function normalizeStreamStatus(value: unknown): ZavorthRuntimeStreamSession['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'idle'
    || normalized === 'streaming'
    || normalized === 'resumable'
    || normalized === 'completed'
    || normalized === 'failed'
  ) {
    return normalized;
  }
  return 'idle';
}

export function normalizeSkillHistoryMode(value: unknown): ZavorthRuntimeSkillHistoryEntry['mode'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'manual'
    || normalized === 'always-applied'
    || normalized === 'auto-selected'
    || normalized === 'blocked'
    || normalized === 'approved'
    || normalized === 'executed'
  ) {
    return normalized;
  }
  return 'auto-selected';
}

export function normalizeEffortLevel(value: unknown): string {
  const normalized = clean(value)?.toLowerCase().replace(/_/g, '-');
  if (normalized === 'medium') return 'standard';
  if (normalized === 'ultra' || normalized === 'altissimo' || normalized === 'altissima') return 'ultra-code';
  return normalized || 'standard';
}

export function normalizeWorkspaceKind(value: unknown): ZavorthRuntimeStateWorkspace['kind'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'chat' || normalized === 'folder' || normalized === 'project' || normalized === 'zavorth') {
    return normalized;
  }
  return 'local';
}

export function normalizeConfinement(value: unknown, kind: ZavorthRuntimeStateWorkspace['kind']): ZavorthRuntimeStateWorkspace['confinement'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'none'
    || normalized === 'runtime-local'
    || normalized === 'folder'
    || normalized === 'project'
    || normalized === 'zavorth-local'
  ) {
    return normalized;
  }
  if (kind === 'folder') return 'folder';
  if (kind === 'project') return 'project';
  if (kind === 'zavorth') return 'zavorth-local';
  if (kind === 'chat') return 'none';
  return 'runtime-local';
}

export function normalizeDomain(value: unknown): ZavorthRuntimeStateDomain | null {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'gateway'
    || normalized === 'agents'
    || normalized === 'cron'
    || normalized === 'context'
    || normalized === 'session'
    || normalized === 'skills'
    || normalized === 'model'
    || normalized === 'workspace'
    || normalized === 'effort'
  ) {
    return normalized;
  }
  return null;
}

export function normalizeStatus(value: unknown): ZavorthRuntimeStateStatus {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'offline'
    || normalized === 'ready'
    || normalized === 'running'
    || normalized === 'paused'
    || normalized === 'attention'
    || normalized === 'blocked'
  ) {
    return normalized;
  }
  return 'ready';
}

export function normalizeReceiptStatus(value: unknown): ZavorthRuntimeStateReceiptStatus {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'preview'
    || normalized === 'pending-approval'
    || normalized === 'applied'
    || normalized === 'blocked'
    || normalized === 'failed'
    || normalized === 'noop'
  ) {
    return normalized;
  }
  return 'applied';
}

export function normalizeSkillSource(value: unknown): ZavorthRuntimeStateSkill['source'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'native' || normalized === 'imported' || normalized === 'preview' || normalized === 'review') {
    return normalized;
  }
  return 'unknown';
}

export function normalizeSkillStatus(value: unknown, source: ZavorthRuntimeStateSkill['source']): ZavorthRuntimeStateSkill['status'] {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'available'
    || normalized === 'preview'
    || normalized === 'approved'
    || normalized === 'executing'
    || normalized === 'blocked'
    || normalized === 'quarantined'
  ) {
    return normalized;
  }
  return source === 'imported' ? 'quarantined' : 'available';
}

export function normalizeDomainOperation(value: unknown): 'open' | 'pause' | 'restart' | 'close' | 'sync' | 'approve' | 'reject' | null {
  const normalized = clean(value)?.toLowerCase();
  if (
    normalized === 'open'
    || normalized === 'pause'
    || normalized === 'restart'
    || normalized === 'close'
    || normalized === 'sync'
    || normalized === 'approve'
    || normalized === 'reject'
  ) {
    return normalized;
  }
  return null;
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function safeResolve(value: unknown): string | null {
  const text = clean(value);
  if (!text || /[\0\r\n]/.test(text)) return null;
  return path.resolve(text);
}

export function safeRealPath(value: string): string | null {
  try {
    return fs.realpathSync.native(value);
  } catch (error: unknown) {
    try {
      return fs.realpathSync(value);
    } catch (error: unknown) { logger.warn('[Zavorth Runtime State Bus Utils] operation failed', error); return null; }
  }
}

export function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root).toLowerCase(), path.resolve(candidate).toLowerCase());
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function safeModelId(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function labelFromModelId(value: unknown): string {
  const id = clean(value) || 'zavorth:core';
  if (id === 'zavorth:core') return 'Zavorth Core';
  if (id === 'zavorth:governed') return 'Governed Runtime';
  return formatModelLabel(id.split(':').pop()?.replace(/[-_]+/g, ' ') || id);
}

export function formatModelLabel(value: string): string {
  const normalized = value.trim();
  if (/^gpt\b/i.test(normalized)) {
    return normalized.replace(/^gpt\b/i, 'GPT').replace(/\s+/g, '-');
  }
  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function providerFromModelId(value: unknown): string {
  const id = clean(value) || 'zavorth:core';
  const provider = id.includes(':') ? id.split(':')[0] : 'runtime';
  if (provider === 'zavorth') return 'Zavorth';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'google') return 'Google';
  if (provider === 'local') return 'local';
  return provider;
}

export function safeId(value: unknown): string {
  const text = clean(value);
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function record(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RuntimeRecord : null;
}

export function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

export function redactRecord(value: RuntimeRecord): RuntimeRecord {
  return JSON.parse(redact(JSON.stringify(value))) as RuntimeRecord;
}

export function redact(value: string): string {
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/"((?:token|secret|password|api[_-]?key))"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^,\s"}]+/gi, '$1=[redacted]');
}