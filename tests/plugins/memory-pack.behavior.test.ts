import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGINS = path.resolve(__dirname, '../../plugins');

function createMockCtx(workspace: string, permission = true) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const backends: any[] = [];
  return {
    capabilities,
    backends,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      bindMemoryBackend(backend: any) {
        backends.push(backend);
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

describe('Memory capability pack', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function tempWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-pack-'));
    tempRoots.push(root);
    return root;
  }

  it('memory-file-journal append + search + tail', async () => {
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'memory-file-journal/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const append = mock.capabilities.get('memory.journal.append')!;
    const search = mock.capabilities.get('memory.journal.search')!;
    const tail = mock.capabilities.get('memory.journal.tail')!;
    const status = mock.capabilities.get('memory.journal.status')!;

    const written = await append({
      input: { text: 'memory-journal-marker-alpha', tags: ['memory'] },
    });
    expect(written.output.ok).toBe(true);
    expect(written.output.id).toBeTruthy();

    const found = await search({ input: { query: 'memory-journal-marker-alpha' } });
    expect(found.output.ok).toBe(true);
    expect((found.output.count ?? found.output.items?.length ?? 0) >= 1).toBe(true);

    const recent = await tail({ input: { limit: 5 } });
    expect(recent.output.ok).toBe(true);

    const st = await status({ input: {} });
    expect(st.output.ok).toBe(true);
    expect(mock.backends.length).toBeGreaterThanOrEqual(1);

    const journalPath = path.join(root, '.zavorth', 'memory-file-journal', 'journal.jsonl');
    expect(fs.existsSync(journalPath)).toBe(true);
  });

  it('memory-vector-local upsert + cosine search', async () => {
    const root = tempWorkspace();
    const mod = requireFromTest(path.join(PLUGINS, 'memory-vector-local/index.js'));
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const upsert = mock.capabilities.get('memory.vector.upsert')!;
    const search = mock.capabilities.get('memory.vector.search')!;
    const get = mock.capabilities.get('memory.vector.get')!;

    const a = await upsert({
      input: { key: 'cats', text: 'fluffy cats and kittens play' },
    });
    expect(a.output.ok).toBe(true);

    await upsert({
      input: { key: 'cars', text: 'electric cars and motors' },
    });

    const found = await search({ input: { query: 'kitten cats fluffy', limit: 3 } });
    expect(found.output.ok).toBe(true);
    expect(Array.isArray(found.output.items || found.output.results)).toBe(true);
    const items = found.output.items || found.output.results || [];
    expect(items.length).toBeGreaterThan(0);

    const got = await get({ input: { key: 'cats' } });
    expect(got.output.ok !== false || got.output.found !== false).toBe(true);
  });

  it('memory-mem0 status soft-fails without key and never leaks secrets', async () => {
    const saved = process.env.MEM0_API_KEY;
    delete process.env.MEM0_API_KEY;
    try {
      const root = tempWorkspace();
      const mod = requireFromTest(path.join(PLUGINS, 'memory-mem0/index.js'));
      const mock = createMockCtx(root, false);
      mod.register(mock.ctx);
      const status = await mock.capabilities.get('memory.mem0.status')!({ input: {} });
      expect(status.output.ok).toBe(true);
      expect(status.output.keyPresent).toBe(false);

      process.env.MEM0_API_KEY = 'mem0-secret-must-not-appear';
      const status2 = await mock.capabilities.get('memory.mem0.status')!({ input: {} });
      expect(status2.output.keyPresent).toBe(true);
      expect(JSON.stringify(status2.output)).not.toContain('mem0-secret-must-not-appear');

      const add = await mock.capabilities.get('memory.mem0.add')!({
        input: { text: 'hello' },
      });
      expect(add.output.ok).toBe(false);
    } finally {
      if (saved !== undefined) process.env.MEM0_API_KEY = saved;
      else delete process.env.MEM0_API_KEY;
    }
  });
});
