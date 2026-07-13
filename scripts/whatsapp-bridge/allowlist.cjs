function normalizePhoneId(value) {
  return String(value || '')
    .trim()
    .replace(/^whatsapp:/i, '')
    .replace(/@.+$/, '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
}

function parseAllowedUsers(raw) {
  if (Array.isArray(raw)) {
    return raw.map(normalizePhoneId).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,;\s]+/)
    .map(normalizePhoneId)
    .filter(Boolean);
}

function matchesAllowedUser(senderId, allowedUsers) {
  if (!allowedUsers || allowedUsers.length === 0) return true;
  const sender = normalizePhoneId(senderId);
  if (!sender) return false;
  return allowedUsers.some((allowed) => {
    if (!allowed) return false;
    return sender === allowed || sender.endsWith(allowed) || allowed.endsWith(sender);
  });
}

function extractTextFromBaileysMessage(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.conversation === 'string') return message.conversation.trim();
  if (message.extendedTextMessage && typeof message.extendedTextMessage.text === 'string') {
    return message.extendedTextMessage.text.trim();
  }
  if (message.imageMessage && typeof message.imageMessage.caption === 'string') {
    return message.imageMessage.caption.trim();
  }
  if (message.videoMessage && typeof message.videoMessage.caption === 'string') {
    return message.videoMessage.caption.trim();
  }
  if (message.buttonsResponseMessage && typeof message.buttonsResponseMessage.selectedDisplayText === 'string') {
    return message.buttonsResponseMessage.selectedDisplayText.trim();
  }
  if (message.listResponseMessage && typeof message.listResponseMessage.title === 'string') {
    return message.listResponseMessage.title.trim();
  }
  return '';
}

function jidToChatId(jid) {
  return String(jid || '').trim();
}

function chatIdToJid(chatId) {
  const raw = String(chatId || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = normalizePhoneId(raw);
  if (!digits) return '';
  return `${digits}@s.whatsapp.net`;
}

module.exports = {
  normalizePhoneId,
  parseAllowedUsers,
  matchesAllowedUser,
  extractTextFromBaileysMessage,
  jidToChatId,
  chatIdToJid,
};
