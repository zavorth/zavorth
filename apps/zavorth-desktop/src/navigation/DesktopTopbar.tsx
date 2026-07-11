import { Search, Sliders, Stop, Sparkles } from '../icons';
import type { RuntimeStatus } from '../global';
import { t } from '../i18n';
import { trustedOperatorBadge } from '../trust/trustedOperator';

export function DesktopTopbar(props: {
  busy: boolean;
  modelLabel: string;
  status: RuntimeStatus;
  kaelActive: boolean;
  onToggleKael(): void;
  onCommandPalette(): void;
  onOpenCommandCenter?(): void;
  onModel(): void;
  onRuntime(): void;
  onRefresh(): void;
  onStop(): void;
  trustedOperator?: boolean;
  onToggleTrustedOperator?(): void;
}) {
  const isMac = navigator.userAgent.includes('Macintosh');
  const shortcutHint = isMac ? '⌘K' : 'Ctrl+K';
  const trustEnabled = Boolean(props.trustedOperator);
  const trustBadge = trustedOperatorBadge(trustEnabled);

  return (
    <header className="zvd-topbar" role="banner">
      <div className="zvd-topbar-left">
        <button
          className="zvd-topbar-title"
          type="button"
          onClick={() => props.onOpenCommandCenter?.() ?? props.onModel()}
          title={t('nav.commandCenter')}
          aria-label={t('nav.commandCenter')}
        >
          <img
            className="zvd-topbar-kael"
            src="./zavorth-mascot.svg"
            alt=""
            aria-hidden="true"
            width={22}
            height={22}
          />
          <span>Zavorth</span>
          <small>Desktop</small>
        </button>
      </div>

      <div className="zvd-topbar-right" aria-label={t('a11y.windowActions')}>
        <button
          className={`zvd-status-pill ${props.status.running ? 'is-live' : ''}`}
          onClick={props.onRuntime}
          type="button"
          title={props.status.message}
          aria-label={`${props.status.running ? t('topbar.localReady') : t('topbar.localOffline')}. ${props.modelLabel}`}
        >
          <span aria-hidden="true" className="zvd-status-dot" />
          {props.status.running ? t('topbar.localReady') : t('topbar.localOffline')}
          <small>{props.modelLabel}</small>
        </button>
        {props.onToggleTrustedOperator ? (
          <button
            className={`zvd-trust-badge${trustEnabled ? ' is-on' : ''}`}
            type="button"
            onClick={props.onToggleTrustedOperator}
            aria-pressed={trustEnabled}
            aria-label={t(trustBadge.labelKey)}
            title={`${t(trustBadge.labelKey)} — ${t(trustBadge.riskNoteKey)}`}
          >
            <span className="zvd-trust-badge__dot" aria-hidden="true" />
            <span className="zvd-trust-badge__label">{t(trustBadge.labelKey)}</span>
          </button>
        ) : null}
        <button
          className={`zvd-icon-button ${props.kaelActive ? 'is-active' : ''}`}
          onClick={props.onToggleKael}
          type="button"
          aria-label={t('topbar.toggleKael')}
          title={t('topbar.toggleKael')}
          aria-pressed={props.kaelActive}
        >
          <Sparkles aria-hidden="true" size={18} stroke={1.8} />
        </button>
        <button
          className="zvd-icon-button"
          onClick={props.onModel}
          type="button"
          aria-label={t('settings')}
          title={t('settings')}
        >
          <Sliders aria-hidden="true" size={18} stroke={1.8} />
        </button>
        <button
          className="zvd-icon-button"
          onClick={props.onCommandPalette}
          type="button"
          aria-label={`${t('nav.search')} (${shortcutHint})`}
          title={`${t('nav.search')} (${shortcutHint})`}
        >
          <Search aria-hidden="true" size={18} stroke={1.8} />
        </button>
        {props.busy && (
          <button
            className="zvd-icon-button is-danger"
            onClick={props.onStop}
            type="button"
            aria-label={t('topbar.stop')}
            title={t('topbar.stop')}
          >
            <Stop aria-hidden="true" size={17} stroke={2} />
          </button>
        )}
      </div>
    </header>
  );
}
