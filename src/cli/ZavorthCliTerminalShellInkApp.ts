import { createElement } from 'react';
import type { CliExecutionResult, CliTerminalStreamEvent, ZavorthCliFlags } from './ZavorthCliContract.js';
import {
  buildTerminalShellCommandRegistry,
  buildTerminalShellSnapshot,
  createTerminalShellStreamRenderBuffer,
  createTerminalShellHistoryStore,
  formatTerminalShellSelectableCardLine,
  formatTerminalShellScreen,
  queueTerminalShellInput,
  reduceTerminalShellCardSelection,
  reduceTerminalShellFocus,
  reduceTerminalShellInput,
  resolveTerminalShellCardAction,
  type TerminalShellCard,
  type TerminalShellCardAction,
  type TerminalShellCardSelectionState,
  type TerminalShellFocusState,
  type TerminalShellInputState,
  type TerminalShellMessage,
  type TerminalShellQueuedItem,
} from './ZavorthCliTerminalShell.js';
import { normalizeTerminalComposerInput } from './ZavorthCliTerminalComposer.js';
import { logger } from '../logger.js';

type InkModule = typeof import('ink');
type ReactModule = typeof import('react');
type InkKey = import('ink').Key;

export type ZavorthTerminalShellRunnerParams = {
  flags: ZavorthCliFlags;
  runOnce: (rawInput: string, flags: ZavorthCliFlags) => Promise<CliExecutionResult>;
  initialText: string;
  welcomeText?: string | null;
  initialCards?: TerminalShellCard[];
  initialMessages?: TerminalShellMessage[];
  force?: boolean;
  steerActiveRun?: (input: {
    text: string;
    sessionId: string;
    userId: string;
    queueItemId: string;
  }) => Promise<{ ok: boolean; notice: string }>;
};

export type ZavorthTerminalShellRunResult = {
  rendered: boolean;
  exitCode: number;
};

export type TerminalShellCardDecisionInput = {
  action: TerminalShellCardAction;
  flags: ZavorthCliFlags;
  cards: TerminalShellCard[];
  selection: TerminalShellCardSelectionState;
  runOnce: (rawInput: string, flags: ZavorthCliFlags) => Promise<CliExecutionResult>;
};

export type TerminalShellCardDecisionResult = {
  ok: boolean;
  notice: string;
  command: string | null;
  message: TerminalShellMessage;
  card: TerminalShellCard;
};

const COLORS = {
  brand: '#00ffaa',
  muted: '#7c8a96',
  text: '#f4fbf8',
  dim: '#4f5f68',
  warning: '#fbbf24',
  danger: '#fb7185',
  panel: '#11382d',
};

function terminalShellCardColor(card: TerminalShellCard): string {
  switch (card.kind) {
    case 'approval':
      return COLORS.warning;
    case 'diff':
      return COLORS.danger;
    case 'result':
      return COLORS.brand;
    case 'tool':
      return '#38bdf8';
    default:
      return COLORS.panel;
  }
}

export async function runTerminalShellCardDecision(
  input: TerminalShellCardDecisionInput,
): Promise<TerminalShellCardDecisionResult> {
  const decision = resolveTerminalShellCardAction({
    action: input.action,
    cards: input.cards,
    selection: input.selection,
  });
  if (!decision.applied || !decision.command) {
    return {
      ok: false,
      notice: decision.notice,
      command: null,
      message: {
        role: 'system',
        text: decision.notice,
      },
      card: {
        kind: 'approval',
        title: 'Decision not sent',
        status: 'waiting',
        body: decision.notice,
      },
    };
  }
  const result = await input.runOnce(decision.command, {
    ...input.flags,
    repl: true,
  });
  const output = result.output.map((entry) => String(entry || '').trim()).filter(Boolean).join('\n\n')
    || (result.ok ? 'Decision recorded.' : result.error || 'Decision needs attention.');
  return {
    ok: result.ok,
    notice: result.ok ? 'Decision applied through the governed HUD.' : 'Decision did not apply; review the message above.',
    command: decision.command,
    message: {
      role: result.ok ? 'assistant' : 'system',
      text: output,
    },
    card: {
      kind: result.ok ? 'result' : 'approval',
      title: result.ok ? 'Decision recorded' : 'Decision blocked',
      status: result.ok ? input.action : 'waiting',
      body: output.split(/\r?\n/).slice(0, 2),
    },
  };
}

