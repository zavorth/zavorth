import fs from 'fs';
import path from 'path';
import { buildZavorthCliApprovalDiffSnapshot } from '../approval-diff/ZavorthCliApprovalDiffProjection.js';
import { buildZavorthCliHomeSnapshot } from '../home/ZavorthCliHomeProjection.js';
import { readEnvFile } from '../doctor/checks/ZavorthDoctorCheckUtils.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { TaskPlaneService } from '../../services/TaskPlaneService.js';
import { GoalLoopStatusProjectionService } from '../../services/GoalLoopStatusProjectionService.js';
import { VoiceWakeRuntimeService } from '../../services/VoiceWakeRuntimeService.js';
import { ZavorthHomePathService } from '../../services/ZavorthHomePathService.js';
import { ZavorthAgentKernelSnapshotService } from '../../services/ZavorthAgentKernelSnapshotService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../../services/ZavorthDailyProductQuietAutonomyService.js';
import { ZavorthSandboxControlPlaneService } from '../../services/ZavorthSandboxControlPlaneService.js';
import { ZavorthCapabilityActionSurfaceService } from '../../services/ZavorthCapabilityActionSurfaceService.js';
import type { ZavorthCliRuntimeTuiItem, ZavorthCliRuntimeTuiRow, ZavorthCliRuntimeTuiSnapshot, ZavorthCliRuntimeTuiStatus } from './ZavorthCliRuntimeTuiTypes.js';
import { logger } from '../../logger.js';
type JsonObject = Record<string, unknown>;

export type BuildZavorthCliRuntimeTuiSnapshotInput = {
  projectRoot: string;
  now?: () => Date;
  mode?: 'snapshot' | 'watch' | 'interactive';
  homeRoot?: string | null;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'>;
};

