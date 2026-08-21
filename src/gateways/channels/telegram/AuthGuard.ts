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
    '/start',
    '/help',
    '/menu',
    '/zavorth',
    '/settings',
    '/status',
    '/zavorthControl',
    '/tasks',
    '/logs',
    '/files',
    '/diff',
    '/research',
    '/deepresearch',
    '/memory',
    '/recall',
    '/snippets',
    '/snippet',
    '/remember',
    '/forget',
    '/hostauth',
    '/changes',
    '/access',
    '/bootstrap',
    '/doctor',
  ]);

  private static readonly GROUP_ADMIN_COMMANDS = new Set([
    '/ban',
    '/kick',
    '/mute',
    '/unmute',
    '/warn',
    '/warns',
    '/clearwarns',
    '/rules',
    '/stats',
    '/setwelcome',
    '/setbye',
    '/antispam',
    '/filter',
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
    '/strong',
    '/profile',
    '/enable',
    '/disable',
    '/workspace',
    '/remote',
    '/remote',
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
        logger.warn('[Security] Rejected: chat_id is null.');
        return;
      }

      if (!user_id) {
        if (isGroup && isServiceMessage) {
          await next();
          return;
        }
        logger.warn('[Security] Rejected: chat_id or user_id is null.');
        return;
      }

      if (
        hostIdentityService &&
        !hostIdentityService.getStatus().authorized &&
        AuthGuard.isMutableCommandWhileHostReadonly(normalizedCommand, text)
      ) {
        await ctx.reply(
          'New host detected. Zavorth entered read-only mode until reauthorization.\nUse `/hostauth status` to inspect and `/hostauth trust` on the current host to allow execution.',
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

        // Allow Telegram group administration commands for Telegram admins.
        if (isGroup && text.startsWith('/')) {
          const commandType = normalizedCommand;
          if (AuthGuard.GROUP_ADMIN_COMMANDS.has(commandType)) {
            try {
              const member = await ctx.api.getChatMember(ctx.chat!.id, Number(user_id));
              if (member.status === 'administrator' || member.status === 'creator') {
                await next();
                return;
              }
            } catch (error: unknown) {
              // Deny access if verification fails.
              logger.warn('[Auth Guard] operation failed', error);
            }
            await ctx.reply('Only group administrators can use this command.', {
              reply_to_message_id: ctx.message?.message_id,
            });
            return;
          }
        }

        logger.warn(`[Security] Unauthorized access from user_id: ${user_id} and chat_id: ${chat_id}`);

        if (isGroup && text.startsWith('/')) {
          try {
            const sarcasms = [
              'You are not authorized to use that command. Try `/roll` for group fun.',
              'Administrator commands are not available to you. Use `/8ball`.',
              'System access is restricted. You can still try `/joke`.',
            ];
            const response = sarcasms[Math.floor(Math.random() * sarcasms.length)];
            await ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
          } catch (error: unknown) {
            // ignore reply errors for unauthorized group noise
            logger.warn('[Auth Guard] operation failed', error);
          }
        }
        return;
      }

      const userRoles = config.telegramUserRoles[user_id] || ['admin'];
      const isAdmin = userRoles.includes('admin');

      if (!isAdmin) {
        const text = ctx.message?.text || '';
        const commandType = normalizeTelegramCommandToken(text.split(' ')[0] || '');

        if (AuthGuard.BLOCKED_COMMANDS_FOR_VICE_OWNER.has(commandType) || AuthGuard.isHiddenPrivilegedInput(text)) {
          await ctx.reply(
            '**Restricted Access:**\n\nYour current role cannot use this system/computer command. You still have access to search, memory, conversations, and analysis.',
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
      logger.warn(`[Security] Non-admin role blocked while trying to execute: ${command}`);
    } catch (error: unknown) {
      // ignore logging failures
      logger.warn('[Auth Guard] process execution failed', error);
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
        msg.write_access_allowed,
    );
  }

  /**
   * Privileged slash tokens only (agent-first).
   * Free-text NLU phrases no longer activate ops features, so they are not
   * treated as hidden privileged shortcuts either — free text stays agent-owned.
   */
  private static isHiddenPrivilegedInput(rawText: string): boolean {
    const normalized = rawText
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (!normalized || !normalized.startsWith('/')) {
      return false;
    }

    const command = normalized.split(' ')[0] || '';
    return [
      '/ag_prompt',
      '/ag_model',
      '/ag_open',
      '/ag_status',
      '/ag_restart',
      '/remote',
      '/selfupdate',
      '/reload',
      '/autorepair',
      '/repair',
    ].includes(command);
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
