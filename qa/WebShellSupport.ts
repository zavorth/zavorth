import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { config } from '../src/config/index.js';
import { DashboardService } from '../src/services/DashboardService.js';
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
          reject(new Error('Nao foi possivel reservar uma porta livre para o host web temporario.'));
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
    : new Error(`Host web temporario nao respondeu em ${timeoutMs}ms.`);
}

export type TemporaryDashboardHandle = {
  service: DashboardService;
  baseUrl: string;
  cleanup: () => Promise<void>;
};

function snapshotDashboardConfig() {
  return {
    zavorthWebHost: config.zavorthWebHost,
    zavorthWebPort: config.zavorthWebPort,
    zavorthWebAuthToken: config.zavorthWebAuthToken,
    dashboardRuntimeStateFile: config.dashboardRuntimeStateFile,
  };
}

export async function startTemporaryDashboardService(port: number): Promise<TemporaryDashboardHandle> {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-regression-web-'));
  const previousConfig = snapshotDashboardConfig();
  const logRepo = {
    log: () => undefined,
    getRecentLogs: () => [],
  } as any;

  config.zavorthWebHost = '127.0.0.1';
  config.zavorthWebPort = port;
  config.zavorthWebAuthToken = 'qa-web-shell-token';
  config.dashboardRuntimeStateFile = path.join(runtimeRoot, 'dashboard-runtime.json');

  const service = new DashboardService(logRepo);
  const baseUrl = await service.start();

  return {
    service,
    baseUrl,
    cleanup: async () => {
      await service.stopAsync();
      config.zavorthWebHost = previousConfig.zavorthWebHost;
      config.zavorthWebPort = previousConfig.zavorthWebPort;
      config.zavorthWebAuthToken = previousConfig.zavorthWebAuthToken;
      config.dashboardRuntimeStateFile = previousConfig.dashboardRuntimeStateFile;
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    },
  };
}
