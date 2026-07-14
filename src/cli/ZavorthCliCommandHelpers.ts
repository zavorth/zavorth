import { config } from '../config/index.js';
import { TaskManager } from '../orchestrator/TaskManager.js';
import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { TaskRepository } from '../storage/TaskRepository.js';
import { ZavorthGatewayService } from '../services/ZavorthGatewayService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import { ZavorthLearningPlaneService } from '../services/ZavorthLearningPlaneService.js';
import { ZavorthNodeMeshService } from '../services/ZavorthNodeMeshService.js';
import { NodePairingService } from '../services/NodePairingService.js';
import { NodeInvokeService } from '../services/NodeInvokeService.js';
import { NodeDeviceProfileService } from '../services/NodeDeviceProfileService.js';
import { NodeCapabilityService } from '../services/NodeCapabilityService.js';
import { ZavorthPlatformRegistryService } from '../services/ZavorthPlatformRegistryService.js';
import { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import { ZavorthPlatformActionService } from '../services/ZavorthPlatformActionService.js';
import { ZavorthToolSurfaceService } from '../services/ZavorthToolSurfaceService.js';
import { ZavorthHookPlaneService } from '../services/ZavorthHookPlaneService.js';
import { ZavorthSessionPlaneService } from '../services/ZavorthSessionPlaneService.js';
import { AIGatewayProxyService } from '../services/AIGatewayProxyService.js';
import { ZavorthGatewayRuntimeService } from '../services/ZavorthGatewayRuntimeService.js';
import { ZavorthGatewayLauncherService } from '../services/ZavorthGatewayLauncherService.js';
import { GatewayCompatibilityDoctorService } from '../services/GatewayCompatibilityDoctorService.js';
import { GatewayUpstreamSyncService } from '../services/GatewayUpstreamSyncService.js';
import { ProviderControlPlaneService } from '../services/ProviderControlPlaneService.js';
import { ModelPickerContractService } from '../domain/providers/index.js';
import { OperationsCockpitService } from '../services/OperationsCockpitService.js';
import { OperationsHealthService } from '../services/OperationsHealthService.js';
import { OperatorBriefService } from '../services/OperatorBriefService.js';
import { AutoRepairService } from '../services/AutoRepairService.js';
import { ZavorthCapabilityOsService } from '../services/ZavorthCapabilityOsService.js';
import { ZavorthTaskOperatingSystemService } from '../services/ZavorthTaskOperatingSystemService.js';
import { ZavorthSupervisorGraphService } from '../services/ZavorthSupervisorGraphService.js';
import { ZavorthWorkspaceMemoryOsService } from '../services/ZavorthWorkspaceMemoryOsService.js';
import { ZavorthSelfHealControlPlaneService } from '../services/ZavorthSelfHealControlPlaneService.js';
import { ZavorthReleasePresenceControlPlaneService } from '../services/ZavorthReleasePresenceControlPlaneService.js';
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from '../runtime/agent/index.js';
import { MemoryService } from '../services/MemoryService.js';
import { normalizeTerminalComposerInput } from './ZavorthCliTerminalComposer.js';

import { TaskLedgerService } from '../services/TaskLedgerService.js';
import { PermissionScopeLedgerService } from '../services/PermissionScopeLedgerService.js';
import { PermissionService } from '../services/PermissionService.js';
import { RuntimeAccessReadinessService } from '../runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeDiagnosticsService } from '../services/RuntimeDiagnosticsService.js';
import { SharedSurfaceCommandService } from '../services/SharedSurfaceCommandService.js';
import { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { InternalSurfaceApiService } from '../api/internal/InternalSurfaceApiService.js';
import { ZavorthPackagePublisher } from '../platform/publish/ZavorthPackagePublisher.js';
import { ExperienceCoreService } from '../services/experience/ExperienceCoreService.js';
import { createBootstrapToolRuntime } from '../bootstrap/bootstrapToolRuntime.js';
import { createContextEngineRuntime, wireLegacyUnifiedGatewayAgentCallback } from '../bootstrap/bootstrapContextEngine.js';
import {
  canonicalizeCliCommandInput,
  createDefaultSessionId,
  extractCommandArgs,
  normalizeCliCommandName,
  normalizeCliInput,
} from './ZavorthCliFlowHelpers.js';

import { normalizeZavorthHeadlessArgs } from './headless/ZavorthHeadlessCommand.js';
import {
  isNaturalCliCommand,
  mapCliCommandToSlash,
  naturalizeCliSurfaceText,
} from './CliNaturalConvention.js';
import type { ZavorthCliFlags, ZavorthCliRuntime, ZavorthCliServiceOverrides } from './ZavorthCliContract.js';

function buildSessionPlaneInput(
  flags: Pick<ZavorthCliFlags, 'userId' | 'platform' | 'chatId' | 'sessionId'>,
  target: string | null,
): {
  userId: string;
  platform: string;
  chatId: string | null;
  sessionId: string | null;
} {
  const normalizedTarget = String(target || '').trim() || null;
  return {
    userId: flags.userId,
    platform: flags.platform,
    chatId: normalizedTarget || flags.chatId || null,
    sessionId: normalizedTarget || flags.sessionId || null,
  };
}

function resolveOperationsIntent(args: string): {
  mode:
    | 'snapshot'
    | 'brief'
    | 'actions'
    | 'run'
    | 'access'
    | 'doctor'
    | 'quality'
    | 'bootstrap'
    | 'bootstrap-repair'
    | 'changes'
    | 'reload'
    | 'autorepair'
    | 'autorepair-status';
  actionId: string;
  force: boolean;
  dryRun: boolean;
  improve: boolean;
} {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  if (!first) {
    return { mode: 'snapshot', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'brief') {
    return { mode: 'brief', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'actions') {
    return { mode: 'actions', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'access') {
    return { mode: 'access', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'doctor') {
    return { mode: 'doctor', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'quality') {
    return { mode: 'quality', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'bootstrap' && String(tokens[1] || '').trim().toLowerCase() === 'repair') {
    return {
      mode: 'bootstrap-repair',
      actionId: '',
      force: false,
      dryRun: tokens.includes('dryrun') || tokens.includes('--dry-run'),
      improve: false,
    };
  }
  if (first === 'bootstrap') {
    return { mode: 'bootstrap', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'changes') {
    return { mode: 'changes', actionId: '', force: false, dryRun: false, improve: false };
  }
  if (first === 'reload') {
    return {
      mode: 'reload',
      actionId: '',
      force: tokens.includes('force'),
      dryRun: false,
      improve: false,
    };
  }
  if (first === 'autorepair') {
    if (String(tokens[1] || '').trim().toLowerCase() === 'status') {
      return { mode: 'autorepair-status', actionId: '', force: false, dryRun: false, improve: false };
    }
    return {
      mode: 'autorepair',
      actionId: '',
      force: tokens.includes('force'),
      dryRun: tokens.includes('dryrun') || tokens.includes('--dry-run'),
      improve: tokens.includes('improve'),
    };
  }
  if (first === 'run' || first === 'action') {
    return {
      mode: 'run',
      actionId: tokens.slice(1).join(' ').trim(),
      force: false,
      dryRun: false,
      improve: false,
    };
  }
  return { mode: 'snapshot', actionId: '', force: false, dryRun: false, improve: false };
}

function resolvePlatformIntent(args: string): {
  mode: 'snapshot' | 'sync' | 'action' | 'publish';
  query: string | null;
  actionId: string;
  entryId: string;
} {
  const normalized = String(args || '').trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const actionIds = new Set(['inspect', 'open', 'doctor', 'trust', 'review', 'install', 'update', 'remove']);
  if (!first) {
    return { mode: 'snapshot', query: null, actionId: '', entryId: '' };
  }
  if (first === 'sync') {
    return { mode: 'sync', query: null, actionId: '', entryId: '' };
  }
  if (first === 'publish') {
    return {
      mode: 'publish',
      query: null,
      actionId: 'publish',
      entryId: tokens.slice(1).join(' ').trim(),
    };
  }
  if (actionIds.has(first)) {
    return {
      mode: 'action',
      query: null,
      actionId: first,
      entryId: tokens.slice(1).join(' ').trim(),
    };
  }
  return {
    mode: 'snapshot',
    query: normalized,
    actionId: '',
    entryId: '',
  };
}

function parseCliSessionSendArgs(rawArgs: string): {
  targetRef: string;
  message: string;
} | null {
  const normalized = String(rawArgs || '').trim();
  if (!normalized) {
    return null;
  }

  const separatorIndex = normalized.indexOf('--');
  if (separatorIndex >= 0) {
    const targetRef = normalized.slice(0, separatorIndex).trim();
    const message = normalized.slice(separatorIndex + 2).trim();
    return targetRef && message ? { targetRef, message } : null;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return null;
  }

  const [targetRef, ...messageParts] = tokens;
  const message = messageParts.join(' ').trim();
  return targetRef && message ? { targetRef, message } : null;
}

function resolveSessionTargetRef(
  targetRef: string,
  flags: Pick<ZavorthCliFlags, 'platform'>,
): {
  platform: string;
  chatId: string;
  sessionId: string | null;
  sourceUserId: string | null;
} {
  const normalized = String(targetRef || '').trim();
  if (normalized.includes(':')) {
    const [platform, ...rest] = normalized.split(':');
    const derived = rest.join(':').trim() || null;
    const sessionId = platform === 'web' ? derived : null;
    return {
      platform: platform || flags.platform,
      chatId: normalized,
      sessionId,
      sourceUserId: derived,
    };
  }

  return {
    platform: 'web',
    chatId: `web:${normalized}`,
    sessionId: normalized,
    sourceUserId: normalized,
  };
}

type CliResolvedExecutionInput = {
  surfaceText: string;
  nativeText: string;
  commandName: string | null;
  args: string;
};

function normalizeCliGroupedSessionInput(rawArgs: string): string {
  const normalized = String(rawArgs || '').trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const rest = tokens.slice(1).join(' ').trim();
  if (!first || first === 'list') {
    return 'sessions';
  }
  if (first === 'history') {
    return rest ? `sessionhistory ${rest}` : 'sessionhistory';
  }
  if (first === 'send') {
    return rest ? `sessionsend ${rest}` : 'sessionsend';
  }
  if (first === 'spawn') {
    return rest ? `sessionspawn ${rest}` : 'sessionspawn';
  }
  return `sessions ${normalized}`.trim();
}

function normalizeCliGroupedNodeInput(rawArgs: string): string {
  const normalized = String(rawArgs || '').trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const rest = tokens.slice(1).join(' ').trim();
  if (!first || first === 'list') {
    return 'nodes';
  }
  if (first === 'pair') {
    return rest ? `nodepair ${rest}` : 'nodepair';
  }
  if (first === 'invoke') {
    return rest ? `nodeinvoke ${rest}` : 'nodeinvoke';
  }
  return `nodes ${normalized}`.trim();
}

function isCliNativeAliasCommand(commandName: string | null): boolean {
  return new Set([
    'help',
    'context',
    'status',
    'commands',
    'doctor',
    'brief',
    'gateway',
    'productization',
    'product',
    'domains',
    'learning',
    'memory',
    'memoryplane',
    'sessions',
    'sessionhistory',
    'sessionsend',
    'sessionspawn',
    'nodes',
    'nodepair',
    'nodeinvoke',
    'tools',
    'hooks',
    'workspace',
    'platform',
    'plugins',
    'plugin',
    'aigateway',
    'cockpit',
    'capabilities',
    'tasks',
    'artifacts',
      'supervisor',
      'graph',
    'heal',
    'release',
    'security',
    'workflows',
    'loop',
    ]).has(String(commandName || '').trim().toLowerCase());
  }

function resolveCliExecutionInput(rawInput: string): CliResolvedExecutionInput {
  const normalized = normalizeCliInput(normalizeTerminalComposerInput(rawInput));
  if (!normalized) {
    return {
      surfaceText: '',
      nativeText: '',
      commandName: null,
      args: '',
    };
  }

  const canonical = canonicalizeCliCommandInput(normalized);
  const commandName = normalizeCliCommandName(canonical);
  const args = extractCommandArgs(canonical);
  let surfaceText = normalized;
  let nativeText = normalized;

  switch (String(commandName || '').trim().toLowerCase()) {
    case 'ctx':
      surfaceText = ['context', args].filter(Boolean).join(' ');
      nativeText = surfaceText;
      break;
    case 'run':
      surfaceText = ['/task', args].filter(Boolean).join(' ');
      nativeText = ['task', args].filter(Boolean).join(' ');
      break;
    case 'task':
      surfaceText = canonical.startsWith('/') ? canonical : `/${canonical}`;
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'continue':
      surfaceText = args ? `/task continue ${args}` : '/task continue';
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'history':
      surfaceText = args ? `sessionhistory ${args}` : 'sessionhistory';
      nativeText = surfaceText;
      break;
    case 'ops':
      surfaceText = ['cockpit', args].filter(Boolean).join(' ');
      nativeText = surfaceText;
      break;
    case 'capabilities':
    case 'productization':
    case 'product':
      surfaceText = ['capabilities', args].filter(Boolean).join(' ');
      if (commandName === 'productization' || commandName === 'product') {
        surfaceText = [commandName, args].filter(Boolean).join(' ');
      }
      nativeText = surfaceText;
      break;
    case 'tasks':
    case 'artifacts':
      case 'supervisor':
      case 'graph':
      case 'heal':
      case 'release':
      case 'workspace':
      case 'workflows':
        surfaceText = [commandName, args].filter(Boolean).join(' ');
        nativeText = surfaceText;
        break;
    case 'sessions':
      surfaceText = normalizeCliGroupedSessionInput(args);
      nativeText = surfaceText;
      break;
    case 'nodes':
      surfaceText = normalizeCliGroupedNodeInput(args);
      nativeText = surfaceText;
      break;
    case 'approve':
    case 'reject':
      surfaceText = `/${commandName}${args ? ` ${args}` : ''}`.trim();
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'resume':
      surfaceText = `/workflow resume${args ? ` ${args}` : ''}`.trim();
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'restart-stage':
      surfaceText = `/workflow restart-stage${args ? ` ${args}` : ''}`.trim();
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'close-workflow':
      surfaceText = `/workflow close${args ? ` ${args}` : ''}`.trim();
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    case 'plugins':
    case 'plugin':
    case 'workflow':
    case 'tenants':
    case 'commands':
    case 'tools':
    case 'hooks':
    case 'transports':
    case 'channels':
    case 'runtime':
    case 'loop':
    case 'agmobile':
    case 'hub':
    case 'skills':
    case 'skill':
    case 'learning':
    case 'memory':
    case 'memoryplane':
    case 'consensus':
    case 'deliberate':
    case 'moa':
    case 'model':
    case 'watchmode':
    case 'codexremote':
    case 'sessionsend':
    case 'sessionspawn':
    case 'sessionhistory':
    case 'enable':
    case 'disable':
    case 'agents':
    case 'schedule':
    case 'schedules':
    case 'unschedule':
    case 'report':
    case 'automations':
    case 'platform':
    case 'integrations':
    case 'connect':
    case 'access':
    case 'trust':
    case 'bootstrap':
    case 'evals':
    case 'qa':
    case 'governance':
    case 'ecosystem':
    case 'fleet':
    case 'stability':
    case 'aigateway':
    case 'computer':
    case 'device':
    case 'vision':
    case 'invoke':
    case 'plan':
    case 'auto':
    case 'dryrun':
      surfaceText = `/${commandName}${args ? ` ${args}` : ''}`.trim();
      nativeText = canonicalizeCliCommandInput(surfaceText);
      break;
    default:
      if (normalized.startsWith('/') && isCliNativeAliasCommand(commandName)) {
        nativeText = canonical;
      } else if (isNaturalCliCommand(commandName)) {
        const slash = mapCliCommandToSlash(commandName) || `/${commandName}`;
        surfaceText = `${slash}${args ? ` ${args}` : ''}`.trim();
        nativeText = canonicalizeCliCommandInput(surfaceText);
      }
      break;
  }

  // Universal natural rewrite (same policies as chat slash)
  if (surfaceText.startsWith('/')) {
    const natural = naturalizeCliSurfaceText(surfaceText);
    surfaceText = natural.text;
    nativeText = canonicalizeCliCommandInput(surfaceText);
  } else if (isNaturalCliCommand(commandName)) {
    const natural = naturalizeCliSurfaceText(surfaceText);
    if (natural.text.startsWith('/')) {
      surfaceText = natural.text;
      nativeText = canonicalizeCliCommandInput(surfaceText);
    }
  }

  return {
    surfaceText,
    nativeText,
    commandName: normalizeCliCommandName(nativeText),
    args: extractCommandArgs(nativeText),
  };
}

export function parseZavorthCliFlags(argv: string[]): ZavorthCliFlags {
  const headless = normalizeZavorthHeadlessArgs(argv);
  const effectiveArgv = headless.argv;
  const { resolveCliDefaultUserId } = require('../services/ZavorthDefaultUserId.js') as typeof import('../services/ZavorthDefaultUserId.js');
  const defaultUserId = resolveCliDefaultUserId({
    allowedUserIds: config.allowedUserIds,
    envUser: process.env.USERNAME || process.env.USER || null,
  });
  const flags: ZavorthCliFlags = {
    command: null,
    repl: false,
    json: false,
    live: false,
    userId: defaultUserId,
    platform: 'web',
    chatId: `cli:${defaultUserId}`,
    sessionId: createDefaultSessionId(),
    workspaceHint: null,
    commandText: null,
    headless: headless.enabled,
    approvalMode: headless.approvalMode,
  };
  const commandParts: string[] = [];

  for (let index = 0; index < effectiveArgv.length; index += 1) {
    const token = String(effectiveArgv[index] || '').trim();
    if (!token) {
      continue;
    }

    if (token === '--repl') {
      flags.repl = true;
      continue;
    }

    if (token === '--json') {
      flags.json = true;
      continue;
    }

    if (token === '--live') {
      flags.live = true;
      continue;
    }

    if (token === '--user' && effectiveArgv[index + 1]) {
      flags.userId = String(effectiveArgv[index + 1]).trim() || flags.userId;
      index += 1;
      continue;
    }

    if (token === '--platform' && effectiveArgv[index + 1]) {
      const platform = String(effectiveArgv[index + 1]).trim().toLowerCase();
      if (platform === 'telegram' || platform === 'discord' || platform === 'web') {
        flags.platform = platform;
      }
      index += 1;
      continue;
    }

    if (token === '--chat' && effectiveArgv[index + 1]) {
      flags.chatId = String(effectiveArgv[index + 1]).trim() || flags.chatId;
      index += 1;
      continue;
    }

    if (token === '--chat-id' && effectiveArgv[index + 1]) {
      flags.chatId = String(effectiveArgv[index + 1]).trim() || flags.chatId;
      index += 1;
      continue;
    }

    if (token === '--session' && effectiveArgv[index + 1]) {
      flags.sessionId = String(effectiveArgv[index + 1]).trim() || flags.sessionId;
      index += 1;
      continue;
    }

    if (token === '--session-id' && effectiveArgv[index + 1]) {
      flags.sessionId = String(effectiveArgv[index + 1]).trim() || flags.sessionId;
      index += 1;
      continue;
    }

    if (token === '--workspace' && effectiveArgv[index + 1]) {
      flags.workspaceHint = String(effectiveArgv[index + 1]).trim() || null;
      index += 1;
      continue;
    }

    commandParts.push(token);
  }

  const rawCommandText = commandParts.length > 0 ? commandParts.join(' ').trim() : null;
  const rawCommandName = normalizeCliCommandName(commandParts[0] || null);
  const rawArgs = commandParts.slice(1).join(' ').trim();

  flags.commandText = rawCommandText;
  flags.command = rawCommandName;

  switch (String(rawCommandName || '').trim().toLowerCase()) {
    case 'chat':
      flags.repl = true;
      flags.commandText = null;
      flags.command = null;
      break;
    case 'ctx':
      flags.commandText = 'context';
      flags.command = 'context';
      break;
    case 'run':
      flags.commandText = rawArgs ? `task ${rawArgs}` : 'task';
      flags.command = 'task';
      break;
    case 'continue':
      flags.commandText = rawArgs ? `task continue ${rawArgs}` : 'task continue';
      flags.command = 'task';
      break;
    case 'history':
      flags.commandText = rawArgs ? `sessionhistory ${rawArgs}` : 'sessionhistory';
      flags.command = 'sessionhistory';
      break;
    case 'approve':
    case 'reject':
      flags.commandText = `/${rawCommandName}${rawArgs ? ` ${rawArgs}` : ''}`.trim();
      flags.command = rawCommandName;
      break;
    case 'resume':
      flags.commandText = `/workflow resume${rawArgs ? ` ${rawArgs}` : ''}`.trim();
      flags.command = 'workflow';
      break;
    case 'restart-stage':
      flags.commandText = `/workflow restart-stage${rawArgs ? ` ${rawArgs}` : ''}`.trim();
      flags.command = 'workflow';
      break;
    case 'close-workflow':
      flags.commandText = `/workflow close${rawArgs ? ` ${rawArgs}` : ''}`.trim();
      flags.command = 'workflow';
      break;
    default:
      break;
  }

  if (!flags.chatId) {
    flags.chatId = `cli:${flags.userId}`;
  }

  return flags;
}

export const parseZavorthCliArgs = parseZavorthCliFlags;

async function buildDefaultCliRuntime(options: {
  includeLegacyUnifiedGateway?: boolean;
} = {}): Promise<ZavorthCliRuntime> {
  const includeLegacyUnifiedGateway = options.includeLegacyUnifiedGateway ?? false;
  await Database.getInstance();
  const logRepo = new LogRepository();
  const taskRepo = new TaskRepository();
  await logRepo.init();
  await taskRepo.init();

  const taskManager = new TaskManager(taskRepo, logRepo);
  const toolRuntimeServices = createBootstrapToolRuntime(logRepo);
  // P0: wait for Plugin OS capability tools before CLI agent sessions.
  try {
    if (toolRuntimeServices.pluginOs?.ready) {
      await Promise.race([
        toolRuntimeServices.pluginOs.ready,
        new Promise((resolve) => setTimeout(resolve, Number(process.env.ZAVORTH_PLUGIN_OS_READY_TIMEOUT_MS) || 15000)),
      ]);
    }
  } catch {
    /* soft-fail: continue without plugins */
  }
  // P2: reconcile skill firewall tool maps with the live registry.
  try {
    const { reconcileSkillToolsWithRegistry } = require('../services/SkillToolRegistryBridge.js');
    const runtime = toolRuntimeServices.toolRuntime as {
      hasTool?(name: string): boolean;
      getToolDefinitions?(): Array<{ name: string }>;
    };
    if (runtime?.getToolDefinitions) {
      const defs = runtime.getToolDefinitions() || [];
      const names = new Set(defs.map((t) => t.name));
      reconcileSkillToolsWithRegistry({
        hasTool: (name: string) => names.has(name) || runtime.hasTool?.(name) === true,
        getAllTools: () => defs,
      });
    }
  } catch {
    /* soft */
  }
  if (!process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE) {
    process.env.ZAVORTH_TOOL_EXPOSURE_PROFILE = 'daily-ops';
  }
  const runtimeDiagnostics = new RuntimeDiagnosticsService(taskManager, logRepo);
  const sharedSurfaceCommandService = new SharedSurfaceCommandService({ runtimeDiagnostics });
  const commandService = new InternalSurfaceApiService({ commandService: sharedSurfaceCommandService });
  const gatewayService = new ZavorthGatewayService();
  const memoryService = new MemoryService();
  const memoryPlaneService = new ZavorthMemoryPlaneService({
    memoryService,
  });
  const learningPlaneService = new ZavorthLearningPlaneService();
  const layeredMemoryService = new ZavorthLayeredMemoryService({ learningPlaneService });
  const platformRegistryService = new ZavorthPlatformRegistryService();
  const platformCatalogSyncService = new ZavorthPlatformCatalogSyncService();
  const platformActionService = new ZavorthPlatformActionService({
    platformRegistryService,
    learningPlaneService,
  });
  const platformPublisherService = new ZavorthPackagePublisher();
  const nodeDeviceProfileService = new NodeDeviceProfileService();
  const nodeCapabilityService = new NodeCapabilityService();
  const nodeMeshService = new ZavorthNodeMeshService();
  const nodePairingService = new NodePairingService({
    deviceProfileService: nodeDeviceProfileService,
    capabilityService: nodeCapabilityService,
  });
  const nodeInvokeService = new NodeInvokeService({
    capabilityService: nodeCapabilityService,
  });
  const sessionPlaneService = new ZavorthSessionPlaneService();
  const hookPlaneService = new ZavorthHookPlaneService();
  const toolSurfaceService = new ZavorthToolSurfaceService({
    hookPlaneService,
  });
  const AIGatewayGatewayService = new AIGatewayProxyService();
  const providerControlPlane = new ProviderControlPlaneService();
  const modelPickerContractService = new ModelPickerContractService({
    providerControlPlane,
  });
  const gatewayControlService = new ZavorthGatewayRuntimeService({
    getStatus: () => ({
      enabled: false,
      source: 'runtime-file',
      tokenFile: '',
    }),
  } as any);
  gatewayControlService.attachOperations({
    providerControlPlane,
    aiGatewayGateway: AIGatewayGatewayService,
  });
  const AIGatewayGatewayLauncherService = new ZavorthGatewayLauncherService({
    gatewayService: AIGatewayGatewayService,
  });
  const GatewayCompatibilityDoctorServiceInstance = new GatewayCompatibilityDoctorService({
    gatewayService: AIGatewayGatewayService,
  });
  const GatewayUpstreamSyncServiceInstance = new GatewayUpstreamSyncService({
    compatibilityDoctorService: GatewayCompatibilityDoctorServiceInstance,
  });
  const runtimeAccessReadinessService = new RuntimeAccessReadinessService();
  const operationsHealthService = new OperationsHealthService(logRepo);
  const autoRepairService = new AutoRepairService();
  const operationsCockpitService = new OperationsCockpitService(logRepo, {
    operationsHealthService,
  });
  const operatorBriefService = new OperatorBriefService(operationsCockpitService);
  const capabilityOsService = new ZavorthCapabilityOsService();
  const permissionService = new PermissionService();
  const taskOperatingSystemService = new ZavorthTaskOperatingSystemService({
    taskLedgerService: new TaskLedgerService(taskRepo),
    permissionScopeLedgerService: new PermissionScopeLedgerService(permissionService),
  });
  const supervisorGraphService = new ZavorthSupervisorGraphService({
    capabilityOsService,
    taskOperatingSystemService,
  });
  const workspaceMemoryOsService = new ZavorthWorkspaceMemoryOsService({
    memoryPlaneService,
    layeredMemoryService,
    learningPlaneService,
    taskOperatingSystemService,
    memoryService,
  });
  const selfHealControlPlaneService = new ZavorthSelfHealControlPlaneService({
    operationsHealthService,
    autoRepairService,
  });
  const releasePresenceControlPlaneService = new ZavorthReleasePresenceControlPlaneService({
    operationsHealthService,
  });
  const agentGateway = new ZavorthAgentGateway({
    defaultProviderLabel: config.llmProvider || 'Zavorth',
    defaultModelLabel: config.geminiModel || config.geminiDefaultModel || config.openaiModel || 'current model',
    modelPickerContractService,
    llmRuntime: new LlmRuntimeService(),
    toolRuntime: toolRuntimeServices.toolRuntime,
    runStore: createDefaultAgentRunStore(),
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
  });
  const experienceCoreService = new ExperienceCoreService({
    agentGateway,
    memoryPlane: memoryPlaneService,
    learningPlane: learningPlaneService,
    runtimeAccessReadiness: runtimeAccessReadinessService,
  });
  let legacyUnifiedGateway: ZavorthCliRuntime['legacyUnifiedGateway'] = null;

  if (includeLegacyUnifiedGateway) {
    const contextEngineRuntime = createContextEngineRuntime(logRepo, process.cwd());
    wireLegacyUnifiedGatewayAgentCallback({
      logRepo,
      contextEngine: contextEngineRuntime.contextEngine,
      legacyUnifiedGateway: contextEngineRuntime.legacyUnifiedGateway,
      runtimeComposition: toolRuntimeServices.runtimeComposition,
    });
    legacyUnifiedGateway = contextEngineRuntime.legacyUnifiedGateway;
  }

  return {
    commandService,
    gatewayService,
    legacyUnifiedGateway,
    memoryPlaneService,
    learningPlaneService,
    experienceCoreService,
    layeredMemoryService,
    platformRegistryService,
    platformCatalogSyncService,
    platformActionService,
    platformPublisherService,
    nodeMeshService,
    nodePairingService,
    nodeInvokeService,
    sessionPlaneService,
    nodeDeviceProfileService,
    nodeCapabilityService,
    toolSurfaceService,
    hookPlaneService,
    gatewayControlService,
    AIGatewayGatewayService,
    AIGatewayGatewayLauncherService,
    GatewayCompatibilityDoctorService: GatewayCompatibilityDoctorServiceInstance,
    GatewayUpstreamSyncService: GatewayUpstreamSyncServiceInstance,
    runtimeAccessReadinessService,
    autoRepairService,
    operationsHealthService,
    operationsCockpitService,
    operatorBriefService,
    capabilityOsService,
    taskOperatingSystemService,
    supervisorGraphService,
    workspaceMemoryOsService,
    selfHealControlPlaneService,
    releasePresenceControlPlaneService,
    agentGateway,
  };
}

async function buildCliRuntimeFromOverrides(
  services: ZavorthCliServiceOverrides = {},
): Promise<ZavorthCliRuntime> {
  const runtime = await buildDefaultCliRuntime({
    includeLegacyUnifiedGateway: Object.keys(services).length === 0,
  });
  const legacyUnifiedGatewayOverride = services.legacyUnifiedGateway;
  const preferDispatcherCompatibility =
    services.legacyUnifiedGateway === undefined
    && services.surfaceTaskDispatcher !== undefined;
  const preferLegacyConversationCompatibility =
    Object.keys(services).length > 0
    && services.agentGateway === undefined;
  const operationsHealthService = services.operationsHealth ?? runtime.operationsHealthService;
  const autoRepairService = services.autoRepair ?? runtime.autoRepairService;
  const selfHealControlPlaneService = services.selfHealControlPlane
    ?? new ZavorthSelfHealControlPlaneService({
      operationsHealthService,
      autoRepairService,
    });
  const releasePresenceControlPlaneService = services.releasePresenceControlPlane
    ?? new ZavorthReleasePresenceControlPlaneService({
      operationsHealthService,
    });
  const resolvedAgentGateway = preferLegacyConversationCompatibility
    ? null
    : (services.agentGateway ?? runtime.agentGateway);
  const resolvedMemoryPlaneService = services.memoryPlane ?? runtime.memoryPlaneService;
  const resolvedLearningPlaneService = services.learningPlane ?? runtime.learningPlaneService;
  const resolvedRuntimeAccessReadinessService =
    services.runtimeAccessReadiness ?? runtime.runtimeAccessReadinessService;
  const experienceCoreService = services.experienceCore ?? new ExperienceCoreService({
    agentGateway: resolvedAgentGateway || null,
    memoryPlane: resolvedMemoryPlaneService,
    learningPlane: resolvedLearningPlaneService,
    runtimeAccessReadiness: resolvedRuntimeAccessReadinessService,
  });
  return {
    ...runtime,
    commandService: services.commandService || runtime.commandService,
    gatewayService: services.gateway || runtime.gatewayService,
    legacyUnifiedGateway: preferDispatcherCompatibility
      ? null
      : (legacyUnifiedGatewayOverride !== undefined
        ? legacyUnifiedGatewayOverride
        : runtime.legacyUnifiedGateway || null),
    surfaceTaskDispatcher: services.surfaceTaskDispatcher ?? runtime.surfaceTaskDispatcher,
    supervisedRuntimeService: services.supervisedRuntime ?? runtime.supervisedRuntimeService,
    runtimeAccessReadinessService: resolvedRuntimeAccessReadinessService,
    runtimeBootstrapService: services.runtimeBootstrap ?? runtime.runtimeBootstrapService,
    runtimeBootstrapRepairService: services.runtimeBootstrapRepair ?? runtime.runtimeBootstrapRepairService,
    autoRepairService,
    memoryPlaneService: resolvedMemoryPlaneService,
    layeredMemoryService: services.layeredMemory ?? runtime.layeredMemoryService,
    learningPlaneService: resolvedLearningPlaneService,
    experienceCoreService,
    platformRegistryService: services.platformRegistry ?? runtime.platformRegistryService,
    platformCatalogSyncService: services.platformCatalogSync ?? runtime.platformCatalogSyncService,
    platformActionService: services.platformAction ?? runtime.platformActionService,
    platformPublisherService: services.platformPublisher ?? runtime.platformPublisherService,
    nodeMeshService: services.nodeMesh ?? runtime.nodeMeshService,
    nodePairingService: services.nodePairing ?? runtime.nodePairingService,
    nodeInvokeService: services.nodeInvoke ?? runtime.nodeInvokeService,
    sessionPlaneService: services.sessionPlane ?? runtime.sessionPlaneService,
    nodeDeviceProfileService: services.nodeDeviceProfiles ?? runtime.nodeDeviceProfileService,
    nodeCapabilityService: services.nodeCapabilities ?? runtime.nodeCapabilityService,
    toolSurfaceService: services.toolSurface ?? runtime.toolSurfaceService,
    hookPlaneService: services.hookPlane ?? runtime.hookPlaneService,
    gatewayControlService: services.gatewayControl ?? runtime.gatewayControlService,
    AIGatewayGatewayService: services.AIGatewayGateway ?? runtime.AIGatewayGatewayService,
    AIGatewayGatewayLauncherService: services.AIGatewayGatewayLauncher ?? runtime.AIGatewayGatewayLauncherService,
    GatewayCompatibilityDoctorService: services.AIGatewayCompatibilityDoctor ?? runtime.GatewayCompatibilityDoctorService,
    GatewayUpstreamSyncService: services.AIGatewayUpstreamSync ?? runtime.GatewayUpstreamSyncService,
    operationsHealthService,
    operationsActionService: services.operationsAction ?? runtime.operationsActionService,
    operationsCockpitService: services.operationsCockpit ?? runtime.operationsCockpitService,
    operatorBriefService: services.operatorBrief ?? runtime.operatorBriefService,
    capabilityOsService: services.capabilityOs ?? runtime.capabilityOsService,
    taskOperatingSystemService: services.taskOperatingSystem ?? runtime.taskOperatingSystemService,
    supervisorGraphService: services.supervisorGraph ?? runtime.supervisorGraphService,
    workspaceMemoryOsService: services.workspaceMemoryOs ?? runtime.workspaceMemoryOsService,
    selfHealControlPlaneService,
    releasePresenceControlPlaneService,
    agentGateway: resolvedAgentGateway,
  };
}

export {
  buildCliRuntimeFromOverrides,
  buildSessionPlaneInput,
  parseCliSessionSendArgs,
  resolveCliExecutionInput,
  resolveOperationsIntent,
  resolvePlatformIntent,
  resolveSessionTargetRef,
};
