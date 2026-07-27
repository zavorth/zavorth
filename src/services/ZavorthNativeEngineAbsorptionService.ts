import {
  ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION,
  type ZavorthErrorRecoveryCategory,
  type ZavorthErrorRecoveryReceipt,
  type ZavorthErrorRecoveryStrategy,
  type ZavorthNativeEngineAbsorptionSnapshot,
  type ZavorthNativeEngineAbsorptionStatus,
  type ZavorthNativeEngineFeatureSpec,
  type ZavorthNativeEngineRisk,
  type ZavorthProceduralMemoryOutcome,
  type ZavorthProceduralMemorySignalReceipt,
  type ZavorthSkillCurationInput,
  type ZavorthSkillCurationPreviewReceipt,
  type ZavorthSkillCurationProposal,
  type ZavorthToolArgumentRepairReceipt,
  type ZavorthToolParallelismReceipt,
  type ZavorthToolParallelismTask,
} from '../contracts/native/ZavorthNativeEngineAbsorptionContract.js';
import type {
  ZavorthExternalContractLayerStatus,
} from '../contracts/ZavorthExternalContractLayerContract.js';

type Runtime = {
  now?: () => Date;
  contractLayerStatus?: ZavorthExternalContractLayerStatus;
};

type SnapshotInput = {
  contractLayerStatus?: ZavorthExternalContractLayerStatus | null;
};

type ErrorRule = {
  category: ZavorthErrorRecoveryCategory;
  strategy: ZavorthErrorRecoveryStrategy;
  risk: ZavorthNativeEngineRisk;
  signal: string;
  pattern: RegExp;
  confidence: number;
  retryAllowed: boolean;
  approvalRequired: boolean;
  summary: string;
  nextSafeAction: string;
};

const FEATURES: ZavorthNativeEngineFeatureSpec[] = [
  feature('error-recovery-classifier', 'ZavorthErrorClassifierContract', 'classifyError', 'governed-execution', 'medium', 'ZavorthErrorRecoveryReceipt', 'Classifies operational failures into retry, approval, repair, context, provider, or diagnostic strategies.'),
  feature('tool-call-argument-repair', 'ZavorthToolCallRepairContract', 'repairToolArguments', 'tool-preview', 'high', 'ZavorthToolArgumentRepairReceipt', 'Repairs only parser-safe malformed arguments and never adds authority or executes tools.'),
  feature('safe-tool-parallelism', 'ZavorthSafeToolParallelismContract', 'planToolParallelism', 'governed-execution', 'medium', 'ZavorthToolParallelismReceipt', 'Parallelizes independent tool tasks while serializing same write sets and unknown resources.'),
  feature('procedural-memory-signal', 'ZavorthProceduralMemoryContract', 'buildProceduralMemorySignal', 'memory-recall', 'medium', 'ZavorthProceduralMemorySignalReceipt', 'Creates provenance-backed procedural memory signals without writing memory directly.'),
  feature('skill-library-curation', 'ZavorthSkillCuratorContract', 'previewSkillCuration', 'approval-proposal', 'critical', 'ZavorthSkillCurationPreviewReceipt', 'Produces skill curation dry-run proposals with approval and rollback required before mutation.'),
];

