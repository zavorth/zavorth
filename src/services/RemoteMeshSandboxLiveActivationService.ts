import { createHash } from 'node:crypto';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R4_LIVE_ACTIVATION_VERSION } from '../contracts/RemoteMeshSandboxLiveActivationContract.js';

import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
} from '../contracts/RemoteMeshSandboxContract.js';
import type { RemoteMeshSandboxAdapterSnapshot } from '../contracts/RemoteMeshSandboxAdapterContract.js';
import type {
  RemoteMeshLiveActivationGate,
  RemoteMeshLiveActivationGateId,
  RemoteMeshLiveActivationGateStatus,
  RemoteMeshLiveActivationPlan,
  RemoteMeshLiveActivationStatus,
  RemoteMeshOwnerTrustProof,
  RemoteMeshSandboxLiveActivationSnapshot,
} from '../contracts/RemoteMeshSandboxLiveActivationContract.js';

import type { RemoteMeshPolicyEvaluation } from '../contracts/RemoteMeshSandboxPolicyContract.js';
import type { RemoteMeshSandboxReadinessSnapshot } from '../contracts/RemoteMeshSandboxReadinessContract.js';
import { RemoteMeshSandboxAdapterDryRunService } from './RemoteMeshSandboxAdapterDryRunService.js';
import { RemoteMeshSandboxContractService } from './RemoteMeshSandboxContractService.js';
import { RemoteMeshSandboxPolicyService } from './RemoteMeshSandboxPolicyService.js';
import { RemoteMeshSandboxReadinessService } from './RemoteMeshSandboxReadinessService.js';

type RemoteMeshSandboxLiveActivationRuntime = {
  now?: () => Date;
  contractService?: RemoteMeshSandboxContractService;
  policyService?: RemoteMeshSandboxPolicyService;
  adapterService?: RemoteMeshSandboxAdapterDryRunService;
  readinessService?: RemoteMeshSandboxReadinessService;
};

export type RemoteMeshLiveActivationInput = {
  ownerTrust?: Partial<RemoteMeshOwnerTrustProof>;
  canonicalTargetNodeId?: string | null;
  tailnetTarget?: string | null;
  acceptRelayRoute?: boolean;
  armLiveProbe?: boolean;
  readinessSnapshot?: RemoteMeshSandboxReadinessSnapshot;
  adapterSnapshot?: RemoteMeshSandboxAdapterSnapshot;
};

export class RemoteMeshSandboxLiveActivationService {
  private readonly now: () => Date;
  private readonly contracts: RemoteMeshSandboxContractService;
  private readonly policy: RemoteMeshSandboxPolicyService;
  private readonly adapters: RemoteMeshSandboxAdapterDryRunService;
  private readonly readiness: RemoteMeshSandboxReadinessService;

  constructor(runtime: RemoteMeshSandboxLiveActivationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.contracts = runtime.contractService || new RemoteMeshSandboxContractService({ now: this.now });
    this.policy = runtime.policyService || new RemoteMeshSandboxPolicyService({
      now: this.now,
      contractService: this.contracts,
    });
    this.adapters = runtime.adapterService || new RemoteMeshSandboxAdapterDryRunService({
      now: this.now,
      policyService: this.policy,
    });
    this.readiness = runtime.readinessService || new RemoteMeshSandboxReadinessService({ now: this.now });
  }

