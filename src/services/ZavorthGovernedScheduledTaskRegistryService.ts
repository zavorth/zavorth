import {
  ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL,
  ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION,
  type ZavorthScheduledTaskApprovalEnvelope,
  type ZavorthScheduledTaskApprovalVerification,
  type ZavorthScheduledTaskBudget,
  type ZavorthScheduledTaskCheck,
  type ZavorthScheduledTaskInput,
  type ZavorthScheduledTaskReceipt,
  type ZavorthScheduledTaskRegistrationPlan,
  type ZavorthScheduledTaskRenewalPolicy,
  type ZavorthScheduledTaskSchedule,
  type ZavorthScheduledTaskScope,
  type ZavorthScheduledTaskSnapshot,
  type ZavorthScheduledTaskStatus,
} from '../contracts/ZavorthScheduledTaskContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import {
  createToolSecurityApprovalEnvelope,
  verifyToolSecurityApprovalEnvelope,
  type ToolSecurityApprovalEnvelope,
} from '../security/ToolApprovalEnvelope.js';
import {
  nextRunFromNaturalSchedule,
  parseNaturalSchedule,
} from './scheduling/NaturalScheduleParser.js';

type Runtime = {
  now?: () => Date;
  cwd?: () => string;
};

type NormalizedInput = {
  intent: string;
  command: string;
  scheduleRaw: string;
  workspace: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  createdBy: string;
  allowedTools: string[];
  budget: ZavorthScheduledTaskBudget;
  requireApproval: boolean;
  killSwitchEnabled: boolean;
  noCompound: boolean;
  renewalPolicy: ZavorthScheduledTaskRenewalPolicy;
  approval: NonNullable<ZavorthScheduledTaskInput['approval']>;
};

const DEFAULT_INTENT = 'Generate a recurring operational workspace summary.';
const DEFAULT_SCHEDULE = '{"kind":"calendar_day","targetHour":9,"targetMinute":0}';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RUNTIME_MS = 15 * 60 * 1000;
const MAX_TOKENS = 200000;
const MAX_TOOL_CALLS = 60;
const MAX_NETWORK_REQUESTS = 20;
const MAX_COMMANDS = 10;
const MAX_MUTATIONS = 25;
const MAX_RETRIES = 3;
const MIN_INTERVAL_MS = 60 * 1000;
const MAX_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const SCHEDULING_TOOL_CAPABILITIES = new Set([
  'scheduler.create',
  'scheduler.register',
  'scheduled_task.create',
  'scheduled_task.register',
  'cron.create',
]);

