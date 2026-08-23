import type { ApprovalItem, ApprovalSurfaceProjection } from '../apiClient';
import { itemId } from '../primitives/desktopPrimitives';
import { t } from '../i18n';
import { looksLikeUnifiedDiff } from '../trust/hunkApproval';
import { InThreadApprovalCard } from './InThreadApprovalCard';

/** Local fallback when API has not attached a desktop surface projection. */
export function synthesizeApprovalSurfaceProjection(id: string): ApprovalSurfaceProjection {
  return {
    shortcuts: [
      { key: '1', choice: 'once', label: t('thread.approvalOnce') },
      { key: '2', choice: 'session', label: t('thread.approvalSession') },
      { key: '3', choice: 'always', label: t('thread.approvalAlways') },
      { key: '4', choice: 'deny', label: t('thread.approvalDeny') },
    ],
    copyTargets: [{ id: 'approvalId', label: t('thread.copyApprovalId'), value: id }],
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
          : [{ id: 'approvalId', label: t('thread.copyApprovalId'), value: id }],
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
  onDecisionWithAnswer?(id: string, answer: string): void | Promise<void>;
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
    const embeddedDiff = [firstApproval.action, firstApproval.summary]
      .find((value) => typeof value === 'string' && looksLikeUnifiedDiff(value)) || null;

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
          diffText={embeddedDiff}
          surfaceProjection={surfaceProjection}
          onDecide={(approvalId, choice) => void props.onDecision(approvalId, choice)}
          onDecideOther={props.onDecisionWithAnswer ? (approvalId, answer) => void props.onDecisionWithAnswer?.(approvalId, answer) : undefined}
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
