import { logger } from '../../../logger.js';
import { Context, NextFunction } from 'grammy';
import { config } from '../../../config/index.js';
import { normalizeChannelCommandToken } from '../../../channels/commands/ChannelCommandParser.js';
import { ChannelPolicyManager } from '../../../channels/policies/ChannelPolicyManager.js';
import { HostIdentityService } from '../../../services/HostIdentityService.js';

export class AuthGuard {
  static middleware(hostIdentityService?: HostIdentityService, policyManager?: ChannelPolicyManager) {
    const policy = policyManager || new ChannelPolicyManager({ resolveUserRoles: () => config.telegramUserRoles });
    return async (ctx: Context, next: NextFunction) => {
      const chat_id = ctx.chat?.id.toString();
      const user_id = ctx.from?.id.toString();
      const text = ctx.message?.text || '';
      const normalizedCommand = normalizeChannelCommandToken(text.split(' ')[0] || '');
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
        policy.isMutableCommandWhileHostReadonly(normalizedCommand, text)
      ) {
        await ctx.reply(
          'New host detected. Zavorth entered read-only mode until reauthorization.\nUse `/hostauth status` to inspect and `/hostauth trust` on the current host to allow execution.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      if (!config.allowedUserIds.includes(user_id)) {
        const isFunCommand = policy.isFunCommand(normalizedCommand);

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
          if (policy.isGroupAdminCommand(commandType)) {
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

      const isAdmin = policy.isAdminUser(user_id);

      if (!isAdmin) {
        const text = ctx.message?.text || '';
        const commandType = normalizeChannelCommandToken(text.split(' ')[0] || '');

        if (policy.isCommandBlockedForNonAdmin(commandType) || policy.isHiddenPrivilegedInput(text)) {
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
    const msg = ctx.message as unknown as Record<string, unknown>;
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
}
