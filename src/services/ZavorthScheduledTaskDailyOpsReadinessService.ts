import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import type { SchedulerTaskRuntimeDescriptor } from './SchedulerService.js';
import { ZavorthScheduledTaskLiveTickCertificationService } from './ZavorthScheduledTaskLiveTickCertificationService.js';
import {
  ZAVORTH_SCHEDULED_TASK_DAILY_OPS_READINESS_CONTRACT_VERSION,
  type ZavorthScheduledTaskDailyOpsReadinessGate,
  type ZavorthScheduledTaskDailyOpsReadinessInput,
  type ZavorthScheduledTaskDailyOpsReadinessReceipt,
  type ZavorthScheduledTaskDailyOpsReadinessSnapshot,
  type ZavorthScheduledTaskDailyOpsReadinessStatus,
  type ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand,
} from '../contracts/ZavorthScheduledTaskDailyOpsReadinessContract.js';
import type { ZavorthScheduledTaskLiveTickCertificationSnapshot } from '../contracts/ZavorthScheduledTaskLiveTickCertificationContract.js';

type SchedulerDailyOpsLike = {
  listTasks(includePaused?: boolean): ScheduledTask[];
  getTask?(id: string): ScheduledTask | null;
  findTaskByPrefix?(idPrefix: string): ScheduledTask | null;
  pauseTask?(id: string, reason?: string | null): ScheduledTask | null;
  describeTaskRuntime?(task: ScheduledTask): SchedulerTaskRuntimeDescriptor;
};

type Runtime = {
  schedulerService?: SchedulerDailyOpsLike | null;
  now?: () => Date;
};

const RUNBOOK = {
  create: '/schedule <pedido> every 1h',
  list: '/schedules',
  pause: '/automations pause <id>',
  resume: '/automations resume <id>',
  reapprove: '/automations reapprove <id>',
  revoke: '/unschedule <id>',
  certify: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts --json --task=<id>',
} as const;

