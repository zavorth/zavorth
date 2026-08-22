import {
  ZAVORTH_DYNAMIC_MISSION_HARNESS_VERSION,
  ZAVORTH_MISSION_MANIFEST_VERSION,
  type ZavorthDynamicMissionHarnessInput,
  type ZavorthDynamicMissionHarnessSnapshot,
  type ZavorthMissionTask,
  type ZavorthMissionTaskRole,
} from '../contracts/ZavorthDynamicMissionHarnessContract.js';
import {
  type ZavorthMissionEffect,
  type ZavorthMissionPattern,
} from '../contracts/ZavorthDepthModeContract.js';

import type { WorkflowRunService, WorkflowRunSnapshot, WorkflowStageDefinition } from './WorkflowRunService.js';
import { redactSensitiveText, stableId } from './ZavorthNativeAutonomyShared.js';
import { ZavorthDepthModeService } from './ZavorthDepthModeService.js';

type ZavorthDynamicMissionHarnessDeps = {
  now?: () => Date;
  depthModes?: ZavorthDepthModeService;
};

type MissionMaterializationInput = {
  workspace: string;
  approvalId?: string | null;
  workflowRuns: Pick<WorkflowRunService, 'createRun'>;
};

type MissionMaterializationResult = {
  status: 'materialized' | 'blocked';
  missionId: string;
  run: WorkflowRunSnapshot | null;
  receiptId: string | null;
  reason: string | null;
};

type TaskTemplate = {
  role: ZavorthMissionTaskRole;
  title: string;
  allowedEffects: ZavorthMissionEffect[];
  modelPreference: ZavorthMissionTask['modelPreference'];
  evidenceRequired: boolean;
};