export class ZavorthGovernedScheduledTaskRegistryService {
  private readonly now: () => Date;
  private readonly cwd: () => string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.cwd = runtime.cwd || (() => process.cwd());
  }

  public buildSnapshot(input: ZavorthScheduledTaskInput = {}): ZavorthScheduledTaskSnapshot {
    const generatedAt = this.now().toISOString();
    const normalized = this.normalizeInput(input);
    const schedule = parseSchedule(normalized.scheduleRaw, this.now());
    const scope = buildScope(normalized);
    const approvalArgs = buildApprovalArgs(scope, normalized.budget, schedule, normalized.renewalPolicy);
    const approvalEnvelope = resolveApprovalEnvelope(normalized, approvalArgs, this.now());
    const approvalVerification = verifyApprovalEnvelope(approvalEnvelope, approvalArgs, this.now());
    const noCompoundBlocked = normalized.noCompound && detectsCompoundScheduling(scope);
    const budgetBlocked = exceedsBudgetCeiling(normalized.budget);
    const checks = buildChecks({
      schedule,
      approvalVerification,
      requireApproval: normalized.requireApproval,
      noCompoundBlocked,
      killSwitchEnabled: normalized.killSwitchEnabled,
      budgetBlocked,
    });
    const status = resolveStatus({
      schedule,
      approvalVerification,
      requireApproval: normalized.requireApproval,
      noCompoundBlocked,
      killSwitchEnabled: normalized.killSwitchEnabled,
      budgetBlocked,
    });
    const registration = buildRegistrationPlan(status, normalized, schedule);
    const receipts = buildReceipts(status, approvalEnvelope, approvalVerification, registration, noCompoundBlocked, budgetBlocked);
    const summary = summarize(checks, status, approvalVerification, registration, normalized.killSwitchEnabled, noCompoundBlocked);

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_CONTRACT_VERSION,
      source: 'ZavorthGovernedScheduledTaskRegistryService',
      gate: 'governed-scheduled-task-contract',
      status,
      schedule,
      scope,
      budget: normalized.budget,
      renewalPolicy: normalized.renewalPolicy,
      approvalEnvelope,
      approvalVerification,
      checks,
      registration,
      receipts,
      safety: {
        preApprovedScopeOnly: true,
        noCompoundScheduling: true,
        globalKillSwitchHonored: true,
        approvalTtlRequired: true,
        budgetBoundariesRequired: true,
        noImplicitExecution: true,
        noZavorthControlVisualMutation: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts',
        json: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts --json',
        approvedPreview: 'npx tsx scripts/zavorth-governed-scheduled-tasks.ts --json --owner-confirmed --approval=schedule-owner-ok',
        check: 'node scripts/zavorth-governed-scheduled-tasks-check.mjs',
      },
      narrative: narrativeForStatus(status, summary, normalized.renewalPolicy),
    };
  }

  public formatSnapshotText(snapshot: ZavorthScheduledTaskSnapshot): string {
    const lines = [
      'Zavorth Governed Scheduled Task Registry - Intent model',
      '',
      `Status: ${snapshot.status}`,
      `Schedule: ${snapshot.schedule?.normalized || 'invalid'}`,
      `Intent: ${snapshot.scope.intent}`,
      `Workspace: ${snapshot.scope.workspace}`,
      `Approval: ${snapshot.approvalVerification.reason}`,
      `Registration ready: ${snapshot.summary.registrationReady}`,
      `Execution performed: ${snapshot.summary.executionPerformed}`,
      '',
      'Checks:',
      ...snapshot.checks.map((check) => `- ${check.kind}: ${check.status} | ${check.summary}`),
      '',
      snapshot.narrative.operatorSummary,
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private normalizeInput(input: ZavorthScheduledTaskInput): NormalizedInput {
    const intent = clean(input.intent) || DEFAULT_INTENT;
    const command = clean(input.command) || intent;
    const workspace = clean(input.workspace) || this.cwd();
    const surface = normalizeSurface(input.surface);
    const createdBy = clean(input.createdBy) || 'owner';
    const allowedTools = normalizeAllowedTools(input.allowedTools);
    const budget = normalizeBudget(input.budget);
    const approval = input.approval || {};
    return {
      intent,
      command,
      scheduleRaw: clean(input.schedule) || DEFAULT_SCHEDULE,
      workspace,
      surface,
      createdBy,
      allowedTools,
      budget,
      requireApproval: input.policy?.requireApproval !== false,
      killSwitchEnabled: input.policy?.killSwitchEnabled === true,
      noCompound: input.policy?.noCompound !== false,
      renewalPolicy: normalizeRenewalPolicy(input.policy?.renewalPolicy),
      approval,
    };
  }
}

function parseSchedule(rawValue: string, now: Date): ZavorthScheduledTaskSchedule | null {
  const raw = rawValue.trim();
  const natural = parseNaturalSchedule(raw, now);
  if (!natural) return null;

  let kind: ZavorthScheduledTaskSchedule['kind'];
  if (natural.kind === 'interval') {
    const intervalMs = Number(natural.intervalMs || 0);
    kind = intervalMs > 0 && intervalMs % (60 * 60 * 1000) === 0 ? 'interval_hours' : 'interval_minutes';
  } else if (natural.kind === 'calendar_day') {
    kind = 'daily';
  } else if (natural.kind === 'calendar_week') {
    kind = 'weekly';
  } else {
    kind = 'cron';
  }

  const next = nextRunFromNaturalSchedule(natural, now);
  const intervalMs = natural.intervalMs;
  if (
    kind === 'interval_minutes' || kind === 'interval_hours'
  ) {
    if (
      !intervalMs
      || !Number.isFinite(intervalMs)
      || intervalMs < MIN_INTERVAL_MS
      || intervalMs > MAX_INTERVAL_MS
    ) {
      return null;
    }
  }

  return {
    raw,
    normalized: natural.normalized,
    kind,
    intervalMs: intervalMs ?? (kind === 'daily' ? 24 * 60 * 60 * 1000 : kind === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 60_000),
    localTime: natural.localTime,
    nextRunPreview: next ? next.toISOString() : new Date(now.getTime() + 60_000).toISOString(),
  };
}

function buildScope(input: NormalizedInput): ZavorthScheduledTaskScope {
  return {
    intent: redact(input.intent),
    command: redact(input.command),
    workspace: input.workspace,
    surface: input.surface,
    createdBy: input.createdBy,
    allowedTools: [...input.allowedTools].sort(),
    maxMutations: input.budget.maxMutations,
    maxCommands: input.budget.maxCommands,
    maxNetworkRequests: input.budget.maxNetworkRequests,
    maxTokens: input.budget.maxTokens,
  };
}

function buildApprovalArgs(
  scope: ZavorthScheduledTaskScope,
  budget: ZavorthScheduledTaskBudget,
  schedule: ZavorthScheduledTaskSchedule | null,
  renewalPolicy: ZavorthScheduledTaskRenewalPolicy,
): Record<string, unknown> {
  return {
    scope,
    budget,
    schedule: schedule ? {
      normalized: schedule.normalized,
      kind: schedule.kind,
      intervalMs: schedule.intervalMs,
      localTime: schedule.localTime,
    } : null,
    renewalPolicy,
  };
}

function resolveApprovalEnvelope(
  input: NormalizedInput,
  approvalArgs: Record<string, unknown>,
  now: Date,
): ZavorthScheduledTaskApprovalEnvelope | null {
  if (input.approval.envelope) return input.approval.envelope;
  if (input.approval.ownerConfirmed !== true && !clean(input.approval.approvalId)) return null;
  const ttlMs = clamp(input.approval.ttlMs, 1, MAX_TTL_MS, DEFAULT_TTL_MS);
  return createToolSecurityApprovalEnvelope({
    toolName: ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL,
    args: approvalArgs,
    approvalId: input.approval.approvalId || 'scheduled-task-owner-approval',
    approvedBy: input.approval.approvedBy || input.createdBy,
    ttlMs,
    now,
  }) as ZavorthScheduledTaskApprovalEnvelope;
}

function verifyApprovalEnvelope(
  envelope: ZavorthScheduledTaskApprovalEnvelope | null,
  approvalArgs: Record<string, unknown>,
  now: Date,
): ZavorthScheduledTaskApprovalVerification {
  if (!envelope) return { ok: false, reason: 'missing-approval-envelope' };
  return verifyToolSecurityApprovalEnvelope({
    toolName: ZAVORTH_SCHEDULED_TASK_APPROVAL_TOOL,
    args: approvalArgs,
    envelope: envelope as ToolSecurityApprovalEnvelope,
    now,
  });
}

function buildChecks(input: {
  schedule: ZavorthScheduledTaskSchedule | null;
  approvalVerification: ZavorthScheduledTaskApprovalVerification;
  requireApproval: boolean;
  noCompoundBlocked: boolean;
  killSwitchEnabled: boolean;
  budgetBlocked: boolean;
}): ZavorthScheduledTaskCheck[] {
  return [
    check(
      'schedule-parse',
      Boolean(input.schedule),
      'schedule-parse',
      input.schedule ? `Schedule normalized as ${input.schedule.normalized}.` : 'Schedule could not be normalized.',
      'Use a canonical JSON schedule generated by the schedule resolver.',
    ),
    check(
      'scope-boundary',
      true,
      'scope-boundary',
      'Intent, workspace, surface, tools and budget are captured in the approval scope.',
      null,
    ),
    input.requireApproval
      ? check(
        'approval-envelope',
        input.approvalVerification.ok,
        'approval-envelope',
        `Approval verification: ${input.approvalVerification.reason}.`,
        'Ask the owner to approve the recurring scope again.',
      )
      : warn(
        'approval-envelope',
        true,
        'approval-envelope',
        'Approval is not required by policy for this preview.',
        null,
      ),
    check(
      'budget-boundary',
      !input.budgetBlocked,
      'budget-boundary',
      input.budgetBlocked ? 'Budget exceeds the governed ceiling.' : 'Budgets fit within the governed ceiling.',
      'Lower token, tool, network, command, mutation, retry, or runtime limits.',
    ),
    check(
      'no-compound',
      !input.noCompoundBlocked,
      'no-compound',
      input.noCompoundBlocked ? 'The scheduled task appears able to create another scheduled task.' : 'No compound scheduling intent detected.',
      'Remove scheduling-management instructions from the recurring task.',
    ),
    check(
      'kill-switch',
      !input.killSwitchEnabled,
      'kill-switch',
      input.killSwitchEnabled ? 'Global scheduled-task kill switch is enabled.' : 'Global scheduled-task kill switch is clear.',
      'Disable the kill switch before registering recurring work.',
    ),
    check(
      'scheduler-adapter',
      Boolean(input.schedule),
      'scheduler-adapter',
      input.schedule ? 'Registration plan is compatible with SchedulerService.scheduleTask().' : 'Scheduler adapter cannot accept an invalid schedule.',
      'Normalize the schedule before registration.',
    ),
    check(
      'no-execution',
      true,
      'no-execution',
      'Intent model registers governed scope only; no scheduled tick is executed here.',
      null,
    ),
  ];
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthScheduledTaskCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskCheck {
  return {
    id,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function warn(
  id: string,
  passed: boolean,
  kind: ZavorthScheduledTaskCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskCheck {
  return {
    id,
    status: passed ? 'pass' : 'warn',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function resolveStatus(input: {
  schedule: ZavorthScheduledTaskSchedule | null;
  approvalVerification: ZavorthScheduledTaskApprovalVerification;
  requireApproval: boolean;
  noCompoundBlocked: boolean;
  killSwitchEnabled: boolean;
  budgetBlocked: boolean;
}): ZavorthScheduledTaskStatus {
  if (!input.schedule || input.noCompoundBlocked || input.killSwitchEnabled || input.budgetBlocked) return 'blocked';
  if (!input.requireApproval) return 'active';
  if (input.approvalVerification.reason === 'approval-expired') return 'expired';
  if (!input.approvalVerification.ok) return 'needs_reapproval';
  return 'active';
}

function buildRegistrationPlan(
  status: ZavorthScheduledTaskStatus,
  input: NormalizedInput,
  schedule: ZavorthScheduledTaskSchedule | null,
): ZavorthScheduledTaskRegistrationPlan {
  return {
    recorded: status === 'active',
    schedulerServiceCompatible: Boolean(schedule),
    schedulerCommand: input.command,
    schedulerSchedule: schedule?.normalized || input.scheduleRaw,
    schedulerUserId: input.createdBy,
    schedulerOptions: {
      intentText: input.intent,
      delivery: deliveryForSurface(input.surface),
      budget: {
        maxRuntimeMs: input.budget.maxRuntimeMs,
        retries: input.budget.maxRetries,
        maxConcurrentRuns: 1,
        maxPerTaskConcurrentRuns: 1,
      },
    },
    executionPerformed: false,
    persistedToScheduler: false,
    nextAction: 'gate-2-execution-gateway-integration',
  };
}

function buildReceipts(
  status: ZavorthScheduledTaskStatus,
  envelope: ZavorthScheduledTaskApprovalEnvelope | null,
  verification: ZavorthScheduledTaskApprovalVerification,
  registration: ZavorthScheduledTaskRegistrationPlan,
  noCompoundBlocked: boolean,
  budgetBlocked: boolean,
): ZavorthScheduledTaskReceipt[] {
  return [
    {
      id: 'gate-1-governed-scheduled-task-contract',
      kind: 'gate-1-governed-scheduled-task-contract',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: `Governed scheduled-task status is ${status}.`,
    },
    {
      id: envelope?.approvalId || 'gate-1-scope-envelope',
      kind: 'scope-envelope',
      status: verification.ok ? 'ready' : 'requires-approval',
      summary: verification.ok ? `Scope envelope verified until ${envelope?.expiresAt || 'manual revocation'}.`
        : `Scope envelope not ready: ${verification.reason}.`,
    },
    {
      id: 'gate-1-registration-preview',
      kind: 'registration-preview',
      status: registration.recorded ? 'ready' : 'skipped',
      summary: registration.recorded ? 'SchedulerService registration payload is ready, but not persisted by Intent model.'
        : 'Registration payload is held until policy gates pass.',
    },
    {
      id: 'gate-1-policy-boundary',
      kind: 'policy-boundary',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: 'Recurring work is constrained to the approved scope, workspace, surface and budgets.',
    },
    {
      id: 'gate-1-no-compound-boundary',
      kind: 'no-compound-boundary',
      status: noCompoundBlocked ? 'blocked' : 'recorded',
      summary: noCompoundBlocked ? 'Compound scheduling was blocked.' : 'Compound scheduling boundary is clear.',
    },
    {
      id: 'gate-1-budget-boundary',
      kind: 'budget-boundary',
      status: budgetBlocked ? 'blocked' : 'recorded',
      summary: budgetBlocked ? 'Budget ceiling blocked registration.' : 'Budget ceiling accepted registration.',
    },
    {
      id: 'gate-1-scheduler-adapter',
      kind: 'scheduler-adapter',
      status: registration.schedulerServiceCompatible ? 'recorded' : 'blocked',
      summary: registration.schedulerServiceCompatible ? 'Payload is compatible with the existing SchedulerService adapter.'
        : 'Payload cannot be adapted to SchedulerService.',
    },
    {
      id: 'gate-1-execution-boundary',
      kind: 'execution-boundary',
      status: 'recorded',
      summary: 'No recurring tick, tool call, network request, command or workspace mutation is executed in Intent model.',
    },
  ];
}

function summarize(
  checks: ZavorthScheduledTaskCheck[],
  status: ZavorthScheduledTaskStatus,
  approvalVerification: ZavorthScheduledTaskApprovalVerification,
  registration: ZavorthScheduledTaskRegistrationPlan,
  killSwitchEnabled: boolean,
  noCompoundBlocked: boolean,
): ZavorthScheduledTaskSnapshot['summary'] {
  return {
    checks: checks.length,
    passedChecks: checks.filter((item) => item.status === 'pass').length,
    warningChecks: checks.filter((item) => item.status === 'warn').length,
    failedChecks: checks.filter((item) => item.status === 'fail').length,
    approvalVerified: approvalVerification.ok,
    registrationReady: registration.recorded && status === 'active',
    blockedByKillSwitch: killSwitchEnabled,
    blockedByNoCompound: noCompoundBlocked,
    expiredApproval: status === 'expired',
    executionPerformed: false,
  };
}

function narrativeForStatus(
  status: ZavorthScheduledTaskStatus,
  summary: ZavorthScheduledTaskSnapshot['summary'],
  renewalPolicy: ZavorthScheduledTaskRenewalPolicy,
): ZavorthScheduledTaskSnapshot['narrative'] {
  if (status === 'active') {
    return {
      headline: 'Governed scheduled task is ready for registry handoff.',
      operatorSummary: 'The recurring task has a verified pre-approved scope, bounded budgets and a SchedulerService-compatible registration payload.',
      nextAction: 'Preview engine should connect this registration plan to ExecutionGateway ticks without expanding the approved scope.',
    };
  }
  if (status === 'needs_reapproval') {
    return {
      headline: 'Owner re-approval is required before recurring work can be registered.',
      operatorSummary: 'The schedule and budget can be previewed, but the signed scope envelope is missing or invalid.',
      nextAction: `Ask the owner to approve the exact scope again; renewal policy is ${renewalPolicy}.`,
    };
  }
  if (status === 'expired') {
    return {
      headline: 'The scheduled-task approval envelope expired.',
      operatorSummary: 'The previous approval can no longer authorize recurring work.',
      nextAction: 'Generate a fresh approval envelope before registry handoff.',
    };
  }
  return {
    headline: 'Governed scheduled task is blocked by policy.',
    operatorSummary: `Registration is blocked; failed checks=${summary.failedChecks}, killSwitch=${summary.blockedByKillSwitch}, noCompound=${summary.blockedByNoCompound}.`,
    nextAction: 'Fix the failing policy checks before continuing.',
  };
}

function normalizeBudget(input: Partial<ZavorthScheduledTaskBudget> | null | undefined): ZavorthScheduledTaskBudget {
  return {
    maxRuntimeMs: positiveInt(input?.maxRuntimeMs, 5 * 60 * 1000),
    maxTokens: positiveInt(input?.maxTokens, 50000),
    maxToolCalls: positiveInt(input?.maxToolCalls, 20),
    maxNetworkRequests: positiveInt(input?.maxNetworkRequests, 5),
    maxCommands: positiveInt(input?.maxCommands, 2),
    maxMutations: positiveInt(input?.maxMutations, 0),
    maxRetries: nonNegativeInt(input?.maxRetries, 1),
  };
}

function exceedsBudgetCeiling(budget: ZavorthScheduledTaskBudget): boolean {
  return budget.maxRuntimeMs > MAX_RUNTIME_MS
    || budget.maxTokens > MAX_TOKENS
    || budget.maxToolCalls > MAX_TOOL_CALLS
    || budget.maxNetworkRequests > MAX_NETWORK_REQUESTS
    || budget.maxCommands > MAX_COMMANDS
    || budget.maxMutations > MAX_MUTATIONS
    || budget.maxRetries > MAX_RETRIES;
}

function detectsCompoundScheduling(scope: ZavorthScheduledTaskScope): boolean {
  return scope.allowedTools.some((tool) => SCHEDULING_TOOL_CAPABILITIES.has(tool));
}

function normalizeAllowedTools(input: string[] | null | undefined): string[] {
  const values = (input || [])
    .map((item) => clean(item).toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
  return values.slice(0, 40);
}

function normalizeSurface(value: unknown): ZavorthCrossSurfaceProjectionSurface {
  const normalized = clean(value).toLowerCase();
  const allowed = new Set<ZavorthCrossSurfaceProjectionSurface>([
    'cli',
    'telegram',
    'discord',
    'whatsapp',
    'signal',
    'imessage',
    'web',
    'api',
    'command_center',
  ]);
  return allowed.has(normalized as ZavorthCrossSurfaceProjectionSurface)
    ? normalized as ZavorthCrossSurfaceProjectionSurface
    : 'cli';
}

function normalizeRenewalPolicy(value: unknown): ZavorthScheduledTaskRenewalPolicy {
  if (value === 'expire_and_notify' || value === 'auto_renew_disabled' || value === 'require_reapproval') return value;
  return 'require_reapproval';
}

function deliveryForSurface(surface: ZavorthCrossSurfaceProjectionSurface): 'telegram' | 'web' | 'cli' | 'api' | null {
  if (surface === 'telegram') return 'telegram';
  if (surface === 'web' || surface === 'command_center') return 'web';
  if (surface === 'api') return 'api';
  if (surface === 'cli') return 'cli';
  return null;
}

function positiveInt(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : fallback;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function redact(value: string): string {
  return value
    .replace(/(?:sk|pk|ghp|xox[baprs]|ya29|AIza)[A-Za-z0-9_\-]{12,}/g, '[REDACTED_TOKEN]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
}
