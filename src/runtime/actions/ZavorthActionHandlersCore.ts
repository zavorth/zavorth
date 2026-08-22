import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { GoalPlaneService } from '../../services/GoalPlaneService.js';
import { TaskPlaneService } from '../../services/TaskPlaneService.js';
import { VoiceWakeRuntimeService } from '../../services/VoiceWakeRuntimeService.js';
import { ZavorthBackgroundTaskService } from '../../services/ZavorthBackgroundTaskService.js';
import { ZavorthHomePathService } from '../../services/ZavorthHomePathService.js';
import { ZavorthOperationalStateDbService } from '../../services/ZavorthOperationalStateDbService.js';
import { SessionContinuumService, resolveSessionContinuumStorePath } from '../../services/SessionContinuumService.js';
import { bindAutonomySchedulePlane } from '../../services/AutonomySchedulePlane.js';
import { type ZavorthActionHandlerInput, type ZavorthActionResult } from './ZavorthActionContracts.js';

const SKILL_GOVERNANCE_ENV_KEY = 'ZAVORTH_SKILLS_GOVERNANCE_MODE';

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeSearch(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join('')
    .toLowerCase();
}

export function normalizeMode(value: unknown): 'casual' | 'governed' | null {
  const text = normalizeSearch(value);
  if (text === 'governed') {
    return 'governed';
  }
  if (text === 'casual') {
    return 'casual';
  }
  return null;
}

export function normalizePositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export function stateDir(root: string): string {
  return path.join(root, '.zavorth');
}

export function envFile(root: string): string {
  return path.join(root, '.env');
}

function splitEnvLines(value: string): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of value) {
    if (char === '\r') {
      continue;
    }
    if (char === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  lines.push(current);
  return lines;
}

function parseEnvAssignment(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }
  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();
  return key ? { key, value } : null;
}

function isPlainEnvValueChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '_' ||
    char === '.' ||
    char === ':' ||
    char === '/' ||
    char === '\\' ||
    char === '-'
  );
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeSearch(key).split('-').join('_');
  return normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized === 'pass' ||
    normalized.includes('_pass') ||
    normalized.includes('pass_') ||
    normalized.includes('api_key') ||
    normalized.includes('apikey') ||
    normalized.includes('credential');
}

export function readEnvMode(root: string): 'casual' | 'governed' {
  const fromProcess = normalizeMode(process.env[SKILL_GOVERNANCE_ENV_KEY]);
  if (fromProcess) return fromProcess;
  try {
    const raw = fs.readFileSync(envFile(root), 'utf8');
    for (const line of splitEnvLines(raw)) {
      const parsed = parseEnvAssignment(line);
      if (parsed?.key === SKILL_GOVERNANCE_ENV_KEY) {
        return normalizeMode(parsed.value) || 'casual';
      }
    }
    return 'casual';
  } catch (error: unknown) {
    return 'casual';
  }
}

export function quoteEnv(value: string): string {
  return Array.from(value).every(isPlainEnvValueChar) ? value : JSON.stringify(value);
}

export function mergeSingleEnvValue(current: string, key: string, value: string): string {
  const lines = splitEnvLines(current);
  let replaced = false;
  const next = lines.map((line) => {
    const parsed = parseEnvAssignment(line);
    if (parsed?.key === key) {
      replaced = true;
      return `${key}=${quoteEnv(value)}`;
    }
    return line;
  });
  if (!replaced) next.push(`${key}=${quoteEnv(value)}`);
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return `${next.join('\n')}\n`;
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, isSensitiveKey(key) ? '***' : redactSecrets(entry)]));
  }
  return value;
}

export async function appendJsonArray(file: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(await fsp.readFile(file, 'utf8'));
    items = Array.isArray(parsed) ? parsed : [];
  } catch (error: unknown) {
    items = [];
  }
  items.push(value);
  await fsp.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

export function idWithTime(prefix: string): string {
  return `${prefix}-${new Date()
    .toISOString()
    .split('')
    .filter((char) => char >= '0' && char <= '9')
    .join('')
    .slice(0, 14)}`;
}

export function result(input: { ok: boolean; actionId: string; operation: ZavorthActionResult['operation']; status: ZavorthActionResult['status']; summary: string; lines: string[]; data?: Record<string, unknown> }): ZavorthActionResult {
  return input;
}

export async function skillGovernanceHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
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
      lines: [`Current mode: ${current}`, 'casual: fast personal-use imports; hard security/license blockers remain active.', 'governed: stricter review for enterprise, compliance and sensitive workspaces.'],
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
        requested === 'governed' ? 'Governed will require stricter risk/license review and clearer audit evidence for skill imports.' : 'Casual keeps imports smooth for daily use, while hard blockers still stop unsafe skills.',
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
    lines: [`Requested mode: ${requested}`, `Applied: ${SKILL_GOVERNANCE_ENV_KEY}=${requested}`, `File: ${targetFile}`],
    data: { ...previewData, applied: true },
    receipt,
  };
}

export function simpleStatusHandler(title: string, summary: string) {
  return (input: ZavorthActionHandlerInput): ZavorthActionResult =>
    result({
      ok: true,
      actionId: input.actionId,
      operation: input.operation,
      status: input.operation === 'action.preview' ? 'preview' : 'ok',
      summary,
      lines: [title, summary],
      data: { source: 'ZavorthActionCatalog', catalogOnly: true },
    });
}

export function resolveHome(root: string): ReturnType<ZavorthHomePathService['resolveSnapshot']> {
  return new ZavorthHomePathService({
    projectRoot: root,
    explicitHome: process.env.ZAVORTH_HOME || null,
    env: process.env,
  }).resolveSnapshot();
}

