import type { ApprovalItem } from '../apiClient';
import { itemId } from '../primitives/desktopPrimitives';
import { t } from '../i18n';
import { InThreadApprovalCard } from './InThreadApprovalCard';

export function InlineActivityStrip(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(id: string, decision: 'approve' | 'reject'): void | Promise<void>;
  onOpenReview(): void;
}) {
  const firstApproval = props.approvals[0];

  if (!props.busy && !firstApproval) {
    return null;
  }

  if (firstApproval) {
    const id = itemId(firstApproval, 'approval-0');
    const title =
      firstApproval.title || firstApproval.action || t('thread.approvalTitle');

    return (
      <div className="zvd-activity-footer">
        {props.busy ? (
          <div className="zvd-activity-strip zvd-activity-strip--running" role="status" aria-live="polite">
            <span className="zvd-running-dot" aria-hidden="true" />
            <div className="zvd-activity-strip__copy">
              <strong>{t('thread.working')}</strong>
              <span>{t('thread.workingBody')}</span>
            </div>
          </div>
        ) : null}
        <InThreadApprovalCard
          id={id}
          title={title}
          summary={firstApproval.summary}
          risk={firstApproval.risk}
          busy={props.busy}
          onApprove={approvalId => void props.onDecision(approvalId, 'approve')}
          onReject={approvalId => void props.onDecision(approvalId, 'reject')}
          onOpenReview={props.onOpenReview}
        />
      </div>
    );
  }

  return (
    <div
      className="zvd-activity-strip zvd-activity-strip--running"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="zvd-running-dot" aria-hidden="true" />
      <div className="zvd-activity-strip__copy">
        <strong>{t('thread.working')}</strong>
        <span>{t('thread.workingBody')}</span>
      </div>
    </div>
  );
}
