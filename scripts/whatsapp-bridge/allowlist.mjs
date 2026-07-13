import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impl = require('./allowlist.cjs');

export const normalizePhoneId = impl.normalizePhoneId;
export const parseAllowedUsers = impl.parseAllowedUsers;
export const matchesAllowedUser = impl.matchesAllowedUser;
export const extractTextFromBaileysMessage = impl.extractTextFromBaileysMessage;
export const jidToChatId = impl.jidToChatId;
export const chatIdToJid = impl.chatIdToJid;