function shouldAttemptInk(force?: boolean): boolean {
  if (force) {
    return true;
  }
  if (process.env.CI || process.env.ZAVORTH_DISABLE_INK === '1') {
    return false;
  }
  return Boolean(
    process.stdin?.isTTY
    && process.stdout?.isTTY
    && typeof (process.stdin as any).setRawMode === 'function',
  );
}

export async function runZavorthCliTerminalShellInk(
  params: ZavorthTerminalShellRunnerParams,
): Promise<ZavorthTerminalShellRunResult> {
  if (!shouldAttemptInk(params.force)) {
    return { rendered: false, exitCode: 0 };
  }

  try {
    const [ink, react] = await Promise.all([import('ink'), import('react')]);
    const actionState = { exitCode: 0 };
    const instance = ink.render(
      createElement(TerminalShellInkApp, {
        ink,
        react,
        actionState,
        ...params,
      }),
      {
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );
    await instance.waitUntilExit();
    return { rendered: true, exitCode: actionState.exitCode };
  } catch (error: any) {
    if (process.env.ZAVORTH_TERMINAL_INK_DEBUG === '1') {
      console.error(error?.stack || error?.message || String(error));
    }
    return { rendered: false, exitCode: 0 };
  }
}

function TerminalShellInkApp(props: ZavorthTerminalShellRunnerParams & {
  ink: InkModule;
  react: ReactModule;
  actionState: { exitCode: number };
}) {
  const { ink, react, flags, runOnce, welcomeText, actionState } = props;
  const { Box, Text, useApp, useInput, useStdin } = ink;
  const { useMemo, useRef, useState } = react;
  const app = useApp();
  const stdin = useStdin();
  const canUseInput = Boolean((props.force || (process.stdin?.isTTY && process.stdout?.isTTY)) && stdin.isRawModeSupported);
  const historyStore = useMemo(() => createTerminalShellHistoryStore(), []);
  const [inputState, setInputState] = useState<TerminalShellInputState>(() => ({
    value: '',
    cursor: 0,
    paletteOpen: false,
    voiceArmed: false,
    history: historyStore.load(),
    historyIndex: null,
  }));
  const [busy, setBusy] = useState(false);
  const [focusState, setFocusState] = useState<TerminalShellFocusState>({
    mode: 'daily',
    sectionId: 'chat',
    target: 'composer',
  });
  const [messages, setMessages] = useState<TerminalShellMessage[]>(() => (
    props.initialMessages?.length
      ? [...props.initialMessages]
      : [
        {
          role: 'assistant',
          text: String(welcomeText || 'Ready for a new request.').split(/\r?\n/).slice(0, 4).join(' '),
        },
      ]
  ));
  const [cards, setCards] = useState<TerminalShellCard[]>(() => [...(props.initialCards || [])]);
  const [cardSelection, setCardSelection] = useState<TerminalShellCardSelectionState>({ selectedIndex: null });
  const [queue, setQueue] = useState<TerminalShellQueuedItem[]>([]);
  const [notice, setNotice] = useState('Enter sends. Shift+Enter adds a line. / opens commands.');
  const activeAbortRef = useRef<AbortController | null>(null);
  const streamRenderBuffer = useMemo(() => createTerminalShellStreamRenderBuffer({
    intervalMs: 120,
    onFlush: (text) => {
      setMessages((current) => {
        const withoutLive = current.filter(
          (message) => message.role !== 'assistant' || !message.text.startsWith('[stream] '),
        );
        return [...withoutLive.slice(-6), { role: 'assistant', text: `[stream] ${text}` }];
      });
    },
  }), []);

  const shell = useMemo(() => buildTerminalShellSnapshot({
    mode: focusState.mode,
    sessionId: flags.sessionId,
    profileId: flags.userId || 'operator',
    providerLabel: 'auto',
    modelLabel: 'auto',
    activeRun: busy,
    input: inputState.value,
    messages,
    cards,
    queue,
    voiceArmed: inputState.voiceArmed,
  }), [focusState.mode, flags.sessionId, flags.userId, busy, inputState.value, inputState.voiceArmed, messages, cards, queue]);

  const submit = async () => {
    const raw = inputState.value.trim();
    if (!raw || busy) {
      if (raw && busy) {
        // Live steering routes /steer <instruction> to the active run.
        const isSteerCommand = raw.toLowerCase().startsWith('/steer ');
        if (isSteerCommand) {
          const steerInstruction = raw.slice('/steer '.length).trim();
          const queueItemId = `queued-${queue.length + 1}`;
          let steerFailureNotice: string | null = null;
          if (props.steerActiveRun) {
            try {
              const result = await props.steerActiveRun({
                text: steerInstruction,
                sessionId: flags.sessionId,
                userId: flags.userId || 'operator',
                queueItemId,
              });
              setNotice(result.notice);
              setInputState((state) => ({ ...state, value: '', cursor: 0, paletteOpen: false }));
              if (result.ok) {
                setCards((current) => [
                  ...current.slice(-4),
                  {
                    kind: 'status',
                    title: 'Live steering',
                    status: 'accepted',
                    body: steerInstruction,
                  },
                ]);
                return;
              }
              steerFailureNotice = result.notice;
            } catch (error) {
    logger.warn('[Zavorth Cli Terminal Shell Ink App] filesystem check failed', error);
    steerFailureNotice = `Live steering unavailable: ${error?.message || String(error)}`;
  }
          }
          const queued = queueTerminalShellInput({
            activeRun: true,
            text: `/steer ${steerInstruction}`,
            existingQueue: queue,
          });
          setQueue(queued.queue);
          const queuedNotice = `Steering instruction queued: "${steerInstruction.slice(0, 40)}"`;
          setNotice(steerFailureNotice ? `${steerFailureNotice} ${queuedNotice}` : queuedNotice);
          setInputState((state) => ({ ...state, value: '', cursor: 0, paletteOpen: false }));
          return;
        }
        const queued = queueTerminalShellInput({
          activeRun: true,
          text: raw,
          existingQueue: queue,
        });
        setQueue(queued.queue);
        setNotice(queued.operatorNotice);
        setInputState((state) => ({ ...state, value: '', cursor: 0, paletteOpen: false }));
      }
      return;
    }
    if (/^(quit|exit)$/i.test(raw)) {
      actionState.exitCode = 0;
      app.exit();
      return;
    }

    const normalized = normalizeTerminalComposerInput(raw);
    historyStore.append(raw);
    const nextHistory = historyStore.load();
    setBusy(true);
    setInputState((state) => ({
      ...state,
      value: '',
      cursor: 0,
      paletteOpen: false,
      history: nextHistory,
      historyIndex: null,
    }));
    setMessages((current) => [...current.slice(-6), { role: 'user', text: raw }]);
    setCards((current) => [
      ...current.slice(-4),
      {
        kind: normalized.startsWith('/') ? 'tool' : 'status',
        title: normalized.startsWith('/') ? 'Command' : 'Working',
        status: 'running',
        body: normalized,
      },
    ]);

    try {
      const abortController = new AbortController();
      activeAbortRef.current = abortController;

      const terminalStream = {
        onEvent: async (event: CliTerminalStreamEvent) => {
          if (abortController.signal.aborted) {
            streamRenderBuffer.abort();
            return;
          }
          if (event.type === 'tool') {
            setCards((current) => [
              ...current.slice(-4),
              {
                kind: 'tool',
                title: event.title || 'Tool activity',
                status: event.status || 'running',
                body: event.text || event.delta || '',
              },
            ]);
            return;
          }
          if (event.type === 'start') {
            streamRenderBuffer.abort();
            streamRenderBuffer.start();
            setNotice('Streaming response...');
            return;
          }
          if (event.type === 'delta') {
            streamRenderBuffer.push({
              delta: event.delta,
              accumulated: event.accumulated,
            });
            return;
          }
          if (event.type === 'done') {
            streamRenderBuffer.complete({
              accumulated: event.accumulated,
            });
            setNotice('Stream complete.');
            return;
          }
          if (event.type === 'status' || event.type === 'error') {
            setCards((current) => [
              ...current.slice(-4),
              {
                kind: event.type === 'error' ? 'approval' : 'status',
                title: event.title || 'Runtime',
                status: event.status || event.type,
                body: event.text || '',
              },
            ]);
          }
        },
      };
      const result = await runOnce(normalized, {
        ...flags,
        repl: true,
        terminalStream,
        terminalAbortSignal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        return;
      }
      const output = result.output.map((entry) => String(entry || '').trim()).filter(Boolean).join('\n\n')
        || (result.ok ? 'Done.' : result.error || 'Needs attention.');
      setMessages((current) => [...current.slice(-6), {
        role: result.ok ? 'assistant' : 'system',
        text: output,
      }]);
      setCards((current) => [
        ...current.slice(-4),
        {
          kind: result.ok ? 'result' : 'approval',
          title: result.ok ? 'Result' : 'Needs attention',
          status: result.ok ? 'done' : 'waiting',
          body: output.split(/\r?\n/).slice(0, 2),
        },
      ]);
      setNotice(result.ok ? 'Ready.' : 'Review the message above before continuing.');
    } catch (error: any) {
      const message = error?.message || String(error);
      setMessages((current) => [...current.slice(-6), { role: 'system', text: message }]);
      setCards((current) => [...current.slice(-4), {
        kind: 'approval',
        title: 'Error',
        status: 'stopped',
        body: message,
      }]);
      setNotice('The request stopped safely.');
    } finally {
      streamRenderBuffer.abort();
      activeAbortRef.current = null;
      setBusy(false);
    }
  };

  const runCardAction = async (action: TerminalShellCardAction) => {
    if (busy) {
      setNotice('Wait for the active request or interrupt it with Ctrl+C.');
      return;
    }
    const visibleCards = cards.slice(-4);
    const decision = resolveTerminalShellCardAction({
      action,
      cards: visibleCards,
      selection: cardSelection,
    });
    if (!decision.applied || !decision.command) {
      setNotice(decision.notice);
      setFocusState((state) => reduceTerminalShellFocus(state, { type: 'target', target: 'cards' }));
      return;
    }
    setBusy(true);
    setNotice(decision.notice);
    setCards((current) => [
      ...current.slice(-4),
      {
        kind: 'approval',
        title: `${action[0].toUpperCase()}${action.slice(1)} approval`,
        status: 'running',
        body: decision.command,
      },
    ]);
    try {
      const result = await runTerminalShellCardDecision({
        action,
        flags,
        cards: visibleCards,
        selection: cardSelection,
        runOnce,
      });
      setMessages((current) => [...current.slice(-6), result.message]);
      setCards((current) => [
        ...current.slice(-4),
        result.card,
      ]);
      setNotice(result.notice);
    } catch (error: any) {
      const message = error?.message || String(error);
      setMessages((current) => [...current.slice(-6), { role: 'system', text: message }]);
      setCards((current) => [...current.slice(-4), {
        kind: 'approval',
        title: 'Decision error',
        status: 'stopped',
        body: message,
      }]);
      setNotice('The decision stopped safely.');
    } finally {
      setBusy(false);
    }
  };

  useInput((input: string, key: InkKey) => {
    if (!canUseInput) {
      return;
    }
    if (key.ctrl && input === 'c') {
      if (busy) {
        activeAbortRef.current?.abort();
        setBusy(false);
        setCards((current) => [...current.slice(-4), {
          kind: 'status',
          title: 'Interrupted',
          status: 'stopped',
          body: 'The active request was interrupted locally.',
        }]);
        setNotice('Interrupted safely. Ready for the next request.');
        return;
      }
      actionState.exitCode = 0;
      app.exit();
      return;
    }
    if (key.tab) {
      const nextFocus = reduceTerminalShellFocus(focusState, { type: key.shift ? 'shiftTab' : 'tab' });
      setFocusState(nextFocus);
      if (nextFocus.target === 'cards') {
        setCardSelection((state) => reduceTerminalShellCardSelection(state, { type: 'next', cards: cards.slice(-4) }));
        setNotice('Card focus. Up/Down selects. a approve, r reject, d defer.');
      }
      return;
    }
    if (input === 'o' && !inputState.value) {
      setFocusState((state) => reduceTerminalShellFocus(state, { type: 'toggleMode' }));
      setNotice(focusState.mode === 'daily' ? 'Ops detail enabled.' : 'Daily mode enabled.');
      return;
    }
    const section = shell.sections.find((entry) => entry.shortcut === input);
    if (section && !inputState.value) {
      setFocusState((state) => reduceTerminalShellFocus(state, { type: 'section', sectionId: section.id }));
      return;
    }
    if (focusState.target === 'cards' && !inputState.value && ['a', 'r', 'd'].includes(input)) {
      const action = input === 'a' ? 'approve' : input === 'r' ? 'reject' : 'defer';
      void runCardAction(action);
      return;
    }
    if (key.return) {
      if (key.shift) {
        setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'shift+enter' }));
        return;
      }
      void submit();
      return;
    }
    if (key.escape) {
      if (focusState.target !== 'composer') {
        setFocusState((state) => reduceTerminalShellFocus(state, { type: 'escape' }));
        setCardSelection({ selectedIndex: null });
        setNotice('Back to composer.');
        return;
      }
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'escape' }));
      return;
    }
    if (key.backspace || key.delete) {
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'backspace' }));
      return;
    }
    if (key.upArrow) {
      if (focusState.target === 'cards') {
        setCardSelection((state) => reduceTerminalShellCardSelection(state, { type: 'previous', cards: cards.slice(-4) }));
        setNotice('Card selected. a approve, r reject, d defer, Esc back.');
        return;
      }
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'arrowup' }));
      return;
    }
    if (key.downArrow) {
      if (focusState.target === 'cards') {
        setCardSelection((state) => reduceTerminalShellCardSelection(state, { type: 'next', cards: cards.slice(-4) }));
        setNotice('Card selected. a approve, r reject, d defer, Esc back.');
        return;
      }
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'arrowdown' }));
      return;
    }
    if (focusState.target === 'cards' && !inputState.value && (input === 'j' || input === 'k')) {
      setCardSelection((state) => reduceTerminalShellCardSelection(state, {
        type: input === 'k' ? 'previous' : 'next',
        cards: cards.slice(-4),
      }));
      setNotice('Card selected. a approve, r reject, d defer, Esc back.');
      return;
    }
    if (input === 'v' && !inputState.value) {
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: 'v' }));
      setNotice(inputState.voiceArmed ? 'Voice wake disarmed.' : 'Voice wake armed for this shell.');
      return;
    }
    if (input === '/') {
      setInputState((state) => reduceTerminalShellInput(state, { type: 'key', key: '/' }));
      return;
    }
    if (input) {
      setInputState((state) => reduceTerminalShellInput(state, { type: 'insertText', text: input }));
    }
  });

  const palette = inputState.paletteOpen
    ? buildTerminalShellCommandRegistry().commands
      .filter((command) => {
        const query = inputState.value.replace(/^\/+/, '').toLowerCase();
        return !query || command.command.toLowerCase().includes(query) || command.title.toLowerCase().includes(query);
      })
      .slice(0, 6)
    : [];
  const visibleCards = shell.cards.slice(-4);

  return createElement(Box, { flexDirection: 'column', paddingX: 1 }, [
    createElement(Box, { key: 'top', justifyContent: 'space-between' }, [
      createElement(Text, { key: 'brand', color: COLORS.brand, bold: true }, 'Zavorth Terminal Shell'),
      createElement(Text, { key: 'meta', color: COLORS.muted }, `${shell.mode} / ${shell.sessionId} / ${shell.profileId} / ${busy ? 'running' : 'ready'}`),
    ]),
    createElement(Text, { key: 'tabs', color: COLORS.muted }, shell.sections.map((section) => (
      section.id === focusState.sectionId ? `[${section.shortcut}:${section.title}]` : `${section.shortcut}:${section.title}`
    )).join('  ')),
    createElement(Box, { key: 'conversation', flexDirection: 'column', borderStyle: 'round', borderColor: COLORS.panel, paddingX: 1, marginTop: 1 }, [
      createElement(Text, { key: 'label', color: focusState.target === 'timeline' ? COLORS.brand : COLORS.muted }, 'Conversation'),
      ...shell.messages.slice(-5).map((message, index) => createElement(Text, {
        key: `message-${index}`,
        color: message.role === 'user' ? COLORS.brand : message.role === 'system' ? COLORS.warning : COLORS.text,
      }, `${message.role}: ${message.text}`)),
    ]),
    createElement(Box, { key: 'cards', flexDirection: 'column', marginTop: 1 }, [
      createElement(Text, { key: 'cards-label', color: focusState.target === 'cards' ? COLORS.brand : COLORS.muted }, shell.mode === 'ops' ? 'Inline cards' : 'Activity'),
      ...(visibleCards.length ? visibleCards.map((card, index) => {
        const selected = focusState.target === 'cards' && cardSelection.selectedIndex === index;
        const color = selected ? COLORS.brand : terminalShellCardColor(card);
        return createElement(Box, {
          key: `card-${index}`,
          borderStyle: selected ? 'round' : 'single',
          borderColor: color,
          paddingX: 1,
          marginTop: index === 0 ? 0 : 1,
        }, [
          createElement(Text, {
            key: 'line',
            color,
            bold: selected,
          }, formatTerminalShellSelectableCardLine({
            card,
            mode: shell.mode,
            selected,
          })),
        ]);
      }) : [
        createElement(Text, { key: 'no-cards', color: COLORS.dim }, 'none'),
      ]),
      ...(focusState.target === 'cards' && visibleCards.length ? [
        createElement(Text, { key: 'card-keys', color: COLORS.dim }, 'Up/Down or j/k move. a approve  r reject  d defer  Esc composer'),
      ] : []),
    ]),
    ...(palette.length ? [
      createElement(Box, { key: 'palette', flexDirection: 'column', borderStyle: 'round', borderColor: COLORS.panel, paddingX: 1, marginTop: 1 }, [
        createElement(Text, { key: 'palette-label', color: focusState.target === 'palette' ? COLORS.brand : COLORS.muted }, 'Commands'),
        ...palette.map((command) => createElement(Text, { key: command.id, color: COLORS.text }, `${command.command}  ${command.title}`)),
      ]),
    ] : []),
    ...(shell.composer.queue.length ? [
      createElement(Box, { key: 'queue', flexDirection: 'column', marginTop: 1 }, [
        createElement(Text, { key: 'queue-label', color: focusState.target === 'queue' ? COLORS.brand : COLORS.muted }, 'Queue'),
        ...shell.composer.queue.slice(-4).map((item) => createElement(Text, { key: item.id, color: COLORS.warning }, `${item.status} ${item.kind}: ${item.text}`)),
      ]),
    ] : []),
    createElement(Box, { key: 'composer', flexDirection: 'column', borderStyle: 'round', borderColor: focusState.target === 'composer' ? COLORS.brand : COLORS.panel, paddingX: 1, marginTop: 1 }, [
      createElement(Text, { key: 'input', color: inputState.value ? COLORS.text : COLORS.muted }, `> ${inputState.value || shell.composer.placeholder}`),
      createElement(Text, { key: 'hint', color: COLORS.muted }, `${notice} ${shell.composer.voiceArmed ? 'voice: armed' : 'voice: off'} history:${inputState.history?.length || 0}`),
    ]),
    createElement(Text, { key: 'footer', color: COLORS.dim }, canUseInput ? 'Tab focus. 1-7 sections. o daily/ops. Enter send. Ctrl+C interrupt/exit.' : props.initialText || formatTerminalShellScreen(shell)),
  ]);
}
