import type { CapabilityOperation, CapabilityScope } from './CapabilityScope.js';
import { capabilityAllowsResource } from './CapabilityScope.js';
import type { ResourceRef } from '../effects/EffectScope.js';

export type CapabilityToken = {
  kind: 'capability-token';
  version: 1;
  tokenId: string;
  subject: string;
  issuedAt: string;
  expiresAt: string | null;
  scopes: CapabilityScope[];
  metadata?: Record<string, unknown>;
};

export type CapabilityTokenVerification = {
  ok: boolean;
  reason: string;
};

export function createCapabilityToken(input: {
  tokenId: string;
  subject: string;
  scopes: CapabilityScope[];
  issuedAt?: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}): CapabilityToken {
  return {
    kind: 'capability-token',
    version: 1,
    tokenId: String(input.tokenId || '').trim(),
    subject: String(input.subject || '').trim(),
    issuedAt: input.issuedAt || new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    scopes: input.scopes,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function verifyCapabilityTokenTime(
  token: CapabilityToken,
  now: Date = new Date(),
): CapabilityTokenVerification {
  if (!token.tokenId) {
    return { ok: false, reason: 'capability-token-id-required' };
  }
  if (!token.subject) {
    return { ok: false, reason: 'capability-token-subject-required' };
  }
  if (token.expiresAt) {
    const expiresAt = Date.parse(token.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      return { ok: false, reason: 'capability-token-expiry-invalid' };
    }
    if (expiresAt < now.getTime()) {
      return { ok: false, reason: 'capability-token-expired' };
    }
  }
  return { ok: true, reason: 'capability-token-time-valid' };
}

export function capabilityTokenAllows(
  token: CapabilityToken,
  operation: CapabilityOperation,
  resource: ResourceRef,
): boolean {
  return token.scopes.some((scope) => capabilityAllowsResource(scope, operation, resource));
}
