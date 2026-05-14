import fs from 'fs';
import os from 'os';
import path from 'path';
import { BridgeManager } from '../../src/orchestrator/BridgeManager';
import { MailboxProtocol } from '../../src/orchestrator/MailboxProtocol';

function createTask() {
  return {
    task_id: 'task-bridge-1',
    normalized_message: 'ajuste o runtime',
    workspace: 'core',
  } as any;
}

describe('BridgeManager', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-'));
  const inboxDir = path.join(tmpDir, 'inbox');
  const runtimeDir = path.join(tmpDir, 'runtime');

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('writes signed mailbox payloads', async () => {
    const protocol = new MailboxProtocol({
      secret: 'bridge-test-secret',
      allowLegacy: false,
      maxAgeMs: 60_000,
    });
    const bridge = new BridgeManager({ inboxDir, runtimeDir, protocol });

    await bridge.dispatchToIDE(createTask(), 'ZAVORTH_BRIDGE');

    const inboxFiles = fs.readdirSync(inboxDir).filter((file) => file.endsWith('.msg'));
    const runtimeFiles = fs.existsSync(runtimeDir) ? fs.readdirSync(runtimeDir) : [];
    expect(inboxFiles).toHaveLength(1);
    expect(runtimeFiles).toHaveLength(0);

    const payload = fs.readFileSync(path.join(inboxDir, inboxFiles[0]), 'utf8');
    const parsed = protocol.parseAndVerify(payload);

    expect(parsed.accepted).toBe(true);
    expect(payload).toContain('[SIGNATURE:');
    expect(payload).toContain('[MESSAGE_ID:');
  });
});
