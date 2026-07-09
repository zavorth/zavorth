import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthMemoryPlaneSnapshot } from '../../../../services/ZavorthMemoryPlaneService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthSessionPlaneSnapshot } from '../../../../services/ZavorthSessionPlaneService.js';
import type { ZavorthTeamCatalogService } from '../../../../services/ZavorthTeamCatalogService.js';
import type { ZavorthTenantGovernanceActionService } from '../../../../services/ZavorthTenantGovernanceActionService.js';
import type { ZavorthTenantGovernanceService } from '../../../../services/ZavorthTenantGovernanceService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
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
    const normalizedArgs = String(args || '').trim();
    const actionSnapshot = this.deps.tenantGovernanceService.buildSnapshot();
    const explicitActionRequest = this.resolveExplicitTenantActionRequest(actionSnapshot, normalizedArgs);
    if (explicitActionRequest?.error) {
      await ctx.reply(explicitActionRequest.error);
      return;
    }
    if (explicitActionRequest) {
      await this.handleTenantAction(ctx, explicitActionRequest.tenantId, explicitActionRequest.actionId);
      return;
    }
    const implicitActionRequest = this.resolveImplicitTenantActionRequest(actionSnapshot, normalizedArgs);
    if (implicitActionRequest) {
      await this.handleTenantAction(ctx, implicitActionRequest.tenantId, implicitActionRequest.actionId);
      return;
    }

    const query = String(args || '').trim().toLowerCase();
    const snapshot = this.deps.tenantGovernanceService.buildSnapshot();
    const tenants = query
      ? snapshot.tenants.filter((tenant) =>
        String(tenant.tenantId || '').toLowerCase().includes(query)
        || String(tenant.platform || '').toLowerCase().includes(query)
        || String(tenant.scopeLabel || '').toLowerCase().includes(query))
      : snapshot.tenants;

    if (query && tenants.length === 0) {
      await ctx.reply(`Nao encontrei tenant para "${query}". Use /tenants para ver a governanca completa observada pelo runtime.`);
      return;
    }

    const lines = [
      'Governanca de tenants do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      snapshot.narrative.nextAction,
      '',
      `Totais: ${snapshot.summary.total} tenant(s) | compartilhados: ${snapshot.summary.shared} | pessoais: ${snapshot.summary.personal}.`,
      `Pendentes: ${snapshot.summary.pendingOnboarding} | publicos: ${snapshot.summary.publicServers} | shared prontos: ${snapshot.summary.readyShared}.`,
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
        lines.push(`- Contexto: ${contextBits.join(' | ')}`);
      }
      if (tenant.recipe) {
        lines.push(`- Recipe: ${tenant.recipe.label} | ${tenant.recipe.summary}`);
      }
      if (tenant.nextAction) {
        lines.push(`- Proximo passo: ${tenant.nextAction}`);
      }
      for (const action of tenant.actions.slice(0, 4)) {
        const textualHint = action.actionKind === 'guided'
          ? ` | via /tenants run ${tenant.tenantId} ${action.id}`
          : '';
        lines.push(`- [${action.actionKind}] ${action.label}: ${action.command}${textualHint}`);
      }
    }

    await ctx.reply(lines.join('\n'));
  }

  private buildTeamsReply(args: string, snapshot = this.deps.teamCatalogService.buildSnapshot()): string {
    const selectedId = String(args || '').trim().toLowerCase() || null;
    const teams = selectedId
      ? snapshot.teams.filter((team) => String(team.id || '').trim().toLowerCase() === selectedId)
      : snapshot.teams;

    if (selectedId && teams.length === 0) {
      return `Nao encontrei um team com id "${selectedId}". Use /teams para ver os fluxos compostos disponiveis.`;
    }

    const lines = [
      'Teams e workflows compostos do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
    ];

    for (const team of teams.slice(0, 4)) {
      lines.push(
        '',
        `${team.label} (${team.id})`,
        team.summary,
        `Entrada: ${team.entryCommand}`,
        `Status: ${team.status} | runs: ${team.runStats.total} | retomadas: ${team.runStats.resumable}.`,
      );
      for (const surface of team.surfaces.slice(0, 4)) {
        lines.push(`- ${surface.label}: ${surface.status} | ${surface.summary}`);
      }
      lines.push(team.operatorSummary);
    }

    return lines.join('\n');
  }

  private buildTenantsReply(
    rawArgs: string,
    snapshot = this.deps.tenantGovernanceService.buildSnapshot(),
  ): string {
    const query = String(rawArgs || '').trim().toLowerCase();
    const tenants = query
      ? snapshot.tenants.filter((tenant) =>
          String(tenant.tenantId || '').toLowerCase().includes(query)
          || String(tenant.platform || '').toLowerCase().includes(query)
          || String(tenant.scopeLabel || '').toLowerCase().includes(query))
      : snapshot.tenants;

    if (query && tenants.length === 0) {
      return `Nao encontrei tenant para "${query}". Use /tenants para ver a governanca completa observada pelo runtime.`;
    }

    const lines = [
      'Governanca de tenants do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      snapshot.narrative.nextAction,
      '',
      `Totais: ${snapshot.summary.total} tenant(s) | compartilhados: ${snapshot.summary.shared} | pessoais: ${snapshot.summary.personal}.`,
      `Pendentes: ${snapshot.summary.pendingOnboarding} | publicos: ${snapshot.summary.publicServers} | shared prontos: ${snapshot.summary.readyShared}.`,
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
        lines.push(`- Contexto: ${contextBits.join(' | ')}`);
      }
      if (tenant.recipe) {
        lines.push(`- Recipe: ${tenant.recipe.label} | ${tenant.recipe.summary}`);
      }
      if (tenant.nextAction) {
        lines.push(`- Proximo passo: ${tenant.nextAction}`);
      }
      for (const action of tenant.actions.slice(0, 4)) {
        const textualHint = action.actionKind === 'guided'
          ? ` | via /tenants run ${tenant.tenantId} ${action.id}`
          : '';
        lines.push(`- [${action.actionKind}] ${action.label}: ${action.command}${textualHint}`);
      }
    }

    return lines.join('\n');
  }

  private resolveExplicitTenantActionRequest(
    snapshot: ReturnType<ZavorthTenantGovernanceService['buildSnapshot']>,
    rawArgs: string,
  ): { tenantId: string; actionId: string; error?: string } | null {
    const tokens = String(rawArgs || '').trim().split(/\s+/).filter(Boolean);
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

    const tenant = snapshot.tenants.find((entry) => String(entry.tenantId || '').trim().toLowerCase() === tokens[1].toLowerCase());
    if (!tenant) {
      return {
        tenantId: '',
        actionId: '',
        error: `Tenant "${tokens[1]}" nao encontrado. Use /tenants para ver os ids observados pelo runtime.`,
      };
    }

    const action = tenant.actions.find((entry) => String(entry.id || '').trim().toLowerCase() === tokens[2].toLowerCase());
    if (!action) {
      const available = tenant.actions.map((entry) => entry.id).join(', ') || 'nenhuma acao guiada registrada';
      return {
        tenantId: tenant.tenantId,
        actionId: '',
        error: `A acao "${tokens[2]}" nao existe para o tenant ${tenant.tenantId}. Acoes disponiveis: ${available}.`,
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
    const tokens = String(rawArgs || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens[0]?.toLowerCase() === 'run') {
      return null;
    }

    const tenant = snapshot.tenants.find((entry) => String(entry.tenantId || '').trim().toLowerCase() === tokens[0].toLowerCase());
    if (!tenant) {
      return null;
    }

    const action = tenant.actions.find((entry) => String(entry.id || '').trim().toLowerCase() === tokens[1].toLowerCase());
    if (!action) {
      return null;
    }

    return {
      tenantId: tenant.tenantId,
      actionId: action.id,
    };
  }

  private async handleTenantAction(
    ctx: IMessageContext,
    tenantId: string,
    actionId: string,
  ): Promise<void> {
    try {
      const result = await this.deps.tenantGovernanceActionService.execute({
        tenantId,
        actionId: actionId as any,
        workspace: process.cwd(),
      });
      await ctx.reply(this.buildTenantActionReply(tenantId, actionId, result));
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui executar a acao guiada do tenant agora.'));
    }
  }

  private buildTenantActionReply(
    tenantId: string,
    actionId: string,
    result: Awaited<ReturnType<ZavorthTenantGovernanceActionService['execute']>>,
  ): string {
    const preamble = [
      `Acao guiada do tenant ${tenantId}: ${result.action.label}.`,
      result.action.note,
    ];

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

    const replyLines = result.action.replies && result.action.replies.length > 0
      ? ['', 'Saida do workflow:', ...result.action.replies.map((entry) => `- ${entry}`)]
      : [];
    return [...preamble, ...replyLines].join('\n');
  }

  private resolveTenantChannelSelectionId(
    snapshot: ReturnType<ZavorthTenantGovernanceService['buildSnapshot']>,
    tenantId: string,
  ): string | null {
    const tenant = snapshot.tenants.find((entry) => String(entry.tenantId || '').trim() === tenantId);
    const normalizedPlatform = String(tenant?.platform || '').trim().toLowerCase();
    if (['discord', 'telegram', 'web'].includes(normalizedPlatform)) {
      return normalizedPlatform;
    }
    return null;
  }

  private formatMemoryPlaneSnapshot(snapshot: ZavorthMemoryPlaneSnapshot): string {
    const lines = [
      'Retomada e entregas do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Memorias persistentes: ${snapshot.summary.persistedMemories}.`,
      `Replay visivel: ${snapshot.summary.replayTasks} tarefa(s) | ${snapshot.summary.workflowRuns} workflow(s).`,
      `Entregas recentes: ${snapshot.summary.artifacts}.`,
    ];

    if (snapshot.artifacts.recent.length > 0) {
      lines.push('', 'Entregas em foco:');
      for (const artifact of snapshot.artifacts.recent.slice(0, 3)) {
        lines.push(`- ${artifact.label}: ${artifact.summary || artifact.path || 'Sem resumo adicional.'}`);
      }
    }

    if (snapshot.memory.relevant.length > 0) {
      lines.push('', 'Memorias relevantes:');
      for (const entry of snapshot.memory.relevant.slice(0, 3)) {
        lines.push(`- ${entry.key}: ${entry.value}`);
      }
    }

    if (snapshot.suggestedActions.length > 0) {
      lines.push('', 'Proximo passo:');
      for (const action of snapshot.suggestedActions.slice(0, 3)) {
        lines.push(`- ${action.label}: ${action.command}`);
      }
    }

    return lines.join('\n');
  }

  private formatSessionPlaneSnapshot(snapshot: ZavorthSessionPlaneSnapshot): string {
    const lines = [
      'Session plane do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Sessoes visiveis: ${snapshot.sessions.entries.length} de ${snapshot.sessions.total}.`,
      `Historico atual: ${snapshot.summary.historyItems} item(ns) | approvals pendentes: ${snapshot.summary.pendingPermissions}.`,
      `Envio cruzado: ${snapshot.summary.sendReady ? 'pronto' : 'parcial'} | spawn web: ${snapshot.summary.spawnReady ? 'pronto' : 'parcial'}.`,
    ];

    if (snapshot.store.target) {
      lines.push(
        '',
        `Target: ${snapshot.store.target.platform}:${snapshot.store.target.chatId || 'n/d'}`,
        `Sessao canonica: ${snapshot.store.target.sessionId || 'n/d'}.`,
      );
    }

    if (snapshot.sessions.entries.length > 0) {
      lines.push('', 'Sessoes em foco:');
      for (const session of snapshot.sessions.entries.slice(0, 3)) {
        lines.push(`- ${session.platform}:${session.chatId} | ${session.latestTaskLabel || session.label}`);
      }
    }

    return lines.join('\n');
  }

}
