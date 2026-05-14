import type {
  RemainingRuntimeDecisionEntry,
  RemainingRuntimeDecisionsSnapshot,
  RemainingRuntimeDecisionStatus,
} from '../contracts/RemainingRuntimeDecisionsContract.js';
import { ZAVORTH_REMAINING_RUNTIME_DECISIONS_CONTRACT_VERSION } from '../contracts/RemainingRuntimeDecisionsContract.js';
import { ChannelMeshParityService } from './ChannelMeshParityService.js';
import { MemoryArtifactParityService } from './MemoryArtifactParityService.js';
import { ParityCertificationService } from './ParityCertificationService.js';
import { SatelliteAppParityService } from './SatelliteAppParityService.js';

type RemainingRuntimeDecisionsRuntime = {
  now?: () => Date;
  channelMeshParityService?: ChannelMeshParityService;
  satelliteAppParityService?: SatelliteAppParityService;
  memoryArtifactParityService?: MemoryArtifactParityService;
  parityCertificationService?: ParityCertificationService;
};

export class RemainingRuntimeDecisionsService {
  private readonly now: () => Date;
  private readonly channelMesh: ChannelMeshParityService;
  private readonly satelliteApp: SatelliteAppParityService;
  private readonly memoryArtifact: MemoryArtifactParityService;
  private readonly certification: ParityCertificationService;

  constructor(runtime: RemainingRuntimeDecisionsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.channelMesh = runtime.channelMeshParityService || new ChannelMeshParityService({ now: this.now });
    this.satelliteApp = runtime.satelliteAppParityService || new SatelliteAppParityService({ now: this.now });
    this.memoryArtifact = runtime.memoryArtifactParityService || new MemoryArtifactParityService({ now: this.now });
    this.certification = runtime.parityCertificationService || new ParityCertificationService({ now: this.now });
  }

  public buildSnapshot(): RemainingRuntimeDecisionsSnapshot {
    const channelSnapshot = this.channelMesh.buildSnapshot();
    const satelliteSnapshot = this.satelliteApp.buildSnapshot();
    const memorySnapshot = this.memoryArtifact.buildSnapshot();
    const certificationSnapshot = this.certification.buildSnapshot();
    const remainingMemoryTemplates = memorySnapshot.summary.declaredOnly
      + memorySnapshot.summary.templateReady
      + memorySnapshot.summary.missing;
    const status: RemainingRuntimeDecisionStatus = channelSnapshot.summary.unsupported === 0
      && satelliteSnapshot.summary.decisionRequired === 0
      && remainingMemoryTemplates === 0
      && memorySnapshot.summary.decisionRequired === 0
      && certificationSnapshot.summary.sourceOpenGaps === 0
      ? 'closed'
      : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMAINING_RUNTIME_DECISIONS_CONTRACT_VERSION,
      status,
      summary: {
        closedDecisions: this.entries().length,
        remainingChannelUnsupported: channelSnapshot.summary.unsupported,
        remainingSatelliteDecisions: satelliteSnapshot.summary.decisionRequired,
        remainingMemoryTemplates,
        remainingMemoryDecisions: memorySnapshot.summary.decisionRequired,
        certificationOpenGaps: certificationSnapshot.summary.sourceOpenGaps,
        certificationStatus: certificationSnapshot.status,
        releaseReady: certificationSnapshot.summary.releaseReady,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      },
      entries: this.entries(),
      channelSnapshot: {
        contractVersion: channelSnapshot.contractVersion,
        summary: channelSnapshot.summary,
      },
      satelliteSnapshot: {
        contractVersion: satelliteSnapshot.contractVersion,
        summary: satelliteSnapshot.summary,
        nativeWrapperDecision: satelliteSnapshot.nativeWrapperDecision,
      },
      memorySnapshot: {
        contractVersion: memorySnapshot.contractVersion,
        summary: memorySnapshot.summary,
      },
      certification: {
        contractVersion: certificationSnapshot.contractVersion,
        profile: certificationSnapshot.profile,
        status: certificationSnapshot.status,
        summary: certificationSnapshot.summary,
      },
      commands: {
        check: 'npm run remaining-runtime-decisions:check --silent',
        certify: 'npm run parity-certify --silent',
        nextPhase: 'Release certification profile hardening',
      },
      policy: {
        decisionsAreRuntimeScoped: true,
        noExternalCalls: true,
        noLiveChannelSends: true,
        noLiveDeviceAccess: true,
        noMemoryWrites: true,
        noSecretsSerialized: true,
      },
    };
  }

  private entries(): RemainingRuntimeDecisionEntry[] {
    return [
      {
        id: 'tlon-local-bridge',
        previousGap: 'channel-unsupported-routes',
        surface: 'channel.message',
        decision: 'Support TLON through a governed local bridge route with pairing refs, dry inbound/outbound envelopes, and Plugin OS manifest registration.',
        resultingStatus: 'adapter-backed',
        receipt: 'remaining-runtime-decision.tlon-local-bridge.receipt',
        remainingTier: 'none',
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      },
      {
        id: 'memory-wiki-runtime',
        previousGap: 'memory-wiki-template',
        surface: 'memory.wiki',
        decision: 'Promote wiki memory to MemoryWikiService with upsert/search contracts, receipt ids, and artifact-linked source references.',
        resultingStatus: 'backend-ready',
        receipt: 'remaining-runtime-decision.memory-wiki-runtime.receipt',
        remainingTier: 'none',
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      },
      {
        id: 'satellite-pwa-first',
        previousGap: 'satellite-native-wrapper-decision',
        surface: 'satellite.native-wrapper',
        decision: 'Sign PWA-first as the release path; native wrappers are not required while the installable PWA covers pairing, transport, heartbeat, device APIs, offline queue, and doctor.',
        resultingStatus: 'backend-ready',
        receipt: 'remaining-runtime-decision.satellite-pwa-first.receipt',
        remainingTier: 'none',
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      },
      {
        id: 'memory-vector-store-backend',
        previousGap: 'memory-vector-backend-choice',
        surface: 'memory.vector.backend',
        decision: 'Certify current MemoryVectorStore with SQLite/JSON fallback as the native vector backend; LanceDB-compatible storage is optional future expansion.',
        resultingStatus: 'backend-ready',
        receipt: 'remaining-runtime-decision.memory-vector-store-backend.receipt',
        remainingTier: 'none',
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        secretValuesSerialized: false,
      },
    ];
  }
}
