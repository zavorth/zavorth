import type { ApprovalItem } from '../apiClient';
import { itemId } from '../primitives/desktopPrimitives';

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

  return (
    <div className="zvd-activity-strip">
      <div>
        <strong>{props.busy ? 'Working' : firstApproval?.title || firstApproval?.action || 'Review needed'}</strong>
        <span>
          {props.busy
            ? 'Zavorth is processing this turn.'
            : firstApproval?.summary || firstApproval?.risk || 'A decision is waiting.'}
        </span>
      </div>
      {firstApproval ? (
        <div className="zvd-activity-actions">
          <button onClick={() => void props.onDecision(itemId(firstApproval, 'approval-0'), 'approve')}>Approve</button>
          <button onClick={() => void props.onDecision(itemId(firstApproval, 'approval-0'), 'reject')}>Reject</button>
          <button onClick={props.onOpenReview}>Details</button>
        </div>
      ) : <span className="zvd-running-dot" />}
    </div>
  );
}
