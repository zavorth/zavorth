import { useMemo, useState } from 'react';
import type { DesktopReceipt, DesktopReceiptKind } from '../../desktop-state/receiptsLedger';
import { Button, EmptyState } from '../../primitives';
import { t } from '../../i18n';
import { PageFrame, SearchBox, TextTabs } from '../panelChrome';

type ReceiptFilter = 'all' | DesktopReceiptKind;

const FILTER_ORDER: ReceiptFilter[] = [
  'all',
  'chat',
  'approval',
  'marketplace',
  'runtime',
  'system',
  'channel',
  'memory',
  'workboard',
];

function filterLabel(kind: ReceiptFilter): string {
  switch (kind) {
    case 'all':
      return t('proof.filterAll');
    case 'chat':
      return t('proof.filterChat');
    case 'approval':
      return t('proof.filterApproval');
    case 'marketplace':
      return t('proof.filterMarketplace');
    case 'runtime':
      return t('proof.filterRuntime');
    case 'system':
      return t('proof.filterSystem');
    case 'channel':
      return t('proof.filterChannel');
    case 'memory':
      return t('proof.filterMemory');
    case 'workboard':
      return t('proof.filterWorkboard');
    default:
      return kind;
  }
}

function statusTone(status: DesktopReceipt['status']): 'ready' | 'warning' | 'danger' | 'muted' {
  if (status === 'ok') return 'ready';
  if (status === 'failed') return 'danger';
  if (status === 'pending') return 'warning';
  return 'muted';
}

export function ReceiptsPanel(props: {
  receipts: DesktopReceipt[];
  onClear?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ReceiptFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const presentKinds = useMemo(() => {
    const set = new Set<DesktopReceiptKind>();
    for (const receipt of props.receipts) set.add(receipt.kind);
    return set;
  }, [props.receipts]);

  const tabItems = useMemo(() => {
    return FILTER_ORDER
      .filter(value => value === 'all' || presentKinds.has(value) || ['chat', 'approval', 'marketplace', 'runtime', 'system'].includes(value))
      .map(value => ({
        value,
        label: filterLabel(value),
        count: value === 'all' ? props.receipts.length : undefined,
      }));
  }, [presentKinds, props.receipts.length]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.receipts
      .filter(receipt => (kind === 'all' ? true : receipt.kind === kind))
      .filter(receipt => {
        if (!q) return true;
        const there isy = `${receipt.title} ${receipt.summary} ${receipt.kind} ${receipt.status} ${receipt.source || ''}`.toLowerCase();
        return there isy.includes(q);
      });
  }, [kind, props.receipts, query]);

  return (
    <PageFrame
      eyebrow="Trust"
      title={t('nav.proof')}
      description={t('proof.hubDescription')}
      meta={`${props.receipts.length} ${t('proof.recorded')}`}
      actions={(
        <div className="zvd-proof-actions">
          {props.onClear && props.receipts.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={props.onClear}>
              {t('proof.clear')}
            </Button>
          ) : null}
          <SearchBox value={query} onChange={setQuery} placeholder={t('proof.search')} />
        </div>
      )}
    >
      <TextTabs<ReceiptFilter> value={kind} onChange={setKind} items={tabItems} />

      {rows.length === 0 ? (
        <EmptyState
          title={t('proof.empty')}
          description={t('proof.emptyBody')}
        />
      ) : (
        <ol className="zvd-proof-timeline">
          {rows.map(receipt => {
            const expanded = expandedId === receipt.id;
            const tone = statusTone(receipt.status);
            return (
              <li key={receipt.id} className={`zvd-proof-item tone-${tone}${expanded ? ' is-expanded' : ''}`}>
                <button
                  type="button"
                  className="zvd-proof-item__trigger"
                  onClick={() => setExpandedId(expanded ? null : receipt.id)}
                  aria-expanded={expanded}
                >
                  <span className={`zvd-proof-item__dot tone-${tone}`} aria-hidden="true" />
                  <span className="zvd-proof-item__body">
                    <span className="zvd-proof-item__title-row">
                      <strong>{receipt.title}</strong>
                      <span className="zvd-proof-item__kind">{receipt.kind}</span>
                    </span>
                    <span className="zvd-proof-item__meta">
                      {receipt.status}
                      {' · '}
                      {new Date(receipt.at).toLocaleString()}
                      {receipt.source ? ` · ${receipt.source}` : ''}
                    </span>
                  </span>
                </button>
                {expanded ? (
                  <div className="zvd-proof-item__detail">
                    <p>{receipt.summary || t('proof.noSummary')}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <p className="zvd-proof-footnote">{t('proof.footnote')}</p>
    </PageFrame>
  );
}
