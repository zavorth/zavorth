import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { MemoryService } from '../../services/MemoryService.js';
import { GoalLoopService, type GoalLoopLlmRuntime } from '../../services/GoalLoopService.js';
import { GoalLoopWorkerService, type GoalLoopAgentRunner } from '../../services/GoalLoopWorkerService.js';
import { GoalPlaneService } from '../../services/GoalPlaneService.js';
import { ChannelProgressSurfaceService } from '../../services/ChannelProgressSurfaceService.js';
import { IntegrationConnectorMeshService } from '../../services/IntegrationConnectorMeshService.js';
import { TaskBoardPlaneService } from '../../services/TaskBoardPlaneService.js';
import { TaskPlaneService } from '../../services/TaskPlaneService.js';
import { VoiceWakeRuntimeService } from '../../services/VoiceWakeRuntimeService.js';
import { ZavorthBackgroundTaskService } from '../../services/ZavorthBackgroundTaskService.js';
import { ZavorthHomePathService } from '../../services/ZavorthHomePathService.js';
import { ZavorthMnemosQueryService } from '../../services/ZavorthMnemosQueryService.js';
import { ZavorthOperationalStateDbService } from '../../services/ZavorthOperationalStateDbService.js';
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../../services/SessionContinuumService.js';
import { bindAutonomySchedulePlane } from '../../services/AutonomySchedulePlane.js';
import { ZavorthXaiRuntimeService } from '../../services/ZavorthXaiRuntimeService.js';
import { ZavorthCapabilityActionExposureService } from '../../services/ZavorthCapabilityActionExposureService.js';
import { ZavorthCapabilityAtlasService } from '../../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../../services/ZavorthDailyProductQuietAutonomyService.js';
import {
  type ZavorthActionDefinition,
  type ZavorthActionHandlerInput,
  type ZavorthActionLookupResult,
  type ZavorthActionResult,
} from './ZavorthActionContracts.js';
import { createCapabilitySpineActionModule, createGovernedOpsActionModule, createNativeExtendedToolsActionModule, createNativePowerPacksActionModule, createPowerFabricActionModule, createProductFabricActionModule, createProductizationPacksActionModule, createReachFabricActionModule, createWebBrowserActionModule, createWorkspaceFilesActionModule } from './modules/index.js';
import { asErrorLike } from '../../utils/errorLike.js';

import {
  normalizeText,
  normalizeSearch,
  normalizeMode,
  normalizePositiveNumber,
  stateDir,
  envFile,
  readEnvMode,
  quoteEnv,
  mergeSingleEnvValue,
  redactSecrets,
  appendJsonArray,
  idWithTime,
  result,
  skillGovernanceHandler,
  simpleStatusHandler,
  resolveHome,
  stateDbForHome,
  readJsonFile,
  listJsonFiles,
  providerStatusHandler,
  homeStatusHandler,
  homeMigrationPreviewHandler,
  echoWakeStatusHandler,
  tasksStatusHandler,
  taskPlaneForRoot,
  sessionRecallHandler,
  backgroundTaskHandler,
  goalsHandler,
} from './ZavorthActionHandlersCore.js';
import {
  goalLoopHandler,
  goalLoopWorkerHandler,
} from './ZavorthActionHandlersGoals.js';
import {
  xaiHandler,
  taskBoardHandler,
  memorySearchHandler,
  memoryForgetHandler,
  approvalsStatusHandler,
  channelsReadinessHandler,
  channelProgressHandler,
  integrationConnectorsHandler,
} from './ZavorthActionHandlersOperations.js';
import {
  sandboxStatusHandler,
  capabilityAtlasHandler,
  dailyProductHandler,
  gitReviewHandler,
  setupStatusHandler,
  configStatusHandler,
  operationalStateStatusHandler,
  capabilityActionExposureService,
  verificationIdsFromArgs,
  capabilityExposureHandler,
  generatedCapabilityCandidateHandler,
} from './ZavorthActionHandlersCapabilities.js';
const actionSchema = {
  type: 'object' as const,
  properties: {
    mode: { type: 'string', enum: ['casual', 'governed'] },
    query: { type: 'string' },
  },
};

const outputSchema = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    summary: { type: 'string' },
  },
};

export class ZavorthActionCatalog {
  private readonly actions: ZavorthActionDefinition[];

  constructor(actionsOrRuntime?: ZavorthActionDefinition[] | ZavorthActionCatalogRuntime) {
    this.actions = Array.isArray(actionsOrRuntime)
      ? actionsOrRuntime
      : buildDefaultActions(actionsOrRuntime || {});
    this.assertUniqueIds();
  }

