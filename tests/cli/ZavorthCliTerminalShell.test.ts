import {
  buildTerminalShellCommandRegistry,
  buildTerminalShellSnapshot,
  createTerminalShellStreamRenderBuffer,
  createTerminalShellHistoryStore,
  formatTerminalShellCardLine,
  formatTerminalShellSelectableCardLine,
  formatTerminalShellScreen,
  queueTerminalShellInput,
  reduceTerminalShellCardSelection,
  reduceTerminalShellFocus,
  reduceTerminalShellInput,
  resolveTerminalShellCardAction,
} from '../../src/cli/ZavorthCliTerminalShell';
import { mkdtempSync, rmSync } from 'fs';

import { tmpdir } from 'os';
import { join } from 'path';

describe('Zavorth CLI terminal shell', () => {
  it('projects a persistent daily shell with the expected sections and bottom composer', () => {
    const shell = buildTerminalShellSnapshot({
      sessionId: 'main',
      profileId: 'personal',
      providerLabel: 'auto',
      modelLabel: 'lite',
      mode: 'daily',
      activeRun: false,
      input: 'review this workspace',
      messages: [{ role: 'assistant', text: 'Ready to help.' }],
    });

    expect(shell.contractVersion).toBe('zavorth-terminal-shell/1');
    expect(shell.sections.map((section) => section.id)).toEqual([
      'chat',
      'approvals',
      'diffs',
      'tasks',
      'memory',
      'providers',
      'channels',
      'voice',
      'sandbox',
      'logs',
    ]);
    expect(shell.composer.position).toBe('bottom');
    expect(shell.composer.multilineHint).toBe('Shift+Enter for newline');
    expect(shell.composer.value).toBe('review this workspace');
    expect(shell.receipts.collapsedByDefault).toBe(true);
  });

  it('keeps slash command discovery behind a single registry', () => {
    const registry = buildTerminalShellCommandRegistry();
    const ids = registry.commands.map((command) => command.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'zavorth.action.lookup',
        'zavorth.action.preview',
        'zavorth.approvals.open',
        'zavorth.diff.open',
        'zavorth.tasks.list',
        'zavorth.memory.recall',
        'zavorth.providers.pick',
        'zavorth.channels.status',
        'zavorth.voice.toggle',
        'zavorth.sandbox.status',
      ]),
    );
    expect(registry.commands.every((command) => command.surface === 'terminal')).toBe(true);
    expect(registry.commands.some((command) => command.title.toLowerCase().includes('hidden'))).toBe(false);
  });

  it('keeps the base terminal language in English while allowing localized command aliases', () => {
    const registry = buildTerminalShellCommandRegistry({ locale: 'pt-BR' });
    const memory = registry.commands.find((command) => command.id === 'zavorth.memory.recall');
    const output = formatTerminalShellScreen(
      buildTerminalShellSnapshot({
        providerLabel: 'not selected',
        modelLabel: 'not selected',
      }),
    );

    expect(memory?.title).toBe('Recall memory');
    expect(memory?.aliases).toEqual(expect.arrayContaining(['/mnemos', '/recall']));
    expect(output).toContain('auto:auto');
    expect(output).toContain('Conversation');
    expect(output).not.toContain('Memória');
    expect(output).not.toContain('Aprovações');
  });

  it('queues user input while a run is active instead of dropping or executing it directly', () => {
    const queued = queueTerminalShellInput({
      activeRun: true,
      text: '/steer keep the answer shorter',
      existingQueue: [{ id: 'queued-1', text: 'summarize after this', kind: 'message' }],
    });

    expect(queued.accepted).toBe(true);
    expect(queued.queue).toHaveLength(2);
    expect(queued.queue[1]).toMatchObject({
      text: '/steer keep the answer shorter',
      kind: 'steer',
      status: 'queued',
    });
    expect(queued.operatorNotice).toContain('queued for this run');
  });

  it('throttles stream render deltas and flushes the final text without loss', () => {
    jest.useFakeTimers();
    try {
      const flushed: string[] = [];
      const buffer = createTerminalShellStreamRenderBuffer({
        intervalMs: 120,
        onFlush: (text) => flushed.push(text),
      });

      buffer.start();
      for (let index = 0; index < 20; index += 1) {
        buffer.push({ accumulated: `chunk-${index}` });
      }

      expect(flushed).toEqual([]);
      jest.advanceTimersByTime(119);
      expect(flushed).toEqual([]);
      jest.advanceTimersByTime(1);
      expect(flushed).toEqual(['chunk-19']);

      for (let index = 0; index < 20; index += 1) {
        buffer.push({ delta: String(index % 10) });
      }
      jest.advanceTimersByTime(120);
      expect(flushed).toHaveLength(2);
      expect(flushed[1]).toBe('chunk-1901234567890123456789');

      buffer.complete({ accumulated: 'final answer' });
      expect(flushed.at(-1)).toBe('final answer');
      buffer.abort();
    } finally {
      jest.useRealTimers();
    }
  });

  it('supports multiline editing, slash palette and voice toggle keys in a deterministic reducer', () => {
    let state = reduceTerminalShellInput(undefined, { type: 'insertText', text: 'first line' });
    state = reduceTerminalShellInput(state, { type: 'key', key: 'shift+enter' });
    state = reduceTerminalShellInput(state, { type: 'insertText', text: 'second line' });
    state = reduceTerminalShellInput(state, { type: 'key', key: '/' });
    state = reduceTerminalShellInput(state, { type: 'key', key: 'v' });

    expect(state.value).toBe('first line\nsecond line/');
    expect(state.paletteOpen).toBe(true);
    expect(state.voiceArmed).toBe(true);
    expect(state.cursor).toBe(state.value.length);
  });

  it('renders compact tool, approval and diff cards without exposing raw reasoning or receipts by default', () => {
    const shell = buildTerminalShellSnapshot({
      sessionId: 'main',
      profileId: 'developer',
      providerLabel: 'openai',
      modelLabel: 'gpt-4o',
      activeRun: true,
      input: '',
      messages: [{ role: 'assistant', text: '<think>hidden chain</think>Visible answer.' }],
      cards: [
        { kind: 'tool', title: 'Read workspace', status: 'running', body: 'Inspecting approved files.' },
        { kind: 'approval', title: 'Edit config', status: 'waiting', body: 'Requires approval before write.' },
        { kind: 'diff', title: 'src/app.ts', status: '+12 -2', body: 'Preview only.' },
      ],
      receipts: [{ id: 'receipt-1', title: 'Action receipt', detail: 'Stored after approval.' }],
    });
    const output = formatTerminalShellScreen(shell);

    expect(output).toContain('Zavorth Terminal Shell');
    expect(output).toContain('Read workspace');
    expect(output).toContain('Edit config');
    expect(output).toContain('src/app.ts');
    expect(output).toContain('Visible answer.');
    expect(output).toContain('Receipts hidden');
    expect(output).not.toContain('hidden chain');
    expect(output).not.toContain('Stored after approval.');
    expect(output.split('\n').length).toBeLessThan(45);
  });

  it('persists terminal history and navigates it with arrow keys without duplicating adjacent entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zavorth-terminal-history-'));
    try {
      const historyPath = join(dir, 'history.jsonl');
      const store = createTerminalShellHistoryStore({ filePath: historyPath, limit: 5 });

      store.append('review workspace');
      store.append('review workspace');
      store.append('/memory project goals');
      const reloaded = createTerminalShellHistoryStore({ filePath: historyPath, limit: 5 });

      expect(reloaded.load()).toEqual(['review workspace', '/memory project goals']);

      let state = reduceTerminalShellInput(
        {
          value: '',
          cursor: 0,
          paletteOpen: false,
          voiceArmed: false,
          history: reloaded.load(),
          historyIndex: null,
        },
        { type: 'key', key: 'arrowup' },
      );
      expect(state.value).toBe('/memory project goals');

      state = reduceTerminalShellInput(state, { type: 'key', key: 'arrowup' });
      expect(state.value).toBe('review workspace');

      state = reduceTerminalShellInput(state, { type: 'key', key: 'arrowdown' });
      expect(state.value).toBe('/memory project goals');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tracks keyboard focus and switches between daily and ops mode deterministically', () => {
    let focus = reduceTerminalShellFocus(undefined, { type: 'tab' });
    expect(focus.target).toBe('timeline');
    expect(focus.mode).toBe('daily');

    focus = reduceTerminalShellFocus(focus, { type: 'tab' });
    expect(focus.target).toBe('cards');

    focus = reduceTerminalShellFocus(focus, { type: 'section', sectionId: 'approvals' });
    expect(focus.sectionId).toBe('approvals');
    expect(focus.target).toBe('composer');

    focus = reduceTerminalShellFocus(focus, { type: 'toggleMode' });
    expect(focus.mode).toBe('ops');
  });

  it('lets escape return from cards or palette focus back to the composer', () => {
    let focus = reduceTerminalShellFocus(undefined, { type: 'target', target: 'cards' });
    expect(focus.target).toBe('cards');

    focus = reduceTerminalShellFocus(focus, { type: 'escape' });
    expect(focus.target).toBe('composer');
    expect(focus.sectionId).toBe('chat');
  });

  it('keeps daily tool cards plain and reserves technical details for ops mode', () => {
    const card = {
      kind: 'tool' as const,
      title: 'Bash',
      status: 'running',
      body: [
        '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content package.json"',
        'stdout stream attached',
      ],
      command: 'powershell -Command Get-Content package.json',
    };

    expect(formatTerminalShellCardLine(card, 'daily')).toBe('Bash is running');
    expect(formatTerminalShellCardLine(card, 'ops')).toContain('powershell -Command Get-Content package.json');
  });

  it('selects inline cards and resolves approval shortcuts to real governed HUD commands', () => {
    const cards = [
      { kind: 'tool' as const, title: 'Read workspace', status: 'done' },
      {
        kind: 'approval' as const,
        title: 'Apply safe patch',
        status: 'waiting',
        body: 'Plan: plan-terminal-123',
        command: 'zavorth approve plan-terminal-123 --yes',
      },
      { kind: 'diff' as const, title: 'src/app.ts', status: '+4 -1' },
    ];

    let selection = reduceTerminalShellCardSelection(undefined, { type: 'next', cards });
    expect(selection.selectedIndex).toBe(0);

    selection = reduceTerminalShellCardSelection(selection, { type: 'next', cards });
    expect(selection.selectedIndex).toBe(1);

    expect(resolveTerminalShellCardAction({ action: 'approve', cards, selection })).toMatchObject({
      applied: true,
      command: 'hud --action approve --plan plan-terminal-123 --yes',
    });
    expect(resolveTerminalShellCardAction({ action: 'reject', cards, selection })).toMatchObject({
      applied: true,
      command: 'hud --action reject --plan plan-terminal-123 --yes',
    });
    expect(resolveTerminalShellCardAction({ action: 'defer', cards, selection })).toMatchObject({
      applied: true,
      command: 'hud --action defer --plan plan-terminal-123 --yes',
    });

    const nonApproval = reduceTerminalShellCardSelection(selection, { type: 'select', cards, selectedIndex: 0 });
    expect(resolveTerminalShellCardAction({ action: 'approve', cards, selection: nonApproval })).toMatchObject({
      applied: false,
      command: null,
    });
  });

  it('renders selectable cards as compact product states instead of technical sentences', () => {
    const approvalCard = {
      kind: 'approval' as const,
      title: 'Apply safe patch',
      status: 'waiting',
      body: 'Plan: plan-terminal-123',
      command: 'zavorth approve plan-terminal-123 --yes',
    };
    const diffCard = {
      kind: 'diff' as const,
      title: 'src/app.ts',
      status: '+4 -1',
      body: 'Preview only.',
    };

    expect(
      formatTerminalShellSelectableCardLine({
        card: approvalCard,
        mode: 'daily',
        selected: true,
      }),
    ).toBe('> Approval | Apply safe patch | waiting | a/r/d');
    expect(
      formatTerminalShellSelectableCardLine({
        card: diffCard,
        mode: 'daily',
        selected: false,
      }),
    ).toBe('  Diff | src/app.ts | +4 -1');
    expect(
      formatTerminalShellSelectableCardLine({
        card: approvalCard,
        mode: 'ops',
        selected: true,
      }),
    ).toContain('Plan: plan-terminal-123');
  });
});
