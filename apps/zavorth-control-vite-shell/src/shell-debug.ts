/**
 * Tiny control-shell operational logging.
 * User-facing failures should use emitSignal/toast; this is for debug only.
 */

type LogArgs = unknown[];

function shouldDebug(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const flag = String(localStorage.getItem('ZAVORTH_DEBUG') || '').toLowerCase();
      if (flag === '1' || flag === 'true' || flag === 'zavorth') return true;
    }
  } catch {
    // ignore storage access failures
  }
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const flag = String(env?.ZAVORTH_DEBUG || env?.DEBUG || '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'zavorth' || flag === '*';
  } catch {
    return false;
  }
}

function prefix(scope: string, args: LogArgs): LogArgs {
  const tag = scope ? `[${scope}]` : '[control-shell]';
  if (args.length === 0) return [tag];
  if (typeof args[0] === 'string') return [`${tag} ${args[0]}`, ...args.slice(1)];
  return [tag, ...args];
}

function write(method: 'debug' | 'info' | 'warn' | 'error', scope: string, args: LogArgs): void {
  if (!shouldDebug() && method !== 'error') return;
  // Operational errors still stay quiet unless debug is on — product surfaces use toasts.
  if (method === 'error' && !shouldDebug()) return;
  try {
    const target = console[method] || console.log;
    target.apply(console, prefix(scope, args) as []);
  } catch {
    // never throw from logging
  }
}

export function shellDebug(...args: LogArgs): void {
  write('debug', 'control-shell', args);
}

export function shellWarn(...args: LogArgs): void {
  write('warn', 'control-shell', args);
}

export function shellError(...args: LogArgs): void {
  write('error', 'control-shell', args);
}

export function createShellLogger(scope: string) {
  const name = String(scope || 'control-shell').trim() || 'control-shell';
  return {
    debug: (...args: LogArgs) => write('debug', name, args),
    info: (...args: LogArgs) => write('info', name, args),
    warn: (...args: LogArgs) => write('warn', name, args),
    error: (...args: LogArgs) => write('error', name, args),
  };
}

/** User-visible receipt/toast when emitSignal is available. */
export function surfaceShellError(title: string, detail: string, type: 'error' | 'info' | 'success' = 'error'): void {
  try {
    window.emitSignal?.(type, title, detail);
  } catch {
    // optional surface
  }
  shellError(title, detail);
}

declare global {
  interface Window {
    emitSignal?: (type: string, title: string, detail?: string) => void;
  }
}
