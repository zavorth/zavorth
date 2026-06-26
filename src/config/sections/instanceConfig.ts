import { readZavorthEnv } from '../configHelpers';

export function buildInstanceConfig() {
  return {
    zavorthInstance: readZavorthEnv('ZAVORTH_INSTANCE', ''),
  };
}
