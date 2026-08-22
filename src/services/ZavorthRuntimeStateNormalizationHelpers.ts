import fs from 'node:fs';
import path from 'node:path';
import {
  type ZavorthRuntimeStateBusActionInput,
  type ZavorthRuntimeMcpTrustServer,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimePersonalConnector,
  type ZavorthRuntimeProviderConnection,
  type ZavorthRuntimeSkillHistoryEntry,
  type ZavorthRuntimeStreamSession,
  type ZavorthRuntimeWorkspaceKnowledge,
  type ZavorthRuntimeStateDomain,
  type ZavorthRuntimeStateReceipt,
  type ZavorthRuntimeStateReceiptStatus,
  type ZavorthRuntimeStateSkill,
  type ZavorthRuntimeStateStatus,
  type ZavorthRuntimeStateWorkspace,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import { logger } from '../logger.js';

type RuntimeRecord = Record<string, unknown>;

export function normalizeModelSpecId(value: unknown): ZavorthRuntimeModelSpec['id'] | null {
  const normalized = safeId(value);
  if (normalized === 'daily' || normalized === 'coding' || normalized === 'research' || normalized === 'local-private' || normalized === 'budget') {
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

export function normalizeWorkspaceIsolation(value: unknown, fallback: ZavorthRuntimeWorkspaceKnowledge['isolation']): ZavorthRuntimeWorkspaceKnowledge['isolation'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'chat' || normalized === 'runtime-local' || normalized === 'folder' || normalized === 'project' || normalized === 'zavorth-local') {
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
  if (normalized === 'idle' || normalized === 'streaming' || normalized === 'resumable' || normalized === 'completed' || normalized === 'failed') {
    return normalized;
  }
  return 'idle';
}

export function normalizeSkillHistoryMode(value: unknown): ZavorthRuntimeSkillHistoryEntry['mode'] {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'manual' || normalized === 'always-applied' || normalized === 'auto-selected' || normalized === 'blocked' || normalized === 'approved' || normalized === 'executed') {
    return normalized;
  }
  return 'auto-selected';
}

export function skillHistoryModeFor(status: ZavorthRuntimeStateSkill['status']): ZavorthRuntimeSkillHistoryEntry['mode'] {
  if (status === 'approved') return 'approved';
  if (status === 'executing') return 'executed';
  if (status === 'blocked' || status === 'quarantined') return 'blocked';
  if (status === 'preview') return 'manual';
  return 'auto-selected';
}

export function upsertProviderConnection(entries: ZavorthRuntimeProviderConnection[], entry: ZavorthRuntimeProviderConnection): ZavorthRuntimeProviderConnection[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 30);
}

export function upsertPersonalConnector(entries: ZavorthRuntimePersonalConnector[], entry: ZavorthRuntimePersonalConnector): ZavorthRuntimePersonalConnector[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 20);
}

export function upsertMcpTrustServer(entries: ZavorthRuntimeMcpTrustServer[], entry: ZavorthRuntimeMcpTrustServer): ZavorthRuntimeMcpTrustServer[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 40);
}

export function upsertSkillHistory(entries: ZavorthRuntimeSkillHistoryEntry[], entry: ZavorthRuntimeSkillHistoryEntry): ZavorthRuntimeSkillHistoryEntry[] {
  return [entry, ...entries.filter((candidate) => candidate.id !== entry.id)].slice(0, 80);
}

export function evaluateNetworkTarget(
  providerId: string,
  targetUrl: string | null,
): {
  ok: boolean;
  targetHost: string | null;
  localLoopback: boolean;
} {
  if (!targetUrl) {
    return { ok: true, targetHost: null, localLoopback: false };
  }
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const localLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (localLoopback) {
      return {
        ok: isLocalProviderId(providerId),
        targetHost: host,
        localLoopback: true,
      };
    }
    if (host === '169.254.169.254' || host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local')) {
      return { ok: false, targetHost: host, localLoopback: false };
    }
    return { ok: true, targetHost: host, localLoopback: false };
  } catch (error: unknown) {
    logger.warn('[Zavorth Runtime State Bus] lifecycle operation failed', error);
    return { ok: false, targetHost: null, localLoopback: false };
  }
}

