import { useMemo, useState } from 'react';
import type { ApprovalItem, LearningItem } from '../../apiClient';
import { itemId } from '../../primitives/desktopPrimitives';
import { Badge, Button, EmptyState, type BadgeTone } from '../../primitives';
import { t } from '../../i18n';
import { PageFrame, SearchBox, TextTabs } from '../panelChrome';
import { sanitizeApproval, type SafeApprovalRecord } from './ApprovalsPanel';

type ReviewTab = 'approvals' | 'learning';

function riskTone(risk: SafeApprovalRecord['risk'] | string | undefined): BadgeTone {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'critical') return 'danger';
  if (value === 'medium') return 'warning';
  if (value === 'low') return 'ready';
  return 'muted';
}

function riskLabel(risk: SafeApprovalRecord['risk'] | string | undefined): string {
  const value = String(risk || 'unknown').toLowerCase();
  if (value === 'high') return 'High risk';
  if (value === 'medium') return 'Medium risk';
  if (value === 'low') return 'Low risk';
  if (value === 'critical') return 'Critical risk';
  return 'Risk unknown';
}

export function ReviewView(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  learning?: LearningItem[];
  onLearningDecision?(id: string, decision: 'approve' | 'reject' | 'forget'): void | Promise<void>;
}) {
  const [tab, setTab] = useState<ReviewTab>('approvals');
  const [query, setQuery] = useState('');
  const learning = props.learning ?? [];
  const canDecideLearning = typeof props.onLearningDecision === 'function';

  const sanitizedApprovals = useMemo(
    () =>
      props.approvals
        .map((item, index) => sanitizeApproval(item, index))
        .filter((record): record is SafeApprovalRecord => record !== null),
    [props.approvals],
  );

  const filteredApprovals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sanitizedApprovals.filter(record => {
      if (!q) return true;
      return `${record.title} ${record.action} ${record.risk} ${record.status}`.toLowerCase().includes(q);
    });
  }, [query, sanitizedApprovals]);

  const filteredLearning = useMemo(() => {
    const q = query.trim().toLowerCase();
    return learning.filter(item => {
      if (!q) return true;
      const hay = `${item.title || ''} ${item.summary || ''} ${item.kind || ''} ${item.lane || ''} ${item.risk || ''} ${item.status || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [learning, query]);

  const pendingCount = sanitizedApprovals.length;
  const learningCount = learning.length;
  const metaParts = [
    `${pendingCount} ${pendingCount === 1 ? 'approval' : 'approvals'}`,
    canDecideLearning || learningCount > 0 ? `${learningCount} learning` : null,
  ].filter(Boolean);

  return (
    <PageFrame
      eyebrow="Trust"
      title={t('nav.review')}
      description={t('review.hubDescription')}
      meta={metaParts.join(' · ')}
      actions={
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={tab === 'approvals' ? t('review.searchApprovals') : t('review.searchLearning')}
        />
      }
    >
      <div className="zvd-review-tabs">
        <TextTabs<ReviewTab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'approvals', label: t('review.approvalsTab'), count: pendingCount },
            { value: 'learning', label: t('review.learningTab'), count: learningCount },
          ]}
        />
      </div>

      {tab === 'approvals' && (
        filteredApprovals.length === 0 ? (
          <EmptyState
            title={t('review.emptyApprovals')}
            description={t('review.emptyApprovalsBody')}
          />
        ) : (
          <div className="zvd-approval-list" role="list">
            {filteredApprovals.map(record => (
              <article key={record.id} className="zvd-approval-card" role="listitem">
                <div className="zvd-approval-card__main">
                  <div className="zvd-approval-card__title-row">
                    <strong>{record.title}</strong>
                    <Badge tone={riskTone(record.risk)}>{riskLabel(record.risk)}</Badge>
                  </div>
                  {record.action && record.action !== record.title ? (
                    <p className="zvd-approval-card__action">{record.action}</p>
                  ) : null}
                  <div className="zvd-approval-card__meta">
                    <span>{record.status}</span>
                    {record.createdAt ? <span>{record.createdAt.slice(0, 10)}</span> : null}
                  </div>
                </div>
                <div className="zvd-approval-card__actions zvd-row-actions">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={props.busy}
                    onClick={() => void props.onDecision(record.id, 'approve')}
                  >
                    {t('review.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={props.busy}
                    onClick={() => void props.onDecision(record.id, 'reject')}
                  >
                    {t('review.reject')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {tab === 'learning' && (
        filteredLearning.length === 0 ? (
          <EmptyState
            title={t('review.emptyLearning')}
            description={t('review.emptyLearningBody')}
          />
        ) : (
          <div className="zvd-approval-list zvd-learning-list" role="list">
            {filteredLearning.map((item, index) => {
              const id = itemId(item, `learning-${index}`);
              const lane = String(item.lane || '').toLowerCase();
              const isYellow = lane !== 'green';
              return (
                <article
                  key={id}
                  className={`zvd-approval-card zvd-learning-card${isYellow ? ' is-candidate' : ''}`}
                  role="listitem"
                >
                  <div className="zvd-approval-card__main">
                    <div className="zvd-approval-card__title-row">
                      <strong>{item.title || item.kind || t('review.learningFallback')}</strong>
                      <Badge tone={isYellow ? 'warning' : 'ready'}>
                        {item.risk || item.status || (isYellow ? t('review.candidate') : t('review.trustedLane'))}
                      </Badge>
                    </div>
                    {item.summary ? <p className="zvd-approval-card__action">{item.summary}</p> : null}
                    <div className="zvd-approval-card__meta">
                      {item.kind ? <span>{item.kind}</span> : null}
                      {item.lane ? <span>{item.lane}</span> : null}
                      {typeof item.confidence === 'number' ? (
                        <span>{Math.round(item.confidence * 100)}%</span>
                      ) : null}
                    </div>
                  </div>
                  {canDecideLearning ? (
                    <div className="zvd-approval-card__actions zvd-row-actions">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={props.busy}
                        onClick={() => void props.onLearningDecision?.(id, 'approve')}
                      >
                        {t('review.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={props.busy}
                        onClick={() => void props.onLearningDecision?.(id, 'reject')}
                      >
                        {t('review.reject')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={props.busy}
                        onClick={() => void props.onLearningDecision?.(id, 'forget')}
                      >
                        {t('review.forget')}
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )
      )}
    </PageFrame>
  );
}