export function buildZavorthCliRuntimeTuiSnapshot(input: BuildZavorthCliRuntimeTuiSnapshotInput): ZavorthCliRuntimeTuiSnapshot {
  const projectRoot = path.resolve(input.projectRoot || process.cwd());
  const now = input.now || (() => new Date());
  const mutationPlane = input.mutationPlane || new ZavorthMutationPlaneService();
  const home = buildZavorthCliHomeSnapshot({ projectRoot, now, mutationPlane });
  const homePaths = new ZavorthHomePathService({
    projectRoot,
    explicitHome: input.homeRoot || null,
    env: process.env,
    now,
  }).resolveSnapshot();
  const approvals = buildZavorthCliApprovalDiffSnapshot({
    projectRoot,
    view: 'approvals',
    now,
    mutationPlane,
  });
  const env = readEnvFile(projectRoot);
  const connection = buildConnection(projectRoot, home);
  const voice = new VoiceWakeRuntimeService({
    stateFile: path.join(homePaths.resolvedPaths.runtimeDir, 'voice-wake-session.json'),
    env: { ...process.env, ...env },
    now,
  }).status();
  const tasks = new TaskPlaneService({
    storePath: path.join(homePaths.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: homePaths.resolvedPaths.dbPath,
    now,
  }).snapshot();
  const goalLoop = new GoalLoopStatusProjectionService({
    taskStorePath: path.join(homePaths.resolvedPaths.runtimeDir, 'task-plane.json'),
    goalStorePath: path.join(homePaths.resolvedPaths.runtimeDir, 'goal-plane.json'),
    stateDbPath: homePaths.resolvedPaths.dbPath,
    now,
  }).buildSnapshot();
  const sandbox = new ZavorthSandboxControlPlaneService({
    now,
    workspaceRoot: projectRoot,
    tempRoot: path.join(homePaths.resolvedPaths.tmpDir, 'sandbox-runs'),
    env: process.env,
  }).buildSnapshot();
  const chat = readMessages(projectRoot);
  const timeline = buildTimeline(projectRoot);
  const tools = buildTools(projectRoot);
  const isTestMock = process.env.NODE_ENV === 'test' && !fs.existsSync(path.join(projectRoot, 'package.json'));
  const capabilityActionSurface = new ZavorthCapabilityActionSurfaceService({
    projectRoot,
    env: {
      ...process.env,
      ...env,
      ...(input.homeRoot ? { ZAVORTH_HOME: input.homeRoot } : {}),
    },
    now,
    ...(isTestMock ? { verifiedActions: [] } : {}),
  }).buildSnapshot();
  const channels = buildChannels(env);
  const sessions = readSessions(projectRoot);
  const logs = readLogItems(projectRoot);
  const agentKernel = new ZavorthAgentKernelSnapshotService({
    now,
    env: { ...process.env, ...env },
  }).buildSnapshotSync({
    projectRoot,
    text: 'Zavorth status',
    channel: 'cli',
    profileId: env.ZAVORTH_PROFILE || env.ZAVORTH_EXPERIENCE_PROFILE || null,
    includeProviderActivation: false,
  });
  const dailyProduct = new ZavorthDailyProductQuietAutonomyService({ now }).buildSnapshot({
    profileId: agentKernel.capabilityPassport.activeProfile.id,
  });
  const status = resolveRuntimeTuiStatus({
    homeStatus: home.status,
    gateway: connection.gateway.status,
    pendingApprovals: approvals.summary.pending,
  });

  return {
    contractVersion: 'zavorth-cli-runtime-tui/1',
    generatedAt: now().toISOString(),
    projectRoot,
    mode: input.mode || 'snapshot',
    status,
    agentKernel: {
      status: agentKernel.status,
      profile: agentKernel.capabilityPassport.activeProfile.id,
      provider: agentKernel.capabilityPassport.providers.activeProvider,
      model: agentKernel.capabilityPassport.providers.activeModel,
      intent: agentKernel.intentDecision?.kind || 'none',
      quietAutonomy: `${agentKernel.quietAutonomy.mode}/${agentKernel.quietAutonomy.interruptMode}`,
      performanceSamples: agentKernel.performanceMemory.sampleCount,
      missing: agentKernel.capabilityPassport.missing.slice(0, 6),
    },
    dailyProduct: {
      status: dailyProduct.status,
      headline: dailyProduct.dailyProduct.headline,
      primarySurface: dailyProduct.dailyProduct.primarySurface,
      visibleTabs: dailyProduct.dailyProduct.visibleTabs.map((tab) => tab.label),
      quietMode: `${dailyProduct.quietAutonomy.activePolicy.mode}/${dailyProduct.quietAutonomy.activePolicy.interruptMode}`,
      silentLanes: dailyProduct.quietAutonomy.activePolicy.silentLanes.map((lane) => lane.lane),
      digestLanes: dailyProduct.quietAutonomy.activePolicy.digestLanes.map((lane) => lane.lane),
      approvalBoundaries: dailyProduct.quietAutonomy.activePolicy.approvalLanes.map((lane) => lane.lane),
    },
    home: {
      root: homePaths.root,
      source: homePaths.source,
      isolated: homePaths.isolated,
      migrationStatus: homePaths.migration.status,
      paths: [
        item('home-data', 'Data', homePaths.isolated ? 'isolated' : 'compat', redact(homePaths.resolvedPaths.dataDir)),
        item('home-runtime', 'Runtime', 'state', redact(homePaths.resolvedPaths.runtimeDir)),
        item('home-receipts', 'Receipts', 'evidence', redact(homePaths.resolvedPaths.receiptsDir)),
      ],
    },
    voice: {
      mode: voice.mode,
      armedUntil: voice.armedUntil,
      detector: voice.detector.kind,
      configured: voice.detector.configured,
      lastReceipt: voice.lastReceipt ? `${voice.lastReceipt.event}: ${voice.lastReceipt.summary}` : null,
    },
    tasks: {
      total: tasks.items.length,
      queued: tasks.summary.queued,
      running: tasks.summary.running,
      waitingApproval: tasks.summary.waiting_approval,
      items: tasks.items.slice(0, 8).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        detail: `${task.source} - attempts ${task.attempts}${task.claim ? ` - claimed by ${task.claim.owner}` : ''}`,
      })),
    },
    goalLoop: {
      status: goalLoop.daemon.status,
      current: goalLoop.goals.current?.objective || 'No standing goal',
      detail: goalLoop.latest.receipt?.summary || goalLoop.latest.event?.type || goalLoop.lines[0] || 'Goal Loop is idle.',
      nextRunAfter: goalLoop.daemon.nextRunAfter,
      queued: goalLoop.continuations.queued,
      running: goalLoop.continuations.running,
      lines: goalLoop.lines,
    },
    sandbox: {
      posture: sandbox.summary.posture,
      strongProfilesReady: sandbox.summary.strongProfilesReady,
      preferredProfile: sandbox.summary.preferredProfile,
      items: sandbox.profiles.slice(0, 5).map((profile) => ({
        id: profile.id,
        title: profile.label,
        status: profile.canRun ? 'ready' : 'preview-only',
        detail: profile.detail,
      })),
    },
    connection,
    chat,
    timeline,
    tools,
    capabilityActions: {
      status: capabilityActionSurface.status,
      exposed: capabilityActionSurface.summary.exposed,
      receipts: capabilityActionSurface.summary.receipts,
      items: capabilityActionSurface.items.slice(0, 6).map((entry) => ({
        id: entry.actionId,
        title: entry.title,
        status: entry.status,
        detail: entry.previewCommand,
      })),
      nextAction: capabilityActionSurface.commands.nextStage,
    },
    approvals: {
      pending: approvals.summary.pending,
      selectedPlanId: approvals.cards.find((card) => card.approvalStatus === 'pending')?.id || null,
      items: approvals.cards.slice(0, 8).map((card) => ({
        id: card.id,
        title: card.title,
        status: `${card.status}/${card.approvalStatus}`,
        detail: `${card.riskLevel} risk - diffs ${card.diffCount} - ${card.approvalReason}`,
      })),
    },
    diffs: approvals.diffs.slice(0, 8).map((diff) => ({
      id: diff.id,
      title: diff.path,
      status: diff.riskLevel,
      detail: diff.summary,
    })),
    logs,
    channels,
    sessions,
    shortcuts: [
      { key: 'p', label: 'Prompt', command: 'zavorth chat', detail: 'open the terminal agent session' },
      { key: '/', label: 'Commands', command: 'slash commands', detail: 'discover governed commands' },
      { key: 'Tab', label: 'Section', command: 'next section', detail: 'move through Chat, Approvals, Diffs, Tasks, Memory, Providers, Channels, Voice, Sandbox and Logs' },
      { key: 'a', label: 'Approvals', command: 'zavorth approve', detail: 'review governed actions' },
      { key: 'd', label: 'Diff', command: 'zavorth diff', detail: 'open mutation previews' },
      { key: 't', label: 'Tasks', command: 'zavorth tasks list', detail: 'show persistent task plane' },
      { key: 'v', label: 'Voice', command: 'zavorth echo wake status', detail: 'show wake word privacy state' },
      { key: 'c', label: 'Channels', command: 'zavorth channels status', detail: 'channel readiness' },
      { key: 'k', label: 'Capabilities', command: 'npm run zavorth:capability-action-surface --silent -- --list', detail: 'verified capabilities available through Action Harness' },
      { key: 'g', label: 'Swarm', command: 'zavorth swarm cloud-pool', detail: 'check dynamic cloud worker pool readiness' },
      { key: 'o', label: 'Open', command: 'zavorth open', detail: 'ZavorthControl' },
      { key: 'r', label: 'Refresh', command: 'zavorth tui', detail: 'reload this daily TUI' },
      { key: 'q', label: 'Quit', command: 'quit', detail: 'leave runtime TUI' },
    ],
    safety: {
      readOnlySnapshot: true,
      noHostApply: true,
      secretsRedacted: true,
      approvalRequiresExplicitCommand: true,
    },
  };
}

