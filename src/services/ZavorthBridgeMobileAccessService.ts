import { config } from '../config/index.js';
import {
  ZavorthBridgeRemoteNativeService,
  type ZavorthBridgeRemoteNativeStatus,
} from './ZavorthBridgeRemoteNativeService.js';
import {
  ZavorthBridgeRemoteDoctorService,
  type ZavorthBridgeRemoteDoctorReport,
} from './ZavorthBridgeRemoteDoctorService.js';
import { RemoteModeManager } from './RemoteModeManager.js';
import {
  ZavorthBridgeTunnelBrokerService,
  type ZavorthBridgeTunnelBrokerResolution,
} from './ZavorthBridgeTunnelBrokerService.js';
import { ZavorthBridgePublicTunnelService } from './ZavorthBridgePublicTunnelService.js';
import {
  ZavorthBridgeMobileGuideService,
  type ZavorthBridgeMobileGuide,
} from './ZavorthBridgeMobileGuideService.js';


import { TerminalSidecarService } from './TerminalSidecarService.js';
import {
  ZavorthBridgeAccessLeaseService,
  type ZavorthBridgeAccessLeaseSnapshot,
} from './ZavorthBridgeAccessLeaseService.js';


import {
  ZavorthBridgeMobileAccessVerificationService,
  type ZavorthBridgeMobileAccessVerification,
} from './ZavorthBridgeMobileAccessVerificationService.js';

type NativeLike = Pick<ZavorthBridgeRemoteNativeService, 'getStatus'>;
type DoctorLike = Pick<ZavorthBridgeRemoteDoctorService, 'run'>;
type RemoteModeLike = Pick<RemoteModeManager, 'restore'>;
type SidecarLike = Pick<TerminalSidecarService, 'stop'>;
type PublicTunnelLike = Pick<ZavorthBridgePublicTunnelService, 'ensureStarted' | 'stop'>;
type VerificationLike = Pick<ZavorthBridgeMobileAccessVerificationService, 'verify'>;

type ZavorthBridgeMobileAccessOptions = {
  nativeService?: NativeLike;
  doctorService?: DoctorLike;
  remoteModeManager?: RemoteModeLike;
  sidecarService?: SidecarLike;
  publicTunnelService?: PublicTunnelLike;
  verificationService?: VerificationLike;
  leaseService?: ZavorthBridgeAccessLeaseService;
  tunnelBroker?: ZavorthBridgeTunnelBrokerService;
  guideService?: ZavorthBridgeMobileGuideService;
};

export type ZavorthBridgeMobileAccessResult = {
  generatedAt: string;
  action: 'start' | 'status' | 'stop' | 'guide';
  ok: boolean;
  state: 'active' | 'ready' | 'blocked' | 'stopped' | 'missing';
  readyForRemoteUse: boolean;
  mode: 'public' | 'lan' | 'none';
  accessUrl: string | null;
  publicUrl: string | null;
  localUrl: string | null;
  requiresPassword: boolean;
  secret: string | null;
  lease: ZavorthBridgeAccessLeaseSnapshot;
  verification: ZavorthBridgeMobileAccessVerification | null;
  summary: string;
  recommendations: string[];
  guide: ZavorthBridgeMobileGuide;
  doctorSummary: string | null;
  nativeStatus: ZavorthBridgeRemoteNativeStatus;
};

export class ZavorthBridgeMobileAccessService {
  private readonly nativeService: NativeLike;
  private readonly doctorService: DoctorLike;
  private readonly remoteModeManager: RemoteModeLike;
  private readonly sidecarService: SidecarLike;
  private readonly publicTunnelService: PublicTunnelLike;
  private readonly verificationService: VerificationLike;
  private readonly leaseService: ZavorthBridgeAccessLeaseService;
  private readonly tunnelBroker: ZavorthBridgeTunnelBrokerService;
  private readonly guideService: ZavorthBridgeMobileGuideService;

