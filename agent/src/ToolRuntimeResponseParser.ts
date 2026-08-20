import { randomUUID } from 'node:crypto';
import {
  EchoClientApiNamespace,
  EchoAgentCorrelation,
  EchoAgentRunContext,
  EchoAgentHistoryEntry,
  EchoAgentPermission,
  EchoAgentPhysicalEvent,
  EchoAgentToolState,
  EchoAgentCapabilityLifecycle,
  EchoAgentCapabilityArtifact,
  EchoAgentCapabilityPolicy
} from './EchoTypes.js';

export function createAgentSessionId(): string {
  return `agent-${randomUUID().slice(0, 8)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeApiNamespace(value: unknown): EchoClientApiNamespace {
  return normalizeText(value).toLowerCase() === 'nexus' ? 'nexus' : 'echo';
}

export function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter((entry) => entry.length > 0)
    : [];
}

export function toNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function readCorrelation(value: unknown): EchoAgentCorrelation | null {
  if (!isRecord(value)) {
    return null;
  }
  const traceId = normalizeText(value.traceId);
  const runId = normalizeText(value.runId);
  if (!traceId || !runId) {
    return null;
  }
  return {
    traceId,
    runId,
    sessionId: normalizeNullableText(value.sessionId),
    approvalId: normalizeNullableText(value.approvalId),
    artifactId: normalizeNullableText(value.artifactId),
  };
}

export function readRunContext(value: unknown): EchoAgentRunContext | null {
  if (!isRecord(value)) {
    return null;
  }
  const traceId = normalizeText(value.traceId);
  const runId = normalizeText(value.runId);
  const surface = normalizeText(value.surface);
  const requestedBy = normalizeText(value.requestedBy);
  if (!traceId || !runId || !surface || !requestedBy) {
    return null;
  }
  return {
    traceId,
    runId,
    sessionId: normalizeNullableText(value.sessionId),
    surface,
    requestedBy,
    profile: normalizeNullableText(value.profile),
  };
}

export function readHistoryEntry(value: unknown): EchoAgentHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const correlation = readCorrelation(value.correlation);
  const runContext = readRunContext(value.runContext);
  return {
    id,
    timestamp: normalizeNullableText(value.timestamp),
    prompt: normalizeText(value.prompt),
    status: normalizeText(value.status) || 'unknown',
    finalResponse: normalizeText(value.finalResponse),
    durationMs: toNumber(value.durationMs),
    toolsUsed: readToolsUsed(value.toolCalls, metadata.toolsExecuted),
    toolStates: readToolStates(value.toolCalls),
    correlation,
    runContext,
    traceId: correlation?.traceId || runContext?.traceId || null,
    runId: correlation?.runId || runContext?.runId || null,
  };
}

export function readPermission(value: unknown): EchoAgentPermission | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  if (!id) {
    return null;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const correlation = readCorrelation(metadata.correlation);
  const runContext = readRunContext(metadata.runContext);
  return {
    id,
    action: normalizeText(value.action),
    resource: normalizeNullableText(value.resource),
    reason: normalizeText(value.reason),
    status: normalizeText(value.status) || 'pending',
    requestedAt: normalizeNullableText(value.requestedAt),
    kind: normalizeNullableText(metadata.kind),
    toolName: normalizeNullableText(metadata.toolName),
    category: normalizeNullableText(metadata.category),
    surface: normalizeNullableText(metadata.surface) || runContext?.surface || null,
    requestedBy: normalizeNullableText(metadata.requestedBy) || runContext?.requestedBy || null,
    approvalId: correlation?.approvalId || id,
    correlation,
    runContext,
  };
}

export function readToolsUsed(toolCalls: unknown, metadataTools: unknown): string[] {
  const fromMetadata = toStringArray(metadataTools);
  if (fromMetadata.length > 0) {
    return fromMetadata;
  }
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .map((entry) => isRecord(entry) ? normalizeText(entry.toolName) : '')
    .filter((entry) => entry.length > 0);
}

export function readToolStates(toolCalls: unknown): EchoAgentToolState[] {
  if (!Array.isArray(toolCalls)) {
    return [];
  }
  return toolCalls
    .map((entry) => readToolState(entry))
    .filter((entry): entry is EchoAgentToolState => Boolean(entry));
}

export function readToolState(value: unknown): EchoAgentToolState | null {
  if (!isRecord(value)) {
    return null;
  }
  const toolName = normalizeText(value.toolName);
  if (!toolName) {
    return null;
  }
  return {
    toolName,
    securityDecision: normalizeText(value.securityDecision) || 'unknown',
    lifecycle: readLifecycle(value.lifecycle),
    artifact: readArtifact(value.artifact),
    policy: readPolicy(value.policy),
  };
}

export function readLifecycle(value: unknown): EchoAgentCapabilityLifecycle | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    mode: normalizeNullableText(value.mode),
    status: normalizeNullableText(value.status),
    details: cloneRecord(value),
  };
}

export function readArtifact(value: unknown): EchoAgentCapabilityArtifact | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    id: normalizeNullableText(value.id),
    kind: normalizeNullableText(value.kind),
    source: normalizeNullableText(value.source),
    details: cloneRecord(value),
  };
}

export function readPolicy(value: unknown): EchoAgentCapabilityPolicy | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    scope: normalizeNullableText(value.scope),
    details: cloneRecord(value),
  };
}

export function readPhysicalEvents(value: unknown): EchoAgentPhysicalEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readPhysicalEvent(entry))
    .filter((entry): entry is EchoAgentPhysicalEvent => Boolean(entry));
}

export function readPhysicalEvent(value: unknown): EchoAgentPhysicalEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = normalizeText(value.id);
  const entityId = normalizeText(value.entityId);
  const newState = normalizeText(value.newState);
  const feedback = normalizeText(value.feedback);
  if (!id || !entityId || !newState || !feedback) {
    return null;
  }
  const severity = normalizeText(value.severity).toLowerCase();
  return {
    id,
    source: normalizeText(value.source) || 'iot',
    timestamp: normalizeNullableText(value.timestamp),
    entityId,
    oldState: normalizeNullableText(value.oldState),
    newState,
    feedback,
    severity: severity === 'critical' || severity === 'warn' ? severity : 'info',
  };
}

export function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
