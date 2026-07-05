import type {
  FileTransferEndpoint,
  FileTransferPolicyDecision,
  FileTransferRequest,
  FileTransferResult,
  FileTransferStatus,
} from '../contracts/FileTransferContract.js';
import { FILE_TRANSFER_CONTRACT_VERSION } from '../contracts/FileTransferContract.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { LocalFileTransferAdapter } from '../adapters/files/FileDocumentDiffLiveAdapters.js';
import { logger } from '../logger.js';

type FileTransferServiceOptions = {
  artifactDir?: string;
  workspaceRoots?: string[];
  now?: () => Date;
  adapter?: LocalFileTransferAdapter;
};

export type FileTransferLiveRequest = FileTransferRequest & {
  allowedRoots?: string[];
  confirmWrite?: boolean;
  allowMoveDelete?: boolean;
};

type ResolvedTransferEndpoint = {
  kind: FileTransferEndpoint['kind'];
  ref: string;
  filePath: string | null;
};

export class FileTransferService {
  private readonly artifactDir: string;
  private readonly workspaceRoots: string[];
  private readonly now: () => Date;
  private readonly adapter: LocalFileTransferAdapter;

  constructor(options: FileTransferServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'file-transfer');
    this.workspaceRoots = options.workspaceRoots || [process.cwd(), config.dataDir];
    this.now = options.now || (() => new Date());
    this.adapter = options.adapter || new LocalFileTransferAdapter();
  }

  public planTransfer(request: FileTransferRequest): FileTransferResult {
    const processedAt = this.now().toISOString();
    const policyDecision = this.policy(request);
    const status: FileTransferStatus = policyDecision.requiresApproval ? 'planned' : 'approved';
    const artifactId = request.destination.kind === 'artifact-ref'
      ? request.destination.ref
      : `file.transfer.${this.normalizeId(request.destination.ref)}`;

    return {
      ok: policyDecision.allowed,
      contractVersion: FILE_TRANSFER_CONTRACT_VERSION,
      status: policyDecision.allowed ? status : 'blocked',
      artifactId,
      bytesTransferred: null,
      policyDecision,
      receiptId: `${artifactId}.receipt`,
      processedAt,
      error: policyDecision.allowed ? null : policyDecision.reason,
    };
  }

  public async executeLive(request: FileTransferLiveRequest): Promise<FileTransferResult> {
    const processedAt = this.now().toISOString();
    const roots = this.allowedRoots(request.allowedRoots);
    const policyDecision = await this.livePolicy(request, roots);
    const artifactId = request.destination.kind === 'artifact-ref'
      ? request.destination.ref
      : `file.transfer.${randomUUID()}`;

    if (!policyDecision.allowed) {
      return {
        ok: false,
        contractVersion: FILE_TRANSFER_CONTRACT_VERSION,
        status: 'blocked',
        artifactId,
        bytesTransferred: null,
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: policyDecision.reason,
      };
    }

    try {
      const source = this.resolveEndpoint(request.source, roots);
      const destination = this.resolveEndpoint(request.destination, roots);
      if (!source.filePath || !destination.filePath) {
        throw new Error('file.transfer live execution requires local source and destination paths.');
      }
      await fs.promises.mkdir(path.dirname(destination.filePath), { recursive: true });
      const operation = request.direction === 'move' ? 'move' : 'copy';
      const result = await this.adapter.transfer({
        sourcePath: source.filePath,
        destinationPath: destination.filePath,
        overwrite: request.overwrite === true,
        operation,
      });
      return {
        ok: true,
        contractVersion: FILE_TRANSFER_CONTRACT_VERSION,
        status: 'completed',
        artifactId,
        bytesTransferred: result.bytesTransferred,
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error) {
    logger.warn('[File Transfer] filesystem check failed', error);
    return {
        ok: false,
        contractVersion: FILE_TRANSFER_CONTRACT_VERSION,
        status: 'failed',
        artifactId,
        bytesTransferred: null,
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: error instanceof Error ? error.message : String(error),
      };
  }
  }

  private policy(request: FileTransferRequest): FileTransferPolicyDecision {
    const external = request.source.kind === 'external-uri' || request.destination.kind === 'external-uri';
    const write = request.direction !== 'export' || request.destination.kind === 'workspace-path';
    return {
      allowed: true,
      reason: external
        ? 'External transfer is planned only and requires operator approval.'
        : 'Workspace/artifact transfer is governed by artifact-first policy.',
      requiresApproval: external || write || request.overwrite === true,
      redacted: true,
    };
  }

  private async livePolicy(
    request: FileTransferLiveRequest,
    roots: string[],
  ): Promise<FileTransferPolicyDecision> {
    if (request.source.kind === 'external-uri' || request.destination.kind === 'external-uri') {
      return {
        allowed: false,
        reason: 'file.transfer live execution blocks external-uri endpoints until an explicit connector adapter is selected.',
        requiresApproval: true,
        redacted: true,
      };
    }
    if (!request.confirmWrite) {
      return {
        allowed: false,
        reason: 'file.transfer live execution requires confirmWrite so workspace writes are operator-approved.',
        requiresApproval: true,
        redacted: true,
      };
    }
    if (request.direction === 'move' && !request.allowMoveDelete) {
      return {
        allowed: false,
        reason: 'file.transfer move requires allowMoveDelete because it removes the source path.',
        requiresApproval: true,
        redacted: true,
      };
    }

    const source = this.resolveEndpoint(request.source, roots);
    const destination = this.resolveEndpoint(request.destination, roots);
    if (!source.filePath || !destination.filePath) {
      return {
        allowed: false,
        reason: 'file.transfer live execution requires resolvable local file paths.',
        requiresApproval: true,
        redacted: true,
      };
    }
    if (!this.isWithinRoots(source.filePath, roots) || !this.isWithinRoots(destination.filePath, roots)) {
      return {
        allowed: false,
        reason: 'file.transfer live execution is limited to approved workspace/artifact roots.',
        requiresApproval: true,
        redacted: true,
      };
    }
    if (!fs.existsSync(source.filePath)) {
      return {
        allowed: false,
        reason: 'file.transfer source path does not exist.',
        requiresApproval: true,
        redacted: true,
      };
    }
    if (fs.existsSync(destination.filePath) && request.overwrite !== true) {
      return {
        allowed: false,
        reason: 'file.transfer destination exists and overwrite was not approved.',
        requiresApproval: true,
        redacted: true,
      };
    }
    return {
      allowed: true,
      reason: 'file.transfer approved for local bytes under workspace/artifact roots.',
      requiresApproval: true,
      redacted: true,
    };
  }

  private resolveEndpoint(endpoint: FileTransferEndpoint, roots: string[]): ResolvedTransferEndpoint {
    if (endpoint.kind === 'external-uri') {
      return {
        kind: endpoint.kind,
        ref: endpoint.ref,
        filePath: null,
      };
    }
    if (endpoint.kind === 'artifact-ref') {
      const ref = endpoint.ref.replace(/^artifact:\/\//i, '');
      const filePath = path.isAbsolute(ref) ? ref : path.join(this.artifactDir, ref);
      return {
        kind: endpoint.kind,
        ref: endpoint.ref,
        filePath: path.resolve(filePath),
      };
    }
    const root = roots[0] || process.cwd();
    const filePath = path.isAbsolute(endpoint.ref) ? endpoint.ref : path.join(root, endpoint.ref);
    return {
      kind: endpoint.kind,
      ref: endpoint.ref,
      filePath: path.resolve(filePath),
    };
  }

  private allowedRoots(extraRoots: string[] | undefined): string[] {
    return [...this.workspaceRoots, this.artifactDir, ...(extraRoots || [])]
      .map((root) => path.resolve(root));
  }

  private isWithinRoots(candidate: string, roots: string[]): boolean {
    const resolved = path.resolve(candidate);
    return roots.some((root) => {
      const normalizedRoot = path.resolve(root);
      const relative = path.relative(normalizedRoot, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'artifact';
  }
}
