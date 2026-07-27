import { useMemo } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { PageFrame, SearchBox, TextTabs, DetailRows } from './panelPrimitives';
import type { DetailRow } from './panelPrimitives';
import {
  IconCoin,
  IconClock,
  IconStack2,
  IconDownload,
  IconFlask,
  IconRobot,
  IconChartBar,
  IconActivity,
} from '@tabler/icons-react';
import { t } from '../../i18n';
import { CostSavingsPanel } from './CostSavingsPanel';
import { SessionExportPanel } from './SessionExportPanel';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model?: string;
  timestamp?: number;
};

export type ToolCall = {
  name: string;
  success: boolean;
  durationMs?: number;
  timestamp?: number;
};

export type SessionData = {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'completed' | 'failed';
  model?: string;
  tokenUsage?: TokenUsage;
};

export type UsageAnalyticsPanelProps = {
  tokenUsages: TokenUsage[];
  toolCalls: ToolCall[];
  sessions: SessionData[];
  costPerModel?: Record<string, { input: number; output: number }>;
  /** Optional active session for redacted transcript export. */
  activeSessionId?: string | null;
  exportMessages?: Array<{ role: string; content: string }>;
};

const $selectedTab = atom<'overview' | 'tools' | 'models' | 'sessions' | 'savings' | 'export'>('overview');
const $searchQuery = atom('');

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard(props: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="zvd-ua-stat-card">
      <div className="zvd-ua-stat-icon" style={{ color: props.accent || 'var(--zvd-accent, #f16a21)' }}>
        {props.icon}
      </div>
      <div className="zvd-ua-stat-content">
        <span className="zvd-ua-stat-value">{props.value}</span>
        <span className="zvd-ua-stat-label">{props.label}</span>
        {props.sub && <span className="zvd-ua-stat-sub">{props.sub}</span>}
      </div>
    </div>
  );
}

