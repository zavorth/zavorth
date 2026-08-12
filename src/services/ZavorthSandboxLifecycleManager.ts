import crypto from 'crypto';
import { spawnSync } from 'child_process';
import {
  ZAVORTH_SANDBOX_LIFECYCLE_CONTRACT_VERSION,
  type ZavorthSandboxLifecycleAction,
  type ZavorthSandboxLifecycleIntent,
  type ZavorthSandboxLifecyclePlan,
  type ZavorthSandboxLifecycleResource,
  type ZavorthSandboxLifecycleReceipt,
  type ZavorthSandboxLifecycleRuntimeId,
  type ZavorthSandboxLifecycleStatus,
} from '../contracts/ZavorthSandboxLifecycleContract.js';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';
import { config } from '../config/index.js';

import type { ZavorthSandboxRuntimeProfile } from './ZavorthSandboxControlPlaneService.js';
import {
  decideSecurityPolicy,
  formatSecurityPolicyReceipt,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';

type DecidePolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  controlPlane?: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
  decidePolicy?: DecidePolicy;
};

export type ZavorthSandboxLifecycleInput = {
  text: string;
  actorId?: string | null;
  sourceSurface?: string | null;
  approvalId?: string | null;
  live?: boolean | null;
  ownedResourceIds?: string[] | null;
};

type IntentAnalysis = {
  intent: ZavorthSandboxLifecycleIntent;
  requestedRuntime: ZavorthSandboxLifecycleRuntimeId;
  confidence: number;
  liveRequested: boolean;
  explicitUserOwnedRuntimeRequest: boolean;
  targetResourceId: string | null;
  reason: string;
};

const RUNTIME_ORDER: ZavorthSandboxLifecycleRuntimeId[] = ['firecracker', 'gvisor', 'docker'];