  constructor(options: ZavorthBridgeMobileAccessOptions = {}) {
    this.nativeService = options.nativeService || new ZavorthBridgeRemoteNativeService();
    this.doctorService = options.doctorService || new ZavorthBridgeRemoteDoctorService();
    this.remoteModeManager = options.remoteModeManager || new RemoteModeManager();
    this.sidecarService = options.sidecarService || new TerminalSidecarService();
    this.publicTunnelService = options.publicTunnelService || new ZavorthBridgePublicTunnelService();
    this.verificationService = options.verificationService || new ZavorthBridgeMobileAccessVerificationService();
    this.leaseService = options.leaseService || new ZavorthBridgeAccessLeaseService();
    this.tunnelBroker = options.tunnelBroker || new ZavorthBridgeTunnelBrokerService();
    this.guideService = options.guideService || new ZavorthBridgeMobileGuideService();
  }

  public async start(input: {
    requestedBy?: string | null;
    forceRepair?: boolean;
  } = {}): Promise<ZavorthBridgeMobileAccessResult> {
    const report = await this.doctorService.run(true, input.forceRepair === true);
    const nativeStatus = report.finalStatus;
    const publicTunnel = nativeStatus.access.readyForRemoteUse
      ? await this.publicTunnelService.ensureStarted({
        targetUrl: nativeStatus.access.baseUrl,
      }).catch(() => null)
      : null;
    const tunnel = this.tunnelBroker.resolve(nativeStatus);
    if (!nativeStatus.access.readyForRemoteUse || !tunnel.accessUrl) {
      const lease = this.leaseService.readSnapshot();
      return this.buildBlockedResult('start', nativeStatus, tunnel, lease, report);
    }

    const lease = this.leaseService.issue({
      requestedBy: input.requestedBy,
      mode: tunnel.mode === 'public' ? 'public' : 'lan',
      accessUrl: tunnel.accessUrl,
      localUrl: tunnel.localUrl,
      publicUrl: tunnel.publicUrl,
      baseUrl: nativeStatus.access.baseUrl,
      requiresPassword: nativeStatus.access.protectedByPassword,
      startedSidecar: !report.initialStatus.sidecar?.ready && !!report.finalStatus.sidecar?.ready,
      activatedRemoteMode: report.initialStatus.remoteMode.active === false && report.finalStatus.remoteMode.active === true,
      startedPublicTunnel: publicTunnel?.started === true,
      note: report.summary,
    });

    return this.buildReadyResult('start', nativeStatus, tunnel, lease, report);
  }

  public async status(): Promise<ZavorthBridgeMobileAccessResult> {
    const nativeStatus = await this.nativeService.getStatus();
    const tunnel = this.tunnelBroker.resolve(nativeStatus);
    const lease = this.leaseService.readSnapshot();
    if (lease.active) {
      return this.buildReadyResult('status', nativeStatus, tunnel, lease, null);
    }
    if (nativeStatus.access.readyForRemoteUse && tunnel.accessUrl) {
      return this.buildReadyResult('status', nativeStatus, tunnel, lease, null, 'ready');
    }
    return this.buildBlockedResult('status', nativeStatus, tunnel, lease, null);
  }

  public async guide(): Promise<ZavorthBridgeMobileAccessResult> {
    const status = await this.status();
    return {
      ...status,
      action: 'guide',
    };
  }

  public async stop(input: {
    requestedBy?: string | null;
  } = {}): Promise<ZavorthBridgeMobileAccessResult> {
    const currentLease = this.leaseService.readSnapshot();
    if (currentLease.active) {
      if (currentLease.startedPublicTunnel) {
        await this.publicTunnelService.stop().catch(() => undefined);
      }
      if (currentLease.startedSidecar) {
        await this.sidecarService.stop().catch(() => undefined);
      }
      if (currentLease.activatedRemoteMode) {
        await this.remoteModeManager.restore().catch(() => undefined);
      }
      this.leaseService.revoke({
        requestedBy: input.requestedBy,
        reason: 'Mobile access closed by the operator.',
      });
    }

    const nativeStatus = await this.nativeService.getStatus();
    const tunnel = this.tunnelBroker.resolve(nativeStatus);
    const lease = this.leaseService.readSnapshot();
    const guide = this.guideService.buildBlockedGuide({
      recommendations: currentLease.active
        ? ['Mobile access was closed. Run /agmobile start when you want to reopen it.']
        : ['There was no active ZavorthBridge mobile access lease to close.'],
      limitations: tunnel.limitations,
    });

    return {
      generatedAt: new Date().toISOString(),
      action: 'stop',
      ok: true,
      state: 'stopped',
      readyForRemoteUse: nativeStatus.access.readyForRemoteUse,
      mode: tunnel.mode,
      accessUrl: tunnel.accessUrl,
      publicUrl: tunnel.publicUrl,
      localUrl: tunnel.localUrl,
      requiresPassword: nativeStatus.access.protectedByPassword,
      secret: null,
      lease,
      verification: null,
      summary: currentLease.active
        ? 'ZavorthBridge mobile access closed.'
        : 'No active ZavorthBridge mobile access was found.',
      recommendations: nativeStatus.access.recommendations,
      guide,
      doctorSummary: null,
      nativeStatus,
    };
  }

