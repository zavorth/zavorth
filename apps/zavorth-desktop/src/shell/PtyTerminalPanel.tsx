import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import {
  getPtyOutput,
  sendPtyInput,
  listPtySessions,
  terminatePtySession,
} from '../apiClient';
import type { PtyRegistryEntry } from '../apiClient';
import { t } from '../i18n';
import { pickPtySession } from './ptySessionSelection';
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

type ActiveSession = { sessionId: string; cwd?: string };

export function PtyTerminalPanel({
  workspaceId,
  mode = 'floating',
  open,
  sessionKey,
  compact,
  trustLabel,
  className,
}: PtyTerminalPanelProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionLookupDone, setSessionLookupDone] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const afterSeqRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef<number>(0);
  const activeSessionRef = useRef<ActiveSession | null>(null);

  const embeddedLike = mode === 'embedded' || mode === 'rail';
  const effectiveOpen = embeddedLike ? (open === undefined ? true : Boolean(open)) : isPanelOpen;
  const sessionIdentity = sessionKey || `shell:${workspaceId}`;

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Resolve an attachable session from the runtime registry when opened.
  useEffect(() => {
    if (!effectiveOpen || !workspaceId) return;
    let alive = true;
    setSessionLookupDone(false);

    const resolveSession = async () => {
      try {
        const entries: PtyRegistryEntry[] = await listPtySessions(workspaceId);
        if (!alive) return;
        const picked = pickPtySession(entries, sessionIdentity);
        setActiveSession(picked ? { sessionId: picked.sessionId as string, cwd: picked.cwd } : null);
        setSessionLookupDone(true);
      } catch (error) {
        if (!alive) return;
        logger.warn('[pty] registry lookup failed', error);
        setActiveSession(null);
        setSessionLookupDone(true);
      }
    };

    void resolveSession();
    return () => {
      alive = false;
    };
  }, [effectiveOpen, workspaceId, sessionIdentity]);

  const initTerminal = useCallback(() => {
    if (termRef.current || !containerRef.current) return undefined;

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

    term.writeln(`\x1b[1;36m ${t('shell.ptyBannerTitle')}\x1b[0m`);
    term.writeln(`\x1b[90m ${t('shell.ptyBannerSubtitle')}\x1b[0m`);
    term.writeln('');

    term.onData((data) => {
      const current = activeSessionRef.current;
      if (!current) return;
      sendPtyInput(workspaceId, current.sessionId, data).catch((err) => {
        logger.warn('[pty] send input failed', err);
      });
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
  }, [workspaceId]);

  useEffect(() => {
    if (effectiveOpen) {
      const cleanup = initTerminal();
      return cleanup;
    }
  }, [effectiveOpen, initTerminal]);

  // Output polling with backoff; resets when the attached session changes.
  useEffect(() => {
    if (!effectiveOpen) return;
    if (!termRef.current) return;

    let cancelled = false;

    const poll = async () => {
      const current = activeSessionRef.current;
      if (!current || cancelled) return;
      try {
        const chunks = await getPtyOutput(workspaceId, current.sessionId, afterSeqRef.current);
        if (cancelled) return;
        failureCountRef.current = 0;
        if (chunks.length > 0) {
          let maxSeq = afterSeqRef.current;
          for (const chunk of chunks) {
            termRef.current?.write(chunk.chunk);
            if (chunk.seq > maxSeq) maxSeq = chunk.seq;
          }
          afterSeqRef.current = maxSeq;
        }
      } catch (error) {
        if (cancelled) return;
        failureCountRef.current += 1;
        logger.warn('[pty] poll failed', error);
      }
      if (cancelled) return;
      pollingRef.current = setTimeout(poll, nextDelay());
    };

    const nextDelay = () => 200 + Math.min(failureCountRef.current, 4) * 400;

    pollingRef.current = setTimeout(poll, 200);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [workspaceId, activeSession, effectiveOpen]);

  useEffect(() => {
    if (fitAddonRef.current && effectiveOpen) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [effectiveOpen, isMaximized]);

  const handleTerminate = useCallback(() => {
    const current = activeSessionRef.current;
    if (!current) return;
    terminatePtySession(workspaceId, current.sessionId).catch((err) => {
      logger.warn('[pty] terminate failed', err);
    });
    setActiveSession(null);
  }, [workspaceId]);

  const renderSessionMeta = () => (
    <div className="zvd-pty-embedded__meta">
      <span className="zvd-pty-dot" aria-hidden="true" />
      <span>
        PTY{' '}
        {activeSession
          ? `— ${activeSession.sessionId.slice(0, 8)}`
          : `— ${t('shell.ptyNoSession')}`}
      </span>
      {!activeSession && !sessionLookupDone ? (
        <span className="zvd-pty-cwd">│ {t('loading')}</span>
      ) : null}
      {!activeSession && sessionLookupDone ? (
        <span className="zvd-pty-cwd">│ {t('chooseWorkspaceToEnableShell')}</span>
      ) : null}
      {trustLabel ? <span className="zvd-pty-trust">│ {trustLabel}</span> : null}
      {activeSession?.cwd ? <span className="zvd-pty-cwd">│ {activeSession.cwd}</span> : null}
      {activeSession ? (
        <button type="button" className="zvd-pty-trust" onClick={handleTerminate}>
          {t('runtime.stop')}
        </button>
      ) : null}
    </div>
  );

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
        {renderSessionMeta()}
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
        {t('shell.ptyDockLabel')}
      </div>
    );
  }

  const height = isMaximized ? 'calc(100vh - 60px)' : '320px';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-slate-700 flex flex-col z-50 shadow-2xl transition-all duration-200"
      style={{ height }}
    >
      <div className="flex justify-between items-center bg-[#161b22] px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-green-400">●</span>
          <span className="font-medium text-slate-300">
            PTY {activeSession ? `— ${activeSession.sessionId.slice(0, 8)}` : `— ${t('shell.ptyNoSession')}`}
          </span>
          {activeSession && (
            <span className="text-slate-500">│ {activeSession.cwd || '~'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700"
            title={isMaximized ? t('shell.ptyRestore') : t('shell.ptyMaximize')}
            type="button"
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            onClick={() => { setIsPanelOpen(false); setIsMaximized(false); }}
            className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700"
            title={t('shell.close')}
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
