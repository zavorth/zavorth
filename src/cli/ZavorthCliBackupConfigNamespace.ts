import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { spawnCommandLine } from '../security/SafeProcessExec.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { formatZavorthCertificationHelp } from './ZavorthCliCertificationCommands.js';
import { ZavorthOperationalReadinessService } from '../services/ZavorthOperationalReadinessService.js';
import { ZavorthNativeCapabilityCertificationService } from '../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthProductExcellenceService } from '../services/ZavorthProductExcellenceService.js';
import {
  AutonomySchedulePlane,
  bindAutonomySchedulePlane,
} from '../services/AutonomySchedulePlane.js';
import { GoalLoopService } from '../services/GoalLoopService.js';
import { GoalLoopDaemonService } from '../services/GoalLoopDaemonService.js';
import { GoalLoopWorkerService } from '../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../services/GoalPlaneService.js';
import { TaskBoardPlaneService } from '../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../services/TaskPlaneService.js';
import { ZavorthHomePathService } from '../services/ZavorthHomePathService.js';
import { ZavorthBackgroundTaskService } from '../services/ZavorthBackgroundTaskService.js';
import { ZavorthCapabilityLifecycleService } from '../services/ZavorthCapabilityLifecycleService.js';
import { ZavorthCapabilityUsageSignalsService } from '../services/ZavorthCapabilityUsageSignalsService.js';
import { ZavorthCapabilityAtlasService } from '../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthActionGateway, type ZavorthActionOperation } from '../runtime/actions/index.js';
import {
  SessionContinuumService,
  resolveSessionContinuumStorePath,
} from '../services/SessionContinuumService.js';
import { ZavorthXaiRuntimeService } from '../services/ZavorthXaiRuntimeService.js';
import { ZavorthOperationalStateDbService } from '../services/ZavorthOperationalStateDbService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { SkillCuratorPlaneService } from '../skills/SkillCuratorPlaneService.js';
import { runSkills as runSkillsNamespace } from './skills/ZavorthCliSkillsNamespace.js';
import { runPlugins as runPluginsNamespace } from './plugins/ZavorthCliPluginsNamespace.js';
import { AgentRunService } from '../runtime/agent/AgentRunService.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import { ChannelGatewayFactory } from '../gateways/ChannelGatewayFactory.js';
import { runCertify } from './certify/ZavorthCliCertifyNamespace.js';
import { runSandbox } from './sandbox/ZavorthCliSandboxNamespace.js';
import {
  firstArg,
  readFlag,
  readFlags,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  readArray,
  writeJson,
  appendJsonArray,
  listJsonFiles,
  listAnyFiles,
  walkFiles,
  idWithTime,
  safeString,
  isInside,
  runProcess,
  sha256,
  render,
  normalizeRenderLines,
  resolvePanelType,
  terminalPanelWidth,
  text,
  splitList,
  getEnv,
  quoteEnv,
  mergeSingleEnvValue
} from './ZavorthCliSharedHelpers.js';
import type { ZavorthCapabilityUsageEventKind, ZavorthCapabilityUsageSurface } from '../contracts/ZavorthCapabilityUsageSignalsContract.js';
import type { ZavorthCapabilityAtlasCategory } from '../contracts/ZavorthCapabilityAtlasContract.js';
import type { ZavorthAppsSatelliteAction, ZavorthAppsSatelliteNodeKind } from '../contracts/ZavorthAppsSatelliteNodesContract.js';
import type { ZavorthTerminalBackendId } from '../contracts/runtime/ZavorthTerminalBackendsContract.js';
import type { SwarmScaleExecutionMode, SwarmScaleExecutionBackendId } from '../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
import {
  getPath,
  idFromSpec,
  redactUrl,
  setPath,
  unsetPath,
} from './ZavorthCliCommunicationNamespace.js';


type JsonObject = Record<string, unknown>;
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
      ], { dryRun: true, files: safeRestorable.map(({ contentBase64, ...file }) => file) });
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