function buildConnection(projectRoot: string, home: ReturnType<typeof buildZavorthCliHomeSnapshot>): ZavorthCliRuntimeTuiSnapshot['connection'] {
  const gateway = readJson(path.join(stateDir(projectRoot), 'gateway.json'), {}) as JsonObject;
  const daemon = readJson(path.join(stateDir(projectRoot), 'daemon.json'), {}) as JsonObject;
  return {
    gateway: row('gateway', 'Gateway', String(gateway.status || (home.runtime.gatewayToken === 'present' ? 'token-ready' : 'not-started')), gateway.status === 'running' || home.runtime.gatewayToken === 'present' ? 'ready' : 'warning', gateway.pid ? `pid ${String(gateway.pid)}` : 'local gateway state'),
    daemon: row('daemon', 'Daemon', String(daemon.status || 'not-installed'), daemon.status === 'running' ? 'ready' : daemon.installed ? 'warning' : 'warning', daemon.pid ? `pid ${String(daemon.pid)}` : 'service supervisor'),
    zavorthControl: row('zavorthControl', 'ZavorthControl', home.runtime.zavorthControl, home.runtime.zavorthControl === 'available' ? 'ready' : 'blocked', 'visual ZavorthControl'),
  };
}

function readMessages(projectRoot: string): ZavorthCliRuntimeTuiSnapshot['chat'] {
  const messages = readArray(path.join(stateDir(projectRoot), 'messages.json'));
  return {
    total: messages.length,
    recent: messages.slice(-6).reverse().map((message) => {
      const item = message as JsonObject;
      return {
        id: String(item.id || 'message'),
        title: `${String(item.channel || 'channel')} -> ${redact(String(item.target || 'target'))}`,
        status: String(item.status || 'draft'),
        detail: item.message ? redact(String(item.message)) : 'message body redacted or empty',
      };
    }),
  };
}

