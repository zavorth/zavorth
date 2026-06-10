import { useEffect, useMemo, useState } from 'react';
import {
  cancelInstall,
  launchDesktop,
  startInstall,
  subscribe,
  type SetupState,
} from './store';

const initialState: SetupState = {
  route: 'welcome',
  running: false,
  completed: false,
  installRoot: null,
  error: null,
  stages: [],
  logs: [],
};

export function App() {
  const [state, setState] = useState(initialState);
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => subscribe(setState), []);

  const progress = useMemo(() => {
    if (state.stages.length === 0) {
      return 0;
    }
    const done = state.stages.filter(stage => ['succeeded', 'failed', 'skipped'].includes(stage.state)).length;
    return Math.max(4, Math.round((done / state.stages.length) * 100));
  }, [state.stages]);

  if (state.route === 'success') {
    return (
      <Screen>
        <Brand eyebrow="Ready" title="Zavorth is installed." />
        <p>Your local runtime is ready. Open Desktop to start from chat.</p>
        <div className="actions">
          <button onClick={() => void launchDesktop()}>Open Desktop</button>
        </div>
      </Screen>
    );
  }

  if (state.route === 'failure') {
    return (
      <Screen>
        <Brand eyebrow="Repair" title="Setup did not finish." />
        <p>{state.error || 'The installer stopped before completing.'}</p>
        <div className="actions">
          <button onClick={() => void startInstall()}>Try again</button>
        </div>
      </Screen>
    );
  }

  if (state.route === 'progress') {
    return (
      <Screen>
        <Brand eyebrow="Installing" title="Setting up Zavorth." />
        <div
          className="progress"
          role="progressbar"
          aria-label="Install progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol className="stage-list">
          {state.stages.length === 0 ? (
            <li data-state="running">
              <span>Preparing installer</span>
              <small>Starting</small>
            </li>
          ) : (
            state.stages.map(stage => (
              <li key={stage.name} data-state={stage.state}>
                <span>{stage.title}</span>
                <small>{stage.message || stage.state}</small>
              </li>
            ))
          )}
        </ol>
        <div className="actions actions--split">
          <button className="ghost" onClick={() => setLogsOpen(value => !value)}>
            {logsOpen ? 'Hide details' : 'Show details'}
          </button>
          <button className="ghost" onClick={() => void cancelInstall()}>
            Cancel
          </button>
        </div>
        {logsOpen && (
          <pre className="logs">{state.logs.length ? state.logs.join('\n') : 'No output yet.'}</pre>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Brand eyebrow="First run" title="Install Zavorth locally." />
      <p>
        Setup checks your machine, installs the runtime, prepares local access, and leaves a repair path if
        something needs attention.
      </p>
      <div className="actions">
        <button onClick={() => void startInstall()}>Install Zavorth</button>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="setup-shell"><section>{children}</section></main>;
}

function Brand({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="brand">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
    </div>
  );
}
