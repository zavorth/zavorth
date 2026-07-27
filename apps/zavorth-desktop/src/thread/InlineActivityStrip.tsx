import type { ApprovalItem, ApprovalSurfaceProjection } from '../apiClient';
import { itemId } from '../primitives/desktopPrimitives';
import { t } from '../i18n';
import { InThreadApprovalCard } from './InThreadApprovalCard';

/** Local fallback when API has not attached a desktop surface projection. */
export function synthesizeApprovalSurfaceProjection(id: string): ApprovalSurfaceProjection {
  return {
    shortcuts: [
      { key: '1', choice: 'once', label: 'Run once' },
      { key: '2', choice: 'session', label: 'Session' },
      { key: '3', choice: 'always', label: 'Always' },
      { key: '4', choice: 'deny', label: 'Deny' },
    ],
    copyTargets: [{ id: 'approvalId', label: 'Copy approval id', value: id }],
    keyboardShortcuts: true,
  };
}

function resolveSurfaceProjection(
  item: ApprovalItem,
  id: string,
): ApprovalSurfaceProjection {
  const existing = item.surfaceProjection;
  if (existing && Array.isArray(existing.shortcuts) && existing.shortcuts.length > 0) {
    return {
      ...existing,
      copyTargets:
        existing.copyTargets && existing.copyTargets.length > 0
          ? existing.copyTargets
          : [{ id: 'approvalId', label: 'Copy approval id', value: id }],
      keyboardShortcuts: existing.keyboardShortcuts !== false,
    };
  }
  return synthesizeApprovalSurfaceProjection(id);
}

export function InlineActivityStrip(props: {
  approvals: ApprovalItem[];
  busy: boolean;
  onDecision(
    id: string,
    decision: 'once' | 'session' | 'always' | 'deny' | 'approve' | 'reject',
  ): void | Promise<void>;
  onOpenReview(): void;
  onOpenReceipt?(approvalId: string): void;
}) {
  const firstApproval = props.approvals[0];

  if (!props.busy && !firstApproval) {
    return null;
  }

  if (firstApproval) {
    const id = itemId(firstApproval, 'approval-0');
    const title =
      firstApproval.title || firstApproval.action || t('thread.approvalTitle');
    const surfaceProjection = resolveSurfaceProjection(firstApproval, id);

    return (
      <div className="zvd-activity-footer">
        {props.busy - (
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
          surfaceProjection={surfaceProjection}
          onDecide={(approvalId, choice) => void props.onDecision(approvalId, choice)}
          onOpenReview={props.onOpenReview}
          onOpenReceipt={props.onOpenReceipt}
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