export async function collectBackupFiles(root: string, args: string[]): Promise<JsonObject[]> {
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

export function backupSidecar(manifest: JsonObject, archive: string, encrypted: boolean): JsonObject {
  const files = Array.isArray(manifest.files) ? manifest.files as JsonObject[] : [];
  return {
    ...manifest,
    encrypted,
    archive,
    files: files.map(({ contentBase64, ...file }) => file),
  };
}

export async function loadBackupArchive(targetPath: string, args: string[]): Promise<JsonObject> {
  if (targetPath.endsWith('.json')) return readJson(targetPath, {}) as Promise<JsonObject>;
  const raw = await fs.readFile(targetPath);
  const payload = targetPath.endsWith('.enc') ? decryptBackupPayload(raw, readBackupPassphrase(args)) : await gunzipAsync(raw);
  return JSON.parse(payload.toString('utf8')) as JsonObject;
}

export function verifyBackupManifest(manifest: unknown): { ok: boolean; files: number; errors: string[] } {
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

export function selectBackupFiles(files: JsonObject[], args: string[]): JsonObject[] {
  const includes = readFlags(args, 'file').concat(readFlags(args, 'include'));
  const excludes = readFlags(args, 'exclude');
  return files.filter((file) => {
    const name = String(file.file || '');
    if (includes.length && !includes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    if (excludes.some((pattern) => backupPatternMatches(name, pattern))) return false;
    return true;
  });
}

export function backupPatternMatches(file: string, pattern: string): boolean {
  const normalized = file.replace(/\\/gu, '/');
  const wanted = pattern.replace(/\\/gu, '/');
  if (wanted.includes('*')) {
    const regex = new RegExp(`^${wanted.split('*').map(escapeRegex).join('.*')}$`, 'u');
    return regex.test(normalized);
  }
  return normalized === wanted || normalized.endsWith(`/${wanted}`);
}

export function migrateBackupManifest(manifest: JsonObject, toVersion: number): JsonObject {
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

export async function importAgentState(root: string, source: string, args: string[]): Promise<{ lines: string[]; mapped: JsonObject; files: Array<{ destination: string; content: string }> }> {
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

export function readBackupPassphrase(args: string[]): string {
  const envName = readFlag(args, 'passphrase-env');
  const value = readFlag(args, 'passphrase') || (envName ? process.env[envName] : undefined) || process.env.ZAVORTH_BACKUP_PASSPHRASE || '';
  if (!value) throw new Error('Encrypted backup requires --passphrase, --passphrase-env or ZAVORTH_BACKUP_PASSPHRASE.');
  return value;
}

export function encryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
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

export function decryptBackupPayload(payload: Buffer, passphrase: string): Buffer {
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

export function escapeRegex(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/gu, '\\$&');
}

export async function runConfig(root: string, args: string[]) {
  const profile = readFlag(args, 'profile') || process.env.ZAVORTH_PROFILE || 'default';
  const file = configFileForProfile(root, profile);
  await ensureDir(path.dirname(file));
  const action = firstArg(args, 'validate');
  const cfg = await readJson(file, defaultConfig(profile));
  if (action === 'file') return render(args, 'Zavorth config', [file], { file });
  if (action === 'profile' || action === 'profiles') {
    return runConfigProfiles(root, args);
  }
  if (action === 'export') {
    const output = readFlag(args, 'output') || path.join(stateDir(root), `config-export-${profile}.json`);
    const payload = { profile, exportedAt: new Date().toISOString(), config: redactConfigSecrets(cfg as JsonObject) };
    await writeJson(output, payload);
    return render(args, 'Zavorth config', [`Exported config: ${output}`], { output, payload });
  }
  if (action === 'import') {
    const input = args[1] || readFlag(args, 'file') || '';
    if (!input || !existsSync(input)) return render(args, 'Zavorth config', [`Import file not found: ${input || '<missing>'}`], { ok: false });
    const imported = await readJson(input, {}) as JsonObject;
    const next = normalizeConfig((imported.config || imported) as JsonObject, profile);
    const preview = previewConfigPolicy(cfg as JsonObject, next);
    if (!args.includes('--yes')) return render(args, 'Zavorth config import', ['Import preview only. Add --yes to apply.', ...preview.lines], { dryRun: true, preview });
    await writeJson(file, next);
    return render(args, 'Zavorth config import', ['Imported config.', ...preview.lines], { config: redactConfigSecrets(next), preview });
  }
  if (action === 'requirements') {
    const requirements = normalizeRequirements(((cfg as JsonObject).requirements || []) as unknown[]);
    const result = enforceRequirements(requirements);
    return render(args, 'Zavorth config requirements', result.lines, result);
  }
  if (action === 'managed') {
    return runManagedConfig(root, profile, cfg as JsonObject, args);
  }
  if (action === 'get') {
    const key = args[1] || '';
    const value = key ? getPath(cfg, key) : cfg;
    return render(args, 'Zavorth config', [`${key || 'config'}: ${safeString(redactConfigSecrets(value as JsonObject))}`], { key, value: redactConfigSecrets(value as JsonObject) });
  }
  if (action === 'set') {
    const key = args[1];
    const value = args.slice(2).filter((arg, index, list) => {
      if (arg.startsWith('--')) return false;
      return index === 0 || list[index - 1] !== '--profile';
    }).join(' ');
    if (!key || !value) return render(args, 'Zavorth config', ['Usage: zavorth config set <key> <value>'], { ok: false });
    setPath(cfg as JsonObject, key, value);
    const next = normalizeConfig(cfg as JsonObject, profile);
    const validation = validateConfigSchema(next);
    if (!validation.ok) return render(args, 'Zavorth config', ['Config schema validation failed.', ...validation.errors], { ok: false, errors: validation.errors });
    await writeJson(file, next);
    return render(args, 'Zavorth config', [`Set ${key}`, `Profile: ${profile}`], { ok: true, file, config: redactConfigSecrets(next) });
  }
  if (action === 'unset') {
    const key = args[1];
    if (!key) return render(args, 'Zavorth config', ['Usage: zavorth config unset <key>'], { ok: false });
    unsetPath(cfg as JsonObject, key);
    await writeJson(file, cfg);
    return render(args, 'Zavorth config', [`Unset ${key}`], { ok: true, file });
  }
  const normalized = normalizeConfig(cfg as JsonObject, profile);
  const validation = validateConfigSchema(normalized);
  const requirements = enforceRequirements(normalizeRequirements((normalized.requirements || []) as unknown[]));
  return render(args, 'Zavorth config', [
    existsSync(file) ? 'Config file exists.' : 'No config file yet.',
    `Profile: ${profile}`,
    `Schema: ${validation.ok ? 'valid' : 'invalid'}`,
    `Requirements: ${requirements.ok ? 'satisfied' : 'missing'}`,
    ...validation.errors,
    ...requirements.lines,
  ], { ok: validation.ok && requirements.ok, file, exists: existsSync(file), validation, requirements, config: redactConfigSecrets(normalized) });
}

export function configFileForProfile(root: string, profile: string): string {
  const safe = profile.replace(/[^a-z0-9._-]+/giu, '-').toLowerCase() || 'default';
  return safe === 'default'
    ? path.join(stateDir(root), 'cli-config.json')
    : path.join(stateDir(root), 'profiles', safe, 'cli-config.json');
}

export function defaultConfig(profile: string): JsonObject {
  return {
    version: 2,
    profile: { id: profile, mode: 'balanced' },
    provider: { name: '', model: '' },
    trust: { approvalMode: 'balanced', sandboxDefault: 'local', redactSecrets: true },
    requirements: [],
    managed: { enabled: false },
  };
}

export function normalizeConfig(value: JsonObject, profile: string): JsonObject {
  return {
    ...defaultConfig(profile),
    ...value,
    version: Number(value.version || 2),
    profile: { ...(defaultConfig(profile).profile as JsonObject), ...((value.profile || {}) as JsonObject), id: String(((value.profile || {}) as JsonObject).id || profile) },
    provider: { ...(defaultConfig(profile).provider as JsonObject), ...((value.provider || {}) as JsonObject) },
    trust: { ...(defaultConfig(profile).trust as JsonObject), ...((value.trust || {}) as JsonObject) },
    requirements: normalizeRequirements((value.requirements || []) as unknown[]),
    managed: { ...(defaultConfig(profile).managed as JsonObject), ...((value.managed || {}) as JsonObject) },
  };
}

export function validateConfigSchema(config: JsonObject): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (Number(config.version || 0) < 1) errors.push('version must be >= 1.');
  if (!config.profile || typeof config.profile !== 'object') errors.push('profile object is required.');
  if (!config.trust || typeof config.trust !== 'object') errors.push('trust object is required.');
  const trust = (config.trust || {}) as JsonObject;
  const approvalMode = String(trust.approvalMode || '');
  if (approvalMode && !['ask-every-time', 'balanced', 'trusted-local', 'manual', 'governed', 'speculative'].includes(approvalMode)) errors.push(`unknown trust.approvalMode: ${approvalMode}`);
  return { ok: errors.length === 0, errors };
}

export async function runConfigProfiles(root: string, args: string[]) {
  const action = args[1] || 'list';
  const dir = path.join(stateDir(root), 'profiles');
  await ensureDir(dir);
  if (action === 'create') {
    const profile = args[2] || readFlag(args, 'profile') || '';
    if (!profile) return render(args, 'Zavorth config profiles', ['Usage: zavorth config profile create <name>'], { ok: false });
    const file = configFileForProfile(root, profile);
    if (!existsSync(file)) await writeJson(file, defaultConfig(profile));
    return render(args, 'Zavorth config profiles', [`Created profile: ${profile}`, `File: ${file}`], { profile, file });
  }
  if (action === 'use') {
    const profile = args[2] || readFlag(args, 'profile') || '';
    if (!profile) return render(args, 'Zavorth config profiles', ['Usage: zavorth config profile use <name>'], { ok: false });
    await writeJson(path.join(stateDir(root), 'active-profile.json'), { profile, updatedAt: new Date().toISOString() });
    return render(args, 'Zavorth config profiles', [`Active profile: ${profile}`], { profile });
  }
  const profiles = ['default']
    .concat((await listAnyFiles(dir)).filter((entry) => existsSync(path.join(entry, 'cli-config.json'))).map((entry) => path.basename(entry)));
  const active = await readJson(path.join(stateDir(root), 'active-profile.json'), { profile: process.env.ZAVORTH_PROFILE || 'default' }) as JsonObject;
  return render(args, 'Zavorth config profiles', profiles.map((profile) => `${String(active.profile) === profile ? '*' : '-'} ${profile}`), { profiles, active: active.profile });
}

export async function runManagedConfig(root: string, profile: string, current: JsonObject, args: string[]) {
  const source = readFlag(args, 'file') || readFlag(args, 'url') || process.env.ZAVORTH_MANAGED_CONFIG_URL || '';
  const deploymentKey = readFlag(args, 'deployment-key') || process.env.ZAVORTH_DEPLOYMENT_KEY || '';
  if (!source) return render(args, 'Zavorth managed config', ['Managed config source is missing. Use --file or --url.'], { ok: false });
  const payload = await loadManagedConfigSource(source);
  if (!payload.ok) return render(args, 'Zavorth managed config', [`Failed to load managed config: ${payload.reason}`], payload);
  const managed = payload.config;
  const expectedChecksum = String((managed.integrity as JsonObject | undefined)?.sha256 || readFlag(args, 'checksum') || '');
  const actualChecksum = sha256(Buffer.from(JSON.stringify(redactConfigSecrets(managed)), 'utf8'));
  if (expectedChecksum && expectedChecksum !== actualChecksum) {
    return render(args, 'Zavorth managed config', ['Checksum mismatch. Managed config was not applied.'], { ok: false, expectedChecksum, actualChecksum });
  }
  if (managed.deploymentKeyHash && deploymentKey && hashDeploymentKey(deploymentKey) !== managed.deploymentKeyHash) {
    return render(args, 'Zavorth managed config', ['Deployment key did not match managed config policy.'], { ok: false });
  }
  const next = normalizeConfig({ ...current, ...((managed.config || managed) as JsonObject), managed: { enabled: true, source: redactUrl(source), appliedAt: new Date().toISOString() } }, profile);
  const validation = validateConfigSchema(next);
  const requirements = enforceRequirements(normalizeRequirements((next.requirements || []) as unknown[]));
  const preview = previewConfigPolicy(current, next);
  if (!args.includes('--yes')) {
    return render(args, 'Zavorth managed config', ['Managed config preview only. Add --yes to apply.', ...preview.lines, ...requirements.lines], { dryRun: true, validation, requirements, preview, config: redactConfigSecrets(next) });
  }
  if (!validation.ok || !requirements.ok) {
    return render(args, 'Zavorth managed config', ['Managed config blocked by validation/requirements.', ...validation.errors, ...requirements.lines], { ok: false, validation, requirements });
  }
  await writeJson(configFileForProfile(root, profile), next);
  await appendJsonArray(path.join(stateDir(root), 'receipts', 'managed-config.json'), { id: idWithTime('managed-config'), profile, source: redactUrl(source), checksum: actualChecksum, appliedAt: new Date().toISOString() });
  return render(args, 'Zavorth managed config', ['Managed config applied.', ...preview.lines], { config: redactConfigSecrets(next), checksum: actualChecksum });
}

export async function loadManagedConfigSource(source: string): Promise<{ ok: boolean; config: JsonObject; reason?: string }> {
  try {
    if (/^https?:\/\//iu.test(source)) {
      const response = await fetch(source);
      if (!response.ok) return { ok: false, config: {}, reason: `http-${response.status}` };
      return { ok: true, config: await response.json() as JsonObject };
    }
    return { ok: true, config: await readJson(source, {}) as JsonObject };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn('[Zavorth Cli Live Namespaces] network request failed', error);
    return { ok: false, config: {}, reason: error instanceof Error ? err.message : String(error) };
  }
}

export function normalizeRequirements(value: unknown[]): Array<{ kind: string; name: string; required: boolean }> {
  return value.map((entry) => {
    if (typeof entry === 'string') return { kind: 'env', name: entry, required: true };
    const item = (entry || {}) as JsonObject;
    return { kind: String(item.kind || 'env'), name: String(item.name || item.id || ''), required: item.required !== false };
  }).filter((entry) => entry.name);
}

export function enforceRequirements(requirements: Array<{ kind: string; name: string; required: boolean }>): { ok: boolean; lines: string[]; missing: string[] } {
  const missing: string[] = [];
  for (const requirement of requirements) {
    if (!requirement.required) continue;
    if (requirement.kind === 'env' && !getEnv(requirement.name)) missing.push(requirement.name);
    if (requirement.kind === 'file' && !existsSync(requirement.name)) missing.push(requirement.name);
    if (requirement.kind === 'command') {
      // Command requirements are declared for the user; live command probing belongs in doctor.
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    lines: requirements.length
      ? requirements.map((requirement) => `${missing.includes(requirement.name) ? 'missing' : 'ok'} ${requirement.kind}:${requirement.name}`)
      : ['No requirements declared.'],
  };
}

export function previewConfigPolicy(before: JsonObject, after: JsonObject): { lines: string[]; changed: string[] } {
  const keys = ['provider.name', 'provider.model', 'trust.approvalMode', 'trust.sandboxDefault', 'trust.redactSecrets'];
  const changed = keys.filter((key) => safeString(getPath(before, key)) !== safeString(getPath(after, key)));
  return {
    changed,
    lines: changed.length
      ? ['Policy/config changes:', ...changed.map((key) => `- ${key}: ${safeString(getPath(before, key))} -> ${safeString(getPath(after, key))}`)]
      : ['No policy-sensitive config changes detected.'],
  };
}

export function redactConfigSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConfigSecrets);
  if (!value || typeof value !== 'object') return value;
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(value as JsonObject)) {
    out[key] = /token|secret|password|api[_-]?key|deploymentkey/iu.test(key) ? '***' : redactConfigSecrets(item);
  }
  return out;
}

export function hashDeploymentKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
