import fs from 'fs';
import type { Dirent } from 'fs';
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
import { ZavorthSessionRecallService } from '../../services/ZavorthSessionRecallService.js';
import { ZavorthXaiRuntimeService } from '../../services/ZavorthXaiRuntimeService.js';
import { ZavorthCapabilityActionExposureService } from '../../services/ZavorthCapabilityActionExposureService.js';
import { ZavorthCapabilityAtlasService } from '../../services/ZavorthCapabilityAtlasService.js';
import { ZavorthDailyProductQuietAutonomyService } from '../../services/ZavorthDailyProductQuietAutonomyService.js';
import { WorkspaceFsPolicy } from '../../tools/workspace/WorkspaceFsPolicy.js';
import {
  type ZavorthActionDefinition,
  type ZavorthActionHandlerInput,
  type ZavorthActionLookupResult,
  type ZavorthActionResult,
} from './ZavorthActionContracts.js';
import { createWebBrowserActionModule } from './modules/index.js';

const SKILL_GOVERNANCE_ENV_KEY = 'ZAVORTH_SKILLS_GOVERNANCE_MODE';

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeSearch(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMode(value: unknown): 'casual' | 'governed' | null {
  const text = normalizeSearch(value);
  if (/\b(governed|governado|estrito|strict|enterprise|corporativo)\b/u.test(text)) {
    return 'governed';
  }
  if (/\b(casual|rapido|pessoal|personal|domestico|daily|fast)\b/u.test(text)) {
    return 'casual';
  }
  return null;
}

function normalizePositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizePathForOutput(value: string): string {
  return value.replace(/\\/g, '/');
}

function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

function envFile(root: string): string {
  return path.join(root, '.env');
}

function readEnvMode(root: string): 'casual' | 'governed' {
  const fromProcess = normalizeMode(process.env[SKILL_GOVERNANCE_ENV_KEY]);
  if (fromProcess) return fromProcess;
  try {
    const raw = fs.readFileSync(envFile(root), 'utf8');
    const match = raw.match(new RegExp(`^${SKILL_GOVERNANCE_ENV_KEY}\\s*=\\s*(.+)$`, 'mu'));
    return normalizeMode(match?.[1]) || 'casual';
  } catch {
    return 'casual';
  }
}

function quoteEnv(value: string): string {
  return /^[A-Za-z0-9_.:/\\-]+$/u.test(value) ? value : JSON.stringify(value);
}

function mergeSingleEnvValue(current: string, key: string, value: string): string {
  const lines = current.split(/\r?\n/u);
  let replaced = false;
  const next = lines.map((line) => {
    if (new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'u').test(line)) {
      replaced = true;
      return `${key}=${quoteEnv(value)}`;
    }
    return line;
  });
  if (!replaced) next.push(`${key}=${quoteEnv(value)}`);
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return `${next.join('\n')}\n`;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  return value;
}

async function appendJsonArray(file: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  items.push(value);
  await fsp.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function idWithTime(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}`;
}

function result(input: {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionResult['operation'];
  status: ZavorthActionResult['status'];
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
}): ZavorthActionResult {
  return input;
}

async function skillGovernanceHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const current = readEnvMode(input.root);
  const requested = normalizeMode(input.args.mode || input.args.value || input.args.query);
  const targetFile = envFile(input.root);

  if (input.operation === 'action.status') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Skill governance is ${current}.`,
      lines: [
        `Current mode: ${current}`,
        'casual: fast personal-use imports; hard security/license blockers remain active.',
        'governed: stricter review for enterprise, compliance and sensitive workspaces.',
      ],
      data: { mode: current, envKey: SKILL_GOVERNANCE_ENV_KEY, envFile: targetFile },
    });
  }

  if (!requested) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Missing governance mode.',
      lines: ['Choose mode: casual or governed.'],
      data: { acceptedModes: ['casual', 'governed'] },
    });
  }

  const previewData = {
    currentMode: current,
    requestedMode: requested,
    envKey: SKILL_GOVERNANCE_ENV_KEY,
    envFile: targetFile,
    willWrite: `${SKILL_GOVERNANCE_ENV_KEY}=${requested}`,
    secretsSerialized: false,
  };

  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview skill governance change: ${current} -> ${requested}.`,
      lines: [
        `Requested mode: ${requested}`,
        requested === 'governed'
          ? 'Governed will require stricter risk/license review and clearer audit evidence for skill imports.'
          : 'Casual keeps imports smooth for daily use, while hard blockers still stop unsafe skills.',
        'Preview only. No file was written.',
      ],
      data: previewData,
    });
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const currentEnv = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
  const nextEnv = mergeSingleEnvValue(currentEnv, SKILL_GOVERNANCE_ENV_KEY, requested);
  await fsp.writeFile(targetFile, nextEnv, 'utf8');
  process.env[SKILL_GOVERNANCE_ENV_KEY] = requested;

  const receipt = {
    id: idWithTime('skills-governance'),
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied' as const,
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: `Applied ${SKILL_GOVERNANCE_ENV_KEY}=${requested}.`,
    data: redactSecrets(previewData) as Record<string, unknown>,
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'skills-governance.json'), receipt);

  return {
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: receipt.summary,
    lines: [
      `Requested mode: ${requested}`,
      `Applied: ${SKILL_GOVERNANCE_ENV_KEY}=${requested}`,
      `File: ${targetFile}`,
    ],
    data: { ...previewData, applied: true },
    receipt,
  };
}

function simpleStatusHandler(title: string, summary: string) {
  return (input: ZavorthActionHandlerInput): ZavorthActionResult => result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary,
    lines: [title, summary],
    data: { source: 'ZavorthActionCatalog', catalogOnly: true },
  });
}

function resolveHome(root: string): ReturnType<ZavorthHomePathService['resolveSnapshot']> {
  return new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: process.env.ZAVORTH_HOME || null,
    env: process.env,
  }).resolveSnapshot();
}

function stateDbForHome(home: ReturnType<ZavorthHomePathService['resolveSnapshot']>): ZavorthOperationalStateDbService {
  return new ZavorthOperationalStateDbService({ dbPath: home.resolvedPaths.dbPath });
}

function readJsonFile(file: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function listJsonFiles(dir: string): Array<Record<string, unknown>> {
  try {
    return fs.readdirSync(dir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => readJsonFile(path.join(dir, entry), {}))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)));
  } catch {
    return [];
  }
}

function providerStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const providers = [
    ['openai', 'OPENAI_API_KEY', 'OPENAI_MODEL'],
    ['openrouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL'],
    ['gemini', 'GEMINI_API_KEY', 'GEMINI_MODEL'],
    ['anthropic', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'],
    ['deepseek', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'],
    ['qwen', 'QWEN_API_KEY', 'QWEN_MODEL'],
    ['minimax', 'MINIMAX_API_KEY', 'MINIMAX_MODEL'],
    ['opencode', 'OPENCODE_API_KEY', 'OPENCODE_MODEL'],
  ].map(([id, key, modelKey]) => ({
    id,
    credentialDetected: Boolean(process.env[key]),
    model: process.env[modelKey] || null,
    credentialEnv: key,
  }));
  const configured = providers.filter((provider) => provider.credentialDetected).length;
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${configured} provider credential(s) detected.`,
    lines: providers.map((provider) => `${provider.id}: ${provider.credentialDetected ? 'credential detected' : 'missing env'}${provider.model ? `, model ${provider.model}` : ''}`),
    data: { providers, configured },
  });
}

function homeStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = resolveHome(input.root);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `ZAVORTH_HOME resolves to ${snapshot.root}.`,
    lines: [
      `Root: ${snapshot.root}`,
      `Source: ${snapshot.source}`,
      `Isolated: ${snapshot.isolated ? 'yes' : 'compat fallback'}`,
      `Migration: ${snapshot.migration.status}`,
      ...snapshot.warnings.map((warning) => `Warning: ${warning}`),
    ],
    data: { snapshot },
  });
}

function homeMigrationPreviewHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = new ZavorthHomePathService({
    projectRoot: input.root,
    explicitHome: normalizeText(input.args.home || process.env.ZAVORTH_HOME || ''),
    env: process.env,
  }).buildMigrationPreview();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'preview',
    summary: `Home migration preview: ${snapshot.migration.status}.`,
    lines: [
      `Home: ${snapshot.root}`,
      `Migration: ${snapshot.migration.status}`,
      `Entries: ${snapshot.migration.entries.filter((entry) => entry.exists).length}`,
      'Preview only. Migration apply remains explicit and approval-gated.',
    ],
    data: { snapshot },
  });
}

function echoWakeStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const session = new VoiceWakeRuntimeService({
    stateFile: path.join(home.resolvedPaths.runtimeDir, 'voice-wake-session.json'),
    env: process.env,
  }).status();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Echo wake is ${session.mode}.`,
    lines: [
      `Mode: ${session.mode}`,
      `Armed until: ${session.armedUntil || 'off'}`,
      `Detector: ${session.detector.configured ? session.detector.kind : 'not configured'}`,
      'Privacy: local wake, no raw audio persistence.',
    ],
    data: { session },
  });
}

function tasksStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  }).snapshot();
  const legacyTasks = readJsonFile(path.join(stateDir(input.root), 'tasks.json'), []);
  const cronJobs = readJsonFile(path.join(stateDir(input.root), 'cron-jobs.json'), []);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${taskPlane.items.length} task-plane item(s), ${Array.isArray(cronJobs) ? cronJobs.length : 0} cron job(s).`,
    lines: [
      `Task Plane: ${taskPlane.items.length}`,
      `Queued: ${taskPlane.summary.queued}`,
      `Running: ${taskPlane.summary.running}`,
      `Waiting approval: ${taskPlane.summary.waiting_approval}`,
      `Cron jobs: ${Array.isArray(cronJobs) ? cronJobs.length : 0}`,
    ],
    data: { taskPlane, legacyTasks: Array.isArray(legacyTasks) ? legacyTasks.length : 0, cronJobs: Array.isArray(cronJobs) ? cronJobs.length : 0 },
  });
}

function taskPlaneForRoot(root: string): TaskPlaneService {
  const home = resolveHome(root);
  return new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

function sessionRecallHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  const service = new ZavorthSessionRecallService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'mnemos-session-recall.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const snapshot = service.recall({
    query,
    sessionId: normalizeText(input.args.sessionId || input.args.session_id),
    currentSessionId: normalizeText(input.args.currentSessionId || input.args.current_session_id),
    aroundMessageId: normalizeText(input.args.aroundMessageId || input.args.around_message_id),
    limit: Number(input.args.limit || input.args.topK || 8),
    window: Number(input.args.window || 2),
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: input.operation === 'action.preview' ? 'preview' : 'ok',
    summary: `Session recall returned ${snapshot.returned} hit(s).`,
    lines: snapshot.hits.length
      ? snapshot.hits.map((hit) => `${hit.sessionId}: ${hit.title} | ${hit.snippet}`)
      : ['No session recall entries yet.'],
    data: { snapshot },
  });
}

