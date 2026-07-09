import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type {
  ChannelMeshActionDescriptor,
  ChannelMeshActionExecution,
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
  ChannelStatusRow,
} from '../../../../contracts/ChannelMeshContract.js';
import type { ZavorthChannelActionService } from '../../../../services/ZavorthChannelActionService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthPluginActionService } from '../../../../services/ZavorthPluginActionService.js';
import type { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { ZavorthRemoteTransportActionService } from '../../../../services/ZavorthRemoteTransportActionService.js';
import type { ZavorthRemoteTransportService } from '../../../../services/ZavorthRemoteTransportService.js';
import {
  ChannelExperienceConsistencyService,
  type ChannelExperienceConsistencySnapshot,
} from '../../../../services/ChannelExperienceConsistencyService.js';
import type {
  SurfaceBlock,
  SurfaceReceiptStatus,
  SurfaceResponseAction,
  SurfaceResponseTone,
} from '../../application/surface-response/index.js';
import { createSurfaceResponse } from '../../application/surface-response/index.js';
import { isSharedSurfaceChannelCallbackAction } from './SharedSurfaceCallbackCommandPolicy.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';type ChannelActionExecute = Pick<ZavorthChannelActionService, 'execute'>['execute'];
type ChannelActionRequest = Parameters<ChannelActionExecute>[0];
type ChannelActionResult = Awaited<ReturnType<ChannelActionExecute>>;

type PluginActionExecute = Pick<ZavorthPluginActionService, 'execute'>['execute'];
type PluginActionRequest = Parameters<PluginActionExecute>[0];
type PluginActionResult = Awaited<ReturnType<PluginActionExecute>>;

type TransportActionExecute = Pick<ZavorthRemoteTransportActionService, 'execute'>['execute'];
type TransportActionRequest = Parameters<TransportActionExecute>[0];
type TransportActionResult = Awaited<ReturnType<TransportActionExecute>>;

type SharedSurfaceIntegrationCommandPackDeps = {
  channelActionService: Pick<ZavorthChannelActionService, 'execute'>;
  channelMeshService: Pick<ZavorthChannelMeshService, 'renderReport'> & Partial<Pick<ZavorthChannelMeshService, 'buildSnapshot'>>;
  pluginActionService: Pick<ZavorthPluginActionService, 'execute'>;
  pluginRegistryService: Pick<ZavorthPluginRegistryService, 'renderCatalogReport'>;
  remoteTransportActionService: Pick<ZavorthRemoteTransportActionService, 'execute'>;
  remoteTransportService: Pick<ZavorthRemoteTransportService, 'buildSnapshot'>;
};

export class SharedSurfaceIntegrationCommandPack {
  private channelActionService: Pick<ZavorthChannelActionService, 'execute'>;

  constructor(private readonly deps: SharedSurfaceIntegrationCommandPackDeps) {
    this.channelActionService = deps.channelActionService;
  }

  public setChannelActionService(service: Pick<ZavorthChannelActionService, 'execute'>): void {
    this.channelActionService = service;
  }

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/plugins':
        await this.handlePlugins(ctx, args);
        return true;
      case '/channels':
        await this.handleChannels(ctx, args);
        return true;
      case '/transports':
        await this.handleTransports(ctx, args);
        return true;
      default:
        return false;
    }
  }

  public async executeChannelAction(request: ChannelActionRequest): Promise<ChannelActionResult> {
    return this.channelActionService.execute(request);
  }

  public async executePluginAction(request: PluginActionRequest): Promise<PluginActionResult> {
    return this.deps.pluginActionService.execute(request);
  }

  public async executeTransportAction(request: TransportActionRequest): Promise<TransportActionResult> {
    return this.deps.remoteTransportActionService.execute(request);
  }

  private async handlePlugins(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const actionCandidate = String(tokens[0] || '').trim().toLowerCase();
    const pluginId = String(tokens[1] || '').trim();
    if (['open', 'next', 'doctor', 'trust', 'review', 'install', 'update', 'remove'].includes(actionCandidate) && pluginId) {
      try {
        const result = await this.executePluginAction({
          pluginId,
          actionId: actionCandidate,
          requestedBy: String(ctx.userId || '').trim() || null,
        });
        await replyWithSharedSurfaceResponse(ctx, this.buildActionSurfaceResponse({
          id: `plugin-${pluginId}-${actionCandidate}`,
          intentTitle: 'Plugin plane',
          result,
        }));
      } catch (error: unknown) {await ctx.reply(error?.message || 'Nao consegui executar a acao do plugin plane agora.');
      }
      return;
    }

    await ctx.reply(this.deps.pluginRegistryService.renderCatalogReport({
      selectedId: normalizedArgs || null,
      query: normalizedArgs || null,
    }));
  }

  private async handleChannels(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const [actionCandidate, channelIdCandidate] = normalizedArgs.split(/\s+/).filter(Boolean);
    if (String(actionCandidate || '').trim().toLowerCase() === 'consistency') {
      await this.handleChannelExperienceConsistency(ctx, channelIdCandidate || null);
      return;
    }

    if (
      channelIdCandidate &&
      [
        'inspect',
        'status',
        'policy',
        'policy-reload',
        'prepare',
        'broadcast-test',
        'send-test',
        'doctor',
        'repair',
        'login-qr',
        'relink',
        'logout',
      ].includes(
        String(actionCandidate || '').trim().toLowerCase(),
      )
    ) {
      try {
        const result = await this.executeChannelAction({
          channelId: channelIdCandidate,
          actionId: actionCandidate,
          requestedBy: String(ctx.userId || '').trim() || null,
        });
        await replyWithSharedSurfaceResponse(ctx, this.buildChannelActionSurfaceResponse(result));
      } catch (error: unknown) {await ctx.reply(error?.message || 'Nao consegui executar a acao do Channel Mesh agora.');
      }
      return;
    }

    const selectedId = normalizedArgs || null;
    if (typeof this.deps.channelMeshService.buildSnapshot === 'function') {
      const snapshot = this.deps.channelMeshService.buildSnapshot({ selectedId });
      await replyWithSharedSurfaceResponse(ctx, this.buildChannelReportSurfaceResponse(snapshot));
      return;
    }
    await ctx.reply(this.deps.channelMeshService.renderReport({ selectedId }));
  }

  private async handleChannelExperienceConsistency(ctx: IMessageContext, selectedId: string | null): Promise<void> {
    const buildSnapshot = this.deps.channelMeshService.buildSnapshot;
    if (typeof buildSnapshot !== 'function') {
      await ctx.reply(this.deps.channelMeshService.renderReport({ selectedId }));
      return;
    }
    const consistency = new ChannelExperienceConsistencyService({
      channelMeshService: {
        buildSnapshot: buildSnapshot.bind(this.deps.channelMeshService),
      },
    }).buildSnapshot({ selectedId });
    await replyWithSharedSurfaceResponse(ctx, this.buildChannelExperienceConsistencySurfaceResponse(consistency));
  }

  private async handleTransports(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const [actionCandidate, transportIdCandidate] = normalizedArgs.split(/\s+/).filter(Boolean);
    if (transportIdCandidate && ['inspect', 'prepare', 'smoke', 'repair'].includes(String(actionCandidate || '').trim().toLowerCase())) {
      try {
        const result = await this.executeTransportAction({
          transportId: transportIdCandidate,
          actionId: actionCandidate,
          requestedBy: String(ctx.userId || '').trim() || null,
        });
        await replyWithSharedSurfaceResponse(ctx, this.buildActionSurfaceResponse({
          id: `transport-${transportIdCandidate}-${actionCandidate}`,
          intentTitle: 'Remote transport plane',
          result,
        }));
      } catch (error: unknown) {await ctx.reply(error?.message || 'Nao consegui executar a acao do plano remoto agora.');
      }
      return;
    }

    await ctx.reply(this.renderTransportReport(normalizedArgs || null));
  }

  private renderTransportReport(selectedId: string | null): string {
    const snapshot = this.deps.remoteTransportService.buildSnapshot({
      selectedId,
    });
    const lines = [
      'Remote Transport Plane do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Transportes: ${snapshot.summary.total} | prontos: ${snapshot.summary.ready} | em preparo: ${snapshot.summary.partial} | desativados: ${snapshot.summary.disabled}.`,
      `Ao vivo: ${snapshot.summary.live} | alcancaveis por endpoint: ${snapshot.summary.reachable} | atencao: ${snapshot.summary.attentionRequired} | pendencias: ${snapshot.summary.pendingWork}.`,
    ];

    if (snapshot.selected) {
      lines.push(
        '',
        `Em foco: ${snapshot.selected.label}`,
        `${snapshot.selected.operatorSummary}`,
        `Kind: ${snapshot.selected.kind} | transport: ${snapshot.selected.transport} | readiness: ${snapshot.selected.readiness}.`,
      );
      if (snapshot.selected.endpoint) {
        lines.push(`Endpoint: ${snapshot.selected.endpoint}`);
      }
      if (snapshot.selected.details.length > 0) {
        lines.push('', 'Detalhes:');
        for (const detail of snapshot.selected.details.slice(0, 4)) {
          lines.push(`- ${detail}`);
        }
      }
      if (snapshot.selected.telemetry) {
        lines.push(
          '',
          'Telemetria:',
          `- Status: ${snapshot.selected.telemetry.statusLine}`,
          `- Pendencias: ${snapshot.selected.telemetry.pendingWork}`,
          `- Ultima atualizacao: ${snapshot.selected.telemetry.updatedAt || 'n/d'}`,
          `- Ultimo erro: ${snapshot.selected.telemetry.lastError || 'sem erro recente'}`,
        );
      }
    }

    if (snapshot.suggestedActions.length > 0) {
      lines.push('', 'Proximos passos:');
      for (const action of snapshot.suggestedActions.slice(0, 4)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    return lines.join('\n');
  }

  private buildChannelReportSurfaceResponse(snapshot: ChannelMeshSnapshot) {
    const selected = snapshot.selected;
    const actions = this.mapChannelSurfaceActions(selected);
    const blocks: SurfaceBlock[] = [
      {
        kind: 'table',
        table: {
          title: 'Canais',
          columns: [
            { key: 'id', label: 'Canal', width: 16 },
            { key: 'readiness', label: 'Estado', width: 12 },
            { key: 'transport', label: 'Transporte', width: 18 },
            { key: 'summary', label: 'Resumo', width: 36 },
          ],
          rows: snapshot.entries.slice(0, 12).map((entry) => ({
            id: entry.id,
            readiness: entry.readiness,
            transport: entry.transport,
            summary: entry.summary,
          })),
          emptyText: 'Nenhum canal registrado no Channel Mesh.',
        },
      },
    ];

    if (selected) {
      blocks.push({
        kind: 'text',
        title: `Em foco: ${selected.label}`,
        text: [
          selected.operatorSummary,
          `Kind: ${selected.implementationState} | transport: ${selected.transport} | readiness: ${selected.readiness}.`,
          selected.actionHint,
        ].filter(Boolean).join('\n'),
      });
      blocks.push(...this.buildChannelStatusBlocks(selected.statusRows || []));
    }

    if (actions.length > 0) {
      blocks.push({
        kind: 'actions',
        title: 'Acoes do canal',
        actions,
      });
    }

    return createSurfaceResponse({
      id: `channel-mesh-${selected?.id || 'overview'}`,
      intent: 'status',
      title: 'Channel Mesh do Zavorth',
      summary: snapshot.narrative.operatorSummary,
      tone: snapshot.summary.ready > 0 ? 'success' : 'warning',
      blocks,
      actions,
      metadata: {
        generatedAt: snapshot.generatedAt,
        selectedId: selected?.id || null,
        total: snapshot.summary.total,
        ready: snapshot.summary.ready,
      },
    });
  }

  private buildChannelExperienceConsistencySurfaceResponse(snapshot: ChannelExperienceConsistencySnapshot) {
    const entries = snapshot.selected ? [snapshot.selected] : snapshot.entries;
    const actions: SurfaceResponseAction[] = [
      {
        id: 'channel-consistency-overview',
        label: 'Paridade',
        kind: 'command',
        command: '/channels consistency',
        callbackData: '/channels consistency',
        style: 'primary',
      },
      {
        id: 'channel-consistency-channels',
        label: 'Canais',
        kind: 'command',
        command: '/channels',
        callbackData: '/channels',
        style: 'secondary',
      },
      {
        id: 'channel-consistency-commands',
        label: 'Comandos',
        kind: 'command',
        command: '/commands channel',
        callbackData: '/commands channel',
        style: 'secondary',
      },
    ];
    return createSurfaceResponse({
      id: `channel-experience-consistency-${snapshot.selected?.channelId || 'overview'}`,
      intent: 'status',
      title: snapshot.narrative.headline,
      summary: snapshot.narrative.operatorSummary,
      tone: snapshot.summary.criticalGaps > 0 ? 'warning' : 'success',
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'Paridade por canal',
            columns: [
              { key: 'channel', label: 'Canal', width: 16 },
              { key: 'status', label: 'Estado', width: 10 },
              { key: 'score', label: 'Score', width: 8 },
              { key: 'summary', label: 'Resumo', width: 42 },
            ],
            rows: entries.slice(0, 12).map((entry) => ({
              channel: entry.label,
              status: entry.status,
              score: `${entry.score.percent}%`,
              summary: entry.summary,
            })),
          },
        },
        {
          kind: 'list',
          title: 'Proximo passo',
          items: [
            snapshot.narrative.nextAction,
            `Comandos: ${snapshot.commands.overview} | ${snapshot.commands.selected} | ${snapshot.commands.commandDeck}.`,
          ],
        },
      ],
      actions,
      metadata: {
        contractVersion: snapshot.contractVersion,
        criticalGaps: snapshot.summary.criticalGaps,
        selectedId: snapshot.selected?.channelId || null,
      },
    });
  }

  private buildChannelActionSurfaceResponse(result: ChannelMeshActionExecution) {
    const selected = result.selected || result.snapshot.selected;
    const actions = this.mapChannelSurfaceActions(selected);
    const blocks: SurfaceBlock[] = [
      {
        kind: 'list',
        title: 'Detalhes',
        items: result.details.length > 0 ? result.details : ['Acao registrada sem detalhes adicionais.'],
      },
      ...this.buildChannelStatusBlocks(selected?.statusRows || []),
      ...this.buildLoginQrBlocks(result),
    ];

    if (actions.length > 0) {
      blocks.push({
        kind: 'actions',
        title: 'Acoes disponiveis',
        actions,
      });
    }

    return createSurfaceResponse({
      id: `channel-action-${result.channelId}-${result.actionId}`,
      intent: 'receipt',
      title: result.summary,
      summary: result.snapshot.narrative.operatorSummary,
      tone: result.ok ? this.toneForActionStatus(result.status) : 'danger',
      blocks,
      actions,
      receipts: [
        {
          id: `${result.channelId}:${result.actionId}`,
          title: `Channel action: ${result.actionId}`,
          status: this.receiptStatusForAction(result),
          reason: result.summary,
          policyProfile: 'channel-mesh',
          redacted: Boolean(result.loginQr?.dataUrl),
          riskBlocked: result.ok === false,
          createdAt: result.generatedAt,
          metadata: {
            channelId: result.channelId,
            actionId: result.actionId,
            status: result.status,
            loginQrState: result.loginQr?.state || null,
          },
        },
      ],
      metadata: {
        channelId: result.channelId,
        actionId: result.actionId,
        status: result.status,
        loginQrState: result.loginQr?.state || null,
      },
    });
  }

  private buildActionSurfaceResponse(input: {
    id: string;
    intentTitle: string;
    result: {
      summary: string;
      details?: string[];
      snapshot?: {
        narrative?: {
          operatorSummary?: string;
        };
      };
    };
  }) {
    const details = Array.isArray(input.result.details) ? input.result.details : [];
    return createSurfaceResponse({
      id: input.id,
      intent: 'receipt',
      title: input.result.summary,
      summary: input.result.snapshot?.narrative?.operatorSummary || input.intentTitle,
      tone: 'success',
      blocks: [
        {
          kind: 'list',
          title: 'Detalhes',
          items: details.length > 0 ? details : ['Acao registrada sem detalhes adicionais.'],
        },
      ],
      receipts: [
        {
          id: input.id,
          title: input.intentTitle,
          status: 'done',
          reason: input.result.summary,
          policyProfile: 'shared-surface',
          redacted: false,
        },
      ],
    });
  }

  private buildChannelStatusBlocks(rows: ChannelStatusRow[]): SurfaceBlock[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }
    return [
      {
        kind: 'table',
        table: {
          title: 'Status do canal',
          columns: [
            { key: 'label', label: 'Campo', width: 22 },
            { key: 'value', label: 'Valor', width: 36 },
            { key: 'tone', label: 'Tom', width: 10 },
          ],
          rows: rows.slice(0, 10).map((row) => ({
            label: row.label,
            value: row.value,
            tone: row.tone || 'neutral',
          })),
        },
      },
    ];
  }

  private buildLoginQrBlocks(result: Pick<ChannelMeshActionExecution, 'loginQr'>): SurfaceBlock[] {
    if (!result.loginQr) {
      return [];
    }
    const items = [
      `Estado do QR: ${result.loginQr.state || 'n/d'}.`,
      result.loginQr.dataUrl
        ? 'QR pronto: use a imagem no zavorthControl/API local para escanear com seguranca.'
        : `QR: ${result.loginQr.nextStep || 'sem proximo passo informado.'}`,
      result.loginQr.expiresAt ? `Expira em: ${result.loginQr.expiresAt}.` : null,
    ].filter(Boolean) as string[];
    return [
      {
        kind: 'list',
        title: 'Pareamento',
        items,
      },
    ];
  }

  private mapChannelSurfaceActions(selected: ChannelMeshSnapshotEntry | null | undefined): SurfaceResponseAction[] {
    if (!selected?.actions?.length) {
      return [];
    }
    return selected.actions.slice(0, 8).map((action) => this.mapChannelSurfaceAction(selected.id, action));
  }

  private mapChannelSurfaceAction(channelId: string, action: ChannelMeshActionDescriptor): SurfaceResponseAction {
    const command = action.command || `/channels ${action.kind} ${channelId}`;
    return {
      id: `channel:${channelId}:${action.kind}`,
      label: action.label,
      kind: 'command',
      style: this.styleForChannelAction(action.kind),
      command,
      callbackData: command,
      confirmationRequired: !isSharedSurfaceChannelCallbackAction(action.kind),
      metadata: {
        channelId,
        actionKind: action.kind,
      },
    };
  }

  private styleForChannelAction(kind: ChannelMeshActionDescriptor['kind']): SurfaceResponseAction['style'] {
    switch (kind) {
      case 'login-qr':
      case 'status':
      case 'inspect':
        return 'primary';
      case 'broadcast-test':
      case 'send-test':
      case 'prepare':
        return 'success';
      case 'logout':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private toneForActionStatus(status: ChannelMeshActionExecution['status']): SurfaceResponseTone {
    switch (status) {
      case 'applied':
        return 'success';
      case 'manual':
      case 'noop':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  private receiptStatusForAction(result: ChannelMeshActionExecution): SurfaceReceiptStatus {
    if (!result.ok) {
      return 'failed';
    }
    return result.status === 'applied' ? 'done' : 'require_user_confirmation';
  }
}
