import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  readFlag,
  runProcess,
  safeString,
  splitList,
  walkFiles,
  writeJson,
} from '../ZavorthCliSharedHelpers.js';
import { idFromSpec } from '../ZavorthCliLiveNamespaces.js';
import {
  PluginScaffoldService,
  toLegacyPluginPermissionId,
} from '../../services/PluginScaffoldService.js';

type JsonObject = Record<string, unknown>;

export async function calculatePluginChecksum(root: string, spec: string): Promise<string> {
  if (!isLocalPluginSpec(root, spec)) return '';
  const pluginPath = resolvePluginPath(root, spec);
  if (!existsSync(pluginPath)) return '';
  const files = (await walkFiles(pluginPath, 500))
    .filter((file) => !/[\\/](node_modules|\.git)[\\/]/u.test(file))
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const relative = path.relative(pluginPath, file).replace(/\\/gu, '/');
    hash.update(relative);
    hash.update(await fs.readFile(file));
  }
  return hash.digest('hex');
}

export function buildPluginRecord(spec: string, manifest: JsonObject, checksum: string, args: string[]): JsonObject {
  const permissions = normalizePermissions(readFlag(args, 'permissions') || manifest.permissions || '');
  const record = {
    id: idFromSpec(String(manifest.name || spec)),
    spec,
    name: String(manifest.name || idFromSpec(spec)),
    version: String(manifest.version || '0.0.0'),
    status: 'install-preview',
    enabled: false,
    manifestFound: Boolean(manifest.found),
    entry: manifest.entry || null,
    permissions,
    sandbox: manifest.sandbox || pluginSandboxForPermissions(permissions),
    hooks: manifest.hooks || {},
    checksum,
    signature: readFlag(args, 'signature') || manifest.signature || null,
    installedAt: null,
    createdAt: new Date().toISOString(),
  };
  return record;
}

export function normalizePermissions(value: unknown): string[] {
  const source = Array.isArray(value) ? value : splitList(String(value || ''));
  return Array.from(new Set(source.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean))).sort();
}

export function pluginSandboxForPermissions(permissions: string[]): JsonObject {
  return {
    network: permissions.some((permission) => /network|http|webhook|external/iu.test(permission)),
    workspaceRead: permissions.some((permission) => /read|workspace|file/iu.test(permission)),
    workspaceWrite: permissions.some((permission) => /write|mutate|delete/iu.test(permission)),
    shell: permissions.some((permission) => /shell|process|exec/iu.test(permission)),
    defaultMode: permissions.length === 0 ? 'metadata-only' : 'approval-required',
  };
}

export function findPlugin(items: unknown[], id: string): JsonObject | undefined {
  return items.find((plugin) => {
    const item = plugin as JsonObject;
    return String(item.id) === id || String(item.spec) === id || String(item.name) === id;
  }) as JsonObject | undefined;
}

export async function doctorPlugin(root: string, plugin: JsonObject): Promise<Array<{ id: string; ok: boolean; summary: string }>> {
  const checks: Array<{ id: string; ok: boolean; summary: string }> = [];
  checks.push({ id: 'manifest', ok: Boolean(plugin.manifestFound), summary: plugin.manifestFound ? 'Manifest is present.' : 'Plugin uses fallback manifest metadata.' });
  checks.push({ id: 'checksum', ok: Boolean(plugin.checksum), summary: plugin.checksum ? 'Checksum is recorded.' : 'Checksum is unavailable for remote package until install proof.' });
  checks.push({ id: 'permissions', ok: Array.isArray(plugin.permissions), summary: `${((plugin.permissions as string[]) || []).length} permission(s) declared.` });
  const entry = String(plugin.entry || '');
  if (entry && isLocalPluginSpec(root, String(plugin.spec || ''))) {
    const entryPath = path.join(resolvePluginPath(root, String(plugin.spec)), entry);
    checks.push({ id: 'entry', ok: existsSync(entryPath), summary: existsSync(entryPath) ? 'Entry file exists.' : `Entry file is missing: ${entry}` });
  } else {
    checks.push({ id: 'entry', ok: true, summary: entry ? 'Entry is declared.' : 'No entry declared; plugin is metadata/hooks only.' });
  }
  checks.push({ id: 'sandbox', ok: Boolean(plugin.sandbox), summary: `Sandbox mode: ${safeString(plugin.sandbox)}` });
  return checks;
}