function buildTimeline(projectRoot: string): ZavorthCliRuntimeTuiItem[] {
  const logDir = path.join(stateDir(projectRoot), 'logs');
  const logs = listJsonFiles(logDir).flatMap((file) => {
    const entries = readArray(path.join(logDir, file));
    return entries.map((entry) => ({ file, entry: entry as JsonObject }));
  });
  return logs.slice(-10).reverse().map(({ file, entry }) => ({
    id: String(entry.id || `${file}:${entry.createdAt || ''}`),
    title: String(entry.event || entry.action || file.replace(/\.json$/u, '')),
    status: String(entry.status || 'recorded'),
    detail: `${String(entry.createdAt || '')} ${redact(String(entry.message || entry.serverId || entry.taskId || ''))}`.trim(),
  }));
}

function buildTools(projectRoot: string): ZavorthCliRuntimeTuiSnapshot['tools'] {
  const mcp = readJson(path.join(stateDir(projectRoot), 'mcp-runtime.json'), { servers: [] }) as JsonObject;
  const mcpServers = Array.isArray(mcp.servers) ? mcp.servers as JsonObject[] : [];
  const skills = readJson(path.join(stateDir(projectRoot), 'skills-runtime.json'), { enabled: [] }) as JsonObject;
  const plugins = readJson(path.join(stateDir(projectRoot), 'plugins-runtime.json'), { plugins: [] }) as JsonObject;
  const enabledSkills = Array.isArray(skills.enabled) ? skills.enabled as JsonObject[] : [];
  const runtimePlugins = Array.isArray(plugins.plugins) ? plugins.plugins as JsonObject[] : [];
  const items: ZavorthCliRuntimeTuiItem[] = [
    ...mcpServers.slice(0, 4).map((server) => ({
      id: String(server.id || 'mcp'),
      title: `MCP ${String(server.id || 'server')}`,
      status: String(server.status || 'configured'),
      detail: `tools ${String(server.toolsCount || 0)} resources ${String(server.resourcesCount || 0)}`,
    })),
    ...enabledSkills.slice(0, 4).map((skill) => ({
      id: String(skill.id || 'skill'),
      title: `Skill ${String(skill.name || skill.id || '')}`,
      status: 'enabled',
      detail: 'runtime skill enabled',
    })),
    ...runtimePlugins.slice(0, 4).map((plugin) => ({
      id: String(plugin.id || 'plugin'),
      title: `Plugin ${String(plugin.name || plugin.id || '')}`,
      status: String(plugin.status || 'enabled'),
      detail: 'runtime plugin',
    })),
  ];
  return {
    mcpServers: mcpServers.length,
    mcpTools: mcpServers.reduce((sum, server) => sum + Number(server.toolsCount || 0), 0),
    skills: enabledSkills.length,
    plugins: runtimePlugins.length,
    items,
  };
}

