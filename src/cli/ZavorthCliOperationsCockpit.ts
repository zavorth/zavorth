import type { OperationsCockpitSnapshot } from '../services/OperationsCockpitService.js';
import type { OperatorBriefSnapshot } from '../services/OperatorBriefService.js';
import type { ZavorthCliFlags, ZavorthCliRuntime } from './ZavorthCliContract.js';
import type { CliStatusSnapshot } from './ZavorthCliSurfaceHelpers.js';
import { buildCliStatusSnapshot } from './ZavorthCliNativeRenderers.status.js';
import {
  buildCliOperationsDoctorSnapshot,
  buildCliRuntimeAccessProbeInput,
  readCliBriefSnapshot,
  readCliCockpitSnapshot,
} from './ZavorthCliNativeRenderers.runtime.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';

import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { logger } from '../logger.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type CliStage25DoctorSnapshot = Awaited<ReturnType<typeof buildCliOperationsDoctorSnapshot>>;

type CliStage25MemorySummary = {
  artifacts: number;
  replayTasks: number;
  recentArtifact: string | null;
  suggestedAction: {
    label: string;
    command: string;
  } | null;
};

type CliOperationsCockpitCard = {
  id: string;
  title: string;
  tone: CliVisualPanel['tone'];
  lines: string[];
};

type CliStage25UnifiedAction = {
  id: string;
  label: string;
  command: string;
  reason: string;
  priority: 'high' | 'normal';
  source: 'status' | 'brief' | 'ops' | 'doctor' | 'memory' | 'catalog';
};

type CliStage25SourceHealth = {
  status: boolean;
  doctor: boolean;
  brief: boolean;
  ops: boolean;
  memory: boolean;
  actions: boolean;
};

export type CliOperationsCockpitSnapshot = OperationsCockpitSnapshot & {
  stage: '25';
  surface: 'zavorth-cockpit';
  unified: {
    headline: string;
    posture: 'healthy' | 'attention' | 'degraded';
    sourceHealth: CliStage25SourceHealth;
    cards: CliOperationsCockpitCard[];
    nextActions: CliStage25UnifiedAction[];
    memory: CliStage25MemorySummary | null;
    doctorError: string | null;
  };
  statusSnapshot: CliStatusSnapshot | null;
  briefSnapshot: OperatorBriefSnapshot | null;
  doctorSnapshot: CliStage25DoctorSnapshot | null;
};

function cleanHumanLine(value: string | null | undefined, fallback = 'not provided'): string {
  const sanitized = normalizeCliSpaces(sanitizeHumanCliText(value || fallback));
  return sanitized || fallback;
}