const ERROR_RULES: ErrorRule[] = [
  errorRule('destructive_intent', 'block_and_require_approval', 'critical', 'destructive_intent', /\b(rm\s+-rf|Remove-Item\b.*-(?:Recurse|Force)|git\s+clean\s+-fd|DROP\s+DATABASE|format\s+[a-z]:)\b/i, 0.94, false, true, 'Potential destructive action detected.', 'Stop and request an explicit Zavorth approval envelope before continuing.'),
  errorRule('credential_or_auth', 'use_secret_ref_or_reauthenticate', 'critical', 'credential_or_auth', /\b(401|403|unauthori[sz]ed|forbidden|API[_-]?KEY|TOKEN|SECRET|Bearer\s+[A-Za-z0-9._~+/-]+=*)\b/i, 0.91, false, true, 'Authentication, authorization, or secret handling failure detected.', 'Use a secret reference, reauthenticate, or rotate credentials without printing secret values.'),
  errorRule('billing_or_quota', 'stop_for_provider_configuration', 'high', 'billing_or_quota', /\b(billing|quota exceeded|insufficient_quota|payment required|credits exhausted)\b/i, 0.9, false, false, 'Provider billing or quota failure detected.', 'Stop provider calls and ask the operator to configure quota or billing.'),
  errorRule('rate_limit', 'retry_with_backoff', 'medium', 'rate_limit', /\b(429|rate limit|too many requests|RESOURCE_EXHAUSTED|throttl(?:ed|ing))\b/i, 0.88, true, false, 'Rate limit or throttling detected.', 'Wait with backoff and retry only inside the configured retry budget.'),
  errorRule('context_overflow', 'compress_or_summarize_context', 'medium', 'context_overflow', /\b(context window|maximum context|context_length_exceeded|token limit|too many tokens)\b/i, 0.86, false, false, 'Context overflow detected.', 'Compress memory/context and continue with a smaller prompt.'),
  errorRule('permission', 'request_operator_approval', 'high', 'permission', /\b(EACCES|EPERM|permission denied|access is denied|operation not permitted)\b/i, 0.85, false, true, 'Permission boundary blocked the action.', 'Ask for operator approval or adjust the workspace permission path.'),
  errorRule('tool_argument_syntax', 'repair_tool_arguments', 'medium', 'tool_argument_syntax', /\b(JSON\.parse|Unexpected token|tool arguments|invalid json|malformed JSON|trailing comma)\b/i, 0.84, false, false, 'Malformed tool argument payload detected.', 'Run parser-first argument repair before any tool preview.'),
  errorRule('typecheck_failure', 'inspect_and_patch_code', 'medium', 'typecheck_failure', /\b(error TS\d+|Type '.*' is not assignable|Cannot find name|tsc\b.*failed)\b/i, 0.82, false, false, 'Typecheck failure detected.', 'Inspect the smallest affected code path and patch through normal code review.'),
  errorRule('test_failure', 'inspect_test_failure', 'medium', 'test_failure', /\b(FAIL|FAILED|AssertionError|expect\(.*\)|Tests?:\s+\d+\s+failed|jest)\b/i, 0.8, false, false, 'Test failure detected.', 'Inspect the failing assertion and repair behavior or expectation deliberately.'),
  errorRule('dependency_failure', 'check_dependency_surface', 'medium', 'dependency_failure', /\b(MODULE_NOT_FOUND|Cannot find module|ERR_MODULE_NOT_FOUND|Could not resolve|missing dependency)\b/i, 0.78, false, false, 'Dependency or module resolution failure detected.', 'Check package metadata and imports before installing anything.'),
  errorRule('port_conflict', 'choose_alternate_port', 'low', 'port_conflict', /\b(EADDRINUSE|address already in use|port\s+\d+\s+is already in use)\b/i, 0.78, true, false, 'Port conflict detected.', 'Choose another local port or stop the existing process with operator visibility.'),
  errorRule('runtime_failure', 'diagnose_with_minimal_context', 'medium', 'runtime_failure', /\b(UnhandledPromiseRejection|Uncaught|TypeError|ReferenceError|SyntaxError|ECONNREFUSED|Command failed|Error:)\b/i, 0.7, false, false, 'Runtime failure detected.', 'Diagnose with the smallest useful logs and avoid blind retries.'),
];

