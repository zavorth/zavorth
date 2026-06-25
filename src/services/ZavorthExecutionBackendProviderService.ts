import {
  ZAVORTH_EXECUTION_BACKEND_PROVIDER_VERSION,
  type ZavorthBackendProofResults,
  type ZavorthExecutionBackendProviderInput,
  type ZavorthExecutionBackendProviderSnapshot,
  type ZavorthLiveProof,
} from '../contracts/native/ZavorthNativeAutonomySpineContract.js';
import type { ZavorthTerminalBackendSnapshot } from '../contracts/ZavorthTerminalBackendsContract.js';
import { redactSensitiveText } from './ZavorthNativeAutonomyShared.js';

type ExecutionBackendProviderDeps = {
  now?: () => Date;
};

const BACKEND_PROOFS: Array<{ id: keyof ZavorthBackendProofResults; label: string; blockReason: string }> = [
  { id: 'doctor', label: 'Doctor', blockReason: 'doctor proof is required before live execution' },
  { id: 'prepareWorkspace', label: 'Prepare workspace', blockReason: 'workspace preparation proof is required before live execution' },
  { id: 'run', label: 'Run command', blockReason: 'run proof is required before live execution' },
  { id: 'stream', label: 'Stream output', blockReason: 'stream proof is required before live execution' },
  { id: 'upload', label: 'Upload files', blockReason: 'upload proof is required before live execution' },
  { id: 'download', label: 'Download files', blockReason: 'download proof is required before live execution' },
  { id: 'snapshot', label: 'Snapshot', blockReason: 'snapshot proof is required before live execution' },
  { id: 'hibernate', label: 'Hibernate', blockReason: 'hibernate proof is required before live execution' },
  { id: 'resume', label: 'Resume', blockReason: 'resume proof is required before live execution' },
  { id: 'cleanup', label: 'Cleanup', blockReason: 'cleanup proof is required before live execution' },
  { id: 'costEstimate', label: 'Cost estimate', blockReason: 'cost estimate proof is required before live execution' },
];

const HIGH_RISK_COMMAND = /\b(rm\s+-rf|del\s+\/|format\b|curl\b.*\|\s*(sh|bash)|Invoke-WebRequest\b.*\|\s*iex|chmod\s+\+x|sudo\b|provider|policy|secret)\b/i;

export class ZavorthExecutionBackendProviderService {
  private readonly now: () => Date;

  public constructor(deps: ExecutionBackendProviderDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public certify(input: ZavorthExecutionBackendProviderInput): ZavorthExecutionBackendProviderSnapshot {
    const proofResults = input.proofResults || {};
    const proofs = BACKEND_PROOFS.map((proof): ZavorthLiveProof => ({
      id: String(proof.id),
      label: proof.label,
      status: proofResults[proof.id] === true ? 'passed' : 'failed',
      required: true,
    }));
    const liveReady = input.configured && proofs.every((proof) => proof.status === 'passed');
    const commandPreview = input.command ? redactSensitiveText(input.command) : null;
    const highRisk = commandPreview ? HIGH_RISK_COMMAND.test(commandPreview) : false;
    const approvalRequired = Boolean(input.mutationRequested || highRisk);
    const approvalPresent = Boolean(String(input.approvalId || '').trim());
    const liveMutationAllowed = liveReady && (!input.mutationRequested || approvalPresent);
    const willExecuteLive = liveReady && (!approvalRequired || approvalPresent);
    const willMutate = Boolean(willExecuteLive && input.mutationRequested && liveMutationAllowed);

    return {
      version: ZAVORTH_EXECUTION_BACKEND_PROVIDER_VERSION,
      generatedAt: this.now().toISOString(),
      backendId: input.backendId,
      status: liveReady ? 'certified' : input.configured ? 'attention' : 'needs-configuration',
      proofs,
      readiness: {
        configured: input.configured,
        liveReady,
        liveMutationAllowed,
        proofRefs: proofs.filter((proof) => proof.status === 'passed').map((proof) => `${input.backendId}:${proof.id}`),
      },
      executionPlan: {
        mode: willExecuteLive ? 'live' : 'dry-run',
        commandPreview,
        willMutate,
        reason: willExecuteLive
          ? 'Backend proof is current and approval state allows this plan.'
          : 'Backend is unproven, unconfigured or waiting for approval; dry-run only.',
      },
      approval: {
        required: approvalRequired,
        present: approvalPresent,
        reason: approvalRequired ? 'Mutation or high-risk command requires explicit approval.' : null,
      },
      safety: {
        noLiveMutationWithoutProof: true,
        unprovenBackendDryRunOnly: true,
        costEstimateRequired: true,
        rawSecretsSerialized: false,
      },
    };
  }

  public certifyFromTerminalBackendSnapshot(input: {
    snapshot: ZavorthTerminalBackendSnapshot;
    mutationRequested?: boolean;
    approvalId?: string | null;
    proofOverrides?: ZavorthBackendProofResults;
  }): ZavorthExecutionBackendProviderSnapshot {
    const selected = input.snapshot.backends.find((backend) => backend.id === input.snapshot.selectedBackend) || null;
    const baseProofs = this.proofsFromTerminalBackendSnapshot(input.snapshot);
    return this.certify({
      backendId: input.snapshot.selectedBackend,
      configured: selected?.liveReady === true || input.snapshot.plan.backendConfigured === true,
      command: input.snapshot.command.redacted || redactSensitiveText(input.snapshot.command.raw || ''),
      mutationRequested: input.mutationRequested ?? input.snapshot.command.risk !== 'read-only',
      approvalId: input.approvalId || null,
      proofResults: {
        ...baseProofs,
        ...(input.proofOverrides || {}),
      },
    });
  }

  private proofsFromTerminalBackendSnapshot(
    snapshot: ZavorthTerminalBackendSnapshot,
  ): ZavorthBackendProofResults {
    const selected = snapshot.backends.find((backend) => backend.id === snapshot.selectedBackend) || null;
    const readyBackend = selected?.status === 'ready' && selected.liveReady === true;
    const performed = snapshot.execution.performed === true && snapshot.status === 'executed';
    const streamed = performed && (Boolean(snapshot.execution.stdoutPreview) || Boolean(snapshot.execution.stderrPreview) || snapshot.execution.exitCode === 0);

    return {
      doctor: readyBackend,
      prepareWorkspace: readyBackend && snapshot.plan.backendConfigured === true,
      run: performed,
      stream: streamed,
      upload: false,
      download: false,
      snapshot: false,
      hibernate: false,
      resume: false,
      cleanup: performed && snapshot.execution.exitCode === 0,
      costEstimate: false,
    };
  }
}
