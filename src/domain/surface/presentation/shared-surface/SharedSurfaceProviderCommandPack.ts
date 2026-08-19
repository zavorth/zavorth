import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { EnhancedProviderFactory } from '../../../../providers/EnhancedProviderFactory.js';
import {
  createSurfaceResponse,
  type SurfaceBlock,
  type SurfaceResponseAction,
} from '../../application/surface-response/index.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';

export class SharedSurfaceProviderCommandPack {
  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    if (commandType !== '/providers') {
      return false;
    }

    const normalized = String(args || '').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const action = String(tokens[0] || 'status')
      .trim()
      .toLowerCase();

    try {
      if (action === 'status') {
        await this.handleProviders(ctx);
        return true;
      }

      if (action === 'info' && tokens[1]) {
        const providerName = String(tokens[1]).trim();
        await this.handleProviderInfo(ctx, providerName);
        return true;
      }

      if (action === 'thinking' && tokens[1] && tokens[2] && tokens[3]) {
        const providerName = String(tokens[1]).trim();
        const model = String(tokens[2]).trim();
        const level = String(tokens[3]).trim();
        await this.handleThinkingConfig(ctx, providerName, model, level);
        return true;
      }

      await ctx.reply('Usage:\n  /providers\n  /providers info <provider>\n  /providers thinking <provider> <model> <level>');
      return true;
    } catch {
      await ctx.reply('Failed to process providers command.');
      return true;
    }
  }

  private async handleProviders(ctx: IMessageContext): Promise<void> {
    const providers = EnhancedProviderFactory.listProviders();
    const rows = providers.map((entry) => ({
      name: entry.name,
      apiMode: entry.apiMode,
      authType: entry.authType,
      thinkingLevels: entry.thinkingLevels.length > 0 ? entry.thinkingLevels.join(', ') : 'none',
      status: entry.capabilities.includes('transport') ? 'configured' : 'not configured',
    }));

    const blocks: SurfaceBlock[] = [
      {
        kind: 'text',
        title: 'Provider registry',
        text: `Total providers: ${providers.length}`,
      },
      {
        kind: 'table',
        table: {
          title: 'Providers',
          columns: [
            { key: 'name', label: 'Name', width: 20 },
            { key: 'apiMode', label: 'API Mode', width: 16 },
            { key: 'authType', label: 'Auth Type', width: 16 },
            { key: 'thinkingLevels', label: 'Thinking Levels', width: 24 },
            { key: 'status', label: 'Status', width: 18 },
          ],
          rows,
        },
      },
    ];

    const actions: SurfaceResponseAction[] = [
      {
        id: 'providers-refresh',
        label: 'Refresh',
        kind: 'command',
        command: '/providers',
        callbackData: '/providers',
        style: 'secondary',
      },
    ];

    const response = createSurfaceResponse({
      id: 'shared-provider-list',
      intent: 'status',
      title: 'Providers',
      summary: `Showing ${providers.length} registered providers.`,
      tone: providers.length > 0 ? 'success' : 'warning',
      blocks,
      actions,
      metadata: { providerCount: providers.length },
    });

    await replyWithSharedSurfaceResponse(ctx, response);
  }

  private async handleProviderInfo(ctx: IMessageContext, providerName: string): Promise<void> {
    const info = EnhancedProviderFactory.getProviderInfo(providerName);

    if (!info) {
      await ctx.reply(`Provider "${providerName}" not found.`);
      return;
    }

    const blocks: SurfaceBlock[] = [
      {
        kind: 'text',
        title: 'Provider details',
        text: [
          `Name: ${info.name}`,
          `API Mode: ${info.apiMode}`,
          `Auth Type: ${info.authType}`,
          `Base URL: ${info.baseUrl || 'default'}`,
          `Default Model: ${info.defaultModel || 'none'}`,
          `API Key: ${info.apiKey ? '***' : 'not set'}`,
        ].join('\n'),
      },
      {
        kind: 'list',
        title: 'Capabilities',
        items: [
          `Transport: ${info.hasTransport ? info.transportName : 'none'}`,
          `Compat: ${info.hasCompat ? info.compatProviderId : 'none'}`,
          `Thinking: ${info.hasThinking ? info.thinkingProviderId : 'none'}`,
          `Catalog: ${info.hasCatalog ? info.catalogProviderId : 'none'}`,
          `Auth: ${info.hasAuth ? info.authTypeResolved : 'none'}`,
        ],
      },
      {
        kind: 'list',
        title: 'Supported thinking levels',
        items: info.supportedThinkingLevels.length > 0
          ? info.supportedThinkingLevels
          : ['none'],
      },
    ];

    if (Object.keys(info.defaultHeaders).length > 0) {
      blocks.push({
        kind: 'list',
        title: 'Default headers',
        items: Object.entries(info.defaultHeaders).map(([k, v]) => `${k}: ${v}`),
      });
    }

    const response = createSurfaceResponse({
      id: `shared-provider-info-${info.name}`,
      intent: 'status',
      title: `Provider: ${info.name}`,
      summary: `${info.apiMode} provider with ${info.authType} auth.`,
      tone: 'info',
      blocks,
      metadata: { providerName: info.name },
    });

    await replyWithSharedSurfaceResponse(ctx, response);
  }

  private async handleThinkingConfig(
    ctx: IMessageContext,
    providerName: string,
    model: string,
    level: string,
  ): Promise<void> {
    const config = EnhancedProviderFactory.getThinkingConfig(providerName, model, level);
    const info = EnhancedProviderFactory.getProviderInfo(providerName);

    if (!info) {
      await ctx.reply(`Provider "${providerName}" not found.`);
      return;
    }

    if (!info.hasThinking) {
      await ctx.reply(`Provider "${providerName}" does not support thinking.`);
      return;
    }

    if (!config) {
      await ctx.reply(
        `Thinking config not available for model "${model}" at level "${level}" on provider "${providerName}".`,
      );
      return;
    }

    const blocks: SurfaceBlock[] = [
      {
        kind: 'text',
        title: 'Thinking configuration',
        text: [
          `Provider: ${providerName}`,
          `Model: ${model}`,
          `Level: ${config.level}`,
          `Enabled: ${config.enabled ? 'yes' : 'no'}`,
          config.budgetTokens ? `Budget tokens: ${config.budgetTokens}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        kind: 'list',
        title: 'Available thinking levels',
        items: info.supportedThinkingLevels.length > 0
          ? info.supportedThinkingLevels
          : ['none'],
      },
    ];

    const response = createSurfaceResponse({
      id: `shared-provider-thinking-${providerName}`,
      intent: 'status',
      title: `Thinking: ${providerName}/${model}`,
      summary: `Level "${config.level}" — ${config.enabled ? 'enabled' : 'disabled'}.`,
      tone: config.enabled ? 'success' : 'warning',
      blocks,
      metadata: { providerName, model, level: config.level },
    });

    await replyWithSharedSurfaceResponse(ctx, response);
  }
}
