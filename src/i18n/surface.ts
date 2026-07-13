/**
 * Shared-surface operator copy via central i18n service.
 * Keys live under services.surface.* in locale YAML catalogs.
 */

import { getI18nService } from './ZavorthI18nService.js';
import type { InterpolationVars } from './types.js';

const i18n = getI18nService();

export function tSurface(key: string, vars?: InterpolationVars): string {
  return i18n.t(`services.surface.${key}`, {
    vars,
    fallback: i18n.t(`services.surface.${key}`, { vars, locale: 'en-US', fallback: key }),
  });
}
