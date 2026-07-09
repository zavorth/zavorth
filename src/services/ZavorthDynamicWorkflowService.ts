import { SwarmV2Service } from './SwarmV2Service.js';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ZAVORTH_DYNAMIC_WORKFLOW_CONTRACT_VERSION,
  type ZavorthDynamicWorkflowInput,
  type ZavorthDynamicWorkflowMaterializationResult,
  type ZavorthDynamicWorkflowModelClass,
  type ZavorthDynamicWorkflowSaveResult,
  type ZavorthDynamicWorkflowSnapshot,
  type ZavorthDynamicWorkflowWorkerGroup,
} from '../contracts/ZavorthDynamicWorkflowContract.js';

import { logger } from '../logger.js';

type SwarmLauncher = Pick<SwarmV2Service, 'launchSwarm'>;

export type ZavorthDynamicWorkflowRuntime = {
  now?: () => Date;
  swarmLauncher?: SwarmLauncher;
  storageDir?: string | null;
};

const HARD_MAX_FANOUT = 300;
const HARD_MAX_CONCURRENCY = 30;
const DEFAULT_FANOUT = 12;
const DEFAULT_CONCURRENCY = 6;

export class ZavorthDynamicWorkflowService {
  private readonly now: () => Date;
  private readonly swarmLauncher: SwarmLauncher;
  private readonly storageDir: string;

  public constructor(runtime: ZavorthDynamicWorkflowRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.swarmLauncher = runtime.swarmLauncher || new SwarmV2Service();
    this.storageDir = runtime.storageDir || path.join(process.cwd(), 'data', 'runtime', 'dynamic-workflows');
  }

