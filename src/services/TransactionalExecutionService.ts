import type {
  AgentOsImpactSimulation,
  AgentOsPermissionLease,
  AgentOsTransactionalCommitResult,
  AgentOsTransactionalPlan,
  AgentOsWorkspaceWrite,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceExecutionProposal } from '../contracts/IntelligenceFabricContract.js';
import type { ZavorthMutationPlan } from '../contracts/ZavorthMutationPlaneContract.js';
import fs from 'fs';
import path from 'path';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { AgentOsRollbackManagerService } from './AgentOsRollbackManagerService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { agentOsHash, isAgentOsSensitivePath, looksLikeAgentOsSecret, truncateAgentOsText } from './AgentOsTextSafety.js';

type TransactionRuntime = {
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'markApplied' | 'markBlocked'> | null;
  rollbackManager?: AgentOsRollbackManagerService | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class TransactionalExecutionService {
  private readonly now: () => Date;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'markApplied' | 'markBlocked'>;
  private readonly rollbackManager: AgentOsRollbackManagerService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: TransactionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.mutationPlane = runtime.mutationPlane || new ZavorthMutationPlaneService();
    this.rollbackManager = runtime.rollbackManager || new AgentOsRollbackManagerService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public prepare(input: {
    proposal: IntelligenceExecutionProposal;
    simulation: AgentOsImpactSimulation;
    permissionLease: AgentOsPermissionLease;
    requestedBy?: string | null;
    surface?: string | null;
    workspaceRoot?: string | null;
    workspaceWrites?: AgentOsWorkspaceWrite[] | null;
    persistMutationPlan?: boolean;
  }): AgentOsTransactionalPlan {
    const transactionId = `agent-os-tx-${agentOsHash({ proposal: input.proposal.id, at: this.now().toISOString() })}`;
    const writeBlockers = this.validateWorkspaceWrites({
      workspaceRoot: input.workspaceRoot || null,
      workspaceWrites: input.workspaceWrites || [],
    });
    const blocked = input.simulation.status === 'blocked' || input.permissionLease.status === 'blocked' || writeBlockers.length > 0;
    const approvalRequired = input.simulation.requiresApproval || input.proposal.requiresApproval;
    const mutationPlan = input.persistMutationPlan === true
      ? this.createMutationPlan({ ...input, transactionId, blocked, approvalRequired, writeBlockers })
      : null;
    return {
      source: 'TransactionalExecutionService',
      transactionId,
      mutationPlanId: mutationPlan?.id || null,
      status: blocked ? 'blocked' : approvalRequired ? 'waiting_approval' : 'draft',
      proposal: input.proposal,
      simulation: input.simulation,
      permissionLease: input.permissionLease,
      liveActionApplied: false,
      commitRequiresRiskGate: true,
      rollbackRequired: input.simulation.rollbackRequired,
      rollbackPrepared: input.simulation.rollbackRequired && input.simulation.rollbackAvailable,
      rollbackArtifactPath: null,
      receipts: [
        'transaction-begin-draft',
        'transaction-simulated-before-commit',
        'transaction-commit-requires-risk-gate',
        input.workspaceWrites?.length ? 'transaction-workspace-writes-ready-for-governed-apply' : 'transaction-no-live-workspace-writes',
        blocked ? 'transaction-blocked' : 'transaction-ready-for-review',
      ],
    };
  }

  public commit(input: {
    mutationPlanId: string;
    approved?: boolean;
    riskGatePassed?: boolean;
  }): AgentOsTransactionalCommitResult {
    const plan = this.mutationPlane.readPlan(input.mutationPlanId);
    if (!plan) return this.commitBlocked(input.mutationPlanId, null, 'Mutation plan nao encontrado.');
    const payload = readPayload(plan.payload);
    const transactionId = stringOrNull(payload.transactionId);
    if (plan.status === 'blocked' || plan.status === 'expired' || plan.status === 'applied') {
      return this.commitBlocked(plan.id, transactionId, `Commit bloqueado para plano em status ${plan.status}.`);
    }
    if (plan.approval.required && plan.approval.status !== 'approved' && input.approved !== true) {
      this.mutationPlane.markBlocked(plan.id, 'Commit bloqueado sem approval requerido.');
      return this.commitBlocked(plan.id, transactionId, 'Commit bloqueado sem approval requerido.');
    }
    if (input.riskGatePassed !== true) {
      this.mutationPlane.markBlocked(plan.id, 'Commit bloqueado sem Risk Gate confirmado.');
      return this.commitBlocked(plan.id, transactionId, 'Commit bloqueado sem Risk Gate confirmado.');
    }
    if (payload.source !== 'ZavorthAgentOs' || payload.commitRequiresRiskGate !== true || payload.liveActionApplied === true) {
      this.mutationPlane.markBlocked(plan.id, 'Payload de transacao Agent OS invalido.');
      return this.commitBlocked(plan.id, transactionId, 'Payload de transacao Agent OS invalido.');
    }
    const workspaceRoot = stringOrNull(payload.workspaceRoot);
    const workspaceWrites = parseWorkspaceWrites(payload.workspaceWrites);
    if (!workspaceRoot || workspaceWrites.length === 0) {
      this.mutationPlane.markBlocked(plan.id, 'Commit live exige workspaceWrites explicitos.');
      return this.commitBlocked(plan.id, transactionId, 'Commit live exige workspaceWrites explicitos.');
    }
    const validation = this.validateWorkspaceWrites({ workspaceRoot, workspaceWrites });
    if (validation.length > 0) {
      this.mutationPlane.markBlocked(plan.id, validation.join('; '));
      return this.commitBlocked(plan.id, transactionId, validation.join('; '), validation);
    }
    try {
      const rollbackFiles = workspaceWrites.map((write) => {
        const target = WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, write.path);
        return {
          path: write.path,
          previousContent: this.existsSync(target) ? this.readFileSync(target, 'utf8') : null,
          existedBefore: this.existsSync(target),
        };
      });
      const rollback = this.rollbackManager.prepare({
        transactionId: transactionId || plan.id,
        workspaceRoot,
        files: rollbackFiles,
      });
      if (rollback.status !== 'prepared' || !rollback.artifactPath) {
        this.mutationPlane.markBlocked(plan.id, rollback.summary);
        return this.commitBlocked(plan.id, transactionId, rollback.summary, [rollback.summary]);
      }
      try {
        for (const write of workspaceWrites) {
          const target = WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, write.path);
          this.mkdirSync(path.dirname(target), { recursive: true });
          this.writeFileSync(target, write.content, 'utf8');
        }
      } catch (error) {
        this.rollbackManager.restore({ workspaceRoot, artifactPath: rollback.artifactPath });
        const summary = `Falha no apply; rollback executado: ${error instanceof Error ? error.message : String(error)}`;
        this.mutationPlane.markBlocked(plan.id, summary);
        return {
          source: 'TransactionalExecutionService',
          transactionId,
          mutationPlanId: plan.id,
          status: 'failed',
          liveActionApplied: false,
          summary,
          appliedActions: [],
          touchedFiles: workspaceWrites.map((write) => truncateAgentOsText(write.path, 160)),
          rollbackAvailable: true,
          rollbackArtifactPath: rollback.artifactPath,
          blockedReasons: [summary],
        };
      }
      const touchedFiles = workspaceWrites.map((write) => truncateAgentOsText(write.path, 160));
      this.mutationPlane.markApplied(plan.id, `${workspaceWrites.length} workspace write(s) applied by Agent OS transaction.`, [
        'agent-os.transaction.commit',
        ...touchedFiles.map((file) => `workspace-write:${file}`),
      ]);
      return {
        source: 'TransactionalExecutionService',
        transactionId,
        mutationPlanId: plan.id,
        status: 'applied',
        liveActionApplied: true,
        summary: `${workspaceWrites.length} workspace write(s) applied with rollback artifact.`,
        appliedActions: touchedFiles.map((file) => `workspace-write:${file}`),
        touchedFiles,
        rollbackAvailable: true,
        rollbackArtifactPath: rollback.artifactPath,
        blockedReasons: [],
      };
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      this.mutationPlane.markBlocked(plan.id, summary);
      return this.commitBlocked(plan.id, transactionId, summary, [summary]);
    }
  }

  private createMutationPlan(input: {
    proposal: IntelligenceExecutionProposal;
    simulation: AgentOsImpactSimulation;
    permissionLease: AgentOsPermissionLease;
    requestedBy?: string | null;
    surface?: string | null;
    workspaceRoot?: string | null;
    workspaceWrites?: AgentOsWorkspaceWrite[] | null;
    transactionId: string;
    blocked: boolean;
    approvalRequired: boolean;
    writeBlockers: string[];
  }): ZavorthMutationPlan {
    const plan = this.mutationPlane.createPlan({
      domain: 'workspace-canvas',
      actionId: 'agent-os.transaction.prepare',
      title: 'Agent OS transaction',
      summary: input.proposal.summary,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.surface || 'agent-os',
      riskLevel: input.proposal.riskLevel >= 5 ? 'critical' : input.proposal.riskLevel >= 4 ? 'high' : input.proposal.riskLevel >= 3 ? 'medium' : 'low',
      approvalRequired: input.approvalRequired,
      approvalReason: 'Agent OS commit requires Risk Gate/approval before impact.',
      validationPlan: input.simulation.recommendedTests,
      rollbackPlan: input.simulation.rollbackAvailable ? ['Use rollback artifact before marking live impact final.'] : ['Rollback unavailable; require explicit approval.'],
      payload: {
        source: 'ZavorthAgentOs',
        transactionId: input.transactionId,
        liveActionApplied: false,
        commitRequiresRiskGate: true,
        simulationId: input.simulation.id,
        permissionLeaseId: input.permissionLease.id,
        workspaceRoot: input.workspaceRoot || null,
        workspaceWrites: input.writeBlockers.length > 0 ? [] : (input.workspaceWrites || []).map((write) => ({
          path: truncateAgentOsText(write.path, 220),
          content: write.content,
          actionId: write.actionId || null,
          description: truncateAgentOsText(write.description || '', 220),
        })),
        writeBlockers: input.writeBlockers,
      },
    });
    return input.blocked ? this.mutationPlane.markBlocked(plan.id, 'Agent OS simulation or permission lease blocked this transaction.') : plan;
  }

  private validateWorkspaceWrites(input: {
    workspaceRoot: string | null;
    workspaceWrites: AgentOsWorkspaceWrite[];
  }): string[] {
    if (input.workspaceWrites.length === 0) return [];
    if (!input.workspaceRoot) return ['workspaceRoot ausente para workspaceWrites.'];
    const blockers: string[] = [];
    for (const write of input.workspaceWrites) {
      if (!write.path || isAgentOsSensitivePath(write.path)) {
        blockers.push(`workspace write bloqueado por path sensivel: ${truncateAgentOsText(write.path || 'n/d', 120)}`);
        continue;
      }
      if (looksLikeAgentOsSecret(write.path) || looksLikeAgentOsSecret(write.content)) {
        blockers.push(`workspace write bloqueado para evitar serializar segredo: ${truncateAgentOsText(write.path, 120)}`);
        continue;
      }
      if (Buffer.byteLength(write.content || '', 'utf8') > 1024 * 1024) {
        blockers.push(`workspace write excede 1MB: ${truncateAgentOsText(write.path, 120)}`);
        continue;
      }
      try {
        WorkspaceResolver.ensurePathInsideWorkspace(input.workspaceRoot, write.path);
      } catch (error) {
        blockers.push(error instanceof Error ? error.message : String(error));
      }
    }
    return blockers;
  }

  private commitBlocked(
    mutationPlanId: string,
    transactionId: string | null,
    summary: string,
    blockedReasons: string[] = [summary],
  ): AgentOsTransactionalCommitResult {
    return {
      source: 'TransactionalExecutionService',
      transactionId,
      mutationPlanId,
      status: 'blocked',
      liveActionApplied: false,
      summary,
      appliedActions: [],
      touchedFiles: [],
      rollbackAvailable: false,
      rollbackArtifactPath: null,
      blockedReasons,
    };
  }
}

function readPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function parseWorkspaceWrites(value: unknown): AgentOsWorkspaceWrite[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      path: String(entry.path || '').trim(),
      content: String(entry.content ?? ''),
      actionId: stringOrNull(entry.actionId),
      description: stringOrNull(entry.description),
    }))
    .filter((entry) => entry.path.length > 0);
}
