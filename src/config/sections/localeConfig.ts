import { readZavorthEnv } from '../configHelpers';

export function buildLocaleConfig() {
  return {
    zavorthLocale: readZavorthEnv('ZAVORTH_LANG', ''),
  };
}
