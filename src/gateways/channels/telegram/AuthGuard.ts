import { logger } from '../../../logger.js';
import { Context, NextFunction } from 'grammy';
import { config } from '../../../config/index.js';
import { normalizeTelegramCommandToken } from '../../../gateways/channels/telegram/CommandParser.js';
import { HostIdentityService } from '../../../services/HostIdentityService.js';
import { getExplicitExecutorForCommand } from '../../../gateways/channels/telegram/commandCatalog.js';
import {
  EXTERNAL_EXECUTOR_COMMAND,
  EXTERNAL_REVIEW_COMMAND,
  EXTERNAL_REVIEW_DASH_COMMAND,
  LEGACY_EXTERNAL_COMMAND,
  LEGACY_EXTERNAL_REVIEW_COMMAND,
  LEGACY_EXTERNAL_REVIEW_DASH_COMMAND,
} from '../../../gateways/channels/telegram/ExternalExecutorIdentity.js';

export class AuthGuard {
  private static readonly FUN_COMMANDS = ['/roll', '/coinflip', '/8ball', '/joke', '/roulette'];
  private static readonly READ_ONLY_ALLOWED_COMMANDS = new Set([
    '/start', '/help', '/menu', '/zavorth', '/settings', '/status', '/dashboard',
    '/tasks', '/logs', '/files', '/diff', '/research', '/deepresearch',
    '/memory', '/recall', '/snippets', '/snippet', '/remember', '/forget',
    '/hostauth', '/changes', '/access', '/bootstrap', '/doctor',
  ]);

  private static readonly GROUP_ADMIN_COMMANDS = new Set([
    '/ban', '/kick', '/mute', '/unmute', '/warn', '/warns', '/clearwarns',
    '/regras', '/stats', '/setwelcome', '/setbye', '/antispam', '/filter',
  ]);

  private static readonly BLOCKED_COMMANDS_FOR_VICE_OWNER = new Set([
    '/codex',
    EXTERNAL_EXECUTOR_COMMAND,
    EXTERNAL_REVIEW_DASH_COMMAND,
    EXTERNAL_REVIEW_COMMAND,
    LEGACY_EXTERNAL_COMMAND,
    LEGACY_EXTERNAL_REVIEW_DASH_COMMAND,
    LEGACY_EXTERNAL_REVIEW_COMMAND,
    '/selfmod',
    '/selfupdate',
    '/reload',
    '/autorepair',
    '/repair',
    '/ag',
    '/bridge',
    '/run',
    '/plan',
    '/wsl',
    '/companion',
    '/cleanup',
    '/mode',
    '/model',
    '/profile',
    '/enable',
    '/disable',
    '/workspace',
    '/remote',
    '/remoto',
    '/schedule',
    '/schedules',
    '/unschedule',
    '/automations',
    '/perm',
    '/permallow',
    '/permrevoke',
    '/lock',
    '/unlock',
    '/hostauth',
    '/agfocus',
    '/agaccept',
    '/agnudge',
    '/agbridge',
    '/agclean',
    '/agreset',
    '/agmodel',
    '/ag_open',
    '/ag_status',
    '/ag_restart',
    '/ag_model',
    '/ag_prompt',
    '/approve',
    '/reject',
    '/undo',
    '/tasks',
    '/logs',
    '/files',
    '/diff',
  ]);

