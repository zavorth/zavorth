import type {
  ZavorthSkillManifest,
  ZavorthSkillPackReceipt,
  ZavorthSkillPackReceiptSnapshot,
  ZavorthSkillPermissionEvaluation,
  ZavorthSkillSmokeResult,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';

type Runtime = {
  now?: () => Date;
};

export class ZavorthSkillPackReceiptEmitterService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: {
    manifests: ZavorthSkillManifest[];
    evaluations: ZavorthSkillPermissionEvaluation[];
    smokeResults: ZavorthSkillSmokeResult[];
  }): ZavorthSkillPackReceiptSnapshot {
    const evaluationByManifest = new Map(input.evaluations.map((evaluation) => [evaluation.manifestId, evaluation]));
    const lifecycleReceipts = input.manifests.flatMap((manifest) => {
      const evaluation = evaluationByManifest.get(manifest.id);
      return [
        this.receipt({
          kind: 'import',
          manifest,
          status: 'pass',
          ownerApprovalRequired: manifest.ownerApprovalRequiredForEnablement,
          reason: `${manifest.id} imported as optional manifest metadata.`,
        }),
        this.receipt({
          kind: 'inspect',
          manifest,
          status: 'pass',
          ownerApprovalRequired: manifest.ownerApprovalRequiredForEnablement,
          reason: `${manifest.id} can be inspected before enablement.`,
        }),
        this.receipt({
          kind: 'enable',
          manifest,
          status: evaluation?.enableAllowed ? 'pass' : 'deny',
          ownerApprovalRequired: evaluation?.ownerApprovalRequired ?? manifest.ownerApprovalRequiredForEnablement,
          reason: evaluation?.enableAllowed
            ? `${manifest.id} can be enabled by current local policy.`
            : `${manifest.id} enablement denied safely: ${evaluation?.reason || 'approval required'}.`,
        }),
        this.receipt({
          kind: 'execute',
          manifest,
          status: evaluation?.executeAllowed ? 'pass' : 'deny',
          ownerApprovalRequired: evaluation?.ownerApprovalRequired ?? manifest.ownerApprovalRequiredForEnablement,
          reason: evaluation?.executeAllowed
            ? `${manifest.id} can run in non-destructive dry-run mode.`
            : `${manifest.id} execution denied safely: ${evaluation?.reason || 'approval required'}.`,
        }),
      ];
    });
    const smokeReceipts = input.smokeResults.map((result) => this.receipt({
      kind: result.status === 'deny' ? 'denial' : 'smoke',
      manifest: input.manifests.find((manifest) => manifest.id === result.manifestId) || fallbackManifest(result.manifestId),
      status: result.status,
      ownerApprovalRequired: result.status === 'deny',
      reason: result.observed,
    }));
    const receipts = [...lifecycleReceipts, ...smokeReceipts];

    return {
      status: receipts.some((receipt) => receipt.status === 'fail') ? 'fail' : 'pass',
      receipts,
      imports: receipts.filter((receipt) => receipt.kind === 'import').length,
      inspections: receipts.filter((receipt) => receipt.kind === 'inspect').length,
      enablements: receipts.filter((receipt) => receipt.kind === 'enable' && receipt.status === 'pass').length,
      executions: receipts.filter((receipt) => receipt.kind === 'execute' && receipt.status === 'pass').length,
      denials: receipts.filter((receipt) => receipt.status === 'deny' || receipt.kind === 'denial').length,
      smokes: receipts.filter((receipt) => receipt.kind === 'smoke' || receipt.kind === 'denial').length,
      enabledByDefault: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private receipt(input: {
    kind: ZavorthSkillPackReceipt['kind'];
    manifest: ZavorthSkillManifest;
    status: ZavorthSkillPackReceipt['status'];
    ownerApprovalRequired: boolean;
    reason: string;
  }): ZavorthSkillPackReceipt {
    return {
      id: `zavorth.zavorthControl-controls.skill-pack.${input.kind}.${safeId(input.manifest.id)}.${this.now().getTime()}.receipt`,
      kind: input.kind,
      manifestId: input.manifest.id,
      status: input.status,
      artifactFirst: true,
      optionalSkill: true,
      inspectableBeforeEnablement: true,
      ownerApprovalRequired: input.ownerApprovalRequired,
      liveSecretsUsed: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      enabledByDefault: false,
      reason: input.reason,
    };
  }
}

function fallbackManifest(manifestId: string): ZavorthSkillManifest {
  return {
    id: manifestId,
    name: manifestId,
    description: 'Fallback manifest for receipt emission.',
    version: '0.1.0',
    sourceKind: 'zavorth-curated',
    optional: true,
    enabledByDefault: false,
    inspectableBeforeEnablement: true,
    ownerApprovalRequiredForEnablement: true,
    capabilityTags: ['workflow'],
    permissionProfileId: 'tool-execution-approval',
    requiredSecretRefs: [],
    smokeTests: [],
    testPrompts: [],
    mcpBridgeOptional: false,
    acpBridgeOptional: false,
    liveExternalIoAllowedByDefault: false,
    secretValuesSerialized: false,
    notes: [],
  };
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}
