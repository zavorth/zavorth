import {
  chatIdToJid,
  extractTextFromBaileysMessage,
  matchesAllowedUser,
  normalizePhoneId,
  parseAllowedUsers,
} from '../../../scripts/whatsapp-bridge/allowlist.cjs';

describe('whatsapp-bridge allowlist helpers', () => {
  it('normalizes phone ids and parses allowlists', () => {
    expect(normalizePhoneId('whatsapp:+55 11 99999-0000')).toBe('5511999990000');
    expect(parseAllowedUsers('+15551212, 5511999')).toEqual(['15551212', '5511999']);
  });

  it('matches allowlist with suffix/prefix tolerance', () => {
    expect(matchesAllowedUser('5511999990000', ['11999990000'])).toBe(true);
    expect(matchesAllowedUser('5511999990000', ['999'])).toBe(false);
    expect(matchesAllowedUser('5511999990000', [])).toBe(true);
  });

  it('extracts text and builds jids', () => {
    expect(extractTextFromBaileysMessage({ conversation: ' hello ' })).toBe('hello');
    expect(extractTextFromBaileysMessage({ extendedTextMessage: { text: 'ping' } })).toBe('ping');
    expect(chatIdToJid('+15551234567')).toBe('15551234567@s.whatsapp.net');
    expect(chatIdToJid('x@g.us')).toBe('x@g.us');
  });
});
