import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type {
ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseEvidenceKind,
  ZavorthQaSecurityReleaseSeverity,
  ZavorthReleaseAcceptanceReceipt,
  ZavorthReleaseAcceptanceSnapshot,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packageManifest?: PackageManifest;
};

type PackageManifest = {
  scripts?: Record<string, string>;
  bin?: Record<string, string>;
  files?: string[];
  exports?: Record<string, unknown>;
};

type ReleaseCheck = {
  acceptanceId: string;
  label: string;
  severity: ZavorthQaSecurityReleaseSeverity;
  evidenceKind: ZavorthQaSecurityReleaseEvidenceKind;
  scriptName?: string;
  manifestCheck?: (manifest: PackageManifest) => boolean;
  command?: string;
  target: string;
  notes: string[];
};

const RELEASE_CHECKS: ReleaseCheck[] = [
  {
    acceptanceId: 'runtime-typecheck-release-gate',
    label: 'Runtime typecheck release gate is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'runtime:check',
    target: 'Release acceptance includes a local runtime typecheck gate.',
    notes: ['This is the first release acceptance gate for API and contract drift.'],
  },
  {
    acceptanceId: 'final-certification-release-gate',
    label: 'Final absorption certification gate is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'final-absorption-certification:check',
    target: 'Final absorption certification remains part of release acceptance.',
    notes: ['The Surface controls pack links prior certification to release readiness.'],
  },
  {
    acceptanceId: 'release-hardening-gate',
    label: 'Release hardening gate is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'release-certification-hardening:check',
    target: 'Release profile hardening can be checked locally.',
    notes: ['This gate is required before treating a package as releasable.'],
  },
  {
    acceptanceId: 'runtime-gateway-device-release-gate',
    label: 'Native companion device release gate is registered',
    severity: 'required',
    evidenceKind: 'local-command',
    scriptName: 'zavorth-native-companion-device-pack:check',
    target: 'Runtime gateway device behavior remains part of release acceptance.',
    notes: ['The check keeps optional native/device surfaces owner-gated and receipt-first.'],
  },
  {
    acceptanceId: 'surface-controls-release-gate',
    label: 'Surface controls certification gate is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'zavorth-qa-security-release-certification-pack:check',
    target: 'The Surface controls pack can certify itself locally.',
    notes: ['Self-registration prevents the certification runner from becoming a hidden-only API.'],
  },
  {
    acceptanceId: 'cli-bin-release-surface',
    label: 'CLI bin release surface is present',
    severity: 'blocking',
    evidenceKind: 'package-manifest',
    manifestCheck: (manifest) => manifest.bin?.zavorth === 'bin/zavorth.js',
    target: 'The package exposes the Zavorth CLI bin.',
    notes: ['Release acceptance requires a concrete CLI entrypoint.'],
  },
  {
    acceptanceId: 'dist-files-release-surface',
    label: 'Distribution files are included',
    severity: 'blocking',
    evidenceKind: 'package-manifest',
    manifestCheck: (manifest) => Boolean(manifest.files?.includes('dist/')),
    target: 'The package includes compiled runtime output.',
    notes: ['Release acceptance treats dist output as an explicit package file surface.'],
  },
  {
    acceptanceId: 'sdk-export-release-surface',
    label: 'Surface controls SDK export is present',
    severity: 'required',
    evidenceKind: 'package-manifest',
    manifestCheck: (manifest) => Boolean(manifest.exports?.['./sdk/qa-security-release-certification-pack']),
    target: 'The Surface controls certification pack is importable from the SDK surface.',
    notes: ['Operators can use the certification pack without importing private service paths.'],
  },
];

export class ZavorthReleaseAcceptanceCheckService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly packageManifest: PackageManifest;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.packageManifest = runtime.packageManifest || readPackageManifest(this.rootDir);
  }

  public buildSnapshot(): ZavorthReleaseAcceptanceSnapshot {
    const receipts = RELEASE_CHECKS.map((check) => this.buildReceipt(check));
    return {
      status: combineStatuses(receipts.map((receipt) => receipt.status)),
      acceptanceChecks: receipts.length,
      receipts,
      packageBinPresent: this.packageManifest.bin?.zavorth === 'bin/zavorth.js',
      packageDistExported: Boolean(this.packageManifest.files?.includes('dist/')),
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private buildReceipt(check: ReleaseCheck): ZavorthReleaseAcceptanceReceipt {
    const hasEvidence = check.scriptName
      ? Boolean(this.packageManifest.scripts?.[check.scriptName])
      : check.manifestCheck
        ? check.manifestCheck(this.packageManifest)
        : false;
    const status = hasEvidence
      ? 'pass'
      : check.severity === 'blocking'
        ? 'fail'
        : 'warn';

    return {
      id: `zavorth.surface-controls.release.${check.acceptanceId}.${this.now().getTime()}.receipt`,
      familyId: 'release-acceptance',
      checkId: check.acceptanceId,
      acceptanceId: check.acceptanceId,
      label: check.label,
      status,
      severity: check.severity,
      evidenceKind: check.evidenceKind,
      target: check.target,
      observed: hasEvidence ? observedPresent(check) : observedMissing(check),
      command: check.scriptName ? `npm run ${check.scriptName} --silent` : check.command || null,
      artifactFirst: true,
      localCheckPerformed: check.evidenceKind === 'package-manifest',
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: check.notes,
    };
  }
}

function observedPresent(check: ReleaseCheck): string {
  if (check.scriptName) return `script ${check.scriptName} is registered`;
  return `${check.acceptanceId} is present in package manifest`;
}

function observedMissing(check: ReleaseCheck): string {
  if (check.scriptName) return `script ${check.scriptName} is missing`;
  return `${check.acceptanceId} is missing from package manifest`;
}

function combineStatuses(statuses: ZavorthQaSecurityReleaseCheckStatus[]): ZavorthQaSecurityReleaseCheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function readPackageManifest(rootDir: string): PackageManifest {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageManifest;
  } catch (error: unknown) {logger.warn('[Zavorth Release Acceptance Check] JSON parse failed', error); return {}; }
}
