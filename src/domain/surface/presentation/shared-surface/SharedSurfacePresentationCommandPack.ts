import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { RuntimeDiagnosticsSnapshot } from '../../../../services/RuntimeDiagnosticsService.js';
import type { ZavorthSecurityMeshService } from '../../../../services/ZavorthSecurityMeshService.js';
import type { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import { getSharedSurfaceCommandContract } from '../../../../services/SharedSurfaceCommandContract.js';
import type { RuntimeMaintenanceIntent } from './SharedSurfaceRuntimeMaintenanceCommandPack.js';
import { createSurfaceResponse } from '../../application/surface-response/index.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';

export type SharedSurfacePresentationCommandPackDeps = {
  securityMeshService: Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
  trustPlaneService: Pick<ZavorthTrustPlaneService, 'buildSnapshot'>;
  discordSurfacePolicyService: Pick<DiscordSurfacePolicyService, 'canUseOperationalCommand' | 'getCommandExposure'>;
};

export class SharedSurfacePresentationCommandPack {
  public constructor(private readonly deps: SharedSurfacePresentationCommandPackDeps) {}

  public async handleCommandCatalog(ctx: IMessageContext, args: string = ''): Promise<void> {
    await replyWithSharedSurfaceResponse(ctx, this.buildCommandCatalogSurfaceResponse(args));
  }

  public async handleStatus(ctx: IMessageContext, snapshot: RuntimeDiagnosticsSnapshot): Promise<void> {
    const text = this.formatSystemStatusReply(snapshot, ctx);
    const recentFailures = Array.isArray(snapshot.tasks?.recentFailures) ? snapshot.tasks.recentFailures.length : 0;
    await replyWithSharedSurfaceResponse(
      ctx,
      createSurfaceResponse({
        id: 'shared-status',
        intent: 'status',
        title: 'Zavorth status',
        summary: 'Operational health, shortcuts, and next commands in one shared response.',
        tone: recentFailures > 0 ? 'warning' : 'success',
        blocks: [
          {
            kind: 'text',
            title: 'Operational read',
            text,
          },
        ],
        actions: [
          {
            id: 'status-gateway',
            label: 'Gateway',
            kind: 'command',
            command: '/gateway',
            callbackData: '/gateway',
            style: 'primary',
          },
          {
            id: 'status-models',
            label: 'Models',
            kind: 'command',
            command: '/models',
            callbackData: '/models',
            style: 'secondary',
          },
          {
            id: 'status-runtime',
            label: 'Runtime',
            kind: 'command',
            command: '/runtime',
            callbackData: '/runtime',
            style: 'secondary',
          },
          {
            id: 'status-doctor',
            label: 'Doctor',
            kind: 'command',
            command: '/doctor',
            callbackData: '/doctor',
            style: 'success',
          },
        ],
        metadata: {
          uptimeSeconds: snapshot.process?.uptimeSeconds || 0,
          recentFailures,
        },
      }),
    );
  }

  private buildCommandCatalogSurfaceResponse(args: string = '') {
    const normalizedArgs = String(args || '')
      .trim()
      .toLowerCase();
    const pageMatch = normalizedArgs.match(/\bpage\s+(\d+)\b/) || normalizedArgs.match(/^(\d+)$/);
    const page = Math.max(1, Number(pageMatch?.[1] || 1));
    const query = normalizedArgs
      .replace(/\bpage\s+\d+\b/g, '')
      .replace(/^\d+$/g, '')
      .trim();
    const pageSize = 12;
    const allEntries = getSharedSurfaceCommandContract()
      .filter((entry) => entry.handler === 'dispatcher' || entry.fallbackVisible || entry.description)
      .map((entry) => ({
        command: entry.surfaceCommand,
        handler: entry.handler,
        scopeRaw: entry.discordSlashVisibility,
        scope: this.formatCommandScope(entry.discordSlashVisibility),
        description: entry.description || 'Shared Zavorth command.',
        discord: entry.discordSlashName || 'n/a',
      }));
    const filtered = query
      ? allEntries.filter((entry) =>
          [entry.command, entry.handler, entry.scopeRaw, entry.scope, entry.description, entry.discord].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          ),
        )
      : allEntries;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const actions = [
      {
        id: 'commands-status',
        label: 'Status',
        kind: 'command' as const,
        command: '/status',
        callbackData: '/status',
        style: 'primary' as const,
      },
      {
        id: 'commands-models',
        label: 'Models',
        kind: 'command' as const,
        command: '/models',
        callbackData: '/models',
        style: 'secondary' as const,
      },
      {
        id: 'commands-channels',
        label: 'Channels',
        kind: 'command' as const,
        command: '/channels',
        callbackData: '/channels',
        style: 'secondary' as const,
      },
      {
        id: 'commands-gateway',
        label: 'Gateway',
        kind: 'command' as const,
        command: '/gateway',
        callbackData: '/gateway',
        style: 'success' as const,
      },
      ...(safePage > 1
        ? [
            {
              id: 'commands-prev',
              label: 'Previous page',
              kind: 'command' as const,
              command: `/commands${query ? ` ${query}` : ''} page ${safePage - 1}`,
              callbackData: `/commands${query ? ` ${query}` : ''} page ${safePage - 1}`,
              style: 'secondary' as const,
            },
          ]
        : []),
      ...(safePage < totalPages
        ? [
            {
              id: 'commands-next',
              label: 'Next page',
              kind: 'command' as const,
              command: `/commands${query ? ` ${query}` : ''} page ${safePage + 1}`,
              callbackData: `/commands${query ? ` ${query}` : ''} page ${safePage + 1}`,
              style: 'secondary' as const,
            },
          ]
        : []),
    ];

    return createSurfaceResponse({
      id: `shared-command-catalog-${query || 'all'}-${safePage}`,
      intent: 'help',
      title: 'Zavorth command catalog',
      summary: `Page ${safePage}/${totalPages}${query ? ` filtered by "${query}"` : ''}.`,
      tone: 'info',
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'Shared commands',
            columns: [
              { key: 'command', label: 'Command', width: 18 },
              { key: 'scope', label: 'Scope', width: 10 },
              { key: 'discord', label: 'Discord', width: 12 },
              { key: 'description', label: 'Usage', width: 36 },
            ],
            rows: visible.map(({ command, scope, discord, description }) => ({
              command,
              scope,
              discord,
              description,
            })),
            emptyText: 'No command matched this filter.',
          },
        },
        {
          kind: 'list',
          title: 'How to use',
          items: [
            'Use free text for normal requests; slash commands are for explicit control.',
            'Use /commands page 2 to paginate.',
            'Use /commands channel, /commands model, or /commands operator to filter.',
          ],
        },
      ],
      actions,
      metadata: {
        query: query || null,
        page: safePage,
        totalPages,
        totalCommands: filtered.length,
      },
    });
  }

  private formatCommandScope(scope: string): string {
    switch (scope) {
      case 'public':
        return 'public';
      case 'operator':
        return 'operator';
      default:
        return 'local';
    }
  }

  /**
   * Progressive help.
   * - default / `/help daily` → short daily path (no long-id catalog)
   * - `/help advanced` → power-user catalog
   * - `/help natural` → natural-language tips
   */
  public renderHelp(ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>, args: string = ''): string {
    const isDiscordOperationalOwner =
      ctx.platform === 'discord' &&
      this.deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
        isDirectMessage: !ctx.isGroup,
      });
    const discordExposure = this.deps.discordSurfacePolicyService.getCommandExposure();
    const layer =
      String(args || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)[0] || 'daily';

    if (layer === 'advanced' || layer === 'all' || layer === 'full' || layer === 'power') {
      return this.renderAdvancedHelp(ctx, { isDiscordOperationalOwner, discordExposure });
    }
    if (layer === 'natural' || layer === 'nl' || layer === 'tips') {
      return this.renderNaturalHelp();
    }

    const lines = [
      'Zavorth — daily help',
      '',
      'How commands work:',
      '  /command              → home/status',
      '  /command <plain text> → main action',
      '  Free text             → agent + tools (not keyword shortcuts)',
      '',
      'Daily (start here):',
      '  /task <goal>          open a common task',
      '  /plan <goal>          plan before acting',
      '  /status · /models     health and providers',
      '  /knowledge            what Zavorth remembers (pretty report)',
      '  /learn list           skill drafts → /learn promote 1',
      '  /learning list        candidates → /learning approve 1',
      '  /approve · /reject    decide pending work (or /approve 1)',
      '  /undo                 reverse the most recent undoable task',
      '  /workflow resume      resume the latest open workflow',
      '  /perm                 pending permissions (/perm approve 1)',
      '  /mode                 product mode + pending escalations',
      '',
      '/learn = skill drafts · /learning = candidates',
      '',
      'Approvals (no long ids):',
      '  Tap Approve/Reject when buttons appear',
      '  /approve · /approve 1 · /reject · /reject 1',
      '  /mode approve · /mode approve 1 [once|session|host]',
      '',
      'More help:',
      '  /help advanced        power-user catalog (plugins, mesh, evals…)',
      '  /commands [query]     searchable command catalog (paged)',
      '  /help natural         natural-language tips',
    ];

    if (ctx.platform === 'discord') {
      if (discordExposure === 'minimal' || discordExposure === 'operator') {
        lines.push('', 'On Discord, public commands appear as native slash commands.');
      } else {
        lines.push('', 'On public Discord, slash commands are disabled by policy in this runtime.');
      }
      if (!isDiscordOperationalOwner) {
        lines.push('Operational commands stay restricted to the owner (DM preferred).');
      }
    }

    return lines.join('\n');
  }

  private renderNaturalHelp(): string {
    return [
      'Zavorth — natural tips',
      '',
      'Free text goes to the agent (LLM + tools). It does NOT secretly approve,',
      'undo, promote skills, or change mode by matching words.',
      '',
      'For decisions, use:',
      '  • buttons on the card, or',
      '  • short slash: /approve · /approve 1 · /undo · /mode approve',
      '',
      'Useful status surfaces:',
      '  /knowledge      memory home',
      '  /learn list     skill drafts → /learn promote 1',
      '  /learning list  candidates → /learning approve 1',
      '  /perm           permissions (approve 1)',
      '  /status         health',
      '',
      '/learn = skill drafts · /learning = candidates',
      '',
      'Power catalog: /help advanced',
    ].join('\n');
  }

  private renderAdvancedHelp(
    ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>,
    opts: { isDiscordOperationalOwner: boolean; discordExposure: string },
  ): string {
    const lines = [
      'Zavorth — advanced help (power user)',
      'Long ids are optional when short numbers/buttons exist. Prefer /help daily for normal use.',
      '',
      '/learn = skill drafts · /learning = candidates',
      '  /learn list · /learn promote 1     experience skill drafts',
      '  /learning list · /learning approve 1 · /learning promote 1',
      '',
      '/capabilities · /runtime · /trust · /access · /bootstrap',
      '/channels · /transports · /plugins · /skills · /platform · /hub',
      '/evals · /qa · /governance · /replayloop · /ecosystem · /automations',
      '/learning · /AIGateway · /teams · /tenants · /memory · /memoryplane',
      '/sessions · /sessionhistory · /agmobile · /integrations · /connect',
      '/codexremote · /workflow review|ship|research|sdd|resume|close',
      '/selfmod preview|goal|apply|rollback',
      '/changes · /reload · /autorepair',
      '',
      'Still prefer ordinals where available:',
      '  /learn promote 1 · /learning approve 1 · /perm approve 1 · /approve 1 · /mode approve 1',
      '',
      'Searchable catalog: /commands [query] page N',
      'Back: /help',
    ];

    if (ctx.platform === 'discord') {
      lines.push(
        '',
        opts.discordExposure === 'minimal' || opts.discordExposure === 'operator'
          ? 'Discord: public commands may appear as native slash.'
          : 'Discord public: slash may be disabled by policy.',
      );
      if (opts.isDiscordOperationalOwner) {
        lines.push('Owner operational tools are available in this context (prefer DM).');
      }
    }

    return lines.join('\n');
  }

  public formatSecurityMeshReply(): string {
    const snapshot = this.deps.securityMeshService.buildSnapshot();
    const trustPlane = this.deps.trustPlaneService.buildSnapshot();
    const posture = snapshot.posture || { label: 'n/a', summary: 'No posture available.' };
    const summary = snapshot.summary || {
      coreReady: 0,
      extensionsReady: 0,
      gvisorActive: false,
      firecrackerReady: false,
      neverDowngrade: false,
    };
    const actions = Array.isArray(snapshot.suggestedActions) ? snapshot.suggestedActions.slice(0, 3) : [];

    const lines = [
      'Runtime & Security Mesh',
      '',
      `Posture: ${posture.label}.`,
      snapshot.narrative?.operatorSummary || posture.summary,
      '',
      `Core ready: ${summary.coreReady} | Extensions ready: ${summary.extensionsReady}.`,
      `gVisor: ${summary.gvisorActive ? 'active' : 'inactive'} | MicroVM: ${summary.firecrackerReady ? 'ready' : 'preparing'}.`,
      `Never-downgrade: ${summary.neverDowngrade ? 'active' : 'inactive'}.`,
      '',
      snapshot.narrative?.trustBoundary || 'No detailed trust boundary right now.',
      '',
      'Trust Plane',
      '',
      trustPlane.narrative?.operatorSummary || 'No trust plane summary available.',
      `MCP: ${trustPlane.surfaces.mcp.profile} | Skills: ${trustPlane.surfaces.skills.defaultPolicy} | Approvals: ${trustPlane.surfaces.systemOverlord.pendingApprovals}.`,
    ];

    if (actions.length > 0) {
      lines.push('', 'Next steps:');
      for (const action of actions) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    const trustActions = Array.isArray(trustPlane.suggestedActions) ? trustPlane.suggestedActions.slice(0, 3) : [];
    if (trustActions.length > 0) {
      lines.push('', 'Suggested trust actions:');
      for (const action of trustActions) {
        lines.push(`- ${action.label}: ${action.command || action.reason}`);
      }
    }

    return lines.join('\n');
  }

  public formatSystemStatusReply(
    snapshot: RuntimeDiagnosticsSnapshot,
    ctx: Pick<IMessageContext, 'platform' | 'userId' | 'isGroup'>,
  ): string {
    const uptimeMinutes = Math.floor(snapshot.process.uptimeSeconds / 60);
    const uptimeText =
      uptimeMinutes >= 60 ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}min` : `${uptimeMinutes}min`;
    const hostPid = snapshot.runtime.hostSupervisor.alive ? snapshot.runtime.hostSupervisor.pid : null;
    const workerPid = snapshot.runtime.telegramWorker.alive ? snapshot.runtime.telegramWorker.pid : null;
    const discordLabel = snapshot.runtime.discordBridge.mode === 'native' ? 'Native Discord' : 'Discord bridge';
    const lastFailure = snapshot.tasks.recentFailures[0] || null;
    const isDiscordOperationalOwner =
      ctx.platform === 'discord' &&
      this.deps.discordSurfacePolicyService.canUseOperationalCommand(String(ctx.userId || '').trim(), {
        isDirectMessage: !ctx.isGroup,
      });
    const shortcuts =
      ctx.platform === 'discord' && !isDiscordOperationalOwner
        ? 'Useful shortcuts: /help and /task.'
        : 'Useful shortcuts: /help, /changes, /reload, /autorepair.';

    const lines = [
      'Zavorth overview',
      '',
      `Now: online for ${uptimeText}.`,
      `Current usage: RSS ${snapshot.process.rssMb} MB | heap ${snapshot.process.heapMb} MB.`,
      `Active processes: host ${hostPid || 'unavailable'} | worker ${workerPid || 'unavailable'}.`,
      `${discordLabel}: ${snapshot.runtime.discordBridge.started ? 'active' : 'pending'}${
        snapshot.runtime.discordBridge.lastError ? ` | last error: ${snapshot.runtime.discordBridge.lastError}` : ''
      }.`,
      `Tasks in progress: ${snapshot.tasks.activeCount} | stale backlog: ${snapshot.tasks.staleCount}.`,
      `Environment: ${snapshot.process.platform} / ${snapshot.process.cpuArch}.`,
      '',
      shortcuts,
    ];

    if (lastFailure) {
      lines.push(
        '',
        `Last alert: ${lastFailure.executor || lastFailure.commandType || 'unknown executor'} | task ${lastFailure.taskId.substring(0, 8)}.`,
        `Reason: ${String(lastFailure.errorSummary || 'no summary').substring(0, 120)}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Free-text product features are model-owned (agent-first).
   * Maintenance actions use slash/CLI only (`/reload`, `/autorepair`, status packs).
   * Kept as a no-op stub for API compatibility — never keyword-routes free text.
   */
  public parseRuntimeMaintenanceIntent(_rawText: string): RuntimeMaintenanceIntent | null {
    return null;
  }
}
