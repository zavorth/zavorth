import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createTwoFilesPatch } from 'diff';
import {
  DISK_MUTATION_GATE_CONTRACT_VERSION,
  type DiskMutationGateApplyResult,
  type DiskMutationGateFinding,
  type DiskMutationGateOperationPreview,
  type DiskMutationGatePreview,
  type DiskMutationGateReceipt,
  type DiskMutationGateReceiptOperation,
  type DiskMutationGateRequestedOperation,
  type DiskMutationGateStatus,
} from '../contracts/DiskMutationGateContract.js';
import { decideSecurityPolicy } from '../security/SecurityPolicyBroker.js';
import {
  OperatorContinuityKernel,
  decisionFromBroker,
  digestOperatorPayload,
  resultFromToolOutcome,
  type OperatorContinuityEnvelope,
} from '../runtime/operator/OperatorContinuityEnvelope.js';

import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

const MAX_CONTENT_BYTES = 1_000_000;

type DiskMutationGateFsRuntime = Pick<
  typeof fs,
  | 'existsSync'
  | 'readFileSync'
  | 'writeFileSync'
  | 'mkdirSync'
  | 'statSync'
  | 'lstatSync'
  | 'realpathSync'
  | 'unlinkSync'
>;

type StoredDiskMutationOperation = {
  id: string;
  kind: DiskMutationGateRequestedOperation['kind'];
  absolutePath: string;
  relativePath: string;
  content: string | null;
};

type StoredDiskMutationPreview = {
  preview: DiskMutationGatePreview;
  operations: StoredDiskMutationOperation[];
};

export type DiskMutationGateRuntime = Partial<DiskMutationGateFsRuntime> & {
  now?: () => Date;
  idFactory?: (prefix: string, seed: string) => string;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  continuityKernel?: OperatorContinuityKernel;
};

export type CreateDiskMutationGatePreviewInput = {
  workspaceRoot: string;
  operations: DiskMutationGateRequestedOperation[];
  requestedBy?: string | null;
  sourceSurface?: string | null;
  reason?: string | null;
};

export type ApplyDiskMutationGatePreviewInput = {
  workspaceRoot: string;
  previewId: string;
  approvalPhrase: string;
  approvedBy?: string | null;
};

