import { useMemo } from 'react';
import {
  composerStatusDetailKey,
  deriveComposerStatus,
  type ComposerPhase,
} from './composerStatus';
import { t } from '../i18n';

export function ComposerStatusStack(props: {
  busy: boolean;
  pendingApprovals: number;
  activeToolCount?: number;
  streamingAssistant?: boolean;
  lastError?: string | null;
  justCompleted?: boolean;
}) {
  const status = useMemo(
    () =>
      deriveComposerStatus({
        busy: props.busy,
        pendingApprovals: props.pendingApprovals,
        activeToolCount: props.activeToolCount,
        streamingAssistant: props.streamingAssistant,
        lastError: props.lastError,
        justCompleted: props.justCompleted,
      }),
    [
      props.busy,
      props.pendingApprovals,
      props.activeToolCount,
      props.streamingAssistant,
      props.lastError,
      props.justCompleted,
    ],
  );

  if (status.phase === 'idle') {
    return null;
  }

  const detail = resolveDetailText(status.phase, status.detail);

  return (
    <div
      className="zvd-composer-status-stack"
      role="status"
      aria-live="polite"
      aria-label={t(status.label)}
    >
      <div className="zvd-composer-status-stack__steps">
        {status.steps.map(step => {
          const className = [
            'zvd-composer-status-stack__step',
            step.active ? 'is-active' : '',
            step.done ? 'is-done' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span key={step.id} className={className} data-phase={step.phase}>
              {t(`composer.status.${step.phase}`)}
            </span>
          );
        })}
      </div>
      <div className="zvd-composer-status-stack__copy">
        <strong>{t(status.label)}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}

function resolveDetailText(phase: ComposerPhase, derivedDetail: string): string {
  if (phase === 'error') {
    return derivedDetail;
  }
  // Dynamic counts (tools / approvals) come from deriveComposerStatus.
  if (phase === 'tools' || phase === 'awaiting_approval') {
    return derivedDetail || t(composerStatusDetailKey(phase));
  }
  return t(composerStatusDetailKey(phase));
}
