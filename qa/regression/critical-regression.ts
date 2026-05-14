import { config } from '../../src/config/index.js';
import { runZavorthCli } from '../../src/cli/ZavorthCli.js';
import { startGatewayHost } from '../../src/gateway/index.js';
import { RemoteTransportDoctorService } from '../../src/services/RemoteTransportDoctorService.js';
import { extractJsonPayloadFromText, fetchJsonWithTimeout } from '../QaSupport.js';
import {
  reserveFreePort,
  startTemporaryDashboardService,
  waitForWebShell,
} from '../WebShellSupport.js';
import { RegressionHarness } from './CriticalHarness.js';

async function runCliJson(args: string[]): Promise<{
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const writes: string[] = [];
  const errors: string[] = [];
  const exitCode = await runZavorthCli(args, {
    write: (value) => writes.push(String(value)),
    error: (value) => errors.push(String(value)),
  });
  return {
    ok: exitCode === 0,
    exitCode,
    stdout: writes.join('\n').trim(),
    stderr: errors.join('\n').trim(),
  };
}

async function runRegression() {
  const harness = new RegressionHarness();

  harness.register({
    id: 'gateway-public-api',
    description: 'API publica do gateway responde status e domains.',
    criticalPath: 'gateway',
    execute: async () => {
      const boot = await startGatewayHost({
        ...process.env,
        TELEGRAM_BOT_TOKEN: '',
      }, {
        host: '127.0.0.1',
        port: 0,
      });
      try {
        const status = await fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/gateway/status`);
        const domains = await fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/gateway/domains`);
        return {
          status,
          domains,
        };
      } finally {
        await boot.host.stop();
        await boot.runtime.stop();
      }
    },
    validate: async (result: any) => {
      return result.status.status === 200
        && String(result.status.payload?.status || '') === 'ready'
        && result.domains.status === 200
        && Boolean(result.domains.payload?.summary);
    },
  });

  harness.register({
    id: 'quality-metrics-api',
    description: 'Metricas publicas de learning, memory e ops quality respondem com snapshots validos.',
    criticalPath: 'security',
    execute: async () => {
      const boot = await startGatewayHost({
        ...process.env,
        TELEGRAM_BOT_TOKEN: '',
      }, {
        host: '127.0.0.1',
        port: 0,
      });
      try {
        const [learning, memory, quality] = await Promise.all([
          fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/learning/metrics`),
          fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/memory/metrics`),
          fetchJsonWithTimeout<Record<string, any>>(`${boot.url}/api/v1/ops/quality`),
        ]);
        return {
          learning,
          memory,
          quality,
        };
      } finally {
        await boot.host.stop();
        await boot.runtime.stop();
      }
    },
    validate: async (result: any) => {
      return result.learning.status === 200
        && Boolean(result.learning.payload?.summary)
        && result.memory.status === 200
        && Boolean(result.memory.payload?.summary)
        && result.quality.status === 200
        && typeof result.quality.payload?.score === 'number'
        && typeof result.quality.payload?.gate?.state === 'string';
    },
  });

  harness.register({
    id: 'cli-status-json',
    description: 'CLI responde status --json sem quebrar o contrato.',
    criticalPath: 'session',
    execute: async () => {
      return await runCliJson(['status', '--json']);
    },
    validate: async (result: any) => {
      if (!result.ok) {
        return false;
      }
      const parsed = extractJsonPayloadFromText(result.stdout) as Record<string, any>;
      return Boolean(
        parsed?.gateway
        && parsed?.domains
        && Object.prototype.hasOwnProperty.call(parsed, 'platform')
        && Object.prototype.hasOwnProperty.call(parsed, 'sessions')
      );
    },
  });

  harness.register({
    id: 'cli-ops-quality-json',
    description: 'CLI responde ops quality --json com score, budgets e gates consistentes.',
    criticalPath: 'security',
    execute: async () => {
      return await runCliJson(['ops', 'quality', '--json']);
    },
    validate: async (result: any) => {
      const raw = String(result?.stdout || '').trim();
      if (!raw) {
        return false;
      }
      const parsed = extractJsonPayloadFromText(raw) as Record<string, any>;
      return Boolean(
        typeof parsed?.score === 'number'
        && typeof parsed?.healthy === 'boolean'
        && typeof parsed?.summary?.recoveryState === 'string'
        && typeof parsed?.memory?.pressure === 'string'
        && typeof parsed?.learning?.averageScore === 'number'
      );
    },
  });

  harness.register({
    id: 'node-mesh-doctor',
    description: 'Node Mesh responde pelo doctor canonico sem quebrar a surface central.',
    criticalPath: 'mesh',
    execute: async () => {
      return await runCliJson(['nodes', 'doctor', '--json']);
    },
    validate: async (report: any) => {
      const raw = String(report?.stdout || '').trim();
      if (!raw) {
        return false;
      }
      const parsed = extractJsonPayloadFromText(raw) as Record<string, any>;
      return (
        typeof parsed?.status === 'string'
        && ['passed', 'failed', 'running', 'missing'].includes(parsed.status)
        && typeof parsed?.command === 'string'
        && typeof parsed?.file === 'string'
        && Object.prototype.hasOwnProperty.call(parsed, 'summary')
      );
    },
  });

  harness.register({
    id: 'remote-transport-doctor',
    description: 'Remote transport doctor responde e persiste relatorio.',
    criticalPath: 'transport',
    execute: async () => {
      const report = await new RemoteTransportDoctorService().run();
      return {
        report,
        fileExists: report.file ? true : false,
      };
    },
    validate: async (result: any) => Boolean(result.report?.items),
  });

  harness.register({
    id: 'web-app-shell',
    description: 'Host supervisionado responde /app e auth status.',
    criticalPath: 'web',
    execute: async () => {
      const baseUrl = `http://${config.zavorthWebHost === '0.0.0.0' ? '127.0.0.1' : config.zavorthWebHost}:${config.zavorthWebPort}`;
      let authStatus;
      let appStatus = 0;
      try {
        authStatus = await fetchJsonWithTimeout<Record<string, any>>(`${baseUrl}/api/auth/status`, {
          timeoutMs: 10_000,
        });
      } catch {
        const tempPort = await reserveFreePort();
        const tempDashboard = await startTemporaryDashboardService(tempPort);
        try {
          const ready = await waitForWebShell(tempDashboard.baseUrl, 90_000);
          authStatus = ready.authStatus;
          appStatus = ready.appStatus;
          return {
            baseUrl: tempDashboard.baseUrl,
            authStatus,
            appStatus,
            bootedTemporarily: true,
          };
        } finally {
          await tempDashboard.cleanup();
        }
      }
      const appResponse = await fetch(`${baseUrl}/app`);
      appStatus = appResponse.status;
      return {
        baseUrl,
        authStatus,
        appStatus,
      };
    },
    validate: async (result: any) => result.authStatus.status === 200 && result.appStatus === 200,
  });

  const report = await harness.runSuite();
  const reportPath = harness.writeReport(report, 'critical-regression.json');
  harness.printReport(report);
  console.log(`[qa] regression report salvo em ${reportPath}`);

  if (report.failures > 0) {
    process.exit(1);
  }
}

runRegression().catch((error) => {
  console.error('[qa] critical regression falhou:', error);
  process.exit(1);
});
