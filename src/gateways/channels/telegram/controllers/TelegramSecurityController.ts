import { Bot, Context } from 'grammy';
import { ChatCleanupService } from '@zavorth/services/ChatCleanupService.js';
import { HostIdentityService } from '@zavorth/services/HostIdentityService.js';
import {
  RuntimeAccessManifestService,
  type RuntimeAccessManifest,
} from '@zavorth/runtime/access/RuntimeAccessManifestService.js';
import { SecurityLockService } from '@zavorth/services/SecurityLockService.js';
import { SystemCleanupService } from '@zavorth/services/SystemCleanupService.js';
import { t } from '../../../../gateways/channels/telegram/i18n.js';
import { logger } from '../../../../logger';

export class TelegramSecurityController {
  constructor(
    private bot: Bot,
    private systemCleanup: SystemCleanupService,
    private chatCleanup: ChatCleanupService,
    private securityLock: SecurityLockService,
    private hostIdentityService?: HostIdentityService,
    private runtimeAccessManifestService: Pick<RuntimeAccessManifestService, 'buildManifest'> = new RuntimeAccessManifestService(),
  ) {}

  public async handleCleanup(ctx: Context): Promise<void> {
    try {
      await ctx.reply(`${t('security.deep_clean_started')} All non-essential apps will be closed.`);
      const result = await this.systemCleanup.cleanup({ shutdownWsl: true });

      let reply = result.message;

      if (result.killed.length > 0) {
        const killedList = result.killed.slice(0, 20).join('\n  ');
        reply += `\n\nProcesses terminated:\n  ${killedList}`;
        if (result.killed.length > 20) {
          reply += `\n  ...and ${result.killed.length - 20} more processes.`;
        }
      }

      if (result.wslShutdown) {
        reply += '\n\nWSL was also shut down to free RAM.';
      }

      if (result.warnings.length > 0) {
        reply += `\n\nWarnings:\n  ${result.warnings.slice(0, 5).join('\n  ')}`;
      }

      await ctx.reply(reply);
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(t('security.cleanup_error', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  public async handleClear(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id.toString() || '';
      const tracked = this.chatCleanup.getTrackedCount(chatId);

      if (tracked === 0) {
        await ctx.reply(t('security.clear_empty'));
        return;
      }

      await ctx.reply(t('security.clear_deleting', { count: String(tracked) }));
      const result = await this.chatCleanup.clearChat(this.bot, chatId);
      await ctx.reply(result.message);
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(t('security.clear_error', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  public async handleLock(ctx: Context, args: string): Promise<void> {
    try {
      const parts = String(args || '').trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();

      if (subcommand === 'set' || subcommand === 'config') {
        const password = parts.slice(1).join(' ');
        if (!password || password.length < 4) {
          await ctx.reply(t('security.lock_password_min'));
          return;
        }

        this.securityLock.setPassword(password);
        await this.autoDeleteMessage(ctx);
        await ctx.reply(t('security.password_set'));
        return;
      }

      if (!this.securityLock.isPasswordConfigured()) {
        await ctx.reply(t('security.password_required'));
        return;
      }

      const state = this.securityLock.lock(ctx.from?.id.toString());
      await ctx.reply(
        `${t('security.lock_success', { lockedAt: state.lockedAt || '' })}`,
      );
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(t('security.lock_error', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  public async handleUnlock(ctx: Context, args: string): Promise<void> {
    try {
      if (!this.securityLock.isLocked()) {
        await ctx.reply(t('security.not_locked'));
        return;
      }

      const password = String(args || '').trim();
      if (!password) {
        await ctx.reply(t('security.unlock_usage'));
        return;
      }

      await this.autoDeleteMessage(ctx);
      const success = this.securityLock.unlock(password);

      if (success) {
        const reply = await ctx.reply(t('security.unlocked'));
        setTimeout(async () => {
          try {
            await this.bot.api.deleteMessage(ctx.chat!.id, reply.message_id);
          } catch (error: any) { const err = error; const e = error;
      // Ignore follow-up deletion failures.
      logger.warn('[Telegram Security] delete operation failed', error);
    }
        }, 5000);
      } else {
        await ctx.reply(t('security.wrong_password'));
      }
    } catch (error: any) { const err = error; const e = error;
      await ctx.reply(t('security.unlock_error', { error: error instanceof Error ? error.message : String(error) }));
    }
  }

  public async handleHostAuth(ctx: Context, args: string): Promise<void> {
    if (!this.hostIdentityService) {
      await ctx.reply(t('security.host_unavailable'));
      return;
    }

    const subcommand = String(args || '').trim().split(/\s+/)[0]?.toLowerCase() || 'status';
    if (subcommand === 'trust' || subcommand === 'authorize' || subcommand === 'reauthorize') {
      const payload = this.hostIdentityService.authorizeCurrentHost();
      const manifest = await this.runtimeAccessManifestService.buildManifest();
      await ctx.reply(
        [
          'Host reautorizado.',
          `Fingerprint: ${payload.fingerprint}`,
          `Hostname: ${payload.hostname}`,
          `Autorizado em: ${payload.authorizedAt}`,
          '',
          this.formatAccessManifestReply(manifest, 'trusted'),
        ].join('\n'),
      );
      return;
    }

    const status = this.hostIdentityService.getStatus();
    const manifest = await this.runtimeAccessManifestService.buildManifest();
    await ctx.reply(this.formatAccessManifestReply(manifest, 'status', status));
  }

  private formatAccessManifestReply(
    manifest: RuntimeAccessManifest,
    mode: 'status' | 'trusted',
    hostStatus: ReturnType<HostIdentityService['getStatus']> | null = null,
  ): string {
    const appSurface = manifest.surfaces.find((entry) => entry.id === 'control') || null;
    const telegramSurface = manifest.surfaces.find((entry) => entry.id === 'telegram') || null;
    const lines = [
      mode === 'trusted' ? 'Host access updated:' : 'Host access status:',
      `Summary: ${manifest.summary}`,
      `Host authorized: ${manifest.auth.authorizedHost === false ? 'no' : 'yes'}`,
      `Local: ${manifest.local.ready ? 'ready' : 'pending'} | ${manifest.local.appUrl}`,
      `Remote: ${manifest.remote.ready ? 'ready' : 'pending'} | ${manifest.remote.appUrl || 'not configured'}`,
    ];

    if (hostStatus) {
      lines.push(
        `First run: ${hostStatus.firstRun ? 'yes' : 'no'}`,
        `Current fingerprint: ${hostStatus.currentFingerprint}`,
        `Stored fingerprint: ${hostStatus.storedFingerprint || 'none'}`,
      );
    }

    lines.push('');
    lines.push('Recommended entries:');
    if (appSurface) {
      lines.push(`- ${appSurface.label}: ${appSurface.entry}`);
    }
    if (telegramSurface) {
      lines.push(`- ${telegramSurface.label}: ${telegramSurface.entry}`);
    }
    lines.push(`- CLI: ${manifest.commands.access}`);

    if (manifest.nextSteps.length > 0) {
      lines.push('');
      lines.push('Proximos passos:');
      for (const step of manifest.nextSteps.slice(0, 4)) {
        lines.push(`- ${step.title}: ${step.description}`);
      }
    }

    lines.push('');
    lines.push('Comandos:');
    lines.push(`- ${manifest.commands.start}`);
    lines.push(`- ${manifest.commands.remote}`);
    lines.push(`- ${manifest.commands.trust}`);

    return lines.join('\n');
  }

  private async autoDeleteMessage(ctx: Context): Promise<void> {
    try {
      if (ctx.chat && ctx.message) {
        await this.bot.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      }
    } catch (error: any) { const err = error; const e = error;
      // Ignore missing permissions or messages already removed.
      logger.warn('[Telegram Security] delete operation failed', error);
    }
  }
}
