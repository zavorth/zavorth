import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { LocalArtifactDiffAdapter } from '../adapters/files/FileDocumentDiffLiveAdapters.js';
import type {
  ArtifactDiffPolicyDecision,
  ArtifactDiffRequest,
  ArtifactDiffResult,
  ArtifactDiffSource,
} from '../contracts/ArtifactDiffContract.js';
import { ARTIFACT_DIFF_CONTRACT_VERSION } from '../contracts/ArtifactDiffContract.js';

type ArtifactDiffServiceOptions = {
  artifactDir?: string;
  workspaceRoots?: string[];
  now?: () => Date;
  adapter?: LocalArtifactDiffAdapter;
};

type ResolvedDiffSource = {
  label: string;
  text: string;
  path: string | null;
};

export class ArtifactDiffService {
  private readonly artifactDir: string;
  private readonly workspaceRoots: string[];
  private readonly now: () => Date;
  private readonly adapter: LocalArtifactDiffAdapter;

  constructor(options: ArtifactDiffServiceOptions = {}) {
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'artifact-diff');
    this.workspaceRoots = options.workspaceRoots || [process.cwd(), config.dataDir];
    this.now = options.now || (() => new Date());
    this.adapter = options.adapter || new LocalArtifactDiffAdapter();
  }

  public async createDiffArtifact(request: ArtifactDiffRequest): Promise<ArtifactDiffResult> {
    const processedAt = this.now().toISOString();
    const roots = this.allowedRoots(request.allowedRoots);
    const policyDecision = this.policy(request, roots);
    const artifactId = `artifact.diff.${randomUUID()}`;

    if (!policyDecision.allowed) {
      return {
        ok: false,
        contractVersion: ARTIFACT_DIFF_CONTRACT_VERSION,
        artifact: null,
        summary: null,
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: policyDecision.reason,
      };
    }

    try {
      const left = await this.resolveSource(request.left, roots);
      const right = await this.resolveSource(request.right, roots);
      const patch = this.adapter.createPatch({
        leftLabel: left.label,
        rightLabel: right.label,
        leftText: left.text,
        rightText: right.text,
      });
      const outputDir = path.resolve(request.outputDir || this.artifactDir);
      await fs.promises.mkdir(outputDir, { recursive: true });
      const storageRef = path.join(outputDir, `${artifactId}.diff`);
      await fs.promises.writeFile(storageRef, patch, 'utf8');
      const hunks = (patch.match(/^@@/gm) || []).length;
      const changedLines = patch.split(/\r?\n/)
        .filter((line) => /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line)).length;
      return {
        ok: true,
        contractVersion: ARTIFACT_DIFF_CONTRACT_VERSION,
        artifact: {
          artifactId,
          contentType: 'text/x-diff',
          storageRef,
          bytes: Buffer.byteLength(patch, 'utf8'),
          hunks,
        },
        summary: {
          leftLabel: left.label,
          rightLabel: right.label,
          changedLines,
          hunks,
          emptyDiff: changedLines === 0,
        },
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        contractVersion: ARTIFACT_DIFF_CONTRACT_VERSION,
        artifact: null,
        summary: null,
        policyDecision,
        receiptId: `${artifactId}.receipt`,
        processedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private policy(request: ArtifactDiffRequest, roots: string[]): ArtifactDiffPolicyDecision {
    const outputDir = path.resolve(request.outputDir || this.artifactDir);
    if (!this.isWithinRoots(outputDir, roots)) {
      return {
        allowed: false,
        reason: 'artifact.diff output directory must be inside an approved artifact/workspace root.',
        workspaceReadAllowed: true,
        artifactWriteAllowed: false,
        redacted: true,
      };
    }
    const sources = [request.left, request.right];
    for (const source of sources) {
      if (source.kind === 'inline-text') continue;
      const filePath = this.sourcePath(source, roots);
      if (!filePath || !this.isWithinRoots(filePath, roots)) {
        return {
          allowed: false,
          reason: 'artifact.diff live execution is limited to approved workspace/artifact roots.',
          workspaceReadAllowed: false,
          artifactWriteAllowed: true,
          redacted: true,
        };
      }
    }
    return {
      allowed: true,
      reason: 'artifact.diff approved for local text/file inputs and artifact output.',
      workspaceReadAllowed: true,
      artifactWriteAllowed: true,
      redacted: true,
    };
  }

  private async resolveSource(source: ArtifactDiffSource, roots: string[]): Promise<ResolvedDiffSource> {
    if (source.kind === 'inline-text') {
      return {
        label: source.label || source.ref || 'inline',
        text: source.text || source.ref || '',
        path: null,
      };
    }
    const filePath = this.sourcePath(source, roots);
    if (!filePath) {
      throw new Error(`Cannot resolve diff source: ${source.ref}`);
    }
    const text = await fs.promises.readFile(filePath, 'utf8');
    return {
      label: source.label || path.basename(filePath),
      text,
      path: filePath,
    };
  }

  private sourcePath(source: ArtifactDiffSource, roots: string[]): string | null {
    if (source.kind === 'inline-text') return null;
    if (source.kind === 'artifact-ref') {
      const ref = source.ref.replace(/^artifact:\/\//i, '');
      return path.resolve(path.isAbsolute(ref) ? ref : path.join(this.artifactDir, ref));
    }
    const root = roots[0] || process.cwd();
    return path.resolve(path.isAbsolute(source.ref) ? source.ref : path.join(root, source.ref));
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
}
