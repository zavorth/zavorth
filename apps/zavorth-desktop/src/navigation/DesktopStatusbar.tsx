import { Core, Folder, Sliders, Terminal } from '../icons';
import type { RuntimeStatus } from '../global';
import type { DesktopPanel } from '../slashCommands';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

export function DesktopStatusbar(props: {
  bottomPanelOpen: boolean;
  effort: string;
  modelLabel: string;
  status: RuntimeStatus;
  workspaceScope: DesktopWorkspaceScope;
  onOpenWorkspace(): void;
  onOpenSettings(): void;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
  onPanel(panel: DesktopPanel): void;
  onToggleBottomPanel(): void;
}) {
  const statusRecord = props.status as RuntimeStatus & { model?: unknown; version?: unknown };
  const runtimeLabel = props.status.running ? 'Runtime ready' : 'Runtime offline';
  const modelLabel = statusRecord.model ? String(statusRecord.model) : props.modelLabel;
  const versionLabel = statusRecord.version ? String(statusRecord.version) : 'Desktop local';
  const effortLabel = props.effort === 'ultra'
    ? 'Very High'
    : props.effort === 'high'
      ? 'Alta'
      : props.effort === 'low'
        ? 'Baixa'
        : 'Medium';
  const scopeLabel = props.workspaceScope.shortLabel || props.workspaceScope.label;
  const operate = (domain: string, operation: string, metadata?: Record<string, unknown>) => {
    void props.onRuntimeStateAction({ domain, operation, metadata });
  };

  return (
    <footer className="zvd-statusbar" aria-label="Runtime status">
      <div className="zvd-statusbar-group">
        <button
          className={`zvd-statusbar-item ${props.status.running ? 'is-live' : ''}`}
          type="button"
          onClick={() => {
            operate('gateway', 'sync', { control: 'runtime-status' });
            props.onOpenSettings();
          }}
          title={props.status.message || runtimeLabel}
        >
          <span aria-hidden="true" className="zvd-status-dot" />
          <span>{runtimeLabel}</span>
        </button>
        <button
          className={`zvd-statusbar-icon ${props.bottomPanelOpen ? 'is-active' : ''}`}
          type="button"
          onClick={() => {
            operate('session', props.bottomPanelOpen ? 'sync' : 'open', { control: 'terminal' });
            props.onToggleBottomPanel();
          }}
          aria-label="Toggle terminal"
          title="Toggle terminal (Ctrl+J)"
        >
          <Terminal aria-hidden="true" size={15} stroke={1.8} />
        </button>
      </div>

      <div className="zvd-statusbar-group is-right">
        <button
          className="zvd-statusbar-item"
          type="button"
          onClick={() => {
            operate('context', 'open', {
              control: 'workspace',
              workspaceId: props.workspaceScope.id,
              workspacePath: props.workspaceScope.path || null,
            });
            props.onOpenWorkspace();
          }}
          title={props.workspaceScope.path || scopeLabel}
        >
          <Folder aria-hidden="true" size={15} stroke={1.8} />
          <span>{scopeLabel}</span>
        </button>
        <button
          className="zvd-statusbar-item"
          type="button"
          onClick={() => {
            operate('gateway', 'open', { control: 'model-picker', modelLabel });
            props.onPanel('settings');
          }}
          title="Model settings"
        >
          <Core aria-hidden="true" size={15} stroke={1.8} />
          <span>{modelLabel}</span>
        </button>
        <button
          className="zvd-statusbar-item"
          type="button"
          onClick={() => {
            operate('agents', 'sync', { control: 'effort', effort: props.effort });
            props.onOpenSettings();
          }}
          title="Effort settings"
        >
          <Sliders aria-hidden="true" size={15} stroke={1.8} />
          <span>{effortLabel}</span>
        </button>
        <span className="zvd-statusbar-text">{versionLabel}</span>
      </div>
    </footer>
  );
}