  private async buildReadyResult(
    action: ZavorthBridgeMobileAccessResult['action'],
    nativeStatus: ZavorthBridgeRemoteNativeStatus,
    tunnel: ZavorthBridgeTunnelBrokerResolution,
    lease: ZavorthBridgeAccessLeaseSnapshot,
    report: ZavorthBridgeRemoteDoctorReport | null,
    forcedState: ZavorthBridgeMobileAccessResult['state'] = 'active',
  ): Promise<ZavorthBridgeMobileAccessResult> {
    const secret = this.resolveSecret(nativeStatus.access.protectedByPassword);
    const verification =
      action === 'start' && (tunnel.accessUrl || lease.accessUrl)
        ? await this.verificationService.verify({
          accessUrl: tunnel.accessUrl || lease.accessUrl,
          mode: tunnel.mode,
        }).catch(() => null)
        : null;
    const guide = this.guideService.buildReadyGuide({
      accessUrl: tunnel.accessUrl || lease.accessUrl || nativeStatus.access.baseUrl,
      mode: tunnel.mode === 'none' ? 'lan' : tunnel.mode,
      expiresAt: lease.expiresAt,
      requiresPassword: nativeStatus.access.protectedByPassword,
      secret,
      limitations: tunnel.limitations,
    });
    return {
      generatedAt: new Date().toISOString(),
      action,
      ok: true,
      state: forcedState,
      readyForRemoteUse: nativeStatus.access.readyForRemoteUse,
      mode: tunnel.mode,
      accessUrl: tunnel.accessUrl || lease.accessUrl,
      publicUrl: tunnel.publicUrl,
      localUrl: tunnel.localUrl,
      requiresPassword: nativeStatus.access.protectedByPassword,
      secret,
      lease,
      verification,
      summary: lease.active
        ? `ZavorthBridge mobile access active via ${tunnel.mode === 'public' ? 'public URL' : 'LAN'}.`
        : `ZavorthBridge remote ready for mobile via ${tunnel.mode === 'public' ? 'public URL' : 'LAN'}.`,
      recommendations: nativeStatus.access.recommendations,
      guide,
      doctorSummary: report?.summary || null,
      nativeStatus,
    };
  }

  private buildBlockedResult(
    action: ZavorthBridgeMobileAccessResult['action'],
    nativeStatus: ZavorthBridgeRemoteNativeStatus,
    tunnel: ZavorthBridgeTunnelBrokerResolution,
    lease: ZavorthBridgeAccessLeaseSnapshot,
    report: ZavorthBridgeRemoteDoctorReport | null,
  ): ZavorthBridgeMobileAccessResult {
    const guide = this.guideService.buildBlockedGuide({
      recommendations: nativeStatus.access.recommendations,
      limitations: tunnel.limitations,
      manualSteps: report?.playbook.manualSteps || [],
    });
    return {
      generatedAt: new Date().toISOString(),
      action,
      ok: false,
      state: lease.status === 'expired' ? 'missing' : 'blocked',
      readyForRemoteUse: nativeStatus.access.readyForRemoteUse,
      mode: tunnel.mode,
      accessUrl: tunnel.accessUrl,
      publicUrl: tunnel.publicUrl,
      localUrl: tunnel.localUrl,
      requiresPassword: nativeStatus.access.protectedByPassword,
      secret: null,
      lease,
      verification: null,
      summary: report?.summary || tunnel.summary || 'ZavorthBridge remote is not ready for mobile yet.',
      recommendations: nativeStatus.access.recommendations,
      guide,
      doctorSummary: report?.summary || null,
      nativeStatus,
    };
  }

  private resolveSecret(required: boolean): string | null {
    if (!required) {
      return null;
    }
    const secret = String(config.ZavorthTerminalAppPassword || '').trim();
    return secret || null;
  }
}