  public buildPreview(input: ZavorthDynamicWorkflowInput = {}): ZavorthDynamicWorkflowSnapshot {
    const objectivePreview = redactText(clean(input.objective) || 'Dynamic workflow mission');
    const requestedFanout = clampInteger(input.requestedFanout, 1, 10_000, DEFAULT_FANOUT);
    const requestedConcurrency = clampInteger(input.maxConcurrency, 1, 10_000, DEFAULT_CONCURRENCY);
    const effectiveFanout = Math.min(requestedFanout, HARD_MAX_FANOUT);
    const maxConcurrency = Math.min(requestedConcurrency, HARD_MAX_CONCURRENCY, effectiveFanout);
    const workerModelClass = modelClass(input.workerModelClass, 'cheap');
    const synthesisModelClass = modelClass(input.synthesisModelClass, 'premium');
    const maxCents = clampInteger(input.maxCents, 1, 100_000, 50);
    const budget = buildBudget({
      fanout: effectiveFanout,
      maxCents,
      workerModelClass,
      synthesisModelClass,
    });
    const blockedReasons = [
      ...(requestedFanout > HARD_MAX_FANOUT ? ['requested fanout exceeds hard cap'] : []),
      ...(requestedConcurrency > HARD_MAX_CONCURRENCY ? ['requested concurrency exceeds hard cap'] : []),
      ...(budget.estimatedUsd * 100 > maxCents ? ['estimated cost exceeds approved budget'] : []),
    ];
    const approvalReasons = [
      ...(effectiveFanout > 16 ? ['large fanout requested'] : []),
      ...(maxConcurrency > 8 ? ['high concurrency requested'] : []),
      ...(synthesisModelClass === 'premium' ? ['premium synthesis model requested'] : []),
      ...(budget.estimatedUsd * 100 > Math.min(maxCents, 25) ? ['cost preview exceeds quiet lane'] : []),
    ];
    const status = blockedReasons.length > 0
      ? 'blocked'
      : approvalReasons.length > 0
        ? 'needs-approval'
        : 'preview';
    const workflowId = stableId('dynamic-workflow', [
      objectivePreview,
      String(effectiveFanout),
      String(maxConcurrency),
      workerModelClass,
      synthesisModelClass,
      this.now().toISOString(),
    ]);
    const workerGroups = buildWorkerGroups({
      workflowId,
      objectivePreview,
      fanout: effectiveFanout,
      maxConcurrency,
      workerModelClass,
    });

    return {
      contractVersion: ZAVORTH_DYNAMIC_WORKFLOW_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      workflowId,
      status,
      objectivePreview,
      scale: {
        requestedFanout,
        effectiveFanout,
        maxFanout: HARD_MAX_FANOUT,
        requestedConcurrency,
        maxConcurrency,
        hardMaxConcurrency: HARD_MAX_CONCURRENCY,
        batchCount: Math.max(1, Math.ceil(effectiveFanout / Math.max(1, maxConcurrency))),
      },
      routing: {
        workers: {
          modelClass: workerModelClass,
          rationale: workerModelClass === 'cheap'
            ? 'Fanout workers default to cheap models for broad evidence gathering.'
            : 'Worker model class is explicit and budget-gated.',
        },
        synthesis: {
          modelClass: synthesisModelClass,
          rationale: synthesisModelClass === 'premium'
            ? 'Final synthesis uses the strongest approved tier after worker evidence exists.'
            : 'Final synthesis tier is explicit and receipt-backed.',
        },
      },
      budget,
      orchestration: {
        planFormat: 'zavorth-dynamic-workflow-plan/v1',
        arbitraryJavaScriptGenerated: false,
        generatedScript: 'none',
        workerGroups,
        synthesisStage: {
          stageId: `${workflowId}:synthesis`,
          label: 'Final synthesis with receipts',
          modelClass: synthesisModelClass,
          dependsOn: workerGroups.map((group) => group.groupId),
          objective: `Synthesize ${effectiveFanout} worker findings into one answer with evidence and failure cases.`,
          evidenceRequired: true,
        },
        connectedRuntime: {
          swarmV2: true,
          workflowRunService: true,
          receipts: true,
          replay: true,
        },
      },
      materialization: {
        ready: status !== 'blocked',
        target: 'swarm-v2-official',
        launchCommand: status === 'needs-approval'
          ? `zavorth workflows launch ${workflowId} --approval-id ${stableId('approval', [workflowId, approvalReasons.join('|')])}`
          : `zavorth workflows launch ${workflowId}`,
        dryRunOnlyUntilApproval: true,
      },
      approval: {
        required: status === 'needs-approval',
        approvalId: status === 'needs-approval' ? stableId('approval', [workflowId, approvalReasons.join('|')]) : null,
        reasons: approvalReasons,
      },
      blockedReasons,
      safety: {
        noArbitraryCodeExecution: true,
        noImplicitExternalIo: true,
        noSecretSerialization: true,
        budgetHardCapEnforced: true,
        workerMutationRequiresApproval: true,
        synthesisCannotOverridePolicy: true,
      },
      surface: {
        cliCommand: `zavorth workflows "${objectivePreview}" --fanout ${effectiveFanout} --max-concurrency ${maxConcurrency} --worker-model ${workerModelClass} --synthesis-model ${synthesisModelClass} --max-cents ${maxCents}`,
        zavorthControlPath: '/control?sector=workflow',
        receiptPreview: `dynamic-workflow:${workflowId}:fanout=${effectiveFanout}:budget=${maxCents}c`,
      },
    };
  }