function buildChannels(env: Record<string, string>): ZavorthCliRuntimeTuiItem[] {
  const channels = [
    ['telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS']],
    ['discord', ['DISCORD_WEBHOOK_URL', 'DISCORD_BOT_TOKEN']],
    ['slack', ['SLACK_WEBHOOK_URL', 'SLACK_BOT_TOKEN']],
    ['email', ['SMTP_HOST', 'EMAIL_OUTBOX_DIR']],
    ['signal', ['SIGNAL_JSONRPC_URL', 'SIGNAL_CLI_PATH']],
    ['whatsapp', ['WHATSAPP_BRIDGE_URL', 'WHATSAPP_OUTBOX_DIR']],
    ['matrix', ['MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN']],
  ] as const;
  return channels.map(([id, keys]) => {
    const ready = keys.some((key) => Boolean(env[key] || process.env[key]));
    return { id, title: id, status: ready ? 'ready' : 'not-configured', detail: ready ? 'credential or bridge detected' : `set ${keys[0]}` };
  });
}

function readSessions(projectRoot: string): ZavorthCliRuntimeTuiItem[] {
  return readArray(path.join(stateDir(projectRoot), 'sessions.json')).slice(-8).reverse().map((session) => {
    const item = session as JsonObject;
    return {
      id: String(item.id || 'session'),
      title: String(item.label || item.id || 'session'),
      status: String(item.status || 'ready'),
      detail: String(item.updatedAt || item.createdAt || 'local session'),
    };
  });
}

function readLogItems(projectRoot: string): ZavorthCliRuntimeTuiItem[] {
  const logDir = path.join(stateDir(projectRoot), 'logs');
  return listJsonFiles(logDir).slice(0, 12).map((file) => {
    const entries = readArray(path.join(logDir, file));
    const last = entries.at(-1) as JsonObject | undefined;
    return {
      id: file,
      title: file,
      status: entries.length ? 'active' : 'empty',
      detail: last ? `${entries.length} entries - latest ${String(last.createdAt || last.event || '')}` : 'no entries',
    };
  });
}

function resolveRuntimeTuiStatus(input: { homeStatus: string; gateway: ZavorthCliRuntimeTuiStatus; pendingApprovals: number }): ZavorthCliRuntimeTuiStatus {
  if (input.homeStatus === 'blocked') return 'blocked';
  if (input.pendingApprovals > 0 || input.gateway !== 'ready') return 'warning';
  return 'ready';
}

function row(id: string, label: string, value: string, status: ZavorthCliRuntimeTuiStatus, detail?: string): ZavorthCliRuntimeTuiRow {
  return { id, label, value, status, detail };
}

function item(id: string, title: string, status: string, detail: string): ZavorthCliRuntimeTuiItem {
  return { id, title, status, detail };
}

function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

function readJson(file: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch (error: unknown) {logger.warn('[Zavorth Cli Runtime Tui Projection] JSON parse failed', error); return fallback; }
}

function readArray(file: string): unknown[] {
  const value = readJson(file, []);
  return Array.isArray(value) ? value : [];
}

function listJsonFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Runtime Tui Projection] JSON parse failed', error); return []; }
}

function redact(value: string): string {
  if (!value) return '';
  if (/token|secret|password|api[_-]?key/iu.test(value)) return '***';
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}
