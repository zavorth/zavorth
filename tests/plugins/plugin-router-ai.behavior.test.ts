import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/plugin-router-ai/index.js');

function createMockCtx(workspace: string) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
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

describe('plugin-router-ai behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recommend finds web-search for "search the web"', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-router-ai-'));
    tempRoots.push(root);

    const webDir = path.join(root, 'plugins', 'web-search');
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, 'manifest.json'), JSON.stringify({
      id: 'web-search',
      label: 'Web Search',
      summary: 'Search the web',
      description: 'query the internet',
      moduleKind: 'search',
      tags: ['search', 'web', 'query'],
      capabilities: [
        { id: 'search.query', intent: 'search.web.query', label: 'Search Query', summary: 'web search' },
      ],
    }), 'utf8');

    const otherDir = path.join(root, 'plugins', 'github');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'manifest.json'), JSON.stringify({
      id: 'github',
      label: 'GitHub',
      summary: 'GitHub CLI',
      tags: ['github'],
      capabilities: [{ id: 'github.status', intent: 'github.status' }],
    }), 'utf8');

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const recommend = mock.capabilities.get('router.recommend');
    expect(recommend).toBeTruthy();
    const result = await recommend!({ input: { intent: 'search the web', limit: 5 } });
    expect(result.output.ok).toBe(true);
    expect(result.output.autoEnable).toBe(false);
    expect(result.output.recommendations[0].pluginId).toBe('web-search');
  });
});
