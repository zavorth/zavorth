import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type SwarmRoleStatus = {
  roleId: string;
  label: string;
  status: 'IDLE' | 'PROCESSING' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';
  output: string[];
  startedAt: string;
  finishedAt: string | null;
};

type SwarmReplayEvent = {
  id: string;
  at: string;
  type: string;
  summary: string;
  roleId?: string | null;
  batchId?: string | null;
};

type SwarmState = {
  swarmId: string;
  official?: boolean;
  experimental?: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
  objective: string;
  roles: SwarmRoleStatus[];
  startedAt: string;
  finishedAt: string | null;
  synthesizedOutput: string | null;
  queue?: {
    status: string;
    maxConcurrency: number;
    pendingBatchIds: string[];
  };
  batches?: Array<{
    batchId: string;
    index: number;
    status: string;
    roleIds: string[];
  }>;
  replay?: {
    eventCount: number;
    events: SwarmReplayEvent[];
  };
  replayInsights?: {
    status: string;
    operatorSummary: string;
    synthesisConfidence: number;
    nextReplayAction: string;
    timeline: Array<{ id: string; label: string; eventCount: number; status: string }>;
    byRole: Array<{ roleId: string; label: string; eventCount: number; outputBytes: number; status: string; confidence: number }>;
    bottlenecks: Array<{ id: string; severity: string; summary: string }>;
    compare: {
      completedRoles: number;
      failedRoles: number;
      outputSpreadBytes: number;
      strongestRoleId: string | null;
      weakestRoleId: string | null;
    };
  };
  metrics?: {
    totalRoles: number;
    queuedRoles: number;
    runningRoles: number;
    completedRoles: number;
    failedRoles: number;
    timedOutRoles: number;
    cancelledRoles: number;
    maxConcurrency: number;
    batchCount: number;
    completedBatchCount: number;
    elapsedMs: number;
    outputBytes: number;
    synthesisChars: number;
    parallelismScore: number;
  };
  roleLibrary?: {
    persistent: boolean;
    selectedRoleIds: string[];
    availableRoleCount: number;
  };
  isolation?: {
    mode: string;
    workersIsolated: boolean;
    workerRoots: Array<{ roleId: string; cwd: string; mode: string }>;
    note: string;
  };
  synthesis?: {
    mode: string;
    status: string;
    summary: string;
  };
  roleSelection?: {
    mode: string;
    requestedRoleCount: number;
    selectedRoleIds: string[];
    availableRoleCount: number;
    rationale: string;
  };
  toolExecution?: {
    plannedToolCount: number;
    executedToolCount: number;
    commandToolCount: number;
    approvalRequiredToolCount: number;
    toolIds: string[];
  };
  benchmark?: {
    enabled: boolean;
    baseline: string;
    elapsedMs: number;
    estimatedSerialMs: number;
    speedup: number;
    throughputRolesPerSecond: number;
    failureRate: number;
    qualityScore: number;
  };
  tokenBudget?: {
    status: string;
    risk: string;
    estimatedLlmCalls: number;
    estimatedTotalTokens: number;
    estimatedUsd: number;
    approved: boolean;
    rationale: string;
  };
  strongIsolation?: {
    required: boolean;
    satisfied: boolean;
    mode: string;
    wrapper: string;
    note: string;
  };
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: '#64748b', label: 'Waiting' },
  IDLE: { color: '#64748b', label: 'Completed' },
  running: { color: '#2563eb', label: 'Running' },
  PROCESSING: { color: '#2563eb', label: 'Processing' },
  completed: { color: '#059669', label: 'Completed' },
  failed: { color: '#dc2626', label: 'Failed' },
  ERROR: { color: '#dc2626', label: 'Error' },
  timed_out: { color: '#d97706', label: 'Timeout' },
  TIMEOUT: { color: '#d97706', label: 'Timeout' },
  cancelled: { color: '#64748b', label: 'Cancelled' },
  CANCELLED: { color: '#64748b', label: 'Cancelled' },
};

