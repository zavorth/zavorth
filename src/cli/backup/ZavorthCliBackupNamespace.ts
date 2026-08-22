import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';
import {
  firstArg,
  readFlag,
  readFlags,
  stateDir,
  readJson,
  writeJson,
  appendJsonArray,
  idWithTime,
  render,
  ensureDir,
  walkFiles,
  listAnyFiles,
  isInside,
  sha256,
  escapeRegex
} from '../ZavorthCliSharedHelpers.js';
import { idFromSpec } from '../ZavorthCliLiveNamespaces.js';

import type { JsonObject } from '../ZavorthCliSharedHelpers.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function runBackup(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const dir = path.join(stateDir(root), 'backups');
  await ensureDir(dir);
  if (action === 'create') {
    const id = idWithTime('backup');
    const archiveFiles = await collectBackupFiles(root, args);
    const manifest: JsonObject = {
      id,
      version: 2,
      createdAt: new Date().toISOString(),
      root,
      format: 'zavorth-backup/v2',
      scope: args.includes('--full') ? 'full-state' : 'core-state',
      files: archiveFiles,
    };
    const payload = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    const encrypted = args.includes('--encrypt');
    const archive = path.join(dir, `${id}.${encrypted ? 'zavbak.enc' : 'zavbak.gz'}`);
    const archiveBytes = encrypted ? encryptBackupPayload(payload, readBackupPassphrase(args)) : await gzipAsync(payload);
    await fs.writeFile(archive, archiveBytes);
    const sidecar = backupSidecar(manifest, archive, encrypted);
    await writeJson(path.join(dir, `${id}.json`), sidecar);
    return render(args, 'Zavorth backup', [
      `Created archive: ${archive}`,
      `Tracked files: ${archiveFiles.filter((file) => file.exists).length}`,
      `Mode: ${encrypted ? 'encrypted' : 'compressed'}`,
      `Scope: ${String(manifest.scope)}`,
    ], sidecar);
  }
  const files = (await listAnyFiles(dir)).filter((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc') || file.endsWith('.json')).map((file) => path.basename(file)).sort();
  if (action === 'verify') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc') || arg.endsWith('.json')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || files.at(-1);
    if (!target) return render(args, 'Zavorth backup', ['No backup manifest found. Run: zavorth backup create'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args);
    const verification = verifyBackupManifest(manifest);
    return render(args, 'Zavorth backup', [
      `Verified manifest: ${String((manifest as JsonObject).id || target)}`,
      `Format: ${String((manifest as JsonObject).format || 'unknown')}`,
      `Files: ${String(verification.files)}`,
      `Checksums: ${verification.ok ? 'valid' : 'invalid'}`,
      ...verification.errors,
    ], { ok: verification.ok, manifest: backupSidecar(manifest as JsonObject, targetPath, targetPath.endsWith('.enc')), verification });
  }
  if (action === 'restore') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || '';
    if (!target) return render(args, 'Zavorth backup', ['No backup archive found. Run: zavorth backup create'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args) as { files?: Array<JsonObject> };
    const restorable = selectBackupFiles((manifest.files || []).filter((file) => Boolean(file.exists && file.contentBase64)), args);
    const safeRestorable = args.includes('--include-secrets')
      ? restorable
      : restorable.filter((file) => !String(file.file).includes('.env'));
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth backup', [
        'Restore preview only. Add --yes to write files.',
        'Secrets are excluded unless --include-secrets is provided.',
        ...safeRestorable.map((file) => `- ${String(file.file)} (${String(file.bytes || 0)} bytes)`),
      ], { dryRun: true, files: safeRestorable.map(({ contentBase64: _contentBase64, ...file }) => file) });
    }
    for (const file of safeRestorable) {
      const relative = String(file.file);
      const destination = path.resolve(root, relative);
      if (!isInside(root, destination)) continue;
      await ensureDir(path.dirname(destination));
      await fs.writeFile(destination, Buffer.from(String(file.contentBase64), 'base64'));
    }
    return render(args, 'Zavorth backup', [`Restored files: ${safeRestorable.length}`], { restored: safeRestorable.map((file) => file.file) });
  }
  if (action === 'migrate') {
    const target = args.find((arg) => arg.endsWith('.zavbak.gz') || arg.endsWith('.zavbak.enc')) || files.find((file) => file.endsWith('.zavbak.gz') || file.endsWith('.zavbak.enc')) || '';
    if (!target) return render(args, 'Zavorth backup migrate', ['No backup archive found.'], { ok: false });
    const targetPath = path.isAbsolute(target) ? target : path.join(dir, target);
    const manifest = await loadBackupArchive(targetPath, args) as JsonObject;
    const migrated = migrateBackupManifest(manifest, Number(readFlag(args, 'to-version') || 2));
    if (!args.includes('--yes')) return render(args, 'Zavorth backup migrate', ['Migration preview only. Add --yes to write a migrated archive.', `From: ${String(manifest.version || 1)}`, `To: ${String(migrated.version)}`], { dryRun: true, migrated: backupSidecar(migrated, '', false) });
    const id = idWithTime('backup-migrated');
    const archive = path.join(dir, `${id}.zavbak.gz`);
    await fs.writeFile(archive, await gzipAsync(Buffer.from(JSON.stringify(migrated, null, 2), 'utf8')));
    await writeJson(path.join(dir, `${id}.json`), backupSidecar(migrated, archive, false));
    return render(args, 'Zavorth backup migrate', [`Migrated archive: ${archive}`], backupSidecar(migrated, archive, false));
  }
  if (action === 'import') {
    const source = readFlag(args, 'source') || args[1] || '';
    if (!source || !existsSync(source)) return render(args, 'Zavorth backup import', [`Import source not found: ${source || '<missing>'}`], { ok: false });
    const imported = await importAgentState(root, source, args);
    if (!args.includes('--yes')) return render(args, 'Zavorth backup import', ['Import preview only. Add --yes to write mapped state.', ...imported.lines], { dryRun: true, mapped: imported.mapped });
    for (const file of imported.files) {
      await ensureDir(path.dirname(file.destination));
      await fs.writeFile(file.destination, file.content);
    }
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'backup-imports.json'), { id: idWithTime('backup-import'), source, agent: readFlag(args, 'agent') || 'generic', createdAt: new Date().toISOString(), files: imported.files.map((file) => path.relative(root, file.destination)) });
    return render(args, 'Zavorth backup import', ['Imported mapped agent state.', ...imported.lines], { imported: imported.files.map((file) => path.relative(root, file.destination)) });
  }
  return render(args, 'Zavorth backup', files.length ? files.map((file) => `- ${file}`) : ['No backups yet. Run: zavorth backup create'], { backups: files });
}