export function isLocalProviderId(providerId: string): boolean {
  return /^(ollama|lm-studio|lmstudio|vllm|local|aigateway|custom)/i.test(providerId);
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
  if (normalized === 'none' || normalized === 'runtime-local' || normalized === 'folder' || normalized === 'project' || normalized === 'zavorth-local') {
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
    normalized === 'gateway' ||
    normalized === 'agents' ||
    normalized === 'cron' ||
    normalized === 'context' ||
    normalized === 'session' ||
    normalized === 'skills' ||
    normalized === 'model' ||
    normalized === 'workspace' ||
    normalized === 'effort'
  ) {
    return normalized;
  }
  return null;
}

export function normalizeStatus(value: unknown): ZavorthRuntimeStateStatus {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'offline' || normalized === 'ready' || normalized === 'running' || normalized === 'paused' || normalized === 'attention' || normalized === 'blocked') {
    return normalized;
  }
  return 'ready';
}

export function normalizeReceiptStatus(value: unknown): ZavorthRuntimeStateReceiptStatus {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'preview' || normalized === 'pending-approval' || normalized === 'applied' || normalized === 'blocked' || normalized === 'failed' || normalized === 'noop') {
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
  if (normalized === 'available' || normalized === 'preview' || normalized === 'approved' || normalized === 'executing' || normalized === 'blocked' || normalized === 'quarantined') {
    return normalized;
  }
  return source === 'imported' ? 'quarantined' : 'available';
}

export function normalizeDomainOperation(value: unknown): 'open' | 'pause' | 'restart' | 'close' | 'sync' | 'approve' | 'reject' | null {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === 'open' || normalized === 'pause' || normalized === 'restart' || normalized === 'close' || normalized === 'sync' || normalized === 'approve' || normalized === 'reject') {
    return normalized;
  }
  return null;
}

export function statusForDomainOperation(operation: NonNullable<ReturnType<typeof normalizeDomainOperation>>): ZavorthRuntimeStateStatus {
  if (operation === 'pause') return 'paused';
  if (operation === 'restart') return 'running';
  if (operation === 'close') return 'offline';
  return 'ready';
}

export function summaryForDomainOperation(domain: ZavorthRuntimeStateDomain, operation: NonNullable<ReturnType<typeof normalizeDomainOperation>>): string {
  if (operation === 'open') return `${domain} surface opened through runtime state bus.`;
  if (operation === 'pause') return `${domain} plane paused with receipt.`;
  if (operation === 'restart') return `${domain} plane restart requested with receipt.`;
  if (operation === 'close') return `${domain} plane closed with receipt.`;
  if (operation === 'approve') return `${domain} lifecycle approval recorded.`;
  if (operation === 'reject') return `${domain} lifecycle rejection recorded.`;
  return `${domain} plane synchronized.`;
}

export function receiptPhaseFor(input: ZavorthRuntimeStateBusActionInput, status: ZavorthRuntimeStateReceiptStatus): ZavorthRuntimeStateReceipt['phase'] {
  const requestedPhase = clean(record(input.payload?.metadata)?.phase);
  if (requestedPhase === 'preview' || requestedPhase === 'approval' || requestedPhase === 'execution' || requestedPhase === 'receipt' || requestedPhase === 'learning') {
    return requestedPhase;
  }
  if (status === 'pending-approval') return 'approval';
  if (status === 'preview') return 'preview';
  return 'receipt';
}

export function upsertSkill(skills: ZavorthRuntimeStateSkill[], skill: ZavorthRuntimeStateSkill): ZavorthRuntimeStateSkill[] {
  const next = skills.filter((entry) => entry.id !== skill.id);
  next.unshift(skill);
  return next.slice(0, 30);
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

export function normalizeConnectedModelIds(value: unknown, selectedModelId?: string | null): string[] {
  const values = Array.isArray(value) ? value.map((entry) => safeModelId(entry)).filter((entry): entry is string => Boolean(entry)) : [];
  if (selectedModelId && values.includes(selectedModelId)) {
    return uniqueStrings(values);
  }
  return uniqueStrings(values);
}

export function safeResolve(value: unknown): string | null {
  const text = clean(value);
  if (!text || /[\0\r\n]/.test(text)) return null;
  return path.resolve(text);
}

export function safeRealPath(value: string): string | null {
  try {
    return fs.realpathSync.native(value);
  } catch {
    try {
      return fs.realpathSync(value);
    } catch (error: unknown) {
      logger.warn('[Zavorth Runtime State Bus] operation failed', error);
      return null;
    }
  }
}

export function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root).toLowerCase(), path.resolve(candidate).toLowerCase());
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function safeModelId(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  return text
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function record(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null;
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
