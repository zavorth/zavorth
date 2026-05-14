import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { ZavorthBridgePublicTunnelService } from '../../src/services/ZavorthBridgePublicTunnelService.js';

describe('ZavorthBridgePublicTunnelService', () => {
  const tempDirs: string[] = [];
  const originalStateFile = config.zavorthBridgePublicTunnelStateFile;
  const originalLogFile = config.zavorthBridgePublicTunnelLogFile;
  const originalHostScriptPath = config.zavorthBridgePublicTunnelHostScriptPath;
  const originalTimeoutMs = config.zavorthBridgePublicTunnelReadyTimeoutMs;
  const originalEnabled = config.zavorthBridgePublicTunnelEnabled;

  afterEach(() => {
    config.zavorthBridgePublicTunnelStateFile = originalStateFile;
    config.zavorthBridgePublicTunnelLogFile = originalLogFile;
    config.zavorthBridgePublicTunnelHostScriptPath = originalHostScriptPath;
    config.zavorthBridgePublicTunnelReadyTimeoutMs = originalTimeoutMs;
    config.zavorthBridgePublicTunnelEnabled = originalEnabled;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('returns the ready public URL from the persisted tunnel state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-tunnel-state-'));
    tempDirs.push(root);
    config.zavorthBridgePublicTunnelStateFile = path.join(root, 'state.json');
    fs.writeFileSync(
      config.zavorthBridgePublicTunnelStateFile,
      JSON.stringify({
        enabled: true,
        running: true,
        ready: true,
        pid: 4101,
        tunnelPid: 4102,
        publicUrl: 'https://ag-public.trycloudflare.com',
        targetUrl: 'http://127.0.0.1:4747',
        message: 'Tunel pronto.',
      }),
      'utf8',
    );

    const service = new ZavorthBridgePublicTunnelService();
    const status = service.readStatus();

    expect(status.ready).toBe(true);
    expect(status.publicUrl).toBe('https://ag-public.trycloudflare.com');
  });

  it('spawns the tunnel host script and waits for the persisted state to become ready', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-tunnel-launch-'));
    tempDirs.push(root);
    config.zavorthBridgePublicTunnelStateFile = path.join(root, 'state.json');
    config.zavorthBridgePublicTunnelLogFile = path.join(root, 'tunnel.log');
    config.zavorthBridgePublicTunnelHostScriptPath = path.join(root, 'host.mjs');
    config.zavorthBridgePublicTunnelReadyTimeoutMs = 1_000;
    fs.writeFileSync(config.zavorthBridgePublicTunnelHostScriptPath, '// stub', 'utf8');

    const spawn = jest.fn(() => ({
      unref: jest.fn(),
    })) as any;
    let ticks = 0;
    const service = new ZavorthBridgePublicTunnelService({
      spawn,
      sleep: async () => {
        ticks += 1;
        if (ticks === 1) {
          fs.writeFileSync(
            config.zavorthBridgePublicTunnelStateFile,
            JSON.stringify({
              enabled: true,
              running: true,
              ready: true,
              pid: 4201,
              tunnelPid: 4202,
              cliPath: 'cloudflared',
              hostScriptPath: config.zavorthBridgePublicTunnelHostScriptPath,
              publicUrl: 'https://ag-public.trycloudflare.com',
              targetUrl: 'http://127.0.0.1:4747',
              checkedAt: '2026-04-05T12:00:00.000Z',
              message: 'Tunel pronto.',
              stateFile: config.zavorthBridgePublicTunnelStateFile,
              logFile: config.zavorthBridgePublicTunnelLogFile,
            }),
            'utf8',
          );
        }
      },
    });

    const result = await service.ensureStarted({
      targetUrl: 'http://127.0.0.1:4747',
    });

    expect(spawn).toHaveBeenCalled();
    expect(result.ready).toBe(true);
    expect(result.publicUrl).toBe('https://ag-public.trycloudflare.com');
    expect(result.started).toBe(true);
  });

  it('refuses to publish non-loopback targets', async () => {
    config.zavorthBridgePublicTunnelEnabled = true;
    const spawn = jest.fn() as any;
    const service = new ZavorthBridgePublicTunnelService({ spawn });

    const result = await service.ensureStarted({
      targetUrl: 'https://example.com/internal',
    });

    expect(spawn).not.toHaveBeenCalled();
    expect(result.started).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.message).toMatch(/HTTP local/);
  });

  it('starts cloudflared with a minimal environment that excludes secrets', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-tunnel-env-'));
    tempDirs.push(root);
    config.zavorthBridgePublicTunnelEnabled = true;
    config.zavorthBridgePublicTunnelStateFile = path.join(root, 'state.json');
    config.zavorthBridgePublicTunnelLogFile = path.join(root, 'tunnel.log');
    config.zavorthBridgePublicTunnelHostScriptPath = path.join(root, 'host.mjs');
    config.zavorthBridgePublicTunnelReadyTimeoutMs = 5;
    fs.writeFileSync(config.zavorthBridgePublicTunnelHostScriptPath, '// stub', 'utf8');

    const originalSecret = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'redacted-test-secret';
    const spawn = jest.fn(() => ({
      unref: jest.fn(),
    })) as any;

    try {
      const service = new ZavorthBridgePublicTunnelService({
        spawn,
        sleep: async () => undefined,
      });

      await service.ensureStarted({
        targetUrl: 'http://127.0.0.1:4747',
      });

      const options = spawn.mock.calls[0][2];
      expect(options.env.OPENAI_API_KEY).toBeUndefined();
      expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
    } finally {
      if (originalSecret === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalSecret;
      }
    }
  });
});
