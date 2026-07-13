import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/security-guidance/index.js');

function createMockCtx(workspace: string) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  const hooks = new Map<string, Array<(args: any) => Promise<void>>>();
  return {
    capabilities,
    hooks,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      registerHook(event: string, cb: (args: any) => Promise<void>) {
        const list = hooks.get(event) || [];
        list.push(cb);
        hooks.set(event, list);
      },
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

describe('security-guidance behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects eval pattern via security.scan', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sec-'));
    tempRoots.push(root);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const scan = mock.capabilities.get('security.scan');
    expect(scan).toBeTruthy();
    const result = await scan!({ input: { text: 'const x = eval(userInput);' } });
    expect(result.output.ok).toBe(true);
    expect(result.output.findingCount).toBeGreaterThan(0);
    expect(result.output.findings.some((f: { id: string }) => f.id === 'eval')).toBe(true);
    expect(result.output.blocked).toBe(false);
  });

  it('hook observes tool.after_execute write-like content without throwing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sec-hook-'));
    tempRoots.push(root);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);
    const hooks = mock.hooks.get('tool.after_execute') || [];
    expect(hooks.length).toBe(1);
    await expect(hooks[0]({
      context: {
        toolName: 'workspace.write',
        path: path.join(root, 'evil.js'),
        content: 'import pickle\npickle.load(f)\n',
      },
    })).resolves.toBeUndefined();

    const ledger = path.join(root, '.zavorth', 'security-guidance', 'warnings.jsonl');
    expect(fs.existsSync(ledger)).toBe(true);
  });
});