  public materializeApprovedWorkflow(
    snapshot: ZavorthDynamicWorkflowSnapshot,
    input: { approvalId?: string | null } = {},
  ): ZavorthDynamicWorkflowMaterializationResult {
    if (snapshot.status === 'blocked' || !snapshot.materialization.ready) {
      return this.blocked(snapshot, 'blocked dynamic workflows cannot be materialized');
    }
    if (snapshot.approval.required && clean(input.approvalId) !== snapshot.approval.approvalId) {
      return this.blocked(snapshot, 'approval required before materializing dynamic workflow');
    }
    const roles = buildSwarmRoles(snapshot);
    let swarmSnapshot: unknown;
    try {
      swarmSnapshot = this.swarmLauncher.launchSwarm({
        swarmId: safeFilePart(snapshot.workflowId),
        objective: snapshot.objectivePreview,
        roles,
        official: true,
        maxRoles: snapshot.scale.effectiveFanout,
        maxConcurrency: snapshot.scale.maxConcurrency,
        batchSize: snapshot.scale.maxConcurrency,
        autoSelectRoles: false,
        tokenBudget: {
          modelClass: snapshot.routing.workers.modelClass,
          maxEstimatedUsd: Number((snapshot.budget.maxCents / 100).toFixed(2)),
          maxEstimatedTokens: snapshot.budget.estimatedTotalTokens,
          maxLlmCalls: snapshot.scale.effectiveFanout + 1,
          approved: true,
        },
      });
    } catch (error: unknown) {logger.warn('[Zavorth Dynamic Workflow] number operation failed', error);
    return this.blocked(snapshot, `swarm launch failed: ${errorMessage(error)}`);
  }

    return {
      status: 'materialized',
      workflowId: snapshot.workflowId,
      receiptId: `dynamic-workflow-receipt:${snapshot.workflowId}`,
      reason: null,
      swarmSnapshot,
      safety: {
        noDirectExecutionAuthority: true,
        approvalRequiredBeforeLaunch: true,
        budgetPassedToSwarm: true,
      },
    };
  }

  public savePreview(snapshot: ZavorthDynamicWorkflowSnapshot): ZavorthDynamicWorkflowSaveResult {
    if (snapshot.status === 'blocked') {
      return {
        status: 'blocked',
        workflowId: snapshot.workflowId,
        path: '',
        receiptId: null,
        reason: 'blocked dynamic workflow previews are not persisted for launch',
        safety: {
          noRawSecretSerialized: true,
          noLaunchPerformed: true,
        },
      };
    }
    fs.mkdirSync(this.storageDir, { recursive: true });
    const filePath = path.join(this.storageDir, `${safeFilePart(snapshot.workflowId)}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(sanitizeSnapshot(snapshot), null, 2)}\n`, 'utf8');
    return {
      status: 'saved',
      workflowId: snapshot.workflowId,
      path: filePath,
      receiptId: `dynamic-workflow-preview:${snapshot.workflowId}`,
      reason: null,
      safety: {
        noRawSecretSerialized: true,
        noLaunchPerformed: true,
      },
    };
  }

