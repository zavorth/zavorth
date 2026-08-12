import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  firstArg,
  readFlag,
  readNumberFlag,
  stateDir,
  ensureDir,
  readJson,
  writeJson,
  readArray,
  safeString,
  idWithTime,
  appendJsonArray,
  listAnyFiles,
  isInside,
  runProcess,
  sha256,
  render,
  walkFiles,
  getEnv,
  type JsonObject,
} from '../ZavorthCliSharedHelpers.js';

export async function runSandbox(root: string, args: string[]): Promise<{ exitCode: number; output: string }> {
  const action = firstArg(args, 'status');
  const sandboxDir = path.join(stateDir(root), 'sandboxes');
  await ensureDir(sandboxDir);
  if (action === 'doctor') {
    const { ZavorthSandboxControlPlaneService } = await import('../../services/ZavorthSandboxControlPlaneService.js');
    const service = new ZavorthSandboxControlPlaneService({ workspaceRoot: root });
    const snapshot = service.buildSnapshot({
      command: readFlag(args, 'command') || args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || null,
      requestedBy: 'operator',
      sourceSurface: 'cli:sandbox',
    });
    return render(args, 'Zavorth sandbox doctor', service.renderReport({
      command: readFlag(args, 'command') || null,
      requestedBy: 'operator',
      sourceSurface: 'cli:sandbox',
    }).split('\n'), snapshot);
  }
  if (action === 'run') {
    const id = readFlag(args, 'id') || args[1] || '';
    if (!id) {
      return render(args, 'Zavorth sandbox run', [
        'Missing sandbox id. Use: zavorth sandbox create --yes, then zavorth sandbox run <id> --command <command> --yes',
      ], { ok: false });
    }
    return runSandbox(root, ['exec', id, ...args.slice(2)]);
  }
  if (action === 'receipt' || action === 'receipts') {
    return runSandbox(root, ['logs', ...args.slice(1)]);
  }
  if (action === 'status' || action === 'backends') {
    const backends = await inspectSandboxBackends(root);
    return render(args, 'Zavorth sandbox', backends.map((backend) => `${backend.id}: ${backend.status} | ${backend.detail}`), { backends });
  }
  if (action === 'policy') {
    const file = path.join(stateDir(root), 'sandbox-policy.json');
    const policy = await readJson(file, defaultSandboxPolicy()) as JsonObject;
    if (args.includes('set')) {
      const backend = readFlag(args, 'backend') || String(policy.defaultBackend || 'local');
      const network = readFlag(args, 'network') || String(policy.network || 'blocked');
      const writes = readFlag(args, 'writes') || String(policy.writes || 'sandbox-only');
      const next = { ...policy, defaultBackend: backend, network, writes, updatedAt: new Date().toISOString() };
      await writeJson(file, next);
      return render(args, 'Zavorth sandbox policy', ['Policy updated.', `backend: ${backend}`, `network: ${network}`, `writes: ${writes}`], { policy: next });
    }
    return render(args, 'Zavorth sandbox policy', Object.entries(policy).map(([key, value]) => `${key}: ${safeString(value)}`), { policy });
  }
  if (action === 'create') {
    const backend = readFlag(args, 'backend') || String((await readJson(path.join(stateDir(root), 'sandbox-policy.json'), defaultSandboxPolicy()) as JsonObject).defaultBackend || 'local');
    const id = readFlag(args, 'id') || idWithTime('sandbox');
    const label = args.slice(1).filter((arg) => !arg.startsWith('--')).join(' ') || 'Zavorth sandbox';
    if (!args.includes('--yes')) {
      return render(args, 'Zavorth sandbox', [`Create preview: ${id}`, `Backend: ${backend}`, 'Add --yes to create isolated sandbox state.'], { dryRun: true, id, backend });
    }
    const record = await createSandbox(root, sandboxDir, { id, backend, label, args });
    return render(args, 'Zavorth sandbox', [`Created sandbox: ${id}`, `Backend: ${backend}`, `Workspace: ${String(record.workspacePath || 'n/a')}`], { sandbox: sanitizeSandboxRecord(record) });
  }
  if (action === 'list') {
    const items = await readArray(path.join(stateDir(root), 'sandboxes.json'));
    return render(args, 'Zavorth sandbox', items.length ? items.map((item) => `- ${String((item as JsonObject).id)} | ${String((item as JsonObject).backend)} | ${String((item as JsonObject).status)}`) : ['No sandboxes recorded yet.'], { sandboxes: items.map(sanitizeSandboxRecord) });
  }
  if (action === 'logs') {
    const id = args[1] || readFlag(args, 'id') || '';
    const logs = await readArray(path.join(stateDir(root), 'logs', 'sandbox.json'));
    const selected = id ? logs.filter((entry) => String((entry as JsonObject).sandboxId) === id) : logs;
    return render(args, 'Zavorth sandbox logs', selected.length ? selected.slice(-30).map((entry) => `- ${String((entry as JsonObject).createdAt)} | ${String((entry as JsonObject).sandboxId)} | ${String((entry as JsonObject).action)} | ${String((entry as JsonObject).status)}`) : ['No sandbox logs recorded yet.'], { logs: selected });
  }
  if (action === 'snapshot') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    const snapshot = await createSandboxSnapshot(root, selected);
    return render(args, 'Zavorth sandbox', [`Snapshot created: ${String(snapshot.archive)}`, `Files: ${String(snapshot.filesCount)}`], { snapshot });
  }
  if (action === 'restore') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Restore preview: ${id}`, 'Add --yes to restore files into the sandbox workspace only.'], { dryRun: true, sandbox: sanitizeSandboxRecord(selected) });
    const restored = await restoreSandboxSnapshot(root, selected, readFlag(args, 'snapshot') || '');
    return render(args, 'Zavorth sandbox', [`Restored sandbox snapshot: ${id}`, `Files: ${restored.files}`], { restored });
  }
  if (action === 'exec') {
    const id = args[1] || readFlag(args, 'id') || '';
    const command = readFlag(args, 'command') || args.slice(2).join(' ');
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!command) return render(args, 'Zavorth sandbox', ['Usage: zavorth sandbox exec <id> --command <command> [--yes]'], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Exec preview in ${id}: ${command}`, 'Add --yes to execute inside the sandbox workspace/container.'], { dryRun: true, command });
    const result = await execSandboxCommand(root, selected, command, readNumberFlag(args, 'timeout-ms') || 30000);
    await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: id, action: 'exec', status: result.exitCode === 0 ? 'completed' : 'failed', command, durationMs: result.durationMs, output: result.output.slice(0, 1000), createdAt: new Date().toISOString() });
    return render(args, 'Zavorth sandbox', [`Exec ${result.exitCode === 0 ? 'completed' : 'failed'}: ${id}`, result.output.slice(0, 1200) || '<empty output>'], { result });
  }
  if (action === 'destroy' || action === 'remove') {
    const id = args[1] || readFlag(args, 'id') || '';
    const selected = await findSandbox(root, id);
    if (!selected) return render(args, 'Zavorth sandbox', [`No sandbox found: ${id || '<missing>'}`], { ok: false });
    if (!args.includes('--yes')) return render(args, 'Zavorth sandbox', [`Destroy preview: ${id}`, 'Add --yes to remove sandbox workspace/container metadata.'], { dryRun: true, sandbox: sanitizeSandboxRecord(selected) });
    const destroyed = await destroySandbox(root, selected);
    return render(args, 'Zavorth sandbox', [`Destroyed sandbox: ${id}`], { destroyed });
  }
  return render(args, 'Zavorth sandbox', ['Supported: status, backends, policy, create, list, snapshot, restore, exec, logs, destroy'], { ok: true });
}

