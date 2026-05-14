import { Bot, Context } from 'grammy';
import { ChatCleanupService } from '../../services/ChatCleanupService.js';
import { HostIdentityService } from '../../services/HostIdentityService.js';
import {
  RuntimeAccessManifestService,
  type RuntimeAccessManifest,
} from '../../runtime/access/RuntimeAccessManifestService.js';
import { SecurityLockService } from '../../services/SecurityLockService.js';
import { SystemCleanupService } from '../../services/SystemCleanupService.js';

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
      await ctx.reply('Iniciando limpeza profunda do sistema... Todos os apps nao-essenciais serao fechados.');
      const result = await this.systemCleanup.cleanup({ shutdownWsl: true });

      let reply = result.message;

      if (result.killed.length > 0) {
        const killedList = result.killed.slice(0, 20).join('\n  ');
        reply += `\n\nProcessos encerrados:\n  ${killedList}`;
        if (result.killed.length > 20) {
          reply += `\n  ...e mais ${result.killed.length - 20} processos.`;
        }
      }

      if (result.wslShutdown) {
        reply += '\n\nWSL tambem foi desligado para liberar RAM.';
      }

      if (result.warnings.length > 0) {
        reply += `\n\nAvisos:\n  ${result.warnings.slice(0, 5).join('\n  ')}`;
      }

      await ctx.reply(reply);
    } catch (error: any) {
      await ctx.reply(`Erro na limpeza: ${error.message}`);
    }
  }

  public async handleClear(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id.toString() || '';
      const tracked = this.chatCleanup.getTrackedCount(chatId);

      if (tracked === 0) {
        await ctx.reply(
          'Nenhuma mensagem rastreada para apagar.\nNota: so consigo apagar mensagens enviadas desde a ultima vez que o bot iniciou.',
        );
        return;
      }

      await ctx.reply(`Apagando ${tracked} mensagem(ns)...`);
      const result = await this.chatCleanup.clearChat(this.bot, chatId);
      await ctx.reply(result.message);
    } catch (error: any) {
      await ctx.reply(`Erro ao limpar chat: ${error.message}`);
    }
  }

  public async handleLock(ctx: Context, args: string): Promise<void> {
    try {
      const parts = String(args || '').trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();

      if (subcommand === 'set' || subcommand === 'config') {
        const password = parts.slice(1).join(' ');
        if (!password || password.length < 4) {
          await ctx.reply('A senha deve ter pelo menos 4 caracteres.\nUso: /lock set <sua_senha>');
          return;
        }

        this.securityLock.setPassword(password);
        await this.autoDeleteMessage(ctx);
        await ctx.reply('\u{1F512} Senha configurada com sucesso.\nAgora use /lock para trancar o Zavorth.');
        return;
      }

      if (!this.securityLock.isPasswordConfigured()) {
        await ctx.reply('Voce precisa configurar uma senha primeiro.\nUso: /lock set <sua_senha>');
        return;
      }

      const state = this.securityLock.lock(ctx.from?.id.toString());
      await ctx.reply(
        `\u{1F512} Zavorth trancado com sucesso.\n` +
        `Trancado em: ${state.lockedAt}\n\n` +
        `Todos os comandos de execucao estao bloqueados.\n` +
        `Use /unlock <senha> para destrancar.`,
      );
    } catch (error: any) {
      await ctx.reply(`Erro ao trancar: ${error.message}`);
    }
  }

  public async handleUnlock(ctx: Context, args: string): Promise<void> {
    try {
      if (!this.securityLock.isLocked()) {
        await ctx.reply('\u{1F513} O Zavorth nao esta trancado.');
        return;
      }

      const password = String(args || '').trim();
      if (!password) {
        await ctx.reply('Use: /unlock <sua_senha>');
        return;
      }

      await this.autoDeleteMessage(ctx);
      const success = this.securityLock.unlock(password);

      if (success) {
        const reply = await ctx.reply('\u{1F513} Zavorth destrancado com sucesso. Todos os comandos reativados.');
        setTimeout(async () => {
          try {
            await this.bot.api.deleteMessage(ctx.chat!.id, reply.message_id);
          } catch {
            // Ignore follow-up deletion failures.
          }
        }, 5000);
      } else {
        await ctx.reply('\u{274C} Senha incorreta.');
      }
    } catch (error: any) {
      await ctx.reply(`Erro ao destrancar: ${error.message}`);
    }
  }

  public async handleHostAuth(ctx: Context, args: string): Promise<void> {
    if (!this.hostIdentityService) {
      await ctx.reply('Servico de autorizacao de host indisponivel neste runtime.');
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
      mode === 'trusted' ? 'Acesso do host atualizado:' : 'Estado de acesso do host:',
      `Resumo: ${manifest.summary}`,
      `Host autorizado: ${manifest.auth.authorizedHost === false ? 'nao' : 'sim'}`,
      `Local: ${manifest.local.ready ? 'pronto' : 'pendente'} | ${manifest.local.appUrl}`,
      `Remoto: ${manifest.remote.ready ? 'pronto' : 'pendente'} | ${manifest.remote.appUrl || 'nao configurado'}`,
    ];

    if (hostStatus) {
      lines.push(
        `Primeira execucao: ${hostStatus.firstRun ? 'sim' : 'nao'}`,
        `Fingerprint atual: ${hostStatus.currentFingerprint}`,
        `Fingerprint armazenado: ${hostStatus.storedFingerprint || 'nenhum'}`,
      );
    }

    lines.push('');
    lines.push('Entradas recomendadas:');
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
    } catch {
      // Ignore missing permissions or messages already removed.
    }
  }
}
