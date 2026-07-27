import type {
  FinalAbsorptionCertificationReceipt,
  FinalAbsorptionCertificationSnapshot,
  FinalAbsorptionEvidenceId,
  FinalAbsorptionEvidenceItem,
  FinalAbsorptionEvidenceStatus,
} from '../contracts/FinalAbsorptionCertificationContract.js';
import { ZAVORTH_FINAL_ABSORPTION_CERTIFICATION_CONTRACT_VERSION } from '../contracts/FinalAbsorptionCertificationContract.js';

import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';
import { CodexRuntimePlaneService } from './CodexRuntimePlaneService.js';
import { ModuleSdkExportClosureService } from './ModuleSdkExportClosureService.js';
import { OpenShellRemoteSandboxService } from './OpenShellRemoteSandboxService.js';
import { ReleaseCertificationService } from './ReleaseCertificationService.js';
import { ProviderChannelSmokeProofService } from './ProviderChannelSmokeProofService.js';
import { RuntimeFamilyClosureService } from './RuntimeFamilyClosureService.js';

type FinalAbsorptionCertificationRuntime = {
  now?: () => Date;
  capabilityNormalizationService?: CapabilityNormalizationService;
  codexRuntimePlaneService?: CodexRuntimePlaneService;
  openshellRemoteSandboxService?: OpenShellRemoteSandboxService;
  moduleSdkExportClosureService?: ModuleSdkExportClosureService;
  providerChannelSmokeProofService?: ProviderChannelSmokeProofService;
  runtimeFamilyClosureService?: RuntimeFamilyClosureService;
  releaseCertificationService?: ReleaseCertificationService;
};

type EvidenceInput = {
  id: FinalAbsorptionEvidenceId;
  title: string;
  passed: boolean;
  command: string;
  observed: string;
  required: string;
  evidence: string[];
};

export class FinalAbsorptionCertificationService {
  private readonly now: () => Date;
  private readonly capabilityNormalization: CapabilityNormalizationService;
  private readonly codexRuntime: CodexRuntimePlaneService;
  private readonly openshellSandbox: OpenShellRemoteSandboxService;
  private readonly moduleSdkExport: ModuleSdkExportClosureService;
  private readonly providerChannelSmoke: ProviderChannelSmokeProofService;
  private readonly runtimeFamilyClosure: RuntimeFamilyClosureService;
  private readonly releaseCertification: ReleaseCertificationService;

  constructor(runtime: FinalAbsorptionCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityNormalization = runtime.capabilityNormalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.codexRuntime = runtime.codexRuntimePlaneService || new CodexRuntimePlaneService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.openshellSandbox = runtime.openshellRemoteSandboxService || new OpenShellRemoteSandboxService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.moduleSdkExport = runtime.moduleSdkExportClosureService || new ModuleSdkExportClosureService({
      now: this.now,
    });
    this.providerChannelSmoke = runtime.providerChannelSmokeProofService || new ProviderChannelSmokeProofService({
      now: this.now,
    });
    this.runtimeFamilyClosure = runtime.runtimeFamilyClosureService || new RuntimeFamilyClosureService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.releaseCertification = runtime.releaseCertificationService || new ReleaseCertificationService({
      now: this.now,
      profile: 'public-launch',
    });
  }

