import { Api } from 'grammy';
import { AuditLogger } from '../monitoring/AuditLogger.js';
import { logger } from '../logger.js';

export type ModerationAction = 'ban' | 'kick' | 'mute' | 'unmute' | 'unban';

interface ModerationResult {
  success: boolean;
  action: ModerationAction;
  userId: number;
  chatId: number | string;
  error?: string;
}

/**
 * GroupModerationService — encapsula acoes de moderacao administrativa do Telegram.
 * Todas as acoes sao logadas no AuditLogger para rastreabilidade.
 */
export class GroupModerationService {
  constructor(
    private botApi: Api,
    private auditLogger: AuditLogger,
  ) {}

  public async banUser(chatId: number | string, userId: number, performedBy: string): Promise<ModerationResult> {
    return this.executeAction('ban', chatId, userId, performedBy, async () => {
      await this.botApi.banChatMember(chatId, userId);
    });
  }

  public async kickUser(chatId: number | string, userId: number, performedBy: string): Promise<ModerationResult> {
    return this.executeAction('kick', chatId, userId, performedBy, async () => {
      // Kick = ban + imediato unban (permite o membro voltar se quiser)
      await this.botApi.banChatMember(chatId, userId);
      await this.botApi.unbanChatMember(chatId, userId);
    });
  }

  public async muteUser(
    chatId: number | string,
    userId: number,
    performedBy: string,
    durationSeconds?: number,
  ): Promise<ModerationResult> {
    return this.executeAction('mute', chatId, userId, performedBy, async () => {
      const untilDate = durationSeconds
        ? Math.floor(Date.now() / 1000) + durationSeconds
        : 0; // 0 = permanente
      await this.botApi.restrictChatMember(chatId, userId, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      }, { until_date: untilDate || undefined });
    });
  }

  public async unmuteUser(chatId: number | string, userId: number, performedBy: string): Promise<ModerationResult> {
    return this.executeAction('unmute', chatId, userId, performedBy, async () => {
      await this.botApi.restrictChatMember(chatId, userId, {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      });
    });
  }

  public async unbanUser(chatId: number | string, userId: number, performedBy: string): Promise<ModerationResult> {
    return this.executeAction('unban', chatId, userId, performedBy, async () => {
      await this.botApi.unbanChatMember(chatId, userId);
    });
  }

  public async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    try {
      await this.botApi.deleteMessage(chatId, messageId);
      return true;
    } catch (error: any) { logger.warn('[Group Moderation] process execution failed', error); return false; }
  }

  public async isBotAdmin(chatId: number | string): Promise<boolean> {
    try {
      const me = await this.botApi.getMe();
      const member = await this.botApi.getChatMember(chatId, me.id);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error: any) { logger.warn('[Group Moderation] delete operation failed', error); return false; }
  }

  private async executeAction(
    action: ModerationAction,
    chatId: number | string,
    userId: number,
    performedBy: string,
    fn: () => Promise<void>,
  ): Promise<ModerationResult> {
    try {
      await fn();

      await this.auditLogger.logEvent({
        timestamp: new Date().toISOString(),
        event_type: `group_moderation_${action}`,
        task_id: `mod_${action}_${userId}_${Date.now()}`,
        user_id: performedBy,
        user_input: `/${action} ${userId}`,
        intent: `moderation.${action}`,
        plan_id: null,
        risk_level: action === 'ban' || action === 'kick' ? 3 : 2,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: 'WORKSPACE',
        executor: 'group_moderation',
        execution_success: true,
        execution_summary: `${action} aplicado ao membro ${userId} no chat ${chatId}`,
        metadata: { chatId: String(chatId), userId, performedBy, action },
      });

      return { success: true, action, userId, chatId };
    } catch (error: any) {
      await this.auditLogger.logEvent({
        timestamp: new Date().toISOString(),
        event_type: `group_moderation_${action}_failed`,
        task_id: `mod_${action}_${userId}_${Date.now()}`,
        user_id: performedBy,
        user_input: `/${action} ${userId}`,
        intent: `moderation.${action}`,
        plan_id: null,
        risk_level: action === 'ban' || action === 'kick' ? 3 : 2,
        policy_decision: 'BLOCKED',
        policy_violations: error.message,
        operational_mode: 'WORKSPACE',
        executor: 'group_moderation',
        execution_success: false,
        execution_summary: `Falha ao ${action} membro ${userId}: ${error.message}`,
        metadata: { chatId: String(chatId), userId, performedBy, action, error: error.message },
      });

      return { success: false, action, userId, chatId, error: error.message };
    }
  }
}
