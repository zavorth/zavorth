import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  firstArg,
  readFlag,
  stateDir,
  readArray,
  readJson,
  writeJson,
  appendJsonArray,
  idWithTime,
  runProcess,
  render,
  splitList,
  ensureDir,
  walkFiles,
  isInside,
  safeString
} from '../ZavorthCliSharedHelpers.js';
import {
  idFromSpec,
  resolveNpmCommand
} from '../ZavorthCliLiveNamespaces.js';

type JsonObject = Record<string, unknown>;

export async function runPlugins(root: string, args: string[]) {
  const action = firstArg(args, 'list');
  const pkg = await readJson(path.join(root, 'package.json'), {}) as JsonObject;
  const deps = Object.keys({ ...((pkg.dependencies as JsonObject) || {}), ...((pkg.devDependencies as JsonObject) || {}) });
  const pluginFile = path.join(stateDir(root), 'plugins.json');
  const local = await readArray(pluginFile);
  const runtimeFile = path.join(stateDir(root), 'plugins-runtime.json');
  if (action === 'scaffold' || action === 'create') {
    const id = idFromSpec(args[1] || readFlag(args, 'id') || 'zavorth-plugin');
    const targetDir = path.resolve(root, readFlag(args, 'dir') || id);
    if (!isInside(root, targetDir)) {
      return render(args, 'Zavorth plugin scaffold', ['Refusing to scaffold outside the workspace.'], { ok: false });
    }
    const preview = [
      `Plugin id: ${id}`,
      `Target: ${targetDir}`,
      'Files: zavorth.plugin.json, index.js, README.md, package.json',
      'Add --yes to create this governed plugin scaffold.',
    ];
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth plugin scaffold', preview, { dryRun: true, id, targetDir });
    }
    const created = await scaffoldPlugin(root, targetDir, id);
    return render(args, 'Zavorth plugin scaffold', [
      `Created plugin scaffold: ${id}`,
      `Target: ${targetDir}`,
      'Next: zavorth plugins install ./<plugin> --yes',
    ], { plugin: created });
  }
  if (action === 'install') {
    const spec = args[1];
    if (!spec) return render(args, 'Zavorth plugins', ['Usage: zavorth plugins install <package-or-path> [--yes]'], { ok: false });
    const manifest = await resolvePluginManifest(root, spec, args);
    const checksum = await calculatePluginChecksum(root, spec);
    const expectedChecksum = readFlag(args, 'checksum') || '';
    if (expectedChecksum && checksum && expectedChecksum !== checksum) {
      return render(args, 'Zavorth plugins', ['Checksum mismatch. Plugin was not installed.'], { ok: false, expectedChecksum, actualChecksum: checksum });
    }
    const record = buildPluginRecord(spec, manifest, checksum, args);
    if (!args.includes('--yes')) {
      const permissions = (record.permissions as string[]) || [];
      return render(args, 'Zavorth plugins', [
        `Preview install: ${spec}`,
        `Manifest: ${manifest.found ? 'found' : 'fallback'}`,
        `Permissions: ${permissions.join(', ') || 'none'}`,
        `Checksum: ${checksum || 'pending-after-install'}`,
        'Add --yes to install/register this plugin.',
      ], { record: sanitizePluginRecord(record), manifest });
    }
    const install = isLocalPluginSpec(root, spec)
      ? { exitCode: 0, output: 'local plugin registered without npm install', durationMs: 0, timedOut: false }
      : await runProcess(resolveNpmCommand(), ['install', spec, '--save'], root, 120000);
    record.status = install.exitCode === 0 ? 'installed' : 'install-failed';
    record.installedAt = new Date().toISOString();
    record.exitCode = install.exitCode;
    local.push(record);
    await writeJson(pluginFile, local);
    return render(args, 'Zavorth plugins', [`Install ${record.status}: ${spec}`, install.output.slice(0, 800)], { record: sanitizePluginRecord(record), install });
  }
  if (action === 'manifest') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(args, 'Zavorth plugin manifest', [
      `id: ${String(selected.id)}`,
      `name: ${String(selected.name || selected.spec)}`,
      `version: ${String(selected.version || 'unknown')}`,
      `permissions: ${((selected.permissions as string[]) || []).join(', ') || 'none'}`,
      `checksum: ${String(selected.checksum || 'none')}`,
    ], { plugin: sanitizePluginRecord(selected) });
  }
  if (action === 'doctor') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    const checks = selected ? await doctorPlugin(root, selected) : [];
    return render(args, 'Zavorth plugin doctor', selected ? checks.map((check) => `${check.ok ? 'ok' : 'fail'} ${check.id}: ${check.summary}`) : [`Plugin not found: ${id || '<missing>'}`], { ok: selected ? checks.every((check) => check.ok) : false, checks });
  }
  if (action === 'marketplace' || action === 'search') {
    const query = args[1] || readFlag(args, 'query') || '';
    const marketplace = await loadPluginMarketplace(root);
    const matches = query
      ? marketplace.filter((entry) => JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()))
      : marketplace;
    return render(args, 'Zavorth plugin marketplace', matches.length ? matches.slice(0, 20).map((entry) => `- ${String(entry.id)} | ${String(entry.name)} | ${String(entry.summary || '')}`) : ['No marketplace plugins matched.'], { plugins: matches });
  }
  if (action === 'permissions') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin permissions', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    return render(args, 'Zavorth plugin permissions', pluginPermissionLines(selected), { plugin: sanitizePluginRecord(selected) });
  }
  if (action === 'hooks') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin hooks', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const hooks = (selected.hooks || {}) as JsonObject;
    return render(args, 'Zavorth plugin hooks', Object.keys(hooks).length ? Object.entries(hooks).map(([name, command]) => `${name}: ${String(command)}`) : ['No lifecycle hooks declared.'], { hooks });
  }
  if (action === 'run-hook') {
    const id = args[1] || readFlag(args, 'id') || '';
    const hook = args[2] || readFlag(args, 'hook') || '';
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugin hook', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    const command = String(((selected.hooks || {}) as JsonObject)[hook] || '');
    if (!command) return render(args, 'Zavorth plugin hook', [`Hook not found: ${hook || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth plugin hook', [`Hook preview: ${hook}`, `Command: ${command}`, 'Add --yes to run this hook in the plugin sandbox.'], { dryRun: true, plugin: sanitizePluginRecord(selected), hook, command });
    const result = await runPluginHook(root, selected, command);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), { id: idWithTime('plugin-receipt'), pluginId: selected.id, hook, status: result.exitCode === 0 ? 'completed' : 'failed', createdAt: new Date().toISOString(), durationMs: result.durationMs });
    return render(args, 'Zavorth plugin hook', [`Hook ${result.exitCode === 0 ? 'completed' : 'failed'}: ${hook}`, result.output.slice(0, 800)], { result });
  }
  if (['enable', 'disable'].includes(action)) {
    const id = args[1];
    const selected = findPlugin(local, id);
    if (!selected) return render(args, 'Zavorth plugins', [`Plugin not found: ${id || '<missing>'}`], { ok: false });
    if (action === 'enable' && !args.includes('--yes')) {
      return render(args, 'Zavorth plugins', [
        `Enable preview: ${id}`,
        ...pluginPermissionLines(selected),
        'Add --yes to enable this plugin in runtime state.',
      ], { dryRun: true, plugin: sanitizePluginRecord(selected) });
    }
    selected.enabled = action === 'enable';
    selected.updatedAt = new Date().toISOString();
    await writeJson(pluginFile, local);
    await writePluginRuntimeState(runtimeFile, local);
    await appendJsonArray(path.join(stateDir(root), 'receipts', 'plugins.json'), { id: idWithTime('plugin-receipt'), pluginId: selected.id, action, createdAt: new Date().toISOString() });
    return render(args, 'Zavorth plugins', [`${action === 'enable' ? 'Enabled' : 'Disabled'}: ${id}`], { plugin: sanitizePluginRecord(selected) });
  }
  return render(args, 'Zavorth plugins', [
    `package dependencies: ${deps.length}`,
    `local plugin records: ${local.length}`,
    ...local.slice(0, 10).map((item) => `- ${String((item as JsonObject).id || (item as JsonObject).name)} | ${String((item as JsonObject).status || 'registered')} | ${Boolean((item as JsonObject).enabled) ? 'enabled' : 'disabled'}`),
  ], { dependencies: deps.length, plugins: local.map(sanitizePluginRecord) });
}

async function resolvePluginManifest(root: string, spec: string, args: string[]): Promise<JsonObject> {
  const manifestPath = readFlag(args, 'manifest') || (isLocalPluginSpec(root, spec) ? path.join(resolvePluginPath(root, spec), 'zavorth.plugin.json') : '');
  if (manifestPath && existsSync(manifestPath)) {
    const raw = await readJson(manifestPath, {}) as JsonObject;
    return {
      found: true,
      path: manifestPath,
      name: raw.name || raw.id || idFromSpec(spec),
      version: raw.version || '0.0.0',
      entry: raw.entry || raw.main || null,
      permissions: normalizePermissions(raw.permissions),
      hooks: raw.hooks && typeof raw.hooks === 'object' ? raw.hooks : {},
      sandbox: raw.sandbox && typeof raw.sandbox === 'object' ? raw.sandbox : pluginSandboxForPermissions(normalizePermissions(raw.permissions)),
      signature: raw.signature || null,
    };
  }
  return {
    found: false,
    name: idFromSpec(spec),
    version: '0.0.0',
    entry: null,
    permissions: normalizePermissions(readFlag(args, 'permissions') || ''),
    hooks: {},
    sandbox: pluginSandboxForPermissions(normalizePermissions(readFlag(args, 'permissions') || '')),
    signature: readFlag(args, 'signature') || null,
  };
}

async function calculatePluginChecksum(root: string, spec: string): Promise<string> {
  if (!isLocalPluginSpec(root, spec)) return '';
  const pluginPath = resolvePluginPath(root, spec);
  if (!existsSync(pluginPath)) return '';
  const files = (await walkFiles(pluginPath, 500))
    .filter((file) => !/[\\\/](node_modules|\.git)[\\\/]/u.test(file))
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const relative = path.relative(pluginPath, file).replace(/\\/gu, '/');
    hash.update(relative);
    hash.update(await fs.readFile(file));
  }
  return hash.digest('hex');
}

function buildPluginRecord(spec: string, manifest: JsonObject, checksum: string, args: string[]): JsonObject {
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

function normalizePermissions(value: unknown): string[] {
  const source = Array.isArray(value) ? value : splitList(String(value || ''));
  return Array.from(new Set(source.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean))).sort();
}

function pluginSandboxForPermissions(permissions: string[]): JsonObject {
  return {
    network: permissions.some((permission) => /network|http|webhook|external/iu.test(permission)),
    workspaceRead: permissions.some((permission) => /read|workspace|file/iu.test(permission)),
    workspaceWrite: permissions.some((permission) => /write|mutate|delete/iu.test(permission)),
    shell: permissions.some((permission) => /shell|process|exec/iu.test(permission)),
    defaultMode: permissions.length === 0 ? 'metadata-only' : 'approval-required',
  };
}

function findPlugin(items: unknown[], id: string): JsonObject | undefined {
  return items.find((plugin) => {
    const item = plugin as JsonObject;
    return String(item.id) === id || String(item.spec) === id || String(item.name) === id;
  }) as JsonObject | undefined;
}

async function doctorPlugin(root: string, plugin: JsonObject): Promise<Array<{ id: string; ok: boolean; summary: string }>> {
  const checks: Array<{ id: string; ok: boolean; summary: string }> = [];
  checks.push({ id: 'manifest', ok: Boolean(plugin.manifestFound), summary: Boolean(plugin.manifestFound) ? 'Manifest is present.' : 'Plugin uses fallback manifest metadata.' });
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

async function loadPluginMarketplace(root: string): Promise<JsonObject[]> {
  const local = await readArray(path.join(stateDir(root), 'plugin-marketplace.json')) as JsonObject[];
  const bundled: JsonObject[] = [
    { id: 'zavorth-plugin-webhook-actions', name: 'Webhook Actions', summary: 'Governed webhook action bridge.', permissions: ['network:http'] },
    { id: 'zavorth-plugin-workspace-inspector', name: 'Workspace Inspector', summary: 'Read-only workspace analysis plugin.', permissions: ['workspace:read'] },
    { id: 'zavorth-plugin-channel-bridge', name: 'Channel Bridge', summary: 'Bridge external channel events into Action Cards.', permissions: ['network:http', 'message:send'] },
  ];
  return [...bundled, ...local];
}

async function scaffoldPlugin(root: string, targetDir: string, id: string): Promise<JsonObject> {
  await ensureDir(targetDir);
  const manifest = {
    id,
    name: id,
    version: '0.1.0',
    entry: 'index.js',
    permissions: ['workspace:read'],
    sandbox: {
      network: false,
      workspaceRead: true,
      workspaceWrite: false,
      shell: false,
      defaultMode: 'approval-required',
    },
    hooks: {
      doctor: 'node index.js doctor',
    },
  };
  const index = [
    '#!/usr/bin/env node',
    "const mode = process.argv[2] || 'doctor';",
    "const payload = { plugin: '" + id.replace(/'/gu, "\\'") + "', mode, ok: true, message: 'Zavorth plugin scaffold is reachable.' };",
    'process.stdout.write(JSON.stringify(payload, null, 2) + "\\n");',
    '',
  ].join('\n');
  const pkg = {
    name: id,
    version: '0.1.0',
    private: true,
    type: 'module',
    main: 'index.js',
    scripts: {
      doctor: 'node index.js doctor',
    },
  };
  const readme = [
    `# ${id}`,
    '',
    'Governed Zavorth plugin scaffold.',
    '',
    'Install locally:',
    '',
    '```bash',
    `zavorth plugins install ./${path.relative(root, targetDir).replace(/\\/gu, '/')} --yes`,
    `zavorth plugins doctor ${id}`,
    `zavorth plugins enable ${id} --yes`,
    '```',
    '',
    'Sensitive abilities remain behind policy, sandbox, approval and evidence.',
    '',
  ].join('\n');
  const files = [
    ['zavorth.plugin.json', `${JSON.stringify(manifest, null, 2)}\n`],
    ['index.js', index],
    ['package.json', `${JSON.stringify(pkg, null, 2)}\n`],
    ['README.md', readme],
  ] as const;
  for (const [file, content] of files) {
    const destination = path.join(targetDir, file);
    if (!isInside(root, destination)) continue;
    await fs.writeFile(destination, content, 'utf8');
  }
  return {
    id,
    targetDir,
    files: files.map(([file]) => path.relative(root, path.join(targetDir, file))),
    manifest,
    checksum: await calculatePluginChecksum(root, path.relative(root, targetDir)),
  };
}

function pluginPermissionLines(plugin: JsonObject): string[] {
  const permissions = ((plugin.permissions as string[]) || []);
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  return [
    `Permissions: ${permissions.join(', ') || 'none'}`,
    `Sandbox: network=${String(sandbox.network ?? false)} write=${String(sandbox.workspaceWrite ?? false)} shell=${String(sandbox.shell ?? false)}`,
    'All sensitive plugin abilities remain policy/approval gated.',
  ];
}

async function runPluginHook(root: string, plugin: JsonObject, command: string): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  const sandbox = (plugin.sandbox || {}) as JsonObject;
  if (sandbox.shell !== true && /(^|\s)(cmd|powershell|bash|sh|node|npm|pnpm|yarn)\b/iu.test(command)) {
    return { exitCode: 126, output: 'Plugin hook requested shell/process execution but manifest did not declare shell permission.', durationMs: 0, timedOut: false };
  }
  return runProcess(command, [], isLocalPluginSpec(root, String(plugin.spec || '')) ? resolvePluginPath(root, String(plugin.spec)) : root, 30000);
}

async function writePluginRuntimeState(file: string, plugins: unknown[]): Promise<void> {
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

function sanitizePluginRecord(value: unknown): JsonObject {
  const item = { ...((value || {}) as JsonObject) };
  if (item.signature) item.signature = '***';
  return item;
}

function isLocalPluginSpec(root: string, spec: string): boolean {
  if (!spec) return false;
  return spec.startsWith('.') || spec.startsWith('/') || /^[a-zA-Z]:[\\/]/u.test(spec) || existsSync(path.resolve(root, spec));
}

function resolvePluginPath(root: string, spec: string): string {
  return path.resolve(root, spec);
}
