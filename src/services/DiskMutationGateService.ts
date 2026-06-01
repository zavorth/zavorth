import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createTwoFilesPatch } from 'diff';
import { config } from '../config/index.js';
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
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';

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
        message: 'Nenhuma operacao de disco foi informada ao gate.',
      });
    }
    const status = findings.some((finding) => finding.severity === 'blocked')
      ? 'blocked'
      : previews.every((operation) => operation.status === 'noop')
        ? 'noop'
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
      approvalReason: 'Toda mutacao de disco deve passar por preview, approval e receipt.',
      resourceImpact: {
        diskMb: Math.ceil(previews.reduce((total, operation) => total + operation.after.bytes, 0) / 1024 / 1024),
        externalExposure: 'none',
        notes: previews.map((operation) => `${operation.kind}:${operation.relativePath}`),
      },
      validationPlan: [
        'Confirmar path dentro do workspace.',
        'Confirmar hash de precondicao antes do apply.',
        'Gerar receipt sem conteudo bruto.',
      ],
      rollbackPlan: [
        'Rollback automatico nao e produzido pelo gate universal.',
        'Use o receipt e o controle de versao do workspace para reconstruir alteracoes.',
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
        reason: 'Mutacao de disco requer approval explicito antes de tocar arquivos.',
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
    return preview;
  }

  public applyPreview(input: ApplyDiskMutationGatePreviewInput): DiskMutationGateApplyResult {
    const workspaceRoot = this.resolveWorkspaceRoot(input.workspaceRoot);
    const stored = this.readPreview(workspaceRoot, input.previewId);
    const { preview } = stored;
    if (preview.status === 'blocked') {
      throw new Error('Preview bloqueado pelo Disk Mutation Gate; nenhum apply permitido.');
    }
    if (String(input.approvalPhrase || '').trim() !== preview.approval.phrase) {
      throw new Error(`Approval phrase invalida. Use: ${preview.approval.phrase}`);
    }
    if (path.resolve(preview.workspaceRoot) !== workspaceRoot) {
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
        this.assertPrecondition(operationPreview);
        this.applyOperation(operation);
        appliedOperations.push(this.receiptOperation(operation, this.inspectAppliedOperation(operation), 'applied'));
      }
    } catch (error) {
      this.mutationPlane.markBlocked(
        preview.mutationPlanId,
        error instanceof Error ? error.message : String(error),
      );
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
        reason: 'Gate universal registra hashes e paths, mas nao armazena conteudo bruto para rollback automatico.',
      },
      summary: appliedOperations.some((operation) => operation.status === 'applied')
        ? `Applied ${appliedOperations.filter((operation) => operation.status === 'applied').length} disk mutation operation(s).`
        : 'No disk changes were needed.',
    };
    this.appendReceipt(preview.receiptPath, receipt);
    this.mutationPlane.markApplied(
      preview.mutationPlanId,
      receipt.summary,
      appliedOperations.map((operation) => `${operation.kind}:${operation.relativePath}`),
    );
    return {
      ok: true,
      status: appliedOperations.some((operation) => operation.status === 'applied') ? 'applied' : 'noop',
      preview,
      receipt,
    };
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
        const content = String(operation.content ?? '');
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
          findings.push(this.blocked(relativePath, 'write-target-not-file', 'O alvo de write_file existe e nao e arquivo regular.'));
        }
        break;
      }
      case 'append_file': {
        const content = String(operation.content ?? '');
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
          findings.push(this.blocked(relativePath, 'append-target-not-file', 'O alvo de append_file existe e nao e arquivo regular.'));
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
            message: 'Arquivo alvo ja nao existe; operacao vira noop.',
          });
        } else if (before.kind !== 'file') {
          findings.push(this.blocked(relativePath, 'delete-target-not-file', 'delete_file so pode remover arquivo regular.'));
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
          findings.push(this.blocked(relativePath, 'mkdir-target-not-directory', 'mkdir so pode criar diretorio ou reaproveitar diretorio existente.'));
        }
        break;
      }
      default:
        findings.push(this.blocked(relativePath, 'unknown-operation', 'Operacao de disco desconhecida.'));
    }

    const blocked = findings.some((finding) => finding.severity === 'blocked');
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
        this.fsRuntime.writeFileSync(operation.absolutePath, String(operation.content ?? ''), 'utf8');
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
        throw new Error(`Operacao de disco desconhecida: ${(operation as any).kind}`);
    }
  }

  private assertPrecondition(operation: DiskMutationGateOperationPreview): void {
    const current = this.inspectPath(operation.absolutePath);
    if (current.exists !== operation.before.exists || current.kind !== operation.before.kind || current.sha256 !== operation.before.sha256) {
      throw new Error(`Precondition failed for ${operation.relativePath}; arquivo mudou desde o preview.`);
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
      findings.push(this.blocked(null, 'path-required', 'path e obrigatorio para mutacao de disco.'));
      return;
    }
    if (!isInsidePath(workspaceRoot, absolutePath)) {
      findings.push(this.blocked(requestedPath, 'outside-workspace', 'Mutacao fora do workspace foi bloqueada.'));
    }
    if (relativePath === '' || relativePath.startsWith('..')) {
      findings.push(this.blocked(requestedPath, 'invalid-relative-path', 'Path relativo invalido para workspace.'));
    }
    if (isProtectedRelativePath(relativePath)) {
      findings.push(this.blocked(relativePath, 'protected-path', 'Path protegido exige ferramenta especializada, nao o gate generico.'));
    }
    if (before.kind === 'symlink') {
      findings.push(this.blocked(relativePath, 'symlink-target', 'Mutacao por symlink e bloqueada.'));
    }
    const parent = nearestExistingParent(path.dirname(absolutePath), this.fsRuntime.existsSync);
    try {
      const realParent = this.fsRuntime.realpathSync(parent);
      if (!isInsidePath(workspaceRoot, realParent)) {
        findings.push(this.blocked(relativePath, 'parent-symlink-escape', 'Parent existente resolve fora do workspace.'));
      }
    } catch {
      findings.push(this.blocked(relativePath, 'parent-resolution-failed', 'Nao foi possivel resolver o parent do alvo.'));
    }
  }

  private collectContentFindings(content: string, relativePath: string, findings: DiskMutationGateFinding[]): void {
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_CONTENT_BYTES) {
      findings.push(this.blocked(relativePath, 'content-too-large', `Conteudo excede ${MAX_CONTENT_BYTES} bytes.`));
    }
    if (containsSecretLikeContent(content)) {
      findings.push(this.blocked(relativePath, 'secret-like-content', 'Conteudo parece conter segredo; use secret refs ou ferramenta especializada.'));
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
      throw new Error('previewId invalido.');
    }
    const filePath = this.previewPath(workspaceRoot, normalized);
    if (!this.fsRuntime.existsSync(filePath)) {
      throw new Error(`Preview de mutacao de disco nao encontrado: ${normalized}`);
    }
    const parsed = JSON.parse(String(this.fsRuntime.readFileSync(filePath, 'utf8') || '{}'));
    if (!parsed?.preview || !Array.isArray(parsed.operations)) {
      throw new Error(`Preview de mutacao de disco invalido: ${normalized}`);
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
    } catch {
      return [];
    }
  }

  private resolveWorkspaceRoot(workspaceRoot: string): string {
    const resolved = path.resolve(String(workspaceRoot || '').trim() || process.cwd());
    if (!this.fsRuntime.existsSync(resolved)) {
      throw new Error(`Workspace root nao encontrado: ${resolved}`);
    }
    if (!this.fsRuntime.statSync(resolved).isDirectory()) {
      throw new Error(`Workspace root nao e diretorio: ${resolved}`);
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
  return /\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/i.test(content)
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
