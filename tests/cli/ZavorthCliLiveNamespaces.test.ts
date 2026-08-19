import * as fs from 'fs';
import { resolve } from 'node:path';
import * as os from 'os';
import * as path from 'path';
import { runZavorthLiveNamespaceCommand } from '../../src/cli/ZavorthCliLiveNamespaces';


function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-cli-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { chalk: '^5.0.0' } }));
  return root;
}

function writeMockMcpServer(root: string): string {
  const serverPath = path.join(root, 'mock-mcp-server.js');
  fs.writeFileSync(serverPath, `
let buffer = Buffer.alloc(0);
function frame(payload) {
  const body = JSON.stringify(payload);
  return 'Content-Length: ' + Buffer.byteLength(body) + '\\r\\n\\r\\n' + body;
}
function parse() {
  while (buffer.length) {
    const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
    if (headerEnd < 0) return;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = header.match(/content-length:\\s*(\\d+)/i);
    if (!match) return;
    const len = Number(match[1]);
    const start = headerEnd + 4;
    const end = start + len;
    if (buffer.length < end) return;
    const request = JSON.parse(buffer.slice(start, end).toString('utf8'));
    buffer = buffer.slice(end);
    let result = {};
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'mock' } };
    if (request.method === 'tools/list') result = { tools: [{ name: 'read_file' }, { name: 'write_file' }] };
    if (request.method === 'resources/list') result = { resources: [{ uri: 'file://README.md' }, { uri: 'secret://token' }] };
    process.stdout.write(frame({ jsonrpc: '2.0', id: request.id, result }));
  }
}
process.stdin.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); parse(); });
`);
  return serverPath;
}

