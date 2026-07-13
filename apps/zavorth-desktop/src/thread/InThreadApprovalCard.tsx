import { useEffect, useMemo, useCallback } from 'react';
import { Badge, Button } from '../primitives/ui';
import { t } from '../i18n';
import type { ApprovalSurfaceProjection } from '../apiClient';

export type ApprovalRisk = 'low' | 'medium' | 'high' | string;

/** Hermes/MiMo style choices. */
export type ApprovalChoice = 'once' | 'session' | 'always' | 'deny';

const CHOICE_ORDER: ApprovalChoice[] = ['once', 'session', 'always', 'deny'];

const DEFAULT_LABELS: Record<ApprovalChoice, string> = {
  once: 'Run once',
  session: 'Session',
  always: 'Always',
  deny: 'Deny',
};

const DEFAULT_KEYS: Record<ApprovalChoice, string> = {
  once: '1',
  session: '2',
  always: '3',
  deny: '4',
};

export type InThreadApprovalCardProps = {
  id: string;
  title: string;
  summary?: string;
  risk?: ApprovalRisk;
  busy?: boolean;
  /** Rich surface projection (shortcuts, copy targets, open receipt). */
  surfaceProjection?: ApprovalSurfaceProjection | null;
  onDecide(id: string, choice: ApprovalChoice): void | Promise<void>;
  onOpenReview(): void;
  /** Called when openReceipt has no href but has approvalId. */
  onOpenReceipt?(approvalId: string): void;
};

function riskTone(risk?: string): 'ready' | 'warning' | 'danger' | 'muted' {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'critical' || value === 'danger') return 'danger';
  if (value === 'medium') return 'warning';
  if (value === 'low') return 'ready';
  return 'muted';
}

function riskLabel(risk?: string): string {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low' || value === 'critical' || value === 'danger') {
    return value;
  }
  return risk ? String(risk) : '—';
}

function isApprovalChoice(value: string | null | undefined): value is ApprovalChoice {
  return value === 'once' || value === 'session' || value === 'always' || value === 'deny';
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function resolveChoiceFromShortcut(
  shortcut: { choice?: string | null; optionId?: string; label?: string },
): ApprovalChoice | null {
  if (isApprovalChoice(shortcut.choice)) return shortcut.choice;
  const blob = `${shortcut.optionId || ''} ${shortcut.label || ''}`.toLowerCase();
  for (const choice of CHOICE_ORDER) {
    if (blob.includes(choice) || blob.includes(`perm-${choice}`)) return choice;
  }
  if (blob.includes('reject') || blob.includes('deny')) return 'deny';
  if (blob.includes('approve') || blob.includes('run once')) return 'once';
  if (blob.includes('session')) return 'session';
  if (blob.includes('always')) return 'always';
  return null;
}

export function InThreadApprovalCard(props: InThreadApprovalCardProps) {
  const busy = Boolean(props.busy);
  const title = props.title || t('thread.approvalTitle');
  const projection = props.surfaceProjection ?? null;

  const choiceButtons = useMemo(() => {
    const shortcuts = projection?.shortcuts || [];
    return CHOICE_ORDER.map((choice) => {
      const fromShortcut = shortcuts.find((s) => resolveChoiceFromShortcut(s) === choice);
      const key = fromShortcut?.key || DEFAULT_KEYS[choice];
      const label = fromShortcut?.label || DEFAULT_LABELS[choice];
      return { choice, key, label };
    });
  }, [projection?.shortcuts]);

  const shortcutsEnabled =
    Boolean(projection?.shortcuts?.length) &&
    projection?.keyboardShortcuts !== false &&
    !busy;

  const copyTarget = useMemo(() => {
    const targets = projection?.copyTargets || [];
    const byId = targets.find((t) => t.id === 'approvalId');
    if (byId) return byId;
    return {
      id: 'approvalId',
      label: 'Copy approval id',
      value: props.id,
    };
  }, [projection?.copyTargets, props.id]);

  const openReceipt = projection?.openReceipt ?? null;

  const handleDecide = useCallback(
    (choice: ApprovalChoice) => {
      if (busy) return;
      void props.onDecide(props.id, choice);
    },
    [busy, props.id, props.onDecide],
  );

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const match = (projection?.shortcuts || []).find((s) => s.key === event.key);
      if (!match) return;
      const choice = resolveChoiceFromShortcut(match);
      if (!choice) return;

      event.preventDefault();
      handleDecide(choice);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, projection?.shortcuts, handleDecide]);

  const handleCopyId = useCallback(() => {
    const value = String(copyTarget.value || props.id || '').trim();
    if (!value) return;
    void navigator.clipboard?.writeText?.(value).catch(() => {
      // Clipboard may be unavailable in restricted contexts; ignore silently.
    });
  }, [copyTarget.value, props.id]);

  const handleOpenReceipt = useCallback(() => {
    if (!openReceipt) return;
    const href = String(openReceipt.href || '').trim();
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    const approvalId = String(openReceipt.approvalId || props.id || '').trim();
    if (approvalId && props.onOpenReceipt) {
      props.onOpenReceipt(approvalId);
    }
  }, [openReceipt, props.id, props.onOpenReceipt]);

  const buttonVariant = (choice: ApprovalChoice): 'default' | 'secondary' | 'ghost' | 'destructive' => {
    if (choice === 'once') return 'default';
    if (choice === 'session') return 'secondary';
    if (choice === 'always') return 'ghost';
    return 'destructive';
  };

  return (
    <div
      className="zvd-approval-card zvd-approval-card--in-thread"
      role="region"
      aria-label={t('thread.approvalTitle')}
    >
      <div className="zvd-approval-card__head">
        <div className="zvd-approval-card__titles">
          <span className="zvd-approval-card__eyebrow">{t('thread.approvalTitle')}</span>
          <strong className="zvd-approval-card__title">{title}</strong>
          {props.summary ? (
            <p className="zvd-approval-card__summary">{props.summary}</p>
          ) : null}
        </div>
        {props.risk ? (
          <Badge tone={riskTone(props.risk)} className="zvd-approval-card__risk">
            {riskLabel(props.risk)}
          </Badge>
        ) : null}
      </div>

      <div className="zvd-approval-card__actions" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
        {choiceButtons.map(({ choice, key, label }) => (
          <Button
            key={choice}
            variant={buttonVariant(choice)}
            size="sm"
            disabled={busy}
            onClick={() => handleDecide(choice)}
            title={
              choice === 'once'
                ? 'Allow once'
                : choice === 'session'
                  ? 'Allow for this session'
                  : choice === 'always'
                    ? 'Always allow this tool/pattern'
                    : 'Deny this action'
            }
          >
            {label}
            {shortcutsEnabled && key ? (
              <span className="zvd-approval-card__key-hint" aria-hidden="true">
                {' '}
                ({key})
              </span>
            ) : null}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={handleCopyId} title={copyTarget.label}>
          {copyTarget.label || 'Copy approval id'}
        </Button>
        {openReceipt ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenReceipt}
            title={openReceipt.label || 'Open receipt'}
          >
            {openReceipt.label || 'Open receipt'}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={props.onOpenReview}>
          {t('thread.details')}
        </Button>
      </div>
    </div>
  );
}
