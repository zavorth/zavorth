import {
  channelIdsEqual,
  listChannelIdAliases,
  normalizeChannelId,
} from '../../src/channels/normalizeChannelId.js';

describe('normalizeChannelId fabric aliases', () => {
  it('unifies google-chat, teams, and qq aliases to canonical ids', () => {
    expect(normalizeChannelId('googlechat')).toBe('google-chat');
    expect(normalizeChannelId('google-chat')).toBe('google-chat');
    expect(normalizeChannelId('gchat')).toBe('google-chat');
    expect(normalizeChannelId('msteams')).toBe('teams');
    expect(normalizeChannelId('ms-teams')).toBe('teams');
    expect(normalizeChannelId('teams')).toBe('teams');
    expect(normalizeChannelId('qqbot')).toBe('qq');
    expect(normalizeChannelId('qq')).toBe('qq');
  });

  it('treats alias pairs as equal', () => {
    expect(channelIdsEqual('googlechat', 'google-chat')).toBe(true);
    expect(channelIdsEqual('msteams', 'teams')).toBe(true);
    expect(channelIdsEqual('qqbot', 'qq')).toBe(true);
    expect(channelIdsEqual('slack', 'teams')).toBe(false);
  });

  it('lists aliases for a canonical id', () => {
    const teamsAliases = listChannelIdAliases('msteams');
    expect(teamsAliases).toEqual(expect.arrayContaining(['teams', 'msteams', 'ms-teams']));
    expect(listChannelIdAliases('googlechat')).toEqual(
      expect.arrayContaining(['google-chat', 'googlechat', 'gchat']),
    );
  });
});
