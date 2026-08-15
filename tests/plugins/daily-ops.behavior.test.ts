import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';


const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(workspace: string, permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const hooks: Array<{ name: string; handler: Function }> = [];
  return {
    capabilities,
    hooks,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      registerHook(name: string, handler: Function) {
        hooks.push({ name, handler });
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return permission;
      },
      emit() {},
    },
  };
}

function load(id: string) {
  return requireFromTest(path.join(PLUGINS, id, 'index.js'));
}

describe('Daily Ops pack behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function tempWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-ops-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"tmp"}\n');
    return root;
  }

  it('workspace-doctor returns checks and nextSteps', async () => {
    const root = tempWorkspace();
    const mock = createMockCtx(root);
    load('workspace-doctor').register(mock.ctx);
    const run = mock.capabilities.get('doctor.run');
    expect(run).toBeTruthy();
    const result = await run!({ input: {} });
    expect(result.output.ok).toBeDefined();
    expect(Array.isArray(result.output.checks)).toBe(true);
    expect(result.output.checks.length).toBeGreaterThan(3);
    expect(Array.isArray(result.output.nextSteps)).toBe(true);
  });

  it('task-board add/list/move/complete', async () => {
    const root = tempWorkspace();
    const mock = createMockCtx(root);
    load('task-board').register(mock.ctx);

    const add = mock.capabilities.get('task.add')!;
    const list = mock.capabilities.get('task.list')!;
    const move = mock.capabilities.get('task.move')!;
    const complete = mock.capabilities.get('task.complete')!;

    const created = await add({ input: { title: 'Ship Daily Ops pack', column: 'backlog' } });
    expect(created.output.ok).toBe(true);
    const id = created.output.task.id;

    const listed = await list({ input: {} });
    expect(listed.output.count).toBeGreaterThanOrEqual(1);

    const moved = await move({ input: { id, column: 'doing' } });
    expect(moved.output.task.column).toBe('doing');

    const done = await complete({ input: { id } });
    expect(done.output.task.column).toBe('done');

    const store = path.join(root, '.zavorth', 'task-board', 'board.json');
    expect(fs.existsSync(store)).toBe(true);
  });

  it('secrets-guardian detects patterns without echoing secrets', async () => {
    const root = tempWorkspace();
    const mock = createMockCtx(root);
    load('secrets-guardian').register(mock.ctx);
    const scan = mock.capabilities.get('secrets.scan')!;
    const result = await scan({
      input: { text: 'token = "ghp_abcdefghijklmnopqrstuvwx"' },
    });
    expect(result.output.ok).toBe(true);
    expect(result.output.findingCount).toBeGreaterThan(0);
    const serialized = JSON.stringify(result.output);
    expect(serialized).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
    expect(result.output.findings.every((f: any) => f.redacted === true)).toBe(true);
  });

  it('session-recall finds text written under .zavorth', async () => {
    const root = tempWorkspace();
    const receiptDir = path.join(root, '.zavorth', 'receipts');
    fs.mkdirSync(receiptDir, { recursive: true });
    fs.writeFileSync(
      path.join(receiptDir, 'sample.json'),
      JSON.stringify({ event: 'daily-ops-unique-marker-42', at: new Date().toISOString() }),
    );

    const mock = createMockCtx(root);
    load('session-recall').register(mock.ctx);
    const search = mock.capabilities.get('recall.search')!;
    const result = await search({ input: { query: 'daily-ops-unique-marker-42' } });
    expect(result.output.ok).toBe(true);
    expect(result.output.count).toBeGreaterThanOrEqual(1);
  });

  it('notify-outbox enqueues locally without webhook', async () => {
    const root = tempWorkspace();
    const mock = createMockCtx(root);
    load('notify-outbox').register(mock.ctx);
    const enqueue = mock.capabilities.get('notify.enqueue')!;
    const list = mock.capabilities.get('notify.list')!;
    const status = mock.capabilities.get('notify.status')!;

    const enq = await enqueue({
      input: { title: 'CI finished', body: 'All green on main', severity: 'info' },
    });
    expect(enq.output.ok).toBe(true);
    expect(enq.output.item.status).toBe('pending');

    const listed = await list({ input: { status: 'pending' } });
    expect(listed.output.count).toBeGreaterThanOrEqual(1);

    const st = await status({ input: {} });
    expect(st.output.ok).toBe(true);
    expect(st.output.pending).toBeGreaterThanOrEqual(1);
  });

  it('pr-ship checklist returns items for risky diff text', async () => {
    const root = tempWorkspace();
    const mock = createMockCtx(root);
    load('pr-ship').register(mock.ctx);
    const checklist = mock.capabilities.get('pr.ship.checklist')!;
    const result = await checklist({
      input: {
        text: `
diff --git a/src/auth.ts b/src/auth.ts
+ const password = "secret"
+ // TODO fix later
+ console.log('debug')
`,
      },
    });
    expect(result.output.ok).toBe(true);
    expect(result.output.itemCount).toBeGreaterThan(0);
  });
});