export class ZavorthNativeEngineAbsorptionService {
  private readonly now: () => Date;
  private readonly defaultContractLayerStatus: ZavorthExternalContractLayerStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultContractLayerStatus = runtime.contractLayerStatus || 'contract-layer-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthNativeEngineAbsorptionSnapshot {
    const previousContractLayerStatus = input.contractLayerStatus || this.defaultContractLayerStatus;
    const fixtureReceipts = {
      errorClassifier: this.classifyError({ text: 'HTTP 429 rate limit exceeded while calling provider.' }),
      toolArgumentRepair: this.repairToolArguments({
        toolName: 'workspace.shell.preview',
        rawArguments: '```json\n{"command":"npm test",}\n```',
      }),
      toolParallelism: this.planToolParallelism({
        tasks: [
          task('read-a', 'read_file', 'file', 'src/a.ts', 'read'),
          task('read-b', 'read_file', 'file', 'src/b.ts', 'read'),
          task('write-a', 'apply_patch', 'file', 'src/a.ts', 'write'),
          task('write-a-2', 'format', 'file', 'src/a.ts', 'write'),
        ],
      }),
      proceduralMemory: this.buildProceduralMemorySignal({
        command: 'npm run runtime:check --silent',
        outcome: 'success',
        lesson: 'Runtime typecheck validated the native engine contract after Preview engine changes.',
        evidence: ['tests/services/ZavorthNativeEngineAbsorptionService.test.ts'],
      }),
      skillCuration: this.previewSkillCuration({
        skills: [
          skill('skill-read-file-a', 'read file helper', 'Reads one file from a workspace.', 1, 0, false, ['file', 'read']),
          skill('skill-read-file-b', 'read file helper', 'Reads a file and returns a short summary.', 0, 0, false, ['file', 'read']),
          skill('skill-critical', 'critical operator policy', 'Pinned operator approval policy for risky changes.', 0, 0, true, ['policy']),
          skill('skill-flaky', 'flaky import helper', 'Imports remote code without stable validation.', 2, 5, false, ['import']),
        ],
      }),
    };
    const acceptanceMatrix = buildAcceptanceMatrix(previousContractLayerStatus, fixtureReceipts);
    const status = resolveStatus(previousContractLayerStatus, acceptanceMatrix);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      gate: 'native-engine-absorption',
      previousContractLayerStatus,
      features: FEATURES,
      fixtureReceipts,
      acceptanceMatrix,
      summary: {
        features: FEATURES.length,
        receipts: Object.keys(fixtureReceipts).length,
        approvalGatedFeatures: FEATURES.filter((entry) => entry.risk === 'high' || entry.risk === 'critical').length,
        blockedFixtures: [
          fixtureReceipts.toolArgumentRepair.status,
          fixtureReceipts.toolParallelism.status,
          fixtureReceipts.proceduralMemory.status,
          fixtureReceipts.skillCuration.status,
        ].filter((statusValue) => statusValue === 'blocked').length,
        sourceRuntimeDependency: false,
        executionPerformed: false,
        toolsExecuted: false,
        memoryWritesPerformed: false,
        skillMutationsPerformed: false,
      },
      safety: {
        sourceRuntimeCodeExecuted: false,
        sidecarsStarted: false,
        toolExecutionPerformed: false,
        providerCallsPerformed: false,
        memoryWritesPerformed: false,
        skillMutationsPerformed: false,
        approvalBypassAllowed: false,
      },
      commands: {
        inspect: 'npm run zavorth:native-engine-absorption',
        inspectJson: 'npm run zavorth:native-engine-absorption:json',
        check: 'npm run zavorth:native-engine-absorption:check --silent',
        nextAction: 'Approval gate - Sidecar Adapter',
      },
    };
  }

  public classifyError(input: { text: string }): ZavorthErrorRecoveryReceipt {
    const text = String(input.text || '').trim();
    const matches = ERROR_RULES.filter((rule) => rule.pattern.test(text));
    const primary = matches[0] || errorRule(
      'unknown',
      'diagnose_with_minimal_context',
      'medium',
      'unknown',
      /./,
      0.45,
      false,
      false,
      'Unknown operational failure.',
      'Gather minimal logs and classify again before taking action.',
    );
    return {
      category: primary.category,
      strategy: primary.strategy,
      risk: primary.risk,
      confidence: primary.confidence,
      retryAllowed: primary.retryAllowed,
      approvalRequired: primary.approvalRequired,
      summary: primary.summary,
      signals: Array.from(new Set([primary.signal, ...matches.map((entry) => entry.signal)])),
      nextSafeAction: primary.nextSafeAction,
      safety: {
        noCommandExecution: true,
        noProviderCall: true,
        noAutoApproval: true,
      },
    };
  }

  public repairToolArguments(input: { toolName: string; rawArguments: string }): ZavorthToolArgumentRepairReceipt {
    const rawArguments = String(input.rawArguments || '');
    const repairsApplied: string[] = [];
    const blockedReasons: string[] = [];
    let candidate = rawArguments.trim();

    if (!candidate) {
      blockedReasons.push('empty-arguments');
      return toolRepairReceipt(input.toolName, 'blocked', null, repairsApplied, blockedReasons, false);
    }

    if (/^```/.test(candidate)) {
      candidate = candidate.replace(/^```(?:json|javascript|js)?\s*/i, '').replace(/\s*```$/i, '').trim();
      repairsApplied.push('strip-code-fence');
    }

    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    if ((objectStart > 0 || objectEnd < candidate.length - 1) && objectStart >= 0 && objectEnd > objectStart) {
      candidate = candidate.slice(objectStart, objectEnd + 1);
      repairsApplied.push('extract-json-object');
    }

    const noTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1');
    if (noTrailingCommas !== candidate) {
      candidate = noTrailingCommas;
      repairsApplied.push('remove-trailing-commas');
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      const value = JSON.parse(candidate) as unknown;
      if (!value || Array.isArray(value) || typeof value !== 'object') {
        blockedReasons.push('arguments-must-be-object');
      } else {
        parsed = value as Record<string, unknown>;
      }
    } catch (error: unknown) {blockedReasons.push('json-parse-failed');
    }

    const dangerousIntentDetected = /\b(rm\s+-rf|Remove-Item\b.*-(?:Recurse|Force)|git\s+push|git\s+clean\s+-fd|DROP\s+DATABASE|sudo\b)\b/i.test(rawArguments);
    if (!parsed) {
      return toolRepairReceipt(input.toolName, 'blocked', null, repairsApplied, blockedReasons, dangerousIntentDetected);
    }

    return toolRepairReceipt(
      input.toolName,
      repairsApplied.length > 0 ? 'repaired' : 'valid',
      parsed,
      repairsApplied,
      blockedReasons,
      dangerousIntentDetected,
    );
  }

  public planToolParallelism(input: { tasks: ZavorthToolParallelismTask[] }): ZavorthToolParallelismReceipt {
    const tasks = input.tasks || [];
    const batches: Array<{ taskIds: string[]; tasks: ZavorthToolParallelismTask[] }> = [];
    const conflicts: ZavorthToolParallelismReceipt['conflicts'] = [];

    for (const nextTask of tasks) {
      let placed = false;
      for (const batch of batches) {
        const conflict = batch.tasks.map((existing) => detectConflict(existing, nextTask)).find(Boolean);
        if (!conflict) {
          batch.tasks.push(nextTask);
          batch.taskIds.push(nextTask.id);
          placed = true;
          break;
        }
        conflicts.push(conflict);
      }
      if (!placed) {
        batches.push({ taskIds: [nextTask.id], tasks: [nextTask] });
      }
    }

    return {
      status: tasks.some((entry) => !entry.id || !entry.toolName) ? 'blocked' : 'planned',
      tasks,
      batches: batches.map((batch, index) => ({
        batchId: `batch-${index + 1}`,
        taskIds: batch.taskIds,
        mode: batch.taskIds.length > 1 ? 'parallel' : 'serial',
        reason: batch.taskIds.length > 1 ? 'No resource write conflict detected inside this batch.' : 'Single task or conflict-serialized task.',
      })),
      conflicts,
      safety: {
        unknownResourcesSerialize: true,
        sameWriteSetSerializes: true,
        noToolExecution: true,
      },
    };
  }

  public buildProceduralMemorySignal(input: {
    command: string;
    outcome: ZavorthProceduralMemoryOutcome;
    lesson: string;
    evidence: string[];
  }): ZavorthProceduralMemorySignalReceipt {
    const evidence = (input.evidence || []).filter(Boolean);
    const sanitizedCommand = redactSecrets(input.command || '');
    const lesson = redactSecrets(input.lesson || '').trim();
    if (evidence.length === 0 || !lesson) {
      return {
        status: 'blocked',
        signalId: 'zavorth.procedural-memory.blocked',
        outcome: input.outcome,
        sanitizedCommand,
        lesson,
        evidence,
        shouldStore: false,
        retentionHint: 'short',
        safety: proceduralMemorySafety(),
      };
    }

    return {
      status: 'ready',
      signalId: `zavorth.procedural-memory.${safeId(sanitizedCommand || lesson)}`,
      outcome: input.outcome,
      sanitizedCommand,
      lesson,
      evidence,
      shouldStore: input.outcome !== 'blocked',
      retentionHint: input.outcome === 'workaround' ? 'long' : input.outcome === 'success' ? 'medium' : 'short',
      safety: proceduralMemorySafety(),
    };
  }

  public previewSkillCuration(input: { skills: ZavorthSkillCurationInput[] }): ZavorthSkillCurationPreviewReceipt {
    const skills = input.skills || [];
    if (skills.some((entry) => !entry.id || !entry.filePath)) {
      return {
        status: 'blocked',
        proposals: [],
        pinnedSkillIds: skills.filter((entry) => entry.pinned).map((entry) => entry.id),
        dryRunDiffCount: 0,
        safety: skillCurationSafety(),
      };
    }

    const proposals: ZavorthSkillCurationProposal[] = [];
    const pinnedSkillIds = skills.filter((entry) => entry.pinned).map((entry) => entry.id);

    for (const skillInput of skills) {
      if (skillInput.pinned) {
        proposals.push(proposal('keep', [skillInput.id], 'Pinned skill remains unchanged.', false, false));
        continue;
      }
      if (skillInput.failureCount > Math.max(1, skillInput.usageCount * 2)) {
        proposals.push(proposal('quarantine-review', [skillInput.id], 'Failure count is higher than healthy usage threshold.', true, true));
      } else if (skillInput.usageCount === 0) {
        proposals.push(proposal('archive', [skillInput.id], 'Skill has no recorded usage and is not pinned.', true, true));
      } else if (skillInput.description.trim().length < 48) {
        proposals.push(proposal('extract-reference', [skillInput.id], 'Skill description is too small to justify a standalone skill without more references.', true, true));
      }
    }

    for (const group of duplicateGroups(skills)) {
      proposals.push(proposal('merge', group.map((entry) => entry.id), 'Skills share the same normalized name and can be merged into one umbrella skill.', true, true));
    }

    return {
      status: 'preview-ready',
      proposals,
      pinnedSkillIds,
      dryRunDiffCount: proposals.filter((entry) => entry.approvalRequired).length,
      safety: skillCurationSafety(),
    };
  }

  public formatSnapshotText(snapshot: ZavorthNativeEngineAbsorptionSnapshot): string {
    const lines = [
      'Zavorth Native Engine Absorption - Preview engine',
      '',
      `Status: ${snapshot.status}`,
      `Previous contract layer: ${snapshot.previousContractLayerStatus}`,
      `Features: ${snapshot.summary.features}`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Blocked fixtures: ${snapshot.summary.blockedFixtures}`,
      `Tool execution performed: ${snapshot.safety.toolExecutionPerformed}`,
      `Skill mutations performed: ${snapshot.safety.skillMutationsPerformed}`,
      '',
      'Features:',
      ...snapshot.features.map((entry) => `- ${entry.id}: ${entry.contractName} -> ${entry.serviceMethod}`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextAction}`,
    ];
    return lines.join('\n');
  }
}

function feature(
  id: ZavorthNativeEngineFeatureSpec['id'],
  contractName: string,
  serviceMethod: string,
  naturalFirstRoute: ZavorthNativeEngineFeatureSpec['naturalFirstRoute'],
  risk: ZavorthNativeEngineRisk,
  receiptKind: string,
  acceptanceGate: string,
): ZavorthNativeEngineFeatureSpec {
  return {
    id,
    contractName,
    serviceMethod,
    naturalFirstRoute,
    risk,
    receiptKind,
    acceptanceGate,
    observability: {
      emitsReceipt: true,
      zavorthControlProjection: `ZavorthControl${receiptKind}`,
      noSourceRuntimeDependency: true,
    },
  };
}

function errorRule(
  category: ZavorthErrorRecoveryCategory,
  strategy: ZavorthErrorRecoveryStrategy,
  risk: ZavorthNativeEngineRisk,
  signal: string,
  pattern: RegExp,
  confidence: number,
  retryAllowed: boolean,
  approvalRequired: boolean,
  summary: string,
  nextSafeAction: string,
): ErrorRule {
  return { category, strategy, risk, signal, pattern, confidence, retryAllowed, approvalRequired, summary, nextSafeAction };
}

function toolRepairReceipt(
  toolName: string,
  status: ZavorthToolArgumentRepairReceipt['status'],
  repairedArguments: Record<string, unknown> | null,
  repairsApplied: string[],
  blockedReasons: string[],
  dangerousIntentDetected: boolean,
): ZavorthToolArgumentRepairReceipt {
  return {
    toolName,
    status,
    repairedArguments,
    repairsApplied,
    blockedReasons,
    dangerousIntentDetected,
    approvalRequiredForLive: dangerousIntentDetected,
    parserFirst: true,
    authorityAdded: false,
    safety: {
      noToolExecution: true,
      noApprovalBypass: true,
      noNewAuthorityAdded: true,
    },
  };
}

function task(
  id: string,
  toolName: string,
  kind: ZavorthToolParallelismTask['resourceRefs'][number]['kind'],
  ref: string,
  access: ZavorthToolParallelismTask['resourceRefs'][number]['access'],
): ZavorthToolParallelismTask {
  return { id, toolName, resourceRefs: [{ kind, ref, access }] };
}

function detectConflict(
  left: ZavorthToolParallelismTask,
  right: ZavorthToolParallelismTask,
): ZavorthToolParallelismReceipt['conflicts'][number] | null {
  for (const leftResource of left.resourceRefs) {
    for (const rightResource of right.resourceRefs) {
      const leftRef = normalizeResourceRef(leftResource.ref);
      const rightRef = normalizeResourceRef(rightResource.ref);
      const unknown = leftResource.access === 'unknown' || rightResource.access === 'unknown'
        || leftResource.kind === 'unknown'
        || rightResource.kind === 'unknown';
      const sameRef = leftRef === rightRef;
      const writeConflict = leftResource.access !== 'read' || rightResource.access !== 'read';
      if (unknown || (sameRef && writeConflict)) {
        return {
          leftTaskId: left.id,
          rightTaskId: right.id,
          resourceRef: sameRef ? leftRef : `${leftRef}|${rightRef}`,
          reason: unknown ? 'unknown-resource-serializes' : 'same-resource-write-conflict',
        };
      }
    }
  }
  return null;
}

function buildAcceptanceMatrix(
  previousContractLayerStatus: ZavorthExternalContractLayerStatus,
  fixtureReceipts: ZavorthNativeEngineAbsorptionSnapshot['fixtureReceipts'],
): ZavorthNativeEngineAbsorptionSnapshot['acceptanceMatrix'] {
  const curation = fixtureReceipts.skillCuration;
  return [
    acceptance('contract-layer-ready', previousContractLayerStatus === 'contract-layer-ready', `previousContractLayerStatus=${previousContractLayerStatus}`),
    acceptance('five-native-features-defined', FEATURES.length === 5, `${FEATURES.length}/5 feature(s)`),
    acceptance('error-classifier-strategy-receipt', fixtureReceipts.errorClassifier.category === 'rate_limit' && fixtureReceipts.errorClassifier.strategy === 'retry_with_backoff', `${fixtureReceipts.errorClassifier.category}:${fixtureReceipts.errorClassifier.strategy}`),
    acceptance('tool-repair-parser-first', fixtureReceipts.toolArgumentRepair.status === 'repaired' && fixtureReceipts.toolArgumentRepair.safety.noToolExecution, `${fixtureReceipts.toolArgumentRepair.status}, noToolExecution=${fixtureReceipts.toolArgumentRepair.safety.noToolExecution}`),
    acceptance('safe-parallelism-serializes-conflicts', fixtureReceipts.toolParallelism.batches.length >= 2 && fixtureReceipts.toolParallelism.conflicts.length >= 1, `${fixtureReceipts.toolParallelism.batches.length} batch(es), ${fixtureReceipts.toolParallelism.conflicts.length} conflict(s)`),
    acceptance('procedural-memory-provenance-only', fixtureReceipts.proceduralMemory.status === 'ready' && fixtureReceipts.proceduralMemory.safety.noMemoryWritePerformed, `${fixtureReceipts.proceduralMemory.status}, noMemoryWrite=${fixtureReceipts.proceduralMemory.safety.noMemoryWritePerformed}`),
    acceptance('skill-curator-dry-run-only', curation.status === 'preview-ready' && curation.safety.noSkillMutationPerformed && curation.dryRunDiffCount > 0, `${curation.proposals.length} proposal(s), dryRunDiff=${curation.dryRunDiffCount}`),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthNativeEngineAbsorptionSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousContractLayerStatus: ZavorthExternalContractLayerStatus,
  acceptanceMatrix: ZavorthNativeEngineAbsorptionSnapshot['acceptanceMatrix'],
): ZavorthNativeEngineAbsorptionStatus {
  if (previousContractLayerStatus !== 'contract-layer-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'native-engine-ready';
}

function skill(
  id: string,
  name: string,
  description: string,
  usageCount: number,
  failureCount: number,
  pinned: boolean,
  tags: string[],
): ZavorthSkillCurationInput {
  return {
    id,
    name,
    filePath: `skill-library/${id}/SKILL.md`,
    description,
    usageCount,
    failureCount,
    pinned,
    tags,
  };
}

function proposal(
  action: ZavorthSkillCurationProposal['action'],
  skillIds: string[],
  reason: string,
  approvalRequired: boolean,
  rollbackRequired: boolean,
): ZavorthSkillCurationProposal {
  return {
    proposalId: `zavorth.skill-curation.${action}.${safeId(skillIds.join('-'))}`,
    action,
    skillIds,
    reason,
    approvalRequired,
    rollbackRequired,
  };
}

function duplicateGroups(skills: ZavorthSkillCurationInput[]): ZavorthSkillCurationInput[][] {
  const groups = new Map<string, ZavorthSkillCurationInput[]>();
  for (const skillInput of skills) {
    if (skillInput.pinned) continue;
    const key = safeId(skillInput.name);
    const next = groups.get(key) || [];
    next.push(skillInput);
    groups.set(key, next);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

function proceduralMemorySafety(): ZavorthProceduralMemorySignalReceipt['safety'] {
  return {
    provenanceRequired: true,
    secretValuesRedacted: true,
    noMemoryWritePerformed: true,
    correctOrForgetRequired: true,
  };
}

function skillCurationSafety(): ZavorthSkillCurationPreviewReceipt['safety'] {
  return {
    dryRunOnly: true,
    noSkillMutationPerformed: true,
    approvalRequiredBeforeMutation: true,
    rollbackSnapshotRequired: true,
  };
}

function redactSecrets(value: string): string {
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(/\b(API[_-]?KEY|TOKEN|SECRET|PASSWORD)=\S+/gi, '$1=[REDACTED]');
}

function normalizeResourceRef(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase() || 'unknown';
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}
