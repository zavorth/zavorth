import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthPatchRiskLedgerSnapshot,
  ZavorthPatchRiskReceipt,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
};

const PATCH_DIRECTORIES = [
  'patches',
  'vendor/patches',
  'third_party/patches',
];

export class ZavorthPatchRiskLedgerService {
  private readonly now: () => Date;
  private readonly rootDir: string;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
  }

  public buildSnapshot(): ZavorthPatchRiskLedgerSnapshot {
    const patchFiles = this.discoverPatchFiles();
    const receipts = patchFiles.length > 0
      ? patchFiles.map((patchFile) => this.buildPatchReceipt(patchFile))
      : [this.buildNoPatchReceipt()];
    const hasUnacceptedPatch = receipts.some((receipt) => receipt.decision === 'owner-decision-required');

    return {
      status: hasUnacceptedPatch ? 'warn' : 'pass',
      patchFilesObserved: patchFiles.length,
      receipts,
      dependencyPatchesAcceptedSilently: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private discoverPatchFiles(): string[] {
    const files: string[] = [];
    for (const relativeDir of PATCH_DIRECTORIES) {
      const absoluteDir = path.join(this.rootDir, relativeDir);
      if (!fs.existsSync(absoluteDir)) {
        continue;
      }
      const stack = [absoluteDir];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const child = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(child);
          } else if (/\.(patch|diff)$/i.test(entry.name)) {
            files.push(normalizePath(path.relative(this.rootDir, child)));
          }
        }
      }
    }
    return files.sort();
  }

  private buildPatchReceipt(patchFile: string): ZavorthPatchRiskReceipt {
    return {
      id: `zavorth.phase7.patch-risk.${safeId(patchFile)}.${this.now().getTime()}.receipt`,
      familyId: 'patch-risk',
      checkId: `patch.${safeId(patchFile)}`,
      patchId: patchFile,
      decision: 'owner-decision-required',
      label: 'Dependency patch is tracked',
      status: 'warn',
      severity: 'required',
      evidenceKind: 'patch-ledger',
      target: 'Dependency patches must have explicit owner review before release.',
      observed: `${patchFile} is present and tracked by the patch-risk ledger`,
      command: null,
      artifactFirst: true,
      localCheckPerformed: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: ['Patch file presence is never accepted silently by Phase 7.'],
    };
  }

  private buildNoPatchReceipt(): ZavorthPatchRiskReceipt {
    return {
      id: `zavorth.phase7.patch-risk.none.${this.now().getTime()}.receipt`,
      familyId: 'patch-risk',
      checkId: 'patch.none-present',
      patchId: 'none',
      decision: 'none-present',
      label: 'No dependency patch files are present',
      status: 'pass',
      severity: 'required',
      evidenceKind: 'patch-ledger',
      target: 'Dependency patches are either absent or explicitly tracked.',
      observed: 'no patch files found in known patch directories',
      command: null,
      artifactFirst: true,
      localCheckPerformed: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: ['The ledger still emits a receipt so absence is machine-readable.'],
    };
  }
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