async function collectBackupFiles(root: string, args: string[]): Promise<JsonObject[]> {
  const defaults = ['package.json', 'package-lock.json', '.env', '.env.local', '.zavorth/cli-config.json', '.zavorth/mcp.json', '.zavorth/plugins.json', '.zavorth/tasks.json', '.zavorth/sessions.json'];
  const stateFiles = args.includes('--full')
    ? (await walkFiles(stateDir(root), 2000)).filter((file) => !file.includes(`${path.sep}backups${path.sep}`)).map((file) => path.relative(root, file))
    : [];
  const requested = readFlags(args, 'include').concat(readFlags(args, 'file'));
  const files = Array.from(new Set([...defaults, ...stateFiles, ...requested])).filter(Boolean);
  return Promise.all(files.map(async (file) => {
    const absolute = path.resolve(root, file);
    if (!isInside(root, absolute) || !existsSync(absolute)) return { file, exists: false };
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return { file, exists: false };
    const raw = await fs.readFile(absolute);
    return { file: path.relative(root, absolute), exists: true, bytes: raw.byteLength, sha256: sha256(raw), contentBase64: raw.toString('base64') };
  }));
}

function backupSidecar(manifest: JsonObject, archive: string, encrypted: boolean): JsonObject {
  const files = Array.isArray(manifest.files) ? manifest.files as JsonObject[] : [];
  return {
    ...manifest,
    encrypted,
    archive,
    files: files.map(({ contentBase64: _contentBase64, ...file }) => file),
  };
}

async function loadBackupArchive(targetPath: string, args: string[]): Promise<JsonObject> {
  if (targetPath.endsWith('.json')) return readJson(targetPath, {}) as Promise<JsonObject>;
  const raw = await fs.readFile(targetPath);
  const payload = targetPath.endsWith('.enc') ? decryptBackupPayload(raw, readBackupPassphrase(args)) : await gunzipAsync(raw);
  return JSON.parse(payload.toString('utf8')) as JsonObject;
}

