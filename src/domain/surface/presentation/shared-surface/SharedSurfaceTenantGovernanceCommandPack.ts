import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthMemoryPlaneSnapshot } from '../../../../services/ZavorthMemoryPlaneService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthSessionPlaneSnapshot } from '../../../../services/ZavorthSessionPlaneService.js';
import type { ZavorthTeamCatalogService } from '../../../../services/ZavorthTeamCatalogService.js';
import type { ZavorthTenantGovernanceActionService } from '../../../../services/ZavorthTenantGovernanceActionService.js';
import type { ZavorthTenantGovernanceService } from '../../../../services/ZavorthTenantGovernanceService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
type SharedSurfaceTenantGovernanceCommandPackDeps = {
  teamCatalogService: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;

  tenantGovernanceService: Pick<ZavorthTenantGovernanceService, 'buildSnapshot'>;
  tenantGovernanceActionService: Pick<ZavorthTenantGovernanceActionService, 'execute'>;
  channelMeshService: Pick<ZavorthChannelMeshService, 'renderReport'>;
  formatSecurityMeshReply: () => string;
};

export class SharedSurfaceTenantGovernanceCommandPack {
  public constructor(private readonly deps: SharedSurfaceTenantGovernanceCommandPackDeps) {}

  public async handleTeams(ctx: IMessageContext, args: string): Promise<void> {
    await ctx.reply(this.buildTeamsReply(String(args || '').trim()));
  }

  public async handleTenants(ctx: IMessageContext, args: string): Promise<void> {
    // NaturalSlashConvention rewrites empty `/tenants` → `status` (home). Treat as no filter.
    const normalizedArgs = String(args || '').trim();
    const homeArgs = !normalizedArgs || /^(status|show|open|ver|mostrar)$/i.test(normalizedArgs);
    const actionArgs = homeArgs ? '' : normalizedArgs;
    const actionSnapshot = this.deps.tenantGovernanceService.buildSnapshot();
    const explicitActionRequest = this.resolveExplicitTenantActionRequest(actionSnapshot, actionArgs);
    if (explicitActionRequest?.error) {
      await ctx.reply(explicitActionRequest.error);
      return;
    }
    if (explicitActionRequest) {
      await this.handleTenantAction(ctx, explicitActionRequest.tenantId, explicitActionRequest.actionId);
      return;
    }
    const implicitActionRequest = this.resolveImplicitTenantActionRequest(actionSnapshot, actionArgs);
    if (implicitActionRequest) {
      await this.handleTenantAction(ctx, implicitActionRequest.tenantId, implicitActionRequest.actionId);
      return;
    }

    const query = homeArgs ? '' : actionArgs.toLowerCase();
    const snapshot = this.deps.tenantGovernanceService.buildSnapshot();
    const tenants = query
      ? snapshot.tenants.filter(
          (tenant) =>
            String(tenant.tenantId || '')
              .toLowerCase()
              .includes(query) ||
            String(tenant.platform || '')
              .toLowerCase()
              .includes(query) ||
            String(tenant.scopeLabel || '')
              .toLowerCase()
              .includes(query),
        )
      : snapshot.tenants;

    if (query && tenants.length === 0) {
      await ctx.reply(`No tenant found for "${query}". Use /tenants to see full governance observed by the runtime.`);
      return;
    }

    const lines = [
      'Zavorth tenant governance',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      snapshot.narrative.nextAction,
      '',
      `Totals: ${snapshot.summary.total} tenant(s) | shared: ${snapshot.summary.shared} | personal: ${snapshot.summary.personal}.`,
      `Pending: ${snapshot.summary.pendingOnboarding} | public: ${snapshot.summary.publicServers} | shared ready: ${snapshot.summary.readyShared}.`,
    ];

    for (const tenant of tenants.slice(0, 6)) {
      lines.push(
        '',
        `${tenant.platform} • ${tenant.governanceStatus}`,
        `${tenant.tenantId} (${tenant.scopeLabel})`,
        tenant.operatorSummary,
      );
      const contextBits = [
        tenant.sessionId ? `session ${tenant.sessionId}` : null,
        tenant.sourceUserId ? `source ${tenant.sourceUserId}` : null,
        tenant.runtimeUserId ? `runtime ${tenant.runtimeUserId}` : null,
      ].filter(Boolean);
      if (contextBits.length > 0) {
        lines.push(`- Context: ${contextBits.join(' | ')}`);
      }
      if (tenant.recipe) {
        lines.push(`- Recipe: ${tenant.recipe.label} | ${tenant.recipe.summary}`);
      }
      if (tenant.nextAction) {
        lines.push(`- Next: ${tenant.nextAction}`);
      }
      for (const action of tenant.actions.slice(0, 4)) {
        const textualHint = action.actionKind === 'guided' ? ` | via /tenants run ${tenant.tenantId} ${action.id}` : '';
        lines.push(`- [${action.actionKind}] ${action.label}: ${action.command}${textualHint}`);
      }
    }

    await ctx.reply(lines.join('\n'));
  }

