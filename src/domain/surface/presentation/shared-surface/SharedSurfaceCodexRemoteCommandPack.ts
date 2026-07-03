import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import type { CodexRemoteActionService } from '../../../../services/CodexRemoteActionService.js';
import type { CodexRemoteControlPlaneService } from '../../../../services/CodexRemoteControlPlaneService.js';

type CodexRemoteActionResult = Awaited<ReturnType<CodexRemoteActionService['execute']>>;

type CodexRemoteControlPlaneLike = Pick<CodexRemoteControlPlaneService, 'buildSnapshot'>;
type CodexRemoteActionLike = Pick<CodexRemoteActionService, 'execute'>;
type CodexRemoteSessionPlaneLike = Pick<ZavorthSessionPlaneService, 'spawnSession'> | null;

type PermissionKeyboardMarkup = Record<string, unknown>;

type SharedSurfaceCodexRemoteCommandPackDeps = {
  controlPlaneService: CodexRemoteControlPlaneLike;
  actionService: CodexRemoteActionLike;
  sessionPlaneService: CodexRemoteSessionPlaneLike;
  formatPermissionCreatedMessage?: ((permission: PermissionRequest) => string) | null;
  buildPermissionKeyboard?: ((permission: PermissionRequest) => PermissionKeyboardMarkup) | null;
};

export class SharedSurfaceCodexRemoteCommandPack {
  public constructor(private readonly deps: SharedSurfaceCodexRemoteCommandPackDeps) {}