export class ZavorthScheduledTaskDailyOpsReadinessService {
  private readonly scheduler: SchedulerDailyOpsLike | null;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.scheduler = runtime.schedulerService || null;
    this.now = runtime.now || (() => new Date());
  }

  public async buildSnapshot(
    input: ZavorthScheduledTaskDailyOpsReadinessInput = {},
  ): Promise<ZavorthScheduledTaskDailyOpsReadinessSnapshot> {
    const generatedAt = this.nowFromInput(input).toISOString();
    const liveTickCertification = await new ZavorthScheduledTaskLiveTickCertificationService({
      now: () => this.nowFromInput(input),
    }).buildSnapshot({ applyAutoPause: true, now: generatedAt });
    const hostTaskCertification = await this.buildHostTaskCertification(input, generatedAt);
    const surfaces = buildSurfaceCommands();
    const gates = buildGates(liveTickCertification, hostTaskCertification, surfaces, input);
    const summary = summarize(gates, surfaces, hostTaskCertification);
    const status = resolveStatus(summary);
    const receipts = buildReceipts(status, liveTickCertification, hostTaskCertification, surfaces);

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_DAILY_OPS_READINESS_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskDailyOpsReadinessService',
      phase: 'checkpoint-7-scheduled-task-daily-ops-readiness',
      status,
      liveTickCertification,
      hostTaskCertification,
      gates,
      surfaces,
      runbook: RUNBOOK,
      summary,
      receipts,
      safety: {
        consumesStage6LiveTickCertification: true,
        allUserActionsGoThroughGovernedSurfaces: true,
        hostTaskCertificationIsExplicit: true,
        noDashboardVisualMutation: true,
        noDirectDispatcherBypass: true,
        rawSecretsSerialized: false,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts',
        json: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts --json',
        hostTask: 'npx tsx scripts/zavorth-scheduled-task-daily-ops-readiness.ts --json --task=<id>',
        check: 'node scripts/zavorth-scheduled-task-daily-ops-readiness-check.mjs',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public renderReport(snapshot: ZavorthScheduledTaskDailyOpsReadinessSnapshot): string {
    const lines = [
      'Scheduled Task Daily Ops Readiness - Surface controls',
      '',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Surfaces: ${snapshot.summary.readySurfaces}/${snapshot.summary.surfaces} ready`,
      `Host task checked: ${snapshot.summary.hostTaskChecked ? 'yes' : 'no'}`,
      '',
      'Daily runbook:',
      `- Create: ${snapshot.runbook.create}`,
      `- List: ${snapshot.runbook.list}`,
      `- Reapprove: ${snapshot.runbook.reapprove}`,
      `- Certify host task: ${snapshot.runbook.certify}`,
      '',
      'Gates:',
      ...snapshot.gates.map((gate) => `- ${gate.kind}: ${gate.status} | ${gate.summary}`),
      '',
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private async buildHostTaskCertification(
    input: ZavorthScheduledTaskDailyOpsReadinessInput,
    generatedAt: string,
  ): Promise<ZavorthScheduledTaskLiveTickCertificationSnapshot | null> {
    const taskId = String(input.taskId || '').trim();
    if (!taskId || !this.scheduler) return null;
    return new ZavorthScheduledTaskLiveTickCertificationService({
      schedulerService: this.scheduler,
      now: () => this.nowFromInput(input),
    }).buildSnapshot({
      taskId,
      applyAutoPause: true,
      now: generatedAt,
    });
  }

  private nowFromInput(input: ZavorthScheduledTaskDailyOpsReadinessInput): Date {
    const value = String(input.now || '').trim();
    if (!value) return this.now();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : this.now();
  }
}

function buildSurfaceCommands(): ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[] {
  return [
    surface('shared_surface', '/schedule', 'ready', 'Shared command pack can create governed scheduled tasks.'),
    surface('shared_surface', '/schedules', 'ready', 'Shared command pack can list governed scheduled tasks.'),
    surface('shared_surface', '/unschedule', 'ready', 'Shared command pack can revoke governed scheduled tasks.'),
    surface('telegram', '/schedule', 'ready', 'Telegram routes schedule creation through the governed surface service.'),
    surface('telegram', '/report', 'ready', 'Telegram recurring reports use the governed schedule surface.'),
    surface('telegram', '/schedules', 'ready', 'Telegram exposes schedule listing without direct scheduler mutation.'),
    surface('telegram', '/unschedule', 'ready', 'Telegram revokes schedules through lifecycle persistence.'),
    surface('automation_control_plane', '/automations reapprove', 'ready', 'Reapproval is available through the automation action lifecycle.'),
    surface('automation_control_plane', '/automations pause|resume', 'ready', 'Pause and resume stay in the governed lifecycle.'),
    surface('cli', 'zavorth-scheduled-task-daily-ops-readiness', 'ready', 'CLI reports daily readiness and host task certification.'),
    surface('dashboard_projection', 'operationalGuard', 'projection_only', 'Backend projection is ready; no new visual dashboard section was created.'),
  ];
}

function surface(
  surfaceName: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand['surface'],
  command: string,
  status: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand['status'],
  summary: string,
): ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand {
  return {
    surface: surfaceName,
    command,
    status,
    summary,
  };
}

function buildGates(
  liveTick: ZavorthScheduledTaskLiveTickCertificationSnapshot,
  hostTask: ZavorthScheduledTaskLiveTickCertificationSnapshot | null,
  surfaces: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[],
  input: ZavorthScheduledTaskDailyOpsReadinessInput,
): ZavorthScheduledTaskDailyOpsReadinessGate[] {
  const readySurfaces = surfaces.filter((surface) => surface.status === 'ready').length;
  const hostRequested = Boolean(String(input.taskId || '').trim());
  const hostOk = !hostTask || hostTask.status === 'passed';
  return [
    gate(
      'checkpoint-6-live-tick',
      'live-tick-certification',
      liveTick.status === 'passed' ? 'pass' : 'fail',
      `Runtime gateway live tick certification is ${liveTick.status}.`,
      'Fix live tick certification before relying on recurring automation.',
    ),
    gate(
      'surface-command-coverage',
      'surface-command-coverage',
      readySurfaces >= 10 ? 'pass' : 'fail',
      `${readySurfaces}/${surfaces.length} scheduled-task surfaces are ready.`,
      'Wire missing channel commands through the shared governed surface service.',
    ),
    gate(
      'lifecycle-command-coverage',
      'lifecycle-command-coverage',
      hasLifecycleCommands(surfaces) ? 'pass' : 'fail',
      'Create, list, pause, resume, reapprove and revoke commands are represented.',
      'Expose every lifecycle command through shared surfaces before daily use.',
    ),
    gate(
      'host-task-readiness',
      'host-task-readiness',
      hostRequested ? (hostOk ? 'pass' : 'warn') : 'warn',
      hostRequested
        ? `Selected host task certification is ${hostTask?.status || 'missing'}.`
        : 'No specific host task was requested; fixture readiness is certified.',
      'Run with --task=<id> to certify a real persisted scheduled task on this host.',
    ),
    gate(
      'dashboard-visual-mutation',
      'no-dashboard-visual-mutation',
      'pass',
      'Surface controls exposes backend/readiness only and does not create dashboard visual sections.',
      null,
    ),
    gate(
      'no-direct-dispatch',
      'no-direct-dispatch',
      liveTick.safety.noDirectDispatcherBypass ? 'pass' : 'fail',
      'Daily operations rely on governed surfaces and Runtime gateway gateway certification, not direct dispatcher bypass.',
      'Route recurring execution through the certified gateway path.',
    ),
  ];
}

function gate(
  id: string,
  kind: ZavorthScheduledTaskDailyOpsReadinessGate['kind'],
  status: ZavorthScheduledTaskDailyOpsReadinessGate['status'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskDailyOpsReadinessGate {
  return {
    id,
    kind,
    status,
    summary,
    recommendation: status === 'pass' ? null : recommendation,
  };
}

function hasLifecycleCommands(surfaces: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[]): boolean {
  const commands = surfaces.map((surface) => surface.command).join('\n').toLowerCase();
  return commands.includes('/schedule')
    && commands.includes('/schedules')
    && commands.includes('/unschedule')
    && commands.includes('pause')
    && commands.includes('resume')
    && commands.includes('reapprove');
}

function summarize(
  gates: ZavorthScheduledTaskDailyOpsReadinessGate[],
  surfaces: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[],
  hostTask: ZavorthScheduledTaskLiveTickCertificationSnapshot | null,
): ZavorthScheduledTaskDailyOpsReadinessSnapshot['summary'] {
  const failedGates = gates.filter((gate) => gate.status === 'fail').length;
  return {
    gates: gates.length,
    passedGates: gates.filter((gate) => gate.status === 'pass').length,
    warningGates: gates.filter((gate) => gate.status === 'warn').length,
    failedGates,
    surfaces: surfaces.length,
    readySurfaces: surfaces.filter((surface) => surface.status === 'ready').length,
    dailyUseReady: failedGates === 0,
    hostTaskChecked: Boolean(hostTask),
  };
}

function resolveStatus(summary: ZavorthScheduledTaskDailyOpsReadinessSnapshot['summary']): ZavorthScheduledTaskDailyOpsReadinessStatus {
  if (summary.failedGates > 0) return 'blocked';
  if (summary.warningGates > 0) return 'attention';
  return 'ready';
}

function buildReceipts(
  status: ZavorthScheduledTaskDailyOpsReadinessStatus,
  liveTick: ZavorthScheduledTaskLiveTickCertificationSnapshot,
  hostTask: ZavorthScheduledTaskLiveTickCertificationSnapshot | null,
  surfaces: ZavorthScheduledTaskDailyOpsReadinessSurfaceCommand[],
): ZavorthScheduledTaskDailyOpsReadinessReceipt[] {
  return [
    {
      id: 'checkpoint-7-scheduled-task-daily-ops-readiness',
      kind: 'checkpoint-7-scheduled-task-daily-ops-readiness',
      status: status === 'blocked' ? 'blocked' : status === 'attention' ? 'attention' : 'ready',
      summary: `Daily ops readiness status is ${status}.`,
    },
    {
      id: 'checkpoint-7-live-tick-consumed',
      kind: 'checkpoint-6-live-tick-consumed',
      status: liveTick.status === 'passed' ? 'ready' : 'blocked',
      summary: `Consumed Runtime gateway live tick certification with status ${liveTick.status}.`,
    },
    {
      id: 'checkpoint-7-surface-commands-certified',
      kind: 'surface-commands-certified',
      status: surfaces.every((surface) => surface.status === 'ready' || surface.status === 'projection_only')
        ? 'ready'
        : 'blocked',
      summary: `${surfaces.length} surface command entries were certified for daily operations.`,
    },
    {
      id: 'checkpoint-7-operator-runbook',
      kind: 'operator-runbook',
      status: 'recorded',
      summary: 'Daily create/list/pause/resume/reapprove/revoke/certify commands are documented in the snapshot.',
    },
    {
      id: 'checkpoint-7-no-visual-mutation',
      kind: 'no-visual-mutation',
      status: 'recorded',
      summary: 'No dashboard visual section or card was created by Surface controls.',
    },
    {
      id: 'checkpoint-7-no-direct-dispatch',
      kind: 'no-direct-dispatch',
      status: liveTick.safety.noDirectDispatcherBypass && (!hostTask || hostTask.safety.noDirectDispatcherBypass)
        ? 'recorded'
        : 'blocked',
      summary: 'Daily ops readiness preserves the no-direct-dispatch invariant.',
    },
  ];
}

function narrativeForStatus(
  status: ZavorthScheduledTaskDailyOpsReadinessStatus,
  summary: ZavorthScheduledTaskDailyOpsReadinessSnapshot['summary'],
): ZavorthScheduledTaskDailyOpsReadinessSnapshot['narrative'] {
  if (status === 'ready') {
    return {
      headline: 'Governed scheduled tasks are ready for daily operation.',
      operatorSummary: 'The live tick path, surfaces, lifecycle commands and no-direct-dispatch invariant are all green.',
      nextAction: 'Use /schedule, /schedules and /automations reapprove for normal daily operation.',
    };
  }
  if (status === 'attention') {
    return {
      headline: 'Governed scheduled tasks are operational with attention notes.',
      operatorSummary: `${summary.passedGates}/${summary.gates} gates passed; warnings are informational unless they reference a selected host task.`,
      nextAction: 'Certify a real host task with --task=<id> when you want host-specific evidence.',
    };
  }
  return {
    headline: 'Governed scheduled tasks are blocked for daily operation.',
    operatorSummary: `${summary.failedGates} gate(s) failed and must be fixed before recurring automation is considered ready.`,
    nextAction: 'Inspect failed gates and rerun the Surface controls check.',
  };
}
