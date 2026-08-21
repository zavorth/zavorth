import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { IntegrationHubService } from '../../../../services/IntegrationHubService.js';

type SharedSurfaceIntegrationHubCommandPackDeps = {
  integrationHubService: Pick<
    IntegrationHubService,
    'renderCatalogReport' | 'renderManifestReport' | 'renderConnectReport'
  >;
};

export class SharedSurfaceIntegrationHubCommandPack {
  constructor(private readonly deps: SharedSurfaceIntegrationHubCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/integrations':
        await this.handleIntegrations(ctx, args);
        return true;
      case '/connect':
        await this.handleConnect(ctx, args);
        return true;
      default:
        return false;
    }
  }

  private async handleIntegrations(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    await ctx.reply(
      normalizedArgs
        ? this.deps.integrationHubService.renderManifestReport(normalizedArgs)
        : this.deps.integrationHubService.renderCatalogReport(),
    );
  }

  private async handleConnect(ctx: IMessageContext, args: string): Promise<void> {
    const rawArgs = String(args || '').trim();
    if (!rawArgs) {
      await ctx.reply('Use /connect <integration>. Examples: /connect discord, /connect slack, /connect whatsapp, /connect openrouter.');
      return;
    }

    const tokens = rawArgs.split(/\s+/).filter(Boolean);
    const requestedId = tokens[0] || '';
    const explicitMode =
      tokens.slice(1).find((entry) => ['api', 'cli', 'docker', 'browser', 'mcp'].includes(entry.toLowerCase())) || null;

    await ctx.reply(
      this.deps.integrationHubService.renderConnectReport({
        requestedId,
        requestedBy: String(ctx.userId || 'unknown').trim() || 'unknown',
        selectedMode: explicitMode,
        persist: true,
      }),
    );
  }
}
