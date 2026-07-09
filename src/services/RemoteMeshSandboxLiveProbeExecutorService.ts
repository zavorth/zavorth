import { createHash } from 'node:crypto';

import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
} from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshLiveProbeTransportKind,
  RemoteMeshLiveProbeTransportPayload,
  RemoteMeshLiveProbeTransportResult,
  RemoteMeshLiveProbeExecutionStatus,
  RemoteMeshSandboxLiveProbeSnapshot,
  RemoteMeshLiveProbeGuard,
  RemoteMeshLiveProbeGuardId,
  RemoteMeshLiveProbeGuardStatus,
} from '../contracts/RemoteMeshSandboxLiveProbeContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R5_LIVE_PROBE_VERSION } from '../contracts/RemoteMeshSandboxLiveProbeContract.js';
import type {
  RemoteMeshLiveActivationInput,
} from './RemoteMeshSandboxLiveActivationService.js';
import { RemoteMeshSandboxLiveActivationService } from './RemoteMeshSandboxLiveActivationService.js';
import type {
  RemoteMeshLiveProbeCandidate,
  RemoteMeshSandboxLiveActivationSnapshot,
} from '../contracts/RemoteMeshSandboxLiveActivationContract.js';

export type RemoteMeshLiveProbeTransportInvocation = {
  candidate: RemoteMeshLiveProbeCandidate;
  payload: RemoteMeshLiveProbeTransportPayload;
  activation: RemoteMeshSandboxLiveActivationSnapshot;
};

export type RemoteMeshLiveProbeTransport = {
  kind: RemoteMeshLiveProbeTransportKind;
  execute(input: RemoteMeshLiveProbeTransportInvocation): Promise<RemoteMeshLiveProbeTransportResult>;
};

type RemoteMeshSandboxLiveProbeExecutorRuntime = {
  now?: () => Date;
  activationService?: RemoteMeshSandboxLiveActivationService;
  transport?: RemoteMeshLiveProbeTransport;
};

export type RemoteMeshLiveProbeExecutorInput = {
  executeLiveProbe?: boolean;
  activationSnapshot?: RemoteMeshSandboxLiveActivationSnapshot;
  activationInput?: RemoteMeshLiveActivationInput;
  transport?: RemoteMeshLiveProbeTransport;
};

export class NotConfiguredRemoteMeshLiveProbeTransport implements RemoteMeshLiveProbeTransport {
  public readonly kind = 'not-configured' as const;

  public async execute(): Promise<RemoteMeshLiveProbeTransportResult> {
    throw new Error('Remote mesh live probe transport is not configured.');
  }
}

export class MockRemoteMeshLiveProbeTransport implements RemoteMeshLiveProbeTransport {
  public readonly kind = 'mock' as const;

  private readonly now: () => Date;
  private readonly status: 'success' | 'failed';

  constructor(input: { now?: () => Date; status?: 'success' | 'failed' } = {}) {
    this.now = input.now || (() => new Date());
    this.status = input.status || 'success';
  }

  public async execute(input: RemoteMeshLiveProbeTransportInvocation): Promise<RemoteMeshLiveProbeTransportResult> {
    const startedAt = this.now().toISOString();
    const finishedAt = this.now().toISOString();
    const toolName = input.payload.toolName;

    return {
      status: this.status,
      startedAt,
      finishedAt,
      exitCode: this.status === 'success' ? 0 : 1,
      stdoutPreview: this.status === 'success'
        ? `mock:${toolName}:ok`
        : '',
      stderrPreview: this.status === 'success'
        ? ''
        : `mock:${toolName}:failed`,
      transportEvidence: [
        'mock transport used for contract verification only',
        `candidate=${input.candidate.id}`,
      ],
      liveNetworkCallPerformed: false,
      remoteProcessSpawned: false,
      filesystemMutationPerformed: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    };
  }
}

export class RemoteMeshSandboxLiveProbeExecutorService {
  private readonly now: () => Date;
  private readonly activation: RemoteMeshSandboxLiveActivationService;
  private readonly transport: RemoteMeshLiveProbeTransport;

