import { redactPrivacyText, redactPrivacyValue } from './privacy/PrivacyRedactor.js';

type LogMethod = (message: string, ...metadata: unknown[]) => void;

export type ZavorthLogger = {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
};

function shouldDebug(): boolean {
  return String(process.env.ZAVORTH_DEBUG || process.env.DEBUG || '')
    .toLowerCase()
    .split(',')
    .some((entry) => entry === '1' || entry === 'true' || entry === 'zavorth' || entry === '*');
}

export const logger: ZavorthLogger = {
  debug(message, ...metadata) {
    if (shouldDebug()) {
      console.debug(redactPrivacyText(message), ...metadata.map((entry) => redactPrivacyValue(entry)));
    }
  },
  info(message, ...metadata) {
    console.info(redactPrivacyText(message), ...metadata.map((entry) => redactPrivacyValue(entry)));
  },
  warn(message, ...metadata) {
    console.warn(redactPrivacyText(message), ...metadata.map((entry) => redactPrivacyValue(entry)));
  },
  error(message, ...metadata) {
    console.error(redactPrivacyText(message), ...metadata.map((entry) => redactPrivacyValue(entry)));
  },
};