export function SwarmMonitor({
  apiBaseUrl,
  pollIntervalMs = 2000,
}: {
  apiBaseUrl?: string;
  pollIntervalMs?: number;
}) {
  const [swarm, setSwarm] = useState<SwarmState | null>(null);
  const [swarms, setSwarms] = useState<SwarmState[]>([]);
  const [objective, setObjective] = useState('');
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseUrl = apiBaseUrl || '/api/web/gateway/swarm-v2';

  const currentSwarmId = swarm?.swarmId || null;

  const fetchList = useCallback(async () => {
    const res = await fetch(baseUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const nextSwarms = Array.isArray(data?.swarms) ? data.swarms : [];
    setSwarms(nextSwarms);
    if (!currentSwarmId && nextSwarms.length > 0) {
      setSwarm(nextSwarms[0]);
    }
    return nextSwarms;
  }, [baseUrl, currentSwarmId]);

  const fetchState = useCallback(async (swarmId = currentSwarmId) => {
    if (!swarmId) {
      await fetchList();
      return;
    }
    const res = await fetch(`${baseUrl}/state?swarmId=${encodeURIComponent(swarmId)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data?.swarm) {
      setSwarm(data.swarm);
    }
  }, [baseUrl, currentSwarmId, fetchList]);

  useEffect(() => {
    fetchList().catch((err) => setError(err?.message || 'Failed to load swarms.'));
  }, [fetchList]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (swarm?.status === 'running') {
      intervalRef.current = setInterval(() => {
        fetchState(swarm.swarmId).catch(() => undefined);
      }, pollIntervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [swarm?.status, swarm?.swarmId, fetchState, pollIntervalMs]);

  const launchSwarm = async () => {
    const trimmedObjective = objective.trim();
    if (!trimmedObjective) return;
    setLaunching(true);
    setError(null);

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: trimmedObjective,
          official: true,
          maxConcurrency: 6,
          batchSize: 6,
          isolationMode: 'temp-worktree',
          autoSelectRoles: true,
          desiredRoleCount: 6,
          benchmark: true,
          tokenBudget: {
            maxLlmCalls: 6,
            maxEstimatedTokens: 48000,
            maxEstimatedUsd: 0.5,
            modelClass: 'standard',
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.swarm) {
        setSwarm(data.swarm);
      }
      setObjective('');
      await fetchList();
    } catch (err: any) { const error = err; const e = err;
      setError(err?.message || 'Failed to launch swarm.');
    } finally {
      setLaunching(false);
    }
  };

  const cancelSwarm = async () => {
    if (!swarm?.swarmId) return;
    try {
      const res = await fetch(`${baseUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swarmId: swarm.swarmId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.swarm) {
        setSwarm(data.swarm);
      }
    } catch (err: any) { const error = err; const e = err;
      setError(err?.message || 'Failed to cancel swarm.');
    }
  };

  const statusConfig = STATUS_CONFIG[swarm?.status || 'idle'] || STATUS_CONFIG.idle;
  const replayEvents = swarm?.replay?.events || [];
  const replayInsights = swarm?.replayInsights || null;
  const batches = swarm?.batches || [];
  const metrics = swarm?.metrics || null;
  const selectedRoleIds = swarm?.roleLibrary?.selectedRoleIds || [];
  const workerRoots = swarm?.isolation?.workerRoots || [];
  const benchmark = swarm?.benchmark || null;
  const tools = swarm?.toolExecution || null;
  const strongIsolation = swarm?.strongIsolation || null;
  const tokenBudget = swarm?.tokenBudget || null;
  const completedLabel = useMemo(() => {
    if (!metrics) return `${swarm?.roles?.length || 0} role(s)`;
    return `${metrics.completedRoles}/${metrics.totalRoles} role(s) done`;
  }, [metrics, swarm?.roles?.length]);

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Official Swarm v2</p>
          <h2 style={styles.title}>Multi-agent execution</h2>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.badge(statusConfig.color)}>{statusConfig.label}</span>
          <span style={styles.subtleBadge}>{swarm?.official ? 'official' : 'legacy'}</span>
        </div>
      </div>

      <div style={styles.launchBar}>
        <input
          style={styles.input}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && launchSwarm()}
          placeholder="Describe the objective for the agent team..."
          disabled={launching}
        />
        <button
          style={styles.primaryButton}
          onClick={launchSwarm}
          disabled={launching || !objective.trim()}
        >
          {launching ? 'Lancando...' : 'Lancar'}
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.metricGrid}>
        <Metric label="Swarms" value={String(swarms.length)} />
        <Metric label="Roles" value={completedLabel} />
        <Metric label="Concurrency" value={metrics ? String(metrics.maxConcurrency) : '6'} />
        <Metric label="Batches" value={metrics ? `${metrics.completedBatchCount}/${metrics.batchCount}` : String(batches.length)} />
        <Metric label="Replay" value={String(swarm?.replay?.eventCount || 0)} />
        <Metric label="Isolation" value={swarm?.isolation?.mode || 'temp-worktree'} />
        <Metric label="Speedup" value={benchmark?.enabled ? `${benchmark.speedup}x` : '-'} />
        <Metric label="Quality" value={benchmark?.enabled ? `${benchmark.qualityScore}/100` : '-'} />
        <Metric label="Token risk" value={tokenBudget ? tokenBudget.risk : '-'} />
      </div>

      {swarm?.objective && (
        <div style={styles.objectiveBar}>
          <div>
            <p style={styles.sectionLabel}>Objective</p>
            <p style={styles.objective}>{swarm.objective}</p>
          </div>
          {swarm.status === 'running' && (
            <button style={styles.secondaryButton} onClick={cancelSwarm}>
              Cancelar
            </button>
          )}
        </div>
      )}

      {selectedRoleIds.length > 0 && (
        <div style={styles.inlinePanel}>
          <span style={styles.sectionLabel}>Role library</span>
          <span style={styles.inlineText}>{selectedRoleIds.join(', ')}</span>
        </div>
      )}

      {(swarm?.roleSelection || tools || benchmark || strongIsolation || tokenBudget) && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionTitle}>Orchestration profile</p>
            <span style={styles.inlineText}>{swarm?.roleSelection?.mode || 'manual'}</span>
          </div>
          <div style={styles.profileGrid}>
            <ProfileItem
              label="Role selection"
              value={`${swarm?.roleSelection?.selectedRoleIds?.length || selectedRoleIds.length} role(s)`}
              detail={swarm?.roleSelection?.rationale || 'Default official role bundle.'}
            />
            <ProfileItem
              label="Tool execution"
              value={tools ? `${tools.executedToolCount}/${tools.plannedToolCount}` : '0/0'}
              detail={tools?.toolIds?.length ? tools.toolIds.join(', ') : 'No bound shell tool specs.'}
            />
            <ProfileItem
              label="Benchmark"
              value={benchmark?.enabled ? `${benchmark.throughputRolesPerSecond}/s` : 'off'}
              detail={benchmark?.enabled ? `Serial estimate ${benchmark.estimatedSerialMs}ms, failures ${benchmark.failureRate}` : 'Benchmark not requested.'}
            />
            <ProfileItem
              label="Strong isolation"
              value={strongIsolation?.satisfied ? strongIsolation.wrapper : 'not required'}
              detail={strongIsolation?.note || swarm?.isolation?.note || 'Isolation status unavailable.'}
            />
            <ProfileItem
              label="Token budget"
              value={tokenBudget ? `${tokenBudget.estimatedLlmCalls} call(s)` : 'not estimated'}
              detail={tokenBudget ? `${tokenBudget.status}, ${tokenBudget.estimatedTotalTokens} tokens, US$${tokenBudget.estimatedUsd}. ${tokenBudget.rationale}` : 'Budget guard unavailable.'}
            />
          </div>
        </div>
      )}

      {batches.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionTitle}>Batch queue</p>
            <span style={styles.inlineText}>{swarm?.queue?.status || 'queued'}</span>
          </div>
          <div style={styles.batchList}>
            {batches.map((batch) => (
              <div key={batch.batchId} style={styles.batchItem}>
                <span style={styles.batchIndex}>#{batch.index + 1}</span>
                <span style={styles.batchStatus}>{batch.status}</span>
                <span style={styles.batchRoles}>{batch.roleIds.length} role(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {swarm && swarm.roles.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Agents</p>
          <div style={styles.rolesGrid}>
            {swarm.roles.map((role) => {
              const cfg = STATUS_CONFIG[role.status] || STATUS_CONFIG.idle;
              return (
                <article key={role.roleId} style={styles.roleCard}>
                  <div style={styles.roleHeader}>
                    <div>
                      <p style={styles.roleLabel}>{role.label}</p>
                      <p style={styles.roleId}>{role.roleId}</p>
                    </div>
                    <span style={styles.roleStatus(cfg.color)}>{cfg.label}</span>
                  </div>
                  <pre style={styles.rolePre}>
                    {role.output.join('').slice(-1200) || '(waiting for output...)'}
                  </pre>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {workerRoots.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionTitle}>Worker isolation</p>
          <div style={styles.pathList}>
            {workerRoots.slice(0, 6).map((worker) => (
              <div key={`${worker.roleId}:${worker.cwd}`} style={styles.pathItem}>
                <span style={styles.roleId}>{worker.roleId}</span>
                <code style={styles.pathCode}>{worker.cwd}</code>
              </div>
            ))}
          </div>
          <p style={styles.helpText}>{swarm?.isolation?.note}</p>
        </div>
      )}

      {replayEvents.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionTitle}>Replay</p>
            <span style={styles.inlineText}>
              {replayInsights ? `${replayInsights.synthesisConfidence}/100 confidence` : `${replayEvents.length} events`}
            </span>
          </div>
          {replayInsights && (
            <div style={styles.replayInsightPanel}>
              <p style={styles.helpText}>{replayInsights.operatorSummary}</p>
              <div style={styles.replayTimeline}>
                {replayInsights.timeline.map((item) => (
                  <span key={item.id} style={styles.replayTimelineItem(item.status)}>
                    {item.label}: {item.eventCount}
                  </span>
                ))}
              </div>
              {replayInsights.bottlenecks.length > 0 ? (
                <div style={styles.replayList}>
                  {replayInsights.bottlenecks.map((item) => (
                    <div key={item.id} style={styles.replayItem}>
                      <span style={styles.replayType}>{item.severity}</span>
                      <span style={styles.replaySummary}>{item.summary}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p style={styles.helpText}>
                {replayInsights.nextReplayAction} Strongest role {replayInsights.compare.strongestRoleId || '-'}, weakest role {replayInsights.compare.weakestRoleId || '-'}.
              </p>
            </div>
          )}
          <div style={styles.replayList}>
            {replayEvents.slice(-8).map((event) => (
              <div key={event.id} style={styles.replayItem}>
                <span style={styles.replayType}>{event.type}</span>
                <span style={styles.replaySummary}>{event.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {swarm?.synthesizedOutput && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionTitle}>Final synthesis</p>
            <span style={styles.inlineText}>{swarm.synthesis?.status || 'completed'}</span>
          </div>
          <pre style={styles.synthesisPre}>{swarm.synthesizedOutput}</pre>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function ProfileItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={styles.profileItem}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.profileValue}>{value}</strong>
      <span style={styles.profileDetail}>{detail}</span>
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    background: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    padding: 16,
    color: '#0f172a',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerActions: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  eyebrow: { margin: 0, color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase' },
  title: { margin: '4px 0 0', color: '#0f172a', fontSize: 18, fontWeight: 750, letterSpacing: 0 },
  badge: (color: string) => ({
    border: `1px solid ${color}33`,
    borderRadius: 8,
    color,
    background: `${color}12`,
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 700,
  }),
  subtleBadge: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    color: '#475569',
    background: '#f8fafc',
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 700,
  },
  launchBar: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: {
    flex: '1 1 300px',
    minWidth: 0,
    padding: '10px 12px',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    color: '#0f172a',
    fontSize: 14,
    outline: 'none',
  },
  primaryButton: {
    padding: '10px 14px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '9px 12px',
    background: '#fff',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  errorBanner: {
    padding: '9px 12px',
    borderRadius: 8,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: 13,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 8,
  },
  metric: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    padding: '10px 12px',
  },
  metricLabel: { display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase' },
  metricValue: { display: 'block', marginTop: 4, color: '#0f172a', fontSize: 15, fontWeight: 750 },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 8,
    marginTop: 10,
  },
  profileItem: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    padding: '10px 12px',
    minWidth: 0,
  },
  profileValue: { display: 'block', marginTop: 4, color: '#0f172a', fontSize: 14, fontWeight: 750 },
  profileDetail: { display: 'block', marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' },
  objectiveBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#ffffff',
    padding: 12,
  },
  sectionLabel: { margin: 0, color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase' },
  objective: { margin: '4px 0 0', color: '#0f172a', fontSize: 14, lineHeight: 1.5 },
  inlinePanel: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    padding: '9px 12px',
  },
  inlineText: { color: '#64748b', fontSize: 12, fontWeight: 650 },
  section: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#ffffff',
    padding: 12,
  },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { margin: 0, color: '#0f172a', fontSize: 14, fontWeight: 750 },
  batchList: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  batchItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    padding: '7px 9px',
    fontSize: 12,
  },
  batchIndex: { color: '#475569', fontWeight: 750 },
  batchStatus: { color: '#2563eb', fontWeight: 700 },
  batchRoles: { color: '#64748b' },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 10,
    marginTop: 10,
  },
  roleCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#f8fafc',
    overflow: 'hidden',
  },
  roleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: 10,
    borderBottom: '1px solid #e5e7eb',
  },
  roleLabel: { margin: 0, color: '#0f172a', fontSize: 13, fontWeight: 750 },
  roleId: { margin: '2px 0 0', color: '#64748b', fontSize: 11, fontWeight: 650 },
  roleStatus: (color: string) => ({ color, fontSize: 12, fontWeight: 750 }),
  rolePre: {
    margin: 0,
    padding: 10,
    maxHeight: 220,
    overflowY: 'auto',
    color: '#334155',
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: '"JetBrains Mono", "Consolas", monospace',
  },
  pathList: { display: 'grid', gap: 8, marginTop: 10 },
  pathItem: { display: 'grid', gap: 4 },
  pathCode: {
    display: 'block',
    padding: '7px 8px',
    borderRadius: 6,
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    color: '#475569',
    fontSize: 11,
    overflowWrap: 'anywhere',
  },
  helpText: { margin: '10px 0 0', color: '#64748b', fontSize: 12, lineHeight: 1.5 },
  replayList: { display: 'grid', gap: 8, marginTop: 10 },
  replayInsightPanel: {
    display: 'grid',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
  },
  replayTimeline: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  replayTimelineItem: (status: string) => ({
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: status === 'failed' ? '#fef2f2' : status === 'active' ? '#eff6ff' : '#ffffff',
    color: status === 'failed' ? '#b91c1c' : status === 'active' ? '#2563eb' : '#475569',
    padding: '5px 8px',
    fontSize: 12,
    fontWeight: 750,
  }),
  replayItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.35fr) 1fr',
    gap: 10,
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: 8,
  },
  replayType: { color: '#2563eb', fontSize: 12, fontWeight: 750 },
  replaySummary: { color: '#475569', fontSize: 12, lineHeight: 1.45 },
  synthesisPre: {
    margin: '10px 0 0',
    padding: 12,
    maxHeight: 360,
    overflowY: 'auto',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    color: '#0f172a',
    fontSize: 12,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
};

export default SwarmMonitor;