  public loadPreview(workflowId: string): ZavorthDynamicWorkflowSnapshot | null {
    const normalizedWorkflowId = clean(workflowId);
    if (!normalizedWorkflowId) return null;
    const filePath = path.join(this.storageDir, `${safeFilePart(normalizedWorkflowId)}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return isDynamicWorkflowSnapshot(parsed) ? parsed : null;
    } catch (error: unknown) {logger.warn('[Zavorth Dynamic Workflow] JSON parse failed', error); return null; }
  }

  public launchSavedWorkflow(
    workflowId: string,
    input: { approvalId?: string | null } = {},
  ): ZavorthDynamicWorkflowMaterializationResult {
    const snapshot = this.loadPreview(workflowId);
    if (!snapshot) {
      return {
        status: 'blocked',
        workflowId: clean(workflowId) || 'unknown',
        receiptId: null,
        reason: 'dynamic workflow preview not found',
        swarmSnapshot: null,
        safety: {
          noDirectExecutionAuthority: true,
          approvalRequiredBeforeLaunch: true,
          budgetPassedToSwarm: true,
        },
      };
    }
    const result = this.materializeApprovedWorkflow(snapshot, input);
    this.saveMaterializationReceipt(result);
    return result;
  }

  public renderText(snapshot: ZavorthDynamicWorkflowSnapshot): string {
    return [
      'Zavorth Dynamic Workflows',
      `status: ${snapshot.status}`,
      `workflow: ${snapshot.workflowId}`,
      `fanout: ${snapshot.scale.effectiveFanout}/${snapshot.scale.maxFanout}`,
      `concurrency: ${snapshot.scale.maxConcurrency}/${snapshot.scale.hardMaxConcurrency}`,
      `models: workers=${snapshot.routing.workers.modelClass} synthesis=${snapshot.routing.synthesis.modelClass}`,
      `budget: ${snapshot.budget.status} estimated=$${snapshot.budget.estimatedUsd.toFixed(4)} max=${snapshot.budget.maxCents}c`,
      `approval: ${snapshot.approval.required ? snapshot.approval.reasons.join(', ') : 'not required'}`,
      `plan: ${snapshot.orchestration.planFormat}; arbitrary-js=${snapshot.orchestration.arbitraryJavaScriptGenerated}`,
      `launch: ${snapshot.materialization.launchCommand}`,
      '',
      'worker groups:',
      ...snapshot.orchestration.workerGroups.map((group) =>
        `- ${group.groupId}: ${group.roleIds.length} worker(s), model=${group.modelClass}, concurrency=${group.maxConcurrency}`,
      ),
    ].join('\n');
  }

  private saveMaterializationReceipt(result: ZavorthDynamicWorkflowMaterializationResult): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    const filePath = path.join(this.storageDir, `${safeFilePart(result.workflowId)}.receipt.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(sanitizeSnapshot(result), null, 2)}\n`, 'utf8');
  }

  private blocked(
    snapshot: ZavorthDynamicWorkflowSnapshot,
    reason: string,
  ): ZavorthDynamicWorkflowMaterializationResult {
    return {
      status: 'blocked',
      workflowId: snapshot.workflowId,
      receiptId: null,
      reason,
      swarmSnapshot: null,
      safety: {
        noDirectExecutionAuthority: true,
        approvalRequiredBeforeLaunch: true,
        budgetPassedToSwarm: true,
      },
    };
  }
}

function buildBudget(input: {
  fanout: number;
  maxCents: number;
  workerModelClass: ZavorthDynamicWorkflowModelClass;
  synthesisModelClass: ZavorthDynamicWorkflowModelClass;
}): ZavorthDynamicWorkflowSnapshot['budget'] {
  const workerInput = input.fanout * 1_200;
  const workerOutput = input.fanout * 900;
  const synthesisInput = Math.max(4_000, input.fanout * 450);
  const synthesisOutput = 4_000;
  const estimatedInputTokens = workerInput + synthesisInput;
  const estimatedOutputTokens = workerOutput + synthesisOutput;
  const workerUsd = estimateUsd(workerInput + workerOutput, input.workerModelClass);
  const synthesisUsd = estimateUsd(synthesisInput + synthesisOutput, input.synthesisModelClass);
  const estimatedUsd = Number((workerUsd + synthesisUsd).toFixed(4));
  const estimatedCents = estimatedUsd * 100;
  return {
    status: estimatedCents > input.maxCents
      ? 'blocked'
      : estimatedCents > Math.min(input.maxCents, 25)
        ? 'approval-required'
        : 'within-budget',
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    estimatedUsd,
    maxCents: input.maxCents,
    approvalRequiredAboveCents: Math.min(input.maxCents, 25),
    stopWhenExceeded: true,
  };
}

function isDynamicWorkflowSnapshot(value: unknown): value is ZavorthDynamicWorkflowSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  const scale = snapshot.scale;
  const materialization = snapshot.materialization;
  const approval = snapshot.approval;
  const routing = snapshot.routing;
  const budget = snapshot.budget;
  const orchestration = snapshot.orchestration;
  const safety = snapshot.safety;
  const surface = snapshot.surface;
  return snapshot.contractVersion === ZAVORTH_DYNAMIC_WORKFLOW_CONTRACT_VERSION
    && typeof snapshot.generatedAt === 'string'
    && typeof snapshot.workflowId === 'string'
    && typeof snapshot.status === 'string'
    && ['preview', 'needs-approval', 'blocked'].includes(snapshot.status)
    && typeof snapshot.objectivePreview === 'string'
    && isRecord(scale)
    && isFiniteNumber(scale.requestedFanout)
    && isFiniteNumber(scale.effectiveFanout)
    && isFiniteNumber(scale.maxConcurrency)
    && isFiniteNumber(scale.requestedConcurrency)
    && isFiniteNumber(scale.batchCount)
    && isRecord(materialization)
    && typeof materialization.ready === 'boolean'
    && typeof materialization.launchCommand === 'string'
    && isRecord(approval)
    && typeof approval.required === 'boolean'
    && (approval.approvalId === null || typeof approval.approvalId === 'string')
    && Array.isArray(approval.reasons)
    && Array.isArray(snapshot.blockedReasons)
    && isRecord(routing)
    && isRecord(routing.workers)
    && isRecord(routing.synthesis)
    && typeof routing.workers.modelClass === 'string'
    && ['cheap', 'standard', 'premium'].includes(routing.workers.modelClass)
    && typeof routing.synthesis.modelClass === 'string'
    && ['cheap', 'standard', 'premium'].includes(routing.synthesis.modelClass)
    && isRecord(budget)
    && isFiniteNumber(budget.maxCents)
    && isFiniteNumber(budget.estimatedTotalTokens)
    && isRecord(orchestration)
    && Array.isArray(orchestration.workerGroups)
    && isRecord(orchestration.synthesisStage)
    && isRecord(safety)
    && safety.noArbitraryCodeExecution === true
    && safety.noSecretSerialization === true
    && isRecord(surface)
    && typeof surface.cliCommand === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

function buildWorkerGroups(input: {
  workflowId: string;
  objectivePreview: string;
  fanout: number;
  maxConcurrency: number;
  workerModelClass: ZavorthDynamicWorkflowModelClass;
}): ZavorthDynamicWorkflowWorkerGroup[] {
  const groupCount = Math.max(1, Math.ceil(input.fanout / Math.max(1, input.maxConcurrency)));
  const groups: ZavorthDynamicWorkflowWorkerGroup[] = [];
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const start = groupIndex * input.maxConcurrency;
    const end = Math.min(input.fanout, start + input.maxConcurrency);
    const roleIds = Array.from({ length: end - start }, (_, offset) => {
      const roleNumber = start + offset + 1;
      return `${input.workflowId}:worker:${String(roleNumber).padStart(3, '0')}`;
    });
    groups.push({
      groupId: `${input.workflowId}:group:${String(groupIndex + 1).padStart(2, '0')}`,
      label: `Worker batch ${groupIndex + 1}`,
      roleIds,
      objective: `Gather independent evidence for: ${input.objectivePreview}`,
      modelClass: input.workerModelClass,
      maxConcurrency: Math.min(input.maxConcurrency, roleIds.length),
      evidenceRequired: true,
    });
  }
  return groups;
}

function buildSwarmRoles(snapshot: ZavorthDynamicWorkflowSnapshot) {
  return snapshot.orchestration.workerGroups.flatMap((group) =>
    group.roleIds.map((roleId) => ({
      id: safeFilePart(roleId),
      label: `Workflow Worker ${roleId.split(':').pop()}`,
      systemPrompt: [
        group.objective,
        `Use model class ${group.modelClass}.`,
        'Return evidence, uncertainty and a concise finding. Do not mutate workspace or send external messages.',
      ].join('\n'),
    })),
  );
}

function estimateUsd(tokens: number, model: ZavorthDynamicWorkflowModelClass): number {
  const perMillion = model === 'cheap' ? 0.25 : model === 'premium' ? 10 : 2.5;
  return (tokens / 1_000_000) * perMillion;
}

function modelClass(value: unknown, fallback: ZavorthDynamicWorkflowModelClass): ZavorthDynamicWorkflowModelClass {
  const normalized = clean(value).toLowerCase();
  return normalized === 'cheap' || normalized === 'standard' || normalized === 'premium'
    ? normalized
    : fallback;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function redactText(value: unknown): string {
  return clean(value)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-key]')
    .replace(/\s+/g, ' ')
    .slice(0, 600);
}

function safeFilePart(value: string): string {
  return clean(value).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'dynamic-workflow';
}

function sanitizeSnapshot<T>(value: T): T {
  if (typeof value === 'string') {
    return redactText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSnapshot(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeSnapshot(entry)]),
    ) as T;
  }
  return value;
}

function stableId(prefix: string, parts: string[]): string {
  const hash = createHash('sha256')
    .update(parts.join('\n'))
    .digest('hex')
    .slice(0, 16);
  return `${prefix}:${hash}`;
}