export class DiskMutationGateService {
  private readonly fsRuntime: DiskMutationGateFsRuntime;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string, seed: string) => string;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  private readonly continuityKernel: OperatorContinuityKernel;
  private lastContinuityEnvelope: OperatorContinuityEnvelope | null = null;

  constructor(runtime: DiskMutationGateRuntime = {}) {
    this.fsRuntime = {
      existsSync: runtime.existsSync || fs.existsSync.bind(fs),
      readFileSync: runtime.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: runtime.writeFileSync || fs.writeFileSync.bind(fs),
      mkdirSync: runtime.mkdirSync || fs.mkdirSync.bind(fs),
      statSync: runtime.statSync || fs.statSync.bind(fs),
      lstatSync: runtime.lstatSync || fs.lstatSync.bind(fs),
      realpathSync: runtime.realpathSync || fs.realpathSync.bind(fs),
      unlinkSync: runtime.unlinkSync || fs.unlinkSync.bind(fs),
    };
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || ((prefix, seed) => `${prefix}-${sha256(seed).slice(0, 16)}`);
    this.mutationPlane = runtime.mutationPlane || new ZavorthMutationPlaneService();
    this.continuityKernel = runtime.continuityKernel || new OperatorContinuityKernel({ now: this.now });
  }

  public getLastContinuityEnvelope(): OperatorContinuityEnvelope | null {
    return this.lastContinuityEnvelope;
  }

  public buildStatus(input: { workspaceRoot: string; limit?: number | null }): DiskMutationGateStatus {
    const workspaceRoot = this.resolveWorkspaceRoot(input.workspaceRoot);
    const receipts = this.readReceipts(this.receiptPath(workspaceRoot))
      .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)))
      .slice(0, Math.max(1, Math.min(Number(input.limit || 20) || 20, 100)));
    return {
      contractVersion: DISK_MUTATION_GATE_CONTRACT_VERSION,
      source: 'DiskMutationGateService',
      generatedAt: this.now().toISOString(),
      workspaceRoot,
      receiptPath: this.receiptPath(workspaceRoot),
      receiptCount: receipts.length,
      receipts,
      safety: this.safety(),
    };
  }

  public createPreview(input: CreateDiskMutationGatePreviewInput): DiskMutationGatePreview {
    const workspaceRoot = this.resolveWorkspaceRoot(input.workspaceRoot);
    const generatedAt = this.now().toISOString();
    const requestedOperations = Array.isArray(input.operations) ? input.operations : [];
    const prepared = requestedOperations.map((operation, index) =>
      this.prepareOperation(workspaceRoot, operation, index),
    );
    const previews = prepared.map((entry) => entry.preview);
    const findings = previews.flatMap((operation) => operation.findings);
    if (requestedOperations.length === 0) {
      findings.push({
        id: 'no-operations',
        severity: 'blocked',
        path: null,
        message: 'No disk operation was provided to the gate.',
      });
    }
    const status = findings.some((finding) => finding.severity === 'blocked') ? 'blocked'
      : previews.every((operation) => operation.status === 'noop') ? 'noop'
        : 'preview_ready';
    const seed = JSON.stringify({
      workspaceRoot,
      generatedAt,
      operations: previews.map((operation) => ({
        kind: operation.kind,
        relativePath: operation.relativePath,
        before: operation.before.sha256,
        after: operation.after.sha256,
      })),
    });
    const previewId = this.idFactory('disk-preview', seed);
    const approvalPhrase = `APPROVE DISK MUTATION ${previewId}`;
    const mutationPlan = this.mutationPlane.createPlan({
      domain: 'disk-mutation',
      actionId: 'disk-mutation-gate',
      title: 'Universal disk mutation gate',
      summary: status === 'blocked'
        ? 'Disk mutation blocked during preview.'
        : `Preview for ${previews.length} disk mutation operation(s).`,
      requestedBy: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface) || 'disk-mutation-gate',
      riskLevel: status === 'blocked' ? 'high' : 'medium',
      approvalRequired: true,
      approvalReason: 'every disk mutation must pass through preview, approval and receipt.',
      resourceImpact: {
        diskMb: Math.ceil(previews.reduce((total, operation) => total + operation.after.bytes, 0) / 1024 / 1024),
        externalExposure: 'none',
        notes: previews.map((operation) => `${operation.kind}:${operation.relativePath}`),
      },
      validationPlan: [
        'Confirm path inside the workspace.',
        'Confirmar hash de precondicao before do apply.',
        'Generate receipt without raw content.',
      ],
      rollbackPlan: [
        'Automatic rollback is not produced by the universal gate.',
        'Use the receipt and workspace version control to reconstruct changes.',
      ],
      payload: {
        previewId,
        operationCount: previews.length,
        operations: previews.map((operation) => ({
          id: operation.id,
          kind: operation.kind,
          relativePath: operation.relativePath,
          beforeSha256: operation.before.sha256,
          afterSha256: operation.after.sha256,
          status: operation.status,
        })),
        reason: this.nullableText(input.reason),
      },
    });
    if (status === 'blocked') {
      this.mutationPlane.markBlocked(mutationPlan.id, 'Disk mutation gate blocked the preview.');
    }
    const preview: DiskMutationGatePreview = {
      contractVersion: DISK_MUTATION_GATE_CONTRACT_VERSION,
      source: 'DiskMutationGateService',
      previewId,
      mutationPlanId: mutationPlan.id,
      generatedAt,
      status,
      workspaceRoot,
      requestedBy: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface),
      operations: previews,
      findings,
      approval: {
        required: true,
        phrase: approvalPhrase,
        reason: 'disk mutation requires explicit approval before touching files.',
      },
      safety: this.safety(),
      receiptPath: this.receiptPath(workspaceRoot),
      summary: this.previewSummary(status, previews.length, findings.length),
    };
    this.persistPreview({
      preview,
      operations: status === 'blocked'
        ? []
        : prepared.map((entry) => entry.stored),
    });
    this.sealGateContinuity({
      operation: 'disk-mutation.preview',
      target: previewId,
      actorId: this.nullableText(input.requestedBy),
      sourceSurface: this.nullableText(input.sourceSurface) || 'disk-mutation-gate',
      mutationPlanId: mutationPlan.id,
      blocked: status === 'blocked',
      status: status === 'blocked' ? 'blocked' : 'preview',
      summary: preview.summary,
      argsDigest: digestOperatorPayload({
        operationCount: previews.length,
        status,
        paths: previews.map((operation) => operation.relativePath).slice(0, 12),
      }),
      data: {
        previewId,
        mutationPlanId: mutationPlan.id,
        status,
        findingCount: findings.length,
      },
    });
    return preview;
  }

  public applyPreview(input: ApplyDiskMutationGatePreviewInput): DiskMutationGateApplyResult {
    const workspaceRoot = this.resolveWorkspaceRoot(input.workspaceRoot);
    const stored = this.readPreview(workspaceRoot, input.previewId);
    const { preview } = stored;
    if (preview.status === 'blocked') {
      this.sealGateContinuity({
        operation: 'disk-mutation.apply',
        target: preview.previewId,
        actorId: this.nullableText(input.approvedBy),
        sourceSurface: 'disk-mutation-gate',
        mutationPlanId: preview.mutationPlanId,
        blocked: true,
        status: 'blocked',
        summary: 'Preview blocked by Disk Mutation Gate; apply refused.',
        argsDigest: digestOperatorPayload({ previewId: preview.previewId }),
        data: {
          previewId: preview.previewId,
          mutationPlanId: preview.mutationPlanId,
        },
      });
      throw new Error('Preview blocked by Disk Mutation Gate; no apply allowed.');
    }
    if (String(input.approvalPhrase || '').trim() !== preview.approval.phrase) {
      this.sealGateContinuity({
        operation: 'disk-mutation.apply',
        target: preview.previewId,
        actorId: this.nullableText(input.approvedBy),
        sourceSurface: 'disk-mutation-gate',
        mutationPlanId: preview.mutationPlanId,
        blocked: true,
        status: 'blocked',
        summary: 'Invalid approval phrase for disk mutation apply.',
        argsDigest: digestOperatorPayload({ previewId: preview.previewId }),
        data: {
          previewId: preview.previewId,
          mutationPlanId: preview.mutationPlanId,
          reason: 'invalid-approval-phrase',
        },
      });
      throw new Error(`Approval phrase invalid. Use: ${preview.approval.phrase}`);
    }
    if (path.resolve(preview.workspaceRoot) !== workspaceRoot) {
      this.sealGateContinuity({
        operation: 'disk-mutation.apply',
        target: preview.previewId,
        actorId: this.nullableText(input.approvedBy),
        sourceSurface: 'disk-mutation-gate',
        mutationPlanId: preview.mutationPlanId,
        blocked: true,
        status: 'blocked',
        summary: 'Disk mutation preview belongs to another workspace.',
        argsDigest: digestOperatorPayload({ previewId: preview.previewId }),
        data: {
          previewId: preview.previewId,
          mutationPlanId: preview.mutationPlanId,
          reason: 'workspace-mismatch',
        },
      });
      throw new Error('Preview pertence a outro workspace.');
    }

    this.mutationPlane.approvePlan(preview.mutationPlanId, {
      approvedBy: this.nullableText(input.approvedBy) || 'operator',
      scope: 'once',
    });

    const appliedOperations: DiskMutationGateReceiptOperation[] = [];
    try {
      for (const operation of stored.operations) {
        const operationPreview = preview.operations.find((entry) => entry.id === operation.id);
        if (!operationPreview || operationPreview.status === 'noop') {
          appliedOperations.push(this.receiptOperation(operation, operationPreview || null, 'noop'));
          continue;
        }
        // S2/S9: re-validate path containment at apply time (do not trust stored absolutePath alone).
        this.assertApplyPathStillInsideWorkspace(workspaceRoot, operation);
        this.assertPrecondition(operationPreview);
        this.applyOperation(operation);
        appliedOperations.push(this.receiptOperation(operation, this.inspectAppliedOperation(operation), 'applied'));
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.mutationPlane.markBlocked(
        preview.mutationPlanId,
        error instanceof Error ? err.message : String(error),
      );
      this.sealGateContinuity({
        operation: 'disk-mutation.apply',
        target: preview.previewId,
        actorId: this.nullableText(input.approvedBy),
        sourceSurface: 'disk-mutation-gate',
        mutationPlanId: preview.mutationPlanId,
        blocked: true,
        status: 'failed',
        summary: error instanceof Error ? err.message : String(error),
        argsDigest: digestOperatorPayload({ previewId: preview.previewId }),
        data: {
          previewId: preview.previewId,
          mutationPlanId: preview.mutationPlanId,
        },
      });
      throw error;
    }

    const appliedAt = this.now().toISOString();
    const receipt: DiskMutationGateReceipt = {
      contractVersion: DISK_MUTATION_GATE_CONTRACT_VERSION,
      receiptId: this.idFactory('disk-receipt', `${preview.previewId}:${appliedAt}`),
      previewId: preview.previewId,
      mutationPlanId: preview.mutationPlanId,
      generatedAt: preview.generatedAt,
      appliedAt,
      approvedBy: this.nullableText(input.approvedBy) || 'operator',
      workspaceRoot,
      operations: appliedOperations,
      findings: preview.findings,
      safety: preview.safety,
      rollback: {
        available: false,
        reason: 'Universal gate records hashes and paths, but does not store raw content for automatic rollback.',
      },
      summary: appliedOperations.some((operation) => operation.status === 'applied') ? `Applied ${appliedOperations.filter((operation) => operation.status === 'applied').length} disk mutation operation(s).`
        : 'No disk changes were needed.',
    };
    this.appendReceipt(preview.receiptPath, receipt);
    this.mutationPlane.markApplied(
      preview.mutationPlanId,
      receipt.summary,
      appliedOperations.map((operation) => `${operation.kind}:${operation.relativePath}`),
    );
    const applyStatus = appliedOperations.some((operation) => operation.status === 'applied') ? 'applied' : 'noop';
    this.sealGateContinuity({
      operation: 'disk-mutation.apply',
      target: preview.previewId,
      actorId: this.nullableText(input.approvedBy) || 'operator',
      sourceSurface: 'disk-mutation-gate',
      mutationPlanId: preview.mutationPlanId,
      blocked: false,
      status: applyStatus === 'applied' ? 'applied' : 'observation',
      summary: receipt.summary,
      argsDigest: digestOperatorPayload({
        previewId: preview.previewId,
        receiptId: receipt.receiptId,
        operationCount: appliedOperations.length,
      }),
      data: {
        previewId: preview.previewId,
        mutationPlanId: preview.mutationPlanId,
        receiptId: receipt.receiptId,
        status: applyStatus,
      },
      actionReceiptId: receipt.receiptId,
    });
    return {
      ok: true,
      status: applyStatus,
      preview,
      receipt,
    };
  }

  private sealGateContinuity(input: {
    operation: string;
    target: string;
    actorId?: string | null;
    sourceSurface: string;
    mutationPlanId?: string | null;
    blocked: boolean;
    status: 'preview' | 'blocked' | 'applied' | 'observation' | 'failed';
    summary: string;
    argsDigest: string;
    data?: Record<string, unknown>;
    actionReceiptId?: string | null;
  }): void {
    const brokerDecision = decideSecurityPolicy({
      surface: 'local-write',
      operation: input.operation,
      target: input.target,
      sourceTrust: 'trusted-user',
      blocked: input.blocked,
      risk: input.blocked ? 'forbidden' : 'review',
      rule: input.blocked ? 'DISK_MUTATION_GATE_BLOCKED' : 'DISK_MUTATION_GATE_CONTINUITY',
      reasons: [
        input.blocked ? 'Disk mutation gate decision blocked the request.'
          : 'Disk mutation gate decision sealed by operator continuity.',
        input.summary,
      ],
      metadata: {
        sourceSurface: input.sourceSurface,
        mutationPlanId: input.mutationPlanId || null,
      },
      toolDecision: input.blocked
        ? {
            action: 'deny',
            allowed: false,
            risk: 'forbidden',
            toolName: 'disk_mutation_gate',
            surface: 'native-tool',
            capabilities: ['filesystem', 'destructive'],
            requiresConfirmation: false,
            reasons: [input.summary],
            rule: 'DISK_MUTATION_GATE_BLOCKED',
          }
        : {
            action: 'allow',
            allowed: true,
            risk: 'review',
            toolName: 'disk_mutation_gate',
            surface: 'native-tool',
            capabilities: ['filesystem', 'audit'],
            requiresConfirmation: false,
            reasons: [input.summary],
            rule: 'DISK_MUTATION_GATE_CONTINUITY',
          },
    });

    let continuity = this.continuityKernel.begin({
      correlation: {
        mutationPlanId: input.mutationPlanId || null,
        policyBrokerReceiptId: brokerDecision.receipt.receiptId,
        actionReceiptId: input.actionReceiptId || null,
      },
    });
    continuity = this.continuityKernel.recordRequest(continuity, {
      surface: 'disk-mutation',
      operation: input.operation,
      target: input.target,
      actorId: input.actorId || null,
      sourceSurface: input.sourceSurface,
      argsDigest: input.argsDigest,
      metadata: {
        mutationPlanId: input.mutationPlanId || null,
      },
    });
    continuity = this.continuityKernel.attachDecision(
      continuity,
      decisionFromBroker(brokerDecision, {
        mutationPlanId: input.mutationPlanId || null,
        requiresApproval: input.operation === 'disk-mutation.preview' && !input.blocked,
      }),
    );
    continuity = this.continuityKernel.attachResult(continuity, resultFromToolOutcome({
      ok: !input.blocked && input.status !== 'failed',
      status: input.status,
      summary: input.summary,
      data: {
        ...(input.data || {}),
        policyBrokerReceiptId: brokerDecision.receipt.receiptId,
      },
    }));
    continuity = this.continuityKernel.finalizeReceipt(continuity, {
      receiptId: input.actionReceiptId || brokerDecision.receipt.receiptId,
    });
    this.lastContinuityEnvelope = continuity;
  }

  private prepareOperation(
    workspaceRoot: string,
    operation: DiskMutationGateRequestedOperation,
    index: number,
  ): {
    preview: DiskMutationGateOperationPreview;
    stored: StoredDiskMutationOperation;
  } {
    const operationId = `op-${index + 1}`;
    const requestedPath = String(operation.path || '').trim();
    const findings: DiskMutationGateFinding[] = [];
    const absolutePath = requestedPath
      ? path.resolve(path.isAbsolute(requestedPath) ? requestedPath : path.join(workspaceRoot, requestedPath))
      : workspaceRoot;
    const relativePath = toPosix(path.relative(workspaceRoot, absolutePath));
    const before = this.inspectPath(absolutePath);
    let proposedContent: string | null = null;
    let after: DiskMutationGateOperationPreview['after'] = {
      exists: before.exists,
      kind: before.kind === 'directory' ? 'directory' : before.exists ? 'file' : 'missing',
      sha256: before.sha256,
      bytes: before.bytes,
    };
    let diffPatch: string | null = null;

    this.collectPathFindings(workspaceRoot, absolutePath, relativePath, requestedPath, before, findings);

    switch (operation.kind) {
      case 'write_file': {
        const content = String(operation.content || '');
        this.collectContentFindings(content, relativePath, findings);
        proposedContent = content;
        after = {
          exists: true,
          kind: 'file',
          sha256: sha256(content),
          bytes: Buffer.byteLength(content, 'utf8'),
        };
        diffPatch = before.kind === 'file'
          ? createTwoFilesPatch(relativePath, relativePath, this.readTextFile(absolutePath), content, 'current', 'proposed', { context: 3 })
          : createTwoFilesPatch(relativePath, relativePath, '', content, 'missing', 'proposed', { context: 3 });
        if (before.exists && before.kind !== 'file') {
          findings.push(this.blocked(relativePath, 'write-target-not-file', 'write_file target exists and is not a regular file.'));
        }
        break;
      }
      case 'append_file': {
        const content = String(operation.content || '');
        this.collectContentFindings(content, relativePath, findings);
        const current = before.kind === 'file' ? this.readTextFile(absolutePath) : '';
        proposedContent = `${current}${content}`;
        after = {
          exists: true,
          kind: 'file',
          sha256: sha256(proposedContent),
          bytes: Buffer.byteLength(proposedContent, 'utf8'),
        };
        diffPatch = createTwoFilesPatch(relativePath, relativePath, current, proposedContent, before.exists ? 'current' : 'missing', 'proposed', { context: 3 });
        if (before.exists && before.kind !== 'file') {
          findings.push(this.blocked(relativePath, 'append-target-not-file', 'append_file target exists and is not a regular file.'));
        }
        break;
      }
      case 'delete_file': {
        after = {
          exists: false,
          kind: 'missing',
          sha256: null,
          bytes: 0,
        };
        diffPatch = before.kind === 'file'
          ? createTwoFilesPatch(relativePath, relativePath, this.readTextFile(absolutePath), '', 'current', 'deleted', { context: 3 })
          : null;
        if (!before.exists) {
          findings.push({
            id: 'delete-target-missing',
            severity: 'info',
            path: relativePath,
            message: 'Target file no longer exists; operation becomes noop.',
          });
        } else if (before.kind !== 'file') {
          findings.push(this.blocked(relativePath, 'delete-target-not-file', 'delete_file can only remove a regular file.'));
        }
        break;
      }
      case 'mkdir': {
        after = {
          exists: true,
          kind: 'directory',
          sha256: null,
          bytes: 0,
        };
        if (before.exists && before.kind !== 'directory') {
          findings.push(this.blocked(relativePath, 'mkdir-target-not-directory', 'mkdir can only create a directory or reuse an existing directory.'));
        }
        break;
      }
      default:
        findings.push(this.blocked(relativePath, 'unknown-operation', 'Unknown disk operation.'));
    }

    const blocked = findings.some((finding) => finding.severity === 'blocked');
    const secretLikeBlocked = findings.some((finding) => finding.id === 'secret-like-content');
    // Never keep secret bodies in preview diffs or stored apply payloads (S1).
    if (secretLikeBlocked) {
      diffPatch = null;
      proposedContent = null;
    }
    const noop = !blocked && this.isNoop(operation.kind, before, after);
    return {
      preview: {
        id: operationId,
        kind: operation.kind,
        requestedPath,
        absolutePath,
        relativePath,
        status: blocked ? 'blocked' : noop ? 'noop' : 'preview_ready',
        before,
        after,
        diffPatch,
        findings,
        reason: this.nullableText(operation.reason),
      },
      stored: {
        id: operationId,
        kind: operation.kind,
        absolutePath,
        relativePath,
        content: blocked ? null : proposedContent,
      },
    };
  }

  private applyOperation(operation: StoredDiskMutationOperation): void {
    switch (operation.kind) {
      case 'write_file':
      case 'append_file':
        this.fsRuntime.mkdirSync(path.dirname(operation.absolutePath), { recursive: true });
        this.fsRuntime.writeFileSync(operation.absolutePath, String(operation.content || ''), 'utf8');
        return;
      case 'delete_file':
        if (this.fsRuntime.existsSync(operation.absolutePath)) {
          this.fsRuntime.unlinkSync(operation.absolutePath);
        }
        return;
      case 'mkdir':
        this.fsRuntime.mkdirSync(operation.absolutePath, { recursive: true });
        return;
      default:
        throw new Error(`Unknown disk operation: ${(operation as { kind: string }).kind}`);
    }
  }

  /** Fail closed if stored apply paths left the workspace (tampered preview JSON). */
  private assertApplyPathStillInsideWorkspace(
    workspaceRoot: string,
    operation: StoredDiskMutationOperation,
  ): void {
    const absolute = path.resolve(operation.absolutePath);
    if (!isInsidePath(workspaceRoot, absolute)) {
      throw new Error(
        `Apply blocked: operation path escapes workspace (${operation.relativePath || absolute}).`,
      );
    }
    const relative = toPosix(path.relative(workspaceRoot, absolute));
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Apply blocked: relative path escapes workspace (${relative}).`);
    }
    // Recompute expected absolute from relativePath when present; reject mismatch.
    if (operation.relativePath) {
      const expected = path.resolve(workspaceRoot, operation.relativePath);
      if (path.resolve(expected) !== absolute) {
        throw new Error(
          `Apply blocked: absolutePath does not match relativePath for ${operation.relativePath}.`,
        );
      }
    }
  }

  private assertPrecondition(operation: DiskMutationGateOperationPreview): void {
    const current = this.inspectPath(operation.absolutePath);
    if (current.exists !== operation.before.exists || current.kind !== operation.before.kind || current.sha256 !== operation.before.sha256) {
      throw new Error(`Precondition failed for ${operation.relativePath}; file changed since the preview.`);
    }
  }

  private inspectAppliedOperation(operation: StoredDiskMutationOperation): DiskMutationGateOperationPreview {
    const after = this.inspectPath(operation.absolutePath);
    return {
      id: operation.id,
      kind: operation.kind,
      requestedPath: operation.relativePath,
      absolutePath: operation.absolutePath,
      relativePath: operation.relativePath,
      status: 'preview_ready',
      before: {
        exists: false,
        kind: 'missing',
        sha256: null,
        bytes: 0,
      },
      after: {
        exists: after.exists,
        kind: after.kind === 'directory' ? 'directory' : after.exists ? 'file' : 'missing',
        sha256: after.sha256,
        bytes: after.bytes,
      },
      diffPatch: null,
      findings: [],
      reason: null,
    };
  }

  private receiptOperation(
    operation: StoredDiskMutationOperation,
    preview: DiskMutationGateOperationPreview | null,
    status: 'applied' | 'noop',
  ): DiskMutationGateReceiptOperation {
    const current = this.inspectPath(operation.absolutePath);
    return {
      id: operation.id,
      kind: operation.kind,
      absolutePath: operation.absolutePath,
      relativePath: operation.relativePath,
      beforeSha256: preview?.before.sha256 || null,
      afterSha256: current.sha256,
      bytesBefore: preview?.before.bytes || 0,
      bytesAfter: current.bytes,
      status,
    };
  }

  private collectPathFindings(
    workspaceRoot: string,
    absolutePath: string,
    relativePath: string,
    requestedPath: string,
    before: DiskMutationGateOperationPreview['before'],
    findings: DiskMutationGateFinding[],
  ): void {
    if (!requestedPath) {
      findings.push(this.blocked(null, 'path-required', 'path is required for disk mutation.'));
      return;
    }
    if (!isInsidePath(workspaceRoot, absolutePath)) {
      findings.push(this.blocked(requestedPath, 'outside-workspace', 'mutation outside the workspace was blocked.'));
    }
    if (relativePath === '' || relativePath.startsWith('..')) {
      findings.push(this.blocked(requestedPath, 'invalid-relative-path', 'Path relactive invalid para workspace.'));
    }
    if (isProtectedRelativePath(relativePath)) {
      findings.push(this.blocked(relativePath, 'protected-path', 'Protected path requires a specialized tool, not the generic gate.'));
    }
    if (before.kind === 'symlink') {
      findings.push(this.blocked(relativePath, 'symlink-target', 'mutation por symlink e blocked.'));
    }
    const parent = nearestExistingParent(path.dirname(absolutePath), this.fsRuntime.existsSync);
    try {
      const realParent = this.fsRuntime.realpathSync(parent);
      if (!isInsidePath(workspaceRoot, realParent)) {
        findings.push(this.blocked(relativePath, 'parent-symlink-escape', 'Parent existente resolve outside do workspace.'));
      }
    } catch (error: unknown) {findings.push(this.blocked(relativePath, 'parent-resolution-failed', 'Could not resolve target parent.'));
    }
  }

  private collectContentFindings(content: string, relativePath: string, findings: DiskMutationGateFinding[]): void {
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_CONTENT_BYTES) {
      findings.push(this.blocked(relativePath, 'content-too-large', `Content exceeds ${MAX_CONTENT_BYTES} bytes.`));
    }
    if (containsSecretLikeContent(content)) {
      findings.push(this.blocked(relativePath, 'secret-like-content', 'Content appears to contain a secret; use secret refs or a specialized tool.'));
    }
  }

  private inspectPath(targetPath: string): DiskMutationGateOperationPreview['before'] {
    if (!this.fsRuntime.existsSync(targetPath)) {
      return { exists: false, kind: 'missing', sha256: null, bytes: 0 };
    }
    const stats = this.fsRuntime.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      return { exists: true, kind: 'symlink', sha256: null, bytes: 0 };
    }
    if (stats.isDirectory()) {
      return { exists: true, kind: 'directory', sha256: null, bytes: 0 };
    }
    if (stats.isFile()) {
      const content = this.fsRuntime.readFileSync(targetPath);
      return {
        exists: true,
        kind: 'file',
        sha256: sha256(content),
        bytes: content.byteLength,
      };
    }
    return { exists: true, kind: 'other', sha256: null, bytes: 0 };
  }

  private readTextFile(targetPath: string): string {
    return String(this.fsRuntime.readFileSync(targetPath, 'utf8') || '');
  }

  private isNoop(
    kind: DiskMutationGateRequestedOperation['kind'],
    before: DiskMutationGateOperationPreview['before'],
    after: DiskMutationGateOperationPreview['after'],
  ): boolean {
    if (kind === 'mkdir') {
      return before.exists && before.kind === 'directory';
    }
    if (kind === 'delete_file') {
      return !before.exists;
    }
    return before.exists === after.exists && before.sha256 === after.sha256 && before.kind === after.kind;
  }

  private persistPreview(stored: StoredDiskMutationPreview): void {
    const filePath = this.previewPath(stored.preview.workspaceRoot, stored.preview.previewId);
    this.fsRuntime.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fsRuntime.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  }

  private readPreview(workspaceRoot: string, previewId: string): StoredDiskMutationPreview {
    const normalized = String(previewId || '').trim();
    if (!/^[a-z0-9:._-]+$/i.test(normalized)) {
      throw new Error('previewId invalid.');
    }
    const filePath = this.previewPath(workspaceRoot, normalized);
    if (!this.fsRuntime.existsSync(filePath)) {
      throw new Error(`Disk mutation preview not found: ${normalized}`);
    }
    const parsed = JSON.parse(String(this.fsRuntime.readFileSync(filePath, 'utf8') || '{}'));
    if (!parsed?.preview || !Array.isArray(parsed.operations)) {
      throw new Error('Invalid disk mutation preview payload.');
    }
    return parsed as StoredDiskMutationPreview;
  }

  private appendReceipt(receiptPath: string, receipt: DiskMutationGateReceipt): void {
    const current = this.readReceipts(receiptPath);
    this.fsRuntime.mkdirSync(path.dirname(receiptPath), { recursive: true });
    this.fsRuntime.writeFileSync(
      receiptPath,
      `${JSON.stringify({
        contractVersion: DISK_MUTATION_GATE_CONTRACT_VERSION,
        updatedAt: receipt.appliedAt,
        receipts: [...current, receipt].slice(-500),
      }, null, 2)}\n`,
      'utf8',
    );
  }

  private readReceipts(receiptPath: string): DiskMutationGateReceipt[] {
    if (!this.fsRuntime.existsSync(receiptPath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(String(this.fsRuntime.readFileSync(receiptPath, 'utf8') || '{}'));
      return Array.isArray(parsed?.receipts) ? parsed.receipts as DiskMutationGateReceipt[] : [];
    } catch (error: unknown) {logger.warn('[Disk] JSON parse failed', error); return []; }
  }

  private resolveWorkspaceRoot(workspaceRoot: string): string {
    const resolved = path.resolve(String(workspaceRoot || '').trim() || process.cwd());
    if (!this.fsRuntime.existsSync(resolved)) {
      throw new Error(`Workspace root not found: ${resolved}`);
    }
    if (!this.fsRuntime.statSync(resolved).isDirectory()) {
      throw new Error(`Workspace root is not a directory: ${resolved}`);
    }
    return resolved;
  }

  private previewPath(workspaceRoot: string, previewId: string): string {
    return path.join(workspaceRoot, '.zavorth', 'previews', 'disk-mutation-gate', `${previewId}.json`);
  }

  private receiptPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, '.zavorth', 'receipts', 'disk-mutation-gate.json');
  }

  private safety(): DiskMutationGatePreview['safety'] {
    return {
      rawInstructionsExecuted: false,
      rawSecretsSerialized: false,
      policyBypassAllowed: false,
      previewBeforeApply: true,
      receiptRequired: true,
      outsideWorkspaceBlocked: true,
    };
  }

  private previewSummary(status: DiskMutationGatePreview['status'], operationCount: number, findingCount: number): string {
    if (status === 'blocked') {
      return `Disk mutation preview blocked with ${findingCount} finding(s).`;
    }
    if (status === 'noop') {
      return `Disk mutation preview found ${operationCount} noop operation(s).`;
    }
    return `Disk mutation preview ready for ${operationCount} operation(s).`;
  }

  private blocked(pathValue: string | null, id: string, message: string): DiskMutationGateFinding {
    return {
      id,
      severity: 'blocked',
      path: pathValue,
      message,
    };
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}

function nearestExistingParent(start: string, existsSync: typeof fs.existsSync): string {
  let current = path.resolve(start);
  for (;;) {
    if (existsSync(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
}

function isProtectedRelativePath(relativePath: string): boolean {
  const normalized = toPosix(relativePath).toLowerCase();
  const parts = normalized.split('/').filter(Boolean);
  const basename = parts.at(-1) || '';
  if (parts.includes('.git') || parts.includes('.ssh') || parts.includes('node_modules')) return true;
  if (parts[0] === '.zavorth' && (parts[1] === 'receipts' || parts[1] === 'previews')) return true;
  if (basename.startsWith('.env') && !/(example|sample|template)$/.test(basename)) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(basename)) return true;
  return false;
}

function containsSecretLikeContent(content: string): boolean {
  return /\b(?:token|api[_ -]?key|secret|password)\s*[:=]\s*([^\s,;]+)/i.test(content)
    || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(content)
    || /\bgh[pousr]_[A-Za-z0-9_]{8,}\b/.test(content)
    || /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/.test(content)
    || /\bAIza[0-9A-Za-z_-]{16,}\b/.test(content);
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
