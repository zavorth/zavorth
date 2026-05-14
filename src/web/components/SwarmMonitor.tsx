/**
 * SwarmMonitor — Real-time dashboard component for monitoring Swarm Orchestrator execution.
 *
 * Shows:
 *  - Cards for each swarm role with status indicators
 *  - Real-time output streaming per role
 *  - Final synthesized output as rendered markdown
 *  - Controls to launch new swarms or cancel running ones
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

type SwarmRoleStatus = {
  roleId: string;
  label: string;
  status: 'IDLE' | 'PROCESSING' | 'ERROR';
  output: string[];
  startedAt: string;
  finishedAt: string | null;
};

type SwarmState = {
  swarmId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  objective: string;
  roles: SwarmRoleStatus[];
  startedAt: string;
  finishedAt: string | null;
  synthesizedOutput: string | null;
};

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  idle: { color: '#64748b', icon: '⏸', label: 'Aguardando' },
  IDLE: { color: '#64748b', icon: '⏸', label: 'Aguardando' },
  running: { color: '#facc15', icon: '🔄', label: 'Executando' },
  PROCESSING: { color: '#facc15', icon: '⚡', label: 'Processando' },
  completed: { color: '#4ade80', icon: '✅', label: 'Concluído' },
  failed: { color: '#f87171', icon: '❌', label: 'Falhou' },
  ERROR: { color: '#f87171', icon: '❌', label: 'Erro' },
};

export function SwarmMonitor({
  apiBaseUrl,
  pollIntervalMs = 2000,
}: {
  apiBaseUrl?: string;
  pollIntervalMs?: number;
}) {
  const [swarm, setSwarm] = useState<SwarmState | null>(null);
  const [objective, setObjective] = useState('');
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseUrl = apiBaseUrl || '/api/web/experimental/swarm-v2';

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data?.swarmId) {
          setSwarm(data as SwarmState);
        }
      }
    } catch {
      // Polling failure is non-fatal
    }
  }, [baseUrl]);

  // Poll for updates when swarm is running
  useEffect(() => {
    if (swarm?.status === 'running') {
      intervalRef.current = setInterval(fetchState, pollIntervalMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [swarm?.status, fetchState, pollIntervalMs]);

  const launchSwarm = async () => {
    if (!objective.trim()) return;
    setLaunching(true);
    setError(null);

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: objective.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSwarm(data as SwarmState);
      setObjective('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  };

  const cancelSwarm = async () => {
    try {
      await fetch(`${baseUrl}/cancel`, { method: 'POST' });
      await fetchState();
    } catch {
      // ignore
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.icon}>🐝</span>
          <span style={styles.title}>Swarm Orchestrator</span>
        </div>
        {swarm && (
          <div style={styles.statusBadge(STATUS_CONFIG[swarm.status]?.color || '#64748b')}>
            {STATUS_CONFIG[swarm.status]?.icon} {STATUS_CONFIG[swarm.status]?.label}
          </div>
        )}
      </div>

      {/* Launch Bar */}
      {(!swarm || swarm.status !== 'running') && (
        <div style={styles.launchBar}>
          <input
            style={styles.input}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && launchSwarm()}
            placeholder="Descreva o objetivo para o enxame de agentes..."
            disabled={launching}
          />
          <button
            style={styles.launchBtn}
            onClick={launchSwarm}
            disabled={launching || !objective.trim()}
          >
            {launching ? '...' : '🚀 Lançar Swarm'}
          </button>
        </div>
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Role Cards */}
      {swarm && swarm.roles.length > 0 && (
        <div style={styles.rolesGrid}>
          {swarm.roles.map((role) => {
            const cfg = STATUS_CONFIG[role.status] || STATUS_CONFIG.idle;
            return (
              <div key={role.roleId} style={styles.roleCard}>
                <div style={styles.roleHeader}>
                  <span style={styles.roleLabel}>{cfg.icon} {role.label}</span>
                  <span style={{ ...styles.roleStatus, color: cfg.color }}>{cfg.label}</span>
                </div>
                <div style={styles.roleOutput}>
                  <pre style={styles.rolePre}>
                    {role.output.join('').slice(-800) || '(aguardando output...)'}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Synthesized Output */}
      {swarm?.synthesizedOutput && (
        <div style={styles.synthesisSection}>
          <div style={styles.synthesisHeader}>🧠 Síntese Inteligente</div>
          <div style={styles.synthesisContent}>
            <pre style={styles.synthesisPre}>{swarm.synthesizedOutput}</pre>
          </div>
        </div>
      )}

      {/* Cancel button */}
      {swarm?.status === 'running' && (
        <div style={styles.cancelBar}>
          <button style={styles.cancelBtn} onClick={cancelSwarm}>
            ⏹ Cancelar Swarm
          </button>
        </div>
      )}

      {/* Objective display */}
      {swarm?.objective && (
        <div style={styles.objectiveBar}>
          📎 {swarm.objective}
          {swarm.finishedAt && (
            <span style={styles.duration}>
              {' '}· Finalizado em {new Date(swarm.finishedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderBottom: '1px solid #334155',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  icon: { fontSize: '24px' },
  title: { color: '#e2e8f0', fontSize: '18px', fontWeight: 700 },
  statusBadge: (color: string) => ({
    padding: '4px 12px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#0f172a',
    background: color,
  }),
  launchBar: {
    display: 'flex',
    padding: '12px 20px',
    gap: '10px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
  },
  launchBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  errorBanner: {
    padding: '8px 20px',
    background: '#7f1d1d',
    color: '#fca5a5',
    fontSize: '13px',
  },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '12px',
    padding: '16px 20px',
  },
  roleCard: {
    background: '#1e293b',
    borderRadius: '10px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  roleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #334155',
  },
  roleLabel: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
  },
  roleStatus: {
    fontSize: '12px',
    fontWeight: 600,
  },
  roleOutput: {
    padding: '10px 14px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  rolePre: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#94a3b8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontFamily: '"JetBrains Mono", monospace',
  },
  synthesisSection: {
    margin: '0 20px 16px',
    borderRadius: '10px',
    border: '1px solid #4f46e5',
    overflow: 'hidden',
  },
  synthesisHeader: {
    padding: '10px 14px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
  },
  synthesisContent: {
    padding: '14px',
    background: '#1e1b4b',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  synthesisPre: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    fontFamily: '"Inter", sans-serif',
  },
  cancelBar: {
    padding: '8px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  cancelBtn: {
    padding: '8px 24px',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  objectiveBar: {
    padding: '10px 20px',
    background: '#1e293b',
    borderTop: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '12px',
  },
  duration: {
    color: '#64748b',
  },
};

export default SwarmMonitor;