function defaultSandboxPolicy(): JsonObject {
  return {
    defaultBackend: 'local',
    network: 'blocked',
    writes: 'sandbox-only',
    dockerImage: 'node:20-alpine',
    firecracker: 'requires-explicit-backend',
    updatedAt: null,
  };
}

async function inspectSandboxBackends(root: string): Promise<Array<{ id: string; status: string; detail: string }>> {
  const docker = await runProcess('docker', ['--version'], root, 3000);
  const wsl = process.platform === 'win32' ? await runProcess('wsl', ['--status'], root, 3000) : { exitCode: 1, output: 'not-windows', durationMs: 0, timedOut: false };
  const firecrackerPath = getEnv('FIRECRACKER_BIN') || getEnv('FIRECRACKER_PATH') || '';
  return [
    { id: 'local', status: 'available', detail: 'copy-on-write workspace directory under .zavorth/sandboxes' },
    { id: 'docker', status: docker.exitCode === 0 ? 'available' : 'missing', detail: docker.output.split(/\r?\n/u)[0] || 'docker CLI not found' },
    { id: 'wsl', status: wsl.exitCode === 0 ? 'available' : 'missing', detail: wsl.output.split(/\r?\n/u)[0] || 'WSL not available from this shell' },
    { id: 'firecracker', status: firecrackerPath && existsSync(firecrackerPath) ? 'available' : 'unconfigured', detail: firecrackerPath || 'set FIRECRACKER_BIN to enable microVM backend' },
  ];
}

