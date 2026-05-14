import type { IMessageContext } from '../../../../../contracts/IMessageBroker.js';

export function parseSelfModificationArgs(rawArgs: string):
  | { mode: 'preview'; filePath: string; instruction: string }
  | { mode: 'goal'; goal: string }
  | { mode: 'apply'; previewId: string }
  | { mode: 'rollback'; changeId: string }
  | null {
  const trimmed = String(rawArgs || '').trim();
  if (!trimmed) {
    return null;
  }

  const applyMatch = trimmed.match(/^apply\s+([a-z0-9_-]{6,})$/i);
  if (applyMatch) {
    return { mode: 'apply', previewId: applyMatch[1].trim() };
  }

  const rollbackMatch = trimmed.match(/^rollback\s+([a-z0-9_-]{6,})$/i);
  if (rollbackMatch) {
    return { mode: 'rollback', changeId: rollbackMatch[1].trim() };
  }

  const goalMatch = trimmed.match(/^goal\s+--\s+([\s\S]+)$/i);
  if (goalMatch) {
    return { mode: 'goal', goal: goalMatch[1].trim() };
  }

  const previewInput = trimmed.replace(/^preview\s+/i, '').trim();
  const separatorIndex = previewInput.indexOf('--');
  if (separatorIndex === -1) {
    return null;
  }

  const filePath = previewInput.slice(0, separatorIndex).trim();
  const instruction = previewInput.slice(separatorIndex + 2).trim();
  if (!filePath || !instruction) {
    return null;
  }

  return {
    mode: 'preview',
    filePath,
    instruction,
  };
}

export function canApplySelfModification(
  ctx: Pick<IMessageContext, 'platform' | 'isGroup'>,
  telegramRoles: string[],
): boolean {
  if (ctx.isGroup) {
    return false;
  }

  if (ctx.platform === 'telegram') {
    return telegramRoles.some((role) => ['owner', 'trusted'].includes(role));
  }

  return true;
}