  static middleware(hostIdentityService?: HostIdentityService) {
    return async (ctx: Context, next: NextFunction) => {
      const chat_id = ctx.chat?.id.toString();
      const user_id = ctx.from?.id.toString();
      const text = ctx.message?.text || '';
      const normalizedCommand = normalizeTelegramCommandToken(text.split(' ')[0] || '');
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      const isServiceMessage = AuthGuard.isGroupServiceMessage(ctx);
      const isGroupMessageUpdate = Boolean(ctx.message);

      if (!chat_id) {
        logger.warn('[Security] Rejeitado: chat_id nulo.');
        return;
      }

      if (!user_id) {
        if (isGroup && isServiceMessage) {
          await next();
          return;
        }
        logger.warn('[Security] Rejeitado: chat_id ou user_id nulo.');
        return;
      }

      if (
        hostIdentityService &&
        !hostIdentityService.getStatus().authorized &&
        AuthGuard.isMutableCommandWhileHostReadonly(normalizedCommand, text)
      ) {
        await ctx.reply(
          'Host novo detectado. O Zavorth entrou em modo somente leitura ate reautorizacao.\nUse `/hostauth status` para inspecionar e `/hostauth trust` no host atual para liberar execucao.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      if (!config.allowedUserIds.includes(user_id)) {
        const isFunCommand = AuthGuard.FUN_COMMANDS.includes(normalizedCommand);

        if (isFunCommand) {
          await next();
          return;
        }

        if (isGroup && (isServiceMessage || (isGroupMessageUpdate && !text.startsWith('/')))) {
          await next();
          return;
        }

        // Permitir comandos de administracao de grupo para admins do Telegram
        if (isGroup && text.startsWith('/')) {
          const commandType = normalizedCommand;
          if (AuthGuard.GROUP_ADMIN_COMMANDS.has(commandType)) {
            try {
              const member = await ctx.api.getChatMember(ctx.chat!.id, Number(user_id));
              if (member.status === 'administrator' || member.status === 'creator') {
                await next();
                return;
              }
            } catch {
              // Se falhar a verificacao, negar acesso
            }
            await ctx.reply('⚠️ Apenas administradores do grupo podem usar este comando.', { reply_to_message_id: ctx.message?.message_id });
            return;
          }
        }

        logger.warn(`[Security] Acesso nao autorizado de user_id: ${user_id} e chat_id: ${chat_id}`);

        if (isGroup && text.startsWith('/')) {
          try {
            const sarcasms = [
              'Quem te deu permissao para falar comigo, mortal? Tente `/roll` se quiser brincar.',
              'Comandos de administrador nao funcionam para voce. Use `/8ball`.',
              'Eu sirvo apenas ao meu Mestre. Para voce, sou apenas um bot de jogos. Tente `/joke`.',
            ];
            const response = sarcasms[Math.floor(Math.random() * sarcasms.length)];
            await ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
          } catch {
            // ignore reply errors for unauthorized group noise
          }
        }
        return;
      }

      const userRoles = config.telegramUserRoles[user_id] || ['admin'];
      const isAdmin = userRoles.includes('admin');

      if (!isAdmin) {
        const text = ctx.message?.text || '';
        const commandType = normalizeTelegramCommandToken(text.split(' ')[0] || '');

        if (
          AuthGuard.BLOCKED_COMMANDS_FOR_VICE_OWNER.has(commandType) ||
          AuthGuard.isHiddenPrivilegedInput(text)
        ) {
          await ctx.reply(
            '⛔ **Acesso Restrito:**\n\nComo vice-dono(a), voce nao tem permissao para usar este comando de sistema/computador. Voce tem acesso a pesquisa, memoria, conversas e analises.',
            { parse_mode: 'Markdown' },
          );
          this.logSecurityBlock(user_id, commandType || '[natural-language]');
          return;
        }
      }

      await next();
    };
  }

  private static logSecurityBlock(userId: string, command: string) {
    try {
      logger.warn(`[Security] Vice-Owner bloqueado ao tentar executar: ${command}`);
    } catch {
      // ignore logging failures
    }
  }

  private static isGroupServiceMessage(ctx: Context): boolean {
    const msg = ctx.message as any;
    if (!msg) {
      return false;
    }

    return Boolean(
      msg.new_chat_members ||
      msg.left_chat_member ||
      msg.new_chat_title !== undefined ||
      msg.new_chat_photo ||
      msg.delete_chat_photo !== undefined ||
      msg.group_chat_created !== undefined ||
      msg.supergroup_chat_created !== undefined ||
      msg.channel_chat_created !== undefined ||
      msg.message_auto_delete_timer_changed ||
      msg.migrate_from_chat_id !== undefined ||
      msg.migrate_to_chat_id !== undefined ||
      msg.pinned_message ||
      msg.forum_topic_created ||
      msg.forum_topic_closed ||
      msg.forum_topic_reopened ||
      msg.general_forum_topic_hidden !== undefined ||
      msg.general_forum_topic_unhidden !== undefined ||
      msg.write_access_allowed
    );
  }

  private static isHiddenPrivilegedInput(rawText: string): boolean {
    const normalized = rawText
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (!normalized) {
      return false;
    }

    if (
      normalized === 'abrir zavorthBridge' ||
      normalized === 'status do zavorthBridge' ||
      normalized === 'status zavorthBridge' ||
      normalized === 'reiniciar zavorthBridge' ||
      normalized === 'reiniciar o zavorthBridge' ||
      normalized === 'ativar modo remoto' ||
      normalized === 'ativar o modo remoto' ||
      normalized === 'ligar modo remoto' ||
      normalized === 'ligar o modo remoto' ||
      normalized === 'desativar modo remoto' ||
      normalized === 'desativar o modo remoto' ||
      normalized === 'desligar modo remoto' ||
      normalized === 'desligar o modo remoto' ||
      normalized === 'status do modo remoto' ||
      normalized === 'ver modo remoto' ||
      normalized.includes('se autoatualize') ||
      normalized.includes('se atualize') ||
      normalized.includes('atualize o zavorth') ||
      normalized.includes('recarregue o zavorth') ||
      normalized.includes('reinicie o zavorth') ||
      normalized.includes('religue o zavorth') ||
      normalized.includes('se autorepare') ||
      normalized.includes('se conserte') ||
      normalized.includes('tente se corrigir') ||
      normalized.includes('corrija o zavorth') ||
      normalized.includes('faca autoreparo') ||
      normalized.includes('faça autoreparo') ||
      normalized.includes('se melhore') ||
      normalized.includes('melhore o zavorth') ||
      normalized.includes('se otimize') ||
      normalized.includes('otimize o zavorth')
    ) {
      return true;
    }

    return (
      /^\/ag_prompt\b/.test(normalized) ||
      /^\/ag_model\b/.test(normalized) ||
      normalized === '/ag_open' ||
      normalized === '/ag_status' ||
      normalized === '/ag_restart' ||
      /^\/remote\b/.test(normalized) ||
      /^\/remoto\b/.test(normalized) ||
      /^\/selfupdate\b/.test(normalized) ||
      normalized === '/reload' ||
      /^\/autorepair\b/.test(normalized) ||
      normalized === '/repair'
    );
  }

  private static isMutableCommandWhileHostReadonly(command: string, rawText: string): boolean {
    if (!rawText.startsWith('/')) {
      return this.isHiddenPrivilegedInput(rawText);
    }

    if (!command) {
      return false;
    }

    if (this.READ_ONLY_ALLOWED_COMMANDS.has(command) || this.FUN_COMMANDS.includes(command)) {
      return false;
    }

    return Boolean(getExplicitExecutorForCommand(command)) || this.BLOCKED_COMMANDS_FOR_VICE_OWNER.has(command);
  }
}
