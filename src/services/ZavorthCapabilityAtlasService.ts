import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_CAPABILITY_ATLAS_CONTRACT_VERSION,
  type ZavorthCapabilityAtlasCategory,
  type ZavorthCapabilityAtlasEntry,
  type ZavorthCapabilityAtlasSnapshot,
  type ZavorthCapabilityAtlasStatus,
  type ZavorthCapabilityAtlasSurface,
} from '../contracts/ZavorthCapabilityAtlasContract.js';

type AtlasDefinition = Omit<ZavorthCapabilityAtlasEntry, 'status' | 'statusReason' | 'missing'>;

export type ZavorthCapabilityAtlasRuntime = {
  projectRoot?: string | null;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
};

export type ZavorthCapabilityAtlasInput = {
  query?: string | null;
  category?: ZavorthCapabilityAtlasCategory | null;
  limit?: number | null;
};

const CATEGORY_ORDER: ZavorthCapabilityAtlasCategory[] = [
  'agent-core',
  'memory',
  'voice',
  'channels',
  'providers',
  'skills',
  'automation',
  'execution',
  'interfaces',
  'extensions',
  'governance',
];

export class ZavorthCapabilityAtlasService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;

  public constructor(runtime: ZavorthCapabilityAtlasRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync;
  }

  public buildSnapshot(input: ZavorthCapabilityAtlasInput = {}): ZavorthCapabilityAtlasSnapshot {
    const entries = this.filterEntries(this.buildEntries(), input);
    const ready = entries.filter((entry) => entry.status === 'ready').length;
    const partial = entries.filter((entry) => entry.status === 'partial').length;
    const missing = entries.filter((entry) => entry.status === 'missing').length;
    const status: ZavorthCapabilityAtlasStatus = missing > 0
      ? 'partial'
      : partial > 0
        ? 'partial'
        : 'ready';
    const categories = Object.fromEntries(CATEGORY_ORDER.map((category) => [
      category,
      entries.filter((entry) => entry.category === category).length,
    ])) as Record<ZavorthCapabilityAtlasCategory, number>;
    return {
      contractVersion: ZAVORTH_CAPABILITY_ATLAS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'capability-atlas',
      projectRoot: this.projectRoot,
      status,
      summary: {
        total: entries.length,
        ready,
        partial,
        missing,
        llmVisible: entries.filter((entry) => entry.surfaces.llm).length,
        actionHarnessBacked: entries.filter((entry) => entry.surfaces.actionHarness).length,
        cliVisible: entries.filter((entry) => entry.surfaces.cli).length,
        dashboardVisible: entries.filter((entry) => entry.surfaces.dashboard).length,
        tuiVisible: entries.filter((entry) => entry.surfaces.tui).length,
      },
      categories,
      entries,
      llmContextBlock: this.buildLlmContextBlock(entries),
      commands: {
        status: 'zavorth atlas',
        json: 'npm run zavorth:capability-atlas:json --silent',
        lookup: 'zavorth atlas --query "<capability>"',
        actionLookup: 'zavorth actions lookup capability atlas',
      },
      safety: {
        readOnlyInventory: true,
        noSecretsSerialized: true,
        missingMeansNotDiscoverableNotAbsent: true,
        actionHarnessRemainsSourceForMutation: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Capability Atlas',
      '',
      `status=${snapshot.status}`,
      `capabilities=${snapshot.summary.total} ready=${snapshot.summary.ready} partial=${snapshot.summary.partial} missing=${snapshot.summary.missing}`,
      `visible: llm=${snapshot.summary.llmVisible} actions=${snapshot.summary.actionHarnessBacked} cli=${snapshot.summary.cliVisible} dashboard=${snapshot.summary.dashboardVisible} tui=${snapshot.summary.tuiVisible}`,
      '',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`${entry.status.toUpperCase()} ${entry.id} - ${entry.title}`);
      lines.push(`  ${entry.description}`);
      lines.push(`  use: ${entry.dailyUse}`);
      if (entry.commands.length) lines.push(`  command: ${entry.commands[0]}`);
      if (entry.actionIds.length) lines.push(`  action: ${entry.actionIds.join(', ')}`);
      if (entry.missing.length) lines.push(`  missing: ${entry.missing.join(', ')}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  public buildLlmContextBlock(entries = this.buildEntries()): string {
    const visible = entries
      .filter((entry) => entry.status !== 'missing')
      .slice(0, 18);
    return [
      'Capability Atlas (canonical Zavorth ability map; read-only inventory):',
      ...visible.map((entry) =>
        `- ${entry.shortName}: ${entry.dailyUse} [${entry.status}; surfaces=${surfaceList(entry.surfaces).join('/') || 'internal'}; actions=${entry.actionIds.join(',') || 'none'}].`,
      ),
      '- Discovery rule: when a user asks what Zavorth can do, use the Capability Atlas before guessing from filenames.',
      '- Execution rule: Atlas explains abilities; mutations still go through Action Harness preview/apply/receipts.',
    ].join('\n');
  }

  private buildEntries(): ZavorthCapabilityAtlasEntry[] {
    return definitions().map((definition) => this.materialize(definition));
  }

  private materialize(definition: AtlasDefinition): ZavorthCapabilityAtlasEntry {
    const missing = [
      ...definition.keyFiles.filter((file) => !this.existsSyncImpl(path.join(this.projectRoot, file))),
      ...definition.docs.filter((file) => !this.existsSyncImpl(path.join(this.projectRoot, file))),
    ];
    const requiredFilesMissing = definition.keyFiles.filter((file) => !this.existsSyncImpl(path.join(this.projectRoot, file)));
    const status: ZavorthCapabilityAtlasStatus = requiredFilesMissing.length === 0
      ? missing.length === 0
        ? 'ready'
        : 'partial'
      : requiredFilesMissing.length < definition.keyFiles.length
        ? 'partial'
        : 'missing';
    return {
      ...definition,
      status,
      statusReason: status === 'ready'
        ? 'Core files and public discovery surfaces are present.'
        : status === 'partial'
          ? 'Core implementation exists, but at least one discovery surface or supporting file is missing.'
          : 'Atlas could not find the core implementation files in this workspace.',
      missing,
    };
  }

  private filterEntries(
    entries: ZavorthCapabilityAtlasEntry[],
    input: ZavorthCapabilityAtlasInput,
  ): ZavorthCapabilityAtlasEntry[] {
    const query = normalize(input.query);
    const limit = positive(input.limit) || 200;
    return entries
      .filter((entry) => !input.category || entry.category === input.category)
      .filter((entry) => !query || queryMatches(searchable(entry), query))
      .sort((left, right) =>
        CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category)
        || left.title.localeCompare(right.title),
      )
      .slice(0, limit);
  }
}

function definitions(): AtlasDefinition[] {
  return [
    entry('action-harness', 'Action Harness', 'Actions', 'agent-core',
      'Central gateway for natural requests, lookup, preview, apply and receipts.',
      'Turn natural configuration/runtime requests into governed first-class actions.',
      ['actions', 'zavorth_action', 'action gateway', 'natural action harness'],
      ['action.schema.lookup', 'action.preview', 'action.apply', 'action.receipts'],
      ['zavorth actions lookup "<request>"'],
      ['src/runtime/actions/ZavorthActionGateway.ts', 'src/runtime/actions/ZavorthActionCatalog.ts'],
      ['docs/operations.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('agent-kernel', 'Agent Kernel Snapshot', 'Kernel', 'agent-core',
      'Canonical runtime snapshot for profile, provider, channels, intent, autonomy and performance memory.',
      'Tell the LLM what this installation can do before it routes a request.',
      ['kernel', 'passport', 'capability passport', 'runtime snapshot'],
      ['config.status'],
      ['npm run zavorth:agent-kernel:json --silent'],
      ['src/services/ZavorthAgentKernelSnapshotService.ts', 'src/contracts/ZavorthAgentKernelSnapshotContract.ts'],
      ['docs/runtime-readiness.md'],
      surfaces({ llm: true, cli: true, dashboard: true, tui: true, docs: true }),
      'safe-read'),
    entry('capability-atlas', 'Capability Atlas', 'Atlas', 'agent-core',
      'Canonical inventory of Zavorth abilities, aliases, surfaces, actions and discovery status.',
      'Answer what Zavorth can do without relying on scattered repo search.',
      ['atlas', 'capability atlas', 'ability map', 'what can zavorth do'],
      ['capabilities.atlas'],
      ['zavorth atlas', 'npm run zavorth:capability-atlas:json --silent'],
      ['src/services/ZavorthCapabilityAtlasService.ts', 'src/contracts/ZavorthCapabilityAtlasContract.ts'],
      ['docs/capability-atlas.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'safe-read'),
    entry('mnemos', 'Mnemos Memory', 'Mnemos', 'memory',
      'Local memory, recall, FTS, lifecycle hooks, forget/correct/promote and procedural candidates.',
      'Recall prior context, search memory and manage facts through reversible contracts.',
      ['mnemos', 'memory', 'recall', 'forget', 'procedural memory'],
      ['memory.search', 'mnemos.session_recall', 'memory.forget'],
      ['zavorth mnemos query "<text>"', 'npm run mnemos:query:json --silent'],
      ['src/services/ZavorthMnemosQueryService.ts', 'src/services/ZavorthMnemosFtsIndexService.ts', 'src/services/ZavorthMnemosLifecycleHookService.ts'],
      ['docs/mnemos-memory-os.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('echo', 'Echo Voice', 'Echo', 'voice',
      'Voice, wake privacy session state and local-first capture controls.',
      'Arm or inspect voice/wake state without keeping raw audio by default.',
      ['echo', 'voice', 'wake word', 'microphone', 'speech'],
      ['echo.wake.status'],
      ['zavorth echo wake status'],
      ['src/services/ZavorthEchoService.ts', 'src/services/EchoVoiceService.ts', 'src/services/VoiceWakeRuntimeService.ts'],
      ['docs/experience-core.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'external-gated'),
    entry('nexus', 'Nexus', 'Nexus', 'agent-core',
      'Facade for connected runtime areas and graph-like operator navigation.',
      'Find connected runtime areas when work spans memory, tools, channels and nodes.',
      ['nexus', 'graph', 'mesh', 'runtime nexus'],
      [],
      ['zavorth nexus'],
      ['src/services/NexusFacadeService.ts'],
      ['docs/overview.md'],
      surfaces({ llm: true, cli: true, dashboard: true, tui: false, docs: true }),
      'safe-read'),
    entry('provider-mesh', 'Provider Mesh', 'Providers', 'providers',
      'Provider catalog, activation, model capabilities, live canaries and route readiness.',
      'Select, doctor and use configured model routes across text, tool, image, audio and compatible gateways.',
      ['providers', 'models', 'llm routes', 'model catalog'],
      ['providers.status', 'providers.xai.doctor', 'providers.xai.search'],
      ['zavorth providers doctor', 'npm run zavorth:provider-activation:json --silent'],
      ['src/services/ZavorthProviderActivationService.ts', 'src/services/ZavorthProviderReadinessMatrixService.ts', 'src/services/providers/catalog/zavorthProviderCapabilityInventory.ts'],
      ['docs/provider-mesh.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'external-gated'),
    entry('provider-capability-matrix', 'Provider Capability Matrix', 'Provider Matrix', 'providers',
      'Canonical map of provider ids, modalities, route level, credential state, doctor commands and live canaries.',
      'Understand every Zavorth provider route without guessing from one folder or confusing catalog entries with live proof.',
      ['provider matrix', 'provider capability matrix', 'image providers', 'video providers', 'audio providers', 'llm providers'],
      ['providers.status'],
      ['npm run zavorth:provider-capability-matrix:json --silent', 'zavorth providers matrix --query "<provider>"'],
      ['src/services/ZavorthProviderCapabilityMatrixService.ts', 'src/contracts/ZavorthProviderCapabilityMatrixContract.ts'],
      ['docs/capabilities.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'safe-read'),
    entry('channel-mesh', 'Channel Mesh', 'Channels', 'channels',
      'Governed inbound/outbound channels with normalized intents, policies, progress and receipts.',
      'Receive requests from channels and send approved replies without bypassing policy.',
      ['channels', 'telegram', 'discord', 'slack', 'whatsapp', 'email', 'channel mesh'],
      ['channels.readiness', 'channels.progress.status', 'channels.progress.publish'],
      ['zavorth channels doctor', 'npm run zavorth:channel-live-canary:json --silent'],
      ['src/services/ZavorthChannelMeshService.ts', 'src/services/GatewayRuntimeChannelAdapters.ts', 'src/services/ChannelProgressSurfaceService.ts'],
      ['docs/channel-mesh.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'external-gated'),
    entry('channel-capability-atlas', 'Channel Capability Atlas', 'Channel Atlas', 'channels',
      'Canonical map of core channels and long-tail native configurable channels.',
      'See which channels are native, which need token/webhook/bridge, and which explicit command proves readiness.',
      ['channel atlas', 'channel capability atlas', 'long-tail channels', 'remote channels', 'telegram feishu weixin'],
      ['channels.readiness'],
      ['npm run zavorth:channel-capability-atlas:json --silent', 'zavorth channels atlas --query "<channel>"'],
      ['src/services/ZavorthChannelCapabilityAtlasService.ts', 'src/contracts/ZavorthChannelCapabilityAtlasContract.ts'],
      ['docs/capabilities.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'safe-read'),
    entry('skill-curator', 'Skill Curator Plane', 'Curator', 'skills',
      'Skill lifecycle, telemetry, archive/restore, pin, rollback and optional review loop.',
      'Let Zavorth organize and improve local skills with quiet reversible maintenance.',
      ['skills', 'curator', 'skill curation', 'skill lifecycle'],
      ['skills.governance.status', 'skills.governance.set'],
      ['zavorth skills status', 'npm run zavorth:skills-curator-plane:check --silent'],
      ['src/skills/SkillCuratorPlaneService.ts', 'src/skills/SkillLoader.ts', 'src/skills/UniversalSkillIntakeService.ts'],
      ['docs/capabilities-and-plugins.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('task-goal-plane', 'Task And Goal Plane', 'Tasks/Goals', 'automation',
      'Persistent tasks, background work, task board, goal loop, daemon and worker continuation.',
      'Queue work, run background continuations and keep long objectives visible.',
      ['tasks', 'background', 'goals', 'goal loop', 'daemon'],
      ['tasks.status', 'background.run', 'goals.status', 'goals.loop.step', 'goals.loop.worker'],
      ['zavorth tasks list', 'zavorth goals status'],
      ['src/services/TaskPlaneService.ts', 'src/services/GoalLoopService.ts', 'src/services/GoalLoopDaemonService.ts', 'src/services/GoalLoopWorkerService.ts'],
      ['docs/operations.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('swarm-scale-plane', 'Swarm Scale Plane', 'Swarm', 'automation',
      'Dynamic workload assessment, massive subagent planning, ledger and reducer boundaries.',
      'Escalate large tasks into many scoped workers when complexity/cost/risk justify it.',
      ['swarm', 'subagents', 'scale plane', 'massive work'],
      [],
      ['zavorth swarm plan', 'npm run zavorth:swarm-scale-plane:json --silent'],
      ['src/domain/execution/infrastructure/SwarmScalePlaneService.ts', 'src/services/SwarmScalePlaneRuntimeService.ts', 'src/runtime/agent/SwarmWorkloadAssessmentService.ts'],
      ['docs/operations.md'],
      surfaces({ llm: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('sandbox-control-plane', 'Sandbox Control Plane', 'Sandbox', 'execution',
      'Local/process/Docker/WSL/remote sandbox readiness, limits, policies and receipts.',
      'Preview or run risky commands through the strongest available execution boundary.',
      ['sandbox', 'execution', 'docker', 'wsl', 'safe run'],
      ['sandbox.status'],
      ['zavorth sandbox doctor'],
      ['src/services/ZavorthSandboxControlPlaneService.ts', 'src/services/SandboxExecutionReceiptService.ts', 'src/services/ZavorthSandboxActionService.ts'],
      ['docs/execution.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'sandboxed'),
    entry('runtime-tui', 'Runtime TUI', 'TUI', 'interfaces',
      'Daily terminal surface for chat, approvals, tasks, memory, providers, channels, voice, sandbox and logs.',
      'Use Zavorth from the terminal with a compact operational dashboard.',
      ['tui', 'terminal ui', 'hud', 'daily terminal'],
      [],
      ['zavorth tui --json --once'],
      ['src/cli/hud/ZavorthCliRuntimeTuiProjection.ts', 'src/cli/hud/ZavorthCliRuntimeTuiRenderer.ts'],
      ['docs/zavorth-cli.md'],
      surfaces({ llm: true, cli: true, dashboard: false, tui: true, docs: true }),
      'safe-read'),
    entry('integration-connectors', 'Integration Connector Mesh', 'Connectors', 'extensions',
      'Composio, Nango, n8n, Pipedream, Zapier and Workato readiness, doctor and governed execution.',
      'Connect external tool brokers and run their workflows only through preview, policy and receipts.',
      ['composio', 'nango', 'n8n', 'zapier', 'pipedream', 'workato', 'connectors'],
      ['integration.connectors.status', 'integration.connectors.doctor', 'integration.connectors.execute'],
      ['npm run zavorth:integration-connectors:json --silent'],
      ['src/services/IntegrationConnectorMeshService.ts', 'src/contracts/IntegrationConnectorMeshContract.ts'],
      ['docs/capability-plugins.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'external-gated'),
    entry('satellite-companion', 'Satellite Companion', 'Satellite', 'interfaces',
      'Local/PWA companion for approvals, readiness, pairing and mobile-style operator decisions.',
      'Review approval cards and readiness away from the main dashboard without direct execution.',
      ['satellite', 'companion', 'approval companion', 'pwa'],
      [],
      ['zavorth satellite status', 'npm run zavorth:satellite-approval-companion:json --silent'],
      ['src/services/ZavorthSatelliteApprovalCompanionService.ts', 'src/services/SatellitePwaRouteService.ts'],
      ['docs/node-mesh-live-native.md'],
      surfaces({ llm: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
    entry('operational-state-db', 'Operational StateDB', 'StateDB', 'governance',
      'Unified local state for sessions, turns, events, receipts, tasks, goals and searchable continuity.',
      'Persist operational memory and audit trails behind long-running agent work.',
      ['state db', 'operational state', 'sqlite', 'receipts'],
      ['state.status'],
      ['zavorth state status'],
      ['src/services/ZavorthOperationalStateDbService.ts'],
      ['docs/operations.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: false, tui: true, docs: true }),
      'safe-read'),
    entry('transaction-approval-plane', 'Transaction And Approval Plane', 'Approvals', 'governance',
      'Preview, approval, receipt and rollback boundaries for risky changes and external effects.',
      'Keep dangerous work visible and reversible instead of asking for every harmless background step.',
      ['approvals', 'receipts', 'transaction plane', 'mutation gate'],
      ['approvals.status'],
      ['zavorth approvals status'],
      ['src/services/ZavorthMutationPlaneService.ts', 'src/services/ZavorthPersistentApprovalPolicyService.ts', 'src/contracts/ZavorthTransactionApprovalContract.ts'],
      ['docs/effect-boundary.md'],
      surfaces({ llm: true, actionHarness: true, cli: true, dashboard: true, tui: true, docs: true }),
      'approval-gated'),
  ];
}

function entry(
  id: string,
  title: string,
  shortName: string,
  category: ZavorthCapabilityAtlasCategory,
  description: string,
  dailyUse: string,
  aliases: string[],
  actionIds: string[],
  commands: string[],
  keyFiles: string[],
  docs: string[],
  surfacesValue: ZavorthCapabilityAtlasSurface,
  riskPosture: AtlasDefinition['riskPosture'],
): AtlasDefinition {
  return {
    id,
    title,
    shortName,
    category,
    description,
    dailyUse,
    aliases,
    actionIds,
    commands,
    keyFiles,
    docs,
    surfaces: surfacesValue,
    riskPosture,
  };
}

function surfaces(input: Partial<ZavorthCapabilityAtlasSurface>): ZavorthCapabilityAtlasSurface {
  return {
    llm: false,
    actionHarness: false,
    cli: false,
    dashboard: false,
    tui: false,
    docs: false,
    ...input,
  };
}

function surfaceList(surfacesValue: ZavorthCapabilityAtlasSurface): string[] {
  return Object.entries(surfacesValue)
    .filter(([, visible]) => visible)
    .map(([surface]) => surface);
}

function searchable(entry: ZavorthCapabilityAtlasEntry): string {
  return normalize([
    entry.id,
    entry.title,
    entry.shortName,
    entry.category,
    entry.description,
    entry.dailyUse,
    ...entry.aliases,
    ...entry.actionIds,
    ...entry.commands,
  ].join(' '));
}

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function queryMatches(haystack: string, query: string): boolean {
  if (haystack.includes(query)) return true;
  const tokens = query.split(/\s+/u).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}
