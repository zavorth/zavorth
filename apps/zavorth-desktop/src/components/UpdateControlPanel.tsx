import type { DesktopUpdateStatus } from '../desktop-state/desktopUpdate';

export function UpdateControlPanel(props: {
  status: DesktopUpdateStatus | null;
  busy?: boolean;
  onCheck(): void | Promise<void>;
  onDownload?(): void | Promise<void>;
  onInstall?(): void | Promise<void>;
  onDefer?(): void | Promise<void>;
  onRollback?(): void | Promise<void>;
  onOpenSetup?(): void | Promise<void>;
  onOpenGithub?(): void | Promise<void>;
}) {
  const status = props.status;
  return (
    <section className="zvd-update-panel" aria-label="Desktop updates">
      <header className="zvd-update-panel__header">
        <div>
          <strong>Install & updates</strong>
          <p>
            {status?.message
              || 'Updates come from GitHub Releases (no custom website). Check for tags, open Releases, then install manually or via Setup.'}
          </p>
        </div>
        <span className={`zvd-readiness-badge tone-${toneForState(status?.state)}`}>
          {labelForState(status?.state)}
        </span>
      </header>

      <div className="zvd-update-panel__meta">
        <div><span>Current</span><strong>{status?.currentVersion || '0.1.0'}</strong></div>
        <div><span>Latest</span><strong>{status?.latestVersion || '—'}</strong></div>
        <div><span>Channel</span><strong>{status?.channel || 'github'}</strong></div>
        <div><span>Source</span><strong>{status?.source || 'github'}</strong></div>
        <div><span>Repo</span><strong>{status?.githubRepo || 'zavorth/zavorth'}</strong></div>
        <div><span>Checked</span><strong>{status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : 'never'}</strong></div>
      </div>

      {status?.releaseNotes?.length ? (
        <ul className="zvd-update-panel__notes">
          {status.releaseNotes.map(note => <li key={note}>{note}</li>)}
        </ul>
      ) : null}

      <div className="zvd-update-panel__actions">
        <button type="button" className="zvd-btn-primary" disabled={props.busy} onClick={() => void props.onCheck()}>
          Check GitHub
        </button>
        {(props.onOpenGithub || props.onDownload) && (
          <button
            type="button"
            className="zvd-btn-secondary"
            disabled={props.busy}
            onClick={() => void (props.onOpenGithub || props.onDownload)?.()}
          >
            Open GitHub Releases
          </button>
        )}
        {props.onDownload && status?.canDownloadLater && status?.state === 'available' && (
          <button type="button" className="zvd-btn-secondary" disabled={props.busy} onClick={() => void props.onDownload?.()}>
            Open package / release
          </button>
        )}
        {props.onInstall && (
          <button type="button" className="zvd-btn-secondary" disabled={props.busy} onClick={() => void props.onInstall?.()}>
            Install via Setup + GitHub
          </button>
        )}
        {props.onDefer && (status?.state === 'available' || status?.state === 'ready-to-install') && (
          <button type="button" className="zvd-btn-secondary" disabled={props.busy} onClick={() => void props.onDefer?.()}>
            Defer 7 days
          </button>
        )}
        {props.onRollback && status?.canRollback && (
          <button type="button" className="zvd-btn-secondary" disabled={props.busy} onClick={() => void props.onRollback?.()}>
            Rollback info
          </button>
        )}
        {props.onOpenSetup && (
          <button type="button" className="zvd-btn-secondary" onClick={() => void props.onOpenSetup?.()}>
            Open Setup
          </button>
        )}
      </div>
    </section>
  );
}

function labelForState(state?: DesktopUpdateStatus['state'] | null): string {
  switch (state) {
    case 'available': return 'Update on GitHub';
    case 'ready-to-install': return 'Ready to install';
    case 'deferred': return 'Deferred';
    case 'installing': return 'Installing';
    case 'rollback-available': return 'Rollback ready';
    case 'unconfigured': return 'Manual only';
    case 'error': return 'Error';
    case 'checking': return 'Checking';
    default: return 'GitHub channel';
  }
}

function toneForState(state?: DesktopUpdateStatus['state'] | null): 'ready' | 'warning' | 'danger' | 'muted' {
  if (state === 'error') return 'danger';
  if (state === 'available' || state === 'ready-to-install' || state === 'deferred') return 'warning';
  if (state === 'up-to-date' || state === 'rollback-available') return 'ready';
  return 'muted';
}
