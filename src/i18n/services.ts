/**
 * Service-layer i18n helpers (memory, scheduler, swarm, approvals, …).
 * Default locale: en-US via ZAVORTH_LANG / ZAVORTH_LOCALE.
 */

import { getI18nService } from './ZavorthI18nService.js';
import type { InterpolationVars } from './types.js';

const i18n = getI18nService();

export function tService(key: string, vars?: InterpolationVars): string {
  // Locale catalog → en-US → never prefer leaking an unresolved key when EN has a value.
  return i18n.t(`services.${key}`, {
    vars,
    fallback: i18n.t(`services.${key}`, { vars, locale: 'en-US', fallback: key }),
  });
}

export function tError(key: string, vars?: InterpolationVars): string {
  return i18n.t(`errors.${key}`, {
    vars,
    fallback: i18n.t(`errors.${key}`, { vars, locale: 'en-US', fallback: key }),
  });
}
