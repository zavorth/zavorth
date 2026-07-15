import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ModeEscalationResolution, ModeEscalationSnapshot } from '../../../../contracts/ModeEscalationContract.js';
import type { ZavorthProductModeSnapshot } from '../../../../services/ProductModeService.js';
import type { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import type { CompanionControlService } from '../../../../services/CompanionControlService.js';
import type { CompanionWorkspaceOptimizerService } from '../../../../services/CompanionWorkspaceOptimizerService.js';
import type { DesktopResourcePlaneService } from '../../../../services/DesktopResourcePlaneService.js';
import type { ModeEscalationService } from '../../../../services/ModeEscalationService.js';
import { buildModeEscalationPendingCard } from '../../../../services/ModeEscalationPresentation.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
import { tService } from '../../../../i18n/services.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';
type SharedSurfaceDesktopCommandPackDeps = {
  desktopResourcePlaneService: Pick<DesktopResourcePlaneService, 'inspectLive' | 'renderReport'> | null;

  capabilityLifecycleService: Pick<CapabilityLifecycleService, 'buildProductModeSnapshot' | 'setProductMode'> | null;
  companionControlService: Pick<
    CompanionControlService,
    'buildSnapshot' | 'inspectCompanion' | 'executeAction' | 'renderSnapshot' | 'renderCompanion' | 'renderActionResult'
  > | null;
  workspaceOptimizerService: Pick<
    CompanionWorkspaceOptimizerService,
    | 'buildLoadProfile'
    | 'previewOptimization'
    | 'applyOptimization'
    | 'renderLoadProfile'
    | 'renderPreview'
    | 'renderApplyResult'
  > | null;
  modeEscalationService: Pick<ModeEscalationService, 'buildSnapshot' | 'resolveRequest'> | null;
};

export class SharedSurfaceDesktopCommandPack {
  public constructor(private readonly deps: SharedSurfaceDesktopCommandPackDeps) {}

  public async handleDoctor(ctx: IMessageContext, args: string): Promise<void> {
    const normalized = String(args || '')
      .trim()
      .toLowerCase();
    const target = normalized.split(/\s+/).filter(Boolean)[0] || 'desktop';

    if (target !== 'desktop') {
      await ctx.reply(tService('desktop.use_doctor_desktop'));
      return;
    }

    if (!this.deps.desktopResourcePlaneService) {
      await ctx.reply(tService('desktop.resource_plane_unavailable'));
      return;
    }

    try {
      const snapshot = await this.deps.desktopResourcePlaneService.inspectLive({ preferCachedWithinMs: 15_000 });
      await ctx.reply(this.deps.desktopResourcePlaneService.renderReport(snapshot));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_desktop_plane')));
    }
  }

  private formatProductModeReply(
    snapshot: ZavorthProductModeSnapshot,
    modeEscalation: ModeEscalationSnapshot | null = null,
  ): string {
    const visible = snapshot.visibleSurfaces.join(', ') || 'chat';
    const hidden = snapshot.hiddenByDefault.join(', ') || tService('desktop.nothing');
    const possibleEscalations =
      snapshot.escalationTargets.length > 0 ? snapshot.escalationTargets.join(', ') : tService('desktop.none');
    const lines = [
      `${snapshot.label}`,
      '',
      snapshot.summary,
      '',
      `${tService('desktop.current_mode')}: ${snapshot.id}`,
      `${tService('desktop.expected_base_profile')}: ${snapshot.defaultRuntimeProfile}`,
      `${tService('desktop.active_profile')}: ${snapshot.runtimeProfile}${snapshot.profileAligned ? ` (${tService('desktop.aligned')})` : ` (${tService('desktop.outside_mode_baseline')})`}`,
      `${tService('desktop.visible_surfaces')}: ${visible}`,
      `${tService('desktop.hidden_by_default')}: ${hidden}`,
      `${tService('desktop.possible_escalations')}: ${possibleEscalations}`,
      `${tService('desktop.commands')}: ${snapshot.commands.show} | ${snapshot.commands.set}`,
      `${tService('desktop.cli')}: ${snapshot.commands.cliStatus} | ${snapshot.commands.cliSet}`,
    ];
    if (modeEscalation) {
      lines.push('', `${tService('desktop.effective_mode_now')}: ${modeEscalation.effectiveMode.id}.`);
      if (modeEscalation.pendingRequest) {
        lines.push(
          `${tService('desktop.pending_mode_escalation')}: pending (use /mode approve — no long id)`,
          modeEscalation.pendingRequest.summary,
          `${tService('desktop.approve_with')}: /mode approve  [once|session|host]  or  /mode approve 1`,
          `${tService('desktop.reject_with')}: /mode reject  or  /mode reject 1`,
        );
      } else if (modeEscalation.activeGrants.length > 0) {
        const grant = modeEscalation.activeGrants[0];
        lines.push(
          `${tService('desktop.active_grant')}: ${grant.targetMode} (${grant.scope})`,
          `Reason: ${grant.reason}`,
        );
      }
    }
    return lines.join('\n');
  }

  private formatModeEscalationResolution(result: ModeEscalationResolution): string {
    const grantLine = result.grant
      ? `Grant: ${result.grant.targetMode} (${result.grant.scope}).`
      : tService('desktop.no_active_grant_created');
    return [
      result.summary,
      '',
      grantLine,
      `${tService('desktop.effective_mode')}: ${result.snapshot.effectiveMode.id}.`,
      result.request.fallback ? `Fallback leve: ${result.request.fallback}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  public async handleProductMode(ctx: IMessageContext, args: string): Promise<void> {
    if (
      !this.deps.capabilityLifecycleService?.buildProductModeSnapshot ||
      !this.deps.capabilityLifecycleService?.setProductMode
    ) {
      await ctx.reply(tService('desktop.product_mode_unavailable'));
      return;
    }

    const rawArgs = String(args || '').trim();
    const normalizedArgs = rawArgs.toLowerCase();
    const sessionId = String(ctx.threadId || ctx.channelId || ctx.chatId || '').trim() || 'shared-surface';
    const escalationSnapshot = this.deps.modeEscalationService?.buildSnapshot(sessionId) || null;

    if (!normalizedArgs) {
      const modeSnap = this.deps.capabilityLifecycleService.buildProductModeSnapshot();
      // Pending escalation: native button card when surface supports it.
      if (escalationSnapshot?.pendingRequest) {
        const card = buildModeEscalationPendingCard({
          request: escalationSnapshot.pendingRequest as any,
          channel: String(ctx.platform || 'plain'),
        });
        const prefix = this.formatProductModeReply(modeSnap, escalationSnapshot);
        try {
          await replyWithSharedSurfaceResponse(
            ctx,
            {
              ...card.surfaceResponse,
              blocks: [
                { kind: 'text', text: `${prefix}\n\n${card.text}` },
                ...(card.surfaceResponse.blocks || []).filter((b) => b.kind === 'actions'),
              ],
            },
            { maxActionsPerRow: 2 },
          );
        } catch {
          await ctx.reply(`${prefix}\n\n${card.text}`);
        }
        return;
      }
      await ctx.reply(this.formatProductModeReply(modeSnap, escalationSnapshot));
      return;
    }

    if (
      normalizedArgs === 'approve' ||
      normalizedArgs === 'reject' ||
      normalizedArgs.startsWith('approve ') ||
      normalizedArgs.startsWith('reject ')
    ) {
      if (!this.deps.modeEscalationService) {
        await ctx.reply(tService('desktop.mode_escalation_unavailable'));
        return;
      }
      const parts = rawArgs.split(/\s+/).filter(Boolean);
      const decision = parts[0]?.toLowerCase() === 'reject' ? 'reject' : 'approve';
      // Tokens after decision may be: bare | 1 | once|session|host | id | id scope
      const rest = parts.slice(1);
      let requestId = '';
      let scopeToken = '';
      if (rest.length === 0) {
        requestId = '';
      } else if (/^(once|session|host)$/i.test(rest[0])) {
        scopeToken = rest[0];
        requestId = '';
      } else if (/^#?\d{1,2}$/.test(rest[0]) && rest[1] && /^(once|session|host)$/i.test(rest[1])) {
        requestId = rest[0];
        scopeToken = rest[1];
      } else if (/^#?\d{1,2}$/.test(rest[0])) {
        requestId = rest[0];
        scopeToken = rest[1] || '';
      } else if (/^(once|session|host)$/i.test(rest[1] || '')) {
        requestId = rest[0];
        scopeToken = rest[1];
      } else {
        requestId = rest[0] || '';
        scopeToken = rest[1] || '';
      }
      try {
        const normalizedScope =
          scopeToken === 'session' || scopeToken === 'host' ? scopeToken : scopeToken === 'once' ? 'once' : null;
        const result = this.deps.modeEscalationService.resolveRequest({
          requestId,
          decision,
          scope: normalizedScope,
          requestedBy: String(ctx.userId || '').trim() || 'operator',
          sessionId,
        });
        await ctx.reply(this.formatModeEscalationResolution(result));
      } catch (error: unknown) {
        await ctx.reply(errorMessage(error, tSurface('error_mode_escalation')));
      }
      return;
    }

    try {
      const snapshot = this.deps.capabilityLifecycleService.setProductMode(
        normalizedArgs,
        String(ctx.userId || '').trim() || 'operator',
      );
      await ctx.reply(
        [this.formatProductModeReply(snapshot, escalationSnapshot), '', tService('desktop.recommend_restart')].join(
          '\n',
        ),
      );
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_product_mode')));
    }
  }

  private extractWorkspaceOption(tokens: string[]): { workspaceHint: string | null; tokens: string[] } {
    const nextTokens = [...tokens];
    const workspaceIndex = nextTokens.indexOf('--workspace');
    if (workspaceIndex < 0) {
      return {
        workspaceHint: null,
        tokens: nextTokens,
      };
    }

    const workspaceHint = String(nextTokens[workspaceIndex + 1] || '').trim() || null;
    nextTokens.splice(workspaceIndex, 2);
    return {
      workspaceHint,
      tokens: nextTokens,
    };
  }

  private resolveWorkspacePresetId(raw: string): string | null {
    const normalized = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-');
    if (!normalized) {
      return null;
    }
    const aliases: Record<string, string> = {
      zavorthbridge: 'zavorthBridge',
      'zavorth-bridge': 'zavorthBridge',
      bridge: 'zavorthBridge',
      vscode: 'vscode',
      'vscode-derivative': 'vscode-derivative',
      derivative: 'vscode-derivative',
      fork: 'vscode-derivative',
    };
    return aliases[normalized] || null;
  }

  public async handleWorkspace(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.workspaceOptimizerService) {
      await ctx.reply(tService('desktop.workspace_optimizer_unavailable'));
      return;
    }

    const extracted = this.extractWorkspaceOption(
      String(args || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    );
    const tokens = extracted.tokens;
    const command = String(tokens[0] || 'doctor')
      .trim()
      .toLowerCase();
    const requestedBy = String(ctx.userId || '').trim() || 'operator';

    try {
      if (command === 'help' || command === 'ajuda' || command === '?') {
        await ctx.reply(
          [
            'Workspace optimizer',
            '',
            '/workspace',
            '  → doctor / load profile for the current workspace',
            '/workspace <path-or-hint>',
            '  → doctor for that workspace',
            '/workspace <zavorthBridge|vscode|vscode-derivative>',
            '  → preview optimize with that preset',
            '',
            'Power forms:',
            '/workspace optimize <preset> [--workspace <path>]',
            '/workspace optimize <preset> apply <planId>',
          ].join('\n'),
        );
        return;
      }

      if (command === 'doctor' || command === 'status') {
        const profile = await this.deps.workspaceOptimizerService.buildLoadProfile({
          workspaceHint: extracted.workspaceHint || tokens.slice(1).join(' ').trim() || null,
        });
        await ctx.reply(this.deps.workspaceOptimizerService.renderLoadProfile(profile));
        return;
      }

      if (command === 'optimize') {
        const presetId = this.resolveWorkspacePresetId(String(tokens[1] || '')) || String(tokens[1] || '').trim();
        if (!presetId) {
          await ctx.reply(
            [
              'Preview a workspace optimization.',
              '',
              '/workspace <zavorthBridge|vscode|vscode-derivative>',
              '  Ex.: /workspace zavorthBridge',
              'Power form: /workspace optimize <preset> [--workspace <path>]',
            ].join('\n'),
          );
          return;
        }
        if (
          String(tokens[2] || '')
            .trim()
            .toLowerCase() === 'apply'
        ) {
          const planId = String(tokens[3] || '').trim();
          if (!planId) {
            await ctx.reply(
              [
                'Apply an approved workspace optimization plan.',
                '',
                '/workspace optimize <preset> apply <planId>',
              ].join('\n'),
            );
            return;
          }
          const result = await this.deps.workspaceOptimizerService.applyOptimization({
            planId,
            requestedBy,
            sourceSurface: ctx.platform,
          });
          await ctx.reply(this.deps.workspaceOptimizerService.renderApplyResult(result));
          return;
        }

        const preview = await this.deps.workspaceOptimizerService.previewOptimization({
          presetId: presetId as any,
          workspaceHint: extracted.workspaceHint,
          requestedBy,
          sourceSurface: ctx.platform,
        });
        await ctx.reply(this.deps.workspaceOptimizerService.renderPreview(preview));
        return;
      }

      // Free-text primary path:
      // - known preset name → optimize preview
      // - otherwise treat the free text as a workspace path/hint for doctor
      const freePreset = this.resolveWorkspacePresetId(command) || this.resolveWorkspacePresetId(tokens.join(' '));
      if (freePreset) {
        const preview = await this.deps.workspaceOptimizerService.previewOptimization({
          presetId: freePreset as any,
          workspaceHint: extracted.workspaceHint,
          requestedBy,
          sourceSurface: ctx.platform,
        });
        await ctx.reply(this.deps.workspaceOptimizerService.renderPreview(preview));
        return;
      }

      const freeHint = extracted.workspaceHint || tokens.join(' ').trim() || null;
      const profile = await this.deps.workspaceOptimizerService.buildLoadProfile({
        workspaceHint: freeHint,
      });
      await ctx.reply(this.deps.workspaceOptimizerService.renderLoadProfile(profile));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_workspace_optimizer')));
    }
  }

  public async handleCompanion(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.companionControlService) {
      await ctx.reply(tService('desktop.companion_control_unavailable'));
      return;
    }

    const tokens = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const command = String(tokens[0] || 'list')
      .trim()
      .toLowerCase();
    const companionId = String(tokens[1] || '')
      .trim()
      .toLowerCase();
    const force = tokens.includes('--force');
    const dryRun = tokens.includes('--dry-run');

    try {
      if (command === 'list' || command === 'status') {
        const snapshot = await this.deps.companionControlService.buildSnapshot({ preferCachedWithinMs: 15_000 });
        await ctx.reply(this.deps.companionControlService.renderSnapshot(snapshot));
        return;
      }

      if (command === 'inspect') {
        if (!companionId) {
          await ctx.reply(
            ['Inspect a companion.', '', '/companion inspect <wsl|docker-desktop|zavorthBridge|codex-companion>'].join(
              '\n',
            ),
          );
          return;
        }
        const companion = await this.deps.companionControlService.inspectCompanion(companionId as any, {
          preferCachedWithinMs: 15_000,
        });
        await ctx.reply(this.deps.companionControlService.renderCompanion(companion));
        return;
      }

      if (command === 'optimize') {
        if (!this.deps.workspaceOptimizerService) {
          await ctx.reply(tService('desktop.workspace_optimizer_unavailable'));
          return;
        }
        const presetId = companionId;
        if (!presetId) {
          await ctx.reply(
            [
              'Optimize a companion workspace preset.',
              '',
              '/companion optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>] [--workspace <path>]',
            ].join('\n'),
          );
          return;
        }
        const extracted = this.extractWorkspaceOption(tokens.slice(2));
        if (
          String(extracted.tokens[0] || '')
            .trim()
            .toLowerCase() === 'apply'
        ) {
          const planId = String(extracted.tokens[1] || '').trim();
          if (!planId) {
            await ctx.reply(
              [
                'Apply an approved companion optimization plan.',
                '',
                '/companion optimize <preset> apply <planId>',
              ].join('\n'),
            );
            return;
          }
          const result = await this.deps.workspaceOptimizerService.applyOptimization({
            planId,
            requestedBy: String(ctx.userId || '').trim() || null,
            sourceSurface: ctx.platform,
          });
          await ctx.reply(this.deps.workspaceOptimizerService.renderApplyResult(result));
          return;
        }
        const preview = await this.deps.workspaceOptimizerService.previewOptimization({
          presetId: presetId as any,
          workspaceHint: extracted.workspaceHint,
          requestedBy: String(ctx.userId || '').trim() || null,
          sourceSurface: ctx.platform,
        });
        await ctx.reply(this.deps.workspaceOptimizerService.renderPreview(preview));
        return;
      }

      if (
        command === 'hibernate' ||
        command === 'resume' ||
        command === 'stop-idle' ||
        command === 'trim' ||
        command === 'restart-safe'
      ) {
        if (!companionId) {
          await ctx.reply(
            [
              'Control a companion lifecycle action.',
              '',
              `/companion ${command} <companion> [--force] [--dry-run]`,
            ].join('\n'),
          );
          return;
        }
        const result = await this.deps.companionControlService.executeAction({
          companionId: companionId as any,
          actionId: command as any,
          requestedBy: String(ctx.userId || '').trim() || null,
          force,
          dryRun,
        });
        await ctx.reply(this.deps.companionControlService.renderActionResult(result));
        return;
      }

      await ctx.reply(
        [
          'Companion control plane',
          '',
          '/companion',
          '  → list companions',
          '/companion inspect <id>',
          '/companion <hibernate|resume|stop-idle|trim|restart-safe> <id>',
        ].join('\n'),
      );
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_companion_plane')));
    }
  }
}
