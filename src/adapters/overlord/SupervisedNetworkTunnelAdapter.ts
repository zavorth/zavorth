import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRecord,
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import {
  readStructuredInput,
  stringField,
} from './SupervisedAdapterInput.js';
import {
  ZavorthPublicTunnelService,
  type ZavorthPublicTunnelStatus,
} from '../../services/ZavorthPublicTunnelService.js';

type TunnelAction = 'inspect' | 'start' | 'stop' | 'restart';
type TunnelService = Pick<
  ZavorthPublicTunnelService,
  'readStatus' | 'ensureStarted' | 'stop'
>;

export class SupervisedNetworkTunnelAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'network-tunnel-supervised';
  public readonly label = 'Network Tunnel Supervision Adapter';
  private readonly tunnelService: TunnelService;

  constructor(options: { tunnelService?: TunnelService } = {}) {
    this.tunnelService = options.tunnelService || new ZavorthPublicTunnelService();
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'network.tunnel' && decision.runtimeTarget === 'host';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const input = readStructuredInput(request.command, request.metadata || null);
    const action = this.resolveAction(input);
    const targetUrl = stringField(input, 'targetUrl', 'url');

    if (!action) {
      return {
        ok: false,
        errorCode: 'network_tunnel_action_rejected',
        errorMessage: 'Acao de tunnel invalida. Use inspect, start, stop ou restart.',
      };
    }

    let status: (ZavorthPublicTunnelStatus & { started?: boolean }) | null = null;
    if (action === 'inspect') {
      status = this.tunnelService.readStatus();
    } else if (action === 'start') {
      status = await this.tunnelService.ensureStarted({
        targetUrl: targetUrl || undefined,
      });
    } else if (action === 'restart') {
      await this.tunnelService.stop();
      status = await this.tunnelService.ensureStarted({
        targetUrl: targetUrl || undefined,
      });
    } else if (action === 'stop') {
      status = await this.tunnelService.stop();
    }

    const normalizedStatus = status || this.tunnelService.readStatus();
    return {
      ok: true,
      stdout: JSON.stringify({
        action,
        status: normalizedStatus,
      }, null, 2),
      rollbackAvailable: action === 'start' || action === 'restart',
      metadata: {
        adapterId: this.id,
        action,
        runtimeTarget: decision.runtimeTarget,
        enabled: normalizedStatus.enabled,
        running: normalizedStatus.running,
        ready: normalizedStatus.ready,
        started: 'started' in normalizedStatus ? normalizedStatus.started === true : false,
        publicUrl: normalizedStatus.publicUrl,
        targetUrl: normalizedStatus.targetUrl,
        message: normalizedStatus.message,
      },
    };
  }

  private resolveAction(input: Record<string, unknown>): TunnelAction | null {
    const direct = stringField(input, 'action', 'tunnelAction').toLowerCase();
    if (direct === 'inspect' || direct === 'start' || direct === 'stop' || direct === 'restart') {
      return direct;
    }
    const rawCommand = stringField(input, 'rawCommand').toLowerCase();
    if (rawCommand === 'inspect' || rawCommand === 'start' || rawCommand === 'stop' || rawCommand === 'restart') {
      return rawCommand;
    }
    return direct ? null : 'inspect';
  }

  public async rollback(
    action: SystemOverlordActionRecord,
    reason?: string | null,
  ): Promise<SystemOverlordAdapterResult> {
    const actionType = String(action?.metadata?.action || '').trim().toLowerCase();
    if (actionType !== 'start' && actionType !== 'restart') {
      return {
        ok: false,
        errorCode: 'network_tunnel_rollback_unavailable',
        errorMessage: 'Rollback supervisionado do tunnel so esta disponivel para acoes start/restart.',
      };
    }
    const status = await this.tunnelService.stop();
    return {
      ok: true,
      stdout: JSON.stringify({
        action: 'rollback-stop',
        status,
      }, null, 2),
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        action: 'rollback-stop',
        reason: String(reason || '').trim() || null,
        running: status.running,
        ready: status.ready,
        publicUrl: status.publicUrl,
        targetUrl: status.targetUrl,
        message: status.message,
      },
    };
  }
}
