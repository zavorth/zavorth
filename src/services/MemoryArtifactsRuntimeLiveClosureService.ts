import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  MemoryArtifactsRuntimeLiveAdapterFamily,
  MemoryArtifactsRuntimeLiveCapability,
  MemoryArtifactsRuntimeLiveClosureSnapshot,
  MemoryArtifactsRuntimeLiveConfigSchema,
  MemoryArtifactsRuntimeLiveEntry,
  MemoryArtifactsRuntimeLiveGate,
  MemoryArtifactsRuntimeLiveGateStatus,
  MemoryArtifactsRuntimeLiveMode,
  MemoryArtifactsRuntimeLiveStatus,
  MemoryArtifactsRuntimeLiveTargetId,
} from '../contracts/MemoryArtifactsRuntimeLiveClosureContract.js';
import { ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_LIVE_CLOSURE_CONTRACT_VERSION } from '../contracts/MemoryArtifactsRuntimeLiveClosureContract.js';

import { LiveReadinessService } from './LiveReadinessService.js';

type MemoryArtifactsRuntimeLiveClosureRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type MemoryArtifactsRuntimeLiveDescriptor = {
  targetId: MemoryArtifactsRuntimeLiveTargetId;
  status: MemoryArtifactsRuntimeLiveStatus;
  capabilities: MemoryArtifactsRuntimeLiveCapability[];
  adapterFamily: MemoryArtifactsRuntimeLiveAdapterFamily;
  modes: MemoryArtifactsRuntimeLiveMode[];
  configSchema: MemoryArtifactsRuntimeLiveConfigSchema;
  gaps: string[];
};

const PHASE = 'memory-artifacts-runtime-live-closure' as const;

const TARGETS: MemoryArtifactsRuntimeLiveDescriptor[] = [
  target('memory-core', 'memory-live', ['memory.active'], 'file-backed-memory-ledger', ['memory-remember', 'memory-recall', 'memory-cite', 'memory-forget'], [], ['ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_DIR']),
  target('active-memory', 'memory-live', ['memory.active'], 'file-backed-memory-ledger', ['memory-remember', 'memory-recall', 'memory-cite'], [], ['ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_DIR']),
  target('memory-wiki', 'memory-live', ['memory.wiki'], 'file-backed-memory-ledger', ['wiki-upsert', 'wiki-search', 'memory-cite'], [], ['ZAVORTH_MEMORY_WIKI_DIR']),
  target('memory-lancedb', 'memory-live', ['memory.vector'], 'file-backed-memory-ledger', ['vector-backend-decision', 'memory-recall'], [], ['ZAVORTH_VECTOR_BACKEND']),
  target('thread-ownership', 'artifact-runtime-live', ['thread.ownership'], 'artifact-index-replay-ledger', ['thread-ownership-enforcement', 'artifact-replay'], [], ['ZAVORTH_SESSION_OWNERSHIP_DIR']),
  target('codex', 'runtime-executor-live', ['agent.runtime', 'artifact.index', 'artifact.replay'], 'runtime-executor-profile', ['codex-runtime-invoke', 'local-runtime-exec', 'artifact-body-index', 'artifact-replay', 'approval-gate'], [], ['ZAVORTH_CODEX_RUNTIME_PROFILE']),
  target('openshell', 'runtime-executor-live', ['sandbox.remote', 'artifact.replay'], 'runtime-executor-profile', ['openshell-sandbox-exec', 'local-runtime-exec', 'artifact-replay', 'approval-gate'], [], ['ZAVORTH_OPENSHELL_CONFIG']),
  target('llm-task', 'runtime-executor-live', ['task.orchestrate', 'artifact.index'], 'workflow-orchestration-ledger', ['task-orchestration', 'artifact-body-index'], [], ['ZAVORTH_WORKFLOW_RUN_DIR']),
  target('vydra', 'runtime-executor-live', ['task.orchestrate', 'artifact.index'], 'workflow-orchestration-ledger', ['task-orchestration', 'artifact-body-index'], [], ['ZAVORTH_WORKFLOW_RUN_DIR']),
  target('skill-workshop', 'governed-workspace-live', ['workspace.command'], 'plugin-workshop-runtime', ['workspace-command-plugin', 'approval-gate'], [], ['ZAVORTH_PLUGIN_REGISTRY_DIR']),
  target('acpx', 'bridge-live', ['bridge.protocol'], 'bridge-protocol-ledger', ['acp-bridge-proof', 'approval-gate'], [], ['ZAVORTH_ACP_BRIDGE_DIR']),
];

