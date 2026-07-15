import {
  getSlashCommandSuggestions,
  parseSlashCommand,
  renderSlashCommandHelp,
  shouldQueueLocalSlashCommand,
} from '../../../apps/zavorth-control-vite-shell/src/slash-commands';

describe('zavorth-control slash commands', () => {
  it('parses local commands, aliases, and colon arguments', () => {
    expect(parseSlashCommand('/btw what changed?')).toEqual(
      expect.objectContaining({
        args: 'what changed?',
        command: expect.objectContaining({ key: 'btw', sideChannel: true }),
      }),
    );
    expect(parseSlashCommand('/export-session: json')).toEqual(
      expect.objectContaining({
        args: 'json',
        command: expect.objectContaining({ key: 'export' }),
      }),
    );
    expect(parseSlashCommand('/reset')).toEqual(
      expect.objectContaining({
        command: expect.objectContaining({ key: 'new' }),
      }),
    );
    expect(parseSlashCommand('/branch feature/review')).toEqual(
      expect.objectContaining({
        args: 'feature/review',
        command: expect.objectContaining({ key: 'branch', category: 'git' }),
      }),
    );
    expect(parseSlashCommand('/pull-request --title "Ship it"')).toEqual(
      expect.objectContaining({
        command: expect.objectContaining({ key: 'pr' }),
      }),
    );
    expect(parseSlashCommand('/stop')).toEqual(
      expect.objectContaining({
        command: expect.objectContaining({ key: 'stop', category: 'session' }),
      }),
    );
    expect(parseSlashCommand('/model openai/gpt-5.5')).toEqual(
      expect.objectContaining({
        args: 'openai/gpt-5.5',
        command: expect.objectContaining({ key: 'model', category: 'runtime' }),
      }),
    );
    expect(parseSlashCommand('/reasoning deep')).toEqual(
      expect.objectContaining({
        args: 'deep',
        command: expect.objectContaining({ key: 'think' }),
      }),
    );
    expect(parseSlashCommand('/tasks')).toEqual(
      expect.objectContaining({
        command: expect.objectContaining({ key: 'agents' }),
      }),
    );
    expect(parseSlashCommand('/approve abc123')).toEqual(
      expect.objectContaining({
        args: 'abc123',
        name: 'approve',
        command: expect.objectContaining({ key: 'approvals' }),
      }),
    );
    expect(parseSlashCommand('/deny abc123')).toEqual(
      expect.objectContaining({
        args: 'abc123',
        name: 'deny',
        command: expect.objectContaining({ key: 'approvals' }),
      }),
    );
    expect(parseSlashCommand('/grill-me should we ship this plan?')).toEqual(
      expect.objectContaining({
        args: 'should we ship this plan?',
        command: expect.objectContaining({ key: 'plan-review', category: 'runtime' }),
      }),
    );
    expect(parseSlashCommand('/brief mobile update')).toEqual(
      expect.objectContaining({
        args: 'mobile update',
        command: expect.objectContaining({ key: 'brief-reply', category: 'runtime' }),
      }),
    );
    expect(parseSlashCommand('/caveman release note')).toEqual(
      expect.objectContaining({
        args: 'release note',
        name: 'caveman',
        command: expect.objectContaining({ key: 'brief-reply' }),
      }),
    );
    expect(parseSlashCommand('/tdd command aliases')).toEqual(
      expect.objectContaining({
        args: 'command aliases',
        command: expect.objectContaining({ key: 'test-loop', category: 'runtime' }),
      }),
    );
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
    expect(help).toContain('/stop');
    expect(help).toContain('/model [auto|provider/model|model]');
    expect(help).toContain('/usage [summary|full]');
    expect(help).toContain('/think [off|low|normal|deep|ultra|default]');
    expect(help).toContain('/steer [queue-id] <message>');
    expect(help).toContain('/agents');
    expect(help).toMatch(/\/approvals \[approve\|deny(?:\|reject)?\]/);
    expect(help).toContain(
      '/queue [show|clear|flush|cancel <id>|replace <id> <message>|backoff <id> <ms>|attempts <id> <count>]',
    );
    expect(help).toContain('/branch <name> [--apply --approval-id <id>]');
    expect(help).toContain('/commit -m <message> [--apply --approval-id <id>]');
    expect(help).toContain('/pr --title <title> [--base main] [--apply --approval-id <id>]');
    expect(help).toContain('/review [--security|--pr <id> --repo owner/repo]');
    expect(help).toContain('/grill-me [plan or decision]');
    expect(help).toContain('/brief [surface or draft]');
    expect(help).toContain('/tdd [implementation request]');
  });
});
