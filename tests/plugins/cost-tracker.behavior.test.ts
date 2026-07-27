import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/cost-tracker/index.js');

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

describe('cost-tracker behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('records before/after hooks and summarizes ledger', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cost-'));
    tempRoots.push(root);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const before = mock.hooks.get('llm.before_request') || [];
    const after = mock.hooks.get('llm.after_request') || [];
    expect(before.length).toBe(1);
    expect(after.length).toBe(1);

    const context: Record<string, unknown> = {
      requestId: 'req-1',
      primaryProviderName: 'test',
      messageCount: 2,
    };
    await before[0]({ context });
    context.totalTokens = 42;
    context.ok = true;
    await after[0]({ context });

    const summaryHandler = mock.capabilities.get('cost.summary');
    expect(summaryHandler).toBeTruthy();
    const summary = await summaryHandler!({ input: {} });
    expect(summary.output.ok).toBe(true);
    expect(summary.output.totalTokens).toBeGreaterThanOrEqual(42);
    expect(summary.output.completed).toBeGreaterThanOrEqual(1);

    const ledgerPath = path.join(root, '.zavorth', 'cost-tracker', 'ledger.jsonl');
    expect(fs.existsSync(ledgerPath)).toBe(true);
    const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r-\n/u);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
