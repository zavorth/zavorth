import {
  ZAVORTH_CHANNEL_LIVE_CERTIFICATION_VERSION,
  type ZavorthChannelLiveCertificationInput,
  type ZavorthChannelLiveCertificationSnapshot,
  type ZavorthChannelProofResults,
  type ZavorthLiveProof,
} from '../contracts/ZavorthNativeAutonomySpineContract.js';
import type { ChannelMeshSnapshot, ChannelMeshSnapshotEntry } from '../contracts/ChannelMeshContract.js';

type ChannelLiveCertificationDeps = {
  now?: () => Date;
};

const CHANNEL_PROOFS: Array<{ id: keyof ZavorthChannelProofResults; label: string; blockReason: string }> = [
  { id: 'handshake', label: 'Credential or bridge handshake', blockReason: 'handshake proof is required before live routing' },
  { id: 'inboundEcho', label: 'Inbound echo', blockReason: 'inbound message proof is required before live routing' },
  { id: 'outboundEcho', label: 'Outbound echo', blockReason: 'outbound message proof is required before live routing' },
  { id: 'progressSignal', label: 'In-progress signal', blockReason: 'progress signal proof is required before live routing' },
  { id: 'stopCommand', label: 'Stop command', blockReason: 'stop command proof is required before live routing' },
  { id: 'approvalCard', label: 'Approval card', blockReason: 'approval card proof is required before live routing' },
  { id: 'fileSend', label: 'File send', blockReason: 'file send proof is required before live routing' },
  { id: 'receiptRecorded', label: 'Receipt recorded', blockReason: 'receipt proof is required before live routing' },
];

export class ZavorthChannelLiveCertificationService {
  private readonly now: () => Date;

  public constructor(deps: ChannelLiveCertificationDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public certify(input: ZavorthChannelLiveCertificationInput): ZavorthChannelLiveCertificationSnapshot {
    const proofResults = input.proofResults || {};
    const proofs = CHANNEL_PROOFS.map((proof): ZavorthLiveProof => ({
      id: String(proof.id),
      label: proof.label,
      status: proofResults[proof.id] === true ? 'passed' : 'failed',
      required: true,
    }));
    const blockedReasons = input.configured
      ? CHANNEL_PROOFS
          .filter((proof) => proofResults[proof.id] !== true)
          .map((proof) => proof.blockReason)
      : ['channel configuration is required before live proof'];
    const certified = input.configured && blockedReasons.length === 0;

    return {
      version: ZAVORTH_CHANNEL_LIVE_CERTIFICATION_VERSION,
      generatedAt: this.now().toISOString(),
      channelId: input.channelId,
      status: certified ? 'certified' : input.configured ? 'attention' : 'needs-configuration',
      proofs,
      readiness: {
        cataloged: true,
        configured: input.configured,
        liveReady: certified,
        defaultRouteAllowed: certified,
        outboxOnly: !certified,
        proofRefs: proofs.filter((proof) => proof.status === 'passed').map((proof) => `${input.channelId}:${proof.id}`),
      },
      blockedReasons,
      safety: {
        stubsNeverDefaultRoute: true,
        stopRequiredBeforeLiveRoute: true,
        receiptsRequiredForExternalSend: true,
        rawSecretsSerialized: false,
      },
    };
  }

  public certifyFromChannelMesh(input: {
    channelId: string;
    snapshot: Pick<ChannelMeshSnapshot, 'entries' | 'selected'>;
  }): ZavorthChannelLiveCertificationSnapshot {
    const channelId = String(input.channelId || '').trim().toLowerCase();
    const entry = this.findChannelEntry(channelId, input.snapshot);
    if (!entry) {
      return this.certify({
        channelId: channelId || 'unknown',
        configured: false,
        proofResults: {},
      });
    }

    return this.certify({
      channelId: entry.id,
      configured: entry.configured === true,
      proofResults: this.proofsFromChannelEntry(entry),
    });
  }

  private findChannelEntry(
    channelId: string,
    snapshot: Pick<ChannelMeshSnapshot, 'entries' | 'selected'>,
  ): ChannelMeshSnapshotEntry | null {
    if (snapshot.selected && String(snapshot.selected.id || '').toLowerCase() === channelId) {
      return snapshot.selected;
    }
    return (snapshot.entries || []).find((entry) => String(entry.id || '').toLowerCase() === channelId) || null;
  }

  private proofsFromChannelEntry(entry: ChannelMeshSnapshotEntry): ZavorthChannelProofResults {
    const liveProof = entry.readinessProof === 'bridge'
      || entry.readinessProof === 'health'
      || entry.readinessProof === 'live_event';
    const connected = entry.connection?.connected === true || entry.connection?.linked === true || entry.connection?.running === true;
    const inbound = Boolean(entry.connection?.lastInboundAt || entry.lastEventAt);
    const outbound = Boolean(entry.connection?.lastOutboundAt || entry.defaultRouteAllowed);
    const interactive = entry.features.interactiveControls === true
      || entry.features.slashCommands === true
      || entry.interactiveSurface?.slashCommands === true
      || entry.interactiveSurface?.statusCard === true;

    return {
      handshake: entry.configured === true && (liveProof || connected),
      inboundEcho: entry.features.inbound === true && inbound,
      outboundEcho: (entry.features.outbound === true || entry.features.sessionSend === true) && outbound,
      progressSignal: entry.features.richReplies === true || interactive,
      stopCommand: interactive,
      approvalCard: entry.features.approvals === true || entry.interactiveSurface?.inlineButtons === true,
      fileSend: entry.features.attachments === true,
      receiptRecorded: entry.liveReady === true && entry.defaultRouteAllowed === true,
    };
  }
}
