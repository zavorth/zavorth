import { Badge, Button } from '../primitives/ui';
import { t } from '../i18n';
import type { PlanCardModel, PlanStep } from './planCard';

export type PlanCardViewProps = {
  plan: PlanCardModel;
  busy?: boolean;
  onApprove?(): void;
  onReject?(): void;
  onEdit?(): void;
};

function riskTone(risk: PlanCardModel['risk']): 'ready' | 'warning' | 'danger' | 'muted' {
  if (risk === 'high' || risk === 'critical') return 'danger';
  if (risk === 'medium') return 'warning';
  if (risk === 'low') return 'ready';
  return 'muted';
}

function stepStatusLabel(status: PlanStep['status']): string {
  switch (status) {
    case 'active':
      return t('thread.planStepActive');
    case 'done':
      return t('thread.planStepDone');
    case 'skipped':
      return t('thread.planStepSkipped');
    default:
      return t('thread.planStepPending');
  }
}

export function PlanCardView(props: PlanCardViewProps) {
  const { plan } = props;
  const busy = Boolean(props.busy);
  const showApprove = plan.canApprove && typeof props.onApprove === 'function';
  const showReject = plan.canReject && typeof props.onReject === 'function';
  const showEdit = typeof props.onEdit === 'function';

  return (
    <div
      className="zvd-plan-card"
      role="region"
      aria-label={plan.title || t('thread.planTitle')}
      data-plan-id={plan.id}
      data-risk={plan.risk || undefined}
    >
      <div className="zvd-plan-card__head">
        <div className="zvd-plan-card__titles">
          <span className="zvd-plan-card__eyebrow">{t('thread.planTitle')}</span>
          <strong className="zvd-plan-card__title">{plan.title || t('thread.planTitle')}</strong>
          {plan.summary - (
            <p className="zvd-plan-card__summary">{plan.summary}</p>
          ) : null}
        </div>
        {plan.risk - (
          <Badge tone={riskTone(plan.risk)} className="zvd-plan-card__risk">
            {plan.risk}
          </Badge>
        ) : null}
      </div>

      {plan.steps.length > 0 ? (
        <ol className="zvd-plan-card__steps" aria-label={t('thread.planSteps')}>
          {plan.steps.map((step, index) => (
            <li
              key={step.id}
              className={`zvd-plan-card__step is-${step.status}`}
              data-step-id={step.id}
            >
              <span className="zvd-plan-card__step-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="zvd-plan-card__step-body">
                <div className="zvd-plan-card__step-row">
                  <strong className="zvd-plan-card__step-title">{step.title}</strong>
                  <span className="zvd-plan-card__step-status">{stepStatusLabel(step.status)}</span>
                </div>
                {step.detail - (
                  <p className="zvd-plan-card__step-detail">{step.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {(showApprove || showReject || showEdit) ? (
        <div className="zvd-plan-card__actions">
          {showApprove - (
            <Button
              variant="default"
              size="sm"
              disabled={busy}
              onClick={() => props.onApprove?.()}
            >
              {t('thread.planApprove')}
            </Button>
          ) : null}
          {showReject - (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => props.onReject?.()}
            >
              {t('thread.planReject')}
            </Button>
          ) : null}
          {showEdit - (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => props.onEdit?.()}
            >
              {t('thread.planEdit')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
