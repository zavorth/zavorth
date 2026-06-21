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
  const latestSummary = latestAssistant?.content || 'Aguardando saida relevante do runtime.';
  const outputItems = [
    latestAssistant ? { kind: 'saida', label: latestSummary.slice(0, 72) } : null,
    workspacePath ? { kind: 'pasta', label: props.workspaceScope.shortLabel || props.workspaceScope.label } : null,
    ...ragSources.slice(0, props.mode === 'compact' ? 3 : 6).map(source => ({
      kind: source.kind || 'fonte',
      label: source.label || source.id || 'Fonte',
    })),
  ].filter(Boolean) as PreviewOutputItem[];

  return (
    <section className={`zvd-preview-rail zavorth-preview-rail is-quiet is-${props.mode}`} aria-label="Andamento">
      <header className="zvd-preview-header">
        <div>
          <span>Andamento</span>
          <strong>{props.activePanel === 'chat' ? 'Resumo contextual' : 'Painel ativo'}</strong>
        </div>
      </header>

      <div className="zvd-preview-section">
        <div className="zvd-preview-card-title">
          <AppWindow aria-hidden="true" size={16} stroke={1.8} />
          <strong>Saidas</strong>
        </div>
        {outputItems.length === 0 ? (
          <p>Nenhuma saida fixada para este chat.</p>
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
            <strong>Arquivos</strong>
          </div>
          {workspacePath && props.onAttachFile ? (
            <FileExplorer onAttachFile={props.onAttachFile} />
          ) : (
            <p>Selecione uma pasta confiavel para navegar arquivos e anexar referencias ao chat.</p>
          )}
        </div>
      )}

      <div className="zvd-preview-section">
        <div className="zvd-preview-card-title">
          <Terminal aria-hidden="true" size={16} stroke={1.8} />
          <strong>Fontes</strong>
        </div>
        {ragSources.length === 0 ? (
          <p>Nenhuma fonte ativa.</p>
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
