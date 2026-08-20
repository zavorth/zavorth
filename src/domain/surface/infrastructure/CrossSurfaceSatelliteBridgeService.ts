import * as crypto from 'node:crypto';
import type {
  CompanionClientMessage,
  CompanionServerEvent,
  CompanionPermissionRequestEvent,
  CompanionStatusUpdateEvent,
} from '../../../contracts/SatelliteCompanionContract.js';

export interface ConnectedCompanionDevice {
  readonly connectionId: string;
  readonly deviceName: string;
  readonly authenticated: boolean;
  readonly connectedAt: number;
  readonly sendFn: (event: CompanionServerEvent) => void;
}

export interface PendingRemoteApproval {
  readonly requestId: string;
  readonly toolName: string;
  readonly resolve: (decision: 'allow' | 'deny' | 'always_allow') => void;
  readonly timer: NodeJS.Timeout;
}

export class CrossSurfaceSatelliteBridgeService {
  private activePairingToken: string;
  private readonly connectedDevices = new Map<string, ConnectedCompanionDevice>();
  private readonly pendingApprovals = new Map<string, PendingRemoteApproval>();
  private steeringHandler?: (text: string, priority: 'normal' | 'interrupt') => void;

  constructor(initialPairingToken?: string) {
    this.activePairingToken = initialPairingToken || crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  public getPairingToken(): string {
    return this.activePairingToken;
  }

  public regeneratePairingToken(): string {
    this.activePairingToken = crypto.randomBytes(3).toString('hex').toUpperCase();
    return this.activePairingToken;
  }

  public registerDevice(
    connectionId: string,
    sendFn: (event: CompanionServerEvent) => void
  ): void {
    this.connectedDevices.set(connectionId, {
      connectionId,
      deviceName: 'Unidentified Device',
      authenticated: false,
      connectedAt: Date.now(),
      sendFn,
    });
  }

  public unregisterDevice(connectionId: string): void {
    this.connectedDevices.delete(connectionId);
  }

  public getConnectedDevicesCount(): number {
    let count = 0;
    for (const dev of this.connectedDevices.values()) {
      if (dev.authenticated) count++;
    }
    return count;
  }

  public onSteeringPrompt(handler: (text: string, priority: 'normal' | 'interrupt') => void): void {
    this.steeringHandler = handler;
  }

  public handleClientMessage(
    connectionId: string,
    message: CompanionClientMessage
  ): CompanionServerEvent | null {
    const device = this.connectedDevices.get(connectionId);
    if (!device) return null;

    if (message.type === 'auth') {
      if (message.pairingToken.toUpperCase() === this.activePairingToken) {
        this.connectedDevices.set(connectionId, {
          ...device,
          deviceName: message.deviceName || 'Remote Companion',
          authenticated: true,
        });

        const authEvent: CompanionServerEvent = {
          type: 'auth_success',
          sessionId: 'default',
          agentName: 'Zavorth Native Agent',
          connectedClientsCount: this.getConnectedDevicesCount(),
        };
        device.sendFn(authEvent);
        return authEvent;
      }

      const failEvent: CompanionServerEvent = {
        type: 'auth_failed',
        reason: 'Invalid pairing token.',
      };
      device.sendFn(failEvent);
      return failEvent;
    }

    if (!device.authenticated) {
      const failEvent: CompanionServerEvent = {
        type: 'auth_failed',
        reason: 'Unauthorized. Authenticate first.',
      };
      device.sendFn(failEvent);
      return failEvent;
    }

    if (message.type === 'ping') {
      const pongEvent: CompanionServerEvent = {
        type: 'pong',
        timestamp: Date.now(),
      };
      device.sendFn(pongEvent);
      return pongEvent;
    }

    if (message.type === 'permission_response') {
      const pending = this.pendingApprovals.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingApprovals.delete(message.requestId);
        pending.resolve(message.decision);
      }
      return null;
    }

    if (message.type === 'steering_prompt') {
      if (this.steeringHandler) {
        this.steeringHandler(message.text, message.priority || 'normal');
      }
      return null;
    }

    return null;
  }

  public broadcastEvent(event: CompanionServerEvent): void {
    for (const dev of this.connectedDevices.values()) {
      if (dev.authenticated) {
        try {
          dev.sendFn(event);
        } catch {
          // Ignore connection write failure
        }
      }
    }
  }

  public async requestRemotePermission(
    toolName: string,
    params: Record<string, unknown>,
    riskLevel: 'safe' | 'review' | 'critical' = 'review',
    timeoutMs = 60000
  ): Promise<'allow' | 'deny' | 'always_allow'> {
    if (this.getConnectedDevicesCount() === 0) {
      return 'deny';
    }

    const requestId = `req_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const expiresAt = Date.now() + timeoutMs;

    const requestEvent: CompanionPermissionRequestEvent = {
      type: 'permission_request',
      requestId,
      toolName,
      params,
      riskLevel,
      expiresAt,
    };

    return new Promise<'allow' | 'deny' | 'always_allow'>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        resolve('deny');
      }, timeoutMs);

      this.pendingApprovals.set(requestId, {
        requestId,
        toolName,
        resolve,
        timer,
      });

      this.broadcastEvent(requestEvent);
    });
  }

  public broadcastStatus(status: CompanionStatusUpdateEvent['status'], activeModel?: string): void {
    this.broadcastEvent({
      type: 'status_update',
      status,
      activeModel,
    });
  }
}