export async function scaffoldPlugin(
  root: string,
  targetDir: string,
  id: string,
  moduleKindInput = 'tool',
  options: { withHooks?: boolean; withTools?: boolean; language?: 'js' | 'ts' } = {},
): Promise<JsonObject> {
  const service = new PluginScaffoldService();
  const created = service.scaffold({
    root,
    id,
    targetDir,
    moduleKind: moduleKindInput,
    kind: moduleKindInput,
    withHooks: options.withHooks,
    withTools: options.withTools,
    language: options.language,
  });
  return {
    id: created.id,
    targetDir: created.targetDir,
    moduleKind: created.moduleKind,
    language: created.language,
    files: created.files,
    manifest: {
      ...created.manifest,
      permissions: created.manifest.permissions.map(toLegacyPluginPermissionId),
      permissionDescriptors: created.manifest.permissions,
    },
    checksum: await calculatePluginChecksum(root, path.relative(root, targetDir)),
  };
}

export function resolveScaffoldOptions(args: string[]): {
  withHooks: boolean;
  withTools: boolean;
  language: 'js' | 'ts';
} {
  let withHooks = true;
  let withTools = true;
  const withFlag = readFlag(args, 'with');
  if (withFlag) {
    const parts = splitList(withFlag).map((part) => part.toLowerCase());
    withHooks = parts.includes('hooks') || parts.includes('hook');
    withTools = parts.includes('tools') || parts.includes('tool');
  }
  if (args.includes('--hooks') || args.includes('--with-hooks')) {
    withHooks = true;
  }
  if (args.includes('--tools') || args.includes('--with-tools')) {
    withTools = true;
  }
  if (args.includes('--no-hooks')) {
    withHooks = false;
  }
  if (args.includes('--no-tools')) {
    withTools = false;
  }
  const languageFlag = String(readFlag(args, 'language') || '').trim().toLowerCase();
  const language: 'js' | 'ts' = args.includes('--ts') || languageFlag === 'ts' || languageFlag === 'typescript'
    ? 'ts'
    : 'js';
  return { withHooks, withTools, language };
}

export function pluginPermissionLines(plugin: JsonObject): string[] {
  const permissions = ((plugin.permissions as string[]) || []);
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  return [
    `Permissions: ${permissions.join(', ') || 'none'}`,
    `Sandbox: network=${String(sandbox.network ?? false)} write=${String(sandbox.workspaceWrite ?? false)} shell=${String(sandbox.shell ?? false)}`,
    'All sensitive plugin abilities remain policy/approval gated.',
  ];
}

export async function runPluginHook(root: string, plugin: JsonObject, command: string): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  if (sandbox.shell !== true && /(^|\s)(cmd|powershell|bash|sh|node|npm|pnpm|yarn)\b/iu.test(command)) {
    return { exitCode: 126, output: 'Plugin hook requested shell/process execution but manifest did not declare shell permission.', durationMs: 0, timedOut: false };
  }
  return runProcess(command, [], isLocalPluginSpec(root, String(plugin.spec || '')) ? resolvePluginPath(root, String(plugin.spec)) : root, 30000);
}

export async function writePluginRuntimeState(file: string, plugins: unknown[]): Promise<void> {
  const enabled = plugins
    .map((plugin) => plugin as JsonObject)
    .filter((plugin) => plugin.enabled === true)
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      entry: plugin.entry || null,
      permissions: plugin.permissions || [],
      sandbox: plugin.sandbox || {},
      hooks: plugin.hooks || {},
      checksum: plugin.checksum || null,
    }));
  await writeJson(file, { version: 1, updatedAt: new Date().toISOString(), enabled });
}

export function sanitizePluginRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.signature) item.signature = '***';
  return item;
}

export function isLocalPluginSpec(root: string, spec: string): boolean {
  if (!spec) return false;
  return spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/u.test(spec) || existsSync(path.resolve(root, spec));
}

export function resolvePluginPath(root: string, spec: string): string {
  return path.resolve(root, spec);
}