  private buildTeamsReply(args: string, snapshot = this.deps.teamCatalogService.buildSnapshot()): string {
    // NaturalSlashConvention rewrites empty `/teams` → `status` (home). Treat control verbs as full catalog.
    const raw = String(args || '')
      .trim()
      .toLowerCase();
    const selectedId = !raw || /^(status|list|show|open|help|home)$/i.test(raw) ? null : raw;
    const teams = selectedId
      ? snapshot.teams.filter(
          (team) =>
            String(team.id || '')
              .trim()
              .toLowerCase() === selectedId,
        )
      : snapshot.teams;

    if (selectedId && teams.length === 0) {
      return `No team found with id "${selectedId}". Use /teams to see available composite flows.`;
    }

    const lines = [
      'Zavorth composite teams and workflows',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
    ];

    for (const team of teams.slice(0, 4)) {
      lines.push(
        '',
        `${team.label} (${team.id})`,
        team.summary,
        `Entry: ${team.entryCommand}`,
        `Status: ${team.status} | runs: ${team.runStats.total} | resumable: ${team.runStats.resumable}.`,
      );
      for (const surface of team.surfaces.slice(0, 4)) {
        lines.push(`- ${surface.label}: ${surface.status} | ${surface.summary}`);
      }
      lines.push(team.operatorSummary);
    }

    return lines.join('\n');
  }

  private buildTenantsReply(rawArgs: string, snapshot = this.deps.tenantGovernanceService.buildSnapshot()): string {
    const query = String(rawArgs || '')
      .trim()
      .toLowerCase();
    const tenants = query
      ? snapshot.tenants.filter(
          (tenant) =>
            String(tenant.tenantId || '')
              .toLowerCase()
              .includes(query) ||
            String(tenant.platform || '')
              .toLowerCase()
              .includes(query) ||
            String(tenant.scopeLabel || '')
              .toLowerCase()
              .includes(query),
        )
      : snapshot.tenants;

    if (query && tenants.length === 0) {
      return `No tenant found for "${query}". Use /tenants to see full governance observed by the runtime.`;
    }

    const lines = [
      'Zavorth tenant governance',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      snapshot.narrative.nextAction,
      '',
      `Totals: ${snapshot.summary.total} tenant(s) | shared: ${snapshot.summary.shared} | personal: ${snapshot.summary.personal}.`,
      `Pending: ${snapshot.summary.pendingOnboarding} | public: ${snapshot.summary.publicServers} | shared ready: ${snapshot.summary.readyShared}.`,
    ];

    for (const tenant of tenants.slice(0, 6)) {
      lines.push(
        '',
        `${tenant.platform} - ${tenant.governanceStatus}`,
        `${tenant.tenantId} (${tenant.scopeLabel})`,
        tenant.operatorSummary,
      );
      const contextBits = [
        tenant.sessionId ? `session ${tenant.sessionId}` : null,
        tenant.sourceUserId ? `source ${tenant.sourceUserId}` : null,
        tenant.runtimeUserId ? `runtime ${tenant.runtimeUserId}` : null,
      ].filter(Boolean);
      if (contextBits.length > 0) {
        lines.push(`- Context: ${contextBits.join(' | ')}`);
      }
      if (tenant.recipe) {
        lines.push(`- Recipe: ${tenant.recipe.label} | ${tenant.recipe.summary}`);
      }
      if (tenant.nextAction) {
        lines.push(`- Next step: ${tenant.nextAction}`);
      }
      for (const action of tenant.actions.slice(0, 4)) {
        const textualHint = action.actionKind === 'guided' ? ` | via /tenants run ${tenant.tenantId} ${action.id}` : '';
        lines.push(`- [${action.actionKind}] ${action.label}: ${action.command}${textualHint}`);
      }
    }

    return lines.join('\n');
  }

