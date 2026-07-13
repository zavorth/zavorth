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
import { tSurface } from '../../../../i18n/surface.js';
import { tService } from '../../../../i18n/services.js';

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
      await ctx.reply(tService('session_node.session_plane_unavailable'));
      return;
    }

    try {
      await ctx.reply(
        await this.deps.sessionPlaneService.renderOverviewReport({
          userId: String(ctx.userId || '').trim(),
          // NaturalSlashConvention rewrites empty → "status"; treat control verbs as current session overview.
          ...this.resolveSessionTargetFromArgs(ctx, this.stripSessionControlVerb(args)),
        }),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : tSurface('error_session_plane'));
    }
  }

  private async handleSessionHistory(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply(tService('session_node.session_plane_unavailable'));
      return;
    }

    try {
      await ctx.reply(
        await this.deps.sessionPlaneService.renderHistoryReport({
          userId: String(ctx.userId || '').trim(),
          ...this.resolveSessionTargetFromArgs(ctx, this.stripSessionControlVerb(args)),
        }),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : tService('session_node.could_not_read_history'));
    }
  }

  /** Drop home/status/list/help tokens so they are not parsed as session ids. */
  private stripSessionControlVerb(rawArgs: string): string {
    const trimmed = String(rawArgs || '').trim();
    if (!trimmed) {
      return '';
    }
    const lower = trimmed.toLowerCase();
    if (
      lower === 'status'
      || lower === 'show'
      || lower === 'open'
      || lower === 'list'
      || lower === 'ls'
      || lower === 'help'
      || lower === 'ajuda'
      || lower === '?'
    ) {
      return '';
    }
    return trimmed;
  }

  private async handleSessionSend(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply(tService('session_node.session_plane_unavailable'));
      return;
    }

    const parsed = this.parseSessionSendArgs(args);
    if (!parsed) {
      await ctx.reply(
        [
          'Send a message to another session.',
          '',
          '/sessionsend <sessionId|chatId> <message>',
          '  Ex.: /sessionsend web:minha-sessao continue o plano',
          '',
          'Power form still works: /sessionsend web:minha-sessao -- continue o plano',
        ].join('\n'),
      );
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
          tService('session_node.message_dispatched'),
          '',
          `${tService('session_node.channel_label')}: ${result.platform}.`,
          `${tService('session_node.chat_label')}: ${result.chatId}.`,
          `${tService('session_node.session_label')}: ${result.sessionId || 'n/d'}.`,
          `${tService('session_node.task_created_label')}: ${result.taskId || 'n/d'}.`,
          result.snapshot?.handoff?.operatorSummary || result.snapshot?.replay?.operatorSummary || tService('session_node.no_additional_summary_after_send'),
        ].join('\n'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : tService('session_node.could_not_dispatch_message'));
    }
  }

  private async handleSessionSpawn(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.sessionPlaneService) {
      await ctx.reply(tService('session_node.session_plane_unavailable'));
      return;
    }

    const raw = String(args || '').trim();
    const lower = raw.toLowerCase();
    // Free text is the platform (default web). Explicit help stays available.
    if (lower === 'help' || lower === 'ajuda' || lower === '?') {
      await ctx.reply(
        [
          'Spawn a derived session.',
          '',
          '/sessionspawn',
          '  → open a web session (default)',
          '/sessionspawn <platform>',
          '  Ex.: /sessionspawn telegram',
          '  Ex.: /sessionspawn web',
        ].join('\n'),
      );
      return;
    }

    const requestedPlatform = lower || 'web';
    try {
      const result = await this.deps.sessionPlaneService.spawnSession({
        userId: String(ctx.userId || '').trim(),
        platform: requestedPlatform,
      });

      await ctx.reply(
        [
          result.ok
            ? `${tService('session_node.derived_session_opened')} ${result.platform}.`
            : `${tService('session_node.official_spawn_partial')} ${result.platform}.`,
          '',
          `${tService('session_node.session_label')}: ${result.sessionId || 'n/d'}.`,
          `${tService('session_node.chat_label')}: ${result.chatId || 'n/d'}.`,
          `Runtime user: ${result.runtimeUserId || 'n/d'}.`,
          `Handoff: ${result.handoffCommand}.`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(error instanceof Error ? err.message : tService('session_node.could_not_open_derived_session'));
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
        tService('session_node.node_mesh_profiles'),
        '',
        ...profiles.flatMap((profile) => ([
          `- ${profile.label} [${profile.id}]`,
          `  kind: ${profile.kind} | transport: ${profile.transport}`,
          `  capabilities: ${profile.defaultCapabilityIds.join(', ') || tService('session_node.none')}`,
          `  ${profile.operatorSummary}`,
        ])),
      ].join('\n'));
      return;
    }

    if (normalized === 'capabilities' || normalized === 'caps' || normalized === 'capabilidades') {
      const capabilities = this.deps.nodeCapabilities.listCatalog();
      await ctx.reply([
        tService('session_node.node_mesh_capabilities'),
        '',
        ...capabilities.flatMap((capability) => ([
          `- ${capability.label} [${capability.id}]`,
          `  ${tService('session_node.category')}: ${capability.category} | ${tService('session_node.risk')}: ${capability.risky ? tService('session_node.high') : tService('session_node.low')}`,
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
            ? tService('session_node.no_node_selected_for_queue')
            : tService('session_node.no_node_selected_for_history'),
        );
        return;
      }
      const items = mode === 'queue' ? activity.activeInvocations : activity.recentInvocations;
      const lines = [
        mode === 'queue' ? tService('session_node.node_mesh_queue') : tService('session_node.node_mesh_history'),
        '',
        `Node: ${snapshot.selected?.label || activity.nodeId}.`,
        activity.narrative.headline,
        activity.narrative.operatorSummary,
        '',
        mode === 'queue'
          ? `Pending: ${activity.summary.pending} | claimed: ${activity.summary.claimed}.`
          : `${tService('session_node.recent')}: ${activity.summary.recent} | ${tService('session_node.completed_recently')}: ${activity.summary.completedRecently}.`,
      ];
      if (items.length === 0) {
        lines.push(
          mode === 'queue'
            ? tService('session_node.no_pending_invocations')
            : tService('session_node.no_recent_invocations'),
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
      tService('session_node.zavorth_node_mesh'),
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Nodes: ${snapshot.summary.total} | ${tService('session_node.paired')}: ${snapshot.summary.paired} | pending: ${snapshot.summary.pending} | online: ${snapshot.summary.online}.`,
    ];
    if (snapshot.selected) {
      const profile = this.deps.nodeDeviceProfiles.describeProfile(snapshot.selected.profileId);
      lines.push(
        '',
        `${tService('session_node.node_in_focus')}: ${snapshot.selected.label}.`,
        `Status: ${snapshot.selected.trustLabel} / ${snapshot.selected.status}.`,
        `${tService('session_node.profile')}: ${profile?.label || snapshot.selected.kind}.`,
        `${tService('session_node.queue')}: ${snapshot.selected.pendingInvocations || 0} ${tService('session_node.pending_unit')} / ${snapshot.selected.claimedInvocations || 0} claimed.`,
        snapshot.selected.recentInvocation
          ? `${tService('session_node.recent_invocation')}: ${snapshot.selected.recentInvocation.capabilityId} (${snapshot.selected.recentInvocation.status}).`
          : `${tService('session_node.recent_invocation')}: ${tService('session_node.none_registered')}.`,
        snapshot.selected.operatorSummary || snapshot.selected.nextAction || tService('session_node.no_additional_summary'),
      );
    }
    if (snapshot.suggestedActions.length > 0) {
      lines.push('', `${tService('session_node.next_step')}:`, `- ${snapshot.suggestedActions[0].label}: ${snapshot.suggestedActions[0].reason}`);
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
      `${tService('session_node.pairing_draft_created')} ${draft.entry.label}.`,
      '',
      `${tService('session_node.profile')}: ${draft.profile?.label || profile.label}.`,
      `Node ID: ${draft.entry.id}.`,
      `Pairing code: ${draft.pairingCode}.`,
      `${tService('session_node.transport')}: ${draft.entry.transport}.`,
      `${tService('session_node.base_capabilities')}: ${draft.entry.capabilityIds.join(', ') || tService('session_node.no_capabilities_declared')}.`,
      `${tService('session_node.suggested_bootstrap')}:`,
      draft.bootstrap?.command
        || `npm run nodes:host -- --base-url <zavorthControl-url> --node-id ${draft.entry.id} --pairing-code ${draft.pairingCode} --capabilities ${draft.entry.capabilityIds.join(',') || 'system.run'}`,
      ...(draft.bootstrap?.fallbackCommand ? ['Fallback:', draft.bootstrap.fallbackCommand] : []),
    ].join('\n'));
  }

  private async handleNodeInvoke(ctx: IMessageContext, args: string): Promise<void> {
    const parsed = this.parseNodeInvokeArgs(args);
    if (!parsed) {
      await ctx.reply(
        [
          'Invoke a capability on a node.',
          '',
          '/nodeinvoke <nodeId> <capabilityId> [action] [payload-json]',
          '  Ex.: /nodeinvoke oracle-node system.run',
        ].join('\n'),
      );
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
      result.ok ? tService('session_node.node_mesh_invocation_queued') : tService('session_node.could_not_queue_invocation'),
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
