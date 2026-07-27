/**
 * LiveTerminal — Real-time WebSocket terminal viewer for PTY sessions.
 *
 * This React component connects to the Zavorth WebSocket endpoint and
 * renders terminal output in real-time. Features:
 *  - Dark terminal aesthetic with monospace font
 *  - Input bar for sending commands to the agent
 *  - Status indicator (IDLE/PROCESSING/ERROR)
 *  - Auto-scroll with manual scroll lock
 *  - Session selection dropdown
 *
 * Usage: <LiveTerminal sessionId="my-session" />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

type TerminalMessage = {
  type: 'pty:data' | 'pty:error' | 'state:change' | 'init';
  data?: string;
  error?: string;
  state?: any;
  sessionId?: string;
};

type AgentStatus = 'IDLE' | 'PROCESSING' | 'ERROR';

const STATUS_COLORS: Record<AgentStatus, string> = {
  IDLE: '#4ade80',
  PROCESSING: '#facc15',
  ERROR: '#f87171',
};

export function LiveTerminal({
  sessionId,
  wsUrl,
}: {
  sessionId?: string;
  wsUrl?: string;
}) {
  const [lines, setLines] = useState<Array<{ text: string; type: 'output' | 'error' | 'input' }>>([]);
  const [status, setStatus] = useState<AgentStatus>('IDLE');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const resolvedUrl = wsUrl || buildWsUrl(sessionId);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(resolvedUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg: TerminalMessage = JSON.parse(event.data);

        if (msg.type === 'init') {
          setStatus(msg.state?.status || 'IDLE');
        }

        if (msg.type === 'pty:data' && msg.data) {
          setLines((prev) => [...prev.slice(-500), { text: msg.data!, type: 'output' }]);
        }

        if (msg.type === 'pty:error' && msg.error) {
          setLines((prev) => [...prev.slice(-500), { text: msg.error!, type: 'error' }]);
        }

        if (msg.type === 'state:change' && msg.state) {
          setStatus(msg.state.status || 'IDLE');
        }
      } catch (error: unknown) {// raw text fallback
        setLines((prev) => [...prev.slice(-500), { text: event.data, type: 'output' }]);
      }
    };
  }, [resolvedUrl]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const sendInput = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'pty:input', input: input + '\n' }));
    setLines((prev) => [...prev, { text: `❯ ${input}`, type: 'input' }]);
    setInput('');
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.dot(connected ? '#4ade80' : '#f87171')} />
          <span style={styles.title}>
            {sessionId || 'Terminal'} — {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div style={styles.statusBadge(STATUS_COLORS[status])}>
          {status}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={containerRef}
        style={styles.output}
        onScroll={handleScroll}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              ...styles.line,
              color: line.type === 'error' ? '#f87171' : line.type === 'input' ? '#60a5fa' : '#e2e8f0',
            }}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={styles.inputBar}>
        <span style={styles.prompt}>❯</span>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendInput()}
          placeholder="Send command..."
          disabled={!connected}
        />
        <button style={styles.sendBtn} onClick={sendInput} disabled={!connected}>
          Enviar
        </button>
      </div>
    </div>
  );
}

function buildWsUrl(sessionId?: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const sid = sessionId || `live-${Date.now()}`;
  return `${protocol}//${host}/api/web/experimental/session-v2/ws?sessionId=${sid}`;
}

const styles: Record<string, any> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '400px',
    background: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: (color: string) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
    boxShadow: `0 0 6px ${color}`,
  }),
  title: {
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 500,
  },
  statusBadge: (color: string) => ({
    padding: '2px 10px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#0f172a',
    background: color,
    letterSpacing: '0.5px',
  }),
  output: {
    flex: 1,
    padding: '12px 16px',
    overflowY: 'auto',
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  line: {
    margin: 0,
    padding: 0,
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#1e293b',
    borderTop: '1px solid #334155',
    gap: '8px',
  },
  prompt: {
    color: '#4ade80',
    fontSize: '14px',
    fontWeight: 700,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e2e8f0',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  sendBtn: {
    padding: '4px 14px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default LiveTerminal;
