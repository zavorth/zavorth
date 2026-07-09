import { createHash } from 'crypto';
import * as path from 'path';
import {
  firstArg,
  readFlag,
  readNumberFlag,
  stateDir,
  readArray,
  writeJson,
  idWithTime,
  render
} from '../ZavorthCliSharedHelpers.js';
import { logger } from '../../logger.js';
import {
type ChannelAdapter,
  type JsonObject,
  resolveChannelAdapter,
  mergeDirectoryEntries
} from './ZavorthCliMessageAdapters.js';function redact(value: string): string {
  return value ? '***' : '';
}

export function redactPairingRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.code) item.code = redact(String(item.code));
  if (item.codeHash) item.codeHash = '***';
  if (item.uri) item.uri = String(item.uri).replace(/code=[^&]+/u, 'code=***');
  return item;
}

function hashPairingCode(code: string): string {
  return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

function pairingExpired(pairing: JsonObject): boolean {
  const expiresAt = Date.parse(String(pairing.expiresAt || ''));
  return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

async function renderTerminalQr(value: string): Promise<string> {
  try {
    const loader = Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default?: { toString?: unknown }; toString?: unknown }>;
    const module = await loader('qrcode');
    const toString = (module.toString || module.default?.toString) as ((text: string, options: JsonObject) => Promise<string>) | undefined;
    if (!toString) return '';
    return (await toString(value, { type: 'terminal', small: true, margin: 1 })).trim();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Message Pairing] load operation failed', error); return ''; }
}

export async function createPairingDraft(root: string, input: { channel: string; target: string; label: string; ttlMinutes: number }): Promise<JsonObject> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString();
  const code = createHash('sha256').update(`${root}:${input.channel}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 10).toUpperCase();
  const id = idWithTime('pairing');
  const uri = `zavorth://pair?pairing=${encodeURIComponent(id)}&channel=${encodeURIComponent(input.channel)}&code=${encodeURIComponent(code)}`;
  const record = {
    id,
    channel: resolveChannelAdapter(input.channel).id,
    target: input.target || null,
    label: input.label,
    status: 'pending',
    code,
    codeHash: hashPairingCode(code),
    uri,
    createdAt: now.toISOString(),
    expiresAt,
    ttlMinutes: input.ttlMinutes,
  };
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  const { code: _code, uri: _uri, ...storedRecord } = record;
  pairings.push(storedRecord);
  await writeJson(file, pairings);
  return record;
}

export async function runPairing(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const file = path.join(stateDir(root), 'pairings.json');
  const pairings = await readArray(file);
  if (action === 'create' || action === 'new') {
    const channel = readFlag(args, 'channel') || 'telegram';
    const target = readFlag(args, 'target') || '';
    const label = readFlag(args, 'label') || 'unspecified-pairing';
    const ttlMinutes = Number(readFlag(args, 'ttl') || '15');
    const draft = await createPairingDraft(root, { channel, target, label, ttlMinutes: Number.isFinite(ttlMinutes) ? ttlMinutes : 15 });
    const qr = await renderTerminalQr(String(draft.uri));
    return render(args, 'Zavorth pairing create', [
      `Pairing uri: ${String(draft.uri)}`,
      `Code: ${String(draft.code)}`,
      `Expires: ${String(draft.expiresAt)}`,
      qr ? `\nQR Code:\n${qr}\n` : 'QR Code generation bypassed or failed.',
    ], { pairing: redactPairingRecord(draft) });
  }
  if (action === 'prove' || action === 'accept') {
    const code = String(args[1] || readFlag(args, 'code') || '').trim();
    if (!code) return render(args, 'Zavorth pairing prove', ['Missing pairing code. Usage: zavorth pairing prove <CODE>'], { ok: false });
    const hash = hashPairingCode(code);
    const active = pairings.find((entry) => {
      const item = entry as JsonObject;
      return String(item.codeHash) === hash && String(item.status) === 'pending' && !pairingExpired(item);
    }) as JsonObject | undefined;
    if (!active) {
      return render(args, 'Zavorth pairing prove', ['Invalid, expired or already completed pairing code.'], { ok: false });
    }
    active.status = 'completed';
    active.completedAt = new Date().toISOString();
    active.authenticatedBy = 'cli-operator';
    await writeJson(file, pairings);
    const directoryFile = path.join(stateDir(root), 'directory.json');
    const existingDir = await readArray(directoryFile);
    if (active.target) {
      const dirEntry = {
        id: idWithTime('directory'),
        channel: String(active.channel),
        externalId: String(active.target),
        label: String(active.label),
        kind: 'peer' as const,
        source: `pairing:${String(active.id)}`,
        syncedAt: new Date().toISOString(),
      };
      await writeJson(directoryFile, mergeDirectoryEntries(existingDir, [dirEntry]));
    }
    return render(args, 'Zavorth pairing prove', [`Pairing completed successfully: ${String(active.id)}`], { pairing: redactPairingRecord(active) });
  }
  return render(args, 'Zavorth pairing list', pairings.length ? pairings.map((pairing) => {
    const item = pairing as JsonObject;
    const expired = pairingExpired(item);
    return `- ${String(item.id)} | ${String(item.channel)} | ${String(item.status)}${expired && item.status === 'pending' ? ' (expired)' : ''}`;
  }) : ['No pairings created yet.'], { pairings: pairings.map(redactPairingRecord) });
}

export async function runQr(root: string, args: string[]) {
  const action = firstArg(args, 'pairing');
  if (action === 'status') {
    const pairings = await readArray(path.join(stateDir(root), 'pairings.json'));
    const active = pairings.filter((item) => String((item as JsonObject).status) === 'pending');
    return render(args, 'Zavorth qr', [
      `pending pairing QR payloads: ${active.length}`,
      'Run: zavorth qr pairing --channel telegram',
    ], { pending: active.length, pairings: active.map(redactPairingRecord) });
  }
  const channel = readFlag(args, 'channel') || 'device';
  const draft = await createPairingDraft(root, {
    channel,
    target: readFlag(args, 'target') || '',
    label: args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || `${channel} pairing`,
    ttlMinutes: readNumberFlag(args, 'ttl-minutes') || 15,
  });
  const qr = await renderTerminalQr(String(draft.uri));
  return render(args, 'Zavorth qr', [
    `Pairing id: ${draft.id}`,
    `Pairing code: ${draft.code}`,
    `Expires: ${draft.expiresAt}`,
    `URI: ${draft.uri}`,
    qr || 'QR rendering is unavailable; use the URI above.',
    'Share only with the operator/device you are pairing.',
  ], { record: redactPairingRecord(draft), qrRendered: Boolean(qr) });
}