  private resolveExplicitTenantActionRequest(
    snapshot: ReturnType<ZavorthTenantGovernanceService['buildSnapshot']>,
    rawArgs: string,
  ): { tenantId: string; actionId: string; error?: string } | null {
    const tokens = String(rawArgs || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens[0]?.toLowerCase() !== 'run') {
      return null;
    }
    if (tokens.length < 3) {
      return {
        tenantId: '',
        actionId: '',
        error: 'Use /tenants run <tenantId> <actionId>. Ex.: /tenants run discord-public review-channels',
      };
    }

    const tenant = snapshot.tenants.find(
      (entry) =>
        String(entry.tenantId || '')
          .trim()
          .toLowerCase() === tokens[1].toLowerCase(),
    );
    if (!tenant) {
      return {
        tenantId: '',
        actionId: '',
        error: `Tenant "${tokens[1]}" not found. Use /tenants to see ids observed by the runtime.`,
      };
    }

    const action = tenant.actions.find(
      (entry) =>
        String(entry.id || '')
          .trim()
          .toLowerCase() === tokens[2].toLowerCase(),
    );
    if (!action) {
      const available = tenant.actions.map((entry) => entry.id).join(', ') || 'no guided action registered';
      return {
        tenantId: tenant.tenantId,
        actionId: '',
        error: `Action "${tokens[2]}" does not exist for tenant ${tenant.tenantId}. Available actions: ${available}.`,
      };
    }

    return {
      tenantId: tenant.tenantId,
      actionId: action.id,
    };
  }

  private resolveImplicitTenantActionRequest(
    snapshot: ReturnType<ZavorthTenantGovernanceService['buildSnapshot']>,
    rawArgs: string,
  ): { tenantId: string; actionId: string } | null {
    const tokens = String(rawArgs || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length < 2 || tokens[0]?.toLowerCase() === 'run') {
      return null;
    }

    const tenant = snapshot.tenants.find(
      (entry) =>
        String(entry.tenantId || '')
          .trim()
          .toLowerCase() === tokens[0].toLowerCase(),
    );
    if (!tenant) {
      return null;
    }

    const action = tenant.actions.find(
      (entry) =>
        String(entry.id || '')
          .trim()
          .toLowerCase() === tokens[1].toLowerCase(),
    );
    if (!action) {
      return null;
    }

    return {
      tenantId: tenant.tenantId,
      actionId: action.id,
    };
  }

  private async handleTenantAction(ctx: IMessageContext, tenantId: string, actionId: string): Promise<void> {
    try {
      const result = await this.deps.tenantGovernanceActionService.execute({
        tenantId,
        actionId: actionId as any,
        workspace: process.cwd(),
      });
      await ctx.reply(this.buildTenantActionReply(tenantId, actionId, result));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_tenant_action')));
    }
  }