export class ZavorthSandboxLifecycleManager {
  private readonly now: () => Date;
  private readonly controlPlane: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
  private readonly decidePolicy: DecidePolicy;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.controlPlane = runtime.controlPlane || new ZavorthSandboxControlPlaneService();
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
  }

  public plan(input: ZavorthSandboxLifecycleInput): ZavorthSandboxLifecyclePlan {
    const generatedAt = this.now().toISOString();
    const requestText = normalizeText(input.text);
    const analysis = analyzeIntent(requestText, Boolean(input.live));
    const snapshot = this.controlPlane.buildSnapshot({
      preferredProfile: mapRuntimeToProfile(analysis.requestedRuntime),
      mode: analysis.liveRequested ? 'apply' : 'preview',
      requestedBy: input.actorId || null,
      sourceSurface: input.sourceSurface || 'natural-sandbox-lifecycle',
    });
    const selectedRuntime = this.selectRuntime(analysis.requestedRuntime, snapshot.profiles);
    const profile = this.profileForRuntime(selectedRuntime, snapshot.profiles);
    const ownedResourceIds = normalizeOwnedResources(input.ownedResourceIds);
    const inventory = this.buildInventory({
      selectedRuntime,
      profile,
      analysis,
      ownedResourceIds,
    });
    const status = resolveStatus({
      analysis,
      profile,
      selectedRuntime,
      approvalId: input.approvalId,
      ownedResourceIds,
    });
    const approvalRequired = status === 'approval-required';
    const policy = this.decidePolicy({
      surface: 'workspace',
      operation: 'sandbox-lifecycle',
      target: selectedRuntime,
      sourceTrust: 'trusted',
      risk: approvalRequired ? 'review' : status === 'blocked' ? 'forbidden' : 'safe',
      blocked: status === 'blocked',
      userConfirmationRequired: approvalRequired,
      reasons: [
        analysis.reason,
        'Heavy sandbox runtimes are never started by read/doctor calls.',
        'Zavorth only stops resources it owns.',
      ],
      metadata: {
        intent: analysis.intent,
        requestedRuntime: analysis.requestedRuntime,
        selectedRuntime,
        liveRequested: analysis.liveRequested,
        ownedResourceIds,
        targetResourceId: analysis.targetResourceId,
      },
    }, { now: this.now });
    const actions = this.buildActions({
      analysis,
      selectedRuntime,
      profile,
      status,
      approvalRequired,
      ownedResourceIds,
      targetResourceId: analysis.targetResourceId,
    });
    const notices = buildNotices({
      analysis,
      selectedRuntime,
      profile,
      ownedResourceIds,
      status,
    });

    return {
      generatedAt,
      contractVersion: ZAVORTH_SANDBOX_LIFECYCLE_CONTRACT_VERSION,
      source: 'ZavorthSandboxLifecycleManager',
      requestText,
      actorId: normalizeNullable(input.actorId),
      sourceSurface: normalizeNullable(input.sourceSurface) || 'natural-sandbox-lifecycle',
      status,
      intent: analysis.intent,
      requestedRuntime: analysis.requestedRuntime,
      selectedRuntime,
      targetResourceId: analysis.targetResourceId,
      confidence: analysis.confidence,
      liveRequested: analysis.liveRequested,
      approval: {
        required: approvalRequired,
        reason: approvalRequired ? approvalReason(analysis.intent, selectedRuntime) : null,
        approvalId: normalizeNullable(input.approvalId),
      },
      runtimeState: {
        canRunNow: profile?.canRun === true,
        status: profile?.status || 'unknown',
        detail: profile?.detail || 'Runtime profile was not found in the sandbox control plane.',
        heavyRuntime: profile?.heavyRuntime !== false,
        startsOnRead: false,
      },
      ownership: {
        onlyManageZavorthOwnedResources: true,
        neverStopUserOwnedDaemonByDefault: true,
        ownershipLedgerRequired: true,
        ownedResourceIds,
        explicitUserOwnedRuntimeRequest: analysis.explicitUserOwnedRuntimeRequest,
        explicitResourceTarget: Boolean(analysis.targetResourceId),
        canStopAfterUse: ownedResourceIds.length > 0,
      },
      inventory: {
        readOnly: true,
        resources: inventory,
        canListWithoutStartingRuntime: true,
        nextQuestionHint: 'Choose one resource id/name and ask Zavorth to stop that specific target.',
      },
      notices,
      safety: {
        policyBrokerRequired: true,
        noHiddenDaemonStart: true,
        noUserOwnedDaemonShutdown: true,
        userOwnedDaemonShutdownRequiresExplicitRequestAndApproval: true,
        dryRunWhenStrongSandboxMissing: true,
        cleanupContainersOrVmsOnlyWhenZavorthOwned: true,
        networkDefault: 'none',
      },
      actions,
      receipts: buildReceipts({
        generatedAt,
        analysis,
        policy,
        status,
        selectedRuntime,
        ownedResourceIds,
      }),
      commands: {
        natural: 'npm run zavorth:sandbox-lifecycle -- --text "<request>"',
        naturalJson: 'npm run zavorth:sandbox-lifecycle:json -- --text "<request>"',
        doctor: 'npm run sandbox:doctor',
        check: 'npm run zavorth:sandbox-lifecycle:check --silent',
      },
    };
  }

  public renderPlan(plan: ZavorthSandboxLifecyclePlan): string {
    const lines = [
      'Zavorth Sandbox Lifecycle',
      '',
      `Status: ${plan.status}`,
      `Intent: ${plan.intent}`,
      `Runtime: ${plan.selectedRuntime}`,
      `Ready now: ${plan.runtimeState.canRunNow ? 'yes' : 'no'} (${plan.runtimeState.status})`,
      `Approval: ${plan.approval.required ? plan.approval.reason : 'not required'}`,
      '',
      `Before: ${plan.notices.beforeUse}`,
      `After: ${plan.notices.afterUse}`,
    ];
    if (plan.notices.blocked) {
      lines.push(`Blocked: ${plan.notices.blocked}`);
    }
    lines.push('', 'Actions:');
    for (const action of plan.actions) {
      lines.push(`- ${action.label}: ${action.description}${action.command ? ` (${action.command})` : ''}`);
    }
    lines.push('', 'Safety: Zavorth only stops containers, VMs or workspaces it created and recorded as owned.');
    return lines.join('\n');
  }

  private selectRuntime(
    requested: ZavorthSandboxLifecycleRuntimeId,
    profiles: ZavorthSandboxRuntimeProfile[],
  ): ZavorthSandboxLifecycleRuntimeId {
    if (requested !== 'auto') {
      return requested;
    }
    for (const runtime of RUNTIME_ORDER) {
      const profile = this.profileForRuntime(runtime, profiles);
      if (profile?.canRun) {
        return runtime;
      }
    }
    return 'docker';
  }

  private profileForRuntime(
    runtime: ZavorthSandboxLifecycleRuntimeId,
    profiles: ZavorthSandboxRuntimeProfile[],
  ): ZavorthSandboxRuntimeProfile | null {
    if (runtime === 'auto') {
      return null;
    }
    const profileId = runtime === 'docker' ? 'container' : runtime;
    return profiles.find((entry) => entry.id === profileId) || null;
  }

  private buildActions(input: {
    analysis: IntentAnalysis;
    selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
      profile: ZavorthSandboxRuntimeProfile | null;
      status: ZavorthSandboxLifecycleStatus;
      approvalRequired: boolean;
      ownedResourceIds: string[];
      targetResourceId: string | null;
    }): ZavorthSandboxLifecycleAction[] {
    const actions: ZavorthSandboxLifecycleAction[] = [
      action({
        kind: 'notice',
        runtime: input.selectedRuntime,
        label: 'Small user notice',
        description: `Explain that Zavorth will use ${runtimeLabel(input.selectedRuntime)} only for this task.`,
        canRunNow: true,
      }),
      action({
        kind: 'doctor',
        runtime: input.selectedRuntime,
        label: 'Check sandbox readiness',
        description: 'Read readiness without starting heavy runtimes.',
        command: 'npm run sandbox:doctor',
        canRunNow: true,
      }),
    ];

    if (input.analysis.intent === 'list') {
      actions.push(action({
        kind: 'list_runtime_resources',
        runtime: input.selectedRuntime,
        label: `List ${runtimeLabel(input.selectedRuntime)} resources`,
        description: 'Read runtime/container inventory without starting heavy runtimes or stopping anything.',
        command: input.selectedRuntime === 'docker' || input.selectedRuntime === 'gvisor'
          ? 'docker ps --format ...'
          : 'sandbox lifecycle inventory',
        canRunNow: true,
      }));
    }

    if ((input.analysis.intent === 'start' || input.analysis.intent === 'use') && !input.profile?.canRun) {
      actions.push(action({
        kind: 'start_runtime',
        runtime: input.selectedRuntime,
        label: `Prepare ${runtimeLabel(input.selectedRuntime)}`,
        description: `Start or configure ${runtimeLabel(input.selectedRuntime)} only after explicit approval/configuration.`,
        command: recommendedStartCommand(input.selectedRuntime),
        requiresApproval: true,
        canRunNow: false,
      }));
    }

    if (input.analysis.intent === 'use') {
      actions.push(action({
        kind: 'execute_in_sandbox',
        runtime: input.selectedRuntime,
        label: 'Run task in owned ephemeral sandbox',
        description: input.profile?.canRun ? 'Execute with temp workspace, network none, resource budget and cleanup.'
          : 'Keep the task in preview/dry-run until a strong sandbox is ready.',
        command: input.profile?.canRun ? 'SandboxExecutionService.executeEnvelope(...)' : null,
        requiresApproval: input.approvalRequired,
        canRunNow: input.profile?.canRun === true,
      }));
    }

    if (input.analysis.intent === 'cleanup' || input.analysis.intent === 'stop' || input.analysis.intent === 'use') {
      actions.push(action({
        kind: 'cleanup_owned_resources',
        runtime: input.selectedRuntime,
        label: 'Clean up Zavorth-owned resources',
        description: input.ownedResourceIds.length > 0
          ? `Clean only ${input.ownedResourceIds.join(', ')}.`
          : 'No owned runtime resource was supplied; never stop user-owned Docker/VM daemons by default.',
        command: 'zavorth sandbox lifecycle --cleanup-owned',
        requiresApproval: input.analysis.intent !== 'use',
        canRunNow: input.ownedResourceIds.length > 0,
      }));
    }

    if (
      (input.analysis.intent === 'cleanup' || input.analysis.intent === 'stop')
      && (input.analysis.explicitUserOwnedRuntimeRequest || Boolean(input.targetResourceId))
      && input.ownedResourceIds.length === 0
    ) {
      actions.push(action({
        kind: 'stop_user_runtime',
        runtime: input.selectedRuntime,
        label: `Stop user-owned ${runtimeLabel(input.selectedRuntime)}`,
        description: input.targetResourceId ? `Allowed only for the explicit target ${input.targetResourceId}; requires scoped approval and a host-level receipt.`
          : 'Allowed only because the user explicitly said this runtime was started by them; requires scoped approval and a host-level receipt.',
        command: recommendedStopCommand(input.selectedRuntime),
        requiresApproval: true,
        canRunNow: true,
      }));
    }

    if (input.status === 'approval-required') {
      actions.push(action({
        kind: 'ask_approval',
        runtime: input.selectedRuntime,
        label: 'Ask for scoped approval',
        description: approvalReason(input.analysis.intent, input.selectedRuntime),
        requiresApproval: true,
        canRunNow: true,
      }));
    }

    if (input.status === 'blocked') {
      actions.push(action({
        kind: 'deny',
        runtime: input.selectedRuntime,
        label: 'Block unsafe lifecycle action',
        description: 'The request would affect a runtime not owned by Zavorth or lacks a safe lifecycle path.',
        canRunNow: true,
      }));
    }

    return actions;
  }

  private buildInventory(input: {
    selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
    profile: ZavorthSandboxRuntimeProfile | null;
    analysis: IntentAnalysis;
    ownedResourceIds: string[];
  }): ZavorthSandboxLifecycleResource[] {
    const owned = input.ownedResourceIds.map((id) => resource({
      id,
      runtime: input.selectedRuntime,
      kind: input.selectedRuntime === 'firecracker' ? 'microvm' : 'container',
      label: id,
      status: 'unknown',
      ownedByZavorth: true,
      safeToStopAutomatically: true,
      source: 'ownership-ledger',
      detail: 'Resource id was supplied as Zavorth-owned for this lifecycle turn.',
    }));
    const requested = input.analysis.targetResourceId
      ? [resource({
          id: input.analysis.targetResourceId,
          runtime: input.selectedRuntime,
          kind: input.selectedRuntime === 'firecracker' ? 'microvm' : 'container',
          label: input.analysis.targetResourceId,
          status: 'unknown',
          ownedByZavorth: false,
          safeToStopAutomatically: false,
          source: 'request',
          detail: 'User selected this runtime target explicitly; stopping still requires approval.',
        })]
      : [];
    if (input.analysis.intent !== 'list') {
      return [...owned, ...requested];
    }
    if (input.selectedRuntime === 'docker' || input.selectedRuntime === 'gvisor') {
      return [...owned, ...requested, ...this.listDockerContainers(input.selectedRuntime, input.profile)];
    }
    return [
      ...owned,
      ...requested,
      resource({
        id: `${input.selectedRuntime}:readiness`,
        runtime: input.selectedRuntime,
        kind: input.selectedRuntime === 'firecracker' ? 'microvm' : 'unknown',
        label: runtimeLabel(input.selectedRuntime),
        status: input.profile?.canRun ? 'unknown' : 'unavailable',
        ownedByZavorth: false,
        safeToStopAutomatically: false,
        source: 'readiness',
        detail: input.profile?.detail || 'Runtime inventory is not available on this host.',
      }),
    ];
  }

  private listDockerContainers(
    runtime: ZavorthSandboxLifecycleRuntimeId,
    profile: ZavorthSandboxRuntimeProfile | null,
  ): ZavorthSandboxLifecycleResource[] {
    if (!profile?.canRun) {
      return [resource({
        id: 'docker:unavailable',
        runtime,
        kind: 'daemon',
        label: runtimeLabel(runtime),
        status: 'unavailable',
        ownedByZavorth: false,
        safeToStopAutomatically: false,
        source: 'readiness',
        detail: profile?.detail || 'Docker daemon is not ready; inventory read did not start it.',
      })];
    }
    const result = spawnSync(config.dockerCliPath, [
      'ps',
      '--format',
      '{{.ID}}|{{.Image}}|{{.Names}}|{{.Status}}',
    ], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      return [resource({
        id: 'docker:ps-failed',
        runtime,
        kind: 'daemon',
        label: runtimeLabel(runtime),
        status: 'unavailable',
        ownedByZavorth: false,
        safeToStopAutomatically: false,
        source: 'readiness',
        detail: String(result.stderr || result.error?.message || 'docker ps failed').trim(),
      })];
    }
    return String(result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 50)
      .map((line) => {
        const [id, image, name, status] = line.split('|');
        const ownedByZavorth = `${name} ${image}`.toLowerCase().includes('zavorth');
        return resource({
          id: id || name || 'docker:unknown',
          runtime,
          kind: 'container',
          label: name || id || 'Docker container',
          status: ['up', 'running'].some((token) => String(status || '').toLowerCase().includes(token)) ? 'running' : 'unknown',
          ownedByZavorth,
          safeToStopAutomatically: ownedByZavorth,
          source: 'docker-ps',
          detail: `${image || 'unknown image'} | ${status || 'unknown status'}`,
        });
      });
  }
}

