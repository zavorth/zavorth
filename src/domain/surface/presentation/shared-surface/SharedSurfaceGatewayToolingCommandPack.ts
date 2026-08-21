import type { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { AIGatewayProxyService } from '../../../../services/AIGatewayProxyService.js';
import type { ZavorthGatewayLauncherService } from '../../../../services/ZavorthGatewayLauncherService.js';
import type { ZavorthGatewayService } from '../../../../services/ZavorthGatewayService.js';
import type { ZavorthHookPlaneService } from '../../../../services/ZavorthHookPlaneService.js';
import type { ZavorthToolSurfaceService } from '../../../../services/ZavorthToolSurfaceService.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import type {
  GatewayCompatibilityDoctorService,
  AIGatewayCompatibilityDoctorReport,
} from '../../../../services/GatewayCompatibilityDoctorService.js';
import type {
  GatewayUpstreamSyncService,
  AIGatewayUpstreamSyncReport,
} from '../../../../services/GatewayUpstreamSyncService.js';
import type { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import type { ProviderDoctorService } from '../../../../services/ProviderDoctorService.js';
import {
  buildReportSurfaceResponse,
  buildRuntimeSurfaceResponse,
  createSurfaceResponse,
  renderPlainSurfaceResponse,
  type SurfaceBlock,
  type SurfaceReceiptStatus,
  type SurfaceResponseAction,
} from '../../application/surface-response/index.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
type SharedSurfaceGatewayToolingCommandPackDeps = {
  AIGatewayGatewayService: Pick<AIGatewayProxyService, 'readStatus'>;
  AIGatewayGatewayLauncherService: Pick<ZavorthGatewayLauncherService, 'ensureStarted'>;
  GatewayCompatibilityDoctorService: Pick<GatewayCompatibilityDoctorService, 'run'>;
  GatewayUpstreamSyncService: Pick<GatewayUpstreamSyncService, 'sync' | 'promote' | 'rollback'>;
  gatewayService: Pick<ZavorthGatewayService, 'buildHydratedSnapshot'>;
  toolSurfaceService: Pick<ZavorthToolSurfaceService, 'buildSnapshot'>;
  hookPlaneService: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  zavorthBridgePreferenceStore: Pick<ZavorthBridgePreferenceStore, 'getPreferredModel'>;
  discordSurfacePolicyService: Pick<DiscordSurfacePolicyService, 'canUseOperationalCommand'>;
  providerDoctorService: Pick<ProviderDoctorService, 'renderStatusReport'>;
  providerControlPlaneService: Pick<ProviderControlPlaneService, 'getUsageTargets'>;
};

export class SharedSurfaceGatewayToolingCommandPack {
  public constructor(private readonly deps: SharedSurfaceGatewayToolingCommandPackDeps) {}

  public async handleAIGateway(ctx: IMessageContext, args: string): Promise<void> {
    const normalized = String(args || '').trim();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const action = String(tokens[0] || 'status')
      .trim()
      .toLowerCase();

    try {
      if (
        action === 'start' ||
        (action === 'route' &&
          String(tokens[1] || '')
            .trim()
            .toLowerCase() === 'start')
      ) {
        const gatewayStatus = await this.deps.AIGatewayGatewayLauncherService.ensureStarted();
        await ctx.reply(this.formatAIGatewayGatewayReply(gatewayStatus, false));
        return;
      }

      if (action === 'status' || action === 'route') {
        const gatewayStatus = this.deps.AIGatewayGatewayService.readStatus();
        await ctx.reply(this.formatAIGatewayGatewayReply(gatewayStatus, action === 'route'));
        return;
      }

      if (action === 'doctor') {
        const report = await this.deps.GatewayCompatibilityDoctorService.run();
        await ctx.reply(this.formatAIGatewayDoctorReply(report));
        return;
      }

      if (action === 'sync') {
        const report = await this.deps.GatewayUpstreamSyncService.sync();
        await ctx.reply(this.formatAIGatewaySyncReply(report));
        return;
      }

      if (action === 'promote') {
        const report = await this.deps.GatewayUpstreamSyncService.promote({
          autoRollback: !tokens.includes('no-rollback'),
        });
        await ctx.reply(this.formatAIGatewaySyncReply(report));
        return;
      }

      if (action === 'rollback') {
        const report = await this.deps.GatewayUpstreamSyncService.rollback();
        await ctx.reply(this.formatAIGatewaySyncReply(report));
        return;
      }

      await ctx.reply('Use /AIGateway [status|route|start|doctor|sync|promote|rollback].');
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_ai_gateway')));
    }
  }

  public async handleGateway(ctx: IMessageContext): Promise<void> {
    const snapshot = await this.deps.gatewayService.buildHydratedSnapshot({
      userId: String(ctx.userId || '').trim() || null,
      chatId: String(ctx.chatId || '').trim() || null,
      sessionId: String(ctx.chatId || '').trim() || null,
    });
    await replyWithSharedSurfaceResponse(ctx, this.buildGatewaySurfaceResponse(snapshot));
  }

  public async handleTools(ctx: IMessageContext, args: string): Promise<void> {
    const query = String(args || '').trim() || null;
    const snapshot = this.deps.toolSurfaceService.buildSnapshot({
      userId: String(ctx.userId || '').trim() || '',
      chatId: String(ctx.chatId || '').trim() || '',
      sessionId: String(ctx.chatId || '').trim() || '',
      query,
      selectedId: query,
    });
    const lines = [
      'Zavorth Tool Surface',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Families: ${snapshot.summary.families} | ready: ${snapshot.summary.ready} | partial: ${snapshot.summary.partial} | planned: ${snapshot.summary.planned}.`,
      `Explicit tools: ${snapshot.summary.explicitTools}.`,
    ];

    if (query) {
      lines.push('', `Current filter: ${query}`, `Visible items: ${snapshot.catalog.entries.length}.`);
      if (snapshot.catalog.selected) {
        const selected = snapshot.catalog.selected;
        lines.push(
          '',
          `In focus: ${selected.label}`,
          `Family: ${selected.familyLabel} | kind: ${selected.kind} | readiness: ${selected.readiness}.`,
          selected.summary,
        );
        if (selected.command) {
          lines.push(`Command: ${selected.command}`);
        }
        if (selected.details.length > 0) {
          lines.push('', 'Details:');
          for (const detail of selected.details.slice(0, 4)) {
            lines.push(`- ${detail}`);
          }
        }
      } else {
        lines.push('', 'No cataloged item matched this filter.');
      }

      if (snapshot.catalog.entries.length > 0) {
        lines.push('', 'Visible items:');
        for (const entry of snapshot.catalog.entries.slice(0, 6)) {
          const commandSuffix = entry.command ? ` | ${entry.command}` : '';
          lines.push(`- ${entry.label} (${entry.familyLabel})${commandSuffix}`);
        }
      }
    } else {
      for (const family of snapshot.families.slice(0, 6)) {
        lines.push(`- ${family.label}: ${family.summary}`);
      }
      if (snapshot.catalog.entries.length > 0) {
        lines.push('', 'Featured tools:');
        for (const entry of snapshot.catalog.entries.slice(0, 6)) {
          const commandSuffix = entry.command ? ` | ${entry.command}` : '';
          lines.push(`- ${entry.label} (${entry.familyLabel})${commandSuffix}`);
        }
      }
    }
    await ctx.reply(
      this.renderGatewayReport('tool-surface', 'Zavorth Tool Surface', lines.join('\n'), {
        query,
        visibleItems: snapshot.catalog.entries.length,
      }),
    );
  }

  public async handleHooks(ctx: IMessageContext, args: string): Promise<void> {
    const query = String(args || '')
      .trim()
      .toLowerCase();
    const snapshot = this.deps.hookPlaneService.buildSnapshot();
    const visibleEvents = query
      ? snapshot.events.filter((event) =>
          [event.id, event.label, event.scope, event.description].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          ),
        )
      : snapshot.events;
    const visibleRegistrations = query
      ? snapshot.registrations.filter((entry) =>
          [entry.workspace, entry.workspaceName, entry.event, entry.command].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          ),
        )
      : snapshot.registrations;
    const lines = [
      'Zavorth Hook Plane',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Events: ${snapshot.summary.supportedEvents} | covered: ${snapshot.summary.coveredEvents} | registered hooks: ${snapshot.summary.registeredHooks} | workspaces: ${snapshot.summary.workspaces}.`,
    ];

    if (query) {
      lines.push('', `Current filter: ${query}`);
    }

    if (visibleEvents.length > 0) {
      lines.push('', query ? 'Visible events:' : 'Featured events:');
      for (const event of visibleEvents.slice(0, 6)) {
        lines.push(`- ${event.label} (${event.scope}) | status: ${event.status} | hooks: ${event.registeredHooks}`);
      }
    } else {
      lines.push('', 'No hook event matched this filter.');
    }

    if (visibleRegistrations.length > 0) {
      lines.push('', 'Registrations:');
      for (const entry of visibleRegistrations.slice(0, 5)) {
        lines.push(`- ${entry.workspaceName || entry.workspace}: ${entry.event} -> ${entry.command}`);
      }
    }

    await ctx.reply(
      this.renderGatewayReport('hook-plane', 'Zavorth Hook Plane', lines.join('\n'), {
        query: query || null,
        visibleEvents: visibleEvents.length,
        visibleRegistrations: visibleRegistrations.length,
      }),
    );
  }

  private formatAIGatewayGatewayReply(
    status: ReturnType<AIGatewayProxyService['readStatus']>,
    routeOnly: boolean,
  ): string {
    if (routeOnly) {
      const text = [
        'AIGateway route',
        '',
        `Rota Zavorth: ${status.baseUrl}`,
        `Upstream: ${status.upstreamBaseUrl}`,
        `Estado: ${status.ready ? 'ready' : status.running ? 'warming-up' : 'offline'}.`,
        status.message,
      ].join('\n');
      return this.renderGatewayAction('AIGateway route', text, {
        id: 'aigateway-route',
        status: status.ready ? 'done' : 'failed',
        summary: status.message,
        metadata: { ready: status.ready, running: status.running },
      });
    }

    const text = [
      'Zavorth AIGateway',
      '',
      `Gateway own: ${status.enabled ? 'enabled' : 'disabled'}.`,
      `Ready: ${status.ready ? 'yes' : 'no'}.`,
      `Zavorth route: ${status.baseUrl}`,
      `Upstream: ${status.upstreamBaseUrl}`,
      `Overlay: ${status.overlayFile || 'n/a'}`,
      status.message,
    ].join('\n');
    return this.renderGatewayAction('Zavorth AIGateway', text, {
      id: 'aigateway-status',
      status: status.ready ? 'done' : 'failed',
      summary: status.message,
      metadata: { ready: status.ready, running: status.running, enabled: status.enabled },
    });
  }

  private formatAIGatewayDoctorReply(report: AIGatewayCompatibilityDoctorReport): string {
    const text = [
      'AIGateway doctor',
      '',
      report.summary,
      `Status: ${report.status}.`,
      `Rota Zavorth: ${report.baseUrl}`,
      `Validated target: ${report.checkedTarget}`,
      report.httpStatus !== null ? `HTTP: ${report.httpStatus}` : null,
      report.error ? `error: ${report.error}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return this.renderGatewayAction('AIGateway doctor', text, {
      id: 'aigateway-doctor',
      status: report.ok ? 'done' : 'failed',
      summary: report.summary,
      metadata: { status: report.status, httpStatus: report.httpStatus },
    });
  }

  private formatAIGatewaySyncReply(report: AIGatewayUpstreamSyncReport): string {
    const text = [
      `AIGateway ${report.action}`,
      '',
      report.summary,
      `Status: ${report.status}.`,
      `Compatibility: ${report.compat ? report.compat.status : 'not executed'}.`,
      report.rollbackApplied ? 'Automatic rollback applied: yes.' : null,
      report.error ? `Error: ${report.error}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return this.renderGatewayAction(`AIGateway ${report.action}`, text, {
      id: `aigateway-${report.action}`,
      status: report.status === 'failed' ? 'failed' : 'done',
      summary: report.summary,
      metadata: { action: report.action, status: report.status, rollbackApplied: report.rollbackApplied },
    });
  }

  public async handleModels(ctx: IMessageContext): Promise<void> {
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    await replyWithSharedSurfaceResponse(ctx, this.buildModelsSurfaceResponse(ctx, preferredZavorthBridgeModel));
  }

  public async buildModelsReply(ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>): Promise<string> {
    const preferredZavorthBridgeModel = await this.deps.zavorthBridgePreferenceStore.getPreferredModel();
    return renderPlainSurfaceResponse(this.buildModelsSurfaceResponse(ctx, preferredZavorthBridgeModel)).text;
  }

  private buildModelsSurfaceResponse(
    ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>,
    preferredZavorthBridgeModel: string | null,
  ) {
    const isDiscordOperationalOwner =
      ctx.platform === 'discord' &&
      this.deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
        isDirectMessage: !ctx.isGroup,
      });
    const shortcuts =
      ctx.platform === 'discord' && !isDiscordOperationalOwner ? 'Useful shortcuts: /help and /task.'
        : 'Useful shortcuts: /status, /changes, /reload and /autorepair.';
    const targets = this.deps.providerControlPlaneService.getUsageTargets();
    const text = [
      this.deps.providerDoctorService.renderStatusReport({
        preferredZavorthBridgeModel,
      }),
      '',
      `Accepted targets in /model: ${targets.join(', ')}.`,
      shortcuts,
    ].join('\n');

    return createSurfaceResponse({
      id: 'shared-gateway-models',
      intent: 'models',
      title: 'Models and providers',
      summary: 'Provider selection, usage target, and shortcuts rendered by the same multi-channel contract.',
      tone: 'info',
      blocks: [
        {
          kind: 'text',
          title: 'Operational read',
          text,
        },
        {
          kind: 'list',
          title: 'Accepted targets',
          items: targets.length > 0 ? targets : ['chat'],
        },
      ],
      actions: this.buildModelActions(ctx.platform !== 'discord' || isDiscordOperationalOwner),
      metadata: {
        platform: ctx.platform,
        isDiscordOperationalOwner,
        preferredZavorthBridgeModel,
        targets,
      },
    });
  }

  private buildGatewaySurfaceResponse(snapshot: Awaited<ReturnType<ZavorthGatewayService['buildHydratedSnapshot']>>) {
    const blocks: SurfaceBlock[] = [
      {
        kind: 'text',
        title: 'Operational read',
        text: [snapshot.narrative.headline, snapshot.narrative.operatorSummary].join('\n'),
      },
      {
        kind: 'table',
        table: {
          title: 'Summary',
          columns: [
            { key: 'area', label: 'Area', width: 22 },
            { key: 'value', label: 'Value', width: 16 },
            { key: 'detail', label: 'Detail', width: 36 },
          ],
          rows: [
            {
              area: 'Channels',
              value: `${snapshot.summary.channelsReady}/${snapshot.summary.channelsTotal}`,
              detail: 'ready on Channel Mesh',
            },
            { area: 'Runtime modes', value: snapshot.summary.runtimeModesReady, detail: 'modes ready' },
            { area: 'Teams', value: snapshot.summary.teams, detail: 'composed workflows' },
            { area: 'Nodes', value: snapshot.summary.nodesPaired, detail: 'paired nodes' },
            { area: 'Sessions', value: snapshot.summary.sessionTargets, detail: 'visible targets' },
            { area: 'Tools', value: snapshot.summary.toolFamilies, detail: 'cataloged families' },
            { area: 'Plugins', value: snapshot.summary.plugins, detail: 'registered plugins' },
            { area: 'Memory', value: snapshot.summary.memoryArtifacts, detail: 'operational artifacts' },
          ],
        },
      },
    ];

    const actions: SurfaceResponseAction[] = [
      {
        id: 'gateway-channels',
        label: 'Channels',
        kind: 'command',
        command: '/channels',
        callbackData: '/channels',
        style: 'primary',
      },
      {
        id: 'gateway-models',
        label: 'Models',
        kind: 'command',
        command: '/models',
        callbackData: '/models',
        style: 'secondary',
      },
      {
        id: 'gateway-tools',
        label: 'Tools',
        kind: 'command',
        command: '/tools',
        callbackData: '/tools',
        style: 'secondary',
      },
      {
        id: 'gateway-runtime',
        label: 'Runtime',
        kind: 'command',
        command: '/runtime',
        callbackData: '/runtime',
        style: 'success',
      },
    ];

    return createSurfaceResponse({
      id: 'shared-gateway-status',
      intent: 'status',
      title: 'Zavorth Gateway',
      summary: snapshot.narrative.operatorSummary,
      tone: snapshot.summary.channelsReady > 0 ? 'success' : 'warning',
      blocks,
      actions,
      metadata: {
        channelsReady: snapshot.summary.channelsReady,
        channelsTotal: snapshot.summary.channelsTotal,
      },
    });
  }

  private buildModelActions(allowOperationalModels: boolean): SurfaceResponseAction[] {
    if (!allowOperationalModels) {
      return [
        {
          id: 'models-help',
          label: 'Help',
          kind: 'command',
          command: '/help',
          callbackData: '/help',
          style: 'secondary',
        },
      ];
    }
    return [
      {
        id: 'model-gemini',
        label: 'Gemini',
        kind: 'command',
        command: '/model gemini',
        callbackData: '/model gemini',
        style: 'primary',
      },
      {
        id: 'model-openai',
        label: 'OpenAI',
        kind: 'command',
        command: '/model openai',
        callbackData: '/model openai',
        style: 'secondary',
      },
      {
        id: 'model-gemma',
        label: 'Gemma',
        kind: 'command',
        command: '/model gemma-2-27b-it',
        callbackData: '/model gemma-2-27b-it',
        style: 'secondary',
      },
      {
        id: 'model-status',
        label: 'Gateway',
        kind: 'command',
        command: '/gateway',
        callbackData: '/gateway',
        style: 'success',
      },
    ];
  }

  private renderGatewayReport(
    id: string,
    title: string,
    text: string,
    metadata: Record<string, unknown> = {},
    status: SurfaceReceiptStatus = 'done',
  ): string {
    return renderPlainSurfaceResponse(
      buildReportSurfaceResponse({
        id: `shared-gateway-${id}`,
        title,
        text,
        status,
        policyProfile: 'shared-gateway-tooling',
        metadata,
      }),
    ).text;
  }

  private renderGatewayAction(
    title: string,
    text: string,
    options: {
      id: string;
      summary: string;
      status?: SurfaceReceiptStatus;
      metadata?: Record<string, unknown>;
    },
  ): string {
    return renderPlainSurfaceResponse(
      buildRuntimeSurfaceResponse({
        id: `shared-gateway-${options.id}`,
        title,
        summary: options.summary,
        text,
        status: options.status || 'done',
        policyProfile: 'shared-gateway-tooling',
        metadata: options.metadata,
      }),
    ).text;
  }
}
