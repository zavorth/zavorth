import type {
  ChannelPackageEvidence,
  ChannelPackEntry,
  ChannelRuntimeAction,
  ChannelRuntimeReceipt,
  SourceChannelMeshExpansionSnapshot,
  SourceChannelMeshPackageName,
} from '../contracts/SourceChannelMeshExpansionContract.js';
import { SourceChannelMeshExpansionService } from './SourceChannelMeshExpansionService.js';
import { SourceChannelSecretPolicyService } from './SourceChannelSecretPolicyService.js';
import type {
  ZavorthSemanticChannelMeshCertificationSnapshot,
  ZavorthSemanticChannelMeshCertificationStatus,
  ZavorthSemanticChannelMeshClaim,
  ZavorthSemanticChannelMeshClaimKind,
  ZavorthSemanticChannelMeshClaimPriority,
  ZavorthSemanticChannelMeshClaimStatus,
  ZavorthSemanticChannelSecretScenario,
} from '../contracts/ZavorthSemanticChannelMeshCertificationContract.js';
import { ZAVORTH_SEMANTIC_CHANNEL_MESH_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticChannelMeshCertificationContract.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  channelMeshService?: Pick<SourceChannelMeshExpansionService, 'buildSnapshot'>;
  secretPolicyService?: SourceChannelSecretPolicyService;
};

