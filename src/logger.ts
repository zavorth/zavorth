import { redactPrivacyText, redactPrivacyValue } from './privacy/PrivacyRedactor.js';

type LogMethod = (message: string, ...metadata: unknown[]) => void;

export type ZavorthLogger = {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  /** Scoped child logger that prefixes messages with [scope]. */
  child: (scope: string) => ZavorthLogger;
};

function shouldDebug(): boolean {
  return String(process.env.ZAVORTH_DEBUG || process.env.DEBUG || '')
    .toLowerCase()
    .split(',')
    .some((entry) => entry === '1' || entry === 'true' || entry === 'zavorth' || entry === '*');
}

function normalizeMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message || message.name || 'Error';
  if (message == null) return '';
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function withScope(scope: string | null, message: unknown): string {
  const body = normalizeMessage(message);
  if (!scope) return body;
  if (body.startsWith(`[${scope}]`)) return body;
  // Avoid double-bracket noise when callers already include a tag.
  if (body.startsWith('[')) return body;
  return `[${scope}] ${body}`;
}

function createLoggerInstance(scope: string | null = null): ZavorthLogger {
  const log: ZavorthLogger = {
    debug(message, ...metadata) {
      if (!shouldDebug()) return;
      console.debug(
        redactPrivacyText(withScope(scope, message)),
        ...metadata.map((entry) => redactPrivacyValue(entry)),
      );
    },
    info(message, ...metadata) {
      console.info(
        redactPrivacyText(withScope(scope, message)),
        ...metadata.map((entry) => redactPrivacyValue(entry)),
      );
    },
    warn(message, ...metadata) {
      console.warn(
        redactPrivacyText(withScope(scope, message)),
        ...metadata.map((entry) => redactPrivacyValue(entry)),
      );
    },
    error(message, ...metadata) {
      console.error(
        redactPrivacyText(withScope(scope, message)),
        ...metadata.map((entry) => redactPrivacyValue(entry)),
      );
    },
    child(childScope: string) {
      const next = String(childScope || '').trim();
      if (!next) return log;
      if (!scope) return createLoggerInstance(next);
      return createLoggerInstance(`${scope}:${next}`);
    },
  };
  return log;
}

/** Process-wide Zavorth logger with privacy redaction and debug gating. */
export const logger: ZavorthLogger = createLoggerInstance(null);

/** Create a scoped logger, e.g. createLogger('gateway').info('started'). */
export function createLogger(scope: string): ZavorthLogger {
  return createLoggerInstance(String(scope || '').trim() || 'zavorth');
}
