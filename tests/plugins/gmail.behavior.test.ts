import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';


const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/gmail/index.js');

function createMockCtx(workspace: string, permission = false) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
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

describe('gmail behavior', () => {
  const tempRoots: string[] = [];
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('drafts locally without sending and send needs approval', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-gmail-'));
    tempRoots.push(root);
    delete process.env.GMAIL_ACCESS_TOKEN;
    delete process.env.GOOGLE_ACCESS_TOKEN;

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root, false);
    mod.register(mock.ctx);

    const status = await mock.capabilities.get('gmail.status')!({ input: {} });
    expect(status.output.tokenPresent).toBe(false);

    const draft = await mock.capabilities.get('gmail.draft')!({
      input: { to: 'a@example.com', subject: 'Hi', body: 'Hello' },
    });
    expect(draft.output.ok).toBe(true);
    expect(draft.output.draftId).toBeTruthy();
    expect(draft.output.status).toBe('draft');

    const draftPath = path.join(root, '.zavorth', 'gmail', 'drafts', `${draft.output.draftId}.json`);
    expect(fs.existsSync(draftPath)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    expect(stored.status).toBe('draft');
    expect(stored.sentAt).toBeNull();

    const denied = await mock.capabilities.get('gmail.send')!({
      input: { draftId: draft.output.draftId },
    });
    expect(denied.output.ok).toBe(false);
    expect(denied.output.reason).toBe('needs_approval');

    // still draft after denied send
    const after = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    expect(after.status).toBe('draft');
  });

  it('approved send without token does not mark as sent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-gmail-send-'));
    tempRoots.push(root);
    delete process.env.GMAIL_ACCESS_TOKEN;
    delete process.env.GOOGLE_ACCESS_TOKEN;

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root, true);
    mod.register(mock.ctx);

    const draft = await mock.capabilities.get('gmail.draft')!({
      input: { to: 'b@example.com', subject: 'X', body: 'Y' },
    });
    const send = await mock.capabilities.get('gmail.send')!({
      input: { draftId: draft.output.draftId, approved: true },
    });
    expect(send.output.ok).toBe(false);
    expect(send.output.reason).toBe('no_token');
  });
});
