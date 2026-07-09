export type SetupRoute = 'welcome' | 'progress' | 'success' | 'failure';
export type StageState = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type SetupStage = {
  name: string;
  title: string;
  state: StageState;
  message?: string;
};

export type SetupState = {
  route: SetupRoute;
  running: boolean;
  completed: boolean;
  installRoot: string | null;
  error: string | null;
  stages: SetupStage[];
  logs: string[];
};

export type BootstrapEvent =
  | { type: 'manifest'; stages: Array<{ name: string; title: string }> }
  | { type: 'stage'; name: string; state: StageState; message?: string }
  | { type: 'log'; line: string }
  | { type: 'complete'; installRoot: string }
  | { type: 'failed'; error: string };

const initial: SetupState = {
  route: 'welcome',
  running: false,
  completed: false,
  installRoot: null,
  error: null,
  stages: [],
  logs: [],
};

let state = initial;
const subscribers = new Set<(state: SetupState) => void>();
let listening = false;
let listenPending = false;

type Unlisten = () => void;

type TauriApi = {
  core?: {
    invoke?: <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  };
  event?: {
    listen?: <T = unknown>(
      eventName: string,
      callback: (event: { payload: T }) => void,
    ) => Promise<Unlisten>;
  };
};

function tauri() {
  return (window as Window & { __TAURI__?: TauriApi }).__TAURI__;
}

async function invokeCommand<T = unknown>(command: string, payload?: Record<string, unknown>) {
  const invoke = tauri()?.core?.invoke;
  if (!invoke) {
    throw new Error('Zavorth Setup bridge is not available.');
  }
  return invoke<T>(command, payload);
}

async function listenForBootstrapEvents() {
  const listen = tauri()?.event?.listen;
  if (!listen) {
    throw new Error('Zavorth Setup event bridge is not available.');
  }
  await listen<BootstrapEvent>('zavorth-setup', event => applyEvent(event.payload));
}

function emit(next: SetupState) {
  state = next;
  subscribers.forEach(callback => callback(state));
}

function applyEvent(event: BootstrapEvent) {
  if (event.type === 'manifest') {
    emit({
      ...state,
      route: 'progress',
      running: true,
      error: null,
      stages: event.stages.map(stage => ({ ...stage, state: 'pending' })),
      logs: [],
    });
    return;
  }

  if (event.type === 'stage') {
    emit({
      ...state,
      stages: state.stages.map(stage => (
        stage.name === event.name
          ? { ...stage, state: event.state, message: event.message }
          : stage
      )),
    });
    return;
  }

  if (event.type === 'log') {
    emit({ ...state, logs: [...state.logs, event.line].slice(-300) });
    return;
  }

  if (event.type === 'complete') {
    emit({
      ...state,
      route: 'success',
      running: false,
      completed: true,
      installRoot: event.installRoot,
    });
    return;
  }

  emit({
    ...state,
    route: 'failure',
    running: false,
    error: event.error,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Zavorth Setup bridge failed.');
}

function emitFailure(error: unknown) {
  applyEvent({ type: 'failed', error: errorMessage(error) });
}

export function subscribe(callback: (state: SetupState) => void) {
  subscribers.add(callback);
  callback(state);
  if (!listening && !listenPending) {
    listenPending = true;
    listenForBootstrapEvents()
      .then(() => {
        listening = true;
      })
      .catch(error => {
        listening = false;
        emitFailure(error);
      })
      .finally(() => {
        listenPending = false;
      });
  }
  return () => {
    subscribers.delete(callback);
  };
}

export async function startInstall() {
  emit({ ...initial, route: 'progress', running: true });
  try {
    await invokeCommand('start_bootstrap', {
      args: {
        tag: 'latest',
        dryRun: false,
        installRoot: null,
      },
    });
  } catch (error: unknown) {
    emitFailure(error);
  }
}

export async function cancelInstall() {
  try {
    await invokeCommand('cancel_bootstrap');
  } catch (error: unknown) {
    emitFailure(error);
  }
}

export async function launchDesktop() {
  try {
    await invokeCommand('launch_zavorth_desktop', { installRoot: state.installRoot });
  } catch (error: unknown) {
    emitFailure(error);
  }
}

export function snapshot() {
  return state;
}
