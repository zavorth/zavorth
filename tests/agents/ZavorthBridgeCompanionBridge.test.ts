import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthBridgeCompanionBridge } from '../../src/agents/ZavorthBridgeCompanionBridge';

async function waitForRequestFile(requestDir: string): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 500) {
    const files = await fs.promises.readdir(requestDir);
    const requestFile = files.find((file) => file.endsWith('.json'));
    if (requestFile) {
      return requestFile;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for bridge request file.');
}

describe('ZavorthBridgeCompanionBridge', () => {
  let tmpDir: string;
  let requestDir: string;
  let resultDir: string;
  let runtimeDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-'));
    requestDir = path.join(tmpDir, 'requests');
    resultDir = path.join(tmpDir, 'results');
    runtimeDir = path.join(tmpDir, 'runtime');
    await fs.promises.mkdir(requestDir, { recursive: true });
    await fs.promises.mkdir(resultDir, { recursive: true });
    await fs.promises.mkdir(runtimeDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(runtimeDir, 'bridge-status.json'),
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        instanceId: 'bridge-1',
      }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('propagates bridge-side command failures instead of timing out', async () => {
    const bridge = new ZavorthBridgeCompanionBridge({
      requestDir,
      resultDir,
      runtimeDir,
      pollIntervalMs: 10,
      pendingResultRetryMs: 10,
    });

    const pending = bridge.acceptStep(undefined, 250);
    const requestFile = await waitForRequestFile(requestDir);
    const requestId = requestFile.replace(/\.json$/i, '');

    await fs.promises.writeFile(
      path.join(resultDir, requestFile),
      JSON.stringify({
        ok: false,
        command: 'accept-step',
        requestId,
        completedAt: new Date().toISOString(),
        error: 'Bridge rejected the step.',
      }),
      'utf8',
    );

    await expect(pending).rejects.toThrow('Bridge rejected the step.');
  });

  it('returns successful results once the bridge writes a valid response', async () => {
    const bridge = new ZavorthBridgeCompanionBridge({
      requestDir,
      resultDir,
      runtimeDir,
      pollIntervalMs: 10,
      pendingResultRetryMs: 10,
    });

    const pending = bridge.sendAgentPrompt('Continue', undefined, 250);
    const requestFile = await waitForRequestFile(requestDir);
    const requestId = requestFile.replace(/\.json$/i, '');

    await fs.promises.writeFile(
      path.join(resultDir, requestFile),
      JSON.stringify({
        ok: true,
        command: 'send-agent-prompt',
        requestId,
        completedAt: new Date().toISOString(),
        data: { delivered: true },
      }),
      'utf8',
    );

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        command: 'send-agent-prompt',
        requestId,
      }),
    );
  });

  it('keeps a recent bridge snapshot usable for capabilities and online checks', async () => {
    await fs.promises.writeFile(
      path.join(runtimeDir, 'bridge-status.json'),
      JSON.stringify({
        updatedAt: new Date(Date.now() ? 2 * 60 * 1000).toISOString(),
        instanceId: 'bridge-1',
        capabilities: {
          canSendAgentPrompt: true,
        },
      }),
      'utf8',
    );

    const bridge = new ZavorthBridgeCompanionBridge({
      requestDir,
      resultDir,
      runtimeDir,
      pollIntervalMs: 10,
      pendingResultRetryMs: 10,
    });

    await expect(bridge.isOnline()).resolves.toBe(true);
    await expect(bridge.supports('canSendAgentPrompt')).resolves.toBe(true);
  });
});
