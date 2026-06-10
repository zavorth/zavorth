import { useState } from 'react';
import { panelLabels } from '../primitives/desktopPrimitives';
import { slashCommands, type DesktopPanel } from '../slashCommands';

export function CommandPalette(props: {
  activePanel: DesktopPanel;
  open: boolean;
  onClose(): void;
  onInsert(value: string): void;
  onPanel(panel: DesktopPanel): void;
  onRun(value: string): void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const commandItems = slashCommands.filter(command => {
    const haystack = `${command.name} ${command.description} ${command.usage}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  if (!props.open) {
    return null;
  }

  function chooseCommand(usage: string) {
    props.onClose();
    if (usage.includes('|') || usage.endsWith(' ')) {
      props.onInsert(usage);
      return;
    }
    void props.onRun(usage.split(' ')[0]);
  }

  return (
    <div className="zvd-command-palette-backdrop" onMouseDown={props.onClose}>
      <section className="zvd-command-palette" aria-label="Command palette" onMouseDown={event => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search commands, panels, and actions"
        />
        <div className="zvd-command-group">
          <span>Panels</span>
          {(Object.keys(panelLabels) as DesktopPanel[]).map(panel => (
            <button
              className={props.activePanel === panel ? 'is-active' : ''}
              key={panel}
              onClick={() => {
                props.onPanel(panel);
                props.onClose();
              }}
            >
              <strong>{panelLabels[panel]}</strong>
              <small>{panel === 'chat' ? 'Return to the conversation' : `Open ${panelLabels[panel].toLowerCase()} inspector`}</small>
            </button>
          ))}
        </div>
        <div className="zvd-command-group">
          <span>Slash commands</span>
          {commandItems.map(command => (
            <button key={command.name} onClick={() => chooseCommand(command.usage)}>
              <strong>{command.name}</strong>
              <small>{command.description}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
