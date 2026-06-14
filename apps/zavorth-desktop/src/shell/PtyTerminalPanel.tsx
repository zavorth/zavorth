import React, { useEffect, useState, useRef } from 'react';
import { getPtyOutput } from '../apiClient';

interface PtyTerminalPanelProps {
  workspaceId: string;
}

export function PtyTerminalPanel({ workspaceId }: PtyTerminalPanelProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [output, setOutput] = useState<string>('');
  const [afterSeq, setAfterSeq] = useState<number>(0);
  const [inputVal, setInputVal] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let interval: any;
    if (activeSession && isPanelOpen) {
      interval = setInterval(async () => {
        try {
          const chunks = await getPtyOutput(workspaceId, activeSession.sessionId, afterSeq);
          if (chunks.length > 0) {
            let newText = '';
            let maxSeq = afterSeq;
            for (const chunk of chunks) {
              newText += chunk.chunk;
              if (chunk.seq > maxSeq) maxSeq = chunk.seq;
            }
            setOutput(prev => prev + newText);
            setAfterSeq(maxSeq);
          }
        } catch (e) {
          console.error('PTY output polling error', e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workspaceId, activeSession, afterSeq, isPanelOpen]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // For finding an active session, let's pretend we have an endpoint or we just pick the first one we see from approvals
  useEffect(() => {
    const checkSessions = async () => {
      // Actually we don't have a GET /active-sessions endpoint. We might just rely on the user seeing a pending approval 
      // and once approved, we could track it locally in the UI state.
      // But for 21G, let's just make the terminal visible. We can add an endpoint to fetch active sessions if needed.
    };
    if (isPanelOpen) {
      checkSessions();
    }
  }, [isPanelOpen]);

  if (!isPanelOpen) {
    return (
      <div 
        className="fixed bottom-0 right-10 bg-slate-800 text-white p-2 rounded-t cursor-pointer z-50 hover:bg-slate-700"
        onClick={() => setIsPanelOpen(true)}
      >
        Open Terminal
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-10 right-10 h-80 bg-slate-900 border-t border-slate-700 flex flex-col z-50 text-white font-mono text-sm shadow-2xl">
      <div className="flex justify-between items-center bg-slate-800 p-2 text-xs text-slate-300">
        <span>PTY Terminal {activeSession ? `(${activeSession.sessionId})` : '(No Session)'}</span>
        <button onClick={() => setIsPanelOpen(false)} className="hover:text-white px-2">Close</button>
      </div>
      <div className="flex-1 p-2 overflow-auto text-green-400 bg-black">
        <pre ref={outputRef} className="whitespace-pre-wrap break-all">{output}</pre>
      </div>
      <div className="p-2 bg-slate-800 flex gap-2">
        <span className="text-blue-400">$</span>
        <input 
          type="text" 
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={async e => {
            if (e.key === 'Enter' && activeSession) {
              const cmd = inputVal + '\n';
              setInputVal('');
              // Just simulate input. The agent uses workspace.pty.write tool. 
              // The user shouldn't write to the terminal natively, the agent writes, but we could allow user to type.
              // We won't implement direct UI input writing for the user right now since 21G focuses on agent writing.
            }
          }}
          placeholder={activeSession ? "Agent controls this terminal..." : "Waiting for session..."}
          className="flex-1 bg-transparent outline-none text-slate-200"
          readOnly
        />
      </div>
    </div>
  );
}
