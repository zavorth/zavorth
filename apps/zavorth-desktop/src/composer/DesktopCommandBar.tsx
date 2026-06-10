import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronDown, Folder, Mic, Plus, Send, Sliders, Stop } from '../icons';
import type { ModelOption } from '../modelCatalog';
import type { DesktopWorkspaceScope } from '../workspaceScopes';

const effortOptions = [
  { value: 'low', label: 'Baixa', description: 'Respostas rápidas, menor custo.' },
  { value: 'medium', label: 'Média', description: 'Equilíbrio para uso diário.' },
  { value: 'high', label: 'Alta', description: 'Mais raciocínio para tarefas difíceis.' },
  { value: 'ultra', label: 'Altíssimo', description: 'Máxima profundidade quando vale gastar mais.' },
];

export function DesktopCommandBar(props: {
  busy: boolean;
  effort: string;
  modelOptions: ModelOption[];
  selectedModel: string;
  value: string;
  workspaceScope: DesktopWorkspaceScope;
  workspaceScopes: DesktopWorkspaceScope[];
  onAttach?(): void;
  onChange(value: string): void;
  onEffort(value: string): void;
  onModel(value: string): void;
  onProviderSetup(): void;
  onStop(): void;
  onSubmit(value?: string): void | Promise<void>;
  onVoice?(): void;
  onWorkspaceFolder(): void | Promise<void>;
  onWorkspaceScope(value: string): void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const activeModel = useMemo(
    () => props.modelOptions.find(model => model.id === props.selectedModel) || props.modelOptions[0],
    [props.modelOptions, props.selectedModel],
  );
  const activeEffort = effortOptions.find(option => option.value === props.effort) || effortOptions[1];
  const modelFamilies = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    for (const model of props.modelOptions) {
      groups.set(model.family, [...(groups.get(model.family) || []), model]);
    }
    return Array.from(groups.entries());
  }, [props.modelOptions]);

  useEffect(() => {
    if (!modelOpen && !workspaceOpen) {
      return;
    }

    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (!modelMenuRef.current?.contains(target)) {
        setModelOpen(false);
      }
      if (!workspaceMenuRef.current?.contains(target)) {
        setWorkspaceOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setModelOpen(false);
        setWorkspaceOpen(false);
      }
    }

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [modelOpen, workspaceOpen]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = props.value.trim();
    if (!props.busy && value) {
      void props.onSubmit(value);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as unknown as { isComposing?: boolean };
    if (nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const value = props.value.trim();
      if (!props.busy && value) {
        void props.onSubmit(value);
      }
    }
  }

  const canSend = props.value.trim().length > 0;

  return (
    <form className="zvd-composer-shell" onSubmit={submit} aria-label="Chat composer">
      <textarea
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        placeholder="Faça o que quiser"
        rows={2}
        onKeyDown={onKeyDown}
      />

      <div className="zvd-composer-bottom-row">
        <div className="zvd-composer-controls-left">
          <button
            type="button"
            className="zvd-composer-icon-btn"
            aria-label="Anexar contexto"
            title="Anexar contexto"
            onClick={props.onAttach}
          >
            <Plus aria-hidden="true" size={18} stroke={2} />
          </button>

          <button type="button" className="zvd-composer-text-btn" title="Modo de execução">
            <Sliders aria-hidden="true" size={16} stroke={1.8} />
            Personalizado
            <ChevronDown aria-hidden="true" size={14} stroke={2} />
          </button>
        </div>

        <div className="zvd-composer-controls-right">
          <div className="zvd-model-menu-wrap" ref={modelMenuRef}>
            <button
              type="button"
              className="zvd-model-trigger"
              aria-label={`Selecionar modelo e inteligência. Atual: ${activeModel?.label || 'Zavorth Core'}, ${activeEffort.label}`}
              aria-expanded={modelOpen}
              aria-haspopup="menu"
              onClick={() => setModelOpen(value => !value)}
            >
              <span className="zvd-model-name">{activeModel?.label || 'Zavorth Core'}</span>
              <small>{activeEffort.label}</small>
              <ChevronDown aria-hidden="true" className="zvd-chevron" size={15} stroke={2} />
            </button>

            {modelOpen && (
              <div className="zvd-model-popover zvd-model-popover-wide" role="menu">
                <div className="zvd-model-menu-title">Modelos conectados</div>
                <div className="zvd-model-list" role="listbox" aria-label="Modelos conectados">
                  {modelFamilies.map(([family, models]) => (
                    <div className="zvd-model-family" key={family}>
                      <div>{family}</div>
                      {models.map(model => (
                        <button
                          type="button"
                          key={model.id}
                          role="option"
                          aria-selected={props.selectedModel === model.id}
                          className="zvd-model-option"
                          onClick={() => props.onModel(model.id)}
                        >
                          <span>{model.label}</span>
                          <small>{model.tone}</small>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="zvd-model-menu-divider" />
                <div className="zvd-model-menu-title">Inteligência</div>
                <div className="zvd-effort-grid">
                  {effortOptions.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      aria-pressed={props.effort === option.value}
                      className="zvd-effort-option"
                      onClick={() => props.onEffort(option.value)}
                    >
                      <span>{option.label}</span>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>

                <div className="zvd-model-menu-divider" />
                <button type="button" className="zvd-provider-add" onClick={props.onProviderSetup}>
                  <Plus aria-hidden="true" size={17} stroke={2} />
                  Colocar mais providers
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="zvd-composer-icon-btn"
            aria-label="Entrada por voz"
            title="Entrada por voz"
            onClick={props.onVoice}
          >
            <Mic aria-hidden="true" size={17} stroke={1.75} />
          </button>

          <button
            type={props.busy ? 'button' : 'submit'}
            onClick={props.busy ? props.onStop : undefined}
            disabled={!props.busy && !canSend}
            className={`zvd-composer-send-btn ${props.busy ? 'is-stop' : ''}`}
            aria-label={props.busy ? 'Parar resposta' : 'Enviar mensagem'}
            title={props.busy ? 'Parar resposta' : 'Enviar mensagem'}
          >
            {props.busy ? <Stop aria-hidden="true" size={18} stroke={2} /> : <Send aria-hidden="true" size={18} stroke={2} />}
          </button>
        </div>
      </div>

      <div className="zvd-workspace-scope-row" ref={workspaceMenuRef}>
        <button
          type="button"
          className="zvd-workspace-trigger"
          aria-expanded={workspaceOpen}
          aria-haspopup="menu"
          onClick={() => setWorkspaceOpen(value => !value)}
          title={props.workspaceScope.path || props.workspaceScope.label}
        >
          <Folder aria-hidden="true" size={17} stroke={1.75} />
          <span>{props.workspaceScope.shortLabel}</span>
          <ChevronDown aria-hidden="true" size={14} stroke={2} />
        </button>

        {workspaceOpen && (
          <div className="zvd-workspace-popover" role="menu">
            {props.workspaceScopes.map(scope => (
              <button
                type="button"
                key={scope.id}
                className={props.workspaceScope.id === scope.id ? 'is-active' : ''}
                onClick={() => {
                  props.onWorkspaceScope(scope.id);
                  setWorkspaceOpen(false);
                }}
              >
                <Folder aria-hidden="true" size={16} stroke={1.75} />
                <span>{scope.label}</span>
                <small>{scope.kind === 'chat' ? 'sem pasta' : scope.path || 'local'}</small>
              </button>
            ))}
            <div className="zvd-model-menu-divider" />
            <button type="button" onClick={() => void props.onWorkspaceFolder()}>
              <Plus aria-hidden="true" size={16} stroke={1.9} />
              <span>Selecionar pasta...</span>
              <small>requer permissão do usuário</small>
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
