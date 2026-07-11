import { Button } from '../primitives';
import { t } from '../i18n';

export type NextActionBannerProps = {
  approvalsCount: number;
  busy?: boolean;
  runtimeOnline?: boolean;
  onOpenReview(): void;
  onOpenChat?(): void;
  onOpenProof?(): void;
  onDoctor?(): void;
  language?: string | null;
};

type NextActionModel = {
  title: string;
  cta: string;
  onClick: () => void;
  tone: 'warn' | 'info' | 'danger';
};

function resolveNextAction(props: NextActionBannerProps): NextActionModel | null {
  const n = Math.max(0, Number(props.approvalsCount) || 0);
  const lang = props.language;

  if (n > 0) {
    return {
      title: n === 1
        ? t('nextAction.oneApproval', lang)
        : t('nextAction.nApprovals', lang).replace('{n}', String(n)),
      cta: t('nextAction.review', lang),
      onClick: props.onOpenReview,
      tone: 'warn',
    };
  }

  if (props.runtimeOnline === false) {
    // Runtime recovery is owned by the compact clickable status pill in the
    // top bar. Repeating it here used to push a large warning into the chat.
    return null;
  }

  if (props.busy) {
    if (!props.onOpenChat) {
      return null;
    }
    return {
      title: t('nextAction.taskRunning', lang),
      cta: t('nextAction.openChat', lang),
      onClick: props.onOpenChat,
      tone: 'info',
    };
  }

  return null;
}

/** Compact next-action banner. */
export function NextActionBanner(props: NextActionBannerProps) {
  const model = resolveNextAction(props);
  if (!model) {
    return null;
  }

  return (
    <section
      className={`zvd-next-action zvd-next-action--${model.tone}`}
      role="status"
      aria-live="polite"
      data-next-action-tone={model.tone}
    >
      <div className="zvd-next-action__copy">
        <span className="zvd-next-action__eyebrow">{t('nextAction.next', props.language)}</span>
        <strong className="zvd-next-action__title">{model.title}</strong>
      </div>
      <Button variant="default" size="sm" onClick={model.onClick}>
        {model.cta}
      </Button>
    </section>
  );
}
