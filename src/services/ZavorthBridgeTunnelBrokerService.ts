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
        summary: 'URL publica pronta para uso fora da rede local.',
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
        summary: 'Tunel publico automatico do ZavorthBridge pronto para uso fora da rede local.',
      };
    }

    if (localUrl) {
      const limitations = [
        'Sem URL publica configurada; este acesso so funciona se o celular estiver na mesma rede do host.',
      ];
      if (tunnelStatus?.running && !tunnelStatus.ready) {
        limitations.unshift('O tunel publico do ZavorthBridge ainda esta iniciando; por enquanto o acesso externo segue indisponivel.');
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
        summary: tunnelStatus?.running && !tunnelStatus.ready
          ? 'Tunel publico em aquecimento; acesso ainda limitado a LAN.'
          : 'Sem tunel publico configurado; acesso limitado a LAN.',
      };
    }

    return {
      mode: 'none',
      accessUrl: null,
      publicUrl: null,
      localUrl: null,
      requiresSameNetwork: false,
      limitations: [
        'O sidecar ainda nao publicou uma URL local acessivel.',
        'Configure ZAVORTH_BRIDGE_REMOTE_PUBLIC_URL para acesso fora da rede local.',
        tunnelStatus?.message || '',
      ].filter(Boolean),
      summary: 'Nenhuma rota acessivel foi publicada para o remoto do ZavorthBridge.',
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
