import type { ChatMessage, RuntimeCapabilitiesSnapshot } from '../apiClient';
import { FileExplorer } from '../components/FileExplorer';
import { AppWindow, Folder, Terminal } from '../icons';
import type { DesktopPanel } from '../slashCommands';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

type PreviewOutputItem = {
  kind: string;
  label: string;
};

export function DesktopPreviewRail(props: {
  activePanel: DesktopPanel;
  messages: ChatMessage[];
  mode: 'compact' | 'expanded';
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  workspaceScope: DesktopWorkspaceScope;
  onAttachFile?(filePath: string): void;
}) {
  const workspacePath = props.workspaceScope.path || '';
  const ragSources = props.runtimeCapabilities?.workspaceKnowledge?.ragSources ?? [];
  const latestAssistant = [...props.messages].reverse().find(message => message.role === 'assistant');
  const latestSummary = latestAssistant?.content || 'Waiting for relevant runtime output.';
  const outputItems = [
    latestAssistant ? { kind: 'output', label: latestSummary.slice(0, 72) } : null,
    workspacePath ? { kind: 'folder', label: props.workspaceScope.shortLabel || props.workspaceScope.label } : null,
    ...ragSources.slice(0, props.mode === 'compact' ? 3 : 6).map(source => ({
      kind: source.kind || 'source',
      label: source.label || source.id || 'Source',
    })),
  ].filter(Boolean) as PreviewOutputItem[];

  return (
    <section className={`zvd-preview-rail zavorth-preview-rail is-quiet is-${props.mode}`} aria-label="Progress">
      <header className="zvd-preview-header">
        <div>
          <span>Progress</span>
          <strong>{props.activePanel === 'chat' ? 'Context summary' : 'Active panel'}</strong>
        </div>
      </header>

      <div className="zvd-preview-section">
        <div className="zvd-preview-card-title">
          <AppWindow aria-hidden="true" size={16} stroke={1.8} />
          <strong>Outputs</strong>
        </div>
        {outputItems.length === 0 ? (
          <p>No pinned output for this chat.</p>
        ) : (
          <ul className="zvd-preview-output-list">
            {outputItems.map((item, index) => (
              <li key={`${item.kind}-${index}`}>
                <span>{item.kind}</span>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {props.mode === 'expanded' && (
        <div className="zvd-preview-section">
          <div className="zvd-preview-card-title">
            <Folder aria-hidden="true" size={16} stroke={1.8} />
            <strong>Files</strong>
          </div>
          {workspacePath ? (
            <FileExplorer
              workspacePath={workspacePath}
              onAttachFile={props.onAttachFile}
            />
          ) : (
            <p>Select a trusted folder to browse files and attach references to chat.</p>
          )}
        </div>
      )}

      <div className="zvd-preview-section">
        <div className="zvd-preview-card-title">
          <Terminal aria-hidden="true" size={16} stroke={1.8} />
          <strong>Sources</strong>
        </div>
        {ragSources.length === 0 ? (
          <p>No active sources.</p>
        ) : (
          <ul>
            {ragSources.slice(0, 4).map(source => (
              <li key={source.id}>{source.label || source.id}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
