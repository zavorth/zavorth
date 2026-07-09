import type { RuntimeStatus } from '../global';
import { t } from '../i18n';
import { Button } from '../primitives';

export function RuntimeSetupBanner(props: {
  status: RuntimeStatus;
  busy?: boolean;
  updateMessage?: string | null;
  onStart(): void | Promise<void>;
  onRepair(): void | Promise<void>;
  onOpenSetup?(): void | Promise<void>;
  onOpenLogs?(): void | Promise<void>;
  onCheckUpdates?(): void | Promise<void>;
}) {
  if (props.status.running && props.status.tokenReady) {
    return null;
  }

  const offline = !props.status.running;
  const tokenIssue = props.status.running && !props.status.tokenReady;

  return (
    <section
      className={`zvd-runtime-banner ${offline ? 'is-offline' : 'is-warning'}`}
      role="status"
      aria-live="polite"
    >
      <div className="zvd-runtime-banner__main">
        <div className="zvd-runtime-banner__title-row">
          <span
            className={`zvd-runtime-banner__pill ${offline ? 'is-offline' : 'is-warning'}`}
            aria-hidden="true"
          >
            <span className="zvd-runtime-banner__pill-dot" />
            {offline ? t('runtime.pillOffline') : t('runtime.pillToken')}
          </span>
          <strong>
            {offline ? t('runtime.offlineTitle') : t('runtime.tokenTitle')}
          </strong>
        </div>
        <p>
          {props.status.message
            || (offline ? t('runtime.offlineBody') : t('runtime.tokenBody'))}
        </p>
        {props.updateMessage ? <small>{props.updateMessage}</small> : null}
      </div>
      <div className="zvd-runtime-banner__actions">
        {offline && (
          <Button
            variant="default"
            disabled={props.busy}
            onClick={() => void props.onStart()}
          >
            {t('runtime.start')}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={props.busy}
          onClick={() => void props.onRepair()}
        >
          {tokenIssue ? t('runtime.repairToken') : t('runtime.repair')}
        </Button>
        {props.onOpenSetup && (
          <Button variant="secondary" onClick={() => void props.onOpenSetup?.()}>
            {t('runtime.openSetup')}
          </Button>
        )}
        {props.onOpenLogs && (
          <Button variant="secondary" onClick={() => void props.onOpenLogs?.()}>
            {t('runtime.openLogs')}
          </Button>
        )}
        {props.onCheckUpdates && (
          <Button variant="ghost" onClick={() => void props.onCheckUpdates?.()}>
            {t('runtime.checkUpdates')}
          </Button>
        )}
      </div>
    </section>
  );
}
