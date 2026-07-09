import { Badge, Button } from '../primitives/ui';
import { t } from '../i18n';

export type ApprovalRisk = 'low' | 'medium' | 'high' | string;

export type InThreadApprovalCardProps = {
  id: string;
  title: string;
  summary?: string;
  risk?: ApprovalRisk;
  busy?: boolean;
  onApprove(id: string): void | Promise<void>;
  onReject(id: string): void | Promise<void>;
  onOpenReview(): void;
};

function riskTone(risk?: string): 'ready' | 'warning' | 'danger' | 'muted' {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'critical') return 'danger';
  if (value === 'medium') return 'warning';
  if (value === 'low') return 'ready';
  return 'muted';
}

function riskLabel(risk?: string): string {
  const value = String(risk || '').toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return risk ? String(risk) : '—';
}

export function InThreadApprovalCard(props: InThreadApprovalCardProps) {
  const busy = Boolean(props.busy);
  const title = props.title || t('thread.approvalTitle');

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

      <div className="zvd-approval-card__actions">
        <Button
          variant="default"
          size="sm"
          disabled={busy}
          onClick={() => void props.onApprove(props.id)}
        >
          {t('thread.approve')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => void props.onReject(props.id)}
        >
          {t('thread.reject')}
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onOpenReview}>
          {t('thread.details')}
        </Button>
      </div>
    </div>
  );
}
