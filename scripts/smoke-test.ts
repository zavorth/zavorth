import { Bot } from 'grammy';
import { config } from '../src/config/index.js';
import { McpManifestLoader } from '../src/mcp/McpManifest.js';
import { ExternalExecutor } from '../src/execution/ExternalExecutor.js';
import { StitchExecutor } from '../src/execution/StitchExecutor.js';
import { AiStudioExecutor } from '../src/execution/AiStudioExecutor.js';
import { ToolExecutor } from '../src/execution/ToolExecutor.js';
import { RuntimeCompositionService } from '../src/services/RuntimeCompositionService.js';
import { ZavorthBridgeControlService } from '../src/services/ZavorthBridgeControlService.js';
import { ChannelProviderDoctorService } from '../src/services/ChannelProviderDoctorService.js';
import { MemoryRuntimeService } from '../src/services/memory/MemoryRuntimeService.js';
import { SandboxExecutionService } from '../src/services/SandboxExecutionService.js';
import { PermissionService } from '../src/services/PermissionService.js';
import { runNodeMeshSmoke } from './node-mesh-smoke.js';
import { asErrorLike } from '../src/utils/errorLike';

type SmokeStatus = 'PASSED' | 'failed' | 'PULADO' | 'AVISO';

type SmokeResult = {
  name: string;
  status: SmokeStatus;
  detail: string;
  required: boolean;
};

async function runSmokeTests() {
  console.log('Iniciando smoke tests do Zavorth...\n');

  const localResults = await runLocalGodModeSmokeTests();
  const integrationResults = await runHostIntegrationSmokeTests();
  const allResults = [...localResults, ...integrationResults];

  console.log('\n==================================================');
  console.log('Resumo dos smoke tests:');
  for (const result of allResults) {
    console.log(`${result.name.padEnd(22, ' ')} ${result.status.padEnd(6, ' ')} ${result.detail}`);
  }
  console.log('==================================================\n');

  const blockingFailures = allResults.filter((result) => result.required && result.status === 'failed');
  if (blockingFailures.length > 0) {
    console.log('Smoke tests finished with blocking failures.');
    process.exit(1);
  }

  console.log('Smoke tests finished without blocking failures.');
  process.exit(0);
}

async function runLocalGodModeSmokeTests(): Promise<SmokeResult[]> {
  console.log('God-Mode local: validando runtime interno...');

  return [
    await smokeMcpManifest(),
    await smokeGraphRuntime(),
    await smokeMemoryFallback(),
    await smokeSandboxPolicy(),
    await smokeDockerSandboxRuntime(),
    await smokeChannelProviders(),
    await smokeNodeMesh(),
    await smokePermissionTelemetry(),
  ];
}