  public list(): ZavorthActionDefinition[] {
    return this.actions.map((action) => ({
      ...action,
      aliases: [...action.aliases],
      domains: [...action.domains],
      surface: [...action.surface],
      effects: action.effects ? [...action.effects] : undefined,
      testRefs: action.testRefs ? [...action.testRefs] : undefined,
    }));
  }

  public get(actionId: string): ZavorthActionDefinition | null {
    const normalized = normalizeSearch(actionId);
    return this.actions.find((action) => normalizeSearch(action.id) === normalized) || null;
  }

  public lookup(input: { query?: string | null; domain?: string | null; limit?: number }): ZavorthActionLookupResult[] {
    const query = normalizeSearch(input.query);
    const domain = normalizeSearch(input.domain);
    const terms = query.split(/\s+/u).filter(Boolean);
    const limit = Math.max(1, Math.min(input.limit || 8, 20));
    return this.actions
      .map((action) => {
        const haystack = normalizeSearch([
          action.id,
          action.title,
          action.description,
          ...action.aliases,
          ...action.domains,
        ].join(' '));
        let score = 0;
        if (domain && action.domains.some((entry) => normalizeSearch(entry) === domain)) score += 12;
        if (query && normalizeSearch(action.id) === query) score += 30;
        if (query && action.aliases.some((alias) => normalizeSearch(alias) === query)) score += 24;
        for (const term of terms) {
          if (action.domains.some((entry) => normalizeSearch(entry) === term)) score += term.length > 3 ? term.length : 1;
          if (haystack.includes(term)) score += term.length > 3 ? 4 : 1;
        }
        return { action, score };
      })
      .filter((entry) => entry.score > 0 || (!query && !domain))
      .sort((a, b) => b.score - a.score || a.action.id.localeCompare(b.action.id))
      .slice(0, limit)
      .map(({ action, score }) => ({
        actionId: action.id,
        title: action.title,
        description: action.description,
        risk: action.risk,
        requiresPreview: action.requiresPreview,
        requiresApproval: action.requiresApproval,
        capabilityId: action.capabilityId,
        verificationStatus: action.verificationStatus,
        effects: action.effects ? [...action.effects] : undefined,
        scope: action.scope,
        receiptPolicy: action.receiptPolicy,
        domains: [...action.domains],
        aliases: [...action.aliases],
        score,
      }));
  }

  private assertUniqueIds(): void {
    const seen = new Set<string>();
    for (const action of this.actions) {
      const normalized = normalizeSearch(action.id);
      if (seen.has(normalized)) {
        throw new Error(`Duplicate Zavorth action id: ${action.id}`);
      }
      seen.add(normalized);
    }
  }
}

export type ZavorthActionCatalogRuntime = {
  root?: string | null;
  goalLoopLlmRuntime?: GoalLoopLlmRuntime | null;
  goalLoopAgentRunner?: GoalLoopAgentRunner | null;
};