  public buildSnapshot(input: RemoteMeshLiveActivationInput = {}): RemoteMeshSandboxLiveActivationSnapshot {
    const ownerTrust = this.resolveOwnerTrust(input.ownerTrust);
    const canonicalTargetNodeId = input.canonicalTargetNodeId || 'remote-node:notebook:primary';
    const tailnetTarget = input.tailnetTarget || null;
    const readiness = input.readinessSnapshot || this.readiness.buildSnapshot({
      target: {
        nodeId: tailnetTarget,
      },
    });
    const adapterSnapshot = input.adapterSnapshot || this.adapters.buildSnapshot();
    const candidateEvaluation = this.buildCandidateEvaluation(canonicalTargetNodeId);
    const candidateBinding = this.adapters
      .buildBindingsForEvaluation(candidateEvaluation, {
        nodes: adapterSnapshot.nodes,
        tools: adapterSnapshot.tools,
        catalog: adapterSnapshot.policyCatalog,
      })
      .find((binding) => binding.adapter === 'mcp-dry-run') || null;
    const gates = this.buildGates({
      ownerTrust,
      canonicalTargetNodeId,
      tailnetTarget,
      readiness,
      candidateEvaluation,
      candidateBinding,
      armLiveProbe: input.armLiveProbe === true,
      acceptRelayRoute: input.acceptRelayRoute === true,
    });
    const status = this.resolveStatus(gates);
    const candidate = candidateBinding
      ? {
        id: 'remote-live-probe:notebook-status',
        kind: 'mcp-status-probe' as const,
        targetNodeId: canonicalTargetNodeId,
        tailnetTarget,
        actionId: candidateEvaluation.actionId,
        evaluationId: candidateEvaluation.id,
        adapterBindingId: candidateBinding.id,
        toolId: candidateEvaluation.toolId,
        transport: candidateBinding.transport,
        risk: candidateEvaluation.risk,
        approval: candidateEvaluation.approval,
        commandTemplateId: candidateBinding.commandTemplateId,
        mcpToolName: candidateBinding.mcpToolName,
        rawCommand: null,
        maxRuntimeMs: 30000,
        teardownRequired: false,
      }
      : null;
    const receipt = this.buildReceipt({
      status,
      ownerTrust,
      candidate,
      evaluation: candidateEvaluation,
      params: candidateEvaluation.sanitizedParams,
    });
    const plan: RemoteMeshLiveActivationPlan = {
      id: 'remote-live-activation:notebook-status',
      status,
      candidate,
      readiness,
      policyEvaluation: candidateEvaluation,
      adapterBinding: candidateBinding,
      gates,
      receipt,
      liveExecution: {
        authorized: status === 'armed-ready',
        performed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R4_LIVE_ACTIVATION_VERSION,
      phase: 'R4',
      status,
      summary: {
        gates: gates.length,
        passed: gates.filter((gate) => gate.status === 'passed').length,
        waiting: gates.filter((gate) => gate.status === 'waiting').length,
        blocked: gates.filter((gate) => gate.status === 'blocked').length,
        hasCandidate: candidate !== null,
        ownerTrusted: ownerTrust.trusted,
        targetConfigured: Boolean(tailnetTarget),
        readyToArm: status === 'ready-to-arm' || status === 'armed-ready',
        liveExecutionAuthorized: status === 'armed-ready',
        liveExecutionPerformed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      ownerTrust,
      plan,
      receipts: [receipt],
      commands: {
        check: 'npm run remote-mesh:sandbox:live-activation --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxLiveActivationService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'R5 - Single Low-Risk Live Probe Executor',
      },
    };
  }

  private buildCandidateEvaluation(canonicalTargetNodeId: string): RemoteMeshPolicyEvaluation {
    const action = this.contracts.buildAction({
      id: 'remote-live-probe:notebook-status:action',
      naturalLanguageIntent: 'Check notebook status through the scoped MCP status tool.',
      targetNodeId: canonicalTargetNodeId,
      toolId: 'notebook.status',
      params: {},
      timeoutMs: 30000,
    });
    return this.policy.evaluateAction(action);
  }

  private buildGates(input: {
    ownerTrust: RemoteMeshOwnerTrustProof;
    canonicalTargetNodeId: string;
    tailnetTarget: string | null;
    readiness: RemoteMeshSandboxReadinessSnapshot;
    candidateEvaluation: RemoteMeshPolicyEvaluation;
    candidateBinding: ReturnType<RemoteMeshSandboxAdapterDryRunService['buildBindingsForEvaluation']>[number] | null;
    armLiveProbe: boolean;
    acceptRelayRoute: boolean;
  }): RemoteMeshLiveActivationGate[] {
    const routeAccepted = input.readiness.summary.directRouteObserved
      || (input.acceptRelayRoute && input.readiness.summary.relayRouteObserved);

    return [
      gate(
        'owner-trust',
        input.ownerTrust.trusted && input.ownerTrust.acknowledgedRisk ? 'passed' : 'waiting',
        input.ownerTrust.trusted
          ? `Owner trust provided by ${input.ownerTrust.source}.`
          : 'Owner trust has not been provided.',
        'Provide explicit owner trust before any live remote activation.',
      ),
      gate(
        'target-configured',
        input.tailnetTarget ? 'passed' : 'waiting',
        input.tailnetTarget
          ? `Tailnet target configured as ${input.tailnetTarget}.`
          : 'No tailnet target was configured.',
        'Pass --target <tailnet-node> or set ZAVORTH_REMOTE_MESH_TARGET.',
      ),
      gate(
        'r0-readiness-no-blockers',
        input.readiness.summary.blocked === 0 ? 'passed' : 'blocked',
        `R0 readiness reports ${input.readiness.summary.blocked} blocker(s).`,
        'Resolve R0 blockers before live activation.',
      ),
      gate(
        'r0-target-bound',
        input.tailnetTarget && input.readiness.target.nodeId === input.tailnetTarget ? 'passed' : 'waiting',
        input.readiness.target.nodeId
          ? `R0 target is ${input.readiness.target.nodeId}.`
          : 'R0 readiness is not bound to a target.',
        'Run R0 readiness with the same tailnet target.',
      ),
      gate(
        'r0-route-accepted',
        routeAccepted ? 'passed' : 'waiting',
        input.readiness.summary.directRouteObserved
          ? 'R0 observed a direct route.'
          : input.readiness.summary.relayRouteObserved
            ? 'R0 observed a relay route that needs explicit acceptance.'
            : 'R0 has not observed a target route.',
        'Measure route with R0 or pass accepted relay evidence intentionally.',
      ),
      gate(
        'r2-low-risk-policy',
        input.candidateEvaluation.status === 'allowed' && input.candidateEvaluation.risk === 'level-0-readonly'
          ? 'passed'
          : 'blocked',
        `R2 candidate is ${input.candidateEvaluation.status} with risk ${input.candidateEvaluation.risk}.`,
        'Use only a level-0 allowlisted status probe for first activation.',
      ),
      gate(
        'r3-dry-run-binding',
        input.candidateBinding?.status === 'ready'
          && input.candidateBinding.adapter === 'mcp-dry-run'
          && input.candidateBinding.guards.noLiveNetworkCall
          ? 'passed'
          : 'blocked',
        input.candidateBinding
          ? `R3 candidate binding is ${input.candidateBinding.status} through ${input.candidateBinding.adapter}.`
          : 'No R3 dry-run binding exists for the candidate.',
        'Generate a ready MCP dry-run binding before live activation.',
      ),
      gate(
        'owner-arm-live-probe',
        input.armLiveProbe ? 'passed' : 'waiting',
        input.armLiveProbe
          ? 'Owner armed the low-risk live probe plan.'
          : 'Live probe plan is not armed.',
        'Pass --arm-live-probe only after reviewing R0/R2/R3 evidence.',
      ),
    ];
  }

  private resolveStatus(gates: RemoteMeshLiveActivationGate[]): RemoteMeshLiveActivationStatus {
    if (gates.some((gate) => gate.status === 'blocked')) {
      return 'blocked';
    }

    const allExceptArmPassed = gates
      .filter((gate) => gate.id !== 'owner-arm-live-probe')
      .every((gate) => gate.status === 'passed');
    const armPassed = gates.find((gate) => gate.id === 'owner-arm-live-probe')?.status === 'passed';

    if (allExceptArmPassed && armPassed) {
      return 'armed-ready';
    }
    if (allExceptArmPassed) {
      return 'ready-to-arm';
    }
    return 'not-armed';
  }

  private resolveOwnerTrust(input: Partial<RemoteMeshOwnerTrustProof> = {}): RemoteMeshOwnerTrustProof {
    return {
      trusted: input.trusted === true,
      source: input.source || 'none',
      operatorLabel: input.operatorLabel || null,
      acknowledgedRisk: input.acknowledgedRisk === true,
      mutableHostAccessGranted: false,
    };
  }

  private buildReceipt(input: {
    status: RemoteMeshLiveActivationStatus;
    ownerTrust: RemoteMeshOwnerTrustProof;
    candidate: RemoteMeshLiveActivationPlan['candidate'];
    evaluation: RemoteMeshPolicyEvaluation;
    params: Record<string, RemoteMeshJson>;
  }): RemoteExecutionReceipt {
    return {
      id: 'remote-live-activation-receipt:notebook-status',
      actionId: input.evaluation.actionId,
      decisionId: input.evaluation.id,
      sessionId: null,
      nodeId: input.candidate?.targetNodeId || input.evaluation.targetNodeId,
      toolId: input.candidate?.toolId || input.evaluation.toolId,
      adapter: input.candidate?.transport || 'policy-only',
      status: input.status === 'armed-ready'
        ? 'allowed'
        : input.status === 'blocked'
          ? 'blocked'
          : 'planned',
      generatedAt: this.now().toISOString(),
      approvedBy: input.status === 'armed-ready' ? 'operator' : 'not-approved',
      commandTemplateId: input.candidate?.commandTemplateId || null,
      rawCommandSerialized: false,
      stdoutHash: this.hash({ stream: 'stdout-live-probe-preview', status: input.status }),
      stderrHash: this.hash({ stream: 'stderr-live-probe-preview', status: input.status }),
      paramsRedacted: input.params,
      noSecretsSerialized: true,
      mutationPerformed: false,
      cleanupRequired: false,
      cleanupCompleted: false,
    };
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}

function gate(
  id: RemoteMeshLiveActivationGateId,
  status: RemoteMeshLiveActivationGateStatus,
  evidence: string,
  remediation: string | null,
): RemoteMeshLiveActivationGate {
  return {
    id,
    status,
    evidence,
    remediation: status === 'passed' ? null : remediation,
  };
}