export function stateDbForHome(home: ReturnType<ZavorthHomePathService['resolveSnapshot']>): ZavorthOperationalStateDbService {
  return new ZavorthOperationalStateDbService({ dbPath: home.resolvedPaths.dbPath });
}

export function readJsonFile(file: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error: unknown) {
    return fallback;
  }
}

export function listJsonFiles(dir: string): Array<Record<string, unknown>> {
  try {
    return fs
      .readdirSync(dir)
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => readJsonFile(path.join(dir, entry), {}))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)));
  } catch (error: unknown) {
    return [];
  }
}

export function providerStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
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

export function homeStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const snapshot = resolveHome(input.root);
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `ZAVORTH_HOME resolves to ${snapshot.root}.`,
    lines: [`Root: ${snapshot.root}`, `Source: ${snapshot.source}`, `Isolated: ${snapshot.isolated ? 'yes' : 'compat fallback'}`, `Migration: ${snapshot.migration.status}`, ...snapshot.warnings.map((warning) => `Warning: ${warning}`)],
    data: { snapshot },
  });
}

export function homeMigrationPreviewHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
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
    lines: [`Home: ${snapshot.root}`, `Migration: ${snapshot.migration.status}`, `Entries: ${snapshot.migration.entries.filter((entry) => entry.exists).length}`, 'Preview only. Migration apply remains explicit and approval-gated.'],
    data: { snapshot },
  });
}

export function echoWakeStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
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
    lines: [`Mode: ${session.mode}`, `Armed until: ${session.armedUntil || 'off'}`, `Detector: ${session.detector.configured ? session.detector.kind : 'not configured'}`, 'Privacy: local wake, no raw audio persistence.'],
    data: { session },
  });
}

export function tasksStatusHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const taskPlane = new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  }).snapshot();
  const legacyTasks = readJsonFile(path.join(stateDir(input.root), 'tasks.json'), []);
  const cronJobs = readJsonFile(path.join(stateDir(input.root), 'cron-jobs.json'), []);
  let autonomyRoutines: Array<{ id: string; enabled: boolean; nextRunAt: string | null }> = [];
  try {
    // Same plane as CLI cron + bootstrap daemon: runtimeDir/cron + Task Plane materialization.
    const plane = bindAutonomySchedulePlane({
      runtimeDir: home.resolvedPaths.runtimeDir,
      taskPlane: new TaskPlaneService({
        storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
        stateDbPath: home.resolvedPaths.dbPath,
      }),
    });
    autonomyRoutines = plane.listRoutines().map((routine) => ({
      id: routine.id,
      enabled: routine.enabled,
      nextRunAt: routine.nextRunAt,
    }));
  } catch {
    autonomyRoutines = [];
  }
  return result({
    ok: true,
    actionId: input.actionId,
    operation: input.operation,
    status: 'ok',
    summary: `${taskPlane.items.length} task-plane item(s), ${autonomyRoutines.length} autonomy routine(s), ${Array.isArray(cronJobs) ? cronJobs.length : 0} legacy cron job(s).`,
    lines: [
      `Task Plane: ${taskPlane.items.length}`,
      `Queued: ${taskPlane.summary.queued}`,
      `Running: ${taskPlane.summary.running}`,
      `Waiting approval: ${taskPlane.summary.waiting_approval}`,
      `Autonomy routines: ${autonomyRoutines.length}`,
      `Cron jobs: ${Array.isArray(cronJobs) ? cronJobs.length : 0}`,
    ],
    data: {
      taskPlane,
      legacyTasks: Array.isArray(legacyTasks) ? legacyTasks.length : 0,
      cronJobs: Array.isArray(cronJobs) ? cronJobs.length : 0,
      autonomyRoutines,
    },
  });
}

export function taskPlaneForRoot(root: string): TaskPlaneService {
  const home = resolveHome(root);
  return new TaskPlaneService({
    storePath: path.join(home.resolvedPaths.runtimeDir, 'task-plane.json'),
    stateDbPath: home.resolvedPaths.dbPath,
  });
}

export function sessionRecallHandler(input: ZavorthActionHandlerInput): ZavorthActionResult {
  const home = resolveHome(input.root);
  const query = normalizeText(input.args.query || input.args.q || input.args.text);
  const continuum = new SessionContinuumService({
    storePath: resolveSessionContinuumStorePath(home.resolvedPaths.runtimeDir),
    stateDbPath: home.resolvedPaths.dbPath,
  });
  const snapshot = continuum.search({
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
    lines: snapshot.hits.length ? continuum.formatHits(snapshot.hits) : ['No session recall entries yet.'],
    data: { snapshot, storePath: continuum.getStorePath() },
  });
}

export async function backgroundTaskHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
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
      lines: [`Background tasks: ${snapshot.summary.total}`, `Queued: ${snapshot.summary.queued}`, `Running: ${snapshot.summary.running}`, `Waiting approval: ${snapshot.summary.waitingApproval}`],
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
      lines: [`Prompt: ${prompt.slice(0, 240)}`, 'Will create a Task Plane item; no worker is started by the preview.'],
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

export async function goalsHandler(input: ZavorthActionHandlerInput): Promise<ZavorthActionResult> {
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
      lines: snapshot.goals.length ? snapshot.goals.slice(-12).map((goal) => `${goal.id}: ${goal.status} | ${goal.objective}`) : ['No goals recorded yet.'],
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
      lines: [`Objective: ${objective.slice(0, 240)}`, `Max turns: ${Number(input.args.maxTurns || input.args.max_turns || 12)}`, 'Will create a Goal Plane item and a Task Plane item when applied.'],
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