async function backgroundTaskHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const prompt = normalizeText(input.args.prompt || input.args.query || input.args.text || input.args.objective);
  const service = new ZavorthBackgroundTaskService({
    projectRoot: input.root,
    explicitHome: normalizeText(input.args.home || process.env.ZAVORTH_HOME || '') || null,
    env: process.env,
  });
  if (input.operation === 'action.status' || input.actionId === 'background.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.total} background task(s).`,
      lines: [
        `Background tasks: ${snapshot.summary.total}`,
        `Queued: ${snapshot.summary.queued}`,
        `Running: ${snapshot.summary.running}`,
        `Waiting approval: ${snapshot.summary.waitingApproval}`,
      ],
      data: { snapshot },
    });
  }
  if (!prompt) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Background task needs a prompt.',
      lines: ['Provide args.prompt or a natural objective.'],
    });
  }
  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview background task creation.',
      lines: [
        `Prompt: ${prompt.slice(0, 240)}`,
        'Will create a Task Plane item; no worker is started by the preview.',
      ],
      data: {
        promptPreview: prompt.slice(0, 500),
        workerSeparated: true,
        taskPlaneBacked: true,
      },
    });
  }
  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }
  const task = service.createBackgroundTask({
    prompt,
    title: normalizeText(input.args.title),
    sessionId: normalizeText(input.args.sessionId || input.args.session_id) || null,
    profileId: normalizeText(input.args.profileId || input.args.profile_id) || null,
    sourceSurface: input.sourceSurface || 'action-harness',
  });
  const receipt = {
    id: idWithTime('background-task'),
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied' as const,
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: `Created background task ${task.id}.`,
    data: { taskId: task.id, title: task.title, status: task.status },
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'background-tasks.json'), receipt);
  return {
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: receipt.summary,
    lines: [`Created background task: ${task.id}`, `Status: ${task.status}`],
    data: { task },
    receipt,
  };
}

async function goalsHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const service = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane: taskPlaneForRoot(input.root),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  if (input.operation === 'action.status' || input.actionId === 'goals.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.active} active goal(s).`,
      lines: snapshot.goals.length
        ? snapshot.goals.slice(-12).map((goal) => `${goal.id}: ${goal.status} | ${goal.objective}`)
        : ['No goals recorded yet.'],
      data: { snapshot },
    });
  }
  const objective = normalizeText(input.args.objective || input.args.query || input.args.text);
  if (!objective) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Goal creation needs an objective.',
      lines: ['Provide args.objective.'],
    });
  }
  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview persistent goal creation.',
      lines: [
        `Objective: ${objective.slice(0, 240)}`,
        `Max turns: ${Number(input.args.maxTurns || input.args.max_turns || 12)}`,
        'Will create a Goal Plane item and a Task Plane item when applied.',
      ],
      data: { objective, maxTurns: Number(input.args.maxTurns || input.args.max_turns || 12), taskPlaneBacked: true },
    });
  }
  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }
  const goal = service.createGoal({
    objective,
    sessionId: normalizeText(input.args.sessionId || input.args.session_id) || null,
    profileId: normalizeText(input.args.profileId || input.args.profile_id) || null,
    maxTurns: Number(input.args.maxTurns || input.args.max_turns || 12),
    actor: input.actorId || 'operator',
  });
  const receipt = {
    id: idWithTime('goal-plane'),
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied' as const,
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: `Created goal ${goal.id}.`,
    data: { goalId: goal.id, objective: goal.objective, taskPlaneItemId: goal.taskPlaneItemId },
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'goal-plane.json'), receipt);
  return {
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: receipt.summary,
    lines: [`Created goal: ${goal.id}`, `Task Plane item: ${goal.taskPlaneItemId || 'none'}`],
    data: { goal },
    receipt,
  };
}

async function goalLoopHandler(
  input: ZavorthActionHandlerInput,
  runtime: ZavorthActionCatalogRuntime = {},
): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const taskPlane = taskPlaneForRoot(input.root);
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const goalId = normalizeText(input.args.goalId || input.args.goal_id || input.args.id);
  if (!goalId) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Goal loop needs a goal id.',
      lines: ['Provide args.goalId or args.id.'],
    });
  }
  const goal = goalPlane.snapshot().goals.find((entry) => entry.id === goalId) || null;
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: Boolean(goal),
      actionId: input.actionId,
      operation: input.operation,
      status: goal ? (input.operation === 'action.preview' ? 'preview' : 'ok') : 'blocked',
      summary: goal ? `Preview Goal Loop step for ${goal.id}.` : `Goal not found: ${goalId}.`,
      lines: goal
        ? [
          `Goal: ${goal.id}`,
          `Status: ${goal.status}`,
          `Turns: ${goal.turnsUsed}/${goal.maxTurns}`,
          'Apply will evaluate the goal and may queue a continuation task; it will not execute work directly.',
        ]
        : [`No goal found for id: ${goalId}`],
      data: {
        goal,
        noSilentExecution: true,
        continuationQueuedNotExecuted: true,
      },
    });
  }
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
    llmRuntime: runtime.goalLoopLlmRuntime || null,
  });
  const snapshot = await loop.evaluate({
    goalId,
    turnSummary: normalizeText(input.args.summary || input.args.detail || input.args.result) || null,
    lastAssistantText: normalizeText(input.args.lastAssistantText || input.args.last_assistant) || null,
    userIntervened: input.args.userIntervened === true || input.args.user_intervened === true,
    force: input.args.force === true,
    actor: input.actorId || 'action-harness',
    sourceSurface: input.sourceSurface || 'action-harness',
  });
  return result({
    ok: snapshot.verdict.status !== 'blocked',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.verdict.status === 'blocked' ? 'blocked' : 'applied',
    summary: `Goal loop ${snapshot.verdict.status}: ${snapshot.verdict.reason}`,
    lines: [
      `Goal: ${snapshot.goal?.id || goalId}`,
      `Verdict: ${snapshot.verdict.status}`,
      `Judge: ${snapshot.verdict.judge}`,
      `Reason: ${snapshot.verdict.reason}`,
      snapshot.continuationTask ? `Queued continuation: ${snapshot.continuationTask.id}` : 'Queued continuation: none',
      snapshot.receipt ? `Receipt: ${snapshot.receipt.id}` : 'Receipt: none',
    ],
    data: { snapshot },
  });
}

