import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ModeEscalationResolution, ModeEscalationSnapshot } from '../../../../contracts/ModeEscalationContract.js';
import type { ZavorthProductModeSnapshot } from '../../../../services/ProductModeService.js';
import type { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import type { CompanionControlService } from '../../../../services/CompanionControlService.js';
import type { CompanionWorkspaceOptimizerService } from '../../../../services/CompanionWorkspaceOptimizerService.js';
import type { DesktopResourcePlaneService } from '../../../../services/DesktopResourcePlaneService.js';
import type { ModeEscalationService } from '../../../../services/ModeEscalationService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
type SharedSurfaceDesktopCommandPackDeps = {

  desktopResourcePlaneService: Pick<DesktopResourcePlaneService, 'inspectLive' | 'renderReport'> | null;

  capabilityLifecycleService: Pick<CapabilityLifecycleService, 'buildProductModeSnapshot' | 'setProductMode'> | null;
  companionControlService: Pick<
    CompanionControlService,
    'buildSnapshot' | 'inspectCompanion' | 'executeAction' | 'renderSnapshot' | 'renderCompanion' | 'renderActionResult'
  > | null;
  workspaceOptimizerService: Pick<
    CompanionWorkspaceOptimizerService,
    'buildLoadProfile' | 'previewOptimization' | 'applyOptimization' | 'renderLoadProfile' | 'renderPreview' | 'renderApplyResult'
  > | null;
  modeEscalationService: Pick<ModeEscalationService, 'buildSnapshot' | 'resolveRequest'> | null;
};

export class SharedSurfaceDesktopCommandPack {
  public constructor(private readonly deps: SharedSurfaceDesktopCommandPackDeps) {}

  public async handleDoctor(ctx: IMessageContext, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();
    const target = normalized.split(/\s+/).filter(Boolean)[0] || 'desktop';

    if (target !== 'desktop') {
      await ctx.reply('Use /doctor desktop para revisar RAM, CPU, WSL, Docker e companions.');
      return;
    }

    if (!this.deps.desktopResourcePlaneService) {
      await ctx.reply('Desktop Resource Plane indisponivel neste runtime.');
      return;
    }

    try {
      const snapshot = await this.deps.desktopResourcePlaneService.inspectLive({ preferCachedWithinMs: 15_000 });
      await ctx.reply(this.deps.desktopResourcePlaneService.renderReport(snapshot));
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui montar o Desktop Resource Plane agora.'));
    }
  }

  private formatProductModeReply(
    snapshot: ZavorthProductModeSnapshot,
    modeEscalation: ModeEscalationSnapshot | null = null,
  ): string {
    const visible = snapshot.visibleSurfaces.join(', ') || 'chat';
    const hidden = snapshot.hiddenByDefault.join(', ') || 'nada';
    const possibleEscalations = snapshot.escalationTargets.length > 0
      ? snapshot.escalationTargets.join(', ')
      : 'nenhuma';
    const lines = [
      `${snapshot.label}`,
      '',
      snapshot.summary,
      '',
      `Modo atual: ${snapshot.id}`,
      `Perfil base esperado: ${snapshot.defaultRuntimeProfile}`,
      `Perfil ativo agora: ${snapshot.runtimeProfile}${snapshot.profileAligned ? ' (alinhado)' : ' (fora do baseline do modo)'}`,
      `Superficies visiveis por padrao: ${visible}`,
      `Escondido por padrao: ${hidden}`,
      `Escalonamentos possiveis: ${possibleEscalations}`,
      `Comandos: ${snapshot.commands.show} | ${snapshot.commands.set}`,
      `CLI: ${snapshot.commands.cliStatus} | ${snapshot.commands.cliSet}`,
    ];
    if (modeEscalation) {
      lines.push('', `Modo efetivo agora: ${modeEscalation.effectiveMode.id}.`);
      if (modeEscalation.pendingRequest) {
        lines.push(
          `Mode escalation pendente: ${modeEscalation.pendingRequest.id}`,
          modeEscalation.pendingRequest.summary,
          `Aprove com: ${modeEscalation.commands.approve.replace('<requestId>', modeEscalation.pendingRequest.id)}`,
          `Rejeite com: ${modeEscalation.commands.reject.replace('<requestId>', modeEscalation.pendingRequest.id)}`,
        );
      } else if (modeEscalation.activeGrants.length > 0) {
        const grant = modeEscalation.activeGrants[0];
        lines.push(
          `Grant ativo: ${grant.targetMode} (${grant.scope})`,
          `Motivo: ${grant.reason}`,
        );
      }
    }
    return lines.join('\n');
  }

  private formatModeEscalationResolution(result: ModeEscalationResolution): string {
    const grantLine = result.grant
      ? `Grant: ${result.grant.targetMode} (${result.grant.scope}).`
      : 'Nenhum grant ativo foi criado.';
    return [
      result.summary,
      '',
      grantLine,
      `Modo efetivo: ${result.snapshot.effectiveMode.id}.`,
      result.request.fallback ? `Fallback leve: ${result.request.fallback}` : null,
    ].filter(Boolean).join('\n');
  }

  public async handleProductMode(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.capabilityLifecycleService?.buildProductModeSnapshot || !this.deps.capabilityLifecycleService?.setProductMode) {
      await ctx.reply('Product mode indisponivel neste runtime.');
      return;
    }

    const rawArgs = String(args || '').trim();
    const normalizedArgs = rawArgs.toLowerCase();
    const sessionId = String(ctx.threadId || ctx.channelId || ctx.chatId || '').trim() || 'shared-surface';
    const escalationSnapshot = this.deps.modeEscalationService?.buildSnapshot(sessionId) || null;

    if (!normalizedArgs) {
      await ctx.reply(this.formatProductModeReply(this.deps.capabilityLifecycleService.buildProductModeSnapshot(), escalationSnapshot));
      return;
    }

    if (normalizedArgs.startsWith('approve ') || normalizedArgs.startsWith('reject ')) {
      if (!this.deps.modeEscalationService) {
        await ctx.reply('Mode escalation indisponivel neste runtime.');
        return;
      }
      const parts = rawArgs.split(/\s+/).filter(Boolean);
      const decision = parts[0]?.toLowerCase() === 'reject' ? 'reject' : 'approve';
      const requestId = String(parts[1] || '').trim();
      const scope = decision === 'approve' ? String(parts[2] || '').trim().toLowerCase() : null;
      if (!requestId) {
        await ctx.reply('Use /mode approve <requestId> [once|session|host] ou /mode reject <requestId>.');
        return;
      }
      try {
        const normalizedScope =
          scope === 'session' || scope === 'host'
            ? scope
            : scope === 'once'
              ? 'once'
              : null;
        const result = this.deps.modeEscalationService.resolveRequest({
          requestId,
          decision,
          scope: normalizedScope,
          requestedBy: String(ctx.userId || '').trim() || 'operator',
        });
        await ctx.reply(this.formatModeEscalationResolution(result));
      } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui resolver o mode escalation agora.'));
      }
      return;
    }

    try {
      const snapshot = this.deps.capabilityLifecycleService.setProductMode(
        normalizedArgs,
        String(ctx.userId || '').trim() || 'operator',
      );
      await ctx.reply(
        [
          this.formatProductModeReply(snapshot, escalationSnapshot),
          '',
          'Recomendacao: reinicie o Zavorth quando quiser reaplicar boot, warmup e surfaces de acordo com o novo modo.',
        ].join('\n'),
      );
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui trocar o product mode agora.'));
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

  public async handleWorkspace(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.workspaceOptimizerService) {
      await ctx.reply('Workspace Optimizer indisponivel neste runtime.');
      return;
    }

    const extracted = this.extractWorkspaceOption(String(args || '').trim().split(/\s+/).filter(Boolean));
    const tokens = extracted.tokens;
    const command = String(tokens[0] || 'doctor').trim().toLowerCase();
    const requestedBy = String(ctx.userId || '').trim() || 'operator';

    try {
      if (command === 'doctor' || command === 'status') {
        const profile = await this.deps.workspaceOptimizerService.buildLoadProfile({
          workspaceHint: extracted.workspaceHint,
        });
        await ctx.reply(this.deps.workspaceOptimizerService.renderLoadProfile(profile));
        return;
      }

      if (command === 'optimize') {
        const presetId = String(tokens[1] || '').trim().toLowerCase();
        if (!presetId) {
          await ctx.reply('Uso: /workspace optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>] [--workspace <path>]');
          return;
        }
        if (String(tokens[2] || '').trim().toLowerCase() === 'apply') {
          const planId = String(tokens[3] || '').trim();
          if (!planId) {
            await ctx.reply('Uso: /workspace optimize <preset> apply <planId>');
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

      await ctx.reply('Uso: /workspace [doctor|optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>]]');
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui operar o Workspace Optimizer agora.'));
    }
  }

  public async handleCompanion(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.companionControlService) {
      await ctx.reply('Companion Control Plane indisponivel neste runtime.');
      return;
    }

    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const command = String(tokens[0] || 'list').trim().toLowerCase();
    const companionId = String(tokens[1] || '').trim().toLowerCase();
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
          await ctx.reply('Uso: /companion inspect <wsl|docker-desktop|zavorthBridge|codex-companion>');
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
          await ctx.reply('Workspace Optimizer indisponivel neste runtime.');
          return;
        }
        const presetId = companionId;
        if (!presetId) {
          await ctx.reply('Uso: /companion optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>] [--workspace <path>]');
          return;
        }
        const extracted = this.extractWorkspaceOption(tokens.slice(2));
        if (String(extracted.tokens[0] || '').trim().toLowerCase() === 'apply') {
          const planId = String(extracted.tokens[1] || '').trim();
          if (!planId) {
            await ctx.reply('Uso: /companion optimize <preset> apply <planId>');
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
        command === 'hibernate'
        || command === 'resume'
        || command === 'stop-idle'
        || command === 'trim'
        || command === 'restart-safe'
      ) {
        if (!companionId) {
          await ctx.reply('Uso: /companion <hibernate|resume|stop-idle|trim|restart-safe> <companion> [--force] [--dry-run]');
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

      await ctx.reply('Uso: /companion [list|inspect <id>|hibernate <id>|resume <id>|stop-idle <id>|trim <id>|restart-safe <id>]');
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui operar o Companion Control Plane agora.'));
    }
  }

}