function analyzeIntent(text: string, liveFlag: boolean): IntentAnalysis {
  const runtime = inferRuntime(text);
  const wantsLive = liveFlag;
  const explicitUserOwnedRuntimeRequest = false;
  const targetResourceId = extractTargetResourceId(text);
  if (wantsLive) {
    return base('use', runtime, 0.86, wantsLive, explicitUserOwnedRuntimeRequest, targetResourceId, 'User asked to use a sandbox runtime for work.');
  }
  return base('inspect', runtime, 0.55, false, explicitUserOwnedRuntimeRequest, targetResourceId, 'No mutating lifecycle intent detected.');
}

function base(
  intent: ZavorthSandboxLifecycleIntent,
  requestedRuntime: ZavorthSandboxLifecycleRuntimeId,
  confidence: number,
  liveRequested: boolean,
  explicitUserOwnedRuntimeRequest: boolean,
  targetResourceId: string | null,
  reason: string,
): IntentAnalysis {
  return { intent, requestedRuntime, confidence, liveRequested, explicitUserOwnedRuntimeRequest, targetResourceId, reason };
}

function inferRuntime(text: string): ZavorthSandboxLifecycleRuntimeId {
  void text;
  return 'auto';
}

function resolveStatus(input: {
  analysis: IntentAnalysis;
  profile: ZavorthSandboxRuntimeProfile | null;
  selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
  approvalId?: string | null;
  ownedResourceIds: string[];
}): ZavorthSandboxLifecycleStatus {
  if (input.analysis.intent === 'deny') return 'blocked';
  if (input.analysis.intent === 'inspect') return 'ready';
  if (
    input.analysis.intent === 'cleanup'
    && input.ownedResourceIds.length === 0
    && !input.analysis.explicitUserOwnedRuntimeRequest
    && !input.analysis.targetResourceId
  ) {
    return 'blocked';
  }
  if (!input.approvalId && (input.analysis.intent === 'start' || input.analysis.intent === 'cleanup' || input.analysis.intent === 'stop')) {
    return 'approval-required';
  }
  if (!input.approvalId && input.analysis.intent === 'use' && input.analysis.liveRequested) {
    return 'approval-required';
  }
  if (input.analysis.intent === 'use' && input.profile?.canRun !== true) {
    return 'planned';
  }
  return 'ready';
}

