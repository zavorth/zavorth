import { GatewaySessionService } from '../../src/services/GatewaySessionService.js';
import { GatewaySessionToolsService } from '../../src/services/GatewaySessionToolsService.js';
import { GatewaySessionStoreService } from '../../src/services/GatewaySessionStoreService.js';
import { GatewaySessionReadModelService } from '../../src/runtime/sessions/GatewaySessionReadModelService.js';
import { GatewayChannelRouterService } from '../../src/services/GatewayChannelRouterService.js';
import { GatewayChannelRegistryService } from '../../src/services/GatewayChannelRegistryService.js';
import { NodeHostCapabilityService } from '../../src/services/NodeHostCapabilityService.js';
import { BenchmarkHarness } from './Harness.js';
import { extractJsonPayloadFromText, runCliProbe } from '../QaSupport.js';
import {
  reserveFreePort,
  startTemporaryZavorthControlService,
  waitForWebShell,
} from '../WebShellSupport.js';

function parseCliJsonResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}): { warning: string | null } {
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  if (!stdout) {
    throw new Error(stderr || `exit ${String(result.exitCode)}`);
  }
  extractJsonPayloadFromText(stdout);
  const warnings: string[] = [];
  if (result.exitCode !== 0) {
    warnings.push(`CLI returned exit ${String(result.exitCode)} with a valid JSON payload`);
  }
  if (stderr) {
    warnings.push(`CLI emitiu stderr informativo durante o probe: ${stderr.split(/\r?\n/u)[0]}`);
  }
  return {
    warning: warnings.length > 0 ? warnings.join(' | ') : null,
  };
}

function buildSessionTools(): GatewaySessionToolsService {
  const sessions = new GatewaySessionService();
  const sessionStore = new GatewaySessionStoreService({
    createWebSession: () => 'qa-session-flow',
  });
  const readModel = new GatewaySessionReadModelService(sessions, {
    sessionStoreService: sessionStore,
  });
  const channelRegistry = new GatewayChannelRegistryService({
    hasDispatcher: true,
    canSpawnWeb: true,
  });
  const channelRouter = new GatewayChannelRouterService({
    sessionStoreService: sessionStore,
    sessionReadModelService: readModel,
    channelRegistryService: channelRegistry,
    surfaceTaskDispatcher: {
      dispatchTaskMessage: async () => ({
        task: {
          task_id: 'qa-task-1',
        },
        parsed: null,
        runtimeUserId: 'qa-operator',
        sourceUserId: 'qa-operator',
        tenantId: null,
        tenantContext: null,
      }),
    },
  });
  return new GatewaySessionToolsService(sessions, {
    sessionStoreService: sessionStore,
    sessionReadModelService: readModel,
    channelRouterService: channelRouter,
  });
}

async function runRuntimeBenchmarks() {
  const harness = new BenchmarkHarness('Runtime Flow Operations');
  const sessionTools = buildSessionTools();
  const nodeHost = new NodeHostCapabilityService();

  await harness.measure('Gateway session spawn', async () => {
    return await sessionTools.spawnSession({
      userId: 'qa-operator',
      platform: 'web',
    });
  }, {
    detail: (result) => ({
      ok: result.ok,
      sessionId: result.sessionId || 'none',
    }),
  });

  await harness.measure('Gateway session send', async () => {
    return await sessionTools.sendToSession({
      userId: 'qa-operator',
      platform: 'web',
      sessionId: 'qa-session-flow',
    text: 'Run critical runtime validation',
    });
  }, {
    detail: (result) => ({
      ok: result.ok,
      taskId: result.taskId || 'none',
      platform: result.platform,
    }),
  });

  await harness.measure('CLI domain snapshot live', async () => {
    const result = await runCliProbe(['domains', '--json']);
    return {
      result,
      parsed: parseCliJsonResult(result),
    };
  }, {
    detail: ({ result }) => ({
      command: 'domains --json',
      exitCode: result.exitCode,
      stdoutBytes: result.stdout.length,
    }),
    warning: ({ parsed }) => parsed.warning,
  });

  await harness.measure('Node Mesh invoke device.info', async () => {
    return await nodeHost.executeAssignment({
      id: 'qa-node-invoke-1',
      capabilityId: 'device.info',
      action: 'describe',
      payload: {},
    });
  }, {
    detail: (report) => ({
      ok: report.ok,
      summary: report.resultSummary,
    }),
  });

  const tempPort = await reserveFreePort();
  const tempZavorthControl = await startTemporaryZavorthControlService(tempPort);
  try {
    const ready = await waitForWebShell(tempZavorthControl.baseUrl, 90_000);
    await harness.measure('Web shell /app latency', async () => {
      const response = await fetch(`${tempZavorthControl.baseUrl}/app`);
      if (!response.ok) {
        throw new Error(`web app respondeu ${response.status}`);
      }
      return {
        baseUrl: tempZavorthControl.baseUrl,
        authStatus: ready.authStatus.status,
        appStatus: response.status,
      };
    }, {
      detail: (result) => ({
        authStatus: result.authStatus,
        appStatus: result.appStatus,
        baseUrl: result.baseUrl,
      }),
    });
  } finally {
    await tempZavorthControl.cleanup();
  }

  const reportPath = harness.writeReport('benchmark-runtime-flow.json');
  harness.printReport();
  console.log(`[qa] runtime benchmark salvo em ${reportPath}`);
}

runRuntimeBenchmarks().catch((error) => {
  console.error('[qa] runtime benchmark failed:', error);
  process.exit(1);
});
