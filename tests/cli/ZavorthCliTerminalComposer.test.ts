import {
  filterTerminalComposerOutput,
  formatTerminalComposerInlineCard,
  formatTerminalComposerPrompt,
  normalizeTerminalComposerInput,
} from '../../src/cli/ZavorthCliTerminalComposer';
import { resolveCliExecutionInput } from '../../src/cli/ZavorthCliCommandHelpers';

describe('Zavorth CLI terminal composer', () => {
  it('hides reasoning and raw tool tags before text reaches the terminal', () => {
    const output = filterTerminalComposerOutput([
      'I will inspect the repo.',
      '<think>private chain of thought</think>',
      '<thinking>hidden planning</thinking>',
      '<tool_call>{"name":"shell","args":{"cmd":"rg secret"}}</tool_call>',
      'The visible answer stays.',
    ].join('\n'));

    expect(output).toContain('I will inspect the repo.');
    expect(output).toContain('The visible answer stays.');
    expect(output).not.toContain('private chain of thought');
    expect(output).not.toContain('hidden planning');
    expect(output).not.toContain('tool_call');
    expect(output).not.toContain('rg secret');
  });

  it('turns common in-session slash commands into canonical Zavorth actions', () => {
    expect(normalizeTerminalComposerInput('/model')).toBe('gateway models');
    expect(normalizeTerminalComposerInput('/model openai')).toBe('gateway models openai');
    expect(normalizeTerminalComposerInput('/skills')).toBe('skills');
    expect(normalizeTerminalComposerInput('/usage')).toBe('status');
    expect(normalizeTerminalComposerInput('/memory decisions')).toBe('memory search decisions');
    expect(normalizeTerminalComposerInput('review this workspace')).toBe('review this workspace');
  });

  it('feeds composer slash aliases into the real CLI command resolver', () => {
    expect(resolveCliExecutionInput('/model')).toMatchObject({
      commandName: 'gateway',
      args: 'models',
    });
    expect(resolveCliExecutionInput('/usage')).toMatchObject({
      commandName: 'status',
      args: '',
    });
    expect(resolveCliExecutionInput('/memory project decisions')).toMatchObject({
      commandName: 'memory',
      args: 'search project decisions',
    });
  });

  it('renders compact inline cards for tools, diffs and approvals', () => {
    const card = formatTerminalComposerInlineCard({
      kind: 'tool',
      title: 'Workspace scan',
      status: 'running',
      body: 'Reading approved folders only.',
      command: 'zavorth approve req-123',
    });

    expect(card).toContain('Workspace scan');
    expect(card).toContain('running');
    expect(card).toContain('Reading approved folders only.');
    expect(card).toContain('zavorth approve req-123');
    expect(card.split('\n').length).toBeLessThanOrEqual(6);
  });

  it('uses a compact bottom-bar style prompt', () => {
    expect(formatTerminalComposerPrompt({ sessionId: 'main', chatId: 'web:main' })).toBe('Zavorth › ');
  });
});
