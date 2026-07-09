import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { NodeMeshNodeKind } from '../../../../contracts/NodeMeshContract.js';
import type { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import type { ZavorthNodeMeshService } from '../../../../services/ZavorthNodeMeshService.js';
import type { NodeCapabilityService } from '../../../../services/NodeCapabilityService.js';
import type { NodeDeviceProfileService } from '../../../../services/NodeDeviceProfileService.js';
import type { NodeInvokeService } from '../../../../services/NodeInvokeService.js';
import type { NodePairingService } from '../../../../services/NodePairingService.js';
import { logger } from '../../../../logger';
import { asErrorLike } from '../../../../utils/errorLike.js';

type SharedSurfaceSessionNodeCommandPackDeps = {
  sessionPlaneService?: Pick<
    ZavorthSessionPlaneService,
    'renderOverviewReport' | 'renderHistoryReport' | 'sendToSession' | 'spawnSession'
  > | null;
  nodeMeshService: Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
  nodeDeviceProfiles: Pick<
    NodeDeviceProfileService,
    'listProfiles' | 'describeProfile' | 'resolveProfile' | 'normalizeProfileId'
  >;
  nodeCapabilities: Pick<NodeCapabilityService, 'listCatalog'>;
  nodePairingService: Pick<NodePairingService, 'createPairingDraft'>;
  nodeInvokeService: Pick<NodeInvokeService, 'invoke'>;
};

type SessionTarget = {
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  sourceUserId?: string | null;
};

export class SharedSurfaceSessionNodeCommandPack {
  constructor(private readonly deps: SharedSurfaceSessionNodeCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/sessions':
        await this.handleSessions(ctx, args);
        return true;
      case '/sessionhistory':
        await this.handleSessionHistory(ctx, args);
        return true;
      case '/sessionsend':
        await this.handleSessionSend(ctx, args);
        return true;
      case '/sessionspawn':
        await this.handleSessionSpawn(ctx, args);
        return true;
      case '/nodes':
        await this.handleNodes(ctx, args);
        return true;
      case '/nodepair':
        await this.handleNodePair(ctx, args);
        return true;
      case '/nodeinvoke':
        await this.handleNodeInvoke(ctx, args);
        return true;
      default:
        return false;
    }
  }

  private async handleSessions(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply('Session plane indisponivel neste runtime compartilhado.');
      return;
    }

    try {
      await ctx.reply(
        await this.deps.sessionPlaneService.renderOverviewReport({
          userId: String(ctx.userId || '').trim(),
          ...this.resolveSessionTargetFromArgs(ctx, args),
        }),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : 'Nao consegui montar o session plane agora.');
    }
  }

  private async handleSessionHistory(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply('Session plane indisponivel neste runtime compartilhado.');
      return;
    }

    try {
      await ctx.reply(
        await this.deps.sessionPlaneService.renderHistoryReport({
          userId: String(ctx.userId || '').trim(),
          ...this.resolveSessionTargetFromArgs(ctx, args),
        }),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : 'Nao consegui ler o historico dessa sessao agora.');
    }
  }

  private async handleSessionSend(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply('Session plane indisponivel neste runtime compartilhado.');
      return;
    }

    const parsed = this.parseSessionSendArgs(args);
    if (!parsed) {
      await ctx.reply('Use /sessionsend <sessionId|chatId> -- <mensagem>. Ex.: /sessionsend web:minha-sessao -- continue o plano.');
      return;
    }

    const target = this.resolveSessionTargetFromArgs(ctx, parsed.targetRef);
    try {
      const result = await this.deps.sessionPlaneService.sendToSession({
        userId: String(ctx.userId || '').trim(),
        platform: target.platform || ctx.platform,
        chatId: target.chatId || null,
        sessionId: target.sessionId || null,
        sourceUserId: target.sourceUserId || null,
        text: parsed.message,
        ctx,
      });

      await ctx.reply(
        [
          'Mensagem despachada para a sessao.',
          '',
          `Canal: ${result.platform}.`,
          `Chat: ${result.chatId}.`,
          `Sessao: ${result.sessionId || 'n/d'}.`,
          `Task criada: ${result.taskId || 'n/d'}.`,
          result.snapshot?.handoff?.operatorSummary || result.snapshot?.replay?.operatorSummary || 'Sem resumo adicional apos o envio.',
        ].join('\n'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : 'Nao consegui despachar a mensagem para essa sessao agora.');
    }
  }

  private async handleSessionSpawn(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply('Session plane indisponivel neste runtime compartilhado.');
      return;
    }

    const requestedPlatform = String(args || '').trim().toLowerCase() || 'web';
    try {
      const result = await this.deps.sessionPlaneService.spawnSession({
        userId: String(ctx.userId || '').trim(),
        platform: requestedPlatform,
      });

      await ctx.reply(
        [
          result.ok
            ? `Sessao derivada aberta em ${result.platform}.`
            : `Spawn oficial ainda parcial para ${result.platform}.`,
          '',
          `Sessao: ${result.sessionId || 'n/d'}.`,
          `Chat: ${result.chatId || 'n/d'}.`,
          `Runtime user: ${result.runtimeUserId || 'n/d'}.`,
          `Handoff: ${result.handoffCommand}.`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : 'Nao consegui abrir a sessao derivada agora.');
    }
  }

  private async handleNodes(ctx: IMessageContext, args: string): Promise<void> {
    const rawArgs = String(args || '').trim();
    const normalized = rawArgs.toLowerCase();
    const tokens = rawArgs.split(/\s+/).filter(Boolean);
    const head = String(tokens[0] || '').trim().toLowerCase();
    const tail = tokens.slice(1).join(' ').trim() || null;
    if (normalized === 'profiles' || normalized === 'profile' || normalized === 'perfis') {
      const profiles = this.deps.nodeDeviceProfiles.listProfiles();
      await ctx.reply([
        'Perfis do Node Mesh',
        '',
        ...profiles.flatMap((profile) => ([
          `- ${profile.label} [${profile.id}]`,
          `  kind: ${profile.kind} | transport: ${profile.transport}`,
          `  capabilities: ${profile.defaultCapabilityIds.join(', ') || 'nenhuma'}`,
          `  ${profile.operatorSummary}`,
        ])),
      ].join('\n'));
      return;
    }

    if (normalized === 'capabilities' || normalized === 'caps' || normalized === 'capabilidades') {
      const capabilities = this.deps.nodeCapabilities.listCatalog();
      await ctx.reply([
        'Capabilities do Node Mesh',
        '',
        ...capabilities.flatMap((capability) => ([
          `- ${capability.label} [${capability.id}]`,
          `  categoria: ${capability.category} | risco: ${capability.risky ? 'alto' : 'baixo'}`,
          `  ${capability.summary}`,
        ])),
      ].join('\n'));
      return;
    }

    const mode = head === 'queue' || head === 'fila' || head === 'pending'
      ? 'queue'
      : (head === 'history' || head === 'historico' || head === 'recent' ? 'history' : 'snapshot');
    const selectedNodeId = mode === 'snapshot'
      ? (rawArgs || null)
      : tail;
    const snapshot = this.deps.nodeMeshService.buildSnapshot({ selectedNodeId });
    if (mode !== 'snapshot') {
      const activity = snapshot.selectedActivity;
      if (!activity?.nodeId) {
        await ctx.reply(
          mode === 'queue'
            ? 'Nenhum node selecionado para consultar a fila do Node Mesh.'
            : 'Nenhum node selecionado para consultar o historico do Node Mesh.',
        );
        return;
      }
      const items = mode === 'queue' ? activity.activeInvocations : activity.recentInvocations;
      const lines = [
        mode === 'queue' ? 'Fila do Node Mesh' : 'Historico do Node Mesh',
        '',
        `Node: ${snapshot.selected?.label || activity.nodeId}.`,
        activity.narrative.headline,
        activity.narrative.operatorSummary,
        '',
        mode === 'queue'
          ? `Pendentes: ${activity.summary.pending} | claimed: ${activity.summary.claimed}.`
          : `Recentes: ${activity.summary.recent} | concluidas recentemente: ${activity.summary.completedRecently}.`,
      ];
      if (items.length === 0) {
        lines.push(
          mode === 'queue'
            ? 'Nenhuma invocacao pendente/claimed no momento.'
            : 'Nenhuma invocacao recente registrada para este node.',
        );
      } else {
        lines.push(
          ...items.map((entry) =>
            `- ${entry.capabilityId} (${entry.status})${entry.resultSummary ? ` :: ${entry.resultSummary}` : ''}`,
          ),
        );
      }
      await ctx.reply(lines.join('\n'));
      return;
    }
    const lines = [
      'Node Mesh do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Nodes: ${snapshot.summary.total} | pareados: ${snapshot.summary.paired} | pendentes: ${snapshot.summary.pending} | online: ${snapshot.summary.online}.`,
    ];
    if (snapshot.selected) {
      const profile = this.deps.nodeDeviceProfiles.describeProfile(snapshot.selected.profileId);
      lines.push(
        '',
        `Node em foco: ${snapshot.selected.label}.`,
        `Status: ${snapshot.selected.trustLabel} / ${snapshot.selected.status}.`,
        `Perfil: ${profile?.label || snapshot.selected.kind}.`,
        `Fila: ${snapshot.selected.pendingInvocations || 0} pendente(s) / ${snapshot.selected.claimedInvocations || 0} claimed.`,
        snapshot.selected.recentInvocation
          ? `Invocacao recente: ${snapshot.selected.recentInvocation.capabilityId} (${snapshot.selected.recentInvocation.status}).`
          : 'Invocacao recente: nenhuma registrada.',
        snapshot.selected.operatorSummary || snapshot.selected.nextAction || 'Sem resumo adicional.',
      );
    }
    if (snapshot.suggestedActions.length > 0) {
      lines.push('', 'Proximo passo:', `- ${snapshot.suggestedActions[0].label}: ${snapshot.suggestedActions[0].reason}`);
    }
    await ctx.reply(lines.join('\n'));
  }

  private async handleNodePair(ctx: IMessageContext, args: string): Promise<void> {
    const parsed = this.parseNodePairArgs(args);
    const profile = this.deps.nodeDeviceProfiles.resolveProfile(parsed.profileId, parsed.kind);
    const draft = this.deps.nodePairingService.createPairingDraft({
      profileId: profile.id,
      label: parsed.label || profile.label,
      requestedBy: String(ctx.userId || '').trim() || null,
      hostHints: {
        workspace: process.cwd(),
      },
    });

    await ctx.reply([
      `Pairing draft criado para ${draft.entry.label}.`,
      '',
      `Perfil: ${draft.profile?.label || profile.label}.`,
      `Node ID: ${draft.entry.id}.`,
      `Pairing code: ${draft.pairingCode}.`,
      `Transporte: ${draft.entry.transport}.`,
      `Capabilities base: ${draft.entry.capabilityIds.join(', ') || 'sem capabilities declaradas'}.`,
      'Bootstrap sugerido:',
      draft.bootstrap?.command
        || `npm run nodes:host -- --base-url <zavorthControl-url> --node-id ${draft.entry.id} --pairing-code ${draft.pairingCode} --capabilities ${draft.entry.capabilityIds.join(',') || 'system.run'}`,
      ...(draft.bootstrap?.fallbackCommand ? ['Fallback:', draft.bootstrap.fallbackCommand] : []),
    ].join('\n'));
  }

  private async handleNodeInvoke(ctx: IMessageContext, args: string): Promise<void> {
    const parsed = this.parseNodeInvokeArgs(args);
    if (!parsed) {
      await ctx.reply('Use /nodeinvoke <nodeId> <capabilityId> [action] [payload-json].');
      return;
    }

    const result = this.deps.nodeInvokeService.invoke({
      nodeId: parsed.nodeId,
      capabilityId: parsed.capabilityId,
      action: parsed.action,
      payload: parsed.payload,
      requestedBy: String(ctx.userId || '').trim() || null,
    });
    await ctx.reply([
      result.ok ? 'Invocacao do Node Mesh enfileirada.' : 'Nao consegui enfileirar a invocacao do Node Mesh.',
      '',
      `Node: ${result.nodeId || 'n/d'}.`,
      `Capability: ${result.capabilityId}.`,
      `Status: ${result.status}.`,
      result.invocationId ? `Invocation ID: ${result.invocationId}.` : '',
      result.reason,
    ].filter(Boolean).join('\n'));
  }

  private resolveSessionTargetFromArgs(
    ctx: Pick<IMessageContext, 'platform' | 'chatId' | 'userId'>,
    rawArgs: string,
  ): SessionTarget {
    const targetRef = String(rawArgs || '').trim().split(/\s+/)[0] || '';
    if (!targetRef) {
      const currentChatId = String(ctx.chatId || '').trim();
      const currentSessionId = ctx.platform === 'web' && currentChatId.startsWith('web:')
        ? currentChatId.slice(4)
        : null;
      return {
        platform: ctx.platform,
        chatId: currentChatId || null,
        sessionId: currentSessionId,
        sourceUserId: String(ctx.userId || '').trim() || null,
      };
    }

    if (targetRef.includes(':')) {
      return {
        platform: targetRef.split(':')[0] || ctx.platform,
        chatId: targetRef,
        sessionId: targetRef.startsWith('web:') ? targetRef.slice(4) : null,
        sourceUserId: String(ctx.userId || '').trim() || null,
      };
    }

    return {
      platform: 'web',
      sessionId: targetRef,
      chatId: `web:${targetRef}`,
      sourceUserId: targetRef,
    };
  }

  private parseSessionSendArgs(rawArgs: string): {
    targetRef: string;
    message: string;
  } | null {
    const normalized = String(rawArgs || '').trim();
    if (!normalized) {
      return null;
    }

    const separatorIndex = normalized.indexOf('--');
    if (separatorIndex >= 0) {
      const targetRef = normalized.slice(0, separatorIndex).trim();
      const message = normalized.slice(separatorIndex + 2).trim();
      if (targetRef && message) {
        return { targetRef, message };
      }
      return null;
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      return null;
    }

    const [targetRef, ...messageParts] = tokens;
    const message = messageParts.join(' ').trim();
    if (!targetRef || !message) {
      return null;
    }

    return {
      targetRef,
      message,
    };
  }

  private parseNodeInvokeArgs(args: string): {
    nodeId: string;
    capabilityId: string;
    action: string;
    payload: Record<string, unknown> | null;
  } | null {
    const raw = String(args || '').trim();
    if (!raw) {
      return null;
    }
    const tokens = raw.split(/\s+/);
    const nodeId = String(tokens[0] || '').trim();
    const capabilityId = String(tokens[1] || '').trim();
    const action = String(tokens[2] || 'invoke').trim() || 'invoke';
    if (!nodeId || !capabilityId) {
      return null;
    }

    const payloadRaw = raw.split(/\s+/).slice(3).join(' ').trim();
    let payload: Record<string, unknown> | null = null;
    if (payloadRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(payloadRaw);
        payload = parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error: unknown) {logger.warn('[Shared Surface Session Node Command Pack] JSON parse failed', error);
    payload = null;
  }
    }

    return {
      nodeId,
      capabilityId,
      action,
      payload,
    };
  }

  private parseNodePairArgs(rawArgs: string): {
    profileId: string;
    kind: NodeMeshNodeKind | null;
    label: string | null;
  } {
    const tokens = String(rawArgs || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').trim().toLowerCase();
    const normalizedProfileId = this.deps.nodeDeviceProfiles.normalizeProfileId(first);
    if (normalizedProfileId) {
      const profile = this.deps.nodeDeviceProfiles.describeProfile(normalizedProfileId);
      const label = tokens.slice(1).join(' ').trim() || null;
      return {
        profileId: normalizedProfileId,
        kind: profile?.kind || null,
        label,
      };
    }
    const aliasMap: Record<string, { profileId: string; kind: NodeMeshNodeKind }> = {
      headless: { profileId: 'headless-worker', kind: 'headless' },
      desktop: { profileId: 'desktop-companion', kind: 'desktop' },
      mobile: { profileId: 'mobile-companion', kind: 'mobile' },
      browser: { profileId: 'browser-companion', kind: 'browser' },
    };
    const matched = aliasMap[first];
    if (matched) {
      const label = tokens.slice(1).join(' ').trim() || null;
      return {
        profileId: matched.profileId,
        kind: matched.kind,
        label,
      };
    }

    return {
      profileId: 'headless-worker',
      kind: 'headless',
      label: String(rawArgs || '').trim() || null,
    };
  }
}
