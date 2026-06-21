import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { panelLabels } from '../primitives/desktopPrimitives';
import { slashCommands, type DesktopPanel } from '../slashCommands';

type CommandPaletteItem = {
  id: string;
  type: 'panel' | 'slash';
  label: string;
  description: string;
  meta?: string;
  action: () => void;
};

export function HubCommandPalette(props: {
  activePanel: DesktopPanel;
  open: boolean;
  onClose(): void;
  onInsert(value: string): void;
  onPanel(panel: DesktopPanel): void;
  onRun(value: string): void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [props.open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function chooseCommand(usage: string) {
    props.onClose();
    if (usage.includes('|') || usage.endsWith(' ')) {
      props.onInsert(usage);
      return;
    }
    void props.onRun(usage.split(' ')[0]);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const panelsList: CommandPaletteItem[] = (Object.keys(panelLabels) as DesktopPanel[]).map((panel, index) => ({
    id: `panel-${panel}`,
    type: 'panel',
    label: panelLabels[panel],
    description: panel === 'chat' ? 'Voltar para a conversa' : `Abrir painel de ${panelLabels[panel].toLowerCase()}`,
    meta: panel === props.activePanel ? 'atual' : `Ctrl+${index + 1}`,
    action: () => {
      props.onPanel(panel);
      props.onClose();
    },
  }));
  const filteredPanels = panelsList.filter(panel => {
    const panelHaystack = `${panel.label} ${panel.description} ${panel.id}`.toLowerCase();
    return !normalizedQuery || panelHaystack.includes(normalizedQuery);
  });
  const filteredCommands = slashCommands.filter(command => {
    const haystack = `${command.name} ${command.description} ${command.usage}`.toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const slashesList: CommandPaletteItem[] = filteredCommands.map(command => ({
    id: `slash-${command.name}`,
    type: 'slash',
    label: command.name,
    description: command.description,
    meta: command.usage,
    action: () => chooseCommand(command.usage),
  }));
  const allItems = [...filteredPanels, ...slashesList];

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (allItems.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(prev => (prev + 1) % allItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      allItems[selectedIndex]?.action();
    }
  };

  useEffect(() => {
    const activeEl = listContainerRef.current?.querySelector('.is-selected');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, props.open]);

  if (!props.open) {
    return null;
  }

  return (
    <div className="zvd-command-palette-backdrop" onMouseDown={props.onClose}>
      <section className="zvd-command-palette zvd-hub-command-palette zvd-glass" aria-label="Command palette" onMouseDown={event => event.stopPropagation()}>
        <div className="zvd-command-input-wrap">
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar chats, secoes e comandos"
          />
        </div>

        <div ref={listContainerRef} className="zvd-command-list">
          {allItems.length === 0 ? (
            <div className="zvd-command-empty">Nenhum comando encontrado.</div>
          ) : (
            <>
              {filteredPanels.length > 0 && (
                <CommandGroup title="Secoes recentes">
                  {filteredPanels.map((item, index) => (
                    <CommandButton key={item.id} item={item} selected={selectedIndex === index} />
                  ))}
                </CommandGroup>
              )}

              {slashesList.length > 0 && (
                <CommandGroup title="Comandos de barra">
                  {slashesList.map((item, index) => {
                    const globalIndex = filteredPanels.length + index;
                    return <CommandButton key={item.id} item={item} selected={selectedIndex === globalIndex} />;
                  })}
                </CommandGroup>
              )}
            </>
          )}
        </div>

        <div className="zvd-hub-command-actions" aria-label="Acoes rapidas">
          <button type="button" onClick={() => chooseCommand('/usage')}>Resumo diario</button>
          <button type="button" onClick={() => props.onPanel('approvals')}>Revisao semanal</button>
          <button type="button" onClick={() => props.onPanel('settings')}>Monitorar projeto</button>
        </div>
      </section>
    </div>
  );
}

function CommandGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="zvd-command-group">
      <div className="zvd-command-group-label">{props.title}</div>
      {props.children}
    </div>
  );
}

function CommandButton(props: { item: CommandPaletteItem; selected: boolean }) {
  return (
    <button className={`zvd-command-item ${props.selected ? 'is-selected' : ''}`} onClick={props.item.action} type="button">
      <strong>{props.item.label}</strong>
      <small>{props.item.description}</small>
      {props.item.meta && <span>{props.item.meta}</span>}
    </button>
  );
}
