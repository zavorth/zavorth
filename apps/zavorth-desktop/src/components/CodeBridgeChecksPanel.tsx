import { useEffect } from 'react';
import type { CodeBridgeCheck, CodeBridgeSummary } from '../global';

function yn(value: unknown): string {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '—';
}

function truncatePath(value: string, max = 52): string {
  const s = String(value || '').trim();
  if (s.length <= max) return s;
  const head = Math.max(12, Math.floor(max * 0.45));
  const tail = Math.max(12, max - head - 1);
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function sessionsOf(summary: CodeBridgeSummary): string {
  const fromOps = summary.ops?.sessions;
  if (typeof fromOps === 'number' && Number.isFinite(fromOps)) return String(fromOps);
  const fromPulse = summary.companion?.pulse?.sessions;
  if (typeof fromPulse === 'number' && Number.isFinite(fromPulse)) return String(fromPulse);
  return '—';
}

function checksOf(summary: CodeBridgeSummary): CodeBridgeCheck[] {
  const raw = summary.ops?.checks;
  return Array.isArray(raw) ? raw : [];
}

export function CodeBridgeChecksPanel(props: {
  open: boolean;
  summary: CodeBridgeSummary;
  onClose(): void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const { summary } = props;
  const ops = summary.ops;
  const checks = checksOf(summary);

  return (
    <div
      className="zvd-code-bridge-panel"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        className="zvd-code-bridge-panel__frame"
        role="dialog"
        aria-modal="true"
        aria-label="Zavorth Code bridge checks"
      >
        <header className="zvd-code-bridge-panel__header">
          <div>
            <div className="zvd-code-bridge-panel__eyebrow">Code bridge</div>
            <h2 className="zvd-code-bridge-panel__title">Checks</h2>
          </div>
          <button
            type="button"
            className="zvd-code-bridge-panel__close"
            onClick={props.onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="zvd-code-bridge-panel__body">
          <div className="zvd-code-bridge-panel__lead">
            <div className="zvd-code-bridge-panel__label">{summary.label}</div>
            <div className="zvd-code-bridge-panel__detail">{summary.detail}</div>
            <div className="zvd-code-bridge-panel__tone">tone · {summary.tone || 'muted'}</div>
          </div>

          <dl className="zvd-code-bridge-panel__meta">
            <div>
              <dt>ops.ready</dt>
              <dd>{yn(ops?.ready)}</dd>
            </div>
            <div>
              <dt>providerReady</dt>
              <dd>{yn(ops?.providerReady)}</dd>
            </div>
            <div>
              <dt>approvals</dt>
              <dd>{Number(ops?.approvals || 0)}</dd>
            </div>
            <div>
              <dt>sessions</dt>
              <dd>{sessionsOf(summary)}</dd>
            </div>
            <div className="zvd-code-bridge-panel__meta-wide">
              <dt>model</dt>
              <dd>{ops?.modelLabel || '—'}</dd>
            </div>
          </dl>

          <div className="zvd-code-bridge-panel__section">Checks</div>
          {checks.length === 0 ? (
            <div className="zvd-code-bridge-panel__empty">No checks in latest ops-bridge</div>
          ) : (
            <ul className="zvd-code-bridge-panel__checks" role="list">
              {checks.map((check, index) => {
                const ok = check.ok === true;
                return (
                  <li
                    key={check.id || `${check.label || 'check'}-${index}`}
                    className={`zvd-code-bridge-panel__check ${ok ? 'is-ok' : 'is-fail'}`}
                  >
                    <span className="zvd-code-bridge-panel__check-mark" aria-hidden="true">
                      {ok ? '●' : '△'}
                    </span>
                    <span className="zvd-code-bridge-panel__check-body">
                      <span className="zvd-code-bridge-panel__check-label">
                        {check.label || check.id || 'check'}
                      </span>
                      {check.detail ? (
                        <span className="zvd-code-bridge-panel__check-detail">{check.detail}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="zvd-code-bridge-panel__section">Next</div>
          <div className="zvd-code-bridge-panel__next">
            <div className="zvd-code-bridge-panel__next-row">
              <span>headline</span>
              <strong>{ops?.headline || '—'}</strong>
            </div>
            <div className="zvd-code-bridge-panel__next-row">
              <span>nextAction</span>
              <strong>{ops?.nextAction || '—'}</strong>
            </div>
          </div>

          {summary.stateDir ? (
            <div className="zvd-code-bridge-panel__path" title={summary.stateDir}>
              {truncatePath(summary.stateDir)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