  constructor(runtime: RemoteMeshSandboxLiveProbeExecutorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.activation = runtime.activationService || new RemoteMeshSandboxLiveActivationService({ now: this.now });
    this.transport = runtime.transport || new NotConfiguredRemoteMeshLiveProbeTransport();
  }

  public async buildSnapshot(input: RemoteMeshLiveProbeExecutorInput = {}): Promise<RemoteMeshSandboxLiveProbeSnapshot> {
    const activation = input.activationSnapshot || this.activation.buildSnapshot(input.activationInput || {});
    const transport = input.transport || this.transport;
    const executeLiveProbe = input.executeLiveProbe === true;
    const candidate = activation.plan.candidate;
    const payload = candidate ? this.buildPayload(candidate) : null;
    let guards = this.buildPreExecutionGuards({
      activation,
      candidate,
      executeLiveProbe,
      transportKind: transport.kind,
    });
    let result: RemoteMeshLiveProbeTransportResult | null = null;
    let status: RemoteMeshLiveProbeExecutionStatus = this.resolvePreExecutionStatus({
      guards,
      executeLiveProbe,
    });
    let reason = this.reasonFor(status, guards, executeLiveProbe);

    if (status === 'executed' && candidate && payload) {
      try {
        result = await transport.execute({ activation, candidate, payload });
        guards = [
          ...guards,
          this.resultSafetyGuard(result),
        ];
        if (guards.some((guard) => guard.status === 'blocked')) {
          status = 'failed';
          reason = 'Live probe transport returned an unsafe result.';
        } else if (result.status === 'success') {
          status = 'executed';
          reason = 'Low-risk live probe executed through the configured transport.';
        } else {
          status = 'failed';
          reason = 'Low-risk live probe transport reported failure.';
        }
      } catch (error: unknown) {result = this.failedTransportResult(error);
        guards = [
          ...guards,
          this.resultSafetyGuard(result),
        ];
        status = 'failed';
        reason = 'Low-risk live probe transport threw before completing.';
      }
    }

    const receipt = this.buildReceipt({
      status,
      activation,
      candidate,
      payload,
      result,
      transportKind: transport.kind,
      executeLiveProbe,
    });
    const execution = {
      id: 'remote-live-probe:notebook-status',
      status,
      reason,
      activationStatus: activation.status,
      candidate,
      transportKind: transport.kind,
      payload,
      guards,
      result,
      receipt,
      liveExecution: {
        requested: executeLiveProbe,
        performed: status === 'executed' || status === 'failed',
        liveNetworkCallPerformed: result?.liveNetworkCallPerformed === true,
        remoteProcessSpawned: result?.remoteProcessSpawned === true,
        filesystemMutationPerformed: result?.filesystemMutationPerformed === true,
        rawCommandSerialized: false as const,
        secretValuesSerialized: false as const,
      },
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R5_LIVE_PROBE_VERSION,
      phase: 'R5',
      status,
      summary: {
        guards: guards.length,
        passed: guards.filter((guard) => guard.status === 'passed').length,
        waiting: guards.filter((guard) => guard.status === 'waiting').length,
        blocked: guards.filter((guard) => guard.status === 'blocked').length,
        executionRequested: executeLiveProbe,
        executionPerformed: execution.liveExecution.performed,
        executionRefused: status === 'refused',
        executionFailed: status === 'failed',
        activationStatus: activation.status,
        transportKind: transport.kind,
        liveNetworkCallPerformed: execution.liveExecution.liveNetworkCallPerformed,
        remoteProcessSpawned: execution.liveExecution.remoteProcessSpawned,
        filesystemMutationPerformed: execution.liveExecution.filesystemMutationPerformed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
        receipts: 1,
      },
      request: {
        executeLiveProbe,
        activationSnapshot: activation,
        transportKind: transport.kind,
      },
      activation,
      execution,
      receipts: [receipt],
      commands: {
        check: 'npm run remote-mesh:sandbox:live-probe --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxLiveProbeExecutorService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'R6 - Remote Session Timeline and Audit Surface',
      },
    };
  }

