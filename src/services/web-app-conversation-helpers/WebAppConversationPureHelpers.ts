import type { NormalizedComposerPayload } from '../ComposerPayloadService.js';
import type { ExecutionEngineId } from '../../contracts/ExecutionEngineContract.js';

type RuntimeRecord = Record<string, unknown>;

export function recordOrNull(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null;
}

export function firstAttachmentText(payload: NormalizedComposerPayload): string | null {
  const attachment = payload.attachments.find((item) => String(item.text || '').trim());
  return attachment ? String(attachment.text || '') : null;
}

export function normalizeExecutionEngineId(value: unknown): ExecutionEngineId | null {
  return value === 'lite' || value === 'velocity' || value === 'shield' ? value : null;
}

export function normalizeProviderName(provider: string): string {
  return String(provider || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function resolveExecutionEngineTargetPath(
  body: RuntimeRecord,
  payload: NormalizedComposerPayload,
): string | null {
  if (typeof body.targetPath === 'string' && body.targetPath.trim()) return body.targetPath;
  for (const attachment of payload.attachments) {
    const record = attachment as unknown as RuntimeRecord;
    const candidate = String(record.localPath || record.path || attachment.name || '').trim();
    if (candidate) return candidate;
  }
  return null;
}

export function resolveComposerEffortLevel(value: unknown): 'low' | 'standard' | 'high' | 'ultra-code' {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (normalized === 'low' || normalized === 'fast' || normalized === 'light') return 'low';
  if (normalized === 'deep' || normalized === 'high' || normalized === 'heavy') return 'high';
  if (normalized === 'ultra' || normalized === 'ultra-code' || normalized === 'max') return 'ultra-code';
  return 'standard';
}
