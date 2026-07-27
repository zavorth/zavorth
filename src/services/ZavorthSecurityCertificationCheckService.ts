import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import type {
ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseEvidenceKind,
  ZavorthQaSecurityReleaseSeverity,
  ZavorthSecurityCertificationReceipt,
  ZavorthSecurityCertificationSnapshot,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packageScripts?: Record<string, string>;
};

type SecurityControl = {
  controlId: string;
  label: string;
  severity: ZavorthQaSecurityReleaseSeverity;
  evidenceKind: ZavorthQaSecurityReleaseEvidenceKind;
  scriptName?: string;
  relativePath?: string;
  target: string;
  notes: string[];
};

const SECURITY_CONTROLS: SecurityControl[] = [
  {
    controlId: 'privacy-scan-command',
    label: 'Privacy scan command is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'privacy:scan',
    target: 'A local privacy scan gate is available for pre-release security hygiene.',
    notes: ['The command is recorded and can be run locally or in CI.'],
  },
  {
    controlId: 'privacy-clean-command',
    label: 'Privacy clean command is registered',
    severity: 'required',
    evidenceKind: 'local-command',
    scriptName: 'privacy:clean',
    target: 'A local cleanup/remediation gate is available when privacy scan finds residue.',
    notes: ['Cleanup remains explicit and is not invoked by this certification snapshot.'],
  },
  {
    controlId: 'architecture-hardening-command',
    label: 'Architecture hardening command is registered',
    severity: 'blocking',
    evidenceKind: 'local-command',
    scriptName: 'architecture:hardening',
    target: 'Boundary and hardening checks can run locally before release.',
    notes: ['Security certification includes local architecture hardening as a blocking control.'],
  },
  {
    controlId: 'release-hygiene-command',
    label: 'Release hygiene scan command is registered',
    severity: 'required',
    evidenceKind: 'local-command',
    scriptName: 'release:scan',
    target: 'Release hygiene can be inspected without network or provider calls.',
    notes: ['The scan is recorded as a release/security bridge control.'],
  },
  {
    controlId: 'dependency-lockfile',
    label: 'Dependency lockfile is present',
    severity: 'required',
    evidenceKind: 'local-file',
    relativePath: 'bun.lock',
    target: 'Runtime dependency drift is pinned by a lockfile.',
    notes: ['The lockfile is treated as SBOM-adjacent local evidence.'],
  },
  {
    controlId: 'security-mesh-service',
    label: 'Security mesh service is discoverable',
    severity: 'advisory',
    evidenceKind: 'local-file',
    relativePath: 'src/services/ZavorthSecurityMeshService.ts',
    target: 'The local security mesh service is available as part of the release certification surface.',
    notes: ['This advisory control ties Surface controls to the Zavorth security runtime surface.'],
  },
];

export class ZavorthSecurityCertificationCheckService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly packageScripts: Record<string, string>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.packageScripts = runtime.packageScripts || readPackageScripts(this.rootDir);
  }

  public buildSnapshot(): ZavorthSecurityCertificationSnapshot {
    const receipts = SECURITY_CONTROLS.map((control) => this.buildReceipt(control));
    return {
      status: combineStatuses(receipts.map((receipt) => receipt.status)),
      controlsChecked: receipts.length,
      receipts,
      localOnly: true,
      secretValuesSerialized: false,
      liveExternalIoPerformed: false,
    };
  }

  private buildReceipt(control: SecurityControl): ZavorthSecurityCertificationReceipt {
    const hasEvidence = control.scriptName
      ? Boolean(this.packageScripts[control.scriptName])
      : control.relativePath
        ? fs.existsSync(path.join(this.rootDir, control.relativePath))
        : false;
    const status = hasEvidence ? 'pass'
      : control.severity === 'blocking'
        ? 'fail'
        : 'warn';

    return {
      id: `zavorth.surface-controls.security.${control.controlId}.${this.now().getTime()}.receipt`,
      familyId: 'security',
      checkId: control.controlId,
      controlId: control.controlId,
      label: control.label,
      status,
      severity: control.severity,
      evidenceKind: control.evidenceKind,
      target: control.target,
      observed: hasEvidence ? observedPresent(control) : observedMissing(control),
      command: control.scriptName ? `npm run ${control.scriptName} --silent` : null,
      artifactFirst: true,
      localCheckPerformed: control.evidenceKind !== 'local-command',
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: control.notes,
    };
  }
}

function observedPresent(control: SecurityControl): string {
  if (control.scriptName) return `script ${control.scriptName} is registered`;
  return `${control.relativePath} exists`;
}

function observedMissing(control: SecurityControl): string {
  if (control.scriptName) return `script ${control.scriptName} is missing`;
  return `${control.relativePath} is missing`;
}

function combineStatuses(statuses: ZavorthQaSecurityReleaseCheckStatus[]): ZavorthQaSecurityReleaseCheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function readPackageScripts(rootDir: string): Record<string, string> {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    return parsed.scripts || {};
  } catch (error: unknown) {logger.warn('[Zavorth Security Certification Check] JSON parse failed', error); return {}; }
}