type ClaimInput = {
  kind: ZavorthSemanticChannelMeshClaimKind;
  status: ZavorthSemanticChannelMeshClaimStatus;
  priority: ZavorthSemanticChannelMeshClaimPriority;
  packageName?: SourceChannelMeshPackageName;
  channelId?: ZavorthSemanticChannelMeshClaim['channelId'];
  family?: ZavorthSemanticChannelMeshClaim['family'];
  runtimeStatus?: ZavorthSemanticChannelMeshClaim['runtimeStatus'];
  action?: ChannelRuntimeAction;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const CHANNEL_RECEIPT_PREFIX = 'zavorth.semantic.s4.channel-mesh';

export class ZavorthSemanticChannelMeshCertificationService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly channelMeshService: Pick<SourceChannelMeshExpansionService, 'buildSnapshot'>;
  private readonly secretPolicyService: SourceChannelSecretPolicyService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.channelMeshService = runtime.channelMeshService || new SourceChannelMeshExpansionService({
      now: this.now,
      sourceRoot: this.sourceRoot,
      zavorthRoot: this.zavorthRoot,
    });
    this.secretPolicyService = runtime.secretPolicyService || new SourceChannelSecretPolicyService();
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): ZavorthSemanticChannelMeshCertificationSnapshot {
    const channelMesh = this.channelMeshService.buildSnapshot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot: input.zavorthRoot || this.zavorthRoot,
    });
    const secretScenarios = this.buildSecretScenarios();
    const claims = this.buildClaims(channelMesh, secretScenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticChannelMeshCertificationStatus =
      channelMesh.status === 'passed'
      && gaps === 0
      && secretScenarios.every((scenario) => scenario.status === 'passed')
      && channelMesh.summary.liveIoPerformed === false
      && channelMesh.summary.enabledByDefault === false
      && channelMesh.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_CHANNEL_MESH_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S4',
      statement: 'Channel Mesh semantics are certified as optional channel packs, SecretRef and allowlist policy, offline action receipts and explicit live-smoke controls.',
      sourceRoot: channelMesh.sourceRoot,
      zavorthRoot: channelMesh.zavorthRoot,
      channelMeshStatus: channelMesh.status,
      channelMeshContractVersion: channelMesh.contractVersion,
      claims,
      secretScenarios,
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
        packagesCertified: claims.filter((claim) => claim.kind === 'package-coverage').length,
        packsCertified: claims.filter((claim) => claim.kind === 'pack-runtime').length,
        secretPoliciesCertified: claims.filter((claim) => claim.kind === 'secret-policy').length,
        allowlistPoliciesCertified: claims.filter((claim) => claim.kind === 'allowlist-policy').length,
        simulatorActionsCertified: claims.filter((claim) => claim.kind === 'simulator-action').length,
        secretScenariosPassed: secretScenarios.filter((scenario) => scenario.status === 'passed').length,
        packStatuses: Object.fromEntries(channelMesh.packs.map((pack) => [pack.channelId, pack.status])),
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryChannelPackage: true,
        optionalPacksOnly: true,
        secretRefOnlyChannelAuth: true,
        allowlistRequiredBeforeLiveSend: true,
        webhookAndInboundRequireReceipts: true,
        simulatorMustCoverCoreActions: true,
        whatsappBaileysRequiresPatchRiskOwnerDecision: true,
        noLiveIoDuringCertification: true,
        liveSmokeRequiresExplicitOperatorCommand: true,
        rawSecretValuesRejected: true,
        unallowlistedLiveSendRejected: true,
        noSourceSourceCopy: true,
        artifactFirstReceipts: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-channel-mesh-certification --silent',
        inspectJson: 'npm run semantic-channel-mesh-certification:json --silent',
        check: 'npm run semantic-channel-mesh-certification:check --silent',
        qa: 'npm run qa:semantic-channel-mesh-certification --silent',
        nextPhase: 'S5 - Memory, Document, Search And Terminal Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic Channel Mesh Certification - S4',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Channel mesh status: ${snapshot.channelMeshStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Packages certified: ${snapshot.summary.packagesCertified}`,
      `Packs certified: ${snapshot.summary.packsCertified}`,
      `Secret policies certified: ${snapshot.summary.secretPoliciesCertified}`,
      `Allowlist policies certified: ${snapshot.summary.allowlistPoliciesCertified}`,
      `Simulator actions certified: ${snapshot.summary.simulatorActionsCertified}`,
      `Secret scenarios passed: ${snapshot.summary.secretScenariosPassed}/${snapshot.secretScenarios.length}`,
      `Live I/O performed: ${snapshot.summary.liveIoPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextPhase}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    channelMesh: SourceChannelMeshExpansionSnapshot,
    secretScenarios: ZavorthSemanticChannelSecretScenario[],
  ): ZavorthSemanticChannelMeshClaim[] {
    return [
      ...channelMesh.packageEvidence.map((evidence) => this.packageClaim(evidence)),
      ...channelMesh.packs.map((pack) => this.packClaim(pack)),
      ...channelMesh.packs.map((pack) => this.secretPolicyClaim(pack)),
      ...channelMesh.packs.map((pack) => this.allowlistClaim(pack)),
      ...this.simulatorClaims(channelMesh),
      ...this.webhookClaim(channelMesh),
      ...this.patchRiskClaims(channelMesh),
      ...this.liveIoAndReceiptClaims(channelMesh),
      ...this.secretScenarioClaims(secretScenarios),
      ...this.unsafeChannelClaims(channelMesh),
    ];
  }

  private packageClaim(evidence: ChannelPackageEvidence): ZavorthSemanticChannelMeshClaim {
    return this.claim({
      kind: 'package-coverage',
      status: packageStatus(evidence),
      priority: packagePriority(evidence.packageName),
      packageName: evidence.packageName,
      expectedBehavior: `${evidence.packageName} channel dependency is classified before Channel Mesh adoption decisions.`,
      zavorthEquivalent: packageEquivalent(evidence.packageName, evidence.decision),
      evidence: [
        `decision=${evidence.decision}`,
        `presentInSource=${evidence.presentInSource}`,
        `presentInZavorthPackageJson=${evidence.presentInZavorthPackageJson}`,
        `presentInZavorthLockfile=${evidence.presentInZavorthLockfile}`,
        `sourceReferences=${evidence.sourceReferenceFiles.length}`,
        `zavorthReferences=${evidence.zavorthReferenceFiles.length}`,
      ],
      notes: ['S4 certifies package coverage by channel behavior, not copied channel layout.'],
    });
  }

  private packClaim(pack: ChannelPackEntry): ZavorthSemanticChannelMeshClaim {
    return this.claim({
      kind: 'pack-runtime',
      status: packStatus(pack),
      priority: pack.ownerApprovalRequired ? 'P1' : 'P0',
      channelId: pack.channelId,
      family: pack.family,
      runtimeStatus: pack.status,
      expectedBehavior: `${pack.channelId} channel behavior has an explicit optional Channel Mesh pack contract.`,
      zavorthEquivalent: pack.adapterPath,
      evidence: [
        `status=${pack.status}`,
        `decision=${pack.decision}`,
        `family=${pack.family}`,
        `actions=${pack.contract.actions.join(',')}`,
        `enabledByDefault=${pack.enabledByDefault}`,
        `liveIoPerformed=${pack.liveIoPerformed}`,
        `explicitLiveCommandRequired=${pack.contract.explicitLiveCommandRequired}`,
        `secretRefOnlyAuth=${pack.contract.secretRefOnlyAuth}`,
        `allowlistRequired=${pack.contract.allowlistRequired}`,
      ],
      receiptIds: [
        `${CHANNEL_RECEIPT_PREFIX}.pack.${pack.channelId}`,
        'source-channel-mesh-expansion.runtime-receipt',
      ],
      notes: pack.notes,
    });
  }

  private secretPolicyClaim(pack: ChannelPackEntry): ZavorthSemanticChannelMeshClaim {
    const secret = pack.secretPolicy;
    return this.claim({
      kind: 'secret-policy',
      status: secret.rawSecretValuesAccepted === false && secret.secretValuesSerialized === false
        ? 'covered'
        : 'gap',
      priority: 'P0',
      channelId: pack.channelId,
      family: pack.family,
      runtimeStatus: pack.status,
      expectedBehavior: `${pack.channelId} channel auth uses SecretRef metadata only.`,
      zavorthEquivalent: 'SourceChannelSecretPolicyService receipt with required and optional SecretRef names.',
      evidence: [
        `secretStatus=${secret.status}`,
        `requiredSecretRefs=${secret.requiredSecretRefs.join(',')}`,
        `optionalSecretRefs=${secret.optionalSecretRefs.join(',')}`,
        `missingRequiredSecretRefs=${secret.missingRequiredSecretRefs.join(',')}`,
        `rawSecretValuesAccepted=${secret.rawSecretValuesAccepted}`,
        `secretValuesSerialized=${secret.secretValuesSerialized}`,
      ],
      receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.secret-policy.${pack.channelId}`],
      notes: ['Missing live secrets keep channels unconfigured; this is not a certification gap.'],
    });
  }

  private allowlistClaim(pack: ChannelPackEntry): ZavorthSemanticChannelMeshClaim {
    const secret = pack.secretPolicy;
    return this.claim({
      kind: 'allowlist-policy',
      status: secret.allowlistRefs.length > 0 && pack.contract.allowlistRequired ? 'covered' : 'gap',
      priority: 'P0',
      channelId: pack.channelId,
      family: pack.family,
      runtimeStatus: pack.status,
      expectedBehavior: `${pack.channelId} live send requires a channel/user/conversation allowlist before execution.`,
      zavorthEquivalent: 'Channel Mesh allowlist refs are present in secret policy receipts.',
      evidence: [
        `allowlistRequired=${pack.contract.allowlistRequired}`,
        `allowlistRefs=${secret.allowlistRefs.join(',')}`,
        `missingAllowlistRefs=${secret.missingAllowlistRefs.join(',')}`,
      ],
      receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.allowlist.${pack.channelId}`],
      notes: ['Allowlist absence blocks live sending but does not block offline semantic certification.'],
    });
  }

  private simulatorClaims(channelMesh: SourceChannelMeshExpansionSnapshot): ZavorthSemanticChannelMeshClaim[] {
    const receiptsByAction = new Map<ChannelRuntimeAction, ChannelRuntimeReceipt[]>();
    for (const receipt of channelMesh.simulator.receipts) {
      receiptsByAction.set(receipt.action, [...(receiptsByAction.get(receipt.action) || []), receipt]);
    }
    return channelMesh.simulator.actionsCovered.map((action) => {
      const receipts = receiptsByAction.get(action) || [];
      return this.claim({
        kind: 'simulator-action',
        status: receipts.length > 0 && receipts.every((receipt) => !receipt.liveIoPerformed && !receipt.secretValuesSerialized)
          ? 'covered'
          : 'gap',
        priority: action === 'send' || action === 'receive' || action === 'thread' ? 'P0' : 'P1',
        channelId: channelMesh.simulator.channelId,
        action,
        expectedBehavior: `Offline simulator covers ${action} channel action with receipt-backed behavior.`,
        zavorthEquivalent: 'SourceChannelSimulatorService normalized message and receipt model.',
        evidence: [
          `action=${action}`,
          `receipts=${receipts.length}`,
          `liveIoPerformed=${channelMesh.simulator.summary.liveIoPerformed}`,
          `secretValuesSerialized=${channelMesh.simulator.summary.secretValuesSerialized}`,
        ],
        receiptIds: receipts.map((receipt) => receipt.id),
        notes: receipts.map((receipt) => receipt.reason),
      });
    });
  }

  private webhookClaim(channelMesh: SourceChannelMeshExpansionSnapshot): ZavorthSemanticChannelMeshClaim[] {
    const hasReceive = channelMesh.simulator.actionsCovered.includes('receive');
    const receiveReceipts = channelMesh.simulator.receipts.filter((receipt) => receipt.action === 'receive');
    return [
      this.claim({
        kind: 'webhook-policy',
        status: hasReceive && receiveReceipts.length > 0 ? 'covered' : 'gap',
        priority: 'P0',
        channelId: channelMesh.simulator.channelId,
        action: 'receive',
        expectedBehavior: 'Inbound/webhook-style messages are normalized into channel messages with receipts before agent handling.',
        zavorthEquivalent: 'Channel simulator receive action and ChannelRuntimeMessage contract.',
        evidence: [
          `hasReceive=${hasReceive}`,
          `receiveReceipts=${receiveReceipts.length}`,
          `messages=${channelMesh.simulator.summary.messages}`,
        ],
        receiptIds: receiveReceipts.map((receipt) => receipt.id),
        notes: ['Webhook safety is certified as normalized inbound message semantics plus SecretRef policy.'],
      }),
    ];
  }

  private patchRiskClaims(channelMesh: SourceChannelMeshExpansionSnapshot): ZavorthSemanticChannelMeshClaim[] {
    const baileys = channelMesh.packs.find((pack) => pack.channelId === 'whatsapp-baileys');
    if (!baileys?.patchRiskReceipt) {
      return [
        this.claim({
          kind: 'patch-risk-policy',
          status: 'gap',
          priority: 'P0',
          channelId: 'whatsapp-baileys',
          expectedBehavior: 'WhatsApp Baileys requires explicit patch-risk owner decision.',
          zavorthEquivalent: 'WhatsAppChannelPack patch risk receipt.',
          evidence: ['patchRiskReceipt=missing'],
          notes: ['Missing patch risk receipt blocks S4.'],
        }),
      ];
    }
    const patch = baileys.patchRiskReceipt;
    return [
      this.claim({
        kind: 'patch-risk-policy',
        status: patch.status === 'owner_decision_required' && patch.ownerDecisionRequired ? 'owner-gated' : 'gap',
        priority: 'P0',
        channelId: 'whatsapp-baileys',
        packageName: '@whiskeysockets/baileys',
        expectedBehavior: 'WhatsApp Baileys remains owner-gated until patch and package risk are accepted.',
        zavorthEquivalent: 'WhatsAppChannelPack buildBaileysPatchRiskReceipt.',
        evidence: [
          `status=${patch.status}`,
          `packageName=${patch.packageName}`,
          `patchPresentInSource=${patch.patchPresentInSource}`,
          `packageInstalledInZavorth=${patch.packageInstalledInZavorth}`,
          `ownerDecisionRequired=${patch.ownerDecisionRequired}`,
          `patchEvidencePath=${patch.patchEvidencePath || ''}`,
        ],
        receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.patch-risk.whatsapp-baileys`],
        notes: [patch.reason],
      }),
    ];
  }

  private liveIoAndReceiptClaims(channelMesh: SourceChannelMeshExpansionSnapshot): ZavorthSemanticChannelMeshClaim[] {
    return [
      this.claim({
        kind: 'live-io-policy',
        status: channelMesh.summary.liveIoPerformed === false && channelMesh.summary.enabledByDefault === false
          ? 'covered'
          : 'gap',
        priority: 'P0',
        expectedBehavior: 'S4 certification does not perform live channel I/O and never enables channels by default.',
        zavorthEquivalent: 'Channel Mesh expansion emits offline receipts and exposes separate explicit live smoke commands.',
        evidence: [
          `liveIoPerformed=${channelMesh.summary.liveIoPerformed}`,
          `enabledByDefault=${channelMesh.summary.enabledByDefault}`,
          `liveSmoke=${channelMesh.commands.liveSmoke}`,
        ],
        receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.live-io.no-default-live`],
        notes: ['Live smoke remains an explicit operator action.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: channelMesh.policy.artifactFirstReceipts
          && channelMesh.simulator.summary.receipts >= channelMesh.simulator.actionsCovered.length
          && channelMesh.summary.secretValuesSerialized === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Channel Mesh certification is artifact-first and receipt-backed.',
        zavorthEquivalent: 'Simulator, secret policy, patch risk and live smoke paths all emit receipts.',
        evidence: [
          `artifactFirstReceipts=${channelMesh.policy.artifactFirstReceipts}`,
          `simulatorReceipts=${channelMesh.summary.simulatorReceipts}`,
          `actionsCovered=${channelMesh.summary.actionsCovered}`,
          `secretValuesSerialized=${channelMesh.summary.secretValuesSerialized}`,
          'sourceCodeCopied=false',
        ],
        receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.receipt-policy.artifact-first`],
        notes: ['Receipts store metadata, not raw token or signing secret values.'],
      }),
    ];
  }

  private secretScenarioClaims(
    scenarios: ZavorthSemanticChannelSecretScenario[],
  ): ZavorthSemanticChannelMeshClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: 'secret-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: 'P0',
      channelId: scenario.channelId,
      expectedBehavior: secretScenarioExpectedBehavior(scenario.id),
      zavorthEquivalent: secretScenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.secret-scenario.${scenario.id}`],
      notes: ['Secret scenario proves SecretRef and allowlist behavior without exposing raw values.'],
    }));
  }

  private unsafeChannelClaims(channelMesh: SourceChannelMeshExpansionSnapshot): ZavorthSemanticChannelMeshClaim[] {
    return [
      this.claim({
        kind: 'unsafe-channel-policy',
        status: channelMesh.policy.secretRefOnlyChannelAuth ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw secret value channel auth.',
        zavorthEquivalent: 'Channel auth accepts SecretRef/env-name policy only.',
        evidence: [`secretRefOnlyChannelAuth=${channelMesh.policy.secretRefOnlyChannelAuth}`],
        receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.reject.raw-channel-secret-values`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'unsafe-channel-policy',
        status: channelMesh.policy.allowlistRequiredBeforeLiveSend ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject unallowlisted live channel sends.',
        zavorthEquivalent: 'Channel Mesh requires allowlist refs before live send routes.',
        evidence: [`allowlistRequiredBeforeLiveSend=${channelMesh.policy.allowlistRequiredBeforeLiveSend}`],
        receiptIds: [`${CHANNEL_RECEIPT_PREFIX}.reject.unallowlisted-live-send`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
    ];
  }

  private buildSecretScenarios(): ZavorthSemanticChannelSecretScenario[] {
    const missingRequired = this.secretPolicyService.buildReceipt({
      channelId: 'slack',
      requiredSecretRefs: ['SLACK_BOT_TOKEN'],
      allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
      env: {
        SLACK_ALLOWED_CHANNEL_IDS: 'C123',
      },
    });
    const configuredRedacted = this.secretPolicyService.buildReceipt({
      channelId: 'slack',
      requiredSecretRefs: ['SLACK_BOT_TOKEN'],
      optionalSecretRefs: ['SLACK_SIGNING_SECRET'],
      allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
      env: {
        SLACK_BOT_TOKEN: 'xoxb-secret',
        SLACK_SIGNING_SECRET: 'signing-secret',
        SLACK_ALLOWED_CHANNEL_IDS: 'C123',
      },
    });
    const missingAllowlist = this.secretPolicyService.buildReceipt({
      channelId: 'slack',
      requiredSecretRefs: ['SLACK_BOT_TOKEN'],
      allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
      env: {
        SLACK_BOT_TOKEN: 'xoxb-secret',
      },
    });

    return [
      scenario(
        'missing-required-secret',
        missingRequired,
        missingRequired.status === 'failed'
          && missingRequired.missingRequiredSecretRefs.includes('SLACK_BOT_TOKEN')
          && missingRequired.secretValuesSerialized === false,
      ),
      scenario(
        'configured-secret-redacted',
        configuredRedacted,
        configuredRedacted.status === 'passed'
          && configuredRedacted.secretValuesSerialized === false
          && !JSON.stringify(configuredRedacted).includes('xoxb-secret')
          && !JSON.stringify(configuredRedacted).includes('signing-secret'),
      ),
      scenario(
        'missing-allowlist',
        missingAllowlist,
        missingAllowlist.status === 'failed'
          && missingAllowlist.missingAllowlistRefs.includes('SLACK_ALLOWED_CHANNEL_IDS')
          && missingAllowlist.secretValuesSerialized === false,
      ),
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticChannelMeshClaim {
    const id = `${input.kind}:${slug([
      input.channelId,
      input.packageName,
      input.action,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.packageName ? { packageName: input.packageName } : {}),
      ...(input.channelId ? { channelId: input.channelId } : {}),
      ...(input.family ? { family: input.family } : {}),
      ...(input.runtimeStatus ? { runtimeStatus: input.runtimeStatus } : {}),
      ...(input.action ? { action: input.action } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${CHANNEL_RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function packageStatus(evidence: ChannelPackageEvidence): ZavorthSemanticChannelMeshClaimStatus {
  if (!evidence.presentInSource) {
    return 'gap';
  }
  if (evidence.decision === 'implemented') {
    return evidence.presentInZavorthPackageJson ? 'covered' : 'gap';
  }
  if (evidence.decision === 'replaced' || evidence.decision === 'not-needed') {
    return 'replaced';
  }
  return 'owner-gated';
}

function packagePriority(packageName: SourceChannelMeshPackageName): ZavorthSemanticChannelMeshClaimPriority {
  if (packageName === '@slack/web-api' || packageName === 'qrcode') return 'P0';
  if (packageName === '@whiskeysockets/baileys') return 'P0';
  return 'P1';
}

function packageEquivalent(
  packageName: SourceChannelMeshPackageName,
  decision: ChannelPackageEvidence['decision'],
): string {
  if (decision === 'not-needed') {
    return 'Zavorth-native channel runtime replaces the dependency with no package import requirement.';
  }
  if (decision === 'replaced') {
    return 'Existing Zavorth-native channel gateway covers the channel family.';
  }
  if (decision === 'owner-gated') {
    return 'Optional owner-gated channel route requiring explicit decision before live use.';
  }
  switch (packageName) {
    case '@slack/web-api':
      return 'SlackChannelPack with opt-in live smoke and allowlist policy.';
    case 'qrcode':
      return 'WhatsApp Cloud/Baileys pairing support through governed channel packs.';
    default:
      return 'Zavorth Channel Mesh pack.';
  }
}

function packStatus(pack: ChannelPackEntry): ZavorthSemanticChannelMeshClaimStatus {
  if (pack.status === 'missing' || pack.status === 'blocked') {
    return 'gap';
  }
  if (pack.status === 'owner_decision_required') {
    return 'owner-gated';
  }
  if (pack.status === 'replaced-by-existing-channel') {
    return 'replaced';
  }
  return 'covered';
}

function secretScenarioExpectedBehavior(id: ZavorthSemanticChannelSecretScenario['id']): string {
  switch (id) {
    case 'missing-required-secret':
      return 'Missing required channel secrets are reported by SecretRef name only.';
    case 'configured-secret-redacted':
      return 'Configured channel secrets are reported as present without serializing raw values.';
    case 'missing-allowlist':
      return 'Missing live channel allowlists block live send readiness by allowlist ref name.';
    default:
      return 'Channel secret scenario is certified.';
  }
}

function secretScenarioEquivalent(id: ZavorthSemanticChannelSecretScenario['id']): string {
  switch (id) {
    case 'missing-required-secret':
      return 'SourceChannelSecretPolicyService missing required SecretRef receipt.';
    case 'configured-secret-redacted':
      return 'SourceChannelSecretPolicyService configured redacted receipt.';
    case 'missing-allowlist':
      return 'SourceChannelSecretPolicyService missing allowlist receipt.';
    default:
      return 'Channel secret policy receipt.';
  }
}

function scenario(
  id: ZavorthSemanticChannelSecretScenario['id'],
  receipt: ReturnType<SourceChannelSecretPolicyService['buildReceipt']>,
  pass: boolean,
): ZavorthSemanticChannelSecretScenario {
  return {
    id,
    status: pass ? 'passed' : 'failed',
    channelId: receipt.channelId,
    evidence: [
      `status=${receipt.status}`,
      `requiredSecretRefs=${receipt.requiredSecretRefs.join(',')}`,
      `optionalSecretRefs=${receipt.optionalSecretRefs.join(',')}`,
      `allowlistRefs=${receipt.allowlistRefs.join(',')}`,
      `missingRequiredSecretRefs=${receipt.missingRequiredSecretRefs.join(',')}`,
      `missingAllowlistRefs=${receipt.missingAllowlistRefs.join(',')}`,
      `rawSecretValuesAccepted=${receipt.rawSecretValuesAccepted}`,
      `secretValuesSerialized=${receipt.secretValuesSerialized}`,
    ],
    secretValuesSerialized: false,
  };
}

function countStatus(
  claims: ZavorthSemanticChannelMeshClaim[],
  status: ZavorthSemanticChannelMeshClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticChannelMeshClaim[],
  priority: ZavorthSemanticChannelMeshClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
