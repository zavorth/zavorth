import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';


const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/memory-local/index.js');

function createMockCtx(workspace: string) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      bindMemoryBackend() {},
      registerHook() {},
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return true;
      },
      emit() {},
    },
  };
}

describe('memory-local behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes, gets, and searches entries', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mem-'));
    tempRoots.push(root);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const write = mock.capabilities.get('memory.write');
    const get = mock.capabilities.get('memory.get');
    const search = mock.capabilities.get('memory.search');
    expect(write && get && search).toBeTruthy();

    const written = await write!({ input: { key: 'user.theme', value: 'dark', tags: ['prefs'] } });
    expect(written.output.ok).toBe(true);

    const got = await get!({ input: { key: 'user.theme' } });
    expect(got.output.found).toBe(true);
    expect(got.output.value).toBe('dark');

    const found = await search!({ input: { query: 'theme', limit: 5 } });
    expect(found.output.ok).toBe(true);
    expect(found.output.count).toBeGreaterThanOrEqual(1);

    const storePath = path.join(root, '.zavorth', 'memory-local', 'store.json');
    expect(fs.existsSync(storePath)).toBe(true);
  });
});