async function createSandbox(root: string, sandboxDir: string, input: { id: string; backend: string; label: string; args: string[] }): Promise<JsonObject> {
  const recordsFile = path.join(stateDir(root), 'sandboxes.json');
  const records = await readArray(recordsFile);
  const workspacePath = path.join(sandboxDir, input.id, 'workspace');
  const record: JsonObject = {
    id: input.id,
    label: input.label,
    backend: input.backend,
    status: 'created',
    workspacePath,
    createdAt: new Date().toISOString(),
  };
  if (['local', 'wsl', 'firecracker'].includes(input.backend)) {
    await copyWorkspaceForSandbox(root, workspacePath);
  }
  if (input.backend === 'docker') {
    const image = readFlag(input.args, 'image') || String((await readJson(path.join(stateDir(root), 'sandbox-policy.json'), defaultSandboxPolicy()) as JsonObject).dockerImage || 'node:20-alpine');
    const containerName = `zavorth-${input.id}`.replace(/[^a-zA-Z0-9_.-]+/gu, '-');
    const create = await runProcess('docker', ['create', '--name', containerName, image, 'sleep', '3600'], root, 30000);
    record.containerName = containerName;
    record.image = image;
    record.status = create.exitCode === 0 ? 'container-created' : 'create-failed';
    record.docker = { exitCode: create.exitCode, output: create.output.slice(0, 1000) };
    if (create.exitCode === 0 && input.args.includes('--start')) {
      const start = await runProcess('docker', ['start', containerName], root, 30000);
      record.status = start.exitCode === 0 ? 'running' : 'start-failed';
      record.dockerStart = { exitCode: start.exitCode, output: start.output.slice(0, 1000) };
    }
  }
  records.push(record);
  await writeJson(recordsFile, records);
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: input.id, action: 'create', status: record.status, backend: input.backend, createdAt: new Date().toISOString() });
  return record;
}

async function copyWorkspaceForSandbox(root: string, destination: string): Promise<void> {
  await ensureDir(destination);
  const files = (await walkFiles(root, 1500))
    .filter((file) => {
      const relative = path.relative(root, file).replace(/\\/gu, '/');
      return !relative.startsWith('.git/')
        && !relative.startsWith('node_modules/')
        && !relative.startsWith('.zavorth/sandboxes/')
        && !relative.startsWith('.zavorth/logs/')
        && !relative.includes('/node_modules/');
    });
  for (const file of files) {
    const relative = path.relative(root, file);
    const target = path.join(destination, relative);
    if (!isInside(destination, target)) continue;
    await ensureDir(path.dirname(target));
    await fs.copyFile(file, target);
  }
}

async function findSandbox(root: string, id: string): Promise<JsonObject | null> {
  const records = await readArray(path.join(stateDir(root), 'sandboxes.json'));
  return (records.find((entry) => String((entry as JsonObject).id) === id) as JsonObject | undefined) || null;
}

