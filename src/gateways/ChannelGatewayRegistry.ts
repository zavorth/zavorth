import type { WebhookGateway } from './WebhookGateway.js';

export class ChannelGatewayRegistry {
  private readonly gateways = new Map<string, WebhookGateway>();

  registerGateway(gateway: WebhookGateway): void {
    this.gateways.set(this.normalizeId(gateway.id), gateway);
  }

  resolveGateway(channelId: string): WebhookGateway | null {
    const normalized = this.normalizeId(channelId);
    return this.gateways.get(normalized)
      || this.gateways.get(this.resolveAlias(normalized))
      || null;
  }

  listGateways(): WebhookGateway[] {
    return Array.from(this.gateways.values());
  }

  hasGateway(channelId: string): boolean {
    const normalized = this.normalizeId(channelId);
    return this.gateways.has(normalized) || this.gateways.has(this.resolveAlias(normalized));
  }

  get size(): number {
    return this.gateways.size;
  }

  private normalizeId(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private resolveAlias(value: string): string {
    const aliases: Record<string, string> = {
      lark: 'feishu',
      gchat: 'google-chat',
      googlechat: 'google-chat',
      'microsoft-teams': 'teams',
      msteams: 'teams',
      wechat: 'weixin',
      nc: 'nextcloud-talk',
      'nc-talk': 'nextcloud-talk',
      qqbot: 'qq',
      zlu: 'zalo',
      yb: 'yuanbao',
      'tencent-yuanbao': 'yuanbao',
      qywx: 'wecom',
      wework: 'wecom',
    };
    return aliases[value] || value;
  }
}
