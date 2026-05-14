import fs from 'fs';
import path from 'path';
import type {
  OperationalMaturityCapability,
  OperationalMaturityMatrix,
  OperationalMaturitySnapshot,
  OperationalMaturityStatus,
  OperationalMaturityValidationIssue,
  OperationalMaturityValidationReport,
} from '../../../contracts/OperationalMaturityContract.js';

type OperationalMaturityServiceOptions = {
  projectRoot?: string;
  matrixPath?: string;
  now?: () => Date;
};

const STATUS_LABELS: Record<OperationalMaturityStatus, string> = {
  stable: 'pronto',
  'official-but-provisioned': 'precisa configurar',
  experimental: 'experimental',
  draft: 'rascunho',
  deprecated: 'depreciado',
};

const STATUS_KEYS: Record<OperationalMaturityStatus, keyof OperationalMaturitySnapshot['summary']> = {
  stable: 'stable',
  'official-but-provisioned': 'officialButProvisioned',
  experimental: 'experimental',
  draft: 'draft',
  deprecated: 'deprecated',
};

export class OperationalMaturityService {
  private readonly projectRoot: string;
  private readonly matrixPath: string;
  private readonly now: () => Date;

  constructor(options: OperationalMaturityServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.matrixPath = path.resolve(
      options.matrixPath || path.join(this.projectRoot, 'config', 'operational-maturity.json'),
    );
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(): OperationalMaturitySnapshot {
    const matrix = this.readMatrix();
    const capabilities = matrix.capabilities.map((capability) => this.cloneCapability(capability));
    const summary = {
      total: capabilities.length,
      stable: 0,
      officialButProvisioned: 0,
      experimental: 0,
      draft: 0,
      deprecated: 0,
      needsConfiguration: 0,
    };

    for (const capability of capabilities) {
      summary[STATUS_KEYS[capability.status]] += 1;
      if (capability.status === 'official-but-provisioned') {
        summary.needsConfiguration += 1;
      }
    }

    return {
      generatedAt: this.now().toISOString(),
      schemaVersion: matrix.schemaVersion,
      source: path.relative(this.projectRoot, this.matrixPath).replace(/\\/g, '/'),
      summary,
      capabilities,
      consoleRows: capabilities.map((capability) => ({
        id: capability.id,
        label: capability.label,
        status: capability.status,
        displayStatus: STATUS_LABELS[capability.status],
        role: capability.role,
        nextStep: capability.nextStep,
      })),
      invariants: {
        nexusIsSurfaceOnly: this.hasInvariant(capabilities, 'nexus-surface', 'surface'),
        echoIsEdgeLayerOnly: this.hasInvariant(capabilities, 'echo-edge-layer', 'edge'),
        noParallelRuntimeClaim: capabilities.every((capability) => !capability.isParallelRuntime),
      },
    };
  }

  public validate(): OperationalMaturityValidationReport {
    const checkedAt = this.now().toISOString();
    const snapshot = this.buildSnapshot();
    const matrix = this.readMatrix();
    const issues: OperationalMaturityValidationIssue[] = [];
    const allowed = new Set(matrix.statuses);
    const ids = new Set<string>();

    for (const capability of matrix.capabilities) {
      if (ids.has(capability.id)) {
        issues.push(this.issue('error', 'duplicate-capability', `Capability duplicada: ${capability.id}`, capability.id));
      }
      ids.add(capability.id);

      if (!allowed.has(capability.status)) {
        issues.push(this.issue('error', 'invalid-status', `Status invalido em ${capability.id}: ${capability.status}`, capability.id));
      }

      for (const evidence of capability.evidence) {
        if (!fs.existsSync(path.join(this.projectRoot, evidence))) {
          issues.push(this.issue('error', 'missing-evidence', `Evidencia ausente em ${capability.id}: ${evidence}`, evidence));
        }
      }

      if ((capability.id === 'nexus-surface' || capability.id === 'echo-edge-layer')
        && (capability.isPrimaryBrain || capability.isParallelRuntime)) {
        issues.push(this.issue(
          'error',
          'brain-boundary-violation',
          `${capability.id} nao pode ser declarado como cerebro principal ou runtime paralelo.`,
          capability.id,
        ));
      }
    }

    if (!snapshot.invariants.nexusIsSurfaceOnly) {
      issues.push(this.issue('error', 'nexus-invariant', 'Nexus precisa permanecer surface/API convergida, nao runtime paralelo.'));
    }
    if (!snapshot.invariants.echoIsEdgeLayerOnly) {
      issues.push(this.issue('error', 'echo-invariant', 'Echo precisa permanecer edge/fallback, nao cerebro principal.'));
    }

    return {
      ok: issues.every((issue) => issue.severity !== 'error'),
      checkedAt,
      issues,
      snapshot,
    };
  }

  public renderConsole(snapshot: OperationalMaturitySnapshot = this.buildSnapshot()): string {
    const rows = snapshot.consoleRows.map((row) => (
      `- ${row.label}: ${row.displayStatus} | ${row.role} | proximo: ${row.nextStep}`
    ));
    return [
      'Zavorth Operational Maturity',
      `source: ${snapshot.source}`,
      `summary: stable=${snapshot.summary.stable}, provisioned=${snapshot.summary.officialButProvisioned}, experimental=${snapshot.summary.experimental}, draft=${snapshot.summary.draft}, deprecated=${snapshot.summary.deprecated}`,
      ...rows,
    ].join('\n');
  }

  private readMatrix(): OperationalMaturityMatrix {
    const raw = fs.readFileSync(this.matrixPath, 'utf8');
    return JSON.parse(raw) as OperationalMaturityMatrix;
  }

  private cloneCapability(capability: OperationalMaturityCapability): OperationalMaturityCapability {
    return {
      ...capability,
      evidence: [...capability.evidence],
      commands: capability.commands.map((command) => ({ ...command })),
      limitations: [...capability.limitations],
    };
  }

  private hasInvariant(capabilities: OperationalMaturityCapability[], id: string, expectedRoleText: string): boolean {
    const capability = capabilities.find((entry) => entry.id === id);
    if (!capability) {
      return false;
    }
    return !capability.isPrimaryBrain
      && !capability.isParallelRuntime
      && `${capability.role} ${capability.runtimeTruth}`.toLowerCase().includes(expectedRoleText);
  }

  private issue(
    severity: OperationalMaturityValidationIssue['severity'],
    id: string,
    message: string,
    target?: string,
  ): OperationalMaturityValidationIssue {
    return { severity, id, message, target };
  }
}
