import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import type { CodexRemoteActionService } from '../../../../services/CodexRemoteActionService.js';
import type { CodexRemoteControlPlaneService } from '../../../../services/CodexRemoteControlPlaneService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
import { tService } from '../../../../i18n/services.js';

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
          `${tService('codex_remote.active_profile')}: ${snapshot.activeProfile.label} (${snapshot.activeProfile.id}).`,
          `CLI ready: ${snapshot.summary.cliReady ? 'yes' : 'no'}.`,
          `${tService('codex_remote.tracked_sessions')}: ${snapshot.summary.trackedSessions} | ${tService('codex_remote.running')}: ${snapshot.summary.runningSessions}.`,
          `${tService('codex_remote.visibility')}: ${snapshot.visibility.mode} | pending approvals: ${snapshot.visibility.pendingApprovals}.`,
          snapshot.visibility.note,
          `Ready remote transports: ${snapshot.summary.readyRemotePaths}/${snapshot.remotePaths.length}.`,
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
          tService('codex_remote.profiles_title'),
          '',
          snapshot.profiles.narrative.headline,
          snapshot.profiles.narrative.operatorSummary,
          `${tService('codex_remote.registry_health')}: ${snapshot.profiles.health.status}.`,
          snapshot.profiles.health.operatorSummary,
          `Readiness: ${snapshot.profiles.readiness.status}.`,
          snapshot.profiles.readiness.operatorSummary,
        ];
        for (const profile of snapshot.profiles.profiles) {
          lines.push(
            '',
            `${profile.active ? tService('codex_remote.active') : tService('codex_remote.profile')}: ${profile.label} (${profile.id})`,
            profile.description,
            `CLI: ${profile.codexCliPath}`,
            `CODEX_HOME: ${profile.codexHome || 'n/d'}`,
            `Workspace: ${profile.workspaceRoot || 'n/d'}`,
            `${tService('codex_remote.enabled')}: ${profile.enabled ? 'yes' : 'no'}`,
          );
        }
        lines.push(
          '',
          tService('codex_remote.profile_management'),
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
          `${tService('codex_remote.active_profile_now')}: ${result.codexRemote.activeProfile.label}.`,
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
          await ctx.reply(['Codex Remote approvals', '', 'No pending approvals at the moment.'].join('\n'));
          return;
        }
        const lines: Array<string | null> = [
          'Codex Remote approvals',
          '',
          `Pending: ${snapshot.sessionBroker.approvals.length}.`,
        ];
        for (const approval of snapshot.sessionBroker.approvals.slice(0, 8)) {
          lines.push(
            '',
            `${approval.permissionId}`,
            `Kind: ${approval.kind}.`,
            approval.actionId ? `${tService('codex_remote.action_label')}: ${approval.actionId}.` : null,
            approval.sessionId ? `${tService('codex_remote.session_label')}: ${approval.sessionId}.` : null,
            approval.profileId ? `${tService('codex_remote.profile_label')}: ${approval.profileId}.` : null,
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
          await ctx.reply(
            [
              'Codex Remote',
              '',
              tService('codex_remote.no_sessions_tracked'),
              'Use /codexremote <your request> to open the first session.',
              'Power form: /codexremote start [title] -- <prompt>',
            ].join('\n'),
          );
          return;
        }

        const lines = [tService('codex_remote.sessions_title'), '', snapshot.sessionBroker.narrative.headline];
        for (const session of sessions.slice(0, 8)) {
          lines.push(
            '',
            `${session.title} (${session.sessionId})`,
            `Status: ${session.status} | ${tService('codex_remote.profile')}: ${session.profileLabel} | runs: ${session.runCount}.`,
            session.operatorSummary,
            `${tService('codex_remote.actions')}: ${session.actions.join(', ')}.`,
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
          await ctx.reply(`${tService('codex_remote.session_not_found')}: ${request.sessionId}.`);
          return;
        }
        const lines = [
          `${selected.record.title} (${selected.record.sessionId})`,
          '',
          selected.operatorSummary,
          `Prompt: ${selected.record.prompt}`,
          `${tService('codex_remote.visibility')}: ${selected.visibility.mode} | pending approvals: ${selected.visibility.pendingApprovals}.`,
          selected.visibility.note,
          `${tService('codex_remote.web_handoff')}: ${selected.record.handoffCommand || tService('codex_remote.not_yet')}`,
        ];
        if (request.mode === 'tail') {
          lines.push('', `${tService('codex_remote.recent_tail')}:`);
          lines.push(
            ...(selected.tail.logLines.length > 0 ? selected.tail.logLines : [tService('codex_remote.no_recent_logs')]),
          );
        } else {
          lines.push('', `${tService('codex_remote.recent_events')}:`);
          lines.push(
            ...selected.record.events.slice(-8).map((event) => `- ${event.at} | ${event.type}: ${event.message}`),
          );
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
                spawnSession: ({ userId, platform }) =>
                  this.deps.sessionPlaneService!.spawnSession({
                    userId,
                    platform,
                  }),
              }
            : null,
        });
        const lines = [
          result.action.note,
          result.action.handoffCommand
            ? `${tService('codex_remote.handoff_command')}: ${result.action.handoffCommand}`
            : null,
          result.spawnedSession?.sessionId ? `Session web: ${result.spawnedSession.sessionId}` : null,
        ].filter(Boolean) as string[];
        await ctx.reply(lines.join('\n'));
        return;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'unknown error';
      await ctx.reply(`Could not operate Codex Remote right now.\n\nReason: ${message}`);
    }
  }

  private parseCodexRemoteRequest(rawArgs: string): {
    mode:
      | 'status'
      | 'help'
      | 'profiles'
      | 'profile'
      | 'profile-create'
      | 'profile-update'
      | 'profile-delete'
      | 'approvals'
      | 'approve'
      | 'reject'
      | 'start'
      | 'sessions'
      | 'inspect'
      | 'tail'
      | 'resume'
      | 'stop'
      | 'web';
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
    const head = String(tokens[0] || '')
      .trim()
      .toLowerCase();
    const tail = tokens.slice(1).join(' ').trim() || null;

    switch (head) {
      case 'help':
      case 'summary':
        return { mode: 'help', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'profiles':
        return { mode: 'profiles', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'profile':
        if (
          ['create', 'add'].includes(
            String(tokens[1] || '')
              .trim()
              .toLowerCase(),
          )
        ) {
          return {
            mode: 'profile-create',
            profileId: String(tokens[2] || '').trim() || null,
            sessionId: null,
            permissionId: null,
            prompt: afterSeparator || tokens.slice(3).join(' ').trim() || null,
            title: null,
          };
        }
        if (
          ['update', 'edit'].includes(
            String(tokens[1] || '')
              .trim()
              .toLowerCase(),
          )
        ) {
          return {
            mode: 'profile-update',
            profileId: String(tokens[2] || '').trim() || null,
            sessionId: null,
            permissionId: null,
            prompt: afterSeparator || tokens.slice(3).join(' ').trim() || null,
            title: null,
          };
        }
        if (
          ['delete', 'remove'].includes(
            String(tokens[1] || '')
              .trim()
              .toLowerCase(),
          )
        ) {
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
        return { mode: 'approvals', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'approve':
        return {
          mode: 'approve',
          profileId: null,
          sessionId: null,
          permissionId: String(tokens[1] || '').trim() || null,
          prompt: null,
          title: null,
        };
      case 'reject':
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
        return {
          mode: 'start',
          profileId: null,
          sessionId: null,
          permissionId: null,
          prompt: afterSeparator || tail,
          title: afterSeparator ? tail || null : null,
        };
      case 'sessions':
      case 'list':
        return { mode: 'sessions', profileId: null, sessionId: null, permissionId: null, prompt: null, title: null };
      case 'inspect':
      case 'show':
        return { mode: 'inspect', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'tail':
      case 'logs':
        return { mode: 'tail', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'resume':
        return {
          mode: 'resume',
          profileId: null,
          sessionId: String(tokens[1] || '').trim() || null,
          permissionId: null,
          prompt: afterSeparator || null,
          title: null,
        };
      case 'stop':
        return { mode: 'stop', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      case 'web':
      case 'attach':
        return { mode: 'web', profileId: null, sessionId: tail, permissionId: null, prompt: null, title: null };
      default:
        // Free-text primary path: treat the whole request as a start prompt
        // (NaturalSlashConvention rewrites to "start -- <prompt>"; pack also accepts free text directly).
        return {
          mode: 'start',
          profileId: null,
          sessionId: null,
          permissionId: null,
          prompt: afterSeparator || normalized,
          title: afterSeparator ? beforeSeparator || null : null,
        };
    }
  }

  private formatCodexRemoteSessionReply(result: {
    action: { note: string; permissionId?: string | null; status?: string | null };
    permission?: PermissionRequest | null;
    session: {
      record: { sessionId: string; title: string; handoffCommand: string | null };
      operatorSummary: string;
      tail: { logLines: string[] };
    } | null;
  }): string {
    if (!result.session) {
      return [
        result.action.note,
        result.permission?.permission_id
          ? `${tService('codex_remote.permission_label')}: ${result.permission.permission_id} (${result.permission.status}).`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const lines = [
      result.action.note,
      '',
      `${result.session.record.title} (${result.session.record.sessionId})`,
      result.permission?.permission_id
        ? `${tService('codex_remote.permission_label')}: ${result.permission.permission_id} (${result.permission.status}).`
        : null,
      result.session.operatorSummary,
      result.session.record.handoffCommand ? `Handoff web: ${result.session.record.handoffCommand}` : null,
      result.session.tail.logLines.length > 0
        ? [`${tService('codex_remote.recent_tail')}:`, ...result.session.tail.logLines.slice(-6)].join('\n')
        : null,
    ].filter(Boolean) as string[];

    return lines.join('\n');
  }

  private async replyCodexRemoteResult(
    ctx: IMessageContext,
    result: {
      action: { note: string; permissionId?: string | null; status?: string | null };
      permission?: PermissionRequest | null;
      session: {
        record: { sessionId: string; title: string; handoffCommand: string | null };
        operatorSummary: string;
        tail: { logLines: string[] };
      } | null;
      codexRemote?: { sessionBroker?: { telegramSummary?: string | null } } | null;
    },
    extras: Array<string | null> = [],
  ): Promise<void> {
    if (result.action.status === 'pending-approval' && result.permission) {
      // Prefer telegram keyboard when available; else surface-agnostic proposal card.
      if (
        ctx.platform === 'telegram' &&
        this.deps.formatPermissionCreatedMessage &&
        this.deps.buildPermissionKeyboard
      ) {
        const lines = [
          this.deps.formatPermissionCreatedMessage(result.permission),
          'Codex Remote stays full-user-visible: approval appears on this same surface.',
          ...extras.filter(Boolean),
        ];
        await ctx.reply(lines.join('\n\n'), {
          reply_markup: this.deps.buildPermissionKeyboard(result.permission),
        });
        return;
      }

      const { buildPermissionPendingCard } = await import('../../../../services/PermissionProposalPresentation.js');
      const { replyWithSharedSurfaceResponse } = await import('./SharedSurfaceResponseSender.js');
      const card = buildPermissionPendingCard({
        permission: result.permission,
        channel: String(ctx.platform || 'plain'),
        ordinal: 1,
      });
      const note = [
        result.action.note,
        'Codex Remote stays full-user-visible: approval appears on this same surface.',
        ...extras.filter(Boolean),
      ]
        .filter(Boolean)
        .join('\n\n');
      try {
        await replyWithSharedSurfaceResponse(
          ctx,
          {
            ...card.surfaceResponse,
            blocks: [
              { kind: 'text', text: `${note}\n\n${card.text}` },
              ...(card.surfaceResponse.blocks || []).filter((b) => b.kind === 'actions'),
            ],
          },
          {
            trackApprovalId: result.permission.permission_id,
            maxActionsPerRow: 2,
          },
        );
        return;
      } catch {
        await ctx.reply(`${note}\n\n${card.text}`);
        return;
      }
    }

    const lines = [this.formatCodexRemoteSessionReply(result), ...extras.filter(Boolean)].filter(Boolean) as string[];
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
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : tService('codex_remote.invalid_json');
        throw new Error(`${tService('codex_remote.invalid_profile_payload')}: ${message}.`);
      }
    }

    return {
      profileLabel: normalized,
    };
  }
}
