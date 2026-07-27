import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import { getPtyOutput, sendPtyInput } from '../apiClient';
import { createLogger } from '../logger.js';

const logger = createLogger('shell');

interface PtyTerminalPanelProps {
  workspaceId: string;
  /** floating = self-managed dock button; embedded = parent controls open state */
  mode?: 'floating' | 'embedded' | 'rail';
  open?: boolean;
  /** Per-tab session key (shell/agent tabs); used for identity until multi-PTY is fully wired. */
  sessionKey?: string;
  compact?: boolean;
  trustLabel?: string;
  className?: string;
}

const TERMINAL_THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#c9d1d9',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

export function PtyTerminalPanel({
  workspaceId,
  mode = 'floating',
  open,
  sessionKey,
  compact,
  trustLabel,
  className,
}: PtyTerminalPanelProps) {
  const [sessions, setSessions] = useState<Array<{ sessionId: string; cwd?: string }>>([]);
  const [activeSession, setActiveSession] = useState<{ sessionId: string; cwd?: string } | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const afterSeqRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const embeddedLike = mode === 'embedded' || mode === 'rail';
  const effectiveOpen = embeddedLike ? (open === undefined ? true : Boolean(open)) : isPanelOpen;
  const sessionIdentity = sessionKey || `shell:${workspaceId}`;

  const initTerminal = useCallback(() => {
    if (termRef.current || !containerRef.current) return;

    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const unicodeAddon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(unicodeAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;36m Zavorth Terminal\x1b[0m');
    term.writeln('\x1b[90m Ready. Waiting for PTY session...\x1b[0m');
    term.writeln('');

    term.onData((data) => {
      if (activeSession) {
        sendPtyInput(workspaceId, activeSession.sessionId, data).catch((err) => {
          logger.warn('[pty] send input failed', err);
        });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [workspaceId, activeSession]);

  useEffect(() => {
    if (effectiveOpen) {
      const cleanup = initTerminal();
      return cleanup;
    }
  }, [effectiveOpen, initTerminal]);

  useEffect(() => {
    if (!activeSession || !effectiveOpen || !termRef.current) return;

    const term = termRef.current;
    afterSeqRef.current = 0;

    pollingRef.current = setInterval(async () => {
      try {
        const chunks = await getPtyOutput(workspaceId, activeSession.sessionId, afterSeqRef.current);
        if (chunks.length > 0) {
          let maxSeq = afterSeqRef.current;
          for (const chunk of chunks) {
            term.write(chunk.chunk);
            if (chunk.seq > maxSeq) maxSeq = chunk.seq;
          }
          afterSeqRef.current = maxSeq;
        }
      } catch {
        // silent poll failures
      }
    }, 200);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [workspaceId, activeSession, effectiveOpen]);

  useEffect(() => {
    if (fitAddonRef.current && effectiveOpen) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [effectiveOpen, isMaximized]);

  // Silence unused until PTY session list API is wired.
  void sessions;
  void setSessions;
  void setActiveSession;

  if (embeddedLike) {
    if (!effectiveOpen) return null;
    return (
      <div
        className={[
          'zvd-pty-embedded',
          compact ? 'is-compact' : '',
          mode === 'rail' ? 'is-rail' : '',
          className || '',
        ].filter(Boolean).join(' ')}
        data-session-key={sessionIdentity}
      >
        <div className="zvd-pty-embedded__meta">
          <span className="zvd-pty-dot" aria-hidden="true" />
          <span>
            PTY {activeSession ? `— ${activeSession.sessionId.slice(0, 8)}` : '— No session yet'}
          </span>
          {trustLabel ? <span className="zvd-pty-trust">│ {trustLabel}</span> : null}
          {activeSession?.cwd ? <span className="zvd-pty-cwd">│ {activeSession.cwd}</span> : null}
        </div>
        <div ref={containerRef} className="zvd-pty-embedded__term" />
      </div>
    );
  }

  if (!isPanelOpen) {
    return (
      <div
        className="fixed bottom-0 right-10 bg-slate-800 text-white p-2 rounded-t cursor-pointer z-50 hover:bg-slate-700 flex items-center gap-2"
        onClick={() => setIsPanelOpen(true)}
      >
        <span className="text-green-400">●</span>
        Terminal
      </div>
    );
  }

  const height = isMaximized ? 'calc(100vh ? 60px)' : '320px';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-slate-700 flex flex-col z-50 shadow-2xl transition-all duration-200"
      style={{ height }}
    >
      <div className="flex justify-between items-center bg-[#161b22] px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-green-400">●</span>
          <span className="font-medium text-slate-300">
            PTY {activeSession ? `— ${activeSession.sessionId.slice(0, 8)}` : '— No Session'}
          </span>
          {activeSession && (
            <span className="text-slate-500">│ {activeSession.cwd || '~'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700"
            title={isMaximized ? 'Restore' : 'Maximize'}
            type="button"
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            onClick={() => { setIsPanelOpen(false); setIsMaximized(false); }}
            className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700"
            title="Close"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