  public async handle(ctx: IMessageContext, args: string): Promise<void> {
    try {
      const normalizedArgs = String(args || '').trim();
      const request = this.parseCodexRemoteRequest(normalizedArgs);

      if (request.mode === 'status' || request.mode === 'help') {
        const snapshot = await this.deps.controlPlaneService.buildSnapshot({
          runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        });
        const lines = [
          'Codex Remote',
          '',
          snapshot.narrative.headline,
          snapshot.narrative.operatorSummary,
          snapshot.narrative.nextAction,
          '',
          `Perfil ativo: ${snapshot.activeProfile.label} (${snapshot.activeProfile.id}).`,
          `CLI pronto: ${snapshot.summary.cliReady ? 'sim' : 'nao'}.`,
          `Sessoes rastreadas: ${snapshot.summary.trackedSessions} | em execucao: ${snapshot.summary.runningSessions}.`,
          `Visibilidade: ${snapshot.visibility.mode} | aprovacoes pendentes: ${snapshot.visibility.pendingApprovals}.`,
          snapshot.visibility.note,
          `Transportes remotos prontos: ${snapshot.summary.readyRemotePaths}/${snapshot.remotePaths.length}.`,
          '',
          snapshot.sessionBroker.telegramSummary,
        ];
        await ctx.reply(lines.join('\n'));
        return;
      }

    if (request.mode === 'profiles') {
      const snapshot = await this.deps.controlPlaneService.buildSnapshot({
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
      });
      const lines = [
        'Perfis do Codex Remote',
        '',
        snapshot.profiles.narrative.headline,
        snapshot.profiles.narrative.operatorSummary,
        `Saude do registry: ${snapshot.profiles.health.status}.`,
        snapshot.profiles.health.operatorSummary,
        `Readiness: ${snapshot.profiles.readiness.status}.`,
        snapshot.profiles.readiness.operatorSummary,
      ];
      for (const profile of snapshot.profiles.profiles) {
        lines.push(
          '',
          `${profile.active ? 'ativo' : 'perfil'}: ${profile.label} (${profile.id})`,
          profile.description,
          `CLI: ${profile.codexCliPath}`,
          `CODEX_HOME: ${profile.codexHome || 'n/d'}`,
          `Workspace: ${profile.workspaceRoot || 'n/d'}`,
          `Habilitado: ${profile.enabled ? 'sim' : 'nao'}`,
        );
      }
      lines.push(
        '',
        'Gestao de perfis:',
        '/codexremote profile create <id> -- {"label":"Work","codexHome":"C:\\\\Users\\\\...\\\\.codex-work","workspaceRoot":"C:\\\\repo"}',
        '/codexremote profile update <id> -- {"label":"Work","codexHome":"C:\\\\Users\\\\...\\\\.codex-work"}',
        '/codexremote profile delete <id>',
      );
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (request.mode === 'profile') {
      const result = await this.deps.actionService.execute({
        actionId: 'select-profile',
        profileId: request.profileId,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result, [
        `Perfil ativo agora: ${result.codexRemote.activeProfile.label}.`,
        result.codexRemote.sessionBroker.telegramSummary,
      ]);
      return;
    }

    if (request.mode === 'profile-create' || request.mode === 'profile-update') {
      const payload = this.parseCodexRemoteProfilePayload(request.prompt);
      const result = await this.deps.actionService.execute({
        actionId: request.mode === 'profile-create' ? 'create-profile' : 'update-profile',
        profileId: request.profileId,
        profileLabel: payload.profileLabel,
        profileDescription: payload.profileDescription,
        codexCliPath: payload.codexCliPath,
        codexHome: payload.codexHome,
        workspaceRoot: payload.workspaceRoot,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'profile-delete') {
      const result = await this.deps.actionService.execute({
        actionId: 'delete-profile',
        profileId: request.profileId,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'start') {
      const result = await this.deps.actionService.execute({
        actionId: 'start-session',
        title: request.title,
        prompt: request.prompt,
        profileId: request.profileId,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'approvals') {
      const snapshot = await this.deps.controlPlaneService.buildSnapshot({
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
      });
      if (snapshot.sessionBroker.approvals.length === 0) {
        await ctx.reply([
          'Aprovacoes do Codex Remote',
          '',
          'Nenhuma aprovacao pendente no momento.',
        ].join('\n'));
        return;
      }
      const lines: Array<string | null> = [
        'Aprovacoes do Codex Remote',
        '',
        `Pendentes: ${snapshot.sessionBroker.approvals.length}.`,
      ];
      for (const approval of snapshot.sessionBroker.approvals.slice(0, 8)) {
        lines.push(
          '',
          `${approval.permissionId}`,
          `Kind: ${approval.kind}.`,
          approval.actionId ? `Acao: ${approval.actionId}.` : null,
          approval.sessionId ? `Sessao: ${approval.sessionId}.` : null,
          approval.profileId ? `Perfil: ${approval.profileId}.` : null,
          approval.reason,
        );
      }
      await ctx.reply(lines.filter(Boolean).join('\n'));
      return;
    }

    if (request.mode === 'sessions') {
      const snapshot = await this.deps.controlPlaneService.buildSnapshot({
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
      });
      const sessions = snapshot.sessionBroker.sessions;
      if (sessions.length === 0) {
        await ctx.reply([
          'Codex Remote',
          '',
          'Nenhuma sessao rastreada ainda.',
          'Use /codexremote start [titulo] -- <prompt> para abrir a primeira.',
        ].join('\n'));
        return;
      }

      const lines = [
        'Sessoes do Codex Remote',
        '',
        snapshot.sessionBroker.narrative.headline,
      ];
      for (const session of sessions.slice(0, 8)) {
        lines.push(
          '',
          `${session.title} (${session.sessionId})`,
          `Status: ${session.status} | perfil: ${session.profileLabel} | runs: ${session.runCount}.`,
          session.operatorSummary,
          `Acoes: ${session.actions.join(', ')}.`,
        );
      }
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (request.mode === 'inspect' || request.mode === 'tail') {
      const snapshot = await this.deps.controlPlaneService.buildSnapshot({
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        selectedSessionId: request.sessionId,
      });
      const selected = snapshot.sessionBroker.selected;
      if (!selected) {
        await ctx.reply(`Sessao Codex Remote nao encontrada: ${request.sessionId}.`);
        return;
      }
      const lines = [
        `${selected.record.title} (${selected.record.sessionId})`,
        '',
        selected.operatorSummary,
        `Prompt: ${selected.record.prompt}`,
        `Visibilidade: ${selected.visibility.mode} | aprovacoes pendentes: ${selected.visibility.pendingApprovals}.`,
        selected.visibility.note,
        `Handoff web: ${selected.record.handoffCommand || 'nenhum ainda'}`,
      ];
      if (request.mode === 'tail') {
        lines.push('', 'Tail recente:');
        lines.push(...(selected.tail.logLines.length > 0 ? selected.tail.logLines : ['Sem log recente.']));
      } else {
        lines.push('', 'Eventos recentes:');
        lines.push(...selected.record.events.slice(-8).map((event) => `- ${event.at} | ${event.type}: ${event.message}`));
      }
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (request.mode === 'resume') {
      const result = await this.deps.actionService.execute({
        actionId: 'resume-session',
        sessionId: request.sessionId,
        prompt: request.prompt,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'approve') {
      const result = await this.deps.actionService.execute({
        actionId: 'approve-permission',
        permissionId: request.permissionId,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'reject') {
      const result = await this.deps.actionService.execute({
        actionId: 'reject-permission',
        permissionId: request.permissionId,
        decisionNote: request.prompt,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

    if (request.mode === 'stop') {
      const result = await this.deps.actionService.execute({
        actionId: 'stop-session',
        sessionId: request.sessionId,
        runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
        sourceSurface: ctx.platform,
        sourceChatId: String(ctx.chatId || '').trim() || null,
      });
      await this.replyCodexRemoteResult(ctx, result);
      return;
    }

      if (request.mode === 'web') {
        const result = await this.deps.actionService.execute({
          actionId: request.sessionId ? 'open-web-session' : 'spawn-web-session',
          sessionId: request.sessionId,
          runtimeUserId: String(ctx.userId || '').trim() || 'telegram',
          sourceSurface: ctx.platform,
          sourceChatId: String(ctx.chatId || '').trim() || null,
          sessionSpawner: this.deps.sessionPlaneService
            ? {
              spawnSession: ({ userId, platform }) => this.deps.sessionPlaneService!.spawnSession({
                userId,
                platform,
              }),
            }
            : null,
        });
        const lines = [
          result.action.note,
          result.action.handoffCommand ? `Comando de handoff: ${result.action.handoffCommand}` : null,
          result.spawnedSession?.sessionId ? `Session web: ${result.spawnedSession.sessionId}` : null,
        ].filter(Boolean) as string[];
        await ctx.reply(lines.join('\n'));
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      await ctx.reply(`Nao consegui operar o Codex Remote agora.\n\nMotivo: ${message}`);
    }
  }


  private parseCodexRemoteRequest(rawArgs: string): {
    mode: 'status' | 'help' | 'profiles' | 'profile' | 'profile-create' | 'profile-update' | 'profile-delete' | 'approvals' | 'approve' | 'reject' | 'start' | 'sessions' | 'inspect' | 'tail' | 'resume' | 'stop' | 'web';
    profileId: string | null;
    sessionId: string | null;
    permissionId: string | null;
    prompt: string | null;
    title: string | null;
  } {
    const normalized = String(rawArgs || '').trim();
    if (!normalized) {
      return { mode: 'status', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
    }

    const separatorIndex = normalized.indexOf('--');
    const beforeSeparator = separatorIndex >= 0 ? normalized.slice(0, separatorIndex).trim() : normalized;
    const afterSeparator = separatorIndex >= 0 ? normalized.slice(separatorIndex + 2).trim() : '';
    const tokens = beforeSeparator.split(/\s+/).filter(Boolean);
    const head = String(tokens[0] || '').trim().toLowerCase();
    const tail = tokens.slice(1).join(' ').trim() || null;

    switch (head) {
      case 'help':
      case 'summary':
      case 'resumo':
        return { mode: 'help', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'profiles':
      case 'perfis':
        return { mode: 'profiles', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'profile':
      case 'perfil':
        if (['create', 'add', 'novo'].includes(String(tokens[1] || '').trim().toLowerCase())) {
          return {
            mode: 'profile-create',
            profileId: String(tokens[2] || '').trim() || null,
            sessionId: null,
            permissionId: null,
            prompt: afterSeparator || tokens.slice(3).join(' ').trim() || null,
            title: null,
          };
        }
        if (['update', 'edit', 'atualizar'].includes(String(tokens[1] || '').trim().toLowerCase())) {
          return {
            mode: 'profile-update',
            profileId: String(tokens[2] || '').trim() || null,
            sessionId: null,
            permissionId: null,
            prompt: afterSeparator || tokens.slice(3).join(' ').trim() || null,
            title: null,
          };
        }
        if (['delete', 'remove', 'remover'].includes(String(tokens[1] || '').trim().toLowerCase())) {
          return {
            mode: 'profile-delete',
            profileId: String(tokens[2] || '').trim() || null,
            sessionId: null,
            permissionId: null,
            prompt: null,
            title: null,
          };
        }
        return { mode: 'profile', profileId: tail, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'approvals':
      case 'approval':
      case 'permissoes':
        return { mode: 'approvals', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'approve':
      case 'aprovar':
        return { mode: 'approve', profileId: null, sessionId: null, permissionId: String(tokens[1] || '').trim() || null, prompt: null, title: null };
      case 'reject':
      case 'rejeitar':
        return {
          mode: 'reject',
          profileId: null,
          sessionId: null,
          permissionId: String(tokens[1] || '').trim() || null,
          prompt: afterSeparator || tokens.slice(2).join(' ').trim() || null,
          title: null,
        };
      case 'start':
      case 'run':
      case 'iniciar':
        return {
          mode: 'start',
          profileId: null,
          sessionId: null,
          permissionId: null,
          prompt: afterSeparator || tail,
          title: afterSeparator ? (tail || null) : null,
        };
      case 'sessions':
      case 'list':
      case 'listar':
        return { mode: 'sessions', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'inspect':
      case 'show':
        return { mode: 'inspect', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'tail':
      case 'logs':
        return { mode: 'tail', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'resume':
      case 'retomar':
        return {
          mode: 'resume',
          profileId: null,
          sessionId: String(tokens[1] || '').trim() || null,
          permissionId: null,
          prompt: afterSeparator || null,
          title: null,
        };
      case 'stop':
      case 'parar':
        return { mode: 'stop', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'web':
      case 'attach':
        return { mode: 'web', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      default:
        return { mode: 'status', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
    }
  }

  public parseNaturalIntent(rawText: string): string | null {
    const normalized = String(rawText || '').trim();
    if (!normalized) {
      return null;
    }

    const folded = normalized
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const looksLikeCodexRemoteIntent =
      /\bcodex\b/.test(folded)
      || /\bcodex-[a-z0-9-]+\b/.test(folded)
      || (
        /\b(permissao|pedido)\b/.test(folded)
        && /\b(aprovar|aprova|aprove|approve|autorizar|autorize|liberar|libere|rejeitar|rejeite|reject|negar|negue)\b/.test(folded)
        && /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i.test(folded)
      )
      || (
        /\bperfil\b/.test(folded)
        && /\b(trocar|troque|mudar|mude|alterar|altere|usar|use|selecionar|selecione|ativar|ative|apagar|apague|deletar|delete|excluir|remover|remova)\b/.test(folded)
      );
    if (!looksLikeCodexRemoteIntent) {
      return null;
    }

    const permissionIdMatch = folded.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
    const sessionIdMatch = folded.match(/\b(codex-[a-z0-9-]+)\b/i);
    const profileTarget = this.extractCodexProfileTarget(folded);

    if (/\b(perfis|profiles|listar perfis|mostrar perfis|mostre os perfis)\b/.test(folded)) {
      return '/codexremote profiles';
    }

    if (/\b(sessoes|sessoes|sessions|listar sessoes|mostrar sessoes|mostre as sessoes)\b/.test(folded)) {
      return '/codexremote sessions';
    }

    if (
      /\b(codex remote|codex)\b/.test(folded)
      && /\b(aprovacoes|aprovacao|approvals|approval|permissoes|permissao)\b/.test(folded)
      && /\b(pendentes|pendente|listar|lista|mostrar|mostre|ver|quais)\b/.test(folded)
    ) {
      return '/codexremote approvals';
    }

    if (permissionIdMatch && /\b(aprovar|aprova|aprove|approve|autorizar|autorize|liberar|libere)\b/.test(folded)) {
      return `/codexremote approve ${permissionIdMatch[1]}`;
    }

    if (permissionIdMatch && /\b(rejeitar|rejeite|reject|negar|negue)\b/.test(folded)) {
      return `/codexremote reject ${permissionIdMatch[1]}`;
    }

    if (sessionIdMatch && /\b(parar|pare|stop|encerrar|encerre|cancelar|cancele)\b/.test(folded)) {
      return `/codexremote stop ${sessionIdMatch[1]}`;
    }

    if (sessionIdMatch && /\b(retomar|retome|resume|continuar|continue|prossiga)\b/.test(folded)) {
      return `/codexremote resume ${sessionIdMatch[1]}`;
    }

    if (profileTarget && /\b(apagar|apague|deletar|delete|excluir|remover|remova)\b/.test(folded) && /\bperfil\b/.test(folded)) {
      return `/codexremote profile delete ${profileTarget}`;
    }

    if (
      profileTarget &&
      /\b(trocar|troque|mudar|mude|alterar|altere|usar|use|selecionar|selecione|ativar|ative)\b/.test(folded) &&
      /\bperfil\b/.test(folded)
    ) {
      return `/codexremote profile ${profileTarget}`;
    }

    if (/\b(codex remote|codex)\b/.test(folded) && /\b(resumo|status|painel|overview)\b/.test(folded)) {
      return '/codexremote';
    }

    return null;
  }

  private extractCodexProfileTarget(foldedText: string): string | null {
    const match = foldedText.match(/\bperfil\b(?:\s+(?:para|pro|pra|do|da))?\s+([a-z0-9][a-z0-9._-]*)\b/i);
    return match?.[1] || null;
  }

  private formatCodexRemoteSessionReply(result: {
    action: { note: string; permissionId?: string | null; status?: string | null };
    permission?: PermissionRequest | null;
    session: { record: { sessionId: string; title: string; handoffCommand: string | null }; operatorSummary: string; tail: { logLines: string[] } } | null;
  }): string {
    if (!result.session) {
      return [
        result.action.note,
        result.permission?.permission_id ? `Permissao: ${result.permission.permission_id} (${result.permission.status}).` : null,
      ].filter(Boolean).join('\n');
    }

    const lines = [
      result.action.note,
      '',
      `${result.session.record.title} (${result.session.record.sessionId})`,
      result.permission?.permission_id ? `Permissao: ${result.permission.permission_id} (${result.permission.status}).` : null,
      result.session.operatorSummary,
      result.session.record.handoffCommand
        ? `Handoff web: ${result.session.record.handoffCommand}`
        : null,
      result.session.tail.logLines.length > 0
        ? ['Tail recente:', ...result.session.tail.logLines.slice(-6)].join('\n')
        : null,
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  private async replyCodexRemoteResult(
    ctx: IMessageContext,
    result: {
      action: { note: string; permissionId?: string | null; status?: string | null };
      permission?: PermissionRequest | null;
      session: { record: { sessionId: string; title: string; handoffCommand: string | null }; operatorSummary: string; tail: { logLines: string[] } } | null;
      codexRemote?: { sessionBroker?: { telegramSummary?: string | null } } | null;
    },
    extras: Array<string | null> = [],
  ): Promise<void> {
    if (
      result.action.status === 'pending-approval'
      && result.permission
      && ctx.platform === 'telegram'
      && this.deps.formatPermissionCreatedMessage
      && this.deps.buildPermissionKeyboard
    ) {
      const lines = [
        this.deps.formatPermissionCreatedMessage(result.permission),
        'Codex Remote segue no modo full-user-visible: a aprovacao aparece nesta mesma surface.',
        ...extras.filter(Boolean),
      ];
      await ctx.reply(lines.join('\n\n'), {
        reply_markup: this.deps.buildPermissionKeyboard(result.permission),
      });
      return;
    }

    const lines = [
      this.formatCodexRemoteSessionReply(result),
      ...extras.filter(Boolean),
    ].filter(Boolean) as string[];
    await ctx.reply(lines.join('\n\n'));
  }

  private parseCodexRemoteProfilePayload(prompt: string | null): {
    profileLabel?: string | null;
    profileDescription?: string | null;
    codexCliPath?: string | null;
    codexHome?: string | null;
    workspaceRoot?: string | null;
  } {
    const normalized = String(prompt || '').trim();
    if (!normalized) {
      return {};
    }

    if (normalized.startsWith('{')) {
      try {
        const parsed: Record<string, unknown> = JSON.parse(normalized);
        return {
          profileLabel: String(parsed.label || parsed.profileLabel || '').trim() || null,
          profileDescription: String(parsed.description || parsed.profileDescription || '').trim() || null,
          codexCliPath: String(parsed.codexCliPath || '').trim() || null,
          codexHome: String(parsed.codexHome || '').trim() || null,
          workspaceRoot: String(parsed.workspaceRoot || '').trim() || null,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'JSON invalido';
        throw new Error(`Payload de perfil invalido: ${message}.`);
      }
    }

    return {
      profileLabel: normalized,
    };
  }


}