function buildNotices(input: {
  analysis: IntentAnalysis;
  selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
  profile: ZavorthSandboxRuntimeProfile | null;
  ownedResourceIds: string[];
  status: ZavorthSandboxLifecycleStatus;
}): ZavorthSandboxLifecyclePlan['notices'] {
  const runtime = runtimeLabel(input.selectedRuntime);
  const beforeUse = input.analysis.intent === 'use'
    ? `You asked for work that needs isolation, so I will use ${runtime} if it is ready; otherwise I will keep it in preview.`
    : input.analysis.intent === 'start'
      ? `You asked me to prepare ${runtime}; I will ask before starting anything heavy.`
      : input.analysis.intent === 'cleanup'
        ? `You asked me to clean up sandbox resources; I will only touch resources recorded as Zavorth-owned.`
        : `I will check ${runtime} readiness without starting heavy runtimes.`;
  const afterUse = input.ownedResourceIds.length > 0
    ? `I used/checked ${runtime} and cleaned only Zavorth-owned resources: ${input.ownedResourceIds.join(', ')}.`
    : (input.analysis.explicitUserOwnedRuntimeRequest || input.analysis.targetResourceId) && input.analysis.intent === 'cleanup'
      ? `If approved, I will stop only the explicit ${runtime} target${input.analysis.targetResourceId ? ` (${input.analysis.targetResourceId})` : ''} you asked me to stop and record that host-level action.`
    : `If I create containers, VMs or temp workspaces, I will remove only those resources and leave user-owned daemons alone.`;
  const blocked = input.status === 'blocked'
    ? 'This request would require touching resources that are not recorded as Zavorth-owned, so it is blocked.'
    : input.profile?.canRun === false ? `${runtime} is not ready on this host. The task remains preview/dry-run until setup is complete.`
      : null;
  return { beforeUse, afterUse, blocked };
}

