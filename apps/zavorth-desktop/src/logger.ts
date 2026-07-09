/**
 * Desktop-side Zavorth logger.
 * Lightweight (renderer-safe): never throws, optional debug via localStorage / env bridge.
 */

type LogMethod = (...args: unknown[]) => void;

function shouldDebug(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const flag = String(localStorage.getItem('ZAVORTH_DEBUG') || '').toLowerCase();
      if (flag === '1' || flag === 'true' || flag === 'zavorth') return true;
    }
  } catch {
    // ignore storage access failures in locked-down contexts
  }
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const flag = String(env?.ZAVORTH_DEBUG || env?.DEBUG || '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'zavorth' || flag === '*';
  } catch {
    return false;
  }
}

function redactText(value: unknown): string {
  let text = String(value ?? '');
  text = text.replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b/gi, '$1[redacted]');
  text = text.replace(
    /\b((?:api[_-]?key|token|secret|password|credential)\s*[:=]\s*)["']?[^"'\s,;]{8,}/gi,
    '$1[redacted]',
  );
  text = text.replace(/\b(sk|pk|api|key|token)[_-][A-Za-z0-9]{20,}\b/gi, '[redacted]');
  return text;
}

function mapArgs(args: unknown[]): unknown[] {
  return args.map((entry) => {
    if (typeof entry === 'string') return redactText(entry);
    if (entry instanceof Error) {
      return { name: entry.name, message: redactText(entry.message) };
    }
    return entry;
  });
}

function bind(method: 'debug' | 'info' | 'warn' | 'error', gateDebug = false): LogMethod {
  const target = console[method] || console.log;
  return (...args: unknown[]) => {
    try {
      if (gateDebug && method === 'debug' && !shouldDebug()) return;
      target.apply(console, mapArgs(args) as []);
    } catch {
      // never throw from logging
    }
  };
}

export type DesktopLogger = {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  child: (scope: string) => DesktopLogger;
};

function createDesktopLogger(scope: string | null = null): DesktopLogger {
  const prefix = (args: unknown[]): unknown[] => {
    if (!scope || args.length === 0) return args;
    const first = args[0];
    if (typeof first === 'string') {
      if (first.startsWith(`[${scope}]`) || first.startsWith('[')) return args;
      return [`[${scope}] ${first}`, ...args.slice(1)];
    }
    return [`[${scope}]`, ...args];
  };

  const wrap =
    (method: 'debug' | 'info' | 'warn' | 'error'): LogMethod =>
    (...args) => {
      bind(method, method === 'debug')(...prefix(args));
    };

  const log: DesktopLogger = {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    child(childScope: string) {
      const next = String(childScope || '').trim();
      if (!next) return log;
      if (!scope) return createDesktopLogger(next);
      return createDesktopLogger(`${scope}:${next}`);
    },
  };
  return log;
}

export const logger: DesktopLogger = createDesktopLogger(null);
export function createLogger(scope: string): DesktopLogger {
  return createDesktopLogger(String(scope || '').trim() || 'desktop');
}
