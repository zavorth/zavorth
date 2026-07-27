import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { config } from '../src/config/index.js';
import { ZavorthControlService } from '../src/services/ZavorthControlService.js';
import { fetchJsonWithTimeout } from './QaSupport.js';

export async function reserveFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!address || typeof address === 'string') {
      reject(new Error('Could not reserve a free port for the temporary web host.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

export async function waitForWebShell(
  baseUrl: string,
  timeoutMs = 60_000,
): Promise<{ authStatus: { status: number; payload: Record<string, unknown> }; appStatus: number }> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const authStatus = await fetchJsonWithTimeout<Record<string, unknown>>(`${baseUrl}/api/auth/status`, {
        timeoutMs: 5_000,
      });
      const appResponse = await fetch(`${baseUrl}/app`);
      if (authStatus.status === 200 && appResponse.ok) {
        return {
          authStatus,
          appStatus: appResponse.status,
        };
      }
      lastError = new Error(`auth=${authStatus.status} app=${appResponse.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw lastError instanceof Error
    ? lastError
      : new Error(`Temporary web host did not respond within ${timeoutMs}ms.`);
}

export type TemporaryZavorthControlHandle = {
  service: ZavorthControlService;
  baseUrl: string;
  cleanup: () => Promise<void>;
};

function snapshotZavorthControlConfig() {
  return {
    zavorthWebHost: config.zavorthWebHost,
    zavorthWebPort: config.zavorthWebPort,
    zavorthWebAuthToken: config.zavorthWebAuthToken,
    zavorthControlRuntimeStateFile: config.zavorthControlRuntimeStateFile,
  };
}

export async function startTemporaryZavorthControlService(port: number): Promise<TemporaryZavorthControlHandle> {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-regression-web-'));
  const previousConfig = snapshotZavorthControlConfig();
  const logRepo = {
    log: () => undefined,
    getRecentLogs: () => [],
  } as any;

  config.zavorthWebHost = '127.0.0.1';
  config.zavorthWebPort = port;
  config.zavorthWebAuthToken = 'qa-web-shell-token';
  config.zavorthControlRuntimeStateFile = path.join(runtimeRoot, 'zavorthControl-runtime.json');

  const service = new ZavorthControlService(logRepo);
  const baseUrl = await service.start();

  return {
    service,
    baseUrl,
    cleanup: async () => {
      await service.stopAsync();
      config.zavorthWebHost = previousConfig.zavorthWebHost;
      config.zavorthWebPort = previousConfig.zavorthWebPort;
      config.zavorthWebAuthToken = previousConfig.zavorthWebAuthToken;
      config.zavorthControlRuntimeStateFile = previousConfig.zavorthControlRuntimeStateFile;
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    },
  };
}
