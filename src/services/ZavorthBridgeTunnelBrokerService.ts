import { config } from '../config/index.js';
import type { ZavorthBridgeRemoteNativeStatus } from './ZavorthBridgeRemoteNativeService.js';
import { logger } from '../logger.js';
import {
ZavorthBridgePublicTunnelService,
  type ZavorthBridgePublicTunnelStatus,
} from './ZavorthBridgePublicTunnelService.js';

export type ZavorthBridgeTunnelBrokerResolution = {
  mode: 'public' | 'lan' | 'none';
  accessUrl: string | null;
  publicUrl: string | null;
  localUrl: string | null;
  requiresSameNetwork: boolean;
  limitations: string[];
  summary: string;
};

type ZavorthBridgeTunnelBrokerOptions = {
  publicUrl?: string;
  publicTunnelService?: Pick<ZavorthBridgePublicTunnelService, 'readStatus'>;
};

export class ZavorthBridgeTunnelBrokerService {
  private readonly publicUrl: string;
  private readonly publicTunnelService: Pick<ZavorthBridgePublicTunnelService, 'readStatus'> | null;

  constructor(options: ZavorthBridgeTunnelBrokerOptions = {}) {
    this.publicUrl = String(options.publicUrl ?? config.ZavorthTerminalPublicUrl ?? '').trim();
    this.publicTunnelService = options.publicTunnelService || new ZavorthBridgePublicTunnelService();
  }

  public resolve(status: ZavorthBridgeRemoteNativeStatus): ZavorthBridgeTunnelBrokerResolution {
    const publicUrl = this.publicUrl || null;
    const localUrl = String(status.access.localUrl || '').trim() || null;
    const tunnelStatus = this.readPublicTunnelStatus();
    if (publicUrl) {
      return {
        mode: 'public',
        accessUrl: publicUrl,
        publicUrl,
        localUrl,
        requiresSameNetwork: false,
        limitations: [],
        summary: 'Public URL ready for use outside the local network.',
      };
    }

    if (tunnelStatus?.ready && tunnelStatus.publicUrl) {
      return {
        mode: 'public',
        accessUrl: tunnelStatus.publicUrl,
        publicUrl: tunnelStatus.publicUrl,
        localUrl,
        requiresSameNetwork: false,
        limitations: [],
        summary: 'Automatic ZavorthBridge public tunnel ready for use outside the local network.',
      };
    }

    if (localUrl) {
      const limitations = [
        'without URL public configurada; este access so funciona se o celular estiver na mesma rede of the host.',
      ];
      if (tunnelStatus?.running && !tunnelStatus.ready) {
        limitations.unshift('The ZavorthBridge public tunnel is still starting; external access remains unavailable for now.');
      } else if (tunnelStatus?.message && !tunnelStatus.ready && config.zavorthBridgePublicTunnelEnabled) {
        limitations.unshift(tunnelStatus.message);
      }
      return {
        mode: 'lan',
        accessUrl: localUrl,
        publicUrl: null,
        localUrl,
        requiresSameNetwork: true,
        limitations,
        summary: tunnelStatus?.running && !tunnelStatus.ready ? 'Public tunnel is warming up; access is still limited to LAN.'
          : 'No public tunnel configured; access is limited to LAN.',
      };
    }

    return {
      mode: 'none',
      accessUrl: null,
      publicUrl: null,
      localUrl: null,
      requiresSameNetwork: false,
      limitations: [
        'The sidecar has not published an accessible local URL yet.',
        'Configure ZAVORTH_BRIDGE_REMOTE_PUBLIC_URL for access outside the local network.',
        tunnelStatus?.message || '',
      ].filter(Boolean),
      summary: 'No accessible route was published for ZavorthBridge remote.',
    };
  }

  private readPublicTunnelStatus(): ZavorthBridgePublicTunnelStatus | null {
    if (!this.publicTunnelService) {
      return null;
    }
    try {
      return this.publicTunnelService.readStatus();
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Tunnel Broker] filesystem check failed', error); return null; }
  }
}
