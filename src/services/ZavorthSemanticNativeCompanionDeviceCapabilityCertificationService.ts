import type {
  ZavorthNativeCapabilityId,
  ZavorthNativeCapabilityReceipt,
  ZavorthNativeCapabilityStatus,
  ZavorthNativeCompanionDeviceSnapshot,
  ZavorthNativePermissionMode,
  ZavorthNativeRuntimeTarget,
} from '../contracts/ZavorthNativeCompanionDeviceContract.js';
import { ZavorthNativeCompanionDevicePackService } from './ZavorthNativeCompanionDevicePackService.js';
import type {
  ZavorthSemanticNativeCompanionDeviceCapabilityCertificationSnapshot,
  ZavorthSemanticNativeCompanionDeviceCapabilityCertificationStatus,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaim,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaimKind,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority,
  ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus,
  ZavorthSemanticNativeCompanionDeviceCapabilityScenario,
} from '../contracts/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationContract.js';
import { ZAVORTH_SEMANTIC_NATIVE_COMPANION_DEVICE_CAPABILITY_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticNativeCompanionDeviceCapabilityCertificationContract.js';

type Runtime = {
  now?: () => Date;
  cwd?: string;
  tempRoot?: string;
  packService?: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot' | 'buildMlxTtsPreviewReceipt'>;
};

type ClaimInput = {
  kind: ZavorthSemanticNativeCompanionDeviceCapabilityClaimKind;
  status: ZavorthSemanticNativeCompanionDeviceCapabilityClaimStatus;
  priority: ZavorthSemanticNativeCompanionDeviceCapabilityClaimPriority;
  target?: ZavorthNativeRuntimeTarget;
  capabilityId?: ZavorthNativeCapabilityId;
  capabilityStatus?: ZavorthNativeCapabilityStatus;
  permissionMode?: ZavorthNativePermissionMode;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const RECEIPT_PREFIX = 'zavorth.semantic.s6.native-companion-device-capability';

export class ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService {
  private readonly now: () => Date;
  private readonly packService: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot' | 'buildMlxTtsPreviewReceipt'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.packService = runtime.packService || new ZavorthNativeCompanionDevicePackService({
      now: this.now,
      cwd: runtime.cwd,
      tempRoot: runtime.tempRoot,
    });
  }

  public async buildSnapshot(): Promise<ZavorthSemanticNativeCompanionDeviceCapabilityCertificationSnapshot> {
    const pack = await this.packService.buildSnapshot();
    const scenarios = this.buildScenarios(pack);
    const claims = this.buildClaims(pack, scenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticNativeCompanionDeviceCapabilityCertificationStatus =
      pack.status === 'passed'
      && gaps === 0
      && scenarios.every((scenario) => scenario.status === 'passed')
      && pack.summary.liveExternalIoPerformed === false
      && pack.summary.enabledByDefault === false
      && pack.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_NATIVE_COMPANION_DEVICE_CAPABILITY_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S6',
      statement: 'Native companion and device capability semantics are certified as browser-first, optional, permissioned and receipt-backed Zavorth runtimes.',
      packStatus: pack.status,
      packContractVersion: pack.contractVersion,
      runtime: pack.runtime,
      claims,
      scenarios,
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
        targetClaimsCertified: claims.filter((claim) => claim.kind === 'target-coverage').length,
        capabilityClaimsCertified: claims.filter((claim) => claim.kind === 'capability-coverage').length,
        bridgeClaimsCertified: claims.filter((claim) =>
          claim.kind === 'pwa-bridge'
          || claim.kind === 'desktop-bridge'
          || claim.kind === 'shared-device-runtime'
        ).length,
        permissionPoliciesCertified: claims.filter((claim) => claim.kind === 'permission-policy').length,
        wrapperGateClaimsCertified: claims.filter((claim) => claim.kind === 'wrapper-owner-gate').length,
        optionalRuntimeClaimsCertified: claims.filter((claim) => claim.kind === 'optional-runtime-policy').length,
        scenariosPassed: scenarios.filter((scenario) => scenario.status === 'passed').length,
        capabilityStatusCounts: capabilityStatusCounts(pack),
        targetStatuses: Object.fromEntries(pack.parity.map((entry) => [entry.target, entry.status])),
        liveExternalIoPerformed: false,
        enabledByDefault: false,
        processSpawnedByDefault: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryNativeTarget: true,
        semanticClaimRequiredForEveryNativeCapability: true,
        browserPwaFirst: true,
        desktopCompanionOptional: true,
        androidIosMacosWrappersOwnerGated: true,
        mlxTtsNeverEnabledByDefault: true,
        cameraLocationRequirePermission: true,
        sensitiveDeviceConfirmRequiresTrust: true,
        screenClipboardReportOnlyWithoutApproval: true,
        shareSheetArtifactFirst: true,
        offlineQueueRequired: true,
        unsupportedNativeApisExplicit: true,
        localTtsRequiresApproval: true,
        noLiveIoDuringCertification: true,
        noSourceAppCodeCopy: true,
        artifactFirstReceipts: true,
        rawSecretValuesRejected: true,
        defaultNativeAccessRejected: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-native-companion-device-capability-certification --silent',
        inspectJson: 'npm run semantic-native-companion-device-capability-certification:json --silent',
        check: 'npm run semantic-native-companion-device-capability-certification:check --silent',
        qa: 'npm run qa:semantic-native-companion-device-capability-certification --silent',
        nextStage: 'S7 - QA, Security And Release Certification Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSemanticNativeCompanionDeviceCapabilityCertificationSnapshot): string {
    const lines = [
      'Zavorth Semantic Native Companion Device Capability Certification - S6',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Pack status: ${snapshot.packStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Target claims certified: ${snapshot.summary.targetClaimsCertified}`,
      `Capability claims certified: ${snapshot.summary.capabilityClaimsCertified}`,
      `Bridge claims certified: ${snapshot.summary.bridgeClaimsCertified}`,
      `Permission policies certified: ${snapshot.summary.permissionPoliciesCertified}`,
      `Wrapper gates certified: ${snapshot.summary.wrapperGateClaimsCertified}`,
      `Optional runtime claims certified: ${snapshot.summary.optionalRuntimeClaimsCertified}`,
      `Scenarios passed: ${snapshot.summary.scenariosPassed}/${snapshot.scenarios.length}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Process spawned by default: ${snapshot.summary.processSpawnedByDefault}`,
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
    pack: ZavorthNativeCompanionDeviceSnapshot,
    scenarios: ZavorthSemanticNativeCompanionDeviceCapabilityScenario[],
  ): ZavorthSemanticNativeCompanionDeviceCapabilityClaim[] {
    return [
      ...pack.parity.map((entry) => this.targetClaim(entry)),
      ...uniqueCapabilities(pack).map((capabilityId) => this.capabilityClaim(pack, capabilityId)),
      this.pwaBridgeClaim(pack),
      this.desktopBridgeClaim(pack),
      this.sharedDeviceRuntimeClaim(pack),
      this.optionalRuntimeClaim(pack),
      ...pack.parity
        .filter((entry) => entry.status === 'owner-gated')
        .map((entry) => this.wrapperGateClaim(entry)),
      ...this.permissionPolicyClaims(pack),
      ...this.globalPolicyClaims(pack),
      ...this.scenarioClaims(scenarios),
      ...this.unsafeNativeClaims(pack),
    ];
  }

  private targetClaim(entry: ZavorthNativeCompanionDeviceSnapshot['parity'][number]): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    return this.claim({
      kind: 'target-coverage',
      status: targetStatus(entry),
      priority: targetPriority(entry.target),
      target: entry.target,
      expectedBehavior: `${entry.target} is classified as a concrete native companion/device target before adoption.`,
      zavorthEquivalent: targetEquivalent(entry.target),
      evidence: [
        `decision=${entry.decision}`,
        `status=${entry.status}`,
        `bridge=${entry.bridge}`,
        `capabilities=${entry.capabilities.length}`,
        `enabledByDefault=${entry.enabledByDefault}`,
        `ownerDecisionRequired=${entry.ownerDecisionRequired}`,
      ],
      receiptIds: entry.receipts.map((receipt) => receipt.id),
      notes: entry.notes,
    });
  }

  private capabilityClaim(
    pack: ZavorthNativeCompanionDeviceSnapshot,
    capabilityId: ZavorthNativeCapabilityId,
  ): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    const receipts = receiptsForCapability(pack, capabilityId);
    const capabilityStatus = combinedCapabilityStatus(receipts);
    return this.claim({
      kind: 'capability-coverage',
      status: semanticCapabilityStatus(receipts),
      priority: capabilityPriority(capabilityId),
      capabilityId,
      capabilityStatus,
      permissionMode: strongestPermission(receipts),
      expectedBehavior: capabilityBehavior(capabilityId),
      zavorthEquivalent: `ZavorthNativeCapabilityReceipt coverage through ${[...new Set(receipts.map((receipt) => receipt.target))].join(', ')}.`,
      evidence: [
        `receipts=${receipts.length}`,
        `statuses=${receipts.map((receipt) => receipt.status).join(',')}`,
        `permissionModes=${[...new Set(receipts.map((receipt) => receipt.permissionMode))].join(',')}`,
        `artifactFirst=${receipts.every((receipt) => receipt.artifactFirst)}`,
        `liveExternalIoPerformed=${receipts.some((receipt) => receipt.liveExternalIoPerformed)}`,
        `enabledByDefault=${receipts.some((receipt) => receipt.enabledByDefault)}`,
        `secretValuesSerialized=${receipts.some((receipt) => receipt.secretValuesSerialized)}`,
      ],
      receiptIds: receipts.map((receipt) => receipt.id),
      notes: [`Capability ${capabilityId} is certified by behavior and permission mode, not by native app source layout.`],
    });
  }

  private pwaBridgeClaim(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    return this.claim({
      kind: 'pwa-bridge',
      status: pack.satellite.status === 'passed'
        && pack.satellite.pairingClaimed
        && pack.satellite.heartbeatAccepted
        && pack.satellite.offlineQueueDelivered
          ? 'covered'
          : 'gap',
      priority: 'P0',
      target: 'satellite-pwa',
      expectedBehavior: 'Browser/PWA companion path proves pairing, heartbeat, device proof and offline queue before native wrappers are promised.',
      zavorthEquivalent: 'ZavorthSatelliteCapabilityBridgeService proof with artifact-first receipt.',
      evidence: [
        `status=${pack.satellite.status}`,
        `pairingClaimed=${pack.satellite.pairingClaimed}`,
        `heartbeatAccepted=${pack.satellite.heartbeatAccepted}`,
        `queuedInvocations=${pack.satellite.queuedInvocationIds.length}`,
        `completedCapabilities=${pack.satellite.completedCapabilityIds.join(',')}`,
        `offlineQueueDelivered=${pack.satellite.offlineQueueDelivered}`,
        `deviceDoctorOk=${pack.satellite.deviceDoctorOk}`,
      ],
      receiptIds: [pack.satellite.receipt.id],
      notes: ['S6 treats browser/PWA capability proof as the first-class implementation path.'],
    });
  }

  private desktopBridgeClaim(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    return this.claim({
      kind: 'desktop-bridge',
      status: (pack.desktop.status === 'passed' || pack.desktop.status === 'attention')
        && pack.desktop.receipts.every((receipt) => receipt.liveExternalIoPerformed === false)
        && pack.desktop.gatedCapabilities.includes('desktop.screen')
        && pack.desktop.gatedCapabilities.includes('desktop.clipboard')
          ? 'covered'
          : 'gap',
      priority: 'P0',
      target: 'desktop-companion',
      expectedBehavior: 'Desktop companion reports host capabilities without reading screen or clipboard by default.',
      zavorthEquivalent: 'ZavorthDesktopCompanionBridgeService capability proof with gated desktop receipts.',
      evidence: [
        `status=${pack.desktop.status}`,
        `profileId=${pack.desktop.profileId}`,
        `availableCapabilities=${pack.desktop.availableCapabilities.join(',')}`,
        `gatedCapabilities=${pack.desktop.gatedCapabilities.join(',')}`,
        `liveExternalIoPerformed=${pack.desktop.liveExternalIoPerformed}`,
      ],
      receiptIds: pack.desktop.receipts.map((receipt) => receipt.id),
      notes: ['Screen and clipboard stay report-only until an explicit approval path exists.'],
    });
  }

  private sharedDeviceRuntimeClaim(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    const shared = requiredTarget(pack, 'shared-device-runtime');
    return this.claim({
      kind: 'shared-device-runtime',
      status: shared.status === 'covered'
        && shared.capabilities.includes('device.profile')
        && shared.capabilities.includes('device.pairing')
        && shared.capabilities.includes('offline.queue')
          ? 'covered'
          : 'gap',
      priority: 'P0',
      target: 'shared-device-runtime',
      expectedBehavior: 'Shared device runtime exposes profile, pairing, offline queue and share capabilities as governed receipts.',
      zavorthEquivalent: 'Node/device mesh profile and Satellite bridge receipts.',
      evidence: [
        `status=${shared.status}`,
        `bridge=${shared.bridge}`,
        `capabilities=${shared.capabilities.join(',')}`,
        `enabledByDefault=${shared.enabledByDefault}`,
      ],
      receiptIds: shared.receipts.map((receipt) => receipt.id),
      notes: shared.notes,
    });
  }

  private optionalRuntimeClaim(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    const localTts = requiredTarget(pack, 'macos-local-tts');
    return this.claim({
      kind: 'optional-runtime-policy',
      status: pack.mlxTts.enabledByDefault === false
        && pack.mlxTts.processSpawned === false
        && pack.mlxTts.approvalRequired
          ? 'covered'
          : 'gap',
      priority: 'P1',
      target: 'macos-local-tts',
      capabilityId: 'local.tts.mlx',
      expectedBehavior: 'Local TTS is represented as an optional runtime adapter and never runs without approval.',
      zavorthEquivalent: 'ZavorthMlxTtsRuntimeAdapter readiness/preview receipts.',
      evidence: [
        `status=${pack.mlxTts.status}`,
        `platform=${pack.mlxTts.platform}`,
        `commandRef=${pack.mlxTts.commandRef || 'none'}`,
        `approvalRequired=${pack.mlxTts.approvalRequired}`,
        `processSpawned=${pack.mlxTts.processSpawned}`,
        `enabledByDefault=${pack.mlxTts.enabledByDefault}`,
        `targetStatus=${localTts.status}`,
      ],
      receiptIds: [pack.mlxTts.id, ...localTts.receipts.map((receipt) => receipt.id)],
      notes: [pack.mlxTts.reason],
    });
  }

  private wrapperGateClaim(entry: ZavorthNativeCompanionDeviceSnapshot['parity'][number]): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    return this.claim({
      kind: 'wrapper-owner-gate',
      status: entry.ownerDecisionRequired && entry.enabledByDefault === false ? 'owner-gated' : 'gap',
      priority: 'P1',
      target: entry.target,
      expectedBehavior: `${entry.target} remains explicitly owner-gated until product scope, store policy and native permission model are approved.`,
      zavorthEquivalent: 'Owner-scope ledger entry with per-capability receipts.',
      evidence: [
        `decision=${entry.decision}`,
        `status=${entry.status}`,
        `ownerDecisionRequired=${entry.ownerDecisionRequired}`,
        `capabilities=${entry.capabilities.join(',')}`,
      ],
      receiptIds: entry.receipts.map((receipt) => receipt.id),
      notes: entry.notes,
    });
  }

  private permissionPolicyClaims(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim[] {
    const receipts = allReceipts(pack);
    return [
      this.claim({
        kind: 'permission-policy',
        status: pack.policy.cameraLocationRequirePermission
          && receiptsForCapability(pack, 'camera.capture').some((receipt) => receipt.permissionMode === 'browser-permission')
          && receiptsForCapability(pack, 'location.read').some((receipt) => receipt.permissionMode === 'browser-permission')
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Camera and location capabilities require explicit browser/device permission.',
        zavorthEquivalent: 'Capability receipts use browser-permission mode for camera.capture and location.read.',
        evidence: [
          `cameraLocationRequirePermission=${pack.policy.cameraLocationRequirePermission}`,
          `cameraPermissionModes=${receiptsForCapability(pack, 'camera.capture').map((receipt) => receipt.permissionMode).join(',')}`,
          `locationPermissionModes=${receiptsForCapability(pack, 'location.read').map((receipt) => receipt.permissionMode).join(',')}`,
        ],
        receiptIds: receiptsForCapability(pack, 'camera.capture').concat(receiptsForCapability(pack, 'location.read')).map((receipt) => receipt.id),
        notes: ['Browser/device permission is a policy requirement, not a silent default.'],
      }),
      this.claim({
        kind: 'permission-policy',
        status: pack.policy.biometricOrDeviceConfirmRequiresTrust
          && pack.satellite.sensitiveApprovalBlocked
            ? 'covered'
            : 'gap',
        priority: 'P0',
        capabilityId: 'device.confirm',
        expectedBehavior: 'Sensitive device confirmation is denied without trust or approval.',
        zavorthEquivalent: 'Satellite sensitive approval probe blocks device.confirm without trusted approval.',
        evidence: [
          `biometricOrDeviceConfirmRequiresTrust=${pack.policy.biometricOrDeviceConfirmRequiresTrust}`,
          `sensitiveApprovalBlocked=${pack.satellite.sensitiveApprovalBlocked}`,
        ],
        receiptIds: [pack.satellite.receipt.id, ...receiptsForCapability(pack, 'device.confirm').map((receipt) => receipt.id)],
        notes: ['Device confirmation is treated as a sensitive capability.'],
      }),
      this.claim({
        kind: 'permission-policy',
        status: pack.desktop.gatedCapabilities.includes('desktop.screen')
          && pack.desktop.gatedCapabilities.includes('desktop.clipboard')
          && pack.desktop.receipts.every((receipt) => receipt.liveExternalIoPerformed === false)
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Desktop screen and clipboard stay report-only unless an operator approval path allows access.',
        zavorthEquivalent: 'Desktop companion receipts mark screen and clipboard as gated operator capabilities.',
        evidence: [
          `gatedCapabilities=${pack.desktop.gatedCapabilities.join(',')}`,
          `desktopReceipts=${pack.desktop.receipts.length}`,
          `desktopLiveExternalIo=${pack.desktop.liveExternalIoPerformed}`,
        ],
        receiptIds: pack.desktop.receipts.map((receipt) => receipt.id),
        notes: ['Reporting capability availability is allowed; reading private desktop data is not.'],
      }),
      this.claim({
        kind: 'permission-policy',
        status: pack.policy.shareSheetArtifactFirst
          && pack.policy.offlineQueueRequired
          && receipts.some((receipt) => receipt.capabilityId === 'share.invoke')
          && pack.satellite.offlineQueueDelivered
            ? 'covered'
            : 'gap',
        priority: 'P1',
        expectedBehavior: 'Share sheet and offline queue actions are artifact-first and replayable.',
        zavorthEquivalent: 'Satellite and shared-device receipts cover share.invoke and offline.queue.',
        evidence: [
          `shareSheetArtifactFirst=${pack.policy.shareSheetArtifactFirst}`,
          `offlineQueueRequired=${pack.policy.offlineQueueRequired}`,
          `offlineQueueDelivered=${pack.satellite.offlineQueueDelivered}`,
          `shareReceiptCount=${receiptsForCapability(pack, 'share.invoke').length}`,
        ],
        receiptIds: receiptsForCapability(pack, 'share.invoke').concat(receiptsForCapability(pack, 'offline.queue')).map((receipt) => receipt.id),
        notes: ['Share/offline behavior is certified without live external I/O.'],
      }),
    ];
  }

  private globalPolicyClaims(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim[] {
    const receipts = allReceipts(pack);
    return [
      this.claim({
        kind: 'live-io-policy',
        status: pack.summary.liveExternalIoPerformed === false
          && pack.summary.enabledByDefault === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Native companion/device certification performs no live external I/O and enables no device bridge by default.',
        zavorthEquivalent: 'Runtime gateway pack summary and receipt policy keep native surfaces disabled by default.',
        evidence: [
          `liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`,
          `enabledByDefault=${pack.summary.enabledByDefault}`,
          `mlxTtsProcessSpawned=${pack.mlxTts.processSpawned}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.policy.no-default-live-io`],
        notes: ['Live device use is separated from certification.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: receipts.length > 0
          && receipts.every((receipt) => receipt.artifactFirst)
          && receipts.every((receipt) => receipt.secretValuesSerialized === false)
          && pack.satellite.receipt.artifactFirst
          && pack.mlxTts.artifactFirst
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Native companion/device behavior is artifact-first and receipt-backed.',
        zavorthEquivalent: 'ZavorthNativeCapabilityReceipt, Satellite bridge receipt and MLX TTS receipt metadata.',
        evidence: [
          `capabilityReceipts=${receipts.length}`,
          `artifactFirst=${receipts.every((receipt) => receipt.artifactFirst)}`,
          `secretValuesSerialized=${receipts.some((receipt) => receipt.secretValuesSerialized)}`,
          `sourceCodeCopied=false`,
        ],
        receiptIds: [pack.satellite.receipt.id, pack.mlxTts.id, ...receipts.map((receipt) => receipt.id)],
        notes: ['Receipts store policy metadata and refs only.'],
      }),
      this.claim({
        kind: 'unsupported-native-api-policy',
        status: pack.policy.unsupportedNativeApisExplicit
          && pack.satellite.unsupportedNativeApisExplicit
            ? 'covered'
            : 'gap',
        priority: 'P1',
        expectedBehavior: 'Unsupported native APIs are explicit instead of silently promised.',
        zavorthEquivalent: 'Pack policy and Satellite bridge proof mark unsupported native API behavior explicitly.',
        evidence: [
          `packUnsupportedNativeApisExplicit=${pack.policy.unsupportedNativeApisExplicit}`,
          `satelliteUnsupportedNativeApisExplicit=${pack.satellite.unsupportedNativeApisExplicit}`,
        ],
        receiptIds: [pack.satellite.receipt.id, `${RECEIPT_PREFIX}.policy.unsupported-native-apis-explicit`],
        notes: ['Unsupported means visible to operators, not hidden fallback behavior.'],
      }),
      this.claim({
        kind: 'no-app-code-copy-policy',
        status: pack.policy.noSourceAppCodeCopy ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Native app value is represented as Zavorth-native capabilities, not copied app code.',
        zavorthEquivalent: 'Capability contracts, bridges and owner gates replace direct app-source import.',
        evidence: [
          `noSourceAppCodeCopy=${pack.policy.noSourceAppCodeCopy}`,
          'sourceCodeCopied=false',
        ],
        receiptIds: [`${RECEIPT_PREFIX}.policy.no-app-code-copy`],
        notes: ['S6 certifies behavior-level absorption only.'],
      }),
    ];
  }

  private scenarioClaims(
    scenarios: ZavorthSemanticNativeCompanionDeviceCapabilityScenario[],
  ): ZavorthSemanticNativeCompanionDeviceCapabilityClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: 'permission-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: scenario.id === 'sensitive-device-confirm-blocked-without-trust' ? 'P0' : 'P1',
      expectedBehavior: scenarioBehavior(scenario.id),
      zavorthEquivalent: scenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: scenario.receiptIds,
      notes: ['Scenario proves guarded native/device behavior without live external I/O.'],
    }));
  }

  private unsafeNativeClaims(pack: ZavorthNativeCompanionDeviceSnapshot): ZavorthSemanticNativeCompanionDeviceCapabilityClaim[] {
    return [
      this.claim({
        kind: 'unsafe-native-policy',
        status: pack.summary.enabledByDefault === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject default-on native device access.',
        zavorthEquivalent: 'Native companion/device bridges are never enabled by default.',
        evidence: [`enabledByDefault=${pack.summary.enabledByDefault}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.default-native-access`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-native-policy',
        status: pack.summary.liveExternalIoPerformed === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject live external device I/O during certification.',
        zavorthEquivalent: 'Certification emits local receipts only; live paths require separate operator command.',
        evidence: [`liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.live-device-io-during-certification`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-native-policy',
        status: pack.summary.secretValuesSerialized === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw secret serialization in native companion/device receipts.',
        zavorthEquivalent: 'Receipts store metadata and command refs only.',
        evidence: [`secretValuesSerialized=${pack.summary.secretValuesSerialized}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.raw-secret-values`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'unsafe-native-policy',
        status: pack.summary.nativeWrappersOwnerGated ? 'rejected' : 'gap',
        priority: 'P1',
        expectedBehavior: 'The architecture must reject native wrapper activation without owner decision.',
        zavorthEquivalent: 'Android, iOS and macOS wrappers remain owner-gated.',
        evidence: [`nativeWrappersOwnerGated=${pack.summary.nativeWrappersOwnerGated}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.wrapper-without-owner-decision`],
        notes: ['Rejected here means intentionally blocked until owner approval.'],
      }),
    ];
  }

  private buildScenarios(
    pack: ZavorthNativeCompanionDeviceSnapshot,
  ): ZavorthSemanticNativeCompanionDeviceCapabilityScenario[] {
    const preview = this.packService.buildMlxTtsPreviewReceipt({
      text: 'hello',
    });
    return [
      {
        id: 'pwa-pairing-offline-queue',
        status: pack.satellite.pairingClaimed
          && pack.satellite.heartbeatAccepted
          && pack.satellite.offlineQueueDelivered
            ? 'passed'
            : 'failed',
        evidence: [
          `pairingClaimed=${pack.satellite.pairingClaimed}`,
          `heartbeatAccepted=${pack.satellite.heartbeatAccepted}`,
          `offlineQueueDelivered=${pack.satellite.offlineQueueDelivered}`,
          `queuedInvocationIds=${pack.satellite.queuedInvocationIds.length}`,
          `claimedAssignmentIds=${pack.satellite.claimedAssignmentIds.length}`,
        ],
        receiptIds: [pack.satellite.receipt.id],
        liveExternalIoPerformed: false,
        processSpawned: false,
        secretValuesSerialized: false,
      },
      {
        id: 'sensitive-device-confirm-blocked-without-trust',
        status: pack.satellite.sensitiveApprovalBlocked ? 'passed' : 'failed',
        evidence: [
          `sensitiveApprovalBlocked=${pack.satellite.sensitiveApprovalBlocked}`,
          `deviceConfirmCompleted=${pack.satellite.completedCapabilityIds.includes('device.confirm')}`,
        ],
        receiptIds: [pack.satellite.receipt.id],
        liveExternalIoPerformed: false,
        processSpawned: false,
        secretValuesSerialized: false,
      },
      {
        id: 'desktop-screen-clipboard-report-only',
        status: pack.desktop.gatedCapabilities.includes('desktop.screen')
          && pack.desktop.gatedCapabilities.includes('desktop.clipboard')
          && pack.desktop.liveExternalIoPerformed === false
            ? 'passed'
            : 'failed',
        evidence: [
          `gatedCapabilities=${pack.desktop.gatedCapabilities.join(',')}`,
          `liveExternalIoPerformed=${pack.desktop.liveExternalIoPerformed}`,
        ],
        receiptIds: pack.desktop.receipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        processSpawned: false,
        secretValuesSerialized: false,
      },
      {
        id: 'optional-local-tts-blocked-without-approval',
        status: preview.status === 'blocked'
          && preview.processSpawned === false
          && preview.enabledByDefault === false
            ? 'passed'
            : 'failed',
        evidence: [
          `previewStatus=${preview.status}`,
          `approvalRequired=${preview.approvalRequired}`,
          `processSpawned=${preview.processSpawned}`,
          `enabledByDefault=${preview.enabledByDefault}`,
          `commandRef=${preview.commandRef || 'none'}`,
        ],
        receiptIds: [preview.id],
        liveExternalIoPerformed: false,
        processSpawned: false,
        secretValuesSerialized: false,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticNativeCompanionDeviceCapabilityClaim {
    const id = `${input.kind}:${slug([
      input.target,
      input.capabilityId,
      input.permissionMode,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.target ? { target: input.target } : {}),
      ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
      ...(input.capabilityStatus ? { capabilityStatus: input.capabilityStatus } : {}),
      ...(input.permissionMode ? { permissionMode: input.permissionMode } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

import {
  allReceipts,
  receiptsForCapability,
  uniqueCapabilities,
  requiredTarget,
  targetStatus,
  semanticCapabilityStatus,
  combinedCapabilityStatus,
  strongestPermission,
  capabilityStatusCounts,
  targetPriority,
  capabilityPriority,
  targetEquivalent,
  capabilityBehavior,
  scenarioBehavior,
  scenarioEquivalent,
  countStatus,
  countPriority,
  slug,
} from './ZavorthSemanticNativeCompanionDeviceCapabilityCertificationHelpers.js';
