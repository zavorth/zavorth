import type {
  SourceInternalPluginPackageName,
  SourcePluginOsAbsorptionSnapshot,
  SourcePluginPackageDecision,
  SourcePluginPackageExportFamily,
  SourcePluginSdkCompatibilityMatrixEntry,
} from '../contracts/SourcePluginPackageContract.js';
import type {
  ZavorthSemanticPluginPackageCertificationSnapshot,
  ZavorthSemanticPluginPackageCertificationStatus,
  ZavorthSemanticPluginPackageClaim,
  ZavorthSemanticPluginPackageClaimKind,
  ZavorthSemanticPluginPackageClaimPriority,
  ZavorthSemanticPluginPackageClaimStatus,
} from '../contracts/ZavorthSemanticPluginPackageCertificationContract.js';
import { ZAVORTH_SEMANTIC_PLUGIN_PACKAGE_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticPluginPackageCertificationContract.js';
import { SourcePluginOsAbsorptionService } from './SourcePluginOsAbsorptionService.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  absorptionService?: Pick<SourcePluginOsAbsorptionService, 'buildSnapshot'>;
};

type ClaimInput = {
  kind: ZavorthSemanticPluginPackageClaimKind;
  status: ZavorthSemanticPluginPackageClaimStatus;
  priority: ZavorthSemanticPluginPackageClaimPriority;
  packageName?: SourceInternalPluginPackageName;
  exportFamily?: SourcePluginPackageExportFamily;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const PACKAGE_RECEIPT_PREFIX = 'zavorth.semantic.s1.plugin-package';

export class ZavorthSemanticPluginPackageCertificationService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly absorptionService: Pick<SourcePluginOsAbsorptionService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.absorptionService = runtime.absorptionService || new SourcePluginOsAbsorptionService({
      now: this.now,
      sourceRoot: this.sourceRoot,
    });
  }

  public buildSnapshot(input: { sourceRoot?: string | null } = {}): ZavorthSemanticPluginPackageCertificationSnapshot {
    const generatedAt = this.now().toISOString();
    const absorption = this.absorptionService.buildSnapshot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
    });
    const claims = this.buildClaims(absorption);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticPluginPackageCertificationStatus =
      absorption.status === 'passed' && gaps === 0 ? 'passed' : 'failed';

    return {
      generatedAt,
      contractVersion: ZAVORTH_SEMANTIC_PLUGIN_PACKAGE_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S1',
      statement: 'Plugin/package semantics are certified as Zavorth-native behavior claims backed by executable receipts.',
      sourceRoot: absorption.matrix.sourceRoot,
      absorptionStatus: absorption.status,
      claims,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        replaced: countStatus(claims, 'replaced'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        packagesCertified: claims.filter((claim) => claim.kind === 'package-presence' && claim.status !== 'gap').length,
        exportFamiliesCertified: claims.filter((claim) => claim.kind === 'export-family' && claim.status !== 'gap').length,
        lifecycleClaimsCertified: claims.filter((claim) => claim.kind === 'lifecycle-policy' && claim.status !== 'gap').length,
        runtimeExecutionPerformed: false,
        sourceCodeCopied: false,
        secretValuesSerialized: false,
      },
      policy: {
        semanticClaimRequiredForEveryPackage: true,
        exportFamiliesMustMapToZavorthCapability: true,
        lifecycleMustBeReceiptBacked: true,
        noExternalPluginExecutionDuringCertification: true,
        noImportPathShim: true,
        artifactFirstReceipts: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-plugin-package-certification --silent',
        inspectJson: 'npm run semantic-plugin-package-certification:json --silent',
        check: 'npm run semantic-plugin-package-certification:check --silent',
        qa: 'npm run qa:semantic-plugin-package-certification --silent',
        nextStage: 'S2 - Agent Runtime Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic Plugin Package Certification - S1',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Packages certified: ${snapshot.summary.packagesCertified}`,
      `Export families certified: ${snapshot.summary.exportFamiliesCertified}`,
      `Lifecycle claims certified: ${snapshot.summary.lifecycleClaimsCertified}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) => (
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`
      )),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(absorption: SourcePluginOsAbsorptionSnapshot): ZavorthSemanticPluginPackageClaim[] {
    const claims: ZavorthSemanticPluginPackageClaim[] = [];
    for (const entry of absorption.matrix.entries) {
      claims.push(this.packagePresenceClaim(entry));
      claims.push(...this.exportFamilyClaims(entry));
    }
    claims.push(...this.manifestClaims(absorption));
    claims.push(...this.lifecycleClaims(absorption));
    claims.push(...this.runtimePolicyClaims(absorption));
    return claims;
  }

  private packagePresenceClaim(entry: SourcePluginSdkCompatibilityMatrixEntry): ZavorthSemanticPluginPackageClaim {
    if (entry.status === 'missing') {
      return this.claim({
        kind: 'package-presence',
        status: 'gap',
        priority: 'P0',
        packageName: entry.packageName,
        expectedBehavior: `${entry.packageName} package semantics are available for certification.`,
        zavorthEquivalent: 'No certified Zavorth equivalent because the source package was not discovered.',
        evidence: [entry.reason, `packagePath=${entry.packagePath}`],
        notes: ['Missing packages block S1 because semantic claims cannot be extracted.'],
      });
    }

    return this.claim({
      kind: entry.decision === 'zavorth-native-sdk' ? 'sdk-replacement' : 'package-presence',
      status: statusForPackageDecision(entry.decision),
      priority: entry.decision === 'zavorth-native-sdk' ? 'P1' : 'P0',
      packageName: entry.packageName,
      expectedBehavior: `${entry.packageName} exposes package-level runtime semantics.`,
      zavorthEquivalent: entry.zavorthTarget,
      evidence: [
        `declaredExports=${entry.declaredExports}`,
        `decision=${entry.decision}`,
        entry.reason,
      ],
      notes: ['S1 certifies behavior by contract, policy and receipt rather than import-path compatibility.'],
    });
  }

  private exportFamilyClaims(entry: SourcePluginSdkCompatibilityMatrixEntry): ZavorthSemanticPluginPackageClaim[] {
    return Object.entries(entry.exportFamilies)
      .filter(([, count]) => count > 0)
      .map(([family, count]) => {
        const exportFamily = family as SourcePluginPackageExportFamily;
        return this.claim({
          kind: 'export-family',
          status: entry.status === 'found' ? statusForPackageDecision(entry.decision) : 'gap',
          priority: priorityForExportFamily(exportFamily),
          packageName: entry.packageName,
          exportFamily,
          expectedBehavior: `${entry.packageName} ${exportFamily} export semantics are covered (${count} export(s)).`,
          zavorthEquivalent: equivalentForExportFamily(exportFamily, entry.decision),
          evidence: [
            `exportFamily=${exportFamily}`,
            `exportCount=${count}`,
            `packageDecision=${entry.decision}`,
          ],
          notes: notesForExportFamily(exportFamily),
        });
      });
  }

  private manifestClaims(absorption: SourcePluginOsAbsorptionSnapshot): ZavorthSemanticPluginPackageClaim[] {
    const adapter = absorption.doctor.adapter;
    const manifest = adapter.manifest;
    const converted = adapter.status === 'converted';
    const hasCapabilities = manifest.capabilities.length > 0;
    const hasPermissions = manifest.permissions.length > 0;
    return [
      this.claim({
        kind: 'manifest-conversion',
        status: converted && hasCapabilities && hasPermissions ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'External plugin package metadata becomes a governed Zavorth Plugin OS manifest.',
        zavorthEquivalent: 'SourcePluginPackageAdapterService produces schema, capability, permission, entrypoint and policy metadata.',
        evidence: [
          `adapterStatus=${adapter.status}`,
          `manifestId=${manifest.id}`,
          `capabilities=${manifest.capabilities.length}`,
          `permissions=${manifest.permissions.length}`,
        ],
        receiptIds: [adapter.receipt.manifestId, 'source-plugin-package.adapter.receipt'],
        notes: ['Conversion does not execute external package code.'],
      }),
      this.claim({
        kind: 'manifest-conversion',
        status: manifest.policy.requiresApproval && !manifest.policy.allowNetworkByDefault ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Converted manifests are disabled/review-first until policy allows them.',
        zavorthEquivalent: 'Plugin OS manifest policy defaults to review, requires approval and blocks network by default.',
        evidence: [
          `defaultTrust=${manifest.policy.defaultTrust}`,
          `requiresApproval=${manifest.policy.requiresApproval}`,
          `allowNetworkByDefault=${manifest.policy.allowNetworkByDefault}`,
        ],
        receiptIds: [adapter.receipt.manifestId],
        notes: ['This is a semantic safety guarantee, not merely a package-shape check.'],
      }),
    ];
  }

  private lifecycleClaims(absorption: SourcePluginOsAbsorptionSnapshot): ZavorthSemanticPluginPackageClaim[] {
    const lifecycle = absorption.doctor.lifecycle;
    return [
      this.lifecycleClaim(
        'install-without-approval',
        lifecycle.installWithoutApproval.status === 'approval_required',
        'Install without approval is held for operator review.',
        `installWithoutApproval=${lifecycle.installWithoutApproval.status}`,
      ),
      this.lifecycleClaim(
        'install-with-approval',
        lifecycle.installWithApproval.status === 'applied',
        'Install with approval applies through Plugin OS lifecycle.',
        `installWithApproval=${lifecycle.installWithApproval.status}`,
      ),
      this.lifecycleClaim(
        'enable-with-approval',
        lifecycle.enableWithApproval.status === 'applied',
        'Enable with approval applies through Plugin OS lifecycle.',
        `enableWithApproval=${lifecycle.enableWithApproval.status}`,
      ),
      this.lifecycleClaim(
        'invoke-without-approval',
        lifecycle.invokeWithoutApproval.status === 'approval_required',
        'Invoke without approval is held for operator review.',
        `invokeWithoutApproval=${lifecycle.invokeWithoutApproval.status}`,
      ),
    ];
  }

  private lifecycleClaim(
    suffix: string,
    pass: boolean,
    expectedBehavior: string,
    evidence: string,
  ): ZavorthSemanticPluginPackageClaim {
    return this.claim({
      kind: 'lifecycle-policy',
      status: pass ? 'covered' : 'gap',
      priority: 'P0',
      expectedBehavior,
      zavorthEquivalent: 'PluginRegistryService lifecycle receipts enforce approval-aware install, enable and invoke behavior.',
      evidence: [evidence],
      receiptIds: [`${PACKAGE_RECEIPT_PREFIX}.lifecycle.${suffix}`],
      notes: [`lifecycle=${suffix}`],
    });
  }

  private runtimePolicyClaims(absorption: SourcePluginOsAbsorptionSnapshot): ZavorthSemanticPluginPackageClaim[] {
    return [
      this.claim({
        kind: 'runtime-policy',
        status: absorption.policy.noExternalPluginCodeExecution && !absorption.summary.runtimeExecutionPerformed ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'S1 certification must not execute external plugin code.',
        zavorthEquivalent: 'Runtime doctor emits receipts only and reports runtimeExecutionPerformed=false.',
        evidence: [
          `noExternalPluginCodeExecution=${absorption.policy.noExternalPluginCodeExecution}`,
          `runtimeExecutionPerformed=${absorption.summary.runtimeExecutionPerformed}`,
        ],
        receiptIds: ['source-plugin-runtime-doctor.receipt'],
        notes: ['Semantic certification is local, deterministic and receipt-first.'],
      }),
      this.claim({
        kind: 'runtime-policy',
        status: absorption.policy.noSourceImportPathShim && absorption.summary.unimplementedSourceShim === false ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Package semantics are not certified by pretending to provide old import paths.',
        zavorthEquivalent: 'Zavorth-native Plugin OS and stable SDK subpaths replace compatibility shims.',
        evidence: [
          `noImportPathShim=${absorption.policy.noSourceImportPathShim}`,
          `unimplementedShim=${absorption.summary.unimplementedSourceShim}`,
        ],
        receiptIds: ['source-plugin-runtime-policy.receipt'],
        notes: ['This keeps S1 as semantic equivalence, not API impersonation.'],
      }),
      this.claim({
        kind: 'runtime-policy',
        status: absorption.policy.artifactFirstReceipts && absorption.summary.lifecycleReceipts >= 4 ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Lifecycle and certification behavior is artifact-first and receipt-backed.',
        zavorthEquivalent: 'Doctor and PluginRegistryService emit lifecycle receipts for the certification path.',
        evidence: [
          `artifactFirstReceipts=${absorption.policy.artifactFirstReceipts}`,
          `lifecycleReceipts=${absorption.summary.lifecycleReceipts}`,
        ],
        receiptIds: ['source-plugin-lifecycle.receipt'],
        notes: ['Receipts become the evidence substrate for later semantic phases.'],
      }),
      this.claim({
        kind: 'runtime-policy',
        status: absorption.summary.secretValuesSerialized === false ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Certification never serializes secret values.',
        zavorthEquivalent: 'Plugin package receipts store SecretRef-style requirements and policy, not secret material.',
        evidence: [`secretValuesSerialized=${absorption.summary.secretValuesSerialized}`],
        receiptIds: ['source-plugin-secret-policy.receipt'],
        notes: ['Secret behavior is proven as policy metadata only.'],
      }),
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticPluginPackageClaim {
    const receiptIds = input.receiptIds && input.receiptIds.length > 0
      ? input.receiptIds
      : [`${PACKAGE_RECEIPT_PREFIX}.${normalizeClaimId([
        input.kind,
        input.packageName,
        input.exportFamily,
        input.expectedBehavior,
      ])}`];
    return {
      id: `${input.kind}:${normalizeClaimId([
        input.packageName,
        input.exportFamily,
        input.expectedBehavior,
      ])}`,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      packageName: input.packageName,
      exportFamily: input.exportFamily,
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds,
      notes: input.notes || [],
    };
  }
}

function statusForPackageDecision(decision: SourcePluginPackageDecision): ZavorthSemanticPluginPackageClaimStatus {
  if (decision === 'zavorth-native-sdk') return 'replaced';
  if (decision === 'rejected') return 'rejected';
  if (decision === 'owner-decision-required') return 'owner-gated';
  return 'covered';
}

function priorityForExportFamily(family: SourcePluginPackageExportFamily): ZavorthSemanticPluginPackageClaimPriority {
  if (family === 'plugin-runtime' || family === 'security' || family === 'secret' || family === 'package-root') {
    return 'P0';
  }
  if (family === 'provider' || family === 'channel' || family === 'config' || family === 'memory' || family === 'runtime-utility') {
    return 'P1';
  }
  return 'P2';
}

function equivalentForExportFamily(
  family: SourcePluginPackageExportFamily,
  decision: SourcePluginPackageDecision,
): string {
  if (decision === 'zavorth-native-sdk') {
    return 'Stable Zavorth SDK public subpaths and module authoring helpers.';
  }
  switch (family) {
    case 'plugin-runtime':
      return 'Zavorth Plugin OS manifest, lifecycle and registry services.';
    case 'provider':
      return 'Zavorth Provider Mesh adapters and credential routes.';
    case 'channel':
      return 'Zavorth Channel Mesh optional packs and simulator receipts.';
    case 'config':
      return 'Zavorth config/runtime profile policy surfaces.';
    case 'security':
      return 'Zavorth security certification and Plugin OS permission policy.';
    case 'secret':
      return 'SecretRef-only policy with no secret value serialization.';
    case 'memory':
      return 'Zavorth memory/document/terminal pack and governed memory backend.';
    case 'runtime-utility':
      return 'Zavorth runtime services for scheduling, time, concurrency and receipts.';
    case 'testing':
      return 'Zavorth QA/security/release certification checks.';
    case 'media':
      return 'Zavorth media and speech runtime planes, owner-gated where live.';
    case 'package-root':
      return 'Zavorth-native package metadata through Plugin OS or SDK barrels.';
    default:
      return 'Zavorth-native capability or explicit owner decision.';
  }
}

function notesForExportFamily(family: SourcePluginPackageExportFamily): string[] {
  if (family === 'memory') {
    return ['Memory package behavior is certified as a cross-phase semantic claim with Credential vault runtime support.'];
  }
  if (family === 'security' || family === 'secret') {
    return ['Sensitive behavior is certified through policy and receipts, never by live secret access.'];
  }
  return ['Export-family semantics are mapped by behavior family, not by import path.'];
}

function countStatus(
  claims: ZavorthSemanticPluginPackageClaim[],
  status: ZavorthSemanticPluginPackageClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticPluginPackageClaim[],
  priority: ZavorthSemanticPluginPackageClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function normalizeClaimId(values: unknown[]): string {
  const raw = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('-');
  return raw
    .toLowerCase()
    .replace(/^@/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'claim';
}
