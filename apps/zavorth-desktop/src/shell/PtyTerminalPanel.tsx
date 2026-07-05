import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import { getPtyOutput, sendPtyInput } from '../apiClient';
import { logger } from '../logger.js';

interface PtyTerminalPanelProps {
  workspaceId: string;
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

export function PtyTerminalPanel({ workspaceId }: PtyTerminalPanelProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const afterSeqRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initTerminal = useCallback(() => {
    if (termRef.current || !containerRef.current) return;

    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
      fontSize: 14,
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
        sendPtyInput(workspaceId, activeSession.sessionId, data).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
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
    if (isPanelOpen) {
      const cleanup = initTerminal();
      return cleanup;
    }
  }, [isPanelOpen, initTerminal]);

  useEffect(() => {
    if (!activeSession || !isPanelOpen || !termRef.current) return;

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
      } catch (e) {
        // silent
      }
    }, 200);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [workspaceId, activeSession, isPanelOpen]);

  useEffect(() => {
    if (fitAddonRef.current && isPanelOpen) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [isPanelOpen, isMaximized]);

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
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            onClick={() => { setIsPanelOpen(false); setIsMaximized(false); }}
            className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
