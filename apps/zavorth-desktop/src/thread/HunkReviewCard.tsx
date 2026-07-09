import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../primitives/ui';
import { t } from '../i18n';
import {
  applyAllPending,
  applyHunkDecision,
  buildHunkReceipt,
  parseUnifiedDiff,
  pendingHunkCount,
  type DiffHunk,
  type HunkReceipt,
} from '../trust/hunkApproval';

export type HunkReviewCardProps = {
  diffText: string;
  reviewId?: string;
  busy?: boolean;
  onHunkReceipt?(receipt: HunkReceipt): void;
  onDecision?(hunkId: string, decision: 'approve' | 'reject'): void;
};

export function HunkReviewCard(props: HunkReviewCardProps) {
  const initial = useMemo(
    () => parseUnifiedDiff(props.diffText),
    [props.diffText],
  );
  const [hunks, setHunks] = useState<DiffHunk[]>(initial);
  const busy = Boolean(props.busy);
  const pending = pendingHunkCount(hunks);

  useEffect(() => {
    setHunks(initial);
  }, [initial]);

  const emitReceipts = useCallback(
    (targets: DiffHunk[], decision: 'approve' | 'reject') => {
      for (const hunk of targets) {
        const receipt = buildHunkReceipt(hunk, decision);
        props.onHunkReceipt?.(receipt);
        props.onDecision?.(hunk.id, decision);
      }
    },
    [props],
  );

  const decideOne = useCallback(
    (hunkId: string, decision: 'approve' | 'reject') => {
      const target = hunks.find(h => h.id === hunkId && h.decision === 'pending');
      if (!target) return;
      setHunks(current => applyHunkDecision(current, hunkId, decision));
      emitReceipts([{ ...target, decision }], decision);
    },
    [hunks, emitReceipts],
  );

  const approveAll = useCallback(() => {
    const pendingHunks = hunks.filter(h => h.decision === 'pending');
    if (!pendingHunks.length) return;
    setHunks(current => applyAllPending(current, 'approve'));
    emitReceipts(pendingHunks, 'approve');
  }, [hunks, emitReceipts]);

  const rejectRemaining = useCallback(() => {
    const pendingHunks = hunks.filter(h => h.decision === 'pending');
    if (!pendingHunks.length) return;
    setHunks(current => applyAllPending(current, 'reject'));
    emitReceipts(pendingHunks, 'reject');
  }, [hunks, emitReceipts]);

  if (!hunks.length) return null;

  return (
    <div
      className="zvd-hunk-review"
      role="region"
      aria-label={t('thread.hunkReviewTitle')}
      data-pending={pending}
    >
      <div className="zvd-hunk-review__head">
        <div className="zvd-hunk-review__titles">
          <span className="zvd-hunk-review__eyebrow">{t('thread.hunkReviewTitle')}</span>
          <strong className="zvd-hunk-review__title">
            {t('thread.hunkReviewCount')
              .replace('{count}', String(hunks.length))
              .replace('{pending}', String(pending))}
          </strong>
        </div>
        {pending > 0 ? (
          <div className="zvd-hunk-review__bulk">
            <Button variant="default" size="sm" disabled={busy} onClick={approveAll}>
              {t('thread.hunkApproveAll')}
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={rejectRemaining}>
              {t('thread.hunkRejectRemaining')}
            </Button>
          </div>
        ) : null}
      </div>

      <ul className="zvd-hunk-review__list">
        {hunks.map(hunk => (
          <li
            key={hunk.id}
            className={`zvd-hunk-review__item is-${hunk.decision}`}
            data-hunk-id={hunk.id}
          >
            <div className="zvd-hunk-review__item-head">
              <div className="zvd-hunk-review__meta">
                <strong className="zvd-hunk-review__path">{hunk.path}</strong>
                <span className="zvd-hunk-review__header">{hunk.header}</span>
              </div>
              <span className={`zvd-hunk-review__status is-${hunk.decision}`}>
                {hunk.decision === 'approve'
                  ? t('thread.hunkApproved')
                  : hunk.decision === 'reject'
                    ? t('thread.hunkRejected')
                    : t('thread.hunkPending')}
              </span>
            </div>
            <pre className="zvd-hunk-review__preview" tabIndex={0}>
              {hunk.lines.slice(0, 14).join('\n')}
            </pre>
            {hunk.decision === 'pending' ? (
              <div className="zvd-hunk-review__actions">
                <Button
                  variant="default"
                  size="sm"
                  disabled={busy}
                  onClick={() => decideOne(hunk.id, 'approve')}
                >
                  {t('thread.approve')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => decideOne(hunk.id, 'reject')}
                >
                  {t('thread.reject')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