  public buildSnapshot(): FinalAbsorptionCertificationSnapshot {
    const generatedAt = this.now().toISOString();
    const capabilityNormalization = this.capabilityNormalization.buildSnapshot();
    const codexRuntime = this.codexRuntime.buildSnapshot();
    const openshellSandbox = this.openshellSandbox.buildSnapshot();
    const moduleSdkExport = this.moduleSdkExport.buildSnapshot();
    const providerChannelSmoke = this.providerChannelSmoke.buildSnapshot();
    const runtimeFamilyClosure = this.runtimeFamilyClosure.buildSnapshot();
    const releaseCertification = this.releaseCertification.buildSnapshot({ profile: 'public-launch' });

    const evidence = [
      this.evidence({
        id: 'worker-1-normalization',
        title: 'Worker 1 normalized the private inventory',
        passed: capabilityNormalization.summary.sourceModules === 125
          && capabilityNormalization.summary.normalized === 125
          && capabilityNormalization.summary.needsReview === 0
          && capabilityNormalization.summary.unmapped === 0,
        command: 'npm run capability-normalization:check --silent',
        observed: `${capabilityNormalization.summary.normalized}/${capabilityNormalization.summary.sourceModules} normalized, ${capabilityNormalization.summary.needsReview} needs-review, ${capabilityNormalization.summary.unmapped} unmapped`,
        required: '125/125 normalized, 0 needs-review, 0 unmapped',
        evidence: [
          `${capabilityNormalization.summary.primitives} primitives available.`,
          `${capabilityNormalization.summary.manifestTemplates} manifest templates generated from normalized source modules.`,
        ],
      }),
      this.evidence({
        id: 'worker-2-codex-runtime',
        title: 'Worker 2 closed the agent runtime plane',
        passed: codexRuntime.status === 'closed'
          && codexRuntime.summary.missing === 0
          && codexRuntime.summary.nativeRuntimeProofs === codexRuntime.summary.features,
        command: codexRuntime.commands.check,
        observed: `${codexRuntime.summary.nativeRuntimeProofs}/${codexRuntime.summary.features} native runtime proofs`,
        required: 'all Codex runtime features native-runtime-proof with 0 missing',
        evidence: [
          `${codexRuntime.summary.appServerRpcMethods} app-server RPC methods represented.`,
          `${codexRuntime.summary.approvalBridgeKinds} approval bridge kinds represented.`,
          `${codexRuntime.receipts.length} receipts available.`,
        ],
      }),
      this.evidence({
        id: 'worker-3-openshell-sandbox',
        title: 'Worker 3 closed the remote sandbox plane',
        passed: openshellSandbox.status === 'closed'
          && openshellSandbox.summary.missing === 0
          && openshellSandbox.summary.nativeRuntimeProofs === openshellSandbox.summary.features,
        command: openshellSandbox.commands.check,
        observed: `${openshellSandbox.summary.nativeRuntimeProofs}/${openshellSandbox.summary.features} native runtime proofs`,
        required: 'all sandbox features native-runtime-proof with 0 missing',
        evidence: [
          `${openshellSandbox.summary.lifecycleActions} lifecycle actions represented.`,
          `${openshellSandbox.summary.readinessChecks} readiness checks represented.`,
          `${openshellSandbox.receipts.length} receipts available.`,
        ],
      }),
      this.evidence({
        id: 'worker-4-module-sdk-export',
        title: 'Worker 4 closed Module SDK and export consistency',
        passed: moduleSdkExport.status === 'closed'
          && moduleSdkExport.summary.exportedSurfaces === moduleSdkExport.summary.publicSubpaths
          && moduleSdkExport.summary.missingSurfaces === 0
          && moduleSdkExport.summary.compatibilityShimProvided === false,
        command: moduleSdkExport.commands.check,
        observed: `${moduleSdkExport.summary.publicSubpaths} Zavorth SDK subpaths, ${moduleSdkExport.summary.missingSurfaces} missing`,
        required: '8 stable Zavorth SDK subpaths, 0 missing, no compatibility shim',
        evidence: [
          `${moduleSdkExport.summary.sourcePackageExportsApprox} package exports replaced by native SDK decision.`,
          `${moduleSdkExport.summary.sourcePluginSdkEntrypointsApprox} plugin SDK entrypoints represented by contract-first surfaces.`,
        ],
      }),
      this.evidence({
        id: 'worker-5-provider-channel-smoke',
        title: 'Worker 5 closed provider and channel smoke proof',
        passed: providerChannelSmoke.status === 'closed'
          && providerChannelSmoke.summary.providerBlocked === 0
          && providerChannelSmoke.summary.channelBlocked === 0,
        command: providerChannelSmoke.commands.check,
        observed: `${providerChannelSmoke.summary.providerSmokeProofs}/${providerChannelSmoke.summary.providers} providers, ${providerChannelSmoke.summary.channelSmokeProofs}/${providerChannelSmoke.summary.channels} channels`,
        required: '47 providers and 23 channels smoke-proven with 0 blocked',
        evidence: [
          `${providerChannelSmoke.summary.receipts} provider/channel receipts available.`,
          'Provider calls and channel sends remain no-live-IO in this certificate.',
        ],
      }),
      this.evidence({
        id: 'worker-6-runtime-family',
        title: 'Worker 6 closed media, voice, web, docs, diagnostics and migration runtime families',
        passed: runtimeFamilyClosure.status === 'closed'
          && runtimeFamilyClosure.summary.blocked === 0
          && runtimeFamilyClosure.summary.runtimeProofs === runtimeFamilyClosure.summary.primitives,
        command: runtimeFamilyClosure.commands.check,
        observed: `${runtimeFamilyClosure.summary.runtimeProofs}/${runtimeFamilyClosure.summary.primitives} primitives, ${runtimeFamilyClosure.summary.modeProofs} mode proofs`,
        required: '11 runtime-family primitives, 37 mode proofs, 0 blocked',
        evidence: [
          `${runtimeFamilyClosure.summary.sourceModules} source-module links covered by runtime family proofs.`,
          `${runtimeFamilyClosure.summary.receipts} runtime-family receipts available.`,
        ],
      }),
      this.evidence({
        id: 'public-launch-certification',
        title: 'Public launch profile is certified by no-live-IO consistency gates',
        passed: releaseCertification.status === 'certified'
          && releaseCertification.summary.sourceP0Gaps === 0
          && releaseCertification.summary.sourceP1Gaps === 0
          && releaseCertification.summary.sourceP2Gaps === 0,
        command: 'npm run release-certify:public-launch --silent',
        observed: `${releaseCertification.status}, P0 ${releaseCertification.summary.sourceP0Gaps}, ${releaseCertification.summary.sourceP1Gaps}, P2 ${releaseCertification.summary.sourceP2Gaps}`,
        required: 'certified, P0 0, 0, P2 0',
        evidence: [
          `${releaseCertification.summary.receipts} consistency certification receipts available.`,
          `${releaseCertification.summary.gates} consistency certification gates evaluated.`,
        ],
      }),
    ];
    const receipts = this.receipts(generatedAt, evidence);
    const failed = evidence.filter((item) => item.status === 'failed').length;

    return {
      generatedAt,
      contractVersion: ZAVORTH_FINAL_ABSORPTION_CERTIFICATION_CONTRACT_VERSION,
      status: failed === 0 ? 'certified' : 'blocked',
      claim: 'tracked-private-inventory-certified',
      statement: {
        privateCertification: 'Zavorth has absorbed the tracked private capability inventory into Zavorth-native contracts, services, policies, artifacts, receipts, and no-live-IO proof gates.',
        trackedInventory: '125 normalized source modules are covered by the Worker 1 through Worker 6 closure chain.',
        liveEndToEndConsistency: 'not-claimed-by-this-certificate',
        publicLaunch: 'certified-by-static-and-no-live-IO-profile',
      },
      summary: {
        evidenceItems: evidence.length,
        passed: evidence.length - failed,
        failed,
        normalizedSourceModules: capabilityNormalization.summary.sourceModules,
        primitives: capabilityNormalization.summary.primitives,
        codexRuntimeFeatures: codexRuntime.summary.features,
        openshellSandboxFeatures: openshellSandbox.summary.features,
        sdkSubpaths: moduleSdkExport.summary.publicSubpaths,
        providerRoutes: providerChannelSmoke.summary.providers,
        channelRoutes: providerChannelSmoke.summary.channels,
        runtimeFamilyPrimitives: runtimeFamilyClosure.summary.primitives,
        runtimeFamilySourceModules: runtimeFamilyClosure.summary.sourceModules,
        runtimeFamilyModeProofs: runtimeFamilyClosure.summary.modeProofs,
        p0Gaps: releaseCertification.summary.sourceP0Gaps,
        p1Gaps: releaseCertification.summary.sourceP1Gaps,
        p2Gaps: releaseCertification.summary.sourceP2Gaps,
        totalReceipts: codexRuntime.receipts.length
          + openshellSandbox.receipts.length
          + providerChannelSmoke.receipts.length
          + runtimeFamilyClosure.receipts.length
          + releaseCertification.receipts.length
          + receipts.length,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        filesystemWriteRequired: false,
        artifactBodyReadRequired: false,
        secretValuesSerialized: false,
      },
      evidence,
      receipts,
      sourceSnapshots: {
        capabilityNormalization: {
          contractVersion: capabilityNormalization.contractVersion,
          summary: capabilityNormalization.summary,
        },
        codexRuntime: {
          contractVersion: codexRuntime.contractVersion,
          status: codexRuntime.status,
          summary: codexRuntime.summary,
        },
        openshellSandbox: {
          contractVersion: openshellSandbox.contractVersion,
          status: openshellSandbox.status,
          summary: openshellSandbox.summary,
        },
        moduleSdkExport: {
          contractVersion: moduleSdkExport.contractVersion,
          status: moduleSdkExport.status,
          summary: moduleSdkExport.summary,
        },
        providerChannelSmoke: {
          contractVersion: providerChannelSmoke.contractVersion,
          status: providerChannelSmoke.status,
          summary: providerChannelSmoke.summary,
        },
        runtimeFamilyClosure: {
          contractVersion: runtimeFamilyClosure.contractVersion,
          status: runtimeFamilyClosure.status,
          summary: runtimeFamilyClosure.summary,
        },
        releaseCertification: {
          contractVersion: releaseCertification.contractVersion,
          profile: releaseCertification.profile,
          status: releaseCertification.status,
          summary: releaseCertification.summary,
        },
      },
      policy: {
        finalCertificateOnly: true,
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noLiveDeviceAccess: true,
        noLiveMemoryWrites: true,
        noFilesystemWrites: true,
        noArtifactBodyReads: true,
        noSecretValuesSerialized: true,
        liveEndToEndConsistencyRequiresSeparateOperatorRun: true,
      },
      commands: {
        certify: 'npm run final-absorption-certify --silent',
        certifyJson: 'npm run final-absorption-certify:json --silent',
        check: 'npm run final-absorption-certification:check --silent',
        focusedTests: [
          'npx jest tests/services/FinalAbsorptionCertificationService.test.ts --runInBand',
          'npm run final-absorption-certification:check --silent',
          'npm run final-absorption-certify --silent',
        ],
        typecheck: 'npm run runtime:check --silent',
        terminalWorker: 'Worker 7 - final certification and documentation',
        nextStep: 'No next worker in this closure chain',
      },
    };
  }

