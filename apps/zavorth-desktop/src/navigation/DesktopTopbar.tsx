import { Refresh, Search, Sliders, Stop } from '../icons';
import type { RuntimeStatus } from '../global';

export function DesktopTopbar(props: {
  busy: boolean;
  modelLabel: string;
  status: RuntimeStatus;
  onCommandPalette(): void;
  onModel(): void;
  onRefresh(): void;
  onStop(): void;
}) {
  return (
    <header className="zvd-topbar">
      <div className="zvd-topbar-left">
        <button className="zvd-topbar-title" type="button" onClick={props.onModel} title="Abrir configurações do workspace">
          <span>Zavorth Core</span>
          <small>Desktop local</small>
        </button>
      </div>

      <div className="zvd-topbar-right" aria-label="Window actions">
        <button
          className={`zvd-status-pill ${props.status.running ? 'is-live' : ''}`}
          onClick={props.onModel}
          type="button"
          title={props.status.message}
        >
          <span aria-hidden="true" className="zvd-status-dot" />
          {props.status.running ? 'Local ready' : 'Local offline'}
          <small>{props.modelLabel}</small>
        </button>
        <button
          className="zvd-icon-button"
          onClick={props.onRefresh}
          type="button"
          aria-label="Refresh runtime status"
          title="Refresh runtime status"
        >
          <Refresh aria-hidden="true" size={18} stroke={1.8} />
        </button>
        <button
          className="zvd-icon-button"
          onClick={props.onModel}
          type="button"
          aria-label="Open settings"
          title="Open settings"
        >
          <Sliders aria-hidden="true" size={18} stroke={1.8} />
        </button>
        <button
          className="zvd-icon-button"
          onClick={props.onCommandPalette}
          type="button"
          aria-label="Open command palette"
          title="Open command palette"
        >
          <Search aria-hidden="true" size={18} stroke={1.8} />
        </button>
        {props.busy && (
          <button className="zvd-icon-button is-danger" onClick={props.onStop} type="button" aria-label="Stop response" title="Stop response">
            <Stop aria-hidden="true" size={17} stroke={2} />
          </button>
        )}
      </div>
    </header>
  );
}