  private buildPreExecutionGuards(input: {
    activation: RemoteMeshSandboxLiveActivationSnapshot;
    candidate: RemoteMeshLiveProbeCandidate | null;
    executeLiveProbe: boolean;
    transportKind: RemoteMeshLiveProbeTransportKind;
  }): RemoteMeshLiveProbeGuard[] {
    return [
      guard(
        'explicit-execute-live-probe',
        input.executeLiveProbe ? 'passed' : 'waiting',
        input.executeLiveProbe
          ? 'Operator explicitly requested the R5 live probe execution.'
          : 'R5 live probe execution was not requested.',
        'Pass --execute-live-probe only after reviewing the R4 armed-ready evidence.',
      ),
      guard(
        'r4-armed-ready',
        input.activation.status === 'armed-ready' ? 'passed' : 'blocked',
        `R4 activation status is ${input.activation.status}.`,
        'R5 can execute only after R4 reports armed-ready.',
      ),
      guard(
        'candidate-present',
        input.candidate ? 'passed' : 'blocked',
        input.candidate
          ? `Candidate ${input.candidate.id} is present.`
          : 'R4 did not produce a live probe candidate.',
        'Regenerate R4 with a valid low-risk status probe candidate.',
      ),
      guard(
        'candidate-is-status-probe',
        input.candidate?.kind === 'mcp-status-probe' && input.candidate.toolId === 'notebook.status'
          ? 'passed'
          : 'blocked',
        input.candidate
          ? `Candidate kind=${input.candidate.kind} tool=${input.candidate.toolId}.`
          : 'No candidate kind/tool can be verified.',
        'Use only the MCP notebook.status probe for the first live execution.',
      ),
      guard(
        'candidate-level-0-readonly',
        input.candidate?.risk === 'level-0-readonly' && input.candidate.approval === 'not-required'
          ? 'passed'
          : 'blocked',
        input.candidate
          ? `Candidate risk=${input.candidate.risk} approval=${input.candidate.approval}.`
          : 'No candidate risk/approval can be verified.',
        'R5 accepts only level-0 read-only candidates without mutation approval.',
      ),
      guard(
        'candidate-has-no-raw-command',
        input.candidate?.rawCommand === null && input.candidate.commandTemplateId === null
          ? 'passed'
          : 'blocked',
        input.candidate
          ? 'Candidate exposes no raw command and no command template.'
          : 'No candidate command surface can be verified.',
        'R5 first probe must call an MCP status tool, not serialize shell commands.',
      ),
      guard(
        'transport-configured',
        input.transportKind !== 'not-configured' ? 'passed' : 'waiting',
        input.transportKind !== 'not-configured'
          ? `Transport ${input.transportKind} is configured.`
          : 'No live probe transport is configured.',
        'Inject a scoped live probe transport or configure the MCP status transport explicitly.',
      ),
    ];
  }

  private resolvePreExecutionStatus(input: {
    guards: RemoteMeshLiveProbeGuard[];
    executeLiveProbe: boolean;
  }): 'not-requested' | 'refused' | 'executed' {
    if (!input.executeLiveProbe) {
      return 'not-requested';
    }

    if (input.guards.some((guard) => guard.status !== 'passed')) {
      return 'refused';
    }

    return 'executed';
  }

  private reasonFor(
    status: 'not-requested' | 'refused' | 'executed' | 'failed',
    guards: RemoteMeshLiveProbeGuard[],
    executeLiveProbe: boolean,
  ): string {
    if (!executeLiveProbe) {
      return 'Live probe execution was not requested, so R5 produced a safe plan only.';
    }
    if (status === 'refused') {
      const firstNotPassed = guards.find((guard) => guard.status !== 'passed');
      return firstNotPassed
        ? `Live probe refused by guard ${firstNotPassed.id}.`
        : 'Live probe refused by policy.';
    }
    return 'Low-risk live probe is ready for the configured transport.';
  }

  private buildPayload(candidate: RemoteMeshLiveProbeCandidate): RemoteMeshLiveProbeTransportPayload {
    return {
      toolName: candidate.mcpToolName || 'notebook.get_status',
      params: {},
      timeoutMs: candidate.maxRuntimeMs,
      targetLabel: candidate.tailnetTarget,
    };
  }

