import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolveToolApprovalSigningKey } from './ApprovalSigningKeyService.js';
import { logger } from '../logger.js';export type ToolSecurityApprovalEnvelope = {
  kind: 'tool-security-approval';
  version: 1;
  approved: true;
  toolName: string;
  argsHash: string;
  issuedAt: string;
  expiresAt: string | null;
  approvalId: string | null;
  approvedBy: string | null;
  signature: string;
};

export type ToolSecurityApprovalVerification = {
  ok: boolean;
  reason: string;
};

const APPROVAL_METADATA_KEYS = new Set([
  'approval',
  'approved',
  'confirmed',
  'securityApproval',
  'securityApprovalSignature',
  'securityConfirmed',
  'userConfirmed',
]);

export function createToolSecurityApprovalEnvelope(input: {
  toolName: string;
  args: unknown;
  approvalId?: string | null;
  approvedBy?: string | null;
  ttlMs?: number | null;
  now?: Date;
}): ToolSecurityApprovalEnvelope {
  const now = input.now || new Date();
  const ttlMs = input.ttlMs === undefined ? 5 * 60 * 1000 : input.ttlMs;
  const unsigned = {
    kind: 'tool-security-approval' as const,
    version: 1 as const,
    approved: true as const,
    toolName: normalizeToolName(input.toolName),
    argsHash: hashToolApprovalArgs(input.toolName, input.args),
    issuedAt: now.toISOString(),
    expiresAt: ttlMs && ttlMs > 0 ? new Date(now.getTime() + ttlMs).toISOString() : null,
    approvalId: normalizeNullable(input.approvalId),
    approvedBy: normalizeNullable(input.approvedBy),
  };

  return {
    ...unsigned,
    signature: signApprovalPayload(unsigned),
  };
}

export function verifyToolSecurityApprovalEnvelope(input: {
  toolName: string;
  args: unknown;
  envelope: unknown;
  now?: Date;
}): ToolSecurityApprovalVerification {
  const envelope = readApprovalEnvelope(input.envelope);
  if (!envelope) {
    return { ok: false, reason: 'missing-or-invalid-approval-envelope' };
  }
  if (envelope.toolName !== normalizeToolName(input.toolName)) {
    return { ok: false, reason: 'approval-tool-mismatch' };
  }
  if (envelope.argsHash !== hashToolApprovalArgs(input.toolName, input.args)) {
    return { ok: false, reason: 'approval-args-mismatch' };
  }
  if (envelope.expiresAt) {
    const now = input.now || new Date();
    const expiresAt = Date.parse(envelope.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt < now.getTime()) {
      return { ok: false, reason: 'approval-expired' };
    }
  }

  const { signature, ...unsigned } = envelope;
  const expected = signApprovalPayload(unsigned);
  if (!safeEqualHex(signature, expected)) {
    return { ok: false, reason: 'approval-signature-invalid' };
  }

  return { ok: true, reason: 'approval-verified' };
}

export function extractToolSecurityApprovalEnvelope(
  args: Record<string, unknown>,
  metadata: Record<string, unknown>,
): unknown {
  return metadata.securityApproval || metadata.approval || args.securityApproval || args.approval || null;
}

export function hashToolApprovalArgs(toolName: string, args: unknown): string {
  return createHmac('sha256', signingKey())
    .update(normalizeToolName(toolName))
    .update('\n')
    .update(stableStringify(stripApprovalMetadata(args)))
    .digest('hex');
}

function readApprovalEnvelope(value: unknown): ToolSecurityApprovalEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.kind !== 'tool-security-approval'
    || record.version !== 1
    || record.approved !== true
    || typeof record.toolName !== 'string'
    || typeof record.argsHash !== 'string'
    || typeof record.issuedAt !== 'string'
    || typeof record.signature !== 'string'
  ) {
    return null;
  }

  return {
    kind: 'tool-security-approval',
    version: 1,
    approved: true,
    toolName: normalizeToolName(record.toolName),
    argsHash: record.argsHash,
    issuedAt: record.issuedAt,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : null,
    approvalId: normalizeNullable(record.approvalId),
    approvedBy: normalizeNullable(record.approvedBy),
    signature: record.signature,
  };
}

function stripApprovalMetadata(value: unknown, seen = new WeakSet<object>()): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => stripApprovalMetadata(entry, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (APPROVAL_METADATA_KEYS.has(key)) {
      continue;
    }
    const stripped = stripApprovalMetadata(entry, seen);
    if (key === 'metadata' && isEmptyRecord(stripped)) {
      continue;
    }
    output[key] = stripped;
  }
  return output;
}

function signApprovalPayload(payload: Omit<ToolSecurityApprovalEnvelope, 'signature'>): string {
  return createHmac('sha256', signingKey())
    .update(stableStringify(payload))
    .digest('hex');
}

function signingKey(): string {
  return resolveToolApprovalSigningKey();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableStringify(record[key])}`,
  ).join(',')}}`;
}

function normalizeToolName(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function isEmptyRecord(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  } catch (error: unknown) {logger.warn('[Approval Envelope] operation failed', error); return false; }
}