function buildReceipts(input: {
  generatedAt: string;
  analysis: IntentAnalysis;
  policy: SecurityPolicyBrokerDecision;
  status: ZavorthSandboxLifecycleStatus;
  selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
  ownedResourceIds: string[];
}): ZavorthSandboxLifecycleReceipt[] {
  const baseId = crypto
    .createHash('sha256')
    .update(`${input.generatedAt}:${input.analysis.intent}:${input.selectedRuntime}`)
    .digest('hex')
    .slice(0, 12);
  return [
    receipt(`sandbox_route_${baseId}`, 'route', input.status === 'blocked' ? 'blocked' : 'done',
      `Routed natural request to ${input.analysis.intent} using ${input.selectedRuntime}.`),
    receipt(`sandbox_policy_${baseId}`, 'policy', input.status === 'approval-required' ? 'approval-required' : input.status === 'blocked' ? 'blocked' : 'done',
      formatSecurityPolicyReceipt(input.policy.receipt)),
    receipt(`sandbox_ownership_${baseId}`, 'ownership', 'done',
      input.ownedResourceIds.length > 0
        ? `Owned resources in scope: ${input.ownedResourceIds.join(', ')}.`
        : input.analysis.explicitUserOwnedRuntimeRequest || input.analysis.targetResourceId ? 'User explicitly requested or selected a runtime lifecycle target; approval is required before touching it.'
        : 'No owned resources supplied; user-owned daemons are out of scope.'),
  ];
}

