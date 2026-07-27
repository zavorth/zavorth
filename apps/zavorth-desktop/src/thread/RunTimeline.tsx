import { useMemo, useState } from 'react';
import { t } from '../i18n';
import {
  buildRunTimeline,
  compactRunTimeline,
  type RunTimelineInput,
  type TimelineItem,
} from './runTimeline';

export type RunTimelineProps = {
  messages?: RunTimelineInput['messages'];
  approvals?: RunTimelineInput['approvals'];
  receipts?: RunTimelineInput['receipts'];
  agents?: RunTimelineInput['agents'];
  busy?: boolean;
  /** When provided, skip rebuild and use these items. */
  items?: TimelineItem[];
  compactLimit?: number;
};

function statusLabel(item: TimelineItem): string {
  switch (item.status) {
    case 'running':
      return t('thread.timeline.running');
    case 'pending':
      return t('thread.timeline.pending');
    case 'approved':
      return t('thread.timeline.approved');
    case 'rejected':
      return t('thread.timeline.rejected');
    case 'failed':
      return t('thread.timeline.failed');
    case 'success':
      return t('thread.timeline.success');
    default:
      return t('thread.timeline.info');
  }
}

function kindLabel(item: TimelineItem): string {
  switch (item.kind) {
    case 'tool':
      return t('thread.timeline.tool');
    case 'approval':
      return t('thread.timeline.approval');
    case 'receipt':
      return t('thread.timeline.receipt');
    case 'agent':
      return t('thread.timeline.agent');
    default:
      return t('thread.timeline.message');
  }
}

export function RunTimeline(props: RunTimelineProps) {
  const built = useMemo(() => {
    if (props.items) return props.items;
    return buildRunTimeline({
      messages: props.messages,
      approvals: props.approvals,
      receipts: props.receipts,
      agents: props.agents,
    });
  }, [props.items, props.messages, props.approvals, props.receipts, props.agents]);

  const limit = props.compactLimit ?? 8;
  const compact = useMemo(() => compactRunTimeline(built, limit), [built, limit]);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? built : compact.visible;

  if (!built.length) return null;

  return (
    <div
      className={`zvd-run-timeline${props.busy ? ' is-busy' : ''}`}
      role="region"
      aria-label={t('thread.timeline.title')}
    >
      <div className="zvd-run-timeline__head">
        <strong className="zvd-run-timeline__title">{t('thread.timeline.title')}</strong>
        {compact.hiddenCount > 0 ? (
          <button
            type="button"
            className="zvd-run-timeline__toggle"
            onClick={() => setExpanded(value => !value)}
          >
            {expanded
              ? t('thread.timeline.collapse')
              : t('thread.timeline.expand').replace('{count}', String(compact.hiddenCount))}
          </button>
        ) : null}
      </div>
      <ol className="zvd-run-timeline__list">
        {visible.map(item => (
          <li
            key={item.id}
            className={`zvd-run-timeline__item is-${item.kind} is-${item.status || 'info'}`}
            data-timeline-id={item.id}
          >
            <span className="zvd-run-timeline__dot" aria-hidden="true" />
            <div className="zvd-run-timeline__body">
              <div className="zvd-run-timeline__row">
                <span className="zvd-run-timeline__kind">{kindLabel(item)}</span>
                <strong className="zvd-run-timeline__item-title">{item.title}</strong>
                {item.status - (
                  <span className="zvd-run-timeline__status">{statusLabel(item)}</span>
                ) : null}
              </div>
              {item.detail - (
                <p className="zvd-run-timeline__detail">{item.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