function compactLine(value: string | null | undefined, maxLength = 96): string {
  const cleaned = cleanHumanLine(value, '');
  if (!cleaned || cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatHumanCommand(command: string | null | undefined): string {
  const normalized = cleanHumanLine(command, '').trim();
  const tokens = splitCliTokens(normalized);
  const lowerTokens = tokens.map((token) => token.toLowerCase());

  if (!normalized) {
    return 'zavorth status';
  }
  if (shouldRouteToDoctor(lowerTokens)) {
    return 'zavorth doctor';
  }
  if (shouldRouteToGo(lowerTokens)) {
    return 'zavorth go';
  }
  if (lowerTokens.some((token) => doctorOnlyCommands().has(token))) {
    return 'zavorth doctor';
  }
  if (lowerTokens[0] === 'zavorth' && lowerTokens[1] === 'ops' && lowerTokens[2] === 'run') {
    return 'zavorth doctor';
  }
  return normalized;
}

function normalizeCliSpaces(value: string): string {
  return splitCliTokens(value).join(' ');
}

function splitCliTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const char of String(value || '')) {
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function shouldRouteToDoctor(tokens: string[]): boolean {
  const doctorCommands = doctorOnlyCommands();
  return tokens.some((token) => doctorCommands.has(token));
}

function doctorOnlyCommands(): Set<string> {
  return new Set([
    'validate-node-mesh-smoke',
    'validate-channel-providers',
    'validate-remote-transports',
    'security-preflight',
    'test:nodes:smoke',
    'test:channels:smoke',
    'test:transports:smoke',
    'remote-publish',
  ]);
}

function shouldRouteToGo(tokens: string[]): boolean {
  const goCommands = new Set([
    'recover-sidecars',
    'ops:maintain',
    'maintenance',
  ]);
  return tokens.some((token) => goCommands.has(token));
}

function resolveTone(posture: string | null | undefined): CliVisualPanel['tone'] {
  const normalized = String(posture || '').trim().toLowerCase();
  if (normalized === 'healthy' || normalized === 'stable' || normalized === 'ready') {
    return 'success';
  }
  if (normalized === 'degraded' || normalized === 'critical' || normalized === 'blocked') {
    return 'danger';
  }
  if (normalized === 'attention' || normalized === 'watch') {
    return 'warning';
  }
  return 'neutral';
}

function resolvePosture(cockpit: OperationsCockpitSnapshot): CliOperationsCockpitSnapshot['unified']['posture'] {
  if (cockpit.status === 'healthy') {
    return 'healthy';
  }
  if (cockpit.status === 'degraded') {
    return 'degraded';
  }
  return 'attention';
}

function summarizeMemory(memorySnapshot: any): CliStage25MemorySummary | null {
  if (!memorySnapshot || !memorySnapshot.summary) {
    return null;
  }
  const recentArtifact = memorySnapshot.artifacts?.recent?.[0] || null;
  const suggestedAction = memorySnapshot.suggestedActions?.[0] || null;
  return {
    artifacts: Number(memorySnapshot.summary.artifacts || 0),
    replayTasks: Number(memorySnapshot.summary.replayTasks || 0),
    recentArtifact: recentArtifact?.label ? cleanHumanLine(recentArtifact.label) : null,
    suggestedAction: suggestedAction
      ? {
          label: cleanHumanLine(suggestedAction.label, 'Resume recent work'),
          command: formatHumanCommand(suggestedAction.command),
        }
      : null,
  };
}

function pushAction(
  actions: CliStage25UnifiedAction[],
  candidate: Partial<CliStage25UnifiedAction> | null | undefined,
): void {
  if (!candidate?.label && !candidate?.command) {
    return;
  }
  const command = formatHumanCommand(candidate.command || null);
  const label = cleanHumanLine(candidate.label || 'Open next step');
  const id = candidate.id || `${candidate.source || 'ops'}:${label}:${command}`;
  const key = `${label.toLowerCase()}|${command.toLowerCase()}`;
  if (actions.some((action) => `${action.label.toLowerCase()}|${action.command.toLowerCase()}` === key)) {
    return;
  }
  actions.push({
    id,
    label,
    command,
    reason: cleanHumanLine(candidate.reason || 'Next action recommended by the cockpit.'),
    priority: candidate.priority || 'normal',
    source: candidate.source || 'ops',
  });
}

function buildUnifiedActions(params: {
  cockpit: OperationsCockpitSnapshot;
  status: CliStatusSnapshot | null;
  brief: OperatorBriefSnapshot | null;
  doctor: CliStage25DoctorSnapshot | null;
  memory: CliStage25MemorySummary | null;
  actionDefinitions: Array<{ id: string; label: string; command: string; args?: string[]; priority?: 'high' | 'normal' }>;
}): CliStage25UnifiedAction[] {
  const actions: CliStage25UnifiedAction[] = [];
  pushAction(actions, params.status?.nextAction
    ? {
        id: 'status-next-action',
        label: params.status.nextAction.label,
        command: params.status.nextAction.command,
        reason: params.status.nextAction.reason,
        priority: 'high',
        source: 'status',
      }
    : null);
  pushAction(actions, params.brief?.nextAction
    ? {
        id: 'brief-next-action',
        label: params.brief.nextAction.label,
        command: params.brief.nextAction.command,
        reason: params.brief.nextAction.reason,
        priority: params.brief.posture === 'action-needed' ? 'high' : 'normal',
        source: 'brief',
      }
    : null);
  for (const action of params.cockpit.actions.slice(0, 3)) {
    pushAction(actions, {
      id: action.id,
      label: action.label,
      command: action.command,
      reason: action.reason,
      priority: action.priority,
      source: 'ops',
    });
  }
  for (const step of (params.doctor?.nextSteps || []).slice(0, 2)) {
    pushAction(actions, {
      id: step.id || 'doctor-next-step',
      label: step.title,
      command: step.command || (step.blocking ? 'zavorth go' : 'zavorth doctor'),
      reason: step.description || params.doctor?.summary || 'Doctor recomenda review este ponto.',
      priority: step.blocking ? 'high' : 'normal',
      source: 'doctor',
    });
  }
  if (params.memory?.suggestedAction) {
    pushAction(actions, {
      id: 'memory-suggested-action',
      label: params.memory.suggestedAction.label,
      command: params.memory.suggestedAction.command,
      reason: 'There is recent work that can be resumed.',
      priority: 'normal',
      source: 'memory',
    });
  }
  for (const definition of params.actionDefinitions.slice(0, 4)) {
    pushAction(actions, {
      id: definition.id,
      label: definition.label,
      command: [definition.command, ...(definition.args || [])].filter(Boolean).join(' '),
      reason: 'Action oficial available no catalog operational.',
      priority: definition.priority || 'normal',
      source: 'catalog',
    });
  }
  if (actions.length === 0) {
    pushAction(actions, {
      id: 'open-chat',
      label: 'Start with chat',
      command: 'zavorth chat',
      reason: 'No operational blocker requested immediate action.',
      priority: 'normal',
      source: 'status',
    });
  }
  return actions.slice(0, 5);
}

function buildCards(params: {
  cockpit: OperationsCockpitSnapshot;
  status: CliStatusSnapshot | null;
  brief: OperatorBriefSnapshot | null;
  doctor: CliStage25DoctorSnapshot | null;
  memory: CliStage25MemorySummary | null;
  doctorError: string | null;
}): CliOperationsCockpitCard[] {
  const { cockpit, status, brief, doctor, memory, doctorError } = params;
  const operations = cockpit.operations;
  const sessions = status?.sessions || null;
  const nodes = status?.nodes || null;
  const transports = status?.transports || null;
  const gateway = status?.gateway || null;
  const publish = operations?.publish || null;
  const maintenance = operations?.maintenance || null;
  const automation = operations?.maintenanceAutomation || null;
  const security = (operations?.security || null) as Record<string, any> | null;

  return [
    {
      id: 'state',
      title: 'Current State',
      tone: resolveTone(cockpit.status),
      lines: [
        `- state: ${cockpit.status === 'healthy' ? 'ready' : cockpit.status === 'degraded' ? 'degraded' : 'needs attention'}`,
        `- status: ${compactLine(status?.headline || cockpit.headline)}`,
        `- brief: ${compactLine(brief?.headline || cockpit.highlights[0] || cockpit.headline)}`,
        doctor ? `- doctor: ${compactLine(doctor.summary)}`
          : `- doctor: ${doctorError ? compactLine(doctorError) : 'use zavorth doctor to dig deeper'}`,
      ],
    },
    {
      id: 'operations',
      title: 'Operation',
      tone: resolveTone(cockpit.status),
      lines: [
        `- local components: ${cockpit.summary.readySidecars} of ${cockpit.summary.enabledSidecars} ready`,
        `- recent errors: ${cockpit.summary.recentErrorCount}`,
        `- maintenance: ${automation?.enabled ? 'automation enabled' : maintenance?.available ? 'manual available' : 'no recent snapshot'}`,
        `- publish: ${publish?.available === false ? 'no recent publish' : cockpit.summary.publishAgeLabel || 'not provided'}`,
        `- rollback: ${(publish?.history || []).length > 0 ? 'history available for comparison' : 'no history in the current snapshot'}`,
      ],
    },
    {
      id: 'work',
      title: 'Work and Deliveries',
      tone: sessions?.pendingPermissions ? 'warning' : 'neutral',
      lines: [
        sessions ? `- conversations: ${formatCount(sessions.total, 'session', 'sessions')} | ${formatCount(sessions.pendingPermissions, 'pending permission', 'pending permissions')}`
          : '- conversations: no sessions snapshot',
        memory ? `- replay: ${formatCount(memory.replayTasks, 'task', 'tasks')} | artifacts: ${memory.artifacts}`
          : '- replay: no operational memory snapshot',
        memory?.recentArtifact ? `- recent artifact: ${memory.recentArtifact}`
          : '- recent artifact: none in the current snapshot',
      ],
    },
    {
      id: 'trust',
      title: 'Trust and Access',
      tone: transports?.status === 'failed' || security?.posture === 'critical' ? 'danger' : 'neutral',
      lines: [
        gateway ? `- security: ${cleanHumanLine(gateway.securityPosture)}`
          : security?.posture ? `- security: ${cleanHumanLine(security.posture)}`
            : '- security: not provided',
        transports ? `- remote: ${transports.healthy}/${transports.total} transports ready`
          : '- remote: no eligible transport in snapshot',
        nodes ? `- mesh: ${nodes.online}/${nodes.total} nodes online | queue ${nodes.queued}`
          : '- mesh: without retrato of nodes',
      ],
    },
  ];
}

export async function buildCliOperationsCockpitSnapshot(
  runtime: ZavorthCliRuntime,
  flags: ZavorthCliFlags,
): Promise<CliOperationsCockpitSnapshot | null> {
  const cockpit = readCliCockpitSnapshot(runtime, flags.live);
  if (!cockpit) {
    return null;
  }

  const brief = runtime.operatorBriefService
    ? readCliBriefSnapshot(runtime, flags.live, cockpit)
    : null;
  const status = await buildCliStatusSnapshot(runtime, flags);
  let doctor: CliStage25DoctorSnapshot | null = null;
  let doctorError: string | null = null;

  if (runtime.runtimeAccessReadinessService) {
    try {
      const probeInput = await buildCliRuntimeAccessProbeInput(runtime);
      const report = runtime.runtimeAccessReadinessService.inspect(probeInput);
      doctor = await buildCliOperationsDoctorSnapshot(report, runtime, flags);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Cli Operations] creation failed', error);
    doctorError = errorMessage(error);
  }
  }

  let memory: CliStage25MemorySummary | null = null;
  if (runtime.memoryPlaneService) {
    try {
      memory = summarizeMemory(await runtime.memoryPlaneService.buildSnapshot());
    } catch (error: unknown) {logger.warn('[Zavorth Cli Operations] creation failed', error);
    memory = null;
  }
  }

  const actionDefinitions = runtime.operationsActionService
    ? runtime.operationsActionService.listDefinitions()
    : [];
  const nextActions = buildUnifiedActions({
    cockpit,
    status,
    brief,
    doctor,
    memory,
    actionDefinitions,
  });
  const sourceHealth: CliStage25SourceHealth = {
    status: Boolean(status),
    doctor: Boolean(doctor),
    brief: Boolean(brief),
    ops: Boolean(cockpit),
    memory: Boolean(memory),
    actions: actionDefinitions.length > 0,
  };

  return {
    ...cockpit,
    stage: '25',
    surface: 'zavorth-cockpit',
    unified: {
      headline: cleanHumanLine(status?.headline || brief?.headline || cockpit.headline),
      posture: resolvePosture(cockpit),
      sourceHealth,
      cards: buildCards({
        cockpit,
        status,
        brief,
        doctor,
        memory,
        doctorError,
      }),
      nextActions,
      memory,
      doctorError,
    },
    statusSnapshot: status,
    briefSnapshot: brief,
    doctorSnapshot: doctor,
  };
}

export function formatCliOperationsCockpitSnapshot(snapshot: CliOperationsCockpitSnapshot): string {
  const postureTone = resolveTone(snapshot.unified.posture);
  const panels: CliVisualPanel[] = snapshot.unified.cards.map((card) => ({
    title: card.title,
    lines: card.lines.map((line) => cleanHumanLine(line)),
    tone: card.tone,
  }));

  panels.push({
    title: 'Do Now',
    lines: snapshot.unified.nextActions.slice(0, 3).map((action) =>
      `- ${compactLine(action.label, 72)}: ${formatHumanCommand(action.command)} | reason: ${compactLine(action.reason, 72)}`),
    tone: 'brand',
  });
  panels.push({
    title: 'Snapshot sources',
    lines: [
      `- status: ${snapshot.unified.sourceHealth.status ? 'ok' : 'unavailable'}`,
      `- doctor: ${snapshot.unified.sourceHealth.doctor ? 'ok' : 'unavailable'}`,
      `- brief: ${snapshot.unified.sourceHealth.brief ? 'ok' : 'unavailable'}`,
      `- ops: ${snapshot.unified.sourceHealth.ops ? 'ok' : 'unavailable'}`,
      `- memory: ${snapshot.unified.sourceHealth.memory ? 'ok' : 'unavailable'}`,
      `- actions: ${snapshot.unified.sourceHealth.actions ? 'ok' : 'unavailable'}`,
    ],
    tone: 'muted',
  });

  return renderCliScreen({
    eyebrow: 'Ops',
    eyebrowTone: postureTone,
    title: 'Zavorth operation',
    summary: formatCliValue(snapshot.unified.headline, 'Consolidated operational snapshot for Zavorth.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export type {
  CliOperationsCockpitCard,
  CliStage25MemorySummary,
  CliStage25SourceHealth,
  CliStage25UnifiedAction,
};