  public formatCertificationText(snapshot: FinalAbsorptionCertificationSnapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Final Absorption Certification',
      `Status: ${snapshot.status}`,
      `Claim: ${snapshot.claim}`,
      `Tracked inventory: ${snapshot.summary.normalizedSourceModules} source modules, ${snapshot.summary.primitives} primitives`,
      `Providers/channels: ${snapshot.summary.providerRoutes}/${snapshot.summary.channelRoutes}`,
      `Runtime families: ${snapshot.summary.runtimeFamilyPrimitives} primitives, ${snapshot.summary.runtimeFamilyModeProofs} mode proofs`,
      `Gaps: P0 ${snapshot.summary.p0Gaps}, ${snapshot.summary.p1Gaps}, P2 ${snapshot.summary.p2Gaps}`,
      `Receipts: ${snapshot.summary.totalReceipts}`,
      `Live E2E consistency: ${snapshot.statement.liveEndToEndConsistency}`,
      '',
      'Evidence:',
      ...snapshot.evidence.map((item) => `- ${item.status.toUpperCase()} ${item.id}: ${item.observed} / ${item.required}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ];
    return lines.join('\n');
  }

  private evidence(input: EvidenceInput): FinalAbsorptionEvidenceItem {
    const status: FinalAbsorptionEvidenceStatus = input.passed ? 'passed' : 'failed';
    return {
      id: input.id,
      title: input.title,
      status,
      command: input.command,
      observed: input.observed,
      required: input.required,
      evidence: input.evidence,
      receiptId: `final-absorption.${input.id}.receipt`,
      noLiveIo: true,
      secretValuesSerialized: false,
    };
  }

  private receipts(
    generatedAt: string,
    evidence: FinalAbsorptionEvidenceItem[],
  ): FinalAbsorptionCertificationReceipt[] {
    return evidence.map((item) => ({
      id: item.receiptId,
      evidenceId: item.id,
      generatedAt,
      status: item.status,
      summary: `${item.title}: observed ${item.observed}; required ${item.required}.`,
      noLiveIo: true,
      secretValuesSerialized: false,
    }));
  }
}
