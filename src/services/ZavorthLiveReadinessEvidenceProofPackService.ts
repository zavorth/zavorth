import type {
  ChannelMeshSnapshot,
} from '../contracts/ChannelMeshContract.js';
import type { ProviderChannelSmokeProofSnapshot } from '../contracts/ProviderChannelSmokeProofContract.js';
import {
  ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION,
  type ZavorthLiveReadinessEvidenceEntry,
  type ZavorthLiveReadinessEvidenceProofPackSnapshot,
  type ZavorthLiveReadinessEvidenceStatus,
} from '../contracts/ZavorthLiveReadinessEvidenceProofPackContract.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import type { CanonicalPublicApiRuntime } from '../api/public/canonical-public-api/types.js';
import { ProviderChannelSmokeProofService } from './ProviderChannelSmokeProofService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';

type Runtime = {
  now?: () => Date;
  providerMatrix?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  channelMesh?: Pick<CanonicalPublicApiService, 'readChannels'>;
  smokeProof?: Pick<ProviderChannelSmokeProofService, 'buildSnapshot'>;
};

export class ZavorthLiveReadinessEvidenceProofPackService {
  private readonly now: () => Date;
  private readonly providerMatrix: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  private readonly channelMesh: Pick<CanonicalPublicApiService, 'readChannels'>;
  private readonly smokeProof: Pick<ProviderChannelSmokeProofService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.providerMatrix = runtime.providerMatrix || new ZavorthProviderReadinessMatrixService({
      now: this.now,
    });
    this.channelMesh = runtime.channelMesh || new CanonicalPublicApiService(createDefaultPublicRuntime());
    this.smokeProof = runtime.smokeProof || new ProviderChannelSmokeProofService({
      now: this.now,
    });
  }

  public async buildSnapshot(input: {
    providerId?: string | null;
    includeAdvanced?: boolean;
  } = {}): Promise<ZavorthLiveReadinessEvidenceProofPackSnapshot> {
    const generatedAt = this.now().toISOString();
    const [providerMatrix, smokeProof] = await Promise.all([
      this.providerMatrix.buildLiveSnapshot({
        includeAdvanced: input.includeAdvanced !== false,
        providerId: input.providerId || null,
        probe: true,
        live: false,
      }),
      Promise.resolve(this.smokeProof.buildSnapshot()),
    ]);
    const channelMesh = this.channelMesh.readChannels();
    const entries = buildEntries({
      providerMatrix,
      channelMesh,
      smokeProof,
    });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const catalogReadyButNotLive = providerMatrix.summary.catalogReadyButNotLive
      + channelMesh.summary.catalogReadyButNotLive;

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_READINESS_EVIDENCE_PROOF_PACK_CONTRACT_VERSION,
      source: 'ZavorthLiveReadinessEvidenceProofPackService',
      status,
      mode: 'safe-proof-pack',
      providerMatrix,
      channelMesh,
      smokeProof,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        providerTotal: providerMatrix.summary.total,
        providerLiveReady: providerMatrix.summary.liveReady,
        providerDefaultRouteAllowed: providerMatrix.summary.defaultRouteAllowed,
        channelTotal: channelMesh.summary.total,
        channelLiveReady: channelMesh.summary.liveReady,
        channelDefaultRouteAllowed: channelMesh.summary.defaultRouteAllowed,
        catalogReadyButNotLive,
        smokeProofReceipts: smokeProof.summary.receipts,
        rawSecretsSerialized: false,
        providerNetworkUsed: false,
        liveChannelSendPerformed: false,
      },
      policy: {
        catalogSupportIsNotLiveProof: true,
        defaultRoutingRequiresLiveProof: true,
        liveProviderProbeRequiresExplicitOperatorAction: true,
        liveChannelActionRequiresPolicyBroker: true,
        smokeProofDoesNotUseExternalIo: true,
        dashboardCanExecute: false,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:live-readiness-evidence-proof-pack',
        inspectJson: 'npm run zavorth:live-readiness-evidence-proof-pack:json',
        check: 'npm run zavorth:live-readiness-evidence-proof-pack:check --silent',
        providerMatrix: 'npm run zavorth:provider-live-matrix --silent',
        channelMesh: 'npm run channels:mesh --silent',
        smokeProof: 'npm run provider-channel-smoke-proof:check --silent',
        nextStage: 'Intent model0 - Final Daily Runtime Closure and Release Gate',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthLiveReadinessEvidenceProofPackSnapshot): string {
    const lines = [
      'Zavorth Live Readiness Evidence + Channel Provider Proof Pack - Certification matrix',
      '',
      `Status: ${snapshot.status}`,
      `Providers: live=${snapshot.summary.providerLiveReady}/${snapshot.summary.providerTotal}, default=${snapshot.summary.providerDefaultRouteAllowed}`,
      `Channels: live=${snapshot.summary.channelLiveReady}/${snapshot.summary.channelTotal}, default=${snapshot.summary.channelDefaultRouteAllowed}`,
      `Catalog ready but not live: ${snapshot.summary.catalogReadyButNotLive}`,
      `Smoke receipts: ${snapshot.summary.smokeProofReceipts}`,
      '',
      'Evidence matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | live=${entry.liveReady}/${entry.total} | default=${entry.defaultRouteAllowed}`);
      for (const evidence of entry.evidence.slice(0, 3)) lines.push(`  ${evidence}`);
      if (entry.operatorAction) lines.push(`  next: ${entry.operatorAction}`);
    }
    lines.push('', 'Catalog support is never treated as live proof. Provider network probes and channel sends remain explicit operator actions.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }
}

function buildEntries(input: {
  providerMatrix: ZavorthProviderReadinessMatrixSnapshot;
  channelMesh: ChannelMeshSnapshot;
  smokeProof: ProviderChannelSmokeProofSnapshot;
}): ZavorthLiveReadinessEvidenceEntry[] {
  return [
    entry({
      id: 'providers.live-readiness',
      label: 'Provider live readiness evidence',
      kind: 'provider',
      passed: input.providerMatrix.liveCompletion.catalogSupportIsNotLiveProof === true
        && input.providerMatrix.liveCompletion.providerSelectionRequiresLiveProof === true
        && input.providerMatrix.entries.every((item) =>
          item.defaultRouteAllowed === (item.status === 'ready' && item.liveReady)),
      total: input.providerMatrix.summary.total,
      liveReady: input.providerMatrix.summary.liveReady,
      defaultRouteAllowed: input.providerMatrix.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.providerMatrix.summary.catalogReadyButNotLive,
      blocked: input.providerMatrix.summary.blocked,
      evidence: [
        `liveReady=${input.providerMatrix.summary.liveReady}`,
        `catalogReadyButNotLive=${input.providerMatrix.summary.catalogReadyButNotLive}`,
        `defaultRouteAllowed=${input.providerMatrix.summary.defaultRouteAllowed}`,
      ],
      operatorAction: input.providerMatrix.nextAction,
    }),
    entry({
      id: 'channels.live-readiness',
      label: 'Channel live readiness evidence',
      kind: 'channel',
      passed: input.channelMesh.liveCompletion.catalogSupportIsNotLiveProof === true
        && input.channelMesh.liveCompletion.channelSelectionRequiresLiveProof === true
        && input.channelMesh.entries.every((item) =>
          item.defaultRouteAllowed === (item.readiness === 'ready' && item.liveReady)),
      total: input.channelMesh.summary.total,
      liveReady: input.channelMesh.summary.liveReady,
      defaultRouteAllowed: input.channelMesh.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.channelMesh.summary.catalogReadyButNotLive,
      blocked: input.channelMesh.summary.disabled,
      evidence: [
        `liveReady=${input.channelMesh.summary.liveReady}`,
        `catalogReadyButNotLive=${input.channelMesh.summary.catalogReadyButNotLive}`,
        `defaultRouteAllowed=${input.channelMesh.summary.defaultRouteAllowed}`,
      ],
      operatorAction: input.channelMesh.narrative.operatorSummary,
    }),
    entry({
      id: 'provider-channel.smoke-proof',
      label: 'Provider/channel smoke proof has receipts without live IO',
      kind: 'smoke-proof',
      passed: input.smokeProof.policy.noProviderNetworkCalls === true
        && input.smokeProof.policy.noLiveChannelSends === true
        && input.smokeProof.policy.noSecretsSerialized === true
        && input.smokeProof.summary.liveExternalCallRequired === false
        && input.smokeProof.summary.liveChannelSendRequired === false
        && input.smokeProof.summary.secretValuesSerialized === false,
      total: input.smokeProof.summary.providers + input.smokeProof.summary.channels,
      liveReady: input.smokeProof.summary.providerSmokeProofs + input.smokeProof.summary.channelSmokeProofs,
      defaultRouteAllowed: 0,
      catalogReadyButNotLive: 0,
      blocked: input.smokeProof.summary.providerBlocked + input.smokeProof.summary.channelBlocked,
      evidence: [
        `receipts=${input.smokeProof.summary.receipts}`,
        `providerBlocked=${input.smokeProof.summary.providerBlocked}`,
        `channelBlocked=${input.smokeProof.summary.channelBlocked}`,
      ],
      operatorAction: null,
    }),
    entry({
      id: 'default-route.policy',
      label: 'Default route policy requires live proof',
      kind: 'policy',
      passed: input.providerMatrix.liveCompletion.defaultRoutingPolicy === 'ready-and-live-proof'
        && input.channelMesh.liveCompletion.defaultRoutingPolicy === 'ready-and-live-proof',
      total: 2,
      liveReady: 2,
      defaultRouteAllowed: input.providerMatrix.summary.defaultRouteAllowed + input.channelMesh.summary.defaultRouteAllowed,
      catalogReadyButNotLive: input.providerMatrix.summary.catalogReadyButNotLive + input.channelMesh.summary.catalogReadyButNotLive,
      blocked: 0,
      evidence: [
        `providerPolicy=${input.providerMatrix.liveCompletion.defaultRoutingPolicy}`,
        `channelPolicy=${input.channelMesh.liveCompletion.defaultRoutingPolicy}`,
        'dashboardCanExecute=false',
      ],
      operatorAction: 'Run explicit provider tests or channel doctors before making any route default.',
    }),
  ];
}

function entry(input: {
  id: string;
  label: string;
  kind: ZavorthLiveReadinessEvidenceEntry['kind'];
  passed: boolean;
  total: number;
  liveReady: number;
  defaultRouteAllowed: number;
  catalogReadyButNotLive: number;
  blocked: number;
  evidence: string[];
  operatorAction: string | null;
}): ZavorthLiveReadinessEvidenceEntry {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: input.passed ? 'passed' : input.blocked > 0 ? 'blocked' : 'attention',
    total: input.total,
    liveReady: input.liveReady,
    defaultRouteAllowed: input.defaultRouteAllowed,
    catalogReadyButNotLive: input.catalogReadyButNotLive,
    blocked: input.blocked,
    evidence: input.evidence,
    operatorAction: input.operatorAction,
  };
}

function resolveStatus(entries: ZavorthLiveReadinessEvidenceEntry[]): ZavorthLiveReadinessEvidenceStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}

function createDefaultPublicRuntime(): CanonicalPublicApiRuntime {
  const operationsSnapshot = {
    maintenance: {
      startedAt: null,
      finishedAt: null,
    },
    errors: {
      lastError: null,
    },
  };
  return {
    getRuntime: () => ({} as any),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => ({
      readSnapshotFast: () => operationsSnapshot as any,
      readSnapshotLive: () => operationsSnapshot as any,
    }),
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
  };
}