async function goalLoopWorkerHandler(
  input: ZavorthActionHandlerInput,
  runtime: ZavorthActionCatalogRuntime = {},
): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const taskPlane = taskPlaneForRoot(input.root);
  const goalPlane = new GoalPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'goal-plane.json'),
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const loop = new GoalLoopService({
    goalPlane,
    taskPlane,
    stateDbPath: home.resolvedPaths.dbPath,
    llmRuntime: runtime.goalLoopLlmRuntime || null,
  });
  const previewWorker = runtime.goalLoopAgentRunner
    ? new GoalLoopWorkerService({
      goalPlane,
      taskPlane,
      loop,
      agentRunner: runtime.goalLoopAgentRunner,
      stateDbPath: home.resolvedPaths.dbPath,
    })
    : null;
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    const preview = previewWorker?.preview({
      taskId: normalizeText(input.args.taskId || input.args.task_id || input.args.id) || null,
      workerId: normalizeText(input.args.workerId || input.args.worker_id) || 'action-goal-loop-worker',
    }) || null;
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: preview?.task
        ? `Goal Loop worker can process ${preview.task.id}.`
        : runtime.goalLoopAgentRunner
          ? 'No queued Goal Loop continuation task is available.'
          : 'Goal Loop worker needs an injected AgentRun runner on this surface.',
      lines: [
        runtime.goalLoopAgentRunner ? 'AgentRun runner: connected' : 'AgentRun runner: missing',
        preview?.task ? `Next task: ${preview.task.id}` : 'Next task: none',
        'Apply claims one task, runs AgentRun, updates status, then re-judges the goal.',
      ],
      data: { preview, runnerConnected: Boolean(runtime.goalLoopAgentRunner) },
    });
  }
  if (!runtime.goalLoopAgentRunner) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Goal Loop worker is not connected to an AgentRun runner on this surface.',
      lines: [
        'Connect an AgentRunService/runner before applying goals.loop.worker.',
        'CLI uses zavorth goals worker; embedded surfaces should inject goalLoopAgentRunner.',
      ],
    });
  }
  const worker = new GoalLoopWorkerService({
    goalPlane,
    taskPlane,
    loop,
    agentRunner: runtime.goalLoopAgentRunner,
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const snapshot = await worker.drain({
    taskId: normalizeText(input.args.taskId || input.args.task_id || input.args.id) || null,
    workerId: normalizeText(input.args.workerId || input.args.worker_id) || 'action-goal-loop-worker',
    maxItems: Number(input.args.maxItems || input.args.max_items || 1),
    leaseMs: Number(input.args.leaseMs || input.args.lease_ms || 5 * 60 * 1000),
    dryRun: input.args.dryRun === true || input.args.dry_run === true,
  });
  return result({
    ok: snapshot.processed > 0,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.processed > 0 ? 'applied' : 'blocked',
    summary: `Goal Loop worker processed ${snapshot.processed}/${snapshot.maxItems} task(s).`,
    lines: [
      `Worker: ${snapshot.workerId}`,
      `Processed: ${snapshot.processed}/${snapshot.maxItems}`,
      ...snapshot.runs.slice(0, 8).map((run) => `${run.task?.id || 'none'} | agent ${run.agentRun?.status || 'not-run'} | verdict ${run.loop?.verdict.status || 'not-judged'}`),
    ],
    data: { snapshot },
  });
}

async function xaiHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new ZavorthXaiRuntimeService({ env: process.env });
  const wantsLive = input.args.live === true || input.args.live === 'true';
  if (input.actionId === 'providers.xai.doctor' || input.operation === 'action.status') {
    const snapshot = wantsLive ? await service.liveDoctor() : service.doctor();
    return result({
      ok: snapshot.status === 'ready',
      actionId: input.actionId,
      operation: input.operation,
      status: snapshot.status === 'ready' ? 'ok' : 'blocked',
      summary: snapshot.configured ? 'xAI provider route is configured.' : 'xAI provider route is missing XAI_API_KEY.',
      lines: [
        `Configured: ${snapshot.configured ? 'yes' : 'no'}`,
        `Model: ${snapshot.model}`,
        `Native search: ${snapshot.capabilities.nativeSearch ? 'yes' : 'no'}`,
        wantsLive ? `Live ready: ${snapshot.liveReady ? 'yes' : 'no'}` : 'Live check: skipped',
      ],
      data: { snapshot },
    });
  }
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  if (!query) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'xAI search needs a query.',
      lines: ['Provide args.query.'],
    });
  }
  if (input.operation === 'action.preview') {
    const snapshot = await service.search({ query, live: false });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview xAI native search.',
      lines: snapshot.lines,
      data: { snapshot },
    });
  }
  const snapshot = await service.search({ query, live: wantsLive && input.trustedOperatorConfirmation });
  return result({
    ok: snapshot.status === 'ready' || snapshot.status === 'preview',
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'ready' ? 'ok' : snapshot.status === 'preview' ? 'preview' : 'blocked',
    summary: `xAI search ${snapshot.status}.`,
    lines: snapshot.lines,
    data: { snapshot },
  });
}