function BarChart(props: { data: { label: string; value: number; color?: string }[]; maxBars?: number }) {
  const items = props.maxBars ? props.data.slice(0, props.maxBars) : props.data;
  const max = Math.max(...items.map((d) => d.value), 1);

  return (
    <div className="zvd-ua-chart">
      {items.map((item, i) => (
        <div key={i} className="zvd-ua-chart-col">
          <div className="zvd-ua-chart-bar-wrap">
            <div
              className="zvd-ua-chart-bar"
              style={{
                height: `${(item.value / max) * 100}%`,
                background: item.color || 'var(--zvd-accent, #f16a21)',
              }}
            />
          </div>
          <span className="zvd-ua-chart-label">{item.label}</span>
          <span className="zvd-ua-chart-val">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function SuccessBadge(props: { rate: number }) {
  const tone = props.rate >= 0.9 ? 'ready' : props.rate >= 0.7 ? 'warning' : 'danger';
  return <span className={`zvd-ua-badge tone-${tone}`}>{(props.rate * 100).toFixed(0)}%</span>;
}

export default function UsageAnalyticsPanel(props: UsageAnalyticsPanelProps) {
  const tab = useStore($selectedTab);
  const search = useStore($searchQuery);

  // Aggregate token usage
  const tokenSummary = useMemo(() => {
    const totals = props.tokenUsages.reduce(
      (acc, u) => ({
        input: acc.input + u.inputTokens,
        output: acc.output + u.outputTokens,
        total: acc.total + u.totalTokens,
      }),
      { input: 0, output: 0, total: 0 },
    );
    return totals;
  }, [props.tokenUsages]);

  // Cost breakdown by model
  const modelBreakdown = useMemo(() => {
    const byModel = new Map<string, { input: number; output: number; calls: number }>();
    for (const u of props.tokenUsages) {
      const model = u.model || 'unknown';
      const entry = byModel.get(model) || { input: 0, output: 0, calls: 0 };
      entry.input += u.inputTokens;
      entry.output += u.outputTokens;
      entry.calls += 1;
      byModel.set(model, entry);
    }

    return Array.from(byModel.entries())
      .map(([model, data]) => {
        const rates = props.costPerModel?.[model];
        const cost = rates ? (data.input / 1_000_000) * rates.input + (data.output / 1_000_000) * rates.output : 0;
        return { model, ...data, cost };
      })
      .sort((a, b) => b.cost ? a.cost);
  }, [props.tokenUsages, props.costPerModel]);

  // Total estimated cost
  const totalCost = useMemo(() => modelBreakdown.reduce((sum, m) => sum + m.cost, 0), [modelBreakdown]);

  // Session statistics
  const sessionStats = useMemo(() => {
    const total = props.sessions.length;
    const active = props.sessions.filter((s) => s.status === 'active').length;
    const durations = props.sessions.filter((s) => s.endedAt).map((s) => (s.endedAt as number) ? s.startedAt);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    return { total, active, avgDuration };
  }, [props.sessions]);

  // Tool usage ranking
  const toolRanking = useMemo(() => {
    const byTool = new Map<string, { total: number; success: number; totalDuration: number }>();
    for (const call of props.toolCalls) {
      const entry = byTool.get(call.name) || { total: 0, success: 0, totalDuration: 0 };
      entry.total += 1;
      if (call.success) entry.success += 1;
      entry.totalDuration += call.durationMs || 0;
      byTool.set(call.name, entry);
    }
    return Array.from(byTool.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        successRate: data.total > 0 ? data.success / data.total : 0,
        avgDuration: data.total > 0 ? data.totalDuration / data.total : 0,
      }))
      .sort((a, b) => b.total ? a.total)
      .slice(0, 10);
  }, [props.toolCalls]);

  // Daily usage for chart (last 7 days)
  const dailyUsage = useMemo(() => {
    const now = new Date();
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86_400_000;
      const tokens = props.tokenUsages
        .filter((u) => (u.timestamp || 0) >= dayStart && (u.timestamp || 0) < dayEnd)
        .reduce((sum, u) => sum + u.totalTokens, 0);
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        value: tokens,
      });
    }
    return days;
  }, [props.tokenUsages]);

  // Export handler
  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      tokenSummary,
      totalCost,
      modelBreakdown,
      sessionStats,
      toolRanking,
      dailyUsage,
      raw: {
        tokenUsages: props.tokenUsages,
        toolCalls: props.toolCalls,
        sessions: props.sessions,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zavorth-analytics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered tool ranking for search
  const filteredToolRanking = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return toolRanking;
    return toolRanking.filter((t) => t.name.toLowerCase().includes(q));
  }, [toolRanking, search]);

  // Tool detail rows
  const toolRows: DetailRow[] = filteredToolRanking.map((t) => ({
    id: `tool-${t.name}`,
    title: t.name,
    description: `Avg duration: ${formatDuration(t.avgDuration)}`,
    meta: `${t.total} calls`,
    tone: t.successRate >= 0.9 ? 'ready' : t.successRate >= 0.7 ? 'warning' : 'danger',
    actions: <SuccessBadge rate={t.successRate} />,
  }));

  // Model detail rows
  const modelRows: DetailRow[] = modelBreakdown.map((m) => ({
    id: `model-${m.model}`,
    title: m.model,
    description: `In: ${formatNumber(m.input)} / Out: ${formatNumber(m.output)}`,
    meta: formatCost(m.cost),
    tone: 'muted' as const,
  }));

  // Session detail rows
  const sessionRows: DetailRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return props.sessions
      .filter((s) => {
        if (!q) return true;
        return s.id.toLowerCase().includes(q) || (s.model || '').toLowerCase().includes(q);
      })
      .sort((a, b) => b.startedAt ? a.startedAt)
      .slice(0, 50)
      .map((s) => ({
        id: `session-${s.id}`,
        title: s.id,
        description: s.model || 'default model',
        meta: s.endedAt ? formatDuration(s.endedAt ? s.startedAt) : 'running',
        tone: (s.status === 'active' ? 'ready' : s.status === 'failed' ? 'danger' : 'muted') as
          | 'ready'
          | 'danger'
          | 'muted',
      }));
  }, [props.sessions, search]);

  const totalTokensAll = tokenSummary.total;

  return (
    <PageFrame
      eyebrow="analytics"
      description="Track token consumption, cost estimates, tool performance, and session activity across your workspace."
      meta={`${formatNumber(totalTokensAll)} tokens`}
      title="Usage Analytics"
      actions={
        <button type="button" className="zvd-ua-export-btn" onClick={handleExport}>
          <IconDownload size={14} />
          <span>Export JSON</span>
        </button>
      }
    >
      <style>{`
        .zvd-ua-export-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #25262d;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .zvd-ua-export-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        /* Stat cards grid */
        .zvd-ua-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .zvd-ua-stat-card {
          background: #121318;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: border-color 0.2s;
        }

        .zvd-ua-stat-card:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .zvd-ua-stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .zvd-ua-stat-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .zvd-ua-stat-value {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          line-height: 1.2;
        }

        .zvd-ua-stat-label {
          font-size: 11.5px;
          color: #71717a;
          margin-top: 2px;
        }

        .zvd-ua-stat-sub {
          font-size: 10.5px;
          color: #52525b;
          margin-top: 1px;
        }

        /* Bar chart */
        .zvd-ua-chart {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 140px;
          padding: 12px 0;
          margin-bottom: 24px;
        }

        .zvd-ua-chart-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
        }

        .zvd-ua-chart-bar-wrap {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .zvd-ua-chart-bar {
          width: 70%;
          min-height: 2px;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease;
        }

        .zvd-ua-chart-label {
          font-size: 10px;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .zvd-ua-chart-val {
          font-size: 10px;
          color: #52525b;
        }

        /* Badge */
        .zvd-ua-badge {
          display: inline-block;
          font-size: 10.5px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
        }

        .zvd-ua-badge.tone-ready {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .zvd-ua-badge.tone-warning {
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
        }

        .zvd-ua-badge.tone-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        /* Section headers */
        .zvd-ua-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #71717a;
          margin: 20px 0 10px 4px;
        }

        /* Model cost table */
        .zvd-ua-model-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }

        .zvd-ua-model-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .zvd-ua-model-table td {
          font-size: 13px;
          color: #e4e4e7;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .zvd-ua-model-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        .zvd-ua-model-name {
          font-weight: 600;
          color: #fff;
        }

        .zvd-ua-model-cost {
          font-weight: 600;
          color: var(--zvd-accent, #f16a21);
          font-variant-numeric: tabular-nums;
        }

        /* Search within tab */
        .zvd-ua-inline-search {
          margin-bottom: 16px;
        }
      `}</style>

      <TextTabs
        value={tab}
        onChange={$selectedTab.set}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'tools', label: 'Tools', count: props.toolCalls.length },
          { value: 'models', label: 'Models', count: modelBreakdown.length },
          { value: 'sessions', label: 'Sessions', count: props.sessions.length },
          { value: 'savings', label: t('costSavings.tab') },
          { value: 'export', label: t('sessionExport.tab') || 'Export' },
        ]}
      />

      {tab === 'overview' && (
        <div>
          {/* Summary stat cards */}
          <div className="zvd-ua-stats-grid">
            <StatCard
              icon={<IconStack2 size={18} />}
              label="Total Tokens"
              value={formatNumber(tokenSummary.total)}
              sub={`In: ${formatNumber(tokenSummary.input)} / Out: ${formatNumber(tokenSummary.output)}`}
            />
            <StatCard
              icon={<IconCoin size={18} />}
              label="Estimated Cost"
              value={formatCost(totalCost)}
              sub={`${modelBreakdown.length} model${modelBreakdown.length !== 1 ? 's' : ''}`}
              accent="#4ade80"
            />
            <StatCard
              icon={<IconActivity size={18} />}
              label="Sessions"
              value={String(sessionStats.total)}
              sub={`${sessionStats.active} active`}
              accent="#60a5fa"
            />
            <StatCard
              icon={<IconClock size={18} />}
              label="Avg Duration"
              value={sessionStats.avgDuration > 0 ? formatDuration(sessionStats.avgDuration) : '--'}
              sub="per completed session"
              accent="#a78bfa"
            />
          </div>

          {/* Daily usage chart */}
          <div className="zvd-ua-section-title">Token Usage (Last 7 Days)</div>
          <BarChart data={dailyUsage} />

          {/* Top tools quick view */}
          <div className="zvd-ua-section-title">Top Tools</div>
          <DetailRows
            rows={toolRanking.slice(0, 5).map((t) => ({
              id: `overview-tool-${t.name}`,
              title: t.name,
              description: `${t.total} calls`,
              meta: `${(t.successRate * 100).toFixed(0)}% success`,
              tone: (t.successRate >= 0.9 ? 'ready' : t.successRate >= 0.7 ? 'warning' : 'danger') as
                | 'ready'
                | 'warning'
                | 'danger',
            }))}
            empty="No tool calls recorded yet."
          />
        </div>
      )}

      {tab === 'tools' && (
        <div>
          <div className="zvd-ua-inline-search">
            <SearchBox value={search} onChange={$searchQuery.set} placeholder="Search tools..." />
          </div>
          <DetailRows rows={toolRows} empty="No tool calls match your search." />
        </div>
      )}

      {tab === 'models' && (
        <div>
          <div className="zvd-ua-section-title">Cost Breakdown by Model</div>
          {modelBreakdown.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
              No model usage data available.
            </div>
          ) : (
            <table className="zvd-ua-model-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Calls</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((m) => (
                  <tr key={m.model}>
                    <td className="zvd-ua-model-name">{m.model}</td>
                    <td>{m.calls}</td>
                    <td>{formatNumber(m.input)}</td>
                    <td>{formatNumber(m.output)}</td>
                    <td className="zvd-ua-model-cost">{formatCost(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Model token distribution chart */}
          <div className="zvd-ua-section-title">Token Distribution</div>
          <BarChart
            data={modelBreakdown.map((m) => ({
              label: m.model.length > 12 ? m.model.slice(0, 12) + '...' : m.model,
              value: m.input + m.output,
            }))}
          />
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          <div className="zvd-ua-inline-search">
            <SearchBox value={search} onChange={$searchQuery.set} placeholder="Search sessions..." />
          </div>

          <div className="zvd-ua-stats-grid" style={{ marginBottom: '16px' }}>
            <StatCard icon={<IconChartBar size={18} />} label="Total Sessions" value={String(sessionStats.total)} />
            <StatCard
              icon={<IconFlask size={18} />}
              label="Active Now"
              value={String(sessionStats.active)}
              accent="#4ade80"
            />
            <StatCard
              icon={<IconRobot size={18} />}
              label="Unique Models"
              value={String(new Set(props.sessions.map((s) => s.model).filter(Boolean)).size)}
              accent="#60a5fa"
            />
          </div>

          <DetailRows rows={sessionRows} empty="No sessions match your search." />
        </div>
      )}

      {tab === 'savings' && <CostSavingsPanel embedded />}

      {tab === 'export' && (
        <SessionExportPanel
          sessionId={props.activeSessionId || props.sessions.find((s) => s.status === 'active')?.id || null}
          messages={props.exportMessages}
        />
      )}
    </PageFrame>
  );
}
