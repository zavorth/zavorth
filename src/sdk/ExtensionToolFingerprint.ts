import crypto from 'crypto';
import type { CustomToolDescriptor } from './CustomToolDescriptor.js';

export function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalStringify((val as Record<string, unknown>)[k]),
  );
  return '{' + parts.join(',') + '}';
}

export function computeToolFingerprint(descriptor: CustomToolDescriptor): string {
  const namespace = String(descriptor.namespace || '').trim().toLowerCase();
  const name = String(descriptor.name || '').trim().toLowerCase();
  const riskClass = String(descriptor.riskClass || 'unknown').toLowerCase();
  const capabilities = [...(descriptor.capabilities || [])].sort();

  const payload = {
    namespace,
    name,
    inputSchema: descriptor.inputSchema,
    capabilities,
    riskClass,
  };

  const canonicalString = canonicalStringify(payload);
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}
