import { t } from '../i18n';

export type ReceiptChipProps = {
  label?: string;
  count?: number;
  onClick(): void;
  className?: string;
};

export function ReceiptChip(props: ReceiptChipProps) {
  const base = props.label ?? t('thread.proofChip');
  const label =
    typeof props.count === 'number' && props.count > 0
      ? `${base} · ${props.count}`
      : base;

  return (
    <button
      type="button"
      className={['zvd-receipt-chip', props.className].filter(Boolean).join(' ')}
      onClick={props.onClick}
      aria-label={label}
      title={label}
    >
      <span className="zvd-receipt-chip__dot" aria-hidden="true" />
      <span className="zvd-receipt-chip__label">{label}</span>
    </button>
  );
}