describe('Zavorth live CLI namespaces', () => {
  test('creates and lists local backup manifests', async () => {
    const root = makeRoot();
    const created = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create'] });
    const listed = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['list'] });

    expect(created.output).toContain('Created archive:');
    expect(listed.output).toContain('.zavbak.gz');
    expect(fs.existsSync(path.join(root, '.zavorth', 'backups'))).toBe(true);
  });

  test('sets and reads config values without requiring setup', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['set', 'profile.name', 'operator'] });
    const read = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['get', 'profile.name'] });

    expect(read.output).toContain('profile.name: operator');
  });

  test('isolates config profiles and exports redacted config', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['profile', 'create', 'work'] });
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['set', 'provider.name', 'openai', '--profile', 'work'] });
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['set', 'provider.apiKey', 'secret-value', '--profile', 'work'] });
    const exported = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['export', '--profile', 'work', '--output', path.join(root, 'config-export.json')] });
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'config-export.json'), 'utf8'));

    expect(exported.output).toContain('Exported config');
    expect(payload.config.provider.name).toBe('openai');
    expect(payload.config.provider.apiKey).toBe('***');
    expect(fs.existsSync(path.join(root, '.zavorth', 'profiles', 'work', 'cli-config.json'))).toBe(true);
  });

  test('validates config requirements without exposing secrets', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'config',
      args: ['import', path.join(root, 'missing.json')],
    });
    fs.writeFileSync(path.join(root, 'cfg.json'), JSON.stringify({ requirements: ['MISSING_TEST_KEY'] }));
    const preview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['import', path.join(root, 'cfg.json')] });
    const applied = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['import', path.join(root, 'cfg.json'), '--yes'] });
    const requirements = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['requirements'] });

    expect(preview.output).toContain('Import preview');
    expect(applied.output).toContain('Imported config');
    expect(requirements.output).toContain('missing env:MISSING_TEST_KEY');
  });

  test('previews managed config and applies only when requirements pass', async () => {
    const root = makeRoot();
    const managedFile = path.join(root, 'managed.json');
    fs.writeFileSync(managedFile, JSON.stringify({
      config: {
        provider: { name: 'openai', model: 'gpt-test' },
        trust: { approvalMode: 'balanced', sandboxDefault: 'local', redactSecrets: true },
        requirements: [{ kind: 'env', name: 'ZAVORTH_TEST_READY', required: true }],
      },
    }));
    const original = process.env.ZAVORTH_TEST_READY;
    delete process.env.ZAVORTH_TEST_READY;
    try {
      const preview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['managed', '--file', managedFile] });
      const blocked = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['managed', '--file', managedFile, '--yes'] });
      process.env.ZAVORTH_TEST_READY = '1';
      const applied = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'config', args: ['managed', '--file', managedFile, '--yes'] });

      expect(preview.output).toContain('Managed config preview');
      expect(blocked.output).toContain('blocked');
      expect(applied.output).toContain('Managed config applied');
      expect(fs.existsSync(path.join(root, '.zavorth', 'receipts', 'managed-config.json'))).toBe(true);
    } finally {
      if (original === undefined) delete process.env.ZAVORTH_TEST_READY;
      else process.env.ZAVORTH_TEST_READY = original;
    }
  });

  test('adds MCP entries to local governed config', async () => {
    const root = makeRoot();
    const added = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'mcp', args: ['add', 'filesystem', 'node server.js'] });
    const listed = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'mcp', args: ['list'] });

    expect(added.output).toContain('Added MCP server: filesystem');
    expect(listed.output).toContain('filesystem');
  });

  test('performs MCP handshake and lists allowlisted tools/resources', async () => {
    const root = makeRoot();
    const serverPath = writeMockMcpServer(root);
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'mcp',
      args: ['add', 'mock', `node "${serverPath}"`, '--allow-tools', 'read_file', '--allow-resources', 'file://README.md'],
    });
    const doctor = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'mcp',
      args: ['doctor', 'mock', '--run', '--yes', '--json'],
    });
    const payload = JSON.parse(doctor.output);

    expect(payload.snapshot.initialized).toBe(true);
    expect(payload.snapshot.toolsCount).toBe(1);
    expect(payload.snapshot.resourcesCount).toBe(1);
    expect(fs.existsSync(path.join(root, '.zavorth', 'mcp-runtime.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'logs', 'mcp.json'))).toBe(true);
  }, 30000);

  test('updates MCP allowlists and channel bridges without starting the server', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'mcp', args: ['add', 'mock', 'node server.js'] });
    const allow = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'mcp', args: ['allowlist', 'mock', '--tools', 'a,b', '--resources', 'r1'] });
    const bridge = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'mcp', args: ['bridge', 'mock', '--channel', 'telegram'] });
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'mcp-runtime.json'), 'utf8'));

    expect(allow.output).toContain('Updated allowlist');
    expect(bridge.output).toContain('Bridge set');
    expect(runtime.servers[0].allowTools).toEqual(['a', 'b']);
    expect(runtime.servers[0].channelBridge).toBe('telegram');
  }, 30000);

  test('creates message drafts without printing message body in full', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['send', '--channel', 'telegram', '--target', 'test-chat', '--message', 'secret body text'],
    });

    expect(result.output).toContain('Created draft');
    expect(result.output).not.toContain('secret body text');
    expect(fs.existsSync(path.join(root, '.zavorth', 'messages.json'))).toBe(true);
  });

  test('records failed live delivery without throwing when credentials are missing', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['send', '--channel', 'telegram', '--target', 'test-chat', '--message', 'hello', '--deliver'],
    });

    expect(result.output).toContain('delivery-failed');
    expect(result.output).not.toContain('hello');
  });

  test('previews plugin install without running npm until confirmed', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['install', 'left-pad'],
    });

    expect(result.output).toContain('Preview install: left-pad');
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins.json'))).toBe(false);
  });

  test('scaffolds a governed plugin SDK package only after confirmation', async () => {
    const root = makeRoot();
    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['scaffold', 'my-plugin'],
    });
    const created = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['scaffold', 'my-plugin', '--yes', '--json'],
    });
    const payload = JSON.parse(created.output);

    expect(preview.output).toContain('Add --yes');
    // Plugin OS scaffolds under plugins/<id> by default (not workspace root).
    expect(fs.existsSync(path.join(root, 'plugins', 'my-plugin'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'plugins', 'my-plugin', 'zavorth.plugin.json'))).toBe(true);
    expect(payload.plugin.manifest.permissions).toContain('workspace:read');
  }, 30000);

  test('registers local plugin manifests with checksum and permissions', async () => {
    const root = makeRoot();
    const pluginDir = path.join(root, 'sample-plugin');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'index.js'), 'console.log("plugin")');
    fs.writeFileSync(path.join(pluginDir, 'zavorth.plugin.json'), JSON.stringify({
      name: 'sample-plugin',
      version: '1.0.0',
      entry: 'index.js',
      permissions: ['workspace:read'],
      hooks: { doctor: 'node index.js' },
    }));

    const installed = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['install', './sample-plugin', '--yes', '--json'],
    });
    const payload = JSON.parse(installed.output);

    expect(payload.record.status).toBe('installed');
    expect(payload.record.checksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(payload.record.permissions).toContain('workspace:read');
  });

  test('certifies operational readiness domains from the CLI', async () => {
    const projectRoot = resolve(__dirname, '..', '..');
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot,
      command: 'certify',
      args: ['--json'],
    });
    const payload = JSON.parse(result.output);

    expect(result.exitCode).toBe(0);
    expect(payload.contractVersion).toBe('zavorth-operational-consistency/1');
    expect(payload.status).toBe('pass');
    expect(payload.domains.map((domain: { id: string }) => domain.id)).toContain('channels');
    expect(payload.domains.map((domain: { id: string }) => domain.id)).toContain('gateway');
    expect(payload.domains.map((domain: { id: string }) => domain.id)).toContain('plugins');
  });

  test('rejects unknown certification targets instead of falling back to operational readiness', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'certify',
      args: ['made-up-target', '--json'],
    });
    const payload = JSON.parse(result.output);

    expect(result.exitCode).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('Unknown certify target');
    expect(payload.allowedTargets).toContain('operational');
  });

  test('blocks plugin install when expected checksum does not match', async () => {
    const root = makeRoot();
    const pluginDir = path.join(root, 'sample-plugin');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'zavorth.plugin.json'), JSON.stringify({ name: 'sample-plugin' }));

    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['install', './sample-plugin', '--checksum', 'bad'],
    });

    expect(result.output).toContain('Checksum mismatch');
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins.json'))).toBe(false);
  });

  test('enables plugins into runtime state only after confirmation', async () => {
    const root = makeRoot();
    const pluginDir = path.join(root, 'sample-plugin');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'zavorth.plugin.json'), JSON.stringify({ name: 'sample-plugin', permissions: ['workspace:read'] }));
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['install', './sample-plugin', '--yes'] });

    const preview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['enable', 'sample-plugin'] });
    const enabled = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['enable', 'sample-plugin', '--yes'] });
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'plugins-runtime.json'), 'utf8'));

    expect(preview.output).toContain('Enable preview');
    expect(enabled.output).toContain('Enabled: sample-plugin');
    expect(runtime.enabled[0].id).toBe('sample-plugin');
  });

  test('runs plugin doctor and previews lifecycle hooks before execution', async () => {
    const root = makeRoot();
    const pluginDir = path.join(root, 'sample-plugin');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'index.js'), 'console.log("plugin")');
    fs.writeFileSync(path.join(pluginDir, 'zavorth.plugin.json'), JSON.stringify({
      name: 'sample-plugin',
      permissions: ['workspace:read'],
      hooks: { doctor: 'node index.js' },
    }));
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['install', './sample-plugin', '--yes'] });

    const doctor = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['doctor', 'sample-plugin'] });
    const hook = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'plugins', args: ['run-hook', 'sample-plugin', 'doctor'] });

    expect(doctor.output).toContain('ok manifest');
    expect(hook.output).toContain('Hook preview');
    expect(hook.output).toContain('Add --yes');
  });

  test('lists bundled and local plugin marketplace entries', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'plugins',
      args: ['marketplace', 'workspace'],
    });

    expect(result.output).toContain('Workspace Inspector');
  });

  test('searches and indexes local docs with excerpts', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'trust.md'), '# Trust\nPolicy receipts and governed approvals.');
    const search = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'docs',
      args: ['search', 'receipts'],
    });
    const index = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'docs',
      args: ['index'],
    });

    expect(search.output).toContain('trust.md');
    expect(search.output).toContain('Policy receipts');
    expect(index.output).toContain('Indexed docs: 1');
    expect(fs.existsSync(path.join(root, '.zavorth', 'docs-index.json'))).toBe(true);
  });

  test('keeps live docs fetch preview-first', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'docs',
      args: ['live', '--url', 'https://example.com/docs.txt'],
    });

    expect(result.output).toContain('Live docs search preview');
    expect(result.output).toContain('Add --yes');
  });

  test('previews backup restore without writing files', async () => {
    const root = makeRoot();
    const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create'] });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ changed: true }));
    const restore = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['restore'] });

    expect(restore.output).toContain('Restore preview only');
    expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).not.toBe(before);
  });

  test('verifies backup checksums rigorously', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create'] });
    const verified = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['verify'] });

    expect(verified.output).toContain('Checksums: valid');
    expect(verified.output).toContain('Format: zavorth-backup/v2');
  });

  test('restores selected backup files only', async () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'keep.txt'), 'original keep');
    fs.writeFileSync(path.join(root, 'restore.txt'), 'original restore');
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create', '--include', 'keep.txt', '--include', 'restore.txt'] });
    fs.writeFileSync(path.join(root, 'keep.txt'), 'changed keep');
    fs.writeFileSync(path.join(root, 'restore.txt'), 'changed restore');
    const restored = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['restore', '--file', 'restore.txt', '--yes'] });

    expect(restored.output).toContain('Restored files: 1');
    expect(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8')).toBe('changed keep');
    expect(fs.readFileSync(path.join(root, 'restore.txt'), 'utf8')).toBe('original restore');
  });

  test('creates and verifies encrypted backups with passphrase env', async () => {
    const root = makeRoot();
    const original = process.env.ZAVORTH_TEST_BACKUP_PASSPHRASE;
    process.env.ZAVORTH_TEST_BACKUP_PASSPHRASE = 'test-passphrase';
    try {
      const created = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create', '--encrypt', '--passphrase-env', 'ZAVORTH_TEST_BACKUP_PASSPHRASE'] });
      const verified = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['verify', '--passphrase-env', 'ZAVORTH_TEST_BACKUP_PASSPHRASE'] });

      expect(created.output).toContain('Mode: encrypted');
      expect(verified.output).toContain('Checksums: valid');
      expect(fs.readdirSync(path.join(root, '.zavorth', 'backups')).some((file) => file.endsWith('.zavbak.enc'))).toBe(true);
    } finally {
      if (original === undefined) delete process.env.ZAVORTH_TEST_BACKUP_PASSPHRASE;
      else process.env.ZAVORTH_TEST_BACKUP_PASSPHRASE = original;
    }
  });

  test('migrates backup manifests and imports runtime adapter state with preview-first writes', async () => {
    const root = makeRoot();
    const source = path.join(root, 'external-state');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'config.json'), JSON.stringify({ provider: 'example' }));
    await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['create'] });
    const migrationPreview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['migrate', '--to-version', '3'] });
    const importedPreview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['import', '--source', source, '--agent', 'runtime-adapter'] });
    const imported = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'backup', args: ['import', '--source', source, '--agent', 'runtime-adapter', '--yes'] });

    expect(migrationPreview.output).toContain('Migration preview only');
    expect(migrationPreview.output).toContain('To: 3');
    expect(importedPreview.output).toContain('Import preview only');
    expect(imported.output).toContain('Imported mapped agent state');
    expect(fs.existsSync(path.join(root, '.zavorth', 'imports', 'runtime-adapter.json'))).toBe(true);
  });

  test('lists and reads redacted message drafts', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['send', '--channel', 'telegram', '--target', 'test-chat', '--message', 'very secret body'],
    });
    const list = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'message', args: ['list'] });
    const id = list.output.match(/message-\d+/u)?.[0] || '';
    const read = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'message', args: ['read', id] });

    expect(list.output).toContain('message-');
    expect(read.output).toContain('message: very...dy');
    expect(read.output).not.toContain('very secret body');
  });

  test('previews runnable task execution until confirmed', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['add', 'echo-task', '--command', 'node -e "console.log(1)"'],
    });
    const list = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'tasks', args: ['list'] });
    const id = list.output.match(/task-\d+/u)?.[0] || '';
    const preview = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'tasks', args: ['run', id] });

    expect(preview.output).toContain('Run preview');
    expect(preview.output).toContain('Add --yes');
  });

  test('runs due tasks through durable worker with logs and lock cleanup', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['add', 'worker-task', '--command', 'node -e "console.log(7)"', '--id', 'task-worker'],
    });
    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['worker'],
    });
    const worker = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['worker', '--once', '--yes'],
    });
    const logs = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['logs', 'task-worker'],
    });
    const records = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'tasks.json'), 'utf8'));

    expect(preview.output).toContain('Worker preview only');
    expect(worker.output).toContain('Processed 1 task(s).');
    expect(records[0].status).toBe('completed');
    expect(logs.output).toContain('completed');
    expect(fs.existsSync(path.join(root, '.zavorth', 'tasks.lock'))).toBe(false);
  }, 30000);

  test('schedules task retries after worker failures', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['add', 'retry-task', '--id', 'task-retry', '--command', 'node -e "process.exit(2)"', '--retries', '1'],
    });
    const worker = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['worker', '--yes'],
    });
    const records = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'tasks.json'), 'utf8'));

    expect(worker.output).toContain('Processed 1 task(s).');
    expect(records[0].status).toBe('queued');
    expect(records[0].attempts).toBe(1);
    expect(records[0].nextRunAt).toBeTruthy();
  }, 30000);

  test('supports task graph, cancel and resume lifecycle', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['add', 'base', '--id', 'task-a', '--command', 'node -e "console.log(1)"'],
    });
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'tasks',
      args: ['add', 'child', '--id', 'task-b', '--command', 'node -e "console.log(2)"', '--depends-on', 'task-a'],
    });
    const graph = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'tasks', args: ['graph'] });
    const cancel = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'tasks', args: ['cancel', 'task-b'] });
    const resume = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'tasks', args: ['resume', 'task-b'] });

    expect(graph.output).toContain('task-a -> task-b');
    expect(cancel.output).toContain('Cancelled task: task-b');
    expect(resume.output).toContain('Resumed task: task-b');
  });

  test('runs due cron jobs and reschedules interval jobs', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'cron',
      args: ['add', 'heartbeat', '--id', 'cron-heartbeat', '--command', 'node -e "console.log(1)"', '--every-ms', '60000'],
    });
    const worker = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'cron',
      args: ['worker', '--yes'],
    });
    const records = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'cron-jobs.json'), 'utf8'));

    expect(worker.output).toContain('Processed 1 job(s).');
    expect(records[0].status).toBe('scheduled');
    expect(new Date(records[0].nextRunAt).getTime()).toBeGreaterThan(Date.now());
  }, 30000);

  test('adds webhook and keeps test in dry-run without confirmation', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'webhooks',
      args: ['add', 'local', '--url', 'https://example.com/hook?auth=secret'],
    });
    const test = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'webhooks', args: ['test', 'local'] });

    expect(test.output).toContain('Test preview');
    expect(test.output).toContain('auth=***');
    expect(test.output).not.toContain('secret');
  });

  test('reports provider readiness and refuses live infer without confirmation', async () => {
    const root = makeRoot();
    const status = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'infer', args: ['status'] });
    const live = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'infer',
      args: ['text', 'hello', '--live', '--provider', 'openai'],
    });

    expect(status.output).toContain('openai:');
    expect(live.output).toContain('Live provider call requires --yes');
  });

  test('reports failed live infer cleanly when credentials are missing', async () => {
    const root = makeRoot();
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const live = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'infer',
        args: ['text', 'hello', '--live', '--yes', '--provider', 'openai'],
      });
      expect(live.output).toContain('Status: failed');
      expect(live.output).toContain('missing-openai-api-key');
    } finally {
      if (original) process.env.OPENAI_API_KEY = original;
    }
  });

  test('refuses live channel read without confirmation', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['read', '--channel', 'telegram', '--live'],
    });

    expect(result.output).toContain('Live read requires --yes');
  });

  test('reports long-tail channel readiness in message status', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['status'],
    });

    expect(result.output).toContain('whatsapp:');
    expect(result.output).toContain('signal:');
    expect(result.output).toContain('matrix:');
    expect(result.output).toContain('microsoft-teams:');
    expect(result.output).toContain('nextcloud-talk:');
    expect(result.output).toContain('nostr:');
  });

  test('queues local bridge channel delivery through an outbox without printing the body', async () => {
    const root = makeRoot();
    const outbox = path.join(root, 'bridge-outbox');
    const original = process.env.WHATSAPP_OUTBOX_DIR;
    process.env.WHATSAPP_OUTBOX_DIR = outbox;
    try {
      const result = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'message',
        args: ['send', '--channel', 'whatsapp', '--target', '+15550101', '--message', 'private hello', '--deliver'],
      });
      const queued = fs.readdirSync(outbox).filter((file) => file.endsWith('.json'));

      expect(result.output).toContain('Created delivered');
      expect(result.output).not.toContain('private hello');
      expect(queued.length).toBe(1);
    } finally {
      if (original === undefined) {
        delete process.env.WHATSAPP_OUTBOX_DIR;
      } else {
        process.env.WHATSAPP_OUTBOX_DIR = original;
      }
    }
  });

  test('fails configured API channel delivery cleanly when required credentials are missing', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['send', '--channel', 'matrix', '--target', '!room:example.org', '--message', 'hello', '--deliver', '--json'],
    });

    expect(result.output).toContain('delivery-failed');
    expect(result.output).toContain('missing-matrix-base-url-token-or-room-id');
    expect(result.output).not.toContain('"hello"');
  });

  test('creates consumable pairing drafts without exposing raw hashes', async () => {
    const root = makeRoot();
    const created = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'pairing',
      args: ['create', '--channel', 'telegram', '--target', '123', '--json'],
    });
    const payload = JSON.parse(created.output);
    const id = payload.pairing.id;

    expect(created.output).toContain('zavorth://pair');
    expect(payload.pairing.code).toContain('...');
    expect(payload.pairing.codeHash).toBe('***');
    expect(id).toContain('pairing-');
  });

  test('supports full pairing claim and approve flow using stored code', async () => {
    const root = makeRoot();
    const created = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'pairing',
      args: ['create', '--channel', 'telegram'],
    });
    const code = created.output.match(/Code:\s+([A-F0-9]+)/u)?.[1] || '';
    const pairings = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'pairings.json'), 'utf8'));
    const id = pairings[0].id;
    const claimed = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'pairing', args: ['claim', '--code', code, '--by', 'operator-phone'] });
    const approved = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'pairing', args: ['approve', id] });

    expect(pairings[0].code).toBeUndefined();
    expect(pairings[0].codeHash).toBeTruthy();
    expect(claimed.output).toContain('Claim recorded');
    expect(approved.output).toContain('Approved pairing');
    expect(fs.existsSync(path.join(root, '.zavorth', 'receipts', 'pairings.json'))).toBe(true);
  });

  test('generates terminal pairing QR payloads', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'qr',
      args: ['pairing', '--channel', 'whatsapp'],
    });

    expect(result.output).toContain('Pairing id:');
    expect(result.output).toContain('zavorth://pair');
    expect(fs.existsSync(path.join(root, '.zavorth', 'pairings.json'))).toBe(true);
  });

  test('stores and looks up local directory entries', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'directory',
      args: ['add', 'Main group', '--channel', 'matrix', '--id', '!room:example.org', '--kind', 'group'],
    });
    const lookup = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'directory',
      args: ['lookup', 'Main'],
    });

    expect(lookup.output).toContain('matrix');
    expect(lookup.output).toContain('Main group');
  });

  test('refuses live directory lookup without confirmation', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'directory',
      args: ['self', '--channel', 'telegram', '--live'],
    });

    expect(result.output).toContain('Live directory lookup requires --yes');
  });

  test('requires explicit file consent before delivering attachments', async () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'note.txt'), 'private attachment');
    const outbox = path.join(root, 'bridge-outbox');
    const original = process.env.WHATSAPP_OUTBOX_DIR;
    process.env.WHATSAPP_OUTBOX_DIR = outbox;
    try {
      const result = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'message',
        args: ['send', '--channel', 'whatsapp', '--target', '+1555', '--message', 'see file', '--attach', 'note.txt', '--deliver', '--json'],
      });

      expect(result.output).toContain('delivery-failed');
      expect(result.output).toContain('file-consent-required');
      expect(result.output).not.toContain('private attachment');
    } finally {
      if (original === undefined) delete process.env.WHATSAPP_OUTBOX_DIR;
      else process.env.WHATSAPP_OUTBOX_DIR = original;
    }
  });

  test('delivers attachment metadata to bridge outbox after file consent and records receipt', async () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'note.txt'), 'private attachment');
    const outbox = path.join(root, 'bridge-outbox');
    const original = process.env.WHATSAPP_OUTBOX_DIR;
    process.env.WHATSAPP_OUTBOX_DIR = outbox;
    try {
      const result = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'message',
        args: ['send', '--channel', 'whatsapp', '--target', '+1555', '--message', 'see file', '--attach', 'note.txt', '--thread', 'thread-1', '--reply-to', 'msg-1', '--mention', '@ops', '--file-consent', '--deliver'],
      });
      const receipt = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'message', args: ['receipts'] });
      const outboxPayload = JSON.parse(fs.readFileSync(path.join(outbox, fs.readdirSync(outbox)[0]), 'utf8'));

      expect(result.output).toContain('Created delivered');
      expect(receipt.output).toContain('message-receipt');
      expect(outboxPayload.attachments[0].file).toBe('note.txt');
      expect(outboxPayload.threadId).toBe('thread-1');
      expect(JSON.stringify(outboxPayload)).not.toContain('private attachment');
    } finally {
      if (original === undefined) delete process.env.WHATSAPP_OUTBOX_DIR;
      else process.env.WHATSAPP_OUTBOX_DIR = original;
    }
  });

  test('previews retry for failed or drafted messages until explicitly confirmed', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'message',
      args: ['send', '--channel', 'telegram', '--target', 'test-chat', '--message', 'retry me'],
    });
    const list = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'message', args: ['list'] });
    const id = list.output.match(/message-\d+/u)?.[0] || '';
    const retry = await runZavorthLiveNamespaceCommand({ projectRoot: root, command: 'message', args: ['retry', id] });

    expect(retry.output).toContain('Retry preview');
    expect(retry.output).toContain('Add --deliver --yes');
    expect(retry.output).not.toContain('retry me');
  });

  test('applies local per-channel rate limits before delivery', async () => {
    const root = makeRoot();
    const outbox = path.join(root, 'bridge-outbox');
    const original = process.env.WHATSAPP_OUTBOX_DIR;
    process.env.WHATSAPP_OUTBOX_DIR = outbox;
    try {
      const first = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'message',
        args: ['send', '--channel', 'whatsapp', '--target', '+1555', '--message', 'one', '--deliver', '--rate-limit', '1'],
      });
      const second = await runZavorthLiveNamespaceCommand({
        projectRoot: root,
        command: 'message',
        args: ['send', '--channel', 'whatsapp', '--target', '+1555', '--message', 'two', '--deliver', '--rate-limit', '1'],
      });

      expect(first.output).toContain('Created delivered');
      expect(second.output).toContain('delivery-failed');
      expect(second.output).toContain('No secret or message body was printed in full');
    } finally {
      if (original === undefined) delete process.env.WHATSAPP_OUTBOX_DIR;
      else process.env.WHATSAPP_OUTBOX_DIR = original;
    }
  });

  test('reports sandbox backend status without requiring confirmation', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['status'],
    });

    expect(result.output).toContain('local: available');
    expect(result.output).toContain('docker:');
    expect(result.output).toContain('firecracker:');
  });

  test('previews sandbox creation until confirmed', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['create', '--id', 'sb-preview'],
    });

    expect(result.output).toContain('Create preview');
    expect(fs.existsSync(path.join(root, '.zavorth', 'sandboxes.json'))).toBe(false);
  });

  test('creates local sandbox snapshots and restores only inside sandbox workspace', async () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'app.txt'), 'before');
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['create', '--id', 'sb-local', '--yes'],
    });
    const snapshot = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['snapshot', 'sb-local'],
    });
    const records = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'sandboxes.json'), 'utf8'));
    const sandboxFile = path.join(records[0].workspacePath, 'app.txt');
    fs.writeFileSync(sandboxFile, 'changed');
    const restorePreview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['restore', 'sb-local'],
    });
    const restore = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['restore', 'sb-local', '--yes'],
    });

    expect(snapshot.output).toContain('Snapshot created');
    expect(restorePreview.output).toContain('Restore preview');
    expect(restore.output).toContain('Restored sandbox snapshot');
    expect(fs.readFileSync(sandboxFile, 'utf8')).toBe('before');
    expect(fs.readFileSync(path.join(root, 'app.txt'), 'utf8')).toBe('before');
  });

  test('previews sandbox exec and destroy until confirmed', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['create', '--id', 'sb-exec', '--yes'],
    });
    const exec = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['exec', 'sb-exec', '--command', 'node -e "console.log(1)"'],
    });
    const destroy = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['destroy', 'sb-exec'],
    });

    expect(exec.output).toContain('Exec preview');
    expect(destroy.output).toContain('Destroy preview');
    expect(fs.existsSync(path.join(root, '.zavorth', 'sandboxes.json'))).toBe(true);
  });

  test('updates sandbox policy through CLI', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'sandbox',
      args: ['policy', 'set', '--backend', 'docker', '--network', 'blocked', '--writes', 'sandbox-only'],
    });
    const policy = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'sandbox-policy.json'), 'utf8'));

    expect(result.output).toContain('Policy updated');
    expect(policy.defaultBackend).toBe('docker');
  });

  test('installs daemon service config and previews start/stop operations', async () => {
    const root = makeRoot();
    const install = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'daemon',
      args: ['install', '--command', 'node service.js'],
    });
    const start = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'daemon',
      args: ['start'],
    });
    const health = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'daemon',
      args: ['health'],
    });

    expect(install.output).toContain('Installed daemon service config');
    expect(start.output).toContain('Start preview');
    expect(health.output).toContain('installed: true');
    expect(fs.existsSync(path.join(root, '.zavorth', 'logs', 'daemon.json'))).toBe(true);
  });

  test('supports gateway service config through the live namespace', async () => {
    const root = makeRoot();
    const install = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'gateway',
      args: ['install', '--command', 'node gateway.js'],
    });
    const logs = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'gateway',
      args: ['logs'],
    });

    expect(install.output).toContain('Installed gateway service config');
    expect(logs.output).toContain('install');
  });

  test('creates node pairing records and queues remote execution previews', async () => {
    const root = makeRoot();
    const pair = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'nodes',
      args: ['pair', 'headless', '--id', 'node-a', '--label', 'worker'],
    });
    const claim = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'nodes',
      args: ['claim', 'node-a'],
    });
    const exec = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'nodes',
      args: ['exec', 'node-a', '--command', 'node -e "console.log(1)"'],
    });
    const records = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'nodes.json'), 'utf8'));

    expect(pair.output).toContain('Created node pairing');
    expect(claim.output).toContain('Node paired');
    expect(exec.output).toContain('Remote exec preview');
    expect(records[0].queue.length).toBe(1);
  });

  test('node host start remains preview-first without confirmation', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'node',
      args: ['host', '--id', 'host-a', '--command', 'node host.js'],
    });

    expect(result.output).toContain('Node host preview');
    expect(fs.existsSync(path.join(root, '.zavorth', 'nodes.json'))).toBe(false);
  });

  test('lists skill marketplace entries and filters by requirements', async () => {
    const root = makeRoot();
    const marketplace = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['marketplace', 'security'],
    });
    const requirements = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['requirements', 'WEB_SEARCH_PROVIDER'],
    });

    expect(marketplace.output).toContain('security-review');
    expect(requirements.output).toContain('web-research');
    expect(requirements.output).toContain('WEB_SEARCH_PROVIDER');
  });

  test('previews skill installs before writing registry state', async () => {
    const root = makeRoot();
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['install', 'debugging'],
    });

    expect(result.output).toContain('Install preview');
    expect(fs.existsSync(path.join(root, '.zavorth', 'skills.json'))).toBe(false);
  });

  test('requires allowlist before enabling governed skills', async () => {
    const root = makeRoot();
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['install', 'security-review', '--yes'],
    });
    const blocked = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['enable', 'security-review', '--yes'],
    });
    const allow = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['allowlist', 'add', 'security-review'],
    });
    const enabled = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['enable', 'security-review', '--yes'],
    });
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'skills-runtime.json'), 'utf8'));

    expect(blocked.output).toContain('Skill is not allowlisted');
    expect(allow.output).toContain('Allowlisted skill');
    expect(enabled.output).toContain('Enabled skill: security-review');
    expect(runtime.enabled[0].id).toBe('security-review');
  });

  test('runs doctor for local skills and reports missing dependencies', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', 'catalog.json'), JSON.stringify([{
      id: 'local-skill',
      name: 'Local Skill',
      summary: 'Local governed skill.',
      dependencies: ['missing-dep-for-zavorth-test'],
      requirements: [],
    }]));
    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['doctor', 'local-skill'],
    });

    expect(result.output).toContain('fail dependencies');
    expect(result.output).toContain('Missing dependencies');
  });

  test('previews and records live proof for skills', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', 'catalog.json'), JSON.stringify([{
      id: 'proof-skill',
      name: 'Proof Skill',
      summary: 'Skill with a fast proof command.',
      proof: { command: 'node -e "console.log(42)"' },
    }]));
    const preview = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['proof', 'proof-skill'],
    });
    const proof = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'skills',
      args: ['proof', 'proof-skill', '--yes'],
    });
    const receipts = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'receipts', 'skills.json'), 'utf8'));

    expect(preview.output).toContain('Live proof preview');
    expect(proof.output).toContain('Proof passed: proof-skill');
    expect(receipts[0].skillId).toBe('proof-skill');
  }, 30000);
});
