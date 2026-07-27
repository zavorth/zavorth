import { Button } from '../primitives';
import { t } from '../i18n';

export type NextActionBannerProps = {
  /** Pending approvals only — not total/historical approvals. */
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
  const n = Math.max(0, Math.floor(Number(props.approvalsCount) || 0));
  const lang = props.language;

  if (n > 0) {
    // Banner CTA opens Review only — keep copy honest (no "then open proof").
    // Proof strip below handles ledger navigation.
    const title = n === 1
      ? t('nextAction.oneApproval', lang)
      : t('nextAction.nApprovals', lang).replace(/\{n\}/g, String(n));
    return {
      title,
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
        <strong className="zvd-next-action__title" title={model.title}>{model.title}</strong>
      </div>
      <Button variant="default" size="sm" onClick={model.onClick}>
        {model.cta}
      </Button>
    </section>
  );
}

/** Exported for unit tests — pure resolution of banner copy/CTA. */
export { resolveNextAction };

/** Ordered list of secondary chip IDs shown below the primary Do-now action. */
export const DESKTOP_DO_NOW_SECONDARY_IDS = ['approve', 'doctor', 'channels', 'prove'] as const;

export type DoNowSecondaryChip = {
  id: string;
  label: string;
  onClick: () => void;
};

type BuildDoNowSecondariesOptions = {
  approvalsCount: number;
  onOpenReview?: () => void;
  onDoctor?: () => void;
  onOpenChannels?: () => void;
  onOpenProve?: () => void;
};

/** Build the secondary action chips shown below the primary Do-now CTA. */
export function buildDesktopDoNowSecondaries(options: BuildDoNowSecondariesOptions): DoNowSecondaryChip[] {
  const chips: DoNowSecondaryChip[] = [];
  const dedupeApprove = options.approvalsCount > 0;
  if (!dedupeApprove && options.onOpenReview) {
    chips.push({ id: 'approve', label: 'Review', onClick: options.onOpenReview });
  }
  if (options.onDoctor) {
    chips.push({ id: 'doctor', label: 'Doctor', onClick: options.onDoctor });
  }
  if (options.onOpenChannels) {
    chips.push({ id: 'channels', label: 'Channels', onClick: options.onOpenChannels });
  }
  if (options.onOpenProve) {
    chips.push({ id: 'prove', label: 'Prove', onClick: options.onOpenProve });
  }
  return chips;
}