async function smokeMcpManifest(): Promise<SmokeResult> {
  try {
    const entries = new McpManifestLoader().loadEnabled();
    const filesystem = entries.find((entry) => entry.id === 'filesystem');
    if (!filesystem) {
      throw new Error('manifest MCP without server filesystem habilitado.');
    }

    return {
      name: 'God-Mode MCP',
      status: 'PASSED',
      detail: `${entries.length} server(es) habilitado(s); filesystem active.`,
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode MCP',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeGraphRuntime(): Promise<SmokeResult> {
  try {
    const telemetryEvents: Array<Record<string, any>> = [];
    const telemetryRuntime = {
      record: async (event: Record<string, any>) => {
        telemetryEvents.push(event);
      },
    } as any;
    const toolRegistry = {
      getToolDefinitions: () => [
        {
          name: 'read_file',
          description: 'Le um file local.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
              },
            },
            required: ['path'],
          },
        },
      ],
      getTool: () => ({
        execute: async () => 'smoke content',
      }),
    } as any;
    const toolExecutor = new ToolExecutor(toolRegistry, { log: () => undefined } as any, telemetryRuntime);
    let llmCall = 0;
    const composition = new RuntimeCompositionService({
      toolRegistry,
      toolExecutor,
      telemetryRuntime,
      llmRuntime: {
        getPreferredProviderName: () => 'AIGateway',
        chat: async () => {
          llmCall += 1;
          if (llmCall === 1) {
            return {
              content: null,
              toolCalls: [
                {
                  id: 'tool-1',
                  name: 'read_file',
                  arguments: { path: 'README.md' },
                },
              ],
              finishReason: 'tool_calls',
            };
          }

          if (llmCall === 2) {
            return {
              content: 'Analise completed.',
              toolCalls: [],
              finishReason: 'stop',
            };
          }

          return {
            content: 'APROVADO',
            toolCalls: [],
            finishReason: 'stop',
          };
        },
      } as any,
    });

    const result = await composition.getGraphRuntime().runAutonomousTask('analisar o README');
    const graphStarted = telemetryEvents.find((event) => event.eventType === 'graph.started');
    const toolStarted = telemetryEvents.find((event) => event.eventType === 'tool.started');

    if (!result.ok) {
      throw new Error(`grafo terminou em ${result.status}.`);
    }
    if (!graphStarted || !toolStarted) {
      throw new Error('graph or tool telemetry was not recorded.');
    }
    if (graphStarted.traceId !== result.traceId || toolStarted.traceId !== result.traceId) {
      throw new Error('graph and tool traceId do not match the same session.');
    }

    return {
      name: 'God-Mode Graph',
      status: 'PASSED',
      detail: `autonomous flow approved com trace ${result.traceId.slice(0, 8)}.`,
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Graph',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeMemoryFallback(): Promise<SmokeResult> {
  try {
    const stored: string[] = [];
    const localBackend = {
      name: 'local',
      isAvailable: async () => true,
      addMemory: async (_userId: string, content: string) => {
        stored.push(content);
      },
      searchMemory: async (_userId: string, query: string, limit = 5) =>
        stored.filter((entry) => entry.toLowerCase().includes(query.toLowerCase())).slice(0, limit),
      getMemoryService: () => ({}),
    } as any;
    const mem0Backend = {
      name: 'mem0',
      isAvailable: async () => false,
      addMemory: async () => undefined,
      searchMemory: async () => [],
    } as any;
    const runtime = new MemoryRuntimeService(localBackend, mem0Backend);

    const writeMessage = await runtime.addMemory('smoke-user', 'Zavorth prioriza telemetria local.');
    const results = await runtime.searchMemory('smoke-user', 'telemetria');

    if (!writeMessage.includes('LocalMemory')) {
      throw new Error('local fallback was not used when Mem0 was unavailable.');
    }
    if (!results.some((entry) => entry.includes('telemetria local'))) {
      throw new Error('local memory did not return the written content.');
    }

    return {
      name: 'God-Mode Memory',
      status: 'PASSED',
      detail: 'local-first fallback validated without depending on Mem0.',
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Memory',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeSandboxPolicy(): Promise<SmokeResult> {
  try {
    const sandbox = new SandboxExecutionService();
    const shouldSandbox = sandbox.shouldSandbox({
      executor: 'local',
      instructions: ['npm test'],
      metadata: {},
    } as any);

    if (!shouldSandbox) {
      throw new Error('policy did not mark the test command for sandbox.');
    }

    return {
      name: 'God-Mode Sandbox',
      status: 'PASSED',
      detail: 'policy de sandbox marcou sensitive execution correctly.',
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Sandbox',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeDockerSandboxRuntime(): Promise<SmokeResult> {
  try {
    const sandbox = new SandboxExecutionService();
    const status = sandbox.getDockerStatus('javascript');

    if (!status.enabled) {
      return {
        name: 'God-Mode Container',
        status: 'PULADO',
        detail: status.detail,
        required: false,
      };
    }

    if (status.canRun) {
      return {
        name: 'God-Mode Container',
        status: 'PASSED',
        detail: status.detail,
        required: Boolean(config.dockerSandboxRequired),
      };
    }

    return {
      name: 'God-Mode Container',
      status: config.dockerSandboxRequired ? 'failed' : 'AVISO',
      detail: status.detail,
      required: Boolean(config.dockerSandboxRequired),
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Container',
      status: config.dockerSandboxRequired ? 'failed' : 'AVISO',
      detail: error.message || String(error),
      required: Boolean(config.dockerSandboxRequired),
    };
  }
}

async function smokeNodeMesh(): Promise<SmokeResult> {
  try {
    const report = await runNodeMeshSmoke();
    if (report.ok) {
      return {
        name: 'God-Mode NodeMesh',
        status: 'PASSED',
        detail: report.summary,
        required: true,
      };
    }

    return {
      name: 'God-Mode NodeMesh',
      status: 'failed',
      detail: report.error || report.summary,
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode NodeMesh',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeChannelProviders(): Promise<SmokeResult> {
  try {
    const report = await new ChannelProviderDoctorService().run();
    if (report.status === 'passed') {
      return {
        name: 'God-Mode Channels',
        status: 'PASSED',
        detail: report.summary,
        required: false,
      };
    }

    if (report.status === 'skipped') {
      return {
        name: 'God-Mode Channels',
        status: 'PULADO',
        detail: report.summary,
        required: false,
      };
    }

    return {
      name: 'God-Mode Channels',
      status: 'AVISO',
      detail: report.summary,
      required: false,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Channels',
      status: 'AVISO',
      detail: error.message || String(error),
      required: false,
    };
  }
}

async function smokePermissionTelemetry(): Promise<SmokeResult> {
  try {
    const store = new Map<string, any>();
    const telemetryEvents: Array<Record<string, any>> = [];
    const repo = {
      init: async () => undefined,
      save: (permission: any) => {
        store.set(permission.permission_id, permission);
      },
      getById: (permissionId: string) => store.get(permissionId),
      list: () => [],
      findPendingMatch: () => undefined,
      findApproved: () => undefined,
      findApprovedMatch: () => undefined,
      listApproved: () => [],
    };
    const telemetryRuntime = {
      record: async (event: Record<string, any>) => {
        telemetryEvents.push(event);
      },
    } as any;
    const permissions = new PermissionService(repo as any, telemetryRuntime);

    const created = await permissions.createRequest({
      task_id: 'smoke-task',
      executor: 'codex',
      kind: 'command_access',
      requested_value: 'npm test',
      resolved_value: 'npm test',
      reason: 'Smoke validation',
    });
    await permissions.approveRequest(created.permission_id, 'smoke-operator');

    const approvedEvent = telemetryEvents.find((event) => event.eventType === 'permission.approved');
    if (!approvedEvent) {
      throw new Error('permission approval event was not emitted.');
    }
    if (approvedEvent.traceId !== 'task:smoke-task') {
      throw new Error('permission traceId was not correlated with the task.');
    }

    return {
      name: 'God-Mode Approval',
      status: 'PASSED',
      detail: 'approval plane gravou evento estruturado com trace da task.',
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'God-Mode Approval',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function runHostIntegrationSmokeTests(): Promise<SmokeResult[]> {
  console.log('\nIntegrations do host: validando conectividade configurada...');

  return [
    await smokeTelegramIntegration(),
    await smokeStitchIntegration(),
    await smokeAiStudioIntegration(),
    await smokeExternalExecutorIntegration(),
    await smokeZavorthBridgeIntegration(),
  ];
}

async function smokeTelegramIntegration(): Promise<SmokeResult> {
  if (!config.telegramBotToken) {
    return {
      name: 'Telegram',
      status: 'PULADO',
      detail: 'TELEGRAM_BOT_TOKEN not configured on this host.',
      required: false,
    };
  }

  try {
    const bot = new Bot(config.telegramBotToken);
    const me = await bot.api.getMe();
    return {
      name: 'Telegram',
      status: 'PASSED',
      detail: `autenticado como @${me.username} (ID ${me.id}).`,
      required: true,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'Telegram',
      status: 'failed',
      detail: error.message || String(error),
      required: true,
    };
  }
}

async function smokeStitchIntegration(): Promise<SmokeResult> {
  try {
    const stitch = new StitchExecutor();
    const isAvailable = await stitch.isAvailable();
    if (!isAvailable) {
      return {
        name: 'Google Stitch',
        status: 'PULADO',
        detail: 'not configured on this host.',
        required: false,
      };
    }

    const probe = await stitch.probeConnection();
    return {
      name: 'Google Stitch',
      status: probe.ok ? 'PASSED' : 'AVISO',
      detail: probe.message,
      required: false,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'Google Stitch',
      status: 'AVISO',
      detail: error.message || String(error),
      required: false,
    };
  }
}

async function smokeAiStudioIntegration(): Promise<SmokeResult> {
  try {
    const aiStudio = new AiStudioExecutor();
    const isAvailable = await aiStudio.isAvailable();
    if (!isAvailable) {
      return {
        name: 'Google AI Studio',
        status: 'PULADO',
        detail: 'not configured on this host.',
        required: false,
      };
    }

    const probe = await aiStudio.probeConnection();
    return {
      name: 'Google AI Studio',
      status: probe.ok ? 'PASSED' : 'AVISO',
      detail: probe.message,
      required: false,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'Google AI Studio',
      status: 'AVISO',
      detail: error.message || String(error),
      required: false,
    };
  }
}

async function smokeExternalExecutorIntegration(): Promise<SmokeResult> {
  try {
    const externalExecutor = new ExternalExecutor();
    const isAvailable = await externalExecutor.isAvailable();
    if (!isAvailable) {
      return {
        name: 'External Executor',
        status: 'AVISO',
        detail: 'CLI unavailable ou without valid responsea on this host.',
        required: false,
      };
    }

    return {
      name: 'External Executor',
      status: 'PASSED',
      detail: 'CLI available e respondendo.',
      required: false,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'External Executor',
      status: 'AVISO',
      detail: error.message || String(error),
      required: false,
    };
  }
}

async function smokeZavorthBridgeIntegration(): Promise<SmokeResult> {
  try {
    const zavorthBridge = new ZavorthBridgeControlService();
    const status = await zavorthBridge.status();

    if (status.ok || status.processFound || status.windowFound) {
      const detailParts = [
        `process ${status.processFound ? 'active' : 'inactive'}`,
        `window ${status.windowFound ? 'active' : 'inactive'}`,
      ];
      if (status.selectedModel) {
        detailParts.push(`modelo ${status.selectedModel}`);
      }

      return {
        name: 'ZavorthBridge',
        status: 'PASSED',
        detail: detailParts.join(', ') + '.',
        required: false,
      };
    }

    if (status.appInstalled) {
      return {
        name: 'ZavorthBridge',
        status: 'AVISO',
        detail: 'app installed, but without an active window right now.',
        required: false,
      };
    }

    return {
      name: 'ZavorthBridge',
      status: 'AVISO',
      detail: status.errorMessage || status.message || 'service unavailable on this host.',
      required: false,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return {
      name: 'ZavorthBridge',
      status: 'AVISO',
      detail: error.message || String(error),
      required: false,
    };
  }
}

runSmokeTests().catch((error) => {
  console.error('error geral durante os smoke tests:', error);
  process.exit(1);
});
