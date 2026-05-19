import type {
  ZavorthSkillCapabilityTag,
  ZavorthSkillEcosystemCheckStatus,
  ZavorthSkillEcosystemPackSnapshot,
  ZavorthSkillManifest,
  ZavorthSkillPackReceipt,
  ZavorthSkillPermissionEvaluation,
  ZavorthSkillPermissionProfile,
  ZavorthSkillSecretRef,
  ZavorthSkillSmokeResult,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';
import { ZavorthSkillEcosystemPackService } from './ZavorthSkillEcosystemPackService.js';
import type {
  ZavorthSemanticSkillEcosystemCertificationSnapshot,
  ZavorthSemanticSkillEcosystemCertificationStatus,
  ZavorthSemanticSkillEcosystemClaim,
  ZavorthSemanticSkillEcosystemClaimKind,
  ZavorthSemanticSkillEcosystemClaimPriority,
  ZavorthSemanticSkillEcosystemClaimStatus,
  ZavorthSemanticSkillEcosystemScenario,
} from '../contracts/ZavorthSemanticSkillEcosystemCertificationContract.js';
import { ZAVORTH_SEMANTIC_SKILL_ECOSYSTEM_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticSkillEcosystemCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packService?: Pick<ZavorthSkillEcosystemPackService, 'buildSnapshot'>;
};

type ClaimInput = {
  idSeed?: string;
  kind: ZavorthSemanticSkillEcosystemClaimKind;
  status: ZavorthSemanticSkillEcosystemClaimStatus;
  priority: ZavorthSemanticSkillEcosystemClaimPriority;
  manifestId?: string;
  capabilityTag?: ZavorthSkillCapabilityTag;
  profileId?: ZavorthSemanticSkillEcosystemClaim['profileId'];
  receiptKind?: ZavorthSemanticSkillEcosystemClaim['receiptKind'];
  sourceStatus?: ZavorthSkillEcosystemCheckStatus;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const RECEIPT_PREFIX = 'zavorth.semantic.s8.skill-ecosystem';

export class ZavorthSemanticSkillEcosystemCertificationService {
  private readonly now: () => Date;
  private readonly packService: Pick<ZavorthSkillEcosystemPackService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.packService = runtime.packService || new ZavorthSkillEcosystemPackService({
      now: this.now,
      rootDir: runtime.rootDir,
    });
  }

  public buildSnapshot(): ZavorthSemanticSkillEcosystemCertificationSnapshot {
    const pack = this.packService.buildSnapshot();
    const scenarios = this.buildScenarios(pack);
    const claims = this.buildClaims(pack, scenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticSkillEcosystemCertificationStatus =
      pack.status === 'passed'
      && gaps === 0
      && scenarios.every((scenario) => scenario.status === 'passed')
      && pack.summary.enabledByDefault === false
      && pack.summary.liveExternalIoPerformed === false
      && pack.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_SKILL_ECOSYSTEM_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S8',
      statement: 'Skill ecosystem semantics are certified as optional, manifest-driven, inspectable, permission-gated and receipt-first Zavorth capabilities.',
      packStatus: pack.status,
      packContractVersion: pack.contractVersion,
      runtime: pack.runtime,
      claims,
      scenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        manifestClaimsCertified: claims.filter((claim) => claim.kind === 'manifest-coverage').length,
        capabilityTagClaimsCertified: claims.filter((claim) => claim.kind === 'capability-tag-coverage').length,
        permissionProfileClaimsCertified: claims.filter((claim) => claim.kind === 'permission-profile-policy').length,
        permissionEvaluationClaimsCertified: claims.filter((claim) => claim.kind === 'permission-evaluation-policy').length,
        secretRefClaimsCertified: claims.filter((claim) => claim.kind === 'secretref-policy').length,
        smokeClaimsCertified: claims.filter((claim) => claim.kind === 'smoke-policy').length,
        lifecycleReceiptClaimsCertified: claims.filter((claim) => claim.kind === 'lifecycle-receipt-policy').length,
        bridgeClaimsCertified: claims.filter((claim) => claim.kind === 'bridge-policy').length,
        scenariosPassed: scenarios.filter((scenario) => scenario.status === 'passed').length,
        packManifests: pack.summary.manifests,
        packPermissionProfiles: pack.summary.permissionProfiles,
        packSmokeTests: pack.summary.smokeTests,
        packReceipts: pack.summary.receipts,
        safeDenials: pack.permissions.enablementsDenied + pack.smokeRunner.denied + pack.receipts.denials,
        connectorConcepts: pack.summary.connectorConcepts,
        workspaceCatalogInputs: pack.importer.workspaceCatalogInputs,
        enabledByDefault: false,
        liveSkillsRequireOwnerApproval: pack.summary.liveSkillsRequireOwnerApproval,
        liveSkillsRequireSecretRef: pack.summary.liveSkillsRequireSecretRef,
        nonDestructiveSmokeOnly: true,
        liveExternalIoPerformed: false,
        liveSecretsUsed: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryManifest: true,
        semanticClaimRequiredForEveryPermissionProfile: true,
        semanticClaimRequiredForEverySmokeResult: true,
        semanticClaimRequiredForEveryLifecycleReceipt: true,
        optionalEcosystemCapacity: true,
        inspectBeforeEnablement: true,
        nonDestructiveSmokeOnly: true,
        liveSkillsRequireOwnerApproval: true,
        liveSkillsRequireSecretRef: true,
        denialsAreReceiptBacked: true,
        noSecretsInReceipts: true,
        noCoreBloat: true,
        mcpAcpBridgeOptional: true,
        noLiveIoDuringCertification: true,
        noSkillEnabledByDefault: true,
        defaultEnablementRejected: true,
        liveSecretUseRejected: true,
        destructiveSmokeRejected: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-skill-ecosystem-certification --silent',
        inspectJson: 'npm run semantic-skill-ecosystem-certification:json --silent',
        check: 'npm run semantic-skill-ecosystem-certification:check --silent',
        qa: 'npm run qa:semantic-skill-ecosystem-certification --silent',
        nextStage: 'S9 - Full Functional Closure Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic Skill Ecosystem Certification - S8',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Pack status: ${snapshot.packStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Manifest/profile/smoke/receipt claims: ${snapshot.summary.manifestClaimsCertified}/${snapshot.summary.permissionProfileClaimsCertified}/${snapshot.summary.smokeClaimsCertified}/${snapshot.summary.lifecycleReceiptClaimsCertified}`,
      `SecretRef and bridge claims: ${snapshot.summary.secretRefClaimsCertified}/${snapshot.summary.bridgeClaimsCertified}`,
      `Scenarios passed: ${snapshot.summary.scenariosPassed}/${snapshot.scenarios.length}`,
      `Pack manifests/profiles/smokes/receipts: ${snapshot.summary.packManifests}/${snapshot.summary.packPermissionProfiles}/${snapshot.summary.packSmokeTests}/${snapshot.summary.packReceipts}`,
      `Safe denials: ${snapshot.summary.safeDenials}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    pack: ZavorthSkillEcosystemPackSnapshot,
    scenarios: ZavorthSemanticSkillEcosystemScenario[],
  ): ZavorthSemanticSkillEcosystemClaim[] {
    return [
      ...pack.importer.manifests.map((manifest) => this.manifestClaim(manifest)),
      ...uniqueCapabilityTags(pack).map((tag) => this.capabilityTagClaim(pack, tag)),
      ...pack.permissions.profiles.map((profile) => this.profileClaim(profile)),
      ...pack.permissions.evaluations.map((evaluation) => this.evaluationClaim(evaluation)),
      ...pack.importer.manifests.flatMap((manifest) =>
        manifest.requiredSecretRefs.map((secretRef) => this.secretRefClaim(manifest, secretRef)),
      ),
      ...pack.smokeRunner.results.map((result) => this.smokeClaim(result)),
      ...pack.receipts.receipts.map((receipt, index) => this.lifecycleReceiptClaim(receipt, index)),
      ...this.bridgeClaims(pack),
      ...this.globalPolicyClaims(pack),
      ...this.scenarioClaims(scenarios),
      ...this.unsafeSkillClaims(pack),
    ];
  }

  private manifestClaim(manifest: ZavorthSkillManifest): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'manifest-coverage',
      status: manifest.optional
        && manifest.inspectableBeforeEnablement
        && manifest.enabledByDefault === false
        && manifest.secretValuesSerialized === false
          ? 'covered'
          : 'gap',
      priority: manifest.permissionProfileId === 'connector-live-secretref' || manifest.permissionProfileId === 'tool-execution-approval' ? 'P1' : 'P0',
      manifestId: manifest.id,
      sourceStatus: 'pass',
      expectedBehavior: `${manifest.name} is represented as an optional, inspectable skill manifest before enablement.`,
      zavorthEquivalent: 'ZavorthSkillManifest with permission profile, smoke tests, SecretRefs and bridge flags.',
      evidence: [
        `sourceKind=${manifest.sourceKind}`,
        `profile=${manifest.permissionProfileId}`,
        `optional=${manifest.optional}`,
        `enabledByDefault=${manifest.enabledByDefault}`,
        `inspectableBeforeEnablement=${manifest.inspectableBeforeEnablement}`,
        `ownerApprovalRequiredForEnablement=${manifest.ownerApprovalRequiredForEnablement}`,
        `capabilityTags=${manifest.capabilityTags.join(',')}`,
        `requiredSecretRefs=${manifest.requiredSecretRefs.map((secret) => secret.id).join(',') || 'none'}`,
        `smokeTests=${manifest.smokeTests.length}`,
      ],
      receiptIds: [`${RECEIPT_PREFIX}.manifest.${safeId(manifest.id)}`],
      notes: manifest.notes,
    });
  }

  private capabilityTagClaim(
    pack: ZavorthSkillEcosystemPackSnapshot,
    tag: ZavorthSkillCapabilityTag,
  ): ZavorthSemanticSkillEcosystemClaim {
    const manifests = pack.importer.manifests.filter((manifest) => manifest.capabilityTags.includes(tag));
    return this.claim({
      kind: 'capability-tag-coverage',
      status: manifests.length > 0 ? 'covered' : 'gap',
      priority: tag === 'app-connector' || tag === 'security' || tag === 'release' ? 'P0' : 'P1',
      capabilityTag: tag,
      expectedBehavior: `Skill capability tag ${tag} has at least one optional manifest and can be audited by capability family.`,
      zavorthEquivalent: 'Manifest capabilityTags form the skill ecosystem routing and audit taxonomy.',
      evidence: [
        `manifests=${manifests.length}`,
        `manifestIds=${manifests.map((manifest) => manifest.id).join(',')}`,
      ],
      receiptIds: manifests.map((manifest) => `${RECEIPT_PREFIX}.capability-tag.${tag}.${safeId(manifest.id)}`),
      notes: ['Capability tags are taxonomy evidence, not runtime enablement.'],
    });
  }

  private profileClaim(profile: ZavorthSkillPermissionProfile): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'permission-profile-policy',
      status: profile.enabledByDefault === false
        && profile.liveExternalIoAllowedByDefault === false
        && profile.id
          ? 'covered'
          : 'gap',
      priority: profile.ownerApprovalRequired ? 'P1' : 'P0',
      profileId: profile.id,
      expectedBehavior: `${profile.label} defines a concrete permission envelope for skill inspection, enablement and execution.`,
      zavorthEquivalent: 'ZavorthSkillPermissionProfile with workspace, network, secret and tool execution boundaries.',
      evidence: [
        `readWorkspace=${profile.readWorkspace}`,
        `writeWorkspace=${profile.writeWorkspace}`,
        `network=${profile.network}`,
        `secrets=${profile.secrets}`,
        `toolExecution=${profile.toolExecution}`,
        `ownerApprovalRequired=${profile.ownerApprovalRequired}`,
        `enabledByDefault=${profile.enabledByDefault}`,
        `liveExternalIoAllowedByDefault=${profile.liveExternalIoAllowedByDefault}`,
      ],
      receiptIds: [`${RECEIPT_PREFIX}.permission-profile.${profile.id}`],
      notes: profile.notes,
    });
  }

  private evaluationClaim(evaluation: ZavorthSkillPermissionEvaluation): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'permission-evaluation-policy',
      status: evaluation.status === 'pass' ? 'covered' : evaluation.status === 'deny' ? 'owner-gated' : 'gap',
      priority: evaluation.profileId === 'connector-live-secretref' || evaluation.profileId === 'tool-execution-approval' ? 'P0' : 'P1',
      manifestId: evaluation.manifestId,
      profileId: evaluation.profileId,
      sourceStatus: evaluation.status,
      expectedBehavior: `${evaluation.manifestId} permission evaluation is explicit and denies live/tool paths safely when approval or SecretRef is missing.`,
      zavorthEquivalent: 'ZavorthSkillPermissionEvaluation with inspect/enable/execute decisions and missing SecretRef metadata.',
      evidence: [
        `status=${evaluation.status}`,
        `inspectAllowed=${evaluation.inspectAllowed}`,
        `enableAllowed=${evaluation.enableAllowed}`,
        `executeAllowed=${evaluation.executeAllowed}`,
        `denialRequired=${evaluation.denialRequired}`,
        `ownerApprovalRequired=${evaluation.ownerApprovalRequired}`,
        `requiredSecretRefs=${evaluation.requiredSecretRefs.join(',') || 'none'}`,
        `missingSecretRefs=${evaluation.missingSecretRefs.join(',') || 'none'}`,
        `enabledByDefault=${evaluation.enabledByDefault}`,
      ],
      receiptIds: [`${RECEIPT_PREFIX}.permission-evaluation.${safeId(evaluation.manifestId)}`],
      notes: [evaluation.reason],
    });
  }

  private secretRefClaim(
    manifest: ZavorthSkillManifest,
    secretRef: ZavorthSkillSecretRef,
  ): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'secretref-policy',
      status: secretRef.configured
        ? 'covered'
        : secretRef.secretValueSerialized === false
          ? 'owner-gated'
          : 'gap',
      priority: 'P0',
      manifestId: manifest.id,
      expectedBehavior: `${manifest.id} uses SecretRef ${secretRef.id} for live connector/tool paths and never serializes raw secret values.`,
      zavorthEquivalent: 'ZavorthSkillSecretRef metadata with configured flag and redacted secret value.',
      evidence: [
        `provider=${secretRef.provider}`,
        `configured=${secretRef.configured}`,
        `secretValueSerialized=${secretRef.secretValueSerialized}`,
        `profile=${manifest.permissionProfileId}`,
      ],
      receiptIds: [`${RECEIPT_PREFIX}.secretref.${safeId(manifest.id)}.${safeId(secretRef.id)}`],
      notes: ['Missing SecretRef is owner-gated evidence, not a runnable live connector.'],
    });
  }

  private smokeClaim(result: ZavorthSkillSmokeResult): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'smoke-policy',
      idSeed: result.id,
      status: result.status === 'pass' ? 'covered' : result.status === 'deny' ? 'owner-gated' : 'gap',
      priority: result.status === 'deny' ? 'P0' : 'P1',
      manifestId: result.manifestId,
      sourceStatus: result.status,
      expectedBehavior: `${result.manifestId} smoke test ${result.promptId} is non-destructive and either passes or denies safely.`,
      zavorthEquivalent: 'ZavorthSkillSmokeResult with inspect, dry-run or denial mode.',
      evidence: [
        `promptId=${result.promptId}`,
        `status=${result.status}`,
        `mode=${result.mode}`,
        `destructive=${result.destructive}`,
        `liveSecretsUsed=${result.liveSecretsUsed}`,
        `liveExternalIoPerformed=${result.liveExternalIoPerformed}`,
        `artifactFirst=${result.artifactFirst}`,
        `observed=${result.observed}`,
      ],
      receiptIds: [result.id],
      notes: ['Deny is a successful safety outcome for live/approval-gated skills.'],
    });
  }

  private lifecycleReceiptClaim(
    receipt: ZavorthSkillPackReceipt,
    index: number,
  ): ZavorthSemanticSkillEcosystemClaim {
    return this.claim({
      kind: 'lifecycle-receipt-policy',
      idSeed: `${receipt.id}.${index}`,
      status: receipt.status === 'pass' ? 'covered' : receipt.status === 'deny' ? 'owner-gated' : 'gap',
      priority: receipt.kind === 'enable' || receipt.kind === 'execute' ? 'P0' : 'P1',
      manifestId: receipt.manifestId,
      receiptKind: receipt.kind,
      sourceStatus: receipt.status,
      expectedBehavior: `${receipt.manifestId} lifecycle ${receipt.kind} event is recorded as optional, inspectable and receipt-first.`,
      zavorthEquivalent: 'ZavorthSkillPackReceipt for import, inspect, enable, execute, denial or smoke lifecycle.',
      evidence: [
        `kind=${receipt.kind}`,
        `status=${receipt.status}`,
        `ownerApprovalRequired=${receipt.ownerApprovalRequired}`,
        `optionalSkill=${receipt.optionalSkill}`,
        `inspectableBeforeEnablement=${receipt.inspectableBeforeEnablement}`,
        `liveSecretsUsed=${receipt.liveSecretsUsed}`,
        `liveExternalIoPerformed=${receipt.liveExternalIoPerformed}`,
        `secretValuesSerialized=${receipt.secretValuesSerialized}`,
        `enabledByDefault=${receipt.enabledByDefault}`,
      ],
      receiptIds: [receipt.id],
      notes: [receipt.reason],
    });
  }

  private bridgeClaims(pack: ZavorthSkillEcosystemPackSnapshot): ZavorthSemanticSkillEcosystemClaim[] {
    const mcpManifests = pack.importer.manifests.filter((manifest) => manifest.mcpBridgeOptional);
    const acpManifests = pack.importer.manifests.filter((manifest) => manifest.acpBridgeOptional);
    return [
      this.claim({
        kind: 'bridge-policy',
        status: pack.policy.mcpAcpBridgeOptional && mcpManifests.length > 0 ? 'owner-gated' : 'gap',
        priority: 'P1',
        expectedBehavior: 'MCP bridge support is optional and tied to owner-approved connector/tool manifests.',
        zavorthEquivalent: 'Manifest mcpBridgeOptional flag plus permission profiles and SecretRefs.',
        evidence: [
          `mcpAcpBridgeOptional=${pack.policy.mcpAcpBridgeOptional}`,
          `mcpManifestIds=${mcpManifests.map((manifest) => manifest.id).join(',')}`,
        ],
        receiptIds: mcpManifests.map((manifest) => `${RECEIPT_PREFIX}.bridge.mcp.${safeId(manifest.id)}`),
        notes: ['Optional bridge means available for future enablement, not active by default.'],
      }),
      this.claim({
        kind: 'bridge-policy',
        status: pack.policy.mcpAcpBridgeOptional && acpManifests.length > 0 ? 'owner-gated' : 'gap',
        priority: 'P1',
        expectedBehavior: 'ACP bridge support is optional and tied to owner-approved connector/tool manifests.',
        zavorthEquivalent: 'Manifest acpBridgeOptional flag plus permission profiles and SecretRefs.',
        evidence: [
          `mcpAcpBridgeOptional=${pack.policy.mcpAcpBridgeOptional}`,
          `acpManifestIds=${acpManifests.map((manifest) => manifest.id).join(',')}`,
        ],
        receiptIds: acpManifests.map((manifest) => `${RECEIPT_PREFIX}.bridge.acp.${safeId(manifest.id)}`),
        notes: ['ACP bridge capability is intentionally not core runtime bloat.'],
      }),
    ];
  }

  private globalPolicyClaims(pack: ZavorthSkillEcosystemPackSnapshot): ZavorthSemanticSkillEcosystemClaim[] {
    return [
      this.claim({
        kind: 'optionality-policy',
        status: pack.policy.optionalEcosystemCapacity
          && pack.summary.optionalSkills === pack.summary.manifests
          && pack.summary.inspectableBeforeEnablement === pack.summary.manifests
          && pack.summary.enabledByDefault === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Skill ecosystem capacity is optional, inspectable before enablement and never enabled by default.',
        zavorthEquivalent: 'Skill manifests plus pack summary optional/inspectable counters.',
        evidence: [
          `optionalEcosystemCapacity=${pack.policy.optionalEcosystemCapacity}`,
          `optionalSkills=${pack.summary.optionalSkills}`,
          `manifests=${pack.summary.manifests}`,
          `inspectableBeforeEnablement=${pack.summary.inspectableBeforeEnablement}`,
          `enabledByDefault=${pack.summary.enabledByDefault}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.policy.optionality`],
        notes: ['S8 adds capacity without silently expanding core runtime.'],
      }),
      this.claim({
        kind: 'live-io-policy',
        status: pack.summary.liveExternalIoPerformed === false
          && pack.summary.liveSkillsRequireOwnerApproval
          && pack.summary.liveSkillsRequireSecretRef
          && pack.summary.secretValuesSerialized === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Live connector/tool skills require owner approval and SecretRef; certification performs no live external I/O.',
        zavorthEquivalent: 'Permission evaluations, SecretRef policy and pack summary flags.',
        evidence: [
          `liveSkillsRequireOwnerApproval=${pack.summary.liveSkillsRequireOwnerApproval}`,
          `liveSkillsRequireSecretRef=${pack.summary.liveSkillsRequireSecretRef}`,
          `liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`,
          `secretValuesSerialized=${pack.summary.secretValuesSerialized}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.policy.live-io`],
        notes: ['Live skills are present as gated capability, not enabled runtime.'],
      }),
      this.claim({
        kind: 'artifact-receipt-policy',
        status: pack.receipts.receipts.length > 0
          && pack.receipts.receipts.every((receipt) => receipt.artifactFirst)
          && pack.receipts.receipts.every((receipt) => receipt.secretValuesSerialized === false)
          && pack.smokeRunner.results.every((result) => result.artifactFirst)
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Skill import, inspect, enable, execute, denial and smoke behavior is artifact-first and receipt-backed.',
        zavorthEquivalent: 'ZavorthSkillPackReceipt and ZavorthSkillSmokeResult receipts.',
        evidence: [
          `receipts=${pack.receipts.receipts.length}`,
          `smokeResults=${pack.smokeRunner.results.length}`,
          `artifactFirst=${pack.receipts.receipts.every((receipt) => receipt.artifactFirst)}`,
          `secretValuesSerialized=${pack.receipts.secretValuesSerialized}`,
          'sourceCodeCopied=false',
        ],
        receiptIds: [
          ...pack.receipts.receipts.map((receipt) => receipt.id),
          ...pack.smokeRunner.results.map((result) => result.id),
        ],
        notes: ['Lifecycle receipts are the canonical audit path for skill behavior.'],
      }),
    ];
  }

  private scenarioClaims(
    scenarios: ZavorthSemanticSkillEcosystemScenario[],
  ): ZavorthSemanticSkillEcosystemClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: scenario.id === 'live-connector-denied-without-secretref'
        ? 'secretref-policy'
        : scenario.id === 'non-destructive-smoke-only'
          ? 'smoke-policy'
          : scenario.id === 'receipt-lifecycle-secret-safe'
            ? 'artifact-receipt-policy'
            : 'optionality-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: scenario.id === 'live-connector-denied-without-secretref' ? 'P0' : 'P1',
      expectedBehavior: scenarioBehavior(scenario.id),
      zavorthEquivalent: scenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: scenario.receiptIds,
      notes: ['Scenario proves skill ecosystem behavior without live external I/O.'],
    }));
  }

  private unsafeSkillClaims(pack: ZavorthSkillEcosystemPackSnapshot): ZavorthSemanticSkillEcosystemClaim[] {
    return [
      this.claim({
        kind: 'unsafe-skill-policy',
        status: pack.summary.enabledByDefault === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject default-on skill enablement.',
        zavorthEquivalent: 'All skill manifests and lifecycle receipts keep enabledByDefault=false.',
        evidence: [`enabledByDefault=${pack.summary.enabledByDefault}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.default-skill-enablement`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-skill-policy',
        status: pack.smokeRunner.nonDestructiveOnly
          && pack.smokeRunner.results.every((result) => result.destructive === false)
            ? 'rejected'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject destructive skill smoke tests.',
        zavorthEquivalent: 'Skill smoke runner only emits non-destructive inspect, dry-run or denial results.',
        evidence: [
          `nonDestructiveOnly=${pack.smokeRunner.nonDestructiveOnly}`,
          `destructiveResults=${pack.smokeRunner.results.filter((result) => result.destructive).length}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.destructive-smoke`],
        notes: ['Rejected here means smoke tests are intentionally safe-only.'],
      }),
      this.claim({
        kind: 'unsafe-skill-policy',
        status: pack.summary.liveExternalIoPerformed === false
          && pack.smokeRunner.liveSecretsUsed === false
            ? 'rejected'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject live external I/O and live secret use during skill certification.',
        zavorthEquivalent: 'Pack summary and smoke results keep liveExternalIoPerformed=false and liveSecretsUsed=false.',
        evidence: [
          `liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`,
          `liveSecretsUsed=${pack.smokeRunner.liveSecretsUsed}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.live-skill-io`],
        notes: ['Rejected here means live skill use needs a separate owner-approved path.'],
      }),
      this.claim({
        kind: 'unsafe-skill-policy',
        status: pack.summary.secretValuesSerialized === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw secret serialization in skill manifests, evaluations and receipts.',
        zavorthEquivalent: 'SecretRef metadata and lifecycle receipts store references/status only.',
        evidence: [`secretValuesSerialized=${pack.summary.secretValuesSerialized}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.raw-secret-values`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
    ];
  }

  private buildScenarios(pack: ZavorthSkillEcosystemPackSnapshot): ZavorthSemanticSkillEcosystemScenario[] {
    const connectorEvaluations = pack.permissions.evaluations.filter((evaluation) =>
      evaluation.profileId === 'connector-live-secretref',
    );
    return [
      {
        id: 'inspect-before-enable',
        status: pack.importer.manifests.every((manifest) => manifest.inspectableBeforeEnablement)
          && pack.importer.manifests.every((manifest) => manifest.enabledByDefault === false)
          && pack.receipts.inspections === pack.importer.manifests.length
            ? 'passed'
            : 'failed',
        evidence: [
          `manifests=${pack.importer.manifests.length}`,
          `inspectableBeforeEnablement=${pack.summary.inspectableBeforeEnablement}`,
          `inspections=${pack.receipts.inspections}`,
          `enabledByDefault=${pack.summary.enabledByDefault}`,
        ],
        receiptIds: pack.receipts.receipts
          .filter((receipt) => receipt.kind === 'inspect')
          .map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        liveSecretsUsed: false,
        secretValuesSerialized: false,
        enabledByDefault: false,
      },
      {
        id: 'live-connector-denied-without-secretref',
        status: connectorEvaluations.length > 0
          && connectorEvaluations.every((evaluation) => evaluation.status === 'deny')
          && connectorEvaluations.every((evaluation) => evaluation.missingSecretRefs.length > 0)
            ? 'passed'
            : 'failed',
        evidence: [
          `connectorEvaluations=${connectorEvaluations.length}`,
          `denied=${connectorEvaluations.filter((evaluation) => evaluation.status === 'deny').length}`,
          `missingSecretRefs=${connectorEvaluations.flatMap((evaluation) => evaluation.missingSecretRefs).join(',') || 'none'}`,
        ],
        receiptIds: pack.receipts.receipts
          .filter((receipt) =>
            connectorEvaluations.some((evaluation) => evaluation.manifestId === receipt.manifestId)
            && receipt.status === 'deny'
          )
          .map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        liveSecretsUsed: false,
        secretValuesSerialized: false,
        enabledByDefault: false,
      },
      {
        id: 'non-destructive-smoke-only',
        status: pack.smokeRunner.nonDestructiveOnly
          && pack.smokeRunner.failed === 0
          && pack.smokeRunner.results.every((result) => result.destructive === false)
          && pack.smokeRunner.liveExternalIoPerformed === false
            ? 'passed'
            : 'failed',
        evidence: [
          `smokeTests=${pack.smokeRunner.smokeTests}`,
          `passed=${pack.smokeRunner.passed}`,
          `denied=${pack.smokeRunner.denied}`,
          `failed=${pack.smokeRunner.failed}`,
          `nonDestructiveOnly=${pack.smokeRunner.nonDestructiveOnly}`,
          `liveExternalIoPerformed=${pack.smokeRunner.liveExternalIoPerformed}`,
        ],
        receiptIds: pack.smokeRunner.results.map((result) => result.id),
        liveExternalIoPerformed: false,
        liveSecretsUsed: false,
        secretValuesSerialized: false,
        enabledByDefault: false,
      },
      {
        id: 'receipt-lifecycle-secret-safe',
        status: pack.receipts.status === 'pass'
          && pack.receipts.secretValuesSerialized === false
          && pack.receipts.liveExternalIoPerformed === false
          && pack.receipts.receipts.every((receipt) => receipt.secretValuesSerialized === false)
            ? 'passed'
            : 'failed',
        evidence: [
          `receipts=${pack.receipts.receipts.length}`,
          `imports=${pack.receipts.imports}`,
          `inspections=${pack.receipts.inspections}`,
          `denials=${pack.receipts.denials}`,
          `smokes=${pack.receipts.smokes}`,
          `secretValuesSerialized=${pack.receipts.secretValuesSerialized}`,
        ],
        receiptIds: pack.receipts.receipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        liveSecretsUsed: false,
        secretValuesSerialized: false,
        enabledByDefault: false,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticSkillEcosystemClaim {
    const id = `${input.kind}:${slug([
      input.idSeed ? `seed-${smallHash(input.idSeed)}` : undefined,
      input.manifestId,
      input.capabilityTag,
      input.profileId,
      input.receiptKind,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.manifestId ? { manifestId: input.manifestId } : {}),
      ...(input.capabilityTag ? { capabilityTag: input.capabilityTag } : {}),
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.receiptKind ? { receiptKind: input.receiptKind } : {}),
      ...(input.sourceStatus ? { sourceStatus: input.sourceStatus } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function uniqueCapabilityTags(pack: ZavorthSkillEcosystemPackSnapshot): ZavorthSkillCapabilityTag[] {
  return [...new Set(pack.importer.manifests.flatMap((manifest) => manifest.capabilityTags))].sort();
}

function scenarioBehavior(id: ZavorthSemanticSkillEcosystemScenario['id']): string {
  switch (id) {
    case 'inspect-before-enable':
      return 'Every skill can be inspected before enablement and no skill is enabled by default.';
    case 'live-connector-denied-without-secretref':
      return 'Live connector skills are denied safely when required SecretRefs are missing.';
    case 'non-destructive-smoke-only':
      return 'Skill smoke tests are non-destructive and produce pass or safe-denial results only.';
    case 'receipt-lifecycle-secret-safe':
      return 'Skill lifecycle receipts cover import, inspect, enable, execute, denial and smoke without secrets.';
    default:
      return 'Skill ecosystem scenario must pass.';
  }
}

function scenarioEquivalent(id: ZavorthSemanticSkillEcosystemScenario['id']): string {
  switch (id) {
    case 'inspect-before-enable':
      return 'Manifest inspectableBeforeEnablement plus inspect lifecycle receipts.';
    case 'live-connector-denied-without-secretref':
      return 'Permission evaluations and denial receipts for connector-live-secretref manifests.';
    case 'non-destructive-smoke-only':
      return 'ZavorthSkillSmokeRunner nonDestructiveOnly snapshot.';
    case 'receipt-lifecycle-secret-safe':
      return 'ZavorthSkillPackReceiptEmitter lifecycle receipt snapshot.';
    default:
      return 'Zavorth skill ecosystem semantic scenario receipt.';
  }
}

function countStatus(
  claims: ZavorthSemanticSkillEcosystemClaim[],
  status: ZavorthSemanticSkillEcosystemClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticSkillEcosystemClaim[],
  priority: ZavorthSemanticSkillEcosystemClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'unknown';
}

function smallHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}
