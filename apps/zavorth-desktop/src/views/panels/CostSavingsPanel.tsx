import { useCallback, useEffect, useState } from 'react';
import { IconCoin, IconPigMoney, IconRefresh, IconRoute, IconStack2 } from '@tabler/icons-react';
import { loadCostSavingsDashboard } from '../../apiClient';
import { t } from '../../i18n';
import {
  emptyCostSavingsSnapshot,
  formatTokenCount,
  formatUsd,
  normalizeCostSavingsSnapshot,
  savingsRatio,
  type CostSavingsSnapshot,
} from './costSavingsFormat';

export type CostSavingsPanelProps = {
  /** Embed mode hides the outer page chrome when nested under Analytics tabs. */
  embedded?: boolean;
  /** Optional preloaded snapshot (tests / offline inject). */
  snapshot?: CostSavingsSnapshot | null;
};

export function CostSavingsPanel(props: CostSavingsPanelProps) {
  const [snapshot, setSnapshot] = useState<CostSavingsSnapshot | null>(props.snapshot ?? null);
  const [loading, setLoading] = useState(!props.snapshot);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await loadCostSavingsDashboard();
      const normalized = normalizeCostSavingsSnapshot(raw);
      setSnapshot(normalized || emptyCostSavingsSnapshot());
      if (!raw) {
        setError(t('costSavings.unavailable'));
      }
    } catch {
      setSnapshot(emptyCostSavingsSnapshot());
      setError(t('costSavings.unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (props.snapshot) {
      setSnapshot(props.snapshot);
      setLoading(false);
      return;
    }
    void refresh();
  }, [props.snapshot, refresh]);

  const data = snapshot || emptyCostSavingsSnapshot();
  const ratio = savingsRatio(data.totals);
  const body = (
    <div className="zvd-cost-savings">
      <style>{COST_SAVINGS_STYLES}</style>

      <div className="zvd-cs-toolbar">
        <p className="zvd-cs-narrative">{data.narrative || t('costSavings.emptyNarrative')}</p>
        <button type="button" className="zvd-cs-refresh" onClick={() => void refresh()} disabled={loading}>
          <IconRefresh size={14} />
          <span>{loading ? t('costSavings.loading') : t('costSavings.refresh')}</span>
        </button>
      </div>

      {error && (
        <div className="zvd-cs-error" role="status">
          {error}
        </div>
      )}

      <div className="zvd-cs-stats">
        <div className="zvd-cs-stat">
          <div className="zvd-cs-stat-icon" style={{ color: '#60a5fa' }}>
            <IconStack2 size={18} />
          </div>
          <div>
            <strong>{formatTokenCount(data.totals.calls)}</strong>
            <span>{t('costSavings.calls')}</span>
            <em>
              {formatTokenCount(data.totals.inputTokens + data.totals.outputTokens)} {t('costSavings.tokens')}
            </em>
          </div>
        </div>
        <div className="zvd-cs-stat">
          <div className="zvd-cs-stat-icon" style={{ color: 'var(--zvd-accent, #f16a21)' }}>
            <IconCoin size={18} />
          </div>
          <div>
            <strong>{formatUsd(data.totals.estimatedCostUsd)}</strong>
            <span>{t('costSavings.estCost')}</span>
            <em>
              {data.sessionsScanned} {t('costSavings.sessions')}
            </em>
          </div>
        </div>
        <div className="zvd-cs-stat">
          <div className="zvd-cs-stat-icon" style={{ color: '#4ade80' }}>
            <IconPigMoney size={18} />
          </div>
          <div>
            <strong>{formatUsd(data.totals.estimatedSavingsUsd)}</strong>
            <span>{t('costSavings.estSavings')}</span>
            <em>
              {(ratio * 100).toFixed(0)}% {t('costSavings.vsFrontier')}
            </em>
          </div>
        </div>
        <div className="zvd-cs-stat">
          <div className="zvd-cs-stat-icon" style={{ color: '#a78bfa' }}>
            <IconRoute size={18} />
          </div>
          <div>
            <strong>{formatTokenCount(data.totals.backgroundRouteCalls)}</strong>
            <span>{t('costSavings.backgroundRoutes')}</span>
            <em>{t('costSavings.backgroundRoutesHint')}</em>
          </div>
        </div>
      </div>

      <div className="zvd-cs-section-title">{t('costSavings.byModel')}</div>
      {data.byModel.length === 0 ? (
        <div className="zvd-cs-empty">{t('costSavings.noModels')}</div>
      ) : (
        <table className="zvd-cs-table">
          <thead>
            <tr>
              <th>{t('costSavings.model')}</th>
              <th>{t('costSavings.calls')}</th>
              <th>{t('costSavings.inputTokens')}</th>
              <th>{t('costSavings.outputTokens')}</th>
              <th>{t('costSavings.estCost')}</th>
            </tr>
          </thead>
          <tbody>
            {data.byModel.map((row) => (
              <tr key={row.modelKey}>
                <td className="zvd-cs-model">{row.modelKey}</td>
                <td>{row.calls}</td>
                <td>{formatTokenCount(row.inputTokens)}</td>
                <td>{formatTokenCount(row.outputTokens)}</td>
                <td className="zvd-cs-cost">{formatUsd(row.estimatedCostUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.backgroundRouteHint ? (
        <div className="zvd-cs-hint">
          <strong>{t('costSavings.routeHintTitle')}</strong>
          <p>{data.backgroundRouteHint}</p>
        </div>
      ) : null}
    </div>
  );

  if (props.embedded) {
    return body;
  }

  return (
    <section className="zvd-page zvd-hub-page" aria-label={t('costSavings.title')}>
      <header className="zvd-page-header">
        <div>
          <span className="zvd-page-eyebrow">analytics</span>
          <h1>{t('costSavings.title')}</h1>
          <p>{t('costSavings.description')}</p>
        </div>
        <div className="zvd-page-header-side">
          <span className="zvd-page-meta">
            {formatUsd(data.totals.estimatedSavingsUsd)} {t('costSavings.saved')}
          </span>
        </div>
      </header>
      {body}
    </section>
  );
}

const COST_SAVINGS_STYLES = `
  .zvd-cost-savings { display: flex; flex-direction: column; gap: 16px; }
  .zvd-cs-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .zvd-cs-narrative { margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.45; flex: 1; }
  .zvd-cs-refresh {
    display: inline-flex; align-items: center; gap: 6px;
    background: #25262d; border: 1px solid rgba(255,255,255,0.08);
    color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 12.5px;
    cursor: pointer; flex-shrink: 0;
  }
  .zvd-cs-refresh:disabled { opacity: 0.6; cursor: default; }
  .zvd-cs-error {
    font-size: 12px; color: #facc15;
    background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2);
    border-radius: 8px; padding: 8px 12px;
  }
  .zvd-cs-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;
  }
  .zvd-cs-stat {
    display: flex; gap: 12px; align-items: center;
    background: #121318; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 14px 16px;
  }
  .zvd-cs-stat-icon {
    width: 36px; height: 36px; border-radius: 8px;
    background: rgba(255,255,255,0.04);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .zvd-cs-stat strong { display: block; font-size: 17px; color: #fff; line-height: 1.2; }
  .zvd-cs-stat span { display: block; font-size: 11.5px; color: #71717a; margin-top: 2px; }
  .zvd-cs-stat em { display: block; font-size: 10.5px; color: #52525b; font-style: normal; margin-top: 1px; }
  .zvd-cs-section-title {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #71717a; margin-top: 4px;
  }
  .zvd-cs-empty { padding: 20px; text-align: center; color: #71717a; font-size: 13px; }
  .zvd-cs-table { width: 100%; border-collapse: collapse; }
  .zvd-cs-table th {
    text-align: left; font-size: 11px; font-weight: 600; color: #71717a;
    text-transform: uppercase; letter-spacing: 0.04em;
    padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .zvd-cs-table td {
    font-size: 13px; color: #e4e4e7; padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .zvd-cs-model { font-weight: 600; color: #fff; }
  .zvd-cs-cost { font-weight: 600; color: var(--zvd-accent, #f16a21); font-variant-numeric: tabular-nums; }
  .zvd-cs-hint {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 12px 14px;
  }
  .zvd-cs-hint strong { display: block; font-size: 12px; color: #e4e4e7; margin-bottom: 4px; }
  .zvd-cs-hint p { margin: 0; font-size: 12.5px; color: #a1a1aa; line-height: 1.45; }
`;

export default CostSavingsPanel;