const PATTERN_TASKS: Record<ZavorthMissionPattern, TaskTemplate[]> = {
  'classify-and-act': [
    {
      role: 'classifier',
      title: 'Classify objective, risks and best route',
      allowedEffects: ['read'],
      modelPreference: 'fast',
      evidenceRequired: true,
    },
    {
      role: 'planner',
      title: 'Draft governed action plan',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
  ],
  'fanout-and-synthesize': [
    {
      role: 'researcher',
      title: 'Inspect relevant evidence independently',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
    {
      role: 'reviewer',
      title: 'Review risks, missing tests and user impact',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
    {
      role: 'synthesis-lead',
      title: 'Synthesize worker findings into one operator-ready answer',
      allowedEffects: ['read'],
      modelPreference: 'strong',
      evidenceRequired: true,
    },
  ],
  'adversarial-verification': [
    {
      role: 'adversarial-verifier',
      title: 'Try to falsify the plan and find unsafe assumptions',
      allowedEffects: ['read'],
      modelPreference: 'strong',
      evidenceRequired: true,
    },
    {
      role: 'reviewer',
      title: 'Verify fixes against adversarial findings',
      allowedEffects: ['read'],
      modelPreference: 'strong',
      evidenceRequired: true,
    },
  ],
  'generate-and-filter': [
    {
      role: 'candidate-generator',
      title: 'Generate candidate approaches',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
    {
      role: 'candidate-judge',
      title: 'Filter candidates by safety, value and reversibility',
      allowedEffects: ['read'],
      modelPreference: 'strong',
      evidenceRequired: true,
    },
  ],
  tournament: [
    {
      role: 'candidate-generator',
      title: 'Propose candidate A',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
    {
      role: 'candidate-generator',
      title: 'Propose candidate B',
      allowedEffects: ['read'],
      modelPreference: 'balanced',
      evidenceRequired: true,
    },
    {
      role: 'candidate-judge',
      title: 'Judge candidates with evidence and failure cases',
      allowedEffects: ['read'],
      modelPreference: 'strong',
      evidenceRequired: true,
    },
  ],
  'loop-until-done': [
    {
      role: 'loop-guard',
      title: 'Check if the mission should continue, pause or stop',
      allowedEffects: ['read'],
      modelPreference: 'fast',
      evidenceRequired: true,
    },
  ],
};

const MUTATION_EFFECTS = new Set<ZavorthMissionEffect>(['write', 'shell', 'provider-change']);
new Set<ZavorthMissionEffect>(['network', 'external-send']);

export class ZavorthDynamicMissionHarnessService {
  private readonly now: () => Date;
  private readonly depthModes: ZavorthDepthModeService;

  public constructor(deps: ZavorthDynamicMissionHarnessDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.depthModes = deps.depthModes || new ZavorthDepthModeService({ now: this.now });
  }

  public buildPreview(input: ZavorthDynamicMissionHarnessInput): ZavorthDynamicMissionHarnessSnapshot {
    const requestedEffects = this.normalizeEffects(input.requestedEffects || []);
    const mode = this.depthModes.resolve({
      mode: input.mode,
      objective: input.objective,
      requestedEffects,
    });
    const objectivePreview = redactSensitiveText(input.objective).slice(0, 480);
    const missionId = stableId('mission', [mode.mode, objectivePreview, requestedEffects.join(','), this.now().toISOString()]);
    const patterns = this.resolvePatterns(mode.patterns, input.patternHints || []);
    const blockedReasons = this.findCapViolations(mode.mode, mode.budgets, input.requestedCaps || {});
    const approvalReasons = this.resolveApprovalReasons(mode.mode, requestedEffects, mode.approvals.highCostApprovalRequired);
    const tasks = blockedReasons.length > 0
      ? []
      : this.buildTasks({
          missionId,
          objectivePreview,
          patterns,
          requestedEffects,
          contextArtifacts: input.contextArtifacts || [],
          isolatedWorktreeRequired: mode.budgets.isolatedWorktreeRequired,
          maxAgents: mode.budgets.maxAgents,
        });

    return {
      version: ZAVORTH_DYNAMIC_MISSION_HARNESS_VERSION,
      generatedAt: this.now().toISOString(),
      missionId,
      status: blockedReasons.length > 0 ? 'blocked' : approvalReasons.length > 0 ? 'needs-approval' : 'preview',
      objectivePreview,
      mode,
      workflow: {
        format: ZAVORTH_MISSION_MANIFEST_VERSION,
        execution: 'preview-only',
        patterns,
        tasks,
      },
      budgets: { ...mode.budgets },
      approval: {
        required: approvalReasons.length > 0,
        approvalId: approvalReasons.length > 0 ? stableId('approval', [missionId, approvalReasons.join('|')]) : null,
        reasons: approvalReasons,
      },
      resume: {
        durableQueue: 'workflow-run-service',
        resumable: true,
        checkpointIds: tasks.map((task) => task.checkpointId),
      },
      blockedReasons,
      safety: {
        previewOnly: true,
        noArbitraryCodeExecution: true,
        secretsRedacted: true,
        externalIoRequiresApproval: true,
        mutationRequiresApproval: true,
        depthCapsEnforced: true,
        rawSecretsSerialized: false,
      },
    };
  }

  public materializeApprovedMission(
    snapshot: ZavorthDynamicMissionHarnessSnapshot,
    input: MissionMaterializationInput,
  ): MissionMaterializationResult {
    if (snapshot.status === 'blocked') {
      return {
        status: 'blocked',
        missionId: snapshot.missionId,
        run: null,
        receiptId: null,
        reason: 'blocked mission previews cannot be materialized',
      };
    }

    if (snapshot.approval.required && !input.approvalId) {
      return {
        status: 'blocked',
        missionId: snapshot.missionId,
        run: null,
        receiptId: null,
        reason: 'approval required before materializing mission workflow',
      };
    }

    const phases: WorkflowStageDefinition[] = snapshot.workflow.tasks.map((task) => ({
      id: task.taskId,
      executor: 'codex',
      role: task.role,
      label: task.title,
      intro: 'Previewed mission worker task.',
      strategy_note: `${task.checkpointId}; effects=${task.allowedEffects.join(',')}; isolation=${task.worktreeIsolation}`,
      writeScope: null,
      buildObjective: () => task.prompt,
    }));
    const run = input.workflowRuns.createRun(
      'research',
      snapshot.objectivePreview,
      redactSensitiveText(input.workspace),
      phases,
      {
        profile_summary: `Dynamic mission ${snapshot.mode.mode}.`,
        operational_summary: `${snapshot.workflow.tasks.length} pending preview task(s), no worker executed during materialization.`,
        profile_notes: [
          `budget agents=${snapshot.budgets.maxAgents}`,
          `checkpointEvery=${snapshot.budgets.checkpointEveryMinutes}m`,
        ],
        operational_notes: [
          'Mission materialization creates pending workflow phases only.',
          'Worker execution remains governed by the normal approval and effect boundary.',
        ],
        active_focus: {
          summary: snapshot.objectivePreview,
          executor: null,
          status: 'pending',
        },
        recent_artifact: null,
        continuity_recommendation: {
          label: 'Resume mission from first pending phase',
          reason: 'Mission preview was materialized into a durable run.',
          executor: 'codex',
        },
      },
      {
        origin: {
          route_strategy: 'dynamic-mission-harness',
          route_source: snapshot.missionId,
        },
        trigger: {
          task_kind: 'mission',
          task_subtype: snapshot.mode.mode,
          feature_id: 'dynamic-mission-harness',
        },
      },
    );

    return {
      status: 'materialized',
      missionId: snapshot.missionId,
      run,
      receiptId: stableId('receipt', [snapshot.missionId, input.approvalId || 'quiet-materialization', run.workflow_run_id]),
      reason: null,
    };
  }

  private resolvePatterns(basePatterns: ZavorthMissionPattern[], hints: ZavorthMissionPattern[]): ZavorthMissionPattern[] {
    const patterns = [...basePatterns, ...hints].filter((pattern) => Object.prototype.hasOwnProperty.call(PATTERN_TASKS, pattern));
    return Array.from(new Set(patterns));
  }

  private normalizeEffects(effects: ZavorthMissionEffect[]): ZavorthMissionEffect[] {
    const allowed = new Set<ZavorthMissionEffect>(['read', 'write', 'shell', 'network', 'external-send', 'provider-change']);
    return Array.from(new Set(effects.filter((effect) => allowed.has(effect))));
  }

  private findCapViolations(
    mode: string,
    hardCaps: ZavorthDynamicMissionHarnessSnapshot['budgets'],
    requestedCaps: NonNullable<ZavorthDynamicMissionHarnessInput['requestedCaps']>,
  ): string[] {
    const violations: string[] = [];
    const checks: Array<keyof NonNullable<ZavorthDynamicMissionHarnessInput['requestedCaps']>> = [
      'maxAgents',
      'maxDepth',
      'maxTokens',
      'maxCostUsd',
      'maxDurationMinutes',
    ];

    for (const key of checks) {
      const requested = requestedCaps[key];
      const hardCap = hardCaps[key];
      if (typeof requested === 'number' && requested > hardCap) {
        violations.push(`requested ${key} exceeds ${mode} hard cap`);
      }
    }

    return violations;
  }

  private resolveApprovalReasons(mode: string, effects: ZavorthMissionEffect[], highCost: boolean): string[] {
    const reasons: string[] = [];
    const effectSet = new Set(effects);
    if (effects.some((effect) => MUTATION_EFFECTS.has(effect))) {
      reasons.push('mutation requested');
    }
    if (effectSet.has('network') || effectSet.has('external-send')) {
      reasons.push(effectSet.has('external-send') ? 'external send requested' : 'external network requested');
    }
    if (effectSet.has('shell')) {
      reasons.push('shell requested');
    }
    if (highCost) {
      reasons.push(`${mode} mode has elevated budget`);
    }
    return Array.from(new Set(reasons));
  }

  private buildTasks(input: {
    missionId: string;
    objectivePreview: string;
    patterns: ZavorthMissionPattern[];
    requestedEffects: ZavorthMissionEffect[];
    contextArtifacts: string[];
    isolatedWorktreeRequired: boolean;
    maxAgents: number;
  }): ZavorthMissionTask[] {
    const context = input.contextArtifacts
      .map((artifact) => redactSensitiveText(artifact).trim())
      .filter(Boolean)
      .slice(0, 12)
      .join(', ');
    const tasks: ZavorthMissionTask[] = [];

    for (const pattern of input.patterns) {
      for (const template of PATTERN_TASKS[pattern]) {
        if (tasks.length >= input.maxAgents) {
          break;
        }
        const taskId = stableId('task', [input.missionId, pattern, template.role, template.title, tasks.length]);
        const previousTaskIds = tasks.map((task) => task.taskId);
        const dependsOn = template.role === 'synthesis-lead' || template.role === 'candidate-judge' || template.role === 'loop-guard'
          ? previousTaskIds
          : [];
        tasks.push({
          taskId,
          role: template.role,
          title: template.title,
          prompt: this.buildTaskPrompt(template.title, input.objectivePreview, pattern, context),
          allowedEffects: [...template.allowedEffects],
          dependsOn,
          checkpointId: stableId('checkpoint', [input.missionId, taskId]),
          worktreeIsolation: input.isolatedWorktreeRequired ? 'required' : 'recommended',
          modelPreference: template.modelPreference,
          evidenceRequired: template.evidenceRequired,
        });
      }
    }

    if (!tasks.some((task) => task.role === 'synthesis-lead') && tasks.length < input.maxAgents) {
      const taskId = stableId('task', [input.missionId, 'synthesis-fallback']);
      tasks.push({
        taskId,
        role: 'synthesis-lead',
        title: 'Final synthesis with receipts',
        prompt: this.buildTaskPrompt('Final synthesis with receipts', input.objectivePreview, 'fanout-and-synthesize', context),
        allowedEffects: ['read'],
        dependsOn: tasks.map((task) => task.taskId),
        checkpointId: stableId('checkpoint', [input.missionId, taskId]),
        worktreeIsolation: input.isolatedWorktreeRequired ? 'required' : 'recommended',
        modelPreference: 'strong',
        evidenceRequired: true,
      });
    }

    return tasks;
  }

  private buildTaskPrompt(title: string, objectivePreview: string, pattern: ZavorthMissionPattern, context: string): string {
    const contextLine = context ? ` Context artifacts: ${context}.` : '';
    return redactSensitiveText(`${title}. Pattern: ${pattern}. Objective: ${objectivePreview}.${contextLine} Return evidence, risks and next action only.`);
  }
}