async function createSandboxSnapshot(root: string, sandbox: JsonObject): Promise<JsonObject> {
  const workspacePath = String(sandbox.workspacePath || '');
  if (!workspacePath || !isInside(stateDir(root), workspacePath) || !existsSync(workspacePath)) {
    return { ok: false, reason: 'sandbox-workspace-missing' };
  }
  const snapshotDir = path.join(stateDir(root), 'sandbox-snapshots');
  await ensureDir(snapshotDir);
  const id = idWithTime('sandbox-snapshot');
  const files = await Promise.all((await walkFiles(workspacePath, 2000)).map(async (file) => {
    const raw = await fs.readFile(file);
    return { file: path.relative(workspacePath, file), bytes: raw.byteLength, sha256: sha256(raw), contentBase64: raw.toString('base64') };
  }));
  const manifest = { id, sandboxId: sandbox.id, createdAt: new Date().toISOString(), files };
  const archive = path.join(snapshotDir, `${id}.zavsandbox.gz`);
  await fs.writeFile(archive, await require('zlib').gzipSync(Buffer.from(JSON.stringify(manifest), 'utf8')));
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'snapshot', status: 'completed', archive, files: files.length, createdAt: new Date().toISOString() });
  return { id, archive, filesCount: files.length, sandboxId: sandbox.id };
}

async function restoreSandboxSnapshot(root: string, sandbox: JsonObject, snapshotPath: string): Promise<{ files: number }> {
  const workspacePath = String(sandbox.workspacePath || '');
  const snapshotDir = path.join(stateDir(root), 'sandbox-snapshots');
  const archive = snapshotPath
    ? (path.isAbsolute(snapshotPath) ? snapshotPath : path.join(snapshotDir, snapshotPath))
    : (await listAnyFiles(snapshotDir)).filter((file) => file.endsWith('.zavsandbox.gz')).sort().at(-1) || '';
  if (!archive || !existsSync(archive)) return { files: 0 };
  const manifest = JSON.parse((await require('zlib').gunzipSync(await fs.readFile(archive))).toString('utf8')) as { files?: Array<JsonObject> };
  let restored = 0;
  for (const file of manifest.files || []) {
    const target = path.join(workspacePath, String(file.file || ''));
    if (!isInside(workspacePath, target)) continue;
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, Buffer.from(String(file.contentBase64 || ''), 'base64'));
    restored += 1;
  }
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'restore', status: 'completed', files: restored, createdAt: new Date().toISOString() });
  return { files: restored };
}

async function execSandboxCommand(root: string, sandbox: JsonObject, command: string, timeoutMs: number): Promise<{ exitCode: number; output: string; durationMs: number; timedOut: boolean }> {
  if (sandbox.backend === 'docker' && sandbox.containerName) {
    return runProcess('docker', ['exec', String(sandbox.containerName), 'sh', '-lc', command], root, timeoutMs);
  }
  const cwd = String(sandbox.workspacePath || root);
  if (!isInside(stateDir(root), cwd)) {
    return { exitCode: 126, output: 'Sandbox workspace is outside Zavorth state directory.', durationMs: 0, timedOut: false };
  }
  return runProcess(command, [], cwd, timeoutMs);
}

async function destroySandbox(root: string, sandbox: JsonObject): Promise<JsonObject> {
  const recordsFile = path.join(stateDir(root), 'sandboxes.json');
  const records = (await readArray(recordsFile)).filter((entry) => String((entry as JsonObject).id) !== String(sandbox.id));
  const result: JsonObject = { id: sandbox.id, backend: sandbox.backend, removedWorkspace: false, removedContainer: false };
  if (sandbox.backend === 'docker' && sandbox.containerName) {
    const docker = await runProcess('docker', ['rm', '-f', String(sandbox.containerName)], root, 30000);
    result.removedContainer = docker.exitCode === 0;
    result.docker = { exitCode: docker.exitCode, output: docker.output.slice(0, 500) };
  }
  const workspacePath = String(sandbox.workspacePath || '');
  if (workspacePath && isInside(stateDir(root), workspacePath) && existsSync(workspacePath)) {
    await fs.rm(path.dirname(workspacePath), { recursive: true, force: true });
    result.removedWorkspace = true;
  }
  await writeJson(recordsFile, records);
  await appendJsonArray(path.join(stateDir(root), 'logs', 'sandbox.json'), { id: idWithTime('sandbox-log'), sandboxId: sandbox.id, action: 'destroy', status: 'completed', createdAt: new Date().toISOString() });
  return result;
}

function sanitizeSandboxRecord(value: unknown): JsonObject {
  return { ...((value || {}) as JsonObject) };
}
