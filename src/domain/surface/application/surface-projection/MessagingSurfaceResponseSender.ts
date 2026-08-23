/**
 * Channel-agnostic messaging surface helpers (WhatsApp / Signal / Slack / etc.):
 * numbered / slash approval consumption for pending surface cards.
 */

import {
  clearPendingSurfaceApproval,
  resolvePendingSurfaceApproval,
} from './PendingSurfaceApprovalIndex.js';
import {
  isPermissionDecisionEvent,
  parseSurfaceInteraction,
  toPermissionApprovalArgs,
} from './interaction/index.js';

/**
 * Try to consume inbound text as numbered / slash approval for a pending surface.
 */
export function tryConsumeMessagingPermissionText(input: {
  channel: string;
  chatId: string;
  userId?: string | null;
  rawText: string;
}): { taskId: string; choice: 'once' | 'session' | 'always' | 'deny' } | null {
  const channel = String(input.channel || '').toLowerCase();
  const chatId = String(input.chatId || '').trim();
  const rawText = String(input.rawText || '').trim();
  if (!channel || !chatId || !rawText) return null;

  const pending = resolvePendingSurfaceApproval({ surface: channel, chatId });
  if (!pending) {
    const event = parseSurfaceInteraction({
      surface: channel,
      raw: rawText,
      kindHint: 'text',
      actorId: input.userId || null,
      sessionId: chatId,
    });
    return event ? toPermissionApprovalArgs(event) : null;
  }

  const event = parseSurfaceInteraction({
    surface: channel,
    raw: rawText,
    kindHint: 'text',
    actorId: input.userId || null,
    sessionId: chatId,
    numberedOptions: pending.numberedOptions,
    highRisk: pending.highRisk,
    metadata: {
      approvalId: pending.approvalId,
      taskId: pending.approvalId,
      highRisk: pending.highRisk,
    },
  });

  if (!event) return null;

  let permission = toPermissionApprovalArgs(event);
  if (!permission && event.choice) {
    permission = { taskId: pending.approvalId, choice: event.choice };
  }
  if (!permission && isPermissionDecisionEvent(event) && event.approvalId && event.choice) {
    permission = { taskId: event.approvalId, choice: event.choice };
  }
  if (!permission) return null;

  clearPendingSurfaceApproval({
    surface: channel,
    chatId,
    approvalId: permission.taskId,
  });
  return permission;
}
