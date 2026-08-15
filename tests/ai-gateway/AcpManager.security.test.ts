import { ACP_OUTPUT_LIMIT, AcpManager } from '../../src/ai-gateway/lib/acp/manager';
import { resolve } from 'node:path';

describe('ACP process manager', () => {
  const managers: AcpManager[] = [];

  afterEach(() => {
    for (const manager of managers) manager.killAll();
    managers.length = 0;
  });

  function manager(): AcpManager {
    const value = new AcpManager();
    managers.push(value);
    return value;
  }

  it('captures a fast response without missing process events', async () => {
    const value = manager();
    const session = value.spawn('echo', process.execPath, [
      '-e',
      "process.stdin.once('data', () => { process.stdout.write('ready'); process.exit(0); })",
    ]);

    await expect(value.sendPrompt(session.id, 'hello', 5_000)).resolves.toBe('ready');
  });

  it('emits a non-fatal session error for an unavailable executable', async () => {
    const value = manager();
    const errorEvent = new Promise<{ error: Error }>((resolve) => value.once('sessionError', resolve));
    value.spawn('missing', `missing-acp-binary-${Date.now()}`);

    const event = await errorEvent;
    expect(event.error.message).toContain('missing-acp-binary');
  });

  it('bounds captured child output', async () => {
    const value = manager();
    const session = value.spawn('large', process.execPath, [
      '-e',
      `process.stdout.write('x'.repeat(${ACP_OUTPUT_LIMIT + 10_000}))`,
    ]);
    await new Promise<void>((resolve) => session.process.once('exit', () => resolve()));

    expect(session.stdoutBuffer.length).toBeLessThanOrEqual(ACP_OUTPUT_LIMIT);
    expect(session.stdoutBuffer).toContain('[earlier output truncated]');
  });
});