  private buildTenantActionReply(
    tenantId: string,
    actionId: string,
    result: Awaited<ReturnType<ZavorthTenantGovernanceActionService['execute']>>,
  ): string {
    const preamble = [`Guided tenant action ${tenantId}: ${result.action.label}.`, result.action.note];

    if (actionId === 'inspect-tenant') {
      return [...preamble, '', this.buildTenantsReply(tenantId, result.tenantGovernance)].join('\n');
    }
    if (actionId === 'review-teams') {
      return [...preamble, '', this.buildTeamsReply('', result.teams || undefined)].join('\n');
    }
    if (actionId === 'review-channels') {
      return [
        ...preamble,
        '',
        this.deps.channelMeshService.renderReport({
          selectedId: this.resolveTenantChannelSelectionId(result.tenantGovernance, tenantId),
        }),
      ].join('\n');
    }
    if (actionId === 'review-runtime') {
      return [...preamble, '', this.deps.formatSecurityMeshReply()].join('\n');
    }
    if (actionId === 'review-memoryplane' && result.memoryPlane) {
      return [...preamble, '', this.formatMemoryPlaneSnapshot(result.memoryPlane)].join('\n');
    }
    if (actionId === 'review-sessions' && result.sessionPlane) {
      return [...preamble, '', this.formatSessionPlaneSnapshot(result.sessionPlane)].join('\n');
    }

    const replyLines =
      result.action.replies && result.action.replies.length > 0
        ? ['', 'Workflow output:', ...result.action.replies.map((entry) => `- ${entry}`)]
        : [];
    return [...preamble, ...replyLines].join('\n');
  }

  private resolveTenantChannelSelectionId(
    snapshot: ReturnType<ZavorthTenantGovernanceService['buildSnapshot']>,
    tenantId: string,
  ): string | null {
    const tenant = snapshot.tenants.find((entry) => String(entry.tenantId || '').trim() === tenantId);
    const normalizedPlatform = String(tenant?.platform || '')
      .trim()
      .toLowerCase();
    if (['discord', 'telegram', 'web'].includes(normalizedPlatform)) {
      return normalizedPlatform;
    }
    return null;
  }

  private formatMemoryPlaneSnapshot(snapshot: ZavorthMemoryPlaneSnapshot): string {
    const lines = [
      'Zavorth resume and deliveries',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Persisted memories: ${snapshot.summary.persistedMemories}.`,
      `Visible replay: ${snapshot.summary.replayTasks} task(s) | ${snapshot.summary.workflowRuns} workflow(s).`,
      `Recent deliveries: ${snapshot.summary.artifacts}.`,
    ];

    if (snapshot.artifacts.recent.length > 0) {
      lines.push('', 'Deliveries in focus:');
      for (const artifact of snapshot.artifacts.recent.slice(0, 3)) {
        lines.push(`- ${artifact.label}: ${artifact.summary || artifact.path || 'No extra summary.'}`);
      }
    }

    if (snapshot.memory.relevant.length > 0) {
      lines.push('', 'Relevant memories:');
      for (const entry of snapshot.memory.relevant.slice(0, 3)) {
        lines.push(`- ${entry.key}: ${entry.value}`);
      }
    }

    if (snapshot.suggestedActions.length > 0) {
      lines.push('', 'Next step:');
      for (const action of snapshot.suggestedActions.slice(0, 3)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    return lines.join('\n');
  }

  private formatSessionPlaneSnapshot(snapshot: ZavorthSessionPlaneSnapshot): string {
    const lines = [
      'Zavorth session plane',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Visible sessions: ${snapshot.sessions.entries.length} of ${snapshot.sessions.total}.`,
      `Current history: ${snapshot.summary.historyItems} item(s) | approvals pending: ${snapshot.summary.pendingPermissions}.`,
      `Cross send: ${snapshot.summary.sendReady ? 'ready' : 'partial'} | web spawn: ${snapshot.summary.spawnReady ? 'ready' : 'partial'}.`,
    ];

    if (snapshot.store.target) {
      lines.push(
        '',
        `Target: ${snapshot.store.target.platform}:${snapshot.store.target.chatId || 'n/a'}`,
        `Canonical session: ${snapshot.store.target.sessionId || 'n/a'}.`,
      );
    }

    if (snapshot.sessions.entries.length > 0) {
      lines.push('', 'Sessions in focus:');
      for (const session of snapshot.sessions.entries.slice(0, 3)) {
        lines.push(`- ${session.platform}:${session.chatId} | ${session.latestTaskLabel || session.label}`);
      }
    }

    return lines.join('\n');
  }
}