function buildDefaultActions(runtime: ZavorthActionCatalogRuntime = {}): ZavorthActionDefinition[] {
  const status = simpleStatusHandler('Zavorth action is registered.', 'This action is available through the governed Action Harness.');
  const previewActions = new Set([
    'home.migrate.preview',
    'memory.forget',
    'background.run',
    'goals.create',
    'goals.loop.step',
    'goals.loop.worker',
    'providers.xai.search',
    'tasks.board.triage',
    'tasks.board.decompose',
    'channels.progress.publish',
    'integration.connectors.execute',
    'capabilities.verified.expose',
  ]);
  const approvalActions = new Set([
    'memory.forget',
    'background.run',
    'goals.create',
    'goals.loop.worker',
    'providers.xai.search',
    'tasks.board.triage',
    'tasks.board.decompose',
    'channels.progress.publish',
    'integration.connectors.execute',
    'capabilities.verified.expose',
  ]);
  const actionModules = [
    createCapabilitySpineActionModule(),
    createReachFabricActionModule(),
    createPowerFabricActionModule(),
    createProductFabricActionModule(),
    createNativeExtendedToolsActionModule(),
    createNativePowerPacksActionModule(),
    createProductizationPacksActionModule(),
    createWorkspaceFilesActionModule(),
    createWebBrowserActionModule(),
    createGovernedOpsActionModule(),
  ];
  const actions: ZavorthActionDefinition[] = [
    ...actionModules.flatMap((module) => module.actions),
    {
      id: 'skills.governance.set',
      title: 'Set skill governance mode',
      description: 'Switch imported skill governance between casual and governed.',
      aliases: [
        'mude o skill governance para governed',
        'skill governance governed',
        'skills governance',
        'governance mode',
        'modo governed',
        'modo casual',
      ],
      domains: ['skills', 'governance', 'configuration'],
      surface: ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'],
      risk: 'attention',
      mutationDomain: 'capability',
      mutationRisk: 'medium',
      requiresPreview: true,
      requiresApproval: true,
      inputSchema: actionSchema,
      outputSchema,
      handler: skillGovernanceHandler,
    },
    {
      id: 'skills.governance.status',
      title: 'Read skill governance mode',
      description: 'Read current imported skill governance mode.',
      aliases: ['skill governance status', 'status skill governance'],
      domains: ['skills', 'governance', 'configuration'],
      surface: ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'],
      risk: 'safe',
      requiresPreview: false,
      requiresApproval: false,
      inputSchema: { type: 'object', properties: {} },
      outputSchema,
      handler: skillGovernanceHandler,
    },
    ...([
      ['providers.status', 'Provider readiness status', 'Read provider readiness and connection state.', ['providers', 'models', 'configuration'], providerStatusHandler],
      ['providers.xai.doctor', 'xAI provider doctor', 'Read xAI provider readiness, model, native search and credential state.', ['providers', 'xai', 'doctor'], xaiHandler],
      ['providers.xai.search', 'xAI native search', 'Preview or run xAI native search through the provider route.', ['providers', 'xai', 'search'], xaiHandler],
      ['home.status', 'ZAVORTH_HOME status', 'Read active Zavorth home and path isolation state.', ['home', 'paths', 'configuration'], homeStatusHandler],
      ['home.migrate.preview', 'ZAVORTH_HOME migration preview', 'Preview migration into an isolated Zavorth home.', ['home', 'paths', 'migration'], homeMigrationPreviewHandler],
      ['echo.wake.status', 'Echo wake status', 'Read wake-word privacy state.', ['echo', 'voice', 'wake'], echoWakeStatusHandler],
      ['tasks.status', 'Task plane status', 'Read task plane and cron bridge state.', ['tasks', 'cron'], tasksStatusHandler],
      ['tasks.board.status', 'TaskBoard status', 'Read TaskBoard lanes backed by Task Plane.', ['tasks', 'board', 'kanban'], taskBoardHandler],
      ['tasks.board.triage', 'TaskBoard triage', 'Create a board card backed by Task Plane.', ['tasks', 'board', 'kanban'], taskBoardHandler],
      ['tasks.board.decompose', 'TaskBoard decompose', 'Break an objective into planner, worker and verifier cards backed by Task Plane.', ['tasks', 'board', 'kanban'], taskBoardHandler],
      ['background.status', 'Background tasks status', 'Read background agent tasks backed by Task Plane.', ['tasks', 'background'], backgroundTaskHandler],
      ['background.run', 'Background task', 'Create a worker-separated background task backed by Task Plane.', ['tasks', 'background'], backgroundTaskHandler],
      ['goals.status', 'Goal Plane status', 'Read persistent goals and their Task Plane backing.', ['goals', 'goal-plane'], goalsHandler],
      ['goals.create', 'Create persistent goal', 'Create a persistent goal with visible status and Task Plane backing.', ['goals', 'goal-plane'], goalsHandler],
      ['goals.loop.step', 'Goal Loop step', 'Evaluate a persistent goal with an optional LLM judge and queue a safe continuation task.', ['goals', 'goal-loop', 'tasks'], (input) => goalLoopHandler(input, runtime)],
      ['goals.loop.worker', 'Goal Loop worker', 'Claim queued Goal Loop continuations, run AgentRun, then re-judge the goal.', ['goals', 'goal-loop', 'tasks', 'agent-run'], (input) => goalLoopWorkerHandler(input, runtime)],
      ['memory.search', 'Memory recall search', 'Search governed memory recall surfaces.', ['memory', 'mnemos'], memorySearchHandler],
      ['mnemos.session_recall', 'Mnemos session recall', 'Recall previous session context with local indexed browse, discovery and scroll modes.', ['memory', 'mnemos', 'sessions'], sessionRecallHandler],
      ['memory.forget', 'Memory forget', 'Forget a memory item through the governed memory contract.', ['memory', 'mnemos', 'forget'], memoryForgetHandler],
      ['approvals.status', 'Approvals status', 'Read pending approval status.', ['approval', 'policy'], approvalsStatusHandler],
      ['channels.readiness', 'Channel readiness', 'Read governed channel mesh readiness.', ['channels', 'telegram', 'discord', 'slack'], channelsReadinessHandler],
      ['channels.progress.status', 'Channel progress status', 'Read live channel progress projection sessions and receipts.', ['channels', 'progress', 'telegram'], channelProgressHandler],
      ['channels.progress.publish', 'Channel progress publish', 'Preview or publish a governed live progress update to a channel.', ['channels', 'progress', 'telegram'], channelProgressHandler],
      ['integration.connectors.status', 'Integration connector mesh status', 'Read Composio, Nango, n8n, Pipedream, Zapier and Workato connector readiness.', ['integrations', 'connectors', 'composio', 'nango', 'n8n', 'pipedream', 'zapier', 'workato'], integrationConnectorsHandler],
      ['integration.connectors.doctor', 'Integration connector doctor', 'Run a safe doctor for a connector broker without exposing secrets.', ['integrations', 'connectors', 'doctor', 'composio', 'nango', 'n8n', 'pipedream', 'zapier', 'workato'], integrationConnectorsHandler],
      ['integration.connectors.execute', 'Integration connector tool execution', 'Preview or execute an external connector tool or workflow through approval-gated Action Harness.', ['integrations', 'connectors', 'tools', 'workflows', 'composio', 'nango', 'n8n', 'pipedream', 'zapier', 'workato'], integrationConnectorsHandler],
      ['capabilities.atlas', 'Capability Atlas', 'Read the canonical Zavorth ability map: Echo, Mnemos, Nexus, providers, channels, skills, tasks, swarm, sandbox, TUI and extension surfaces.', ['capabilities', 'atlas', 'echo', 'mnemos', 'nexus', 'what-can-zavorth-do'], capabilityAtlasHandler],
      ['daily.product.status', 'Daily Product and Quiet Autonomy', 'Read the daily product surface and profile-based quiet autonomy policy.', [
        'daily',
        'product',
        'quiet-autonomy',
        'autonomy',
        'profiles',
        'produto',
        'diario',
        'produto diario',
        'produto diário',
        'autonomia',
        'silenciosa',
        'autonomia silenciosa',
        'uso diario',
        'uso diário',
        'melhoria silenciosa',
        'auto melhoria silenciosa',
      ], dailyProductHandler],
      ['capabilities.verified.status', 'Verified capability action exposure status', 'Read verified capability candidates exposed through the Action Harness.', ['capabilities', 'innovation', 'adapter', 'verification'], capabilityExposureHandler],
      ['capabilities.verified.expose', 'Expose verified capability actions', 'Expose verified adapter candidates through the Action Harness without enabling live execution.', ['capabilities', 'innovation', 'adapter', 'verification'], capabilityExposureHandler],
      ['sandbox.status', 'Sandbox status', 'Read sandbox backend readiness.', ['sandbox', 'execution'], sandboxStatusHandler],
      ['git.review', 'Governed review', 'Run or preview governed code review.', ['git', 'review'], gitReviewHandler],
      ['setup.status', 'Setup status', 'Read setup/onboarding status and receipts.', ['setup', 'configuration'], setupStatusHandler],
      ['config.status', 'Configuration status', 'Read safe configuration status.', ['config', 'configuration'], configStatusHandler],
      ['state.status', 'Operational StateDB status', 'Read the unified operational SQLite state for sessions, events, receipts, tasks, goals and boards.', ['state', 'sessions', 'tasks', 'goals'], operationalStateStatusHandler],
    ] satisfies Array<[string, string, string, string[], ZavorthActionDefinition['handler']]>).map(([id, title, description, domains, handler]) => ({
      id,
      title,
      description,
      aliases: [id, title],
      domains,
      surface: ['cli', 'zavorthControl', 'tui', 'api', 'channel', 'llm'] as ZavorthActionDefinition['surface'],
      risk: previewActions.has(id) ? 'attention' as const : 'safe' as const,
      requiresPreview: previewActions.has(id),
      requiresApproval: approvalActions.has(id),
      inputSchema: { type: 'object' as const, properties: { query: { type: 'string' } } },
      outputSchema,
      handler: handler || status,
    })),
  ];
  if (runtime.root) {
    actions.push(...loadGeneratedCapabilityActions(runtime.root));
  }
  return actions;
}

function loadGeneratedCapabilityActions(root: string): ZavorthActionDefinition[] {
  try {
    const snapshot = new ZavorthCapabilityActionExposureService({
      projectRoot: root,
      env: process.env,
    }).snapshot();
    return snapshot.exposures
      .filter((exposure) => exposure.status === 'exposed')
      .map((exposure): ZavorthActionDefinition => ({
        id: exposure.actionId,
        title: exposure.manifest.title,
        description: exposure.manifest.description,
        aliases: exposure.manifest.aliases,
        domains: exposure.manifest.domains,
        surface: exposure.manifest.surface,
        risk: 'attention',
        mutationDomain: 'capability',
        mutationRisk: 'medium',
        requiresPreview: true,
        requiresApproval: true,
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        outputSchema,
        handler: generatedCapabilityCandidateHandler(exposure.actionId),
      }));
  } catch (error: unknown) {return [];
  }
}
