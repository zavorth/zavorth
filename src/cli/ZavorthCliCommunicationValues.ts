import * as path from 'path';
import { logger } from '../logger.js';

type JsonObject = Record<string, unknown>;

export function getPath(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as JsonObject)[part] : undefined), obj);
}

export function setPath(obj: JsonObject, key: string, value: unknown): void {
  const parts = key.split('.');
  let cursor = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as JsonObject;
  }
  cursor[parts.at(-1) || key] = value;
}

export function unsetPath(obj: JsonObject, key: string): void {
  const parts = key.split('.');
  let cursor: JsonObject | undefined = obj;
  for (const part of parts.slice(0, -1)) {
    const next: unknown = cursor[part];
    cursor = next && typeof next === 'object' ? (next as JsonObject) : undefined;
    if (!cursor) return;
  }
  delete cursor[parts.at(-1) || key];
}

export function redact(value: string): string {
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|key|secret|auth|sig/iu.test(key)) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch (error: unknown) {
    logger.warn('[Zavorth Cli Live Namespaces] search failed', error);
    return redact(value);
  }
}

export function sanitizeMessageRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.message) item.message = redact(String(item.message));
  if (Array.isArray(item.attachments)) item.attachments = item.attachments.map((entry) => path.basename(String(entry)));
  if (item.delivery && typeof item.delivery === 'object') item.delivery = sanitizeDelivery(item.delivery as JsonObject);
  return item;
}

export function sanitizeDelivery(value: JsonObject): JsonObject {
  const copy = { ...value };
  if (Array.isArray(copy.receipts)) {
    copy.receipts = copy.receipts.map((receipt) => {
      const item = { ...((receipt || {}) as JsonObject) };
      if (item.target) item.target = redact(String(item.target));
      return item;
    });
  }
  return copy;
}

export function formatMessageReceipt(value: unknown): string {
  const item = value as JsonObject;
  return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)} | targets ${Array.isArray(item.targets) ? item.targets.length : 0}`;
}
