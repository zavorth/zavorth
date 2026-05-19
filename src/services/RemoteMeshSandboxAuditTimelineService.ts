import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
  RemoteMeshRiskTier,
} from '../contracts/RemoteMeshSandboxContract.js';
import type {
  RemoteMeshAuditTimelineEntry,
  RemoteMeshAuditTimelineEntryKind,
  RemoteMeshAuditTimelineEntryStatus,
  RemoteMeshAuditTimelineIndexes,
  RemoteMeshAuditTimelineStatus,
  RemoteMeshSandboxAuditTimelineSnapshot,
} from '../contracts/RemoteMeshSandboxAuditTimelineContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R6_AUDIT_TIMELINE_VERSION } from '../contracts/RemoteMeshSandboxAuditTimelineContract.js';
import type { RemoteMeshSandboxLiveProbeSnapshot } from '../contracts/RemoteMeshSandboxLiveProbeContract.js';
import type {
  RemoteMeshLiveProbeExecutorInput,
} from './RemoteMeshSandboxLiveProbeExecutorService.js';
import { RemoteMeshSandboxLiveProbeExecutorService } from './RemoteMeshSandboxLiveProbeExecutorService.js';

type RemoteMeshSandboxAuditTimelineRuntime = {
  now?: () => Date;
  liveProbeService?: RemoteMeshSandboxLiveProbeExecutorService;
};

export type RemoteMeshAuditTimelineInput = {
  liveProbeSnapshot?: RemoteMeshSandboxLiveProbeSnapshot;
  liveProbeInput?: RemoteMeshLiveProbeExecutorInput;
};

export class RemoteMeshSandboxAuditTimelineService {
  private readonly now: () => Date;
  private readonly liveProbe: RemoteMeshSandboxLiveProbeExecutorService;

  constructor(runtime: RemoteMeshSandboxAuditTimelineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveProbe = runtime.liveProbeService || new RemoteMeshSandboxLiveProbeExecutorService({ now: this.now });
  }

