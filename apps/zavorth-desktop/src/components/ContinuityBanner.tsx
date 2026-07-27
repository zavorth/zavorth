import { Button } from '../primitives';
import { t } from '../i18n';

export type ContinuityBannerModel = {
  kind: 'review-approval' | 'continue-session' | 'start-chat' | 'setup-provider' | 'resume-task';
  title: string;
  detail: string;
  cta: string;
  day1ReturnEligible?: boolean;
  sessionId?: string | null;
};

export type ContinuityBannerProps = {
  model: ContinuityBannerModel | null;
  language?: string | null;
  onReview(): void;
  onContinueSession?(sessionId: string): void;
  onStartChat(): void;
  onSetupProvider(): void;
};

export function ContinuityBanner(props: ContinuityBannerProps) {
  const model = props.model;
  if (!model) return null;
  if (model.kind === 'review-approval') return null;

  const onClick = () => {
    if ((model.kind === 'continue-session' || model.kind === 'resume-task') && model.sessionId && props.onContinueSession) {
      props.onContinueSession(model.sessionId);
      return;
    }
    if (model.kind === 'setup-provider') {
      props.onSetupProvider();
      return;
    }
    props.onStartChat();
  };

  return (
    <section
      className={`zvd-next-action zvd-next-action--${model.kind === 'setup-provider' ? 'warn' : 'info'}`}
      role="status"
      aria-live="polite"
      data-continuity-kind={model.kind}
      data-day1-return={model.day1ReturnEligible ? 'yes' : 'no'}
    >
      <div className="zvd-next-action__copy">
        <span className="zvd-next-action__eyebrow">
          {model.day1ReturnEligible
            ? (t('continuity.welcomeBack', props.language) || 'Welcome back')
            : (t('continuity.continue', props.language) || 'Continue')}
        </span>
        <strong className="zvd-next-action__title" title={model.title}>{model.title}</strong>
        {model.detail - (
          <span className="zvd-next-action__detail" style={{ opacity: 0.8, fontSize: '0.85em' }}>
            {model.detail}
          </span>
        ) : null}
      </div>
      <Button variant="default" size="sm" onClick={onClick}>
        {model.cta}
      </Button>
    </section>
  );
}

export function buildContinuityBannerModel(input: {
  pendingApprovals: number;
  providerReady: boolean;
  lastSessionId?: string | null;
  lastSessionTitle?: string | null;
  pendingTasks?: string[];
  day1ReturnEligible?: boolean;
  language?: string | null;
}): ContinuityBannerModel | null {
  const lang = input.language;
  if (input.pendingApprovals > 0) return null;
  if (!input.providerReady) {
    return {
      kind: 'setup-provider',
      title: t('continuity.setupProvider', lang) || 'Prove one provider to chat',
      detail: t('continuity.setupProviderDetail', lang) || 'Catalog is not Live until a probe passes.',
      cta: t('continuity.setupCta', lang) || 'Open setup',
      day1ReturnEligible: Boolean(input.day1ReturnEligible),
    };
  }
  const primaryTask = Array.isArray(input.pendingTasks)
    ? input.pendingTasks.map((entry) => String(entry || '').trim()).find(Boolean)
    : '';
  if (primaryTask) {
    return {
      kind: 'resume-task',
      title: primaryTask,
      detail: t('continuity.resumeTaskDetail', lang) || 'Primary next action from last session.',
      cta: t('continuity.resumeTaskCta', lang) || t('continuity.continueCta', lang) || 'Continue',
      sessionId: input.lastSessionId || null,
      day1ReturnEligible: Boolean(input.day1ReturnEligible),
    };
  }
  if (input.lastSessionId) {
    return {
      kind: 'continue-session',
      title: t('continuity.continueTitle', lang) || 'Continue where you left off',
      detail: input.lastSessionTitle || input.lastSessionId,
      cta: t('continuity.continueCta', lang) || 'Continue',
      sessionId: input.lastSessionId,
      day1ReturnEligible: Boolean(input.day1ReturnEligible),
    };
  }
  return {
    kind: 'start-chat',
    title: t('continuity.startTitle', lang) || 'Ready for a useful first ask',
    detail: t('continuity.startDetail', lang) || 'Try a safe starter that does not change files.',
    cta: t('continuity.startCta', lang) || 'Start',
    day1ReturnEligible: Boolean(input.day1ReturnEligible),
  };
}