function verifyBackupManifest(manifest: unknown): { ok: boolean; files: number; errors: string[] } {
  const item = manifest as JsonObject;
  const files = Array.isArray(item.files) ? item.files as JsonObject[] : [];
  const errors: string[] = [];
  if (!String(item.format || '').startsWith('zavorth-backup/')) errors.push('Unsupported backup format.');
  for (const file of files) {
    if (!file.exists) continue;
    const content = String(file.contentBase64 || '');
    if (!content) {
      errors.push(`Missing content for ${String(file.file)}`);
      continue;
    }
    const raw = Buffer.from(content, 'base64');
    if (Number(file.bytes || 0) !== raw.byteLength) errors.push(`Size mismatch for ${String(file.file)}`);
    if (String(file.sha256 || '') !== sha256(raw)) errors.push(`Checksum mismatch for ${String(file.file)}`);
  }
  return { ok: errors.length === 0, files: files.filter((file) => file.exists).length, errors };
}

function selectBackupFiles(files: JsonObject[], args: string[]): JsonObject[] {
  const includes = readFlags(args, 'file').concat(readFlags(args, 'include'));
  const excludes = readFlags(args, 'exclude');
  return files.filter((file) => {
    const name = String(file.file || '');
    if (includes.length && !includes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    if (excludes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    return true;
  });
}

function backupPatternMatches(file: string, pattern: string): boolean {
  const normalized = file.replace(/\\/gu, '/');
  const wanted = pattern.replace(/\\/gu, '/');
  if (wanted.includes('*')) {
    const regex = new RegExp(`^${wanted.split('*').map(escapeRegex).join('.*')}$`, 'u');
    return regex.test(normalized);
  }
  return normalized === wanted || normalized.endsWith(`/${wanted}`);
}

function migrateBackupManifest(manifest: JsonObject, toVersion: number): JsonObject {
  const files = Array.isArray(manifest.files) ? manifest.files as JsonObject[] : [];
  return {
    ...manifest,
    id: idWithTime('backup-migrated'),
    version: toVersion,
    format: `zavorth-backup/v${toVersion}`,
    migratedAt: new Date().toISOString(),
    files: files.map((file) => ({ ...file, file: String(file.file || '').replace(/\\/gu, '/') })),
  };
}

async function importAgentState(root: string, source: string, args: string[]): Promise<{ lines: string[]; mapped: JsonObject; files: Array<{ destination: string; content: string }> }> {
  const stat = await fs.stat(source);
  const rawFiles = stat.isDirectory()
    ? await Promise.all((await walkFiles(source, 200)).map(async (file) => ({ file, content: await fs.readFile(file, 'utf8').catch(() => '') })))
    : [{ file: source, content: await fs.readFile(source, 'utf8') }];
  const agent = idFromSpec(readFlag(args, 'agent') || 'generic-agent');
  const mapped: JsonObject = {
    version: 1,
    sourceAgent: agent,
    importedAt: new Date().toISOString(),
    source: path.resolve(source),
    files: rawFiles.map((file) => ({ file: path.basename(file.file), sha256: sha256(Buffer.from(file.content, 'utf8')) })),
  };
  const destination = path.join(stateDir(root), 'imports', `${agent}.json`);
  return {
    lines: [`Source agent: ${agent}`, `Mapped files: ${rawFiles.length}`, `Destination: ${path.relative(root, destination)}`],
    mapped,
    files: [{ destination, content: JSON.stringify(mapped, null, 2) }],
  };
}

function readBackupPassphrase(args: string[]): string {
  const envName = readFlag(args, 'passphrase-env');
  const value = readFlag(args, 'passphrase') || (envName ? process.env[envName] : undefined) || process.env.ZAVORTH_BACKUP_PASSPHRASE || '';
  if (!value) throw new Error('Encrypted backup requires --passphrase, --passphrase-env or ZAVORTH_BACKUP_PASSPHRASE.');
  return value;
}

function encryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const envelope = {
    format: 'zavorth-backup-encrypted/v1',
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
  return Buffer.from(JSON.stringify(envelope), 'utf8');
}

function decryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
  const envelope = JSON.parse(payload.toString('utf8')) as JsonObject;
  const salt = Buffer.from(String(envelope.salt || ''), 'base64');
  const iv = Buffer.from(String(envelope.iv || ''), 'base64');
  const tag = Buffer.from(String(envelope.tag || ''), 'base64');
  const encrypted = Buffer.from(String(envelope.data || ''), 'base64');
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