function receipt(
  id: string,
  kind: ZavorthSandboxLifecycleReceipt['kind'],
  status: ZavorthSandboxLifecycleReceipt['status'],
  reason: string,
): ZavorthSandboxLifecycleReceipt {
  return { id, kind, status, reason, rawSecretSerialized: false };
}

function action(input: Partial<ZavorthSandboxLifecycleAction> & {
  kind: ZavorthSandboxLifecycleAction['kind'];
  runtime: ZavorthSandboxLifecycleRuntimeId;
  label: string;
  description: string;
}): ZavorthSandboxLifecycleAction {
  return {
    id: `${input.kind}:${input.runtime}`,
    kind: input.kind,
    runtime: input.runtime,
    label: input.label,
    description: input.description,
    command: input.command ?? null,
    requiresApproval: input.requiresApproval === true,
    canRunNow: input.canRunNow === true,
    userVisible: input.userVisible !== false,
  };
}

function approvalReason(intent: ZavorthSandboxLifecycleIntent, runtime: ZavorthSandboxLifecycleRuntimeId): string {
  if (intent === 'start') return `Starting ${runtimeLabel(runtime)} is a host lifecycle action and needs scoped approval.`;
  if (intent === 'cleanup' || intent === 'stop') return `Cleanup/stop can only affect Zavorth-owned resources and needs scoped approval.`;
  if (intent === 'use') return `Live sandbox execution needs scoped approval before using ${runtimeLabel(runtime)}.`;
  return 'Policy Broker requires approval for this lifecycle action.';
}

function runtimeLabel(runtime: ZavorthSandboxLifecycleRuntimeId): string {
  if (runtime === 'firecracker') return 'Firecracker';
  if (runtime === 'gvisor') return 'gVisor';
  if (runtime === 'docker') return 'Docker';
  return 'the best available sandbox';
}

function recommendedStartCommand(runtime: ZavorthSandboxLifecycleRuntimeId): string | null {
  if (runtime === 'docker') return 'Start Docker Desktop, then run npm run sandbox:doctor';
  if (runtime === 'gvisor') return 'Configure ZAVORTH_DOCKER_SANDBOX_RUNTIME=runsc, then run npm run sandbox:doctor';
  if (runtime === 'firecracker') return 'Prepare Firecracker/KVM/rootfs, then run npm run sandbox:doctor';
  return 'npm run sandbox:doctor';
}

function recommendedStopCommand(runtime: ZavorthSandboxLifecycleRuntimeId): string | null {
  if (runtime === 'docker') return 'Stop Docker Desktop/daemon only after scoped approval';
  if (runtime === 'gvisor') return 'Stop the approved Docker/runsc workload only after scoped approval';
  if (runtime === 'firecracker') return 'Stop the approved Firecracker VM/process only after scoped approval';
  return 'Stop the approved sandbox runtime target only after scoped approval';
}

function extractTargetResourceId(text: string): string | null {
  void text;
  return null;
}

function resource(input: ZavorthSandboxLifecycleResource): ZavorthSandboxLifecycleResource {
  return input;
}

function mapRuntimeToProfile(runtime: ZavorthSandboxLifecycleRuntimeId): 'auto' | 'container' | 'gvisor' | 'firecracker' {
  if (runtime === 'docker') return 'container';
  if (runtime === 'gvisor' || runtime === 'firecracker') return runtime;
  return 'auto';
}

function normalizeText(value: string): string {
  return String(value || '').trim() || 'sandbox status';
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeOwnedResources(value: string[] | null | undefined): string[] {
  return Array.from(new Set((value || []).map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 20);
}