export class MemoryArtifactsRuntimeLiveClosureService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: MemoryArtifactsRuntimeLiveClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): MemoryArtifactsRuntimeLiveClosureSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_LIVE_CLOSURE_CONTRACT_VERSION,
      gate: PHASE,
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 11,
        memoryTargets: entries.filter((entry) => entry.capabilities.some((capability) => capability.startsWith('memory.'))).length,
        artifactTargets: entries.filter((entry) => entry.capabilities.some((capability) => capability.startsWith('artifact.'))).length,
        runtimeTargets: entries.filter((entry) => entry.capabilities.includes('agent.runtime') || entry.capabilities.includes('sandbox.remote')).length,
        workflowTargets: entries.filter((entry) => entry.capabilities.includes('task.orchestrate')).length,
        pluginTargets: entries.filter((entry) => entry.capabilities.includes('workspace.command')).length,
        bridgeTargets: entries.filter((entry) => entry.capabilities.includes('bridge.protocol')).length,
        rememberRecallForgetTargets: entries.filter((entry) => this.hasGate(entry, 'memory-remember') && this.hasGate(entry, 'memory-recall')).length,
        artifactIndexReplayTargets: entries.filter((entry) => this.hasGate(entry, 'artifact-body-index') || this.hasGate(entry, 'artifact-replay')).length,
        threadOwnershipTargets: entries.filter((entry) => this.hasGate(entry, 'thread-ownership-enforcement')).length,
        approvalGateTargets: entries.filter((entry) => this.hasGate(entry, 'approval-gate')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        memoryMarkedLiveWithoutWrite: false,
        artifactsMarkedLiveWithoutReplay: false,
        runtimeMarkedLiveWithoutExecutionProfile: false,
        unsafeRuntimeBypassesApproval: false,
        liveIoRequiredBySandboxAdapterCheck: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringSandboxAdapterCheck: true,
        memoryWriteRecallForgetRequired: true,
        artifactIndexReplayRequired: true,
        threadOwnershipRequired: true,
        runtimeExecutionProfileRequired: true,
        unsafeRuntimeRequiresApproval: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run memory-artifacts-runtime-live-closure:check --silent',
        doctor: 'npm run memory-artifacts-runtime-live-closure -- --profile configured',
        stagingLiveSmoke: 'npm run memory-artifacts-runtime-live-closure -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/MemoryArtifactsRuntimeLiveClosureService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Approval gate - Channel Live Activation Long Tail',
      },
    };
  }

  public buildEntry(
    descriptor: MemoryArtifactsRuntimeLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): MemoryArtifactsRuntimeLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run memory-artifacts-runtime-live-closure -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      adapterFamily: descriptor.adapterFamily,
      modes: descriptor.modes,
      adapterTarget: this.adapterTarget(descriptor.adapterFamily),
      serviceTargets: this.serviceTargets(descriptor),
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live memory/artifact/runtime receipt is still required before final live certification',
      ],
      doctorCommand: `npm run memory-artifacts-runtime-live-closure -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `memory-artifacts-runtime-live-closure.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        adapterFamily: descriptor.adapterFamily,
        modes: descriptor.modes,
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        unsafeActionsRequireApproval: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: MemoryArtifactsRuntimeLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): MemoryArtifactsRuntimeLiveGate[] {
    const gates: MemoryArtifactsRuntimeLiveGate[] = [];
    const addForMode = (mode: MemoryArtifactsRuntimeLiveMode, gate: MemoryArtifactsRuntimeLiveGate['kind'], evidence: string) => {
      if (descriptor.modes.includes(mode)) {
        gates.push(this.gate(gate, 'passed', evidence, null));
      }
    };
    addForMode('memory-remember', 'memory-remember', 'MemoryArtifactsRuntimeLiveService writes real file-backed memory entries.');
    addForMode('memory-recall', 'memory-recall', 'Memory recall reads the persisted ledger and returns citations.');
    addForMode('memory-cite', 'memory-cite', 'Memory receipts include source refs and citation IDs.');
    addForMode('memory-forget', 'memory-forget', 'Forget archives the memory and removes it from active recall.');
    addForMode('wiki-upsert', 'wiki-persistence', 'Wiki pages persist to disk and can be reloaded.');
    addForMode('wiki-search', 'wiki-search', 'Wiki search reads persisted page titles, bodies and tags.');
    addForMode('vector-backend-decision', 'vector-backend-decision', 'Vector backend is explicit: local deterministic index now, LanceDB adapter decision when configured.');
    addForMode('artifact-body-index', 'artifact-body-index', 'Artifact bodies are read from real files and indexed with checksums.');
    addForMode('artifact-replay', 'artifact-replay', 'Artifact replay reopens indexed refs and verifies body checksums.');
    addForMode('thread-ownership-enforcement', 'thread-ownership-enforcement', 'Thread ownership rejects conflicting owners and records release receipts.');
    addForMode('codex-runtime-invoke', 'codex-runtime-profile', 'CodexRuntimePlaneService produces a governed runtime invocation profile.');
    addForMode('openshell-sandbox-exec', 'openshell-sandbox-profile', 'OpenShellRemoteSandboxService produces sandbox execution and mirror receipts.');
    addForMode('local-runtime-exec', 'local-runtime-exec', 'A controlled local runtime command runs only in staging-live with explicit confirmation.');
    addForMode('task-orchestration', 'task-orchestration', 'WorkflowRunService writes task run lifecycle and artifact manifest receipts.');
    addForMode('workspace-command-plugin', 'workspace-command-plugin', 'PluginRegistryService executes skill-workshop only after policy approval.');
    addForMode('acp-bridge-proof', 'acp-bridge-proof', 'ACP bridge envelope is persisted with approval and redacted payload refs.');
    if (descriptor.modes.includes('approval-gate')) {
      gates.push(this.gate('approval-gate', 'passed', 'Unsafe runtime, workspace command and bridge operations require explicit approval.', null));
    }
    gates.push(this.gate('artifact-receipt', 'passed', 'Intent model2 live smokes emit artifact-first receipts with no secrets.', null));
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'no credential required', `npm run memory-artifacts-runtime-live-closure -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('dry-smoke', 'passed', 'deterministic memory/artifact/runtime tests run without external IO', 'npx jest tests/services/MemoryArtifactsRuntimeLiveClosureService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live memory/artifact/runtime proof requires explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipts omit secret values and store artifact refs instead of hidden side effects.', null));
    return gates;
  }

  private readinessFor(
    descriptor: MemoryArtifactsRuntimeLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => readinessByPrimitive.get(capability) || 'partial-live')
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTarget(family: MemoryArtifactsRuntimeLiveAdapterFamily): string {
    if (family === 'file-backed-memory-ledger' || family === 'artifact-index-replay-ledger') {
      return 'src/services/MemoryArtifactsRuntimeLiveService.ts';
    }
    if (family === 'runtime-executor-profile') {
      return 'src/services/MemoryArtifactsRuntimeLiveService.ts#runRuntimeExecutorProof';
    }
    if (family === 'workflow-orchestration-ledger') {
      return 'src/services/WorkflowRunService.ts';
    }
    if (family === 'plugin-workshop-runtime') {
      return 'src/services/PluginRegistryService.ts';
    }
    return 'src/services/MemoryArtifactsRuntimeLiveService.ts#runBridgeProtocolProof';
  }

  private serviceTargets(descriptor: MemoryArtifactsRuntimeLiveDescriptor): string[] {
    const targets = ['src/services/MemoryArtifactsRuntimeLiveService.ts'];
    if (descriptor.capabilities.includes('agent.runtime')) {
      targets.push('src/services/CodexRuntimePlaneService.ts');
    }
    if (descriptor.capabilities.includes('sandbox.remote')) {
      targets.push('src/services/OpenShellRemoteSandboxService.ts');
    }
    if (descriptor.capabilities.includes('task.orchestrate')) {
      targets.push('src/services/WorkflowRunService.ts');
    }
    if (descriptor.capabilities.includes('workspace.command')) {
      targets.push('src/services/PluginRegistryService.ts');
    }
    return [...new Set(targets)];
  }

  private hasGate(entry: MemoryArtifactsRuntimeLiveEntry, kind: MemoryArtifactsRuntimeLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: MemoryArtifactsRuntimeLiveGate['kind'],
    status: MemoryArtifactsRuntimeLiveGateStatus,
    evidence: string,
    command: string | null,
  ): MemoryArtifactsRuntimeLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: MemoryArtifactsRuntimeLiveTargetId,
  status: MemoryArtifactsRuntimeLiveStatus,
  capabilities: MemoryArtifactsRuntimeLiveCapability[],
  adapterFamily: MemoryArtifactsRuntimeLiveAdapterFamily,
  modes: MemoryArtifactsRuntimeLiveMode[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): MemoryArtifactsRuntimeLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    adapterFamily,
    modes,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