async function taskBoardHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const home = resolveHome(input.root);
  const service = new TaskBoardPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-board.json'),
    taskPlane: taskPlaneForRoot(input.root),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  if (input.operation === 'action.status' || input.actionId === 'tasks.board.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.boards} board(s), ${snapshot.summary.tasks} board task(s).`,
      lines: [
        `Boards: ${snapshot.summary.boards}`,
        `Ready: ${snapshot.summary.ready}`,
        `Running: ${snapshot.summary.running}`,
        `Review: ${snapshot.summary.review}`,
        `Blocked: ${snapshot.summary.blocked}`,
      ],
      data: { snapshot },
    });
  }
  const objective = normalizeText(input.args.objective || input.args.query || input.args.title || input.args.text);
  if (!objective) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Task board operation needs an objective or title.',
      lines: ['Provide args.objective or args.title.'],
    });
  }
  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: 'Preview TaskBoard operation.',
      lines: [
        `Objective: ${objective.slice(0, 240)}`,
        input.actionId === 'tasks.board.decompose'
          ? 'Will create planner/worker/verifier cards backed by Task Plane.'
          : 'Will create one board card backed by Task Plane.',
      ],
      data: { objective, taskPlaneBacked: true },
    });
  }
  if (input.actionId === 'tasks.board.decompose') {
    const tasks = service.decompose({
      boardId: normalizeText(input.args.boardId || input.args.board_id) || null,
      objective,
      includeReview: input.args.includeReview !== false,
      actor: input.actorId || 'operator',
    });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'applied',
      summary: `Created ${tasks.length} board task(s).`,
      lines: tasks.map((task) => `${task.id}: ${task.title}`),
      data: { tasks },
    });
  }
  const task = service.triage({
    boardId: normalizeText(input.args.boardId || input.args.board_id) || null,
    title: objective,
    body: normalizeText(input.args.body || input.args.description) || null,
    actor: input.actorId || 'operator',
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `Created board task ${task.id}.`,
    lines: [`Created board task: ${task.id}`, `Lane: ${String(task.payload.lane || 'backlog')}`],
    data: { task },
  });
}

function memorySearchHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  if (!query) {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: 'Memory search needs a query.',
      lines: ['Provide args.query for memory.search.'],
    });
  }
  try {
    const snapshot = new ZavorthMnemosQueryService({ projectRoot: input.root }).query({ query, topK: Number(input.args.topK || 5) });
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `Memory search returned ${snapshot.summary.returned} hit(s).`,
      lines: snapshot.hits.length
        ? snapshot.hits.map((hit) => `${hit.pageId}: ${hit.title} (${hit.score.toFixed(3)})`)
        : ['No memory hits.'],
      data: { snapshot },
    });
  } catch (error) {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: 'Memory search is empty or not indexed yet.',
      lines: ['No Mnemos wiki/index was available for this workspace.'],
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

async function memoryForgetHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const key = normalizeText(input.args.key || input.args.query || input.args.id);
  const userId = normalizeText(input.args.userId || input.args.user_id || 'default');
  if (input.operation === 'action.status' || input.operation === 'action.preview') {
    return result({
      ok: Boolean(key),
      actionId: input.actionId,
      operation: input.operation,
      status: key ? 'preview' : 'blocked',
      summary: key ? `Preview memory forget for key/id ${key}.` : 'Memory forget needs a key or id.',
      lines: key
        ? [`Target: ${key}`, `User: ${userId}`, 'Apply is approval-gated and uses the native MemoryService forget contract.']
        : ['Provide args.key or args.id.'],
      data: { key, userId, durableMutation: false },
    });
  }
  const service = new MemoryService();
  const ok = await service.forget(userId, key);
  const receipt = {
    id: idWithTime('memory-forget'),
    actionId: input.actionId,
    operation: input.operation,
    status: ok ? 'applied' as const : 'failed' as const,
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: ok ? `Forgot memory ${key}.` : `Memory ${key} was not found.`,
    data: { key, userId },
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'memory-forget.json'), receipt);
  return {
    ok,
    actionId: input.actionId,
    operation: input.operation,
    status: ok ? 'applied' : 'blocked',
    summary: receipt.summary,
    lines: [receipt.summary],
    data: { key, userId, forgotten: ok },
    receipt,
  };
}

function approvalsStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const plans = listJsonFiles(path.join(stateDir(input.root), 'mutation-plans'));
  const pending = plans.filter((plan) => plan.status === 'waiting_approval' || (plan.approval as { status?: unknown } | undefined)?.status === 'pending');
  const approved = plans.filter((plan) => plan.status === 'approved' || (plan.approval as { status?: unknown } | undefined)?.status === 'approved');
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${pending.length} pending approval(s).`,
    lines: [`Pending: ${pending.length}`, `Approved: ${approved.length}`, `Plans: ${plans.length}`],
    data: { pending: pending.length, approved: approved.length, plans: plans.slice(-20).map(redactSecrets) },
  });
}

function channelsReadinessHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const channels = [
    ['telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_DEFAULT_CHAT_ID']],
    ['discord', ['DISCORD_WEBHOOK_URL']],
    ['slack', ['SLACK_WEBHOOK_URL']],
    ['whatsapp', ['WHATSAPP_BRIDGE_URL', 'WHATSAPP_WEBHOOK_URL', 'WHATSAPP_OUTBOX_DIR']],
    ['signal', ['SIGNAL_JSONRPC_URL', 'SIGNAL_CLI_PATH']],
    ['teams', ['TEAMS_WEBHOOK_URL', 'MSTEAMS_WEBHOOK_URL']],
    ['email', ['SMTP_HOST', 'RESEND_API_KEY']],
  ].map(([id, envs]) => {
    const envList = envs as string[];
    return { id, ready: envList.some((key) => Boolean(process.env[key])), env: envList };
  });
  const ready = channels.filter((channel) => channel.ready).length;
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${ready} channel adapter(s) have configuration hints.`,
    lines: channels.map((channel) => `${channel.id}: ${channel.ready ? 'configured' : 'missing env'}`),
    data: { channels, ready },
  });
}

