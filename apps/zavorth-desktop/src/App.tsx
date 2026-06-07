import { useEffect, useMemo, useState } from 'react';
import type { BootEvent, RuntimeStatus } from './global';

const fallbackStatus: RuntimeStatus = {
  ok: false,
  running: false,
  dashboardUrl: '',
  publicUrl: 'http://127.0.0.1:3000/dashboard',
  tokenReady: false,
  tokenSource: 'missing',
  runtimePid: null,
  message: 'Desktop bridge unavailable.',
};

export function App() {
  const [status, setStatus] = useState<RuntimeStatus>(fallbackStatus);
  const [events, setEvents] = useState<BootEvent[]>([]);
  const [busy, setBusy] = useState(false);

  const bridge = window.zavorthDesktop;

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let mounted = true;
    bridge.getRuntimeStatus().then(next => mounted && setStatus(next)).catch(() => undefined);
    const off = bridge.onBootEvent(event => {
      setEvents(current => [event, ...current].slice(0, 6));
    });

    return () => {
      mounted = false;
      off();
    };
  }, [bridge]);

  const stateLabel = useMemo(() => {
    if (status.running && status.tokenReady) {
      return 'Ready';
    }
    if (status.tokenReady) {
      return 'Access ready';
    }
    return 'Setup needed';
  }, [status.running, status.tokenReady]);

  async function run(action: () => Promise<RuntimeStatus>) {
    if (!bridge) {
      return;
    }
    setBusy(true);
    try {
      setStatus(await action());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="desktop-shell">
      <section className="connect-panel" aria-label="Zavorth Desktop">
        <div className="wordmark">
          <span className="mark" aria-hidden="true">Z</span>
          <div>
            <strong>Zavorth</strong>
            <small>Local agent runtime</small>
          </div>
        </div>

        <div className="status-row">
          <span className={`status-dot ${status.running ? 'status-dot--ready' : ''}`} />
          <span>{stateLabel}</span>
          <code>{status.publicUrl.replace(/^https?:\/\//u, '')}</code>
        </div>

        <h1>Open your local chat.</h1>
        <p>
          Zavorth Desktop starts the local runtime when needed, repairs local access, and then opens the
          dashboard directly in chat.
        </p>

        <div className="actions">
          <button disabled={!bridge || busy} onClick={() => run(() => bridge!.openDashboard())}>
            {busy ? 'Opening...' : 'Open chat'}
          </button>
          <button disabled={!bridge || busy} onClick={() => run(() => bridge!.startRuntime())}>
            Start runtime
          </button>
          <button disabled={!bridge || busy} onClick={() => run(() => bridge!.repairAccess())}>
            Repair access
          </button>
        </div>

        <div className="secondary-actions">
          <button disabled={!bridge} onClick={() => bridge?.startSetup()}>
            Setup
          </button>
          <button disabled={!bridge} onClick={() => bridge?.openLogs()}>
            Logs
          </button>
        </div>

        <p className="message">{status.message}</p>

        {events.length > 0 && (
          <ol className="event-list" aria-label="Runtime events">
            {events.map(event => (
              <li key={`${event.at}-${event.message}`} data-tone={event.type}>
                <span>{event.message}</span>
                <time>{new Date(event.at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