  public async buildSnapshot(input: RemoteMeshAuditTimelineInput = {}): Promise<RemoteMeshSandboxAuditTimelineSnapshot> {
    const liveProbeSnapshot = input.liveProbeSnapshot || await this.liveProbe.buildSnapshot(input.liveProbeInput || {});
    const receipts = this.collectReceipts(liveProbeSnapshot);
    const timeline = this.buildTimeline(liveProbeSnapshot, receipts);
    const indexes = this.buildIndexes(timeline);
    const status = this.resolveStatus(timeline);
    const query = {
      traceId: null,
      runId: liveProbeSnapshot.execution.id,
      sessionId: this.firstValue(receipts.map((receipt) => receipt.sessionId)),
      actionId: liveProbeSnapshot.execution.candidate?.actionId || null,
      decisionId: liveProbeSnapshot.execution.candidate?.evaluationId || null,
      nodeId: liveProbeSnapshot.execution.candidate?.targetNodeId || null,
      toolId: liveProbeSnapshot.execution.candidate?.toolId || null,
      receiptIds: receipts.map((receipt) => receipt.id),
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R6_AUDIT_TIMELINE_VERSION,
      phase: 'R6',
      status,
      summary: {
        entries: timeline.length,
        receipts: receipts.length,
        passed: timeline.filter((entry) => entry.status === 'passed' || entry.status === 'allowed').length,
        waiting: timeline.filter((entry) => entry.status === 'waiting' || entry.status === 'planned').length,
        blocked: timeline.filter((entry) => entry.status === 'blocked').length,
        attention: timeline.filter((entry) => entry.status === 'attention').length,
        executed: timeline.filter((entry) => entry.status === 'executed').length,
        failed: timeline.filter((entry) => entry.status === 'failed').length,
        activationStatus: liveProbeSnapshot.activation.status,
        liveProbeStatus: liveProbeSnapshot.status,
        timelineHasExecutionReceipt: receipts.some((receipt) => receipt.id === liveProbeSnapshot.execution.receipt.id),
        timelineHasOperatorNextAction: timeline.some((entry) => entry.kind === 'operator-next-action'),
        liveNetworkCallPerformed: timeline.some((entry) => entry.sideEffects.liveNetworkCallPerformed),
        remoteProcessSpawned: timeline.some((entry) => entry.sideEffects.remoteProcessSpawned),
        filesystemMutationPerformed: timeline.some((entry) => entry.sideEffects.filesystemMutationPerformed),
        mutationPerformed: timeline.some((entry) => entry.sideEffects.mutationPerformed),
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      source: {
        activationPhase: 'R4',
        liveProbePhase: 'R5',
        activationStatus: liveProbeSnapshot.activation.status,
        liveProbeStatus: liveProbeSnapshot.status,
      },
      query,
      indexes,
      timeline,
      receipts,
      commands: {
        check: 'npm run remote-mesh:sandbox:audit-timeline --silent',
        focusedTests: 'npx jest tests/services/RemoteMeshSandboxAuditTimelineService.test.ts --runInBand',
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'R7 - Scoped MCP Status Transport',
      },
    };
  }

  private buildTimeline(
    snapshot: RemoteMeshSandboxLiveProbeSnapshot,
    receipts: RemoteExecutionReceipt[],
  ): RemoteMeshAuditTimelineEntry[] {
    let sequence = 0;
    const entries: RemoteMeshAuditTimelineEntry[] = [];
    const push = (entry: Omit<RemoteMeshAuditTimelineEntry, 'sequence' | 'at'> & { at?: string }) => {
      sequence += 1;
      entries.push({
        ...entry,
        sequence,
        at: entry.at || snapshot.generatedAt,
      });
    };
    const candidate = snapshot.execution.candidate;
    const baseRelated = {
      actionId: candidate?.actionId || null,
      decisionId: candidate?.evaluationId || null,
      receiptId: null,
      sessionId: null,
      runId: snapshot.execution.id,
      traceId: null,
      nodeId: candidate?.targetNodeId || null,
      toolId: candidate?.toolId || null,
    };

    push({
      id: 'r6:r0:readiness-summary',
      phase: 'R0',
      kind: 'readiness-summary',
      status: snapshot.activation.plan.readiness.summary.blocked > 0 ? 'blocked' : 'attention',
      title: 'Remote readiness snapshot',
      evidence: `R0 checks=${snapshot.activation.plan.readiness.summary.checks} blocked=${snapshot.activation.plan.readiness.summary.blocked} warnings=${snapshot.activation.plan.readiness.summary.warnings}.`,
      cause: 'Remote mesh readiness was summarized before live activation.',
      impact: 'Operator can see whether Tailscale, SSH, MCP, Termux, PRoot, or Docker prerequisites need work.',
      safeNextAction: snapshot.activation.plan.readiness.nextActions[0] || 'Rerun R0 readiness with a concrete target.',
      retryable: true,
      risk: null,
      related: baseRelated,
      sideEffects: this.noSideEffects(),
      payloadPreview: {
        directRouteObserved: snapshot.activation.plan.readiness.summary.directRouteObserved,
        relayRouteObserved: snapshot.activation.plan.readiness.summary.relayRouteObserved,
      },
    });

    if (snapshot.activation.plan.policyEvaluation) {
      push({
        id: 'r6:r2:policy-evaluation',
        phase: 'R2',
        kind: 'policy-evaluation',
        status: this.policyStatus(snapshot.activation.plan.policyEvaluation.status),
        title: 'Remote action policy decision',
        evidence: `R2 ${snapshot.activation.plan.policyEvaluation.status} tool=${snapshot.activation.plan.policyEvaluation.toolId} risk=${snapshot.activation.plan.policyEvaluation.risk}.`,
        cause: 'The requested remote action was evaluated against the allowlist and risk policy.',
        impact: 'Only schema-bound, non-shell remote tools can move forward.',
        safeNextAction: snapshot.activation.plan.policyEvaluation.safeNextAction,
        retryable: snapshot.activation.plan.policyEvaluation.status !== 'denied',
        risk: snapshot.activation.plan.policyEvaluation.risk,
        related: baseRelated,
        sideEffects: this.noSideEffects(),
        payloadPreview: {
          toolId: snapshot.activation.plan.policyEvaluation.toolId,
          mcpToolName: snapshot.activation.plan.policyEvaluation.mcpToolName,
          commandTemplateId: snapshot.activation.plan.policyEvaluation.commandTemplateId,
        },
      });
    }

    if (snapshot.activation.plan.adapterBinding) {
      push({
        id: 'r6:r3:adapter-binding',
        phase: 'R3',
        kind: 'adapter-binding',
        status: snapshot.activation.plan.adapterBinding.status === 'ready'
          ? 'passed'
          : snapshot.activation.plan.adapterBinding.status === 'approval-required'
            ? 'waiting'
            : 'blocked',
        title: 'Dry-run adapter binding',
        evidence: `R3 ${snapshot.activation.plan.adapterBinding.adapter} binding is ${snapshot.activation.plan.adapterBinding.status}.`,
        cause: 'The remote action was bound to a dry-run adapter before live execution.',
        impact: 'Zavorth can explain the target transport without exposing a raw command.',
        safeNextAction: snapshot.activation.plan.adapterBinding.status === 'ready'
          ? 'Proceed only through R4/R5 gates.'
          : 'Resolve the adapter binding before live activation.',
        retryable: snapshot.activation.plan.adapterBinding.status !== 'blocked',
        risk: snapshot.activation.plan.policyEvaluation?.risk || null,
        related: baseRelated,
        sideEffects: this.noSideEffects(),
        payloadPreview: {
          adapter: snapshot.activation.plan.adapterBinding.adapter,
          transport: snapshot.activation.plan.adapterBinding.transport,
          mcpToolName: snapshot.activation.plan.adapterBinding.mcpToolName,
          rawCommand: null,
        },
      });
    }

    for (const gate of snapshot.activation.plan.gates) {
      push({
        id: `r6:r4:gate:${gate.id}`,
        phase: 'R4',
        kind: 'activation-gate',
        status: gate.status,
        title: `R4 gate: ${gate.id}`,
        evidence: gate.evidence,
        cause: gate.status === 'passed'
          ? 'The activation gate passed.'
          : 'The activation gate still needs operator or environment evidence.',
        impact: gate.status === 'passed'
          ? 'This gate no longer blocks the first live probe.'
          : 'R5 execution cannot proceed until this evidence is satisfied.',
        safeNextAction: gate.remediation || 'Continue to the next gate.',
        retryable: gate.status !== 'blocked',
        risk: snapshot.activation.plan.policyEvaluation?.risk || null,
        related: baseRelated,
        sideEffects: this.noSideEffects(),
        payloadPreview: {
          gate: gate.id,
        },
      });
    }

    for (const guard of snapshot.execution.guards) {
      push({
        id: `r6:r5:guard:${guard.id}`,
        phase: 'R5',
        kind: 'live-probe-guard',
        status: guard.status,
        title: `R5 guard: ${guard.id}`,
        evidence: guard.evidence,
        cause: guard.status === 'passed'
          ? 'The live probe guard passed.'
          : 'The live probe guard prevented or delayed execution.',
        impact: guard.status === 'passed'
          ? 'This guard supports the low-risk probe path.'
          : 'The probe remains safe because execution is refused until this is resolved.',
        safeNextAction: guard.remediation || 'Continue to the next guard.',
        retryable: guard.status !== 'blocked',
        risk: candidate?.risk || null,
        related: baseRelated,
        sideEffects: this.noSideEffects(),
        payloadPreview: {
          guard: guard.id,
        },
      });
    }

    push({
      id: 'r6:r5:execution',
      phase: 'R5',
      kind: 'live-probe-execution',
      status: this.executionStatus(snapshot.status),
      title: 'Low-risk live probe execution',
      evidence: snapshot.execution.reason,
      cause: snapshot.summary.executionRequested
        ? 'The operator requested the R5 live probe path.'
        : 'The operator did not request live probe execution.',
      impact: snapshot.summary.executionPerformed
        ? 'The execution result is represented by a receipt and timeline event.'
        : 'No live operation occurred; only the plan and refusal/waiting evidence were recorded.',
      safeNextAction: snapshot.status === 'executed'
        ? 'Review the receipt and result before expanding remote capabilities.'
        : 'Resolve waiting or blocked guards before requesting execution.',
      retryable: snapshot.status !== 'executed',
      risk: candidate?.risk || null,
      related: {
        ...baseRelated,
        receiptId: snapshot.execution.receipt.id,
      },
      sideEffects: {
        liveNetworkCallPerformed: snapshot.execution.liveExecution.liveNetworkCallPerformed,
        remoteProcessSpawned: snapshot.execution.liveExecution.remoteProcessSpawned,
        filesystemMutationPerformed: snapshot.execution.liveExecution.filesystemMutationPerformed,
        mutationPerformed: snapshot.execution.receipt.mutationPerformed,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
      payloadPreview: {
        transportKind: snapshot.execution.transportKind,
        toolName: snapshot.execution.payload?.toolName || null,
      },
    });

    if (snapshot.execution.result) {
      push({
        id: 'r6:r5:result',
        phase: 'R5',
        kind: 'live-probe-result',
        status: snapshot.execution.result.status === 'success' ? 'executed' : 'failed',
        title: 'Low-risk live probe result',
        evidence: `Result=${snapshot.execution.result.status} exitCode=${snapshot.execution.result.exitCode}.`,
        cause: 'The configured transport returned a bounded status result.',
        impact: snapshot.execution.result.status === 'success'
          ? 'The first low-risk remote probe path is demonstrably callable.'
          : 'The remote probe path needs transport or target repair.',
        safeNextAction: snapshot.execution.result.status === 'success'
          ? 'Promote the evidence into the Command Center audit view.'
          : 'Inspect transport evidence and rerun R5 after repair.',
        retryable: snapshot.execution.result.status !== 'success',
        risk: candidate?.risk || null,
        related: baseRelated,
        sideEffects: {
          liveNetworkCallPerformed: snapshot.execution.result.liveNetworkCallPerformed,
          remoteProcessSpawned: snapshot.execution.result.remoteProcessSpawned,
          filesystemMutationPerformed: snapshot.execution.result.filesystemMutationPerformed,
          mutationPerformed: false,
          rawCommandSerialized: false,
          secretValuesSerialized: false,
        },
        payloadPreview: {
          stdoutHashPresent: Boolean(snapshot.execution.receipt.stdoutHash),
          stderrHashPresent: Boolean(snapshot.execution.receipt.stderrHash),
          evidenceCount: snapshot.execution.result.transportEvidence.length,
        },
      });
    }

    for (const receipt of receipts) {
      push({
        id: `r6:receipt:${receipt.id}`,
        phase: 'R6',
        kind: 'receipt',
        status: this.receiptStatus(receipt.status),
        title: `Receipt: ${receipt.id}`,
        evidence: `Receipt status=${receipt.status} adapter=${receipt.adapter}.`,
        cause: 'A remote-mesh phase emitted a receipt.',
        impact: 'The operator can audit the action without reading raw stdout, stderr, shell, or secrets.',
        safeNextAction: receipt.status === 'failed'
          ? 'Repair the failed phase and regenerate the timeline.'
          : 'Keep the receipt with the run evidence.',
        retryable: receipt.status === 'failed' || receipt.status === 'blocked',
        risk: candidate?.risk || null,
        related: {
          actionId: receipt.actionId,
          decisionId: receipt.decisionId,
          receiptId: receipt.id,
          sessionId: receipt.sessionId,
          runId: snapshot.execution.id,
          traceId: null,
          nodeId: receipt.nodeId,
          toolId: receipt.toolId,
        },
        sideEffects: {
          liveNetworkCallPerformed: false,
          remoteProcessSpawned: false,
          filesystemMutationPerformed: false,
          mutationPerformed: receipt.mutationPerformed,
          rawCommandSerialized: false,
          secretValuesSerialized: false,
        },
        payloadPreview: {
          approvedBy: receipt.approvedBy,
          stdoutHashPresent: Boolean(receipt.stdoutHash),
          stderrHashPresent: Boolean(receipt.stderrHash),
          cleanupRequired: receipt.cleanupRequired,
        },
      });
    }

    push({
      id: 'r6:operator-next-action',
      phase: 'R6',
      kind: 'operator-next-action',
      status: 'planned',
      title: 'Operator next safe action',
      evidence: this.nextActionEvidence(snapshot),
      cause: 'R6 summarizes the safest next step from the current R4/R5 state.',
      impact: 'The operator gets a clear continuation path without guessing from raw logs.',
      safeNextAction: this.nextActionEvidence(snapshot),
      retryable: true,
      risk: candidate?.risk || null,
      related: baseRelated,
      sideEffects: this.noSideEffects(),
      payloadPreview: {
        nextStage: 'R7 - Scoped MCP Status Transport',
      },
    });

    return entries;
  }

  private collectReceipts(snapshot: RemoteMeshSandboxLiveProbeSnapshot): RemoteExecutionReceipt[] {
    const byId = new Map<string, RemoteExecutionReceipt>();
    [
      ...snapshot.activation.receipts,
      snapshot.activation.plan.receipt,
      ...snapshot.receipts,
      snapshot.execution.receipt,
    ].forEach((receipt) => byId.set(receipt.id, receipt));
    return Array.from(byId.values());
  }

  private resolveStatus(timeline: RemoteMeshAuditTimelineEntry[]): RemoteMeshAuditTimelineStatus {
    const unsafe = timeline.some((entry) => entry.sideEffects.remoteProcessSpawned
      || entry.sideEffects.filesystemMutationPerformed
      || entry.sideEffects.rawCommandSerialized
      || entry.sideEffects.secretValuesSerialized);
    if (unsafe) {
      return 'timeline-blocked';
    }
    if (timeline.some((entry) => entry.status === 'failed' || entry.status === 'blocked' || entry.status === 'waiting')) {
      return 'timeline-attention';
    }
    return 'timeline-ready';
  }

  private buildIndexes(timeline: RemoteMeshAuditTimelineEntry[]): RemoteMeshAuditTimelineIndexes {
    const indexes: RemoteMeshAuditTimelineIndexes = {
      byActionId: {},
      byDecisionId: {},
      byReceiptId: {},
      bySessionId: {},
      byRunId: {},
      byTraceId: {},
      byNodeId: {},
      byToolId: {},
      byStatus: {},
    };
    for (const entry of timeline) {
      this.addIndex(indexes.byActionId, entry.related.actionId, entry.id);
      this.addIndex(indexes.byDecisionId, entry.related.decisionId, entry.id);
      this.addIndex(indexes.byReceiptId, entry.related.receiptId, entry.id);
      this.addIndex(indexes.bySessionId, entry.related.sessionId, entry.id);
      this.addIndex(indexes.byRunId, entry.related.runId, entry.id);
      this.addIndex(indexes.byTraceId, entry.related.traceId, entry.id);
      this.addIndex(indexes.byNodeId, entry.related.nodeId, entry.id);
      this.addIndex(indexes.byToolId, entry.related.toolId, entry.id);
      this.addIndex(indexes.byStatus, entry.status, entry.id);
    }
    return indexes;
  }

  private addIndex(index: Record<string, string[]>, key: string | null, entryId: string): void {
    if (!key) {
      return;
    }
    index[key] ||= [];
    index[key].push(entryId);
  }

  private noSideEffects(): RemoteMeshAuditTimelineEntry['sideEffects'] {
    return {
      liveNetworkCallPerformed: false,
      remoteProcessSpawned: false,
      filesystemMutationPerformed: false,
      mutationPerformed: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    };
  }

  private policyStatus(status: string): RemoteMeshAuditTimelineEntryStatus {
    if (status === 'allowed') {
      return 'allowed';
    }
    if (status === 'requires-approval' || status === 'needs-clarification') {
      return 'waiting';
    }
    return 'blocked';
  }

  private executionStatus(status: string): RemoteMeshAuditTimelineEntryStatus {
    if (status === 'executed') {
      return 'executed';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'refused') {
      return 'blocked';
    }
    return 'planned';
  }

  private receiptStatus(status: RemoteExecutionReceipt['status']): RemoteMeshAuditTimelineEntryStatus {
    if (status === 'allowed' || status === 'cleaned') {
      return 'allowed';
    }
    if (status === 'executed') {
      return 'executed';
    }
    if (status === 'failed') {
      return 'failed';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    return 'planned';
  }

  private nextActionEvidence(snapshot: RemoteMeshSandboxLiveProbeSnapshot): string {
    if (snapshot.status === 'executed') {
      return 'Review the R5 receipt and wire this timeline into the Command Center before widening the transport catalog.';
    }
    if (snapshot.status === 'failed') {
      return 'Repair the scoped transport and rerun R5 with the same R4 evidence.';
    }
    if (snapshot.activation.status !== 'armed-ready') {
      return 'Resolve R4 gates before requesting a live probe.';
    }
    return 'Configure a scoped live probe transport before executing R5.';
  }

  private firstValue(values: Array<string | null>): string | null {
    return values.find((value): value is string => Boolean(value)) || null;
  }
}