async function channelProgressHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new ChannelProgressSurfaceService({
    stateFile: path.join(stateDir(input.root), 'channel-progress-surface.json'),
  });
  if (input.operation === 'action.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.sessions.length} channel progress session(s).`,
      lines: [
        `Sessions: ${snapshot.sessions.length}`,
        `Receipts: ${snapshot.receipts.length}`,
        ...snapshot.capabilities.map((capability) => `${capability.channel}: ${capability.canEdit ? 'edit' : 'send'} progress`),
      ],
      data: { snapshot },
    });
  }

  const event = {
    runId: normalizeText(input.args.runId || input.args.run_id || input.args.id || 'preview-run'),
    channel: normalizeText(input.args.channel || 'telegram') as any,
    chatId: normalizeText(input.args.chatId || input.args.chat_id || 'preview-chat'),
    messageId: normalizeText(input.args.messageId || input.args.message_id) || null,
    stage: normalizeText(input.args.stage || 'tool_progress') as any,
    title: normalizeText(input.args.title || input.args.query || 'Zavorth status update'),
    detail: normalizeText(input.args.detail || input.args.text || input.args.query || 'The run is making progress.'),
    toolName: normalizeText(input.args.toolName || input.args.tool_name) || null,
    actionId: normalizeText(input.args.targetActionId || input.args.target_action_id) || null,
    integrationId: normalizeText(input.args.integrationId || input.args.integration_id) || null,
    link: normalizeText(input.args.link) || null,
    finalText: normalizeText(input.args.finalText || input.args.final_text) || null,
  };
  const rendered = service.render(event);

  if (input.operation === 'action.preview') {
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview channel progress update for ${event.channel}.`,
      lines: rendered.split('\n'),
      data: {
        rendered,
        capability: service.capabilityFor(event.channel),
        progressNotTranscript: true,
        outboundPolicyRequired: true,
      },
    });
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const receipt = await service.publish(event);
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'channel-progress.json'), receipt);
  const applied = receipt.status !== 'failed' && receipt.transport !== 'off';
  return {
    ok: applied,
    actionId: input.actionId,
    operation: input.operation,
    status: applied ? 'applied' : 'blocked',
    summary: receipt.summary,
    lines: [
      `${receipt.channel}: ${receipt.status} via ${receipt.transport}`,
      `Stage: ${receipt.stage}`,
      `Message: ${receipt.messageId || 'none'}`,
    ],
    data: { receipt },
    receipt: {
      id: receipt.id,
      actionId: input.actionId,
      operation: input.operation,
      status: receipt.status === 'failed' ? 'failed' : 'applied',
      createdAt: receipt.createdAt,
      sourceSurface: input.sourceSurface || null,
      actorId: input.actorId || null,
      summary: receipt.summary,
      data: redactSecrets({ receipt }) as Record<string, unknown>,
    },
  };
}

async function integrationConnectorsHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
  const service = new IntegrationConnectorMeshService();
  const connectorId = normalizeText(input.args.connectorId || input.args.connector_id || input.args.id || input.args.query);
  if (input.actionId === 'integration.connectors.status' || input.operation === 'action.status') {
    const snapshot = await service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.configured}/${snapshot.summary.total} connector broker(s) configured.`,
      lines: snapshot.doctors.map((doctor) => `${doctor.id}: ${doctor.status} | ${doctor.summary}`),
      data: { snapshot },
    });
  }

  if (input.actionId === 'integration.connectors.doctor') {
    if (!connectorId) {
      const snapshot = await service.snapshot();
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: input.operation === 'action.preview' ? 'preview' : 'ok',
        summary: `${snapshot.summary.ready} connector broker(s) ready.`,
        lines: snapshot.doctors.map((doctor) => `${doctor.id}: ${doctor.status} | ${doctor.nextAction}`),
        data: { snapshot },
      });
    }
    const doctor = await service.doctor(connectorId);
    return result({
      ok: doctor.status !== 'failed',
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary: `${doctor.label}: ${doctor.status}.`,
      lines: [
        `Connector: ${doctor.id}`,
        `Status: ${doctor.status}`,
        `Configured: ${doctor.configured ? 'yes' : 'no'}`,
        `Probe: ${doctor.checkedTarget || 'not configured'}`,
        `Next: ${doctor.nextAction}`,
      ],
      data: { doctor },
    });
  }

  if (input.actionId !== 'integration.connectors.execute') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported connector action ${input.actionId}.`,
      lines: [`Unsupported action: ${input.actionId}`],
    });
  }

  const toolSlug = normalizeText(input.args.toolSlug || input.args.tool_slug || input.args.tool);
  const toolInput = input.args.input && typeof input.args.input === 'object' && !Array.isArray(input.args.input)
    ? input.args.input as Record<string, unknown>
    : {};

  if (input.operation === 'action.preview') {
    try {
      const preview = service.buildExecutePreview({ connectorId, toolSlug, input: toolInput });
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: 'preview',
        summary: `Preview ${preview.connectorId} tool execution: ${preview.toolSlug}.`,
        lines: [
          `Connector: ${preview.connectorId}`,
          `Tool: ${preview.toolSlug}`,
          `Target: ${preview.target}`,
          'External execution requires approval and receipt.',
        ],
        data: { preview },
      });
    } catch (error) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'blocked',
        summary: error instanceof Error ? error.message : String(error),
        lines: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const execution = await service.executeTool({ connectorId, toolSlug, input: toolInput });
  const connectorReceipt = {
    id: idWithTime('integration-connector'),
    actionId: input.actionId,
    operation: input.operation,
    status: execution.ok ? 'applied' as const : 'failed' as const,
    createdAt: new Date().toISOString(),
    sourceSurface: input.sourceSurface || null,
    actorId: input.actorId || null,
    summary: execution.summary,
    data: redactSecrets(execution) as Record<string, unknown>,
  };
  await appendJsonArray(path.join(stateDir(input.root), 'receipts', 'integration-connectors.json'), connectorReceipt);
  return {
    ok: execution.ok,
    actionId: input.actionId,
    operation: input.operation,
    status: execution.ok ? 'applied' : 'blocked',
    summary: execution.summary,
    lines: [
      `Connector: ${execution.connectorId}`,
      `Tool: ${execution.toolSlug}`,
      `HTTP: ${execution.httpStatus || 'n/a'}`,
    ],
    data: { execution },
    receipt: connectorReceipt,
  };
}

function sandboxStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const receipts = readJsonFile(path.join(stateDir(input.root), 'logs', 'sandbox.json'), []);
  const dockerHint = Boolean(process.env.DOCKER_HOST || fs.existsSync('/var/run/docker.sock'));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: dockerHint ? 'Sandbox has Docker configuration hints.' : 'Sandbox is available as preview/policy surface; strong backend not detected by env.',
    lines: [
      `Docker hint: ${dockerHint ? 'yes' : 'no'}`,
      `Receipts: ${Array.isArray(receipts) ? receipts.length : 0}`,
    ],
    data: { dockerHint, receipts: Array.isArray(receipts) ? receipts.slice(-10).map(redactSecrets) : [] },
  });
}

function capabilityAtlasHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = new ZavorthCapabilityAtlasService({
    projectRoot: input.root,
  }).buildSnapshot({
    query: normalizeText(input.args.query) || null,
    category: typeof input.args.category === 'string' ? input.args.category as any : null,
    limit: normalizePositiveNumber(input.args.limit),
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'missing' ? 'blocked' : 'ok',
    summary: `Capability Atlas mapped ${snapshot.summary.total} Zavorth capability surface(s).`,
    lines: [
      `Status: ${snapshot.status}`,
      `Total: ${snapshot.summary.total}`,
      `Visible to LLM: ${snapshot.summary.llmVisible}`,
      `Action-backed: ${snapshot.summary.actionHarnessBacked}`,
      ...snapshot.entries.slice(0, 12).map((entry) =>
        `- ${entry.id} [${entry.status}] ${entry.title} :: ${entry.dailyUse}`,
      ),
    ],
    data: { atlas: snapshot },
  });
}

function dailyProductHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = new ZavorthDailyProductQuietAutonomyService().buildSnapshot({
    profileId: normalizeText(input.args.profileId || input.args.profile || input.args.query) || null,
  });
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: snapshot.status === 'blocked' ? 'blocked' : 'ok',
    summary: `Daily product is ${snapshot.status}; active profile ${snapshot.activeProfileId} uses ${snapshot.quietAutonomy.activePolicy.mode}.`,
    lines: [
      `Status: ${snapshot.status}`,
      `Primary surface: ${snapshot.dailyProduct.primarySurface}`,
      `Tabs: ${snapshot.dailyProduct.visibleTabs.map((tab) => tab.label).join(', ')}`,
      `Quiet: ${snapshot.quietAutonomy.activePolicy.mode}`,
      `Silent: ${snapshot.quietAutonomy.activePolicy.silentLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
      `Approval: ${snapshot.quietAutonomy.activePolicy.approvalLanes.map((lane) => lane.lane).join(', ') || 'none'}`,
    ],
    data: { dailyProduct: snapshot },
  });
}

function gitReviewHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const hasGit = fs.existsSync(path.join(input.root, '.git'));
  return result({
    ok: hasGit,
    actionId: input.actionId,
    operation: input.operation,
    status: hasGit ? 'ok' : 'blocked',
    summary: hasGit ? 'Git repository detected for governed review.' : 'No .git directory detected in this root.',
    lines: hasGit
      ? ['Git review can run through the governed review command surface.']
      : ['No git repository was found for this workspace root.'],
    data: { hasGit, root: input.root },
  });
}

function setupStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const progress = readJsonFile(path.join(stateDir(input.root), 'setup-progress.json'), null);
  const envExists = fs.existsSync(envFile(input.root));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: progress ? 'Setup progress exists.' : 'No setup progress file found.',
    lines: [`Setup progress: ${progress ? 'present' : 'missing'}`, `.env: ${envExists ? 'present' : 'missing'}`],
    data: { progress: redactSecrets(progress), envExists },
  });
}

function configStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const envExists = fs.existsSync(envFile(input.root));
  const stateExists = fs.existsSync(stateDir(input.root));
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Config state: .env ${envExists ? 'present' : 'missing'}, .zavorth ${stateExists ? 'present' : 'missing'}.`,
    lines: [`.env: ${envExists ? 'present' : 'missing'}`, `.zavorth: ${stateExists ? 'present' : 'missing'}`],
    data: { envExists, stateExists, root: input.root },
  });
}

function operationalStateStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const stateDb = stateDbForHome(home);
  const snapshot = stateDb.snapshot();
  stateDb.close();
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `Operational StateDB has ${snapshot.counts.events} event(s), ${snapshot.counts.tasks} task(s), ${snapshot.counts.messages} message(s).`,
    lines: [
      `DB: ${snapshot.dbPath}`,
      `Journal: ${snapshot.journalMode}`,
      `FTS: ${snapshot.ftsAvailable ? 'enabled' : 'fallback'}`,
      `Sessions: ${snapshot.counts.sessions}`,
      `Messages: ${snapshot.counts.messages}`,
      `Tasks: ${snapshot.counts.tasks}`,
      `Goals: ${snapshot.counts.goals}`,
      `Boards: ${snapshot.counts.boards}`,
      `Events: ${snapshot.counts.events}`,
    ],
    data: { snapshot },
  });
}

function capabilityActionExposureService(input: ZavorthActionHandlerInput): ZavorthCapabilityActionExposureService {
  return new ZavorthCapabilityActionExposureService({
    projectRoot: input.root,
    env: process.env,
  });
}

function verificationIdsFromArgs(args: Record<string, unknown>): string[] {
  const single = normalizeText(args.verificationId || args.verification || args.id);
  const many = Array.isArray(args.verificationIds)
    ? args.verificationIds.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  return [...many, single].filter(Boolean);
}

function capabilityExposureHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const service = capabilityActionExposureService(input);
  if (input.operation === 'action.status' || input.actionId === 'capabilities.verified.status') {
    const snapshot = service.snapshot();
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'ok',
      summary: `${snapshot.summary.exposures} verified capability action candidate(s) exposed.`,
      lines: snapshot.exposures.length
        ? snapshot.exposures.map((exposure) => `${exposure.actionId}: ${exposure.status} | ${exposure.title}`)
        : ['No verified capability action candidate has been exposed yet.'],
      data: { snapshot },
    });
  }

  const request = {
    allVerified: input.args.allVerified === true || input.args.all === true || verificationIdsFromArgs(input.args).length === 0,
    verificationIds: verificationIdsFromArgs(input.args),
    actor: input.actorId || 'operator',
  };

  if (input.operation === 'action.preview') {
    const preview = service.preview(request);
    return result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: 'preview',
      summary: `Preview Action Harness exposure for ${preview.selected} verified capability candidate(s).`,
      lines: [
        ...preview.lines,
        'Preview only. No Action Harness exposure store was written.',
      ],
      data: { preview },
    });
  }

  if (input.operation !== 'action.apply') {
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Unsupported operation for ${input.actionId}.`,
      lines: [`Unsupported operation: ${input.operation}`],
    });
  }

  const snapshot = service.expose(request);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'applied',
    summary: `${snapshot.summary.exposures} capability action candidate(s) are exposed through the Action Harness.`,
    lines: snapshot.exposures.length
      ? snapshot.exposures.map((exposure) => `${exposure.actionId}: ${exposure.status} | ${exposure.title}`)
      : ['No new exposure was created.'],
    data: { snapshot },
  });
}

function generatedCapabilityCandidateHandler(exposureActionId: string): ZavorthActionDefinition['handler'] {
  return (input: ZavorthActionHandlerInput): ZavorthActionResult => {
    const service = capabilityActionExposureService(input);
    const exposure = service.snapshot().exposures.find((entry) => entry.actionId === exposureActionId);
    if (!exposure) {
      return result({
        ok: false,
        actionId: input.actionId,
        operation: input.operation,
        status: 'not_found',
        summary: 'Capability action exposure was not found.',
        lines: [`Missing exposed candidate: ${exposureActionId}`],
      });
    }
    if (input.operation === 'action.status' || input.operation === 'action.preview') {
      return result({
        ok: true,
        actionId: input.actionId,
        operation: input.operation,
        status: input.operation === 'action.preview' ? 'preview' : 'ok',
        summary: `Capability action candidate ${exposure.actionId} is exposed but not live-activated.`,
        lines: [
          `Candidate: ${exposure.title}`,
          `Verification: ${exposure.verificationId}`,
          'Tool execution: disabled',
          'Live activation: disabled',
          'Next phase must add visible product surfaces and later activation gates.',
        ],
        data: { exposure },
      });
    }
    return result({
      ok: false,
      actionId: input.actionId,
      operation: input.operation,
      status: 'blocked',
      summary: `Capability action candidate ${exposure.actionId} cannot execute yet.`,
      lines: [
        'This candidate is discoverable through the Action Harness, but live execution is intentionally disabled.',
        'Run the next gated phases before any tool call, network call or live activation.',
      ],
      data: { exposure },
    });
  };
}

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

type ZavorthActionCatalogRuntime = {
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
    createWebBrowserActionModule(),
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
      surface: ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'],
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
      surface: ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'],
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
      surface: ['cli', 'dashboard', 'tui', 'api', 'channel', 'llm'] as ZavorthActionDefinition['surface'],
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
  } catch {
    return [];
  }
}
