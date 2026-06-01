import {
  getSlashCommandSuggestions,
  parseSlashCommand,
  renderSlashCommandHelp,
  shouldQueueLocalSlashCommand,
} from '../../../apps/zavorth-control-vite-shell/src/slash-commands';

describe('zavorth-control slash commands', () => {
  it('parses local commands, aliases, and colon arguments', () => {
    expect(parseSlashCommand('/btw what changed?')).toEqual(expect.objectContaining({
      args: 'what changed?',
      command: expect.objectContaining({ key: 'btw', sideChannel: true }),
    }));
    expect(parseSlashCommand('/export-session: json')).toEqual(expect.objectContaining({
      args: 'json',
      command: expect.objectContaining({ key: 'export' }),
    }));
    expect(parseSlashCommand('/reset')).toEqual(expect.objectContaining({
      command: expect.objectContaining({ key: 'new' }),
    }));
    expect(parseSlashCommand('/branch feature/review')).toEqual(expect.objectContaining({
      args: 'feature/review',
      command: expect.objectContaining({ key: 'branch', category: 'git' }),
    }));
    expect(parseSlashCommand('/pull-request --title "Ship it"')).toEqual(expect.objectContaining({
      command: expect.objectContaining({ key: 'pr' }),
    }));
  });

  it('keeps only safe local commands queueable while busy', () => {
    const clear = parseSlashCommand('/clear')?.command;
    const focus = parseSlashCommand('/focus off')?.command;
    const btw = parseSlashCommand('/btw side question')?.command;

    expect(clear && shouldQueueLocalSlashCommand(clear)).toBe(true);
    expect(focus && shouldQueueLocalSlashCommand(focus)).toBe(false);
    expect(btw && shouldQueueLocalSlashCommand(btw)).toBe(false);
  });

  it('returns autocomplete entries and help from the same registry', () => {
    expect(getSlashCommandSuggestions('/ex').map((command) => command.name)).toContain('export');
    const help = renderSlashCommandHelp();
    expect(help).toContain('/btw <message>');
    expect(help).toContain('/steer [queue-id] <message>');
    expect(help).toContain('/queue [show|clear|flush|cancel <id>|replace <id> <message>|backoff <id> <ms>|attempts <id> <count>]');
    expect(help).toContain('/branch <name> [--apply --approval-id <id>]');
    expect(help).toContain('/commit -m <message> [--apply --approval-id <id>]');
    expect(help).toContain('/pr --title <title> [--base main] [--apply --approval-id <id>]');
    expect(help).toContain('/review [--security|--pr <id> --repo owner/repo]');
  });
});