  private resultSafetyGuard(result: RemoteMeshLiveProbeTransportResult): RemoteMeshLiveProbeGuard {
    const unsafe = result.remoteProcessSpawned
      || result.filesystemMutationPerformed
      || result.rawCommandSerialized
      || result.secretValuesSerialized;

    return guard(
      'transport-result-safe',
      unsafe ? 'blocked' : 'passed',
      unsafe
        ? 'Transport result reported a forbidden side effect.'
        : 'Transport result reports no remote process spawn, filesystem mutation, raw command, or secret serialization.',
      'Fix the transport so the first live probe is status-only and read-only.',
    );
  }

  private failedTransportResult(error: unknown): RemoteMeshLiveProbeTransportResult {
    const now = this.now().toISOString();
    return {
      status: 'failed',
      startedAt: now,
      finishedAt: now,
      exitCode: 1,
      stdoutPreview: '',
      stderrPreview: error instanceof Error ? error.message : 'unknown live probe transport error',
      transportEvidence: ['transport threw before completing the low-risk probe'],
      liveNetworkCallPerformed: false,
      remoteProcessSpawned: false,
      filesystemMutationPerformed: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    };
  }

  private buildReceipt(input: {
    status: 'not-requested' | 'refused' | 'executed' | 'failed';
    activation: RemoteMeshSandboxLiveActivationSnapshot;
    candidate: RemoteMeshLiveProbeCandidate | null;
    payload: RemoteMeshLiveProbeTransportPayload | null;
    result: RemoteMeshLiveProbeTransportResult | null;
    transportKind: RemoteMeshLiveProbeTransportKind;
    executeLiveProbe: boolean;
  }): RemoteExecutionReceipt {
    return {
      id: 'remote-live-probe-receipt:notebook-status',
      actionId: input.candidate?.actionId || null,
      decisionId: input.candidate?.evaluationId || null,
      sessionId: null,
      nodeId: input.candidate?.targetNodeId || 'remote-node:notebook:primary',
      toolId: input.candidate?.toolId || null,
      adapter: input.candidate?.transport || 'policy-only',
      status: this.receiptStatus(input.status),
      generatedAt: this.now().toISOString(),
      approvedBy: input.status === 'executed' ? 'operator' : 'not-approved',
      commandTemplateId: null,
      rawCommandSerialized: false,
      stdoutHash: this.hash({
        stream: 'stdout-live-probe',
        status: input.status,
        preview: input.result?.stdoutPreview || '',
      }),
      stderrHash: this.hash({
        stream: 'stderr-live-probe',
        status: input.status,
        preview: input.result?.stderrPreview || '',
      }),
      paramsRedacted: this.paramsRedacted(input),
      noSecretsSerialized: true,
      mutationPerformed: false,
      cleanupRequired: false,
      cleanupCompleted: false,
    };
  }

  private receiptStatus(status: 'not-requested' | 'refused' | 'executed' | 'failed'): RemoteExecutionReceipt['status'] {
    if (status === 'not-requested') {
      return 'planned';
    }
    if (status === 'refused') {
      return 'blocked';
    }
    return status;
  }

  private paramsRedacted(input: {
    activation: RemoteMeshSandboxLiveActivationSnapshot;
    payload: RemoteMeshLiveProbeTransportPayload | null;
    transportKind: RemoteMeshLiveProbeTransportKind;
    executeLiveProbe: boolean;
  }): Record<string, RemoteMeshJson> {
    return {
      activationStatus: input.activation.status,
      executeLiveProbe: input.executeLiveProbe,
      transportKind: input.transportKind,
      toolName: input.payload?.toolName || null,
      timeoutMs: input.payload?.timeoutMs || null,
      targetConfigured: Boolean(input.payload?.targetLabel),
    };
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}

function guard(
  id: RemoteMeshLiveProbeGuardId,
  status: RemoteMeshLiveProbeGuardStatus,
  evidence: string,
  remediation: string | null,
): RemoteMeshLiveProbeGuard {
  return {
    id,
    status,
    evidence,
    remediation: status === 'passed' ? null : remediation,
  };
}
