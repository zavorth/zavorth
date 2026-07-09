import { Button } from '../primitives';

export type NextActionBannerProps = {
  approvalsCount: number;
  busy?: boolean;
  runtimeOnline?: boolean;
  onOpenReview(): void;
  onOpenChat?(): void;
  onOpenProof?(): void;
  onDoctor?(): void;
};

type NextActionModel = {
  title: string;
  cta: string;
  onClick: () => void;
  tone: 'warn' | 'info' | 'danger';
};

function resolveNextAction(props: NextActionBannerProps): NextActionModel | null {
  const n = Math.max(0, Number(props.approvalsCount) || 0);

  if (n > 0) {
    return {
      title: n === 1 ? '1 approval waiting' : `${n} approvals waiting`,
      cta: 'Review',
      onClick: props.onOpenReview,
      tone: 'warn',
    };
  }

  if (props.runtimeOnline === false) {
    if (props.onDoctor) {
      return {
        title: 'Runtime offline',
        cta: 'Doctor',
        onClick: props.onDoctor,
        tone: 'danger',
      };
    }
    return {
      title: 'Runtime offline',
      cta: 'Review',
      onClick: props.onOpenReview,
      tone: 'danger',
    };
  }

  if (props.busy) {
    if (!props.onOpenChat) {
      return null;
    }
    return {
      title: 'Task running',
      cta: 'Open chat',
      onClick: props.onOpenChat,
      tone: 'info',
    };
  }

  return null;
}

/** One aggressive next action, no instructional essay. */
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
        <span className="zvd-next-action__eyebrow">Next</span>
        <strong className="zvd-next-action__title">{model.title}</strong>
      </div>
      <Button variant="default" size="sm" onClick={model.onClick}>
        {model.cta}
      </Button>
    </section>
  );
}
