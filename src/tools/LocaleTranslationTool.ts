/**
 * LocaleTranslationTool.
 *
 * Agent tool for inspecting available locales, setting the UI locale,
 * and generating new language catalogs on-demand using AI translation.
 */

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { ZavorthLocalizationService } from '../services/localization/ZavorthLocalizationService.js';
import { ZavorthOnDemandTranslationService } from '../services/localization/ZavorthOnDemandTranslationService.js';
import {
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
  type SupportedLocale,
} from '../services/localization/localeContracts.js';

export class LocaleTranslationTool extends BaseTool {
  readonly name = 'locale_manage';
  readonly description =
    'Inspect supported languages, change the active user interface locale, or generate new language catalogs on-demand via the AI translation engine.';

  readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'set', 'translate'],
        description: 'Action to perform: list available locales, get active locale, set active locale, or translate/generate a new language catalog.',
      },
      targetLocale: {
        type: 'string',
        description: 'Language code or name (e.g., "sv", "he", "el", "es", "ja") required for set or translate actions.',
      },
    },
    required: ['action'],
  };

  private readonly localizationService = new ZavorthLocalizationService();
  private readonly onDemandService = new ZavorthOnDemandTranslationService();

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'list').toLowerCase();
    const target = String(args.targetLocale || '').trim().toLowerCase();

    switch (action) {
      case 'list': {
        const available = SUPPORTED_LOCALES.map((loc) => ({
          code: loc,
          name: LOCALE_ENDONYMS[loc] || loc,
          isRtl: RTL_LOCALES.has(loc),
          isCurrent: this.localizationService.getLocale() === loc,
        }));
        return JSON.stringify(
          {
            ok: true,
            currentLocale: this.localizationService.getLocale(),
            supportedCount: available.length,
            locales: available,
          },
          null,
          2,
        );
      }

      case 'get': {
        return JSON.stringify(
          {
            ok: true,
            activeLocale: this.localizationService.getLocale(),
            endonym: LOCALE_ENDONYMS[this.localizationService.getLocale()] || this.localizationService.getLocale(),
            isRtl: this.localizationService.isRtl(this.localizationService.getLocale()),
          },
          null,
          2,
        );
      }

      case 'set': {
        if (!target) {
          return JSON.stringify({ ok: false, error: 'targetLocale is required for action "set"' });
        }
        const normalized = this.localizationService.normalizeLocaleTag(target);
        this.localizationService.setLocale(normalized as SupportedLocale);
        return JSON.stringify(
          {
            ok: true,
            activeLocale: normalized,
            endonym: LOCALE_ENDONYMS[normalized as SupportedLocale] || normalized,
            message: `Active UI locale successfully updated to ${normalized}.`,
          },
          null,
          2,
        );
      }

      case 'translate': {
        if (!target) {
          return JSON.stringify({ ok: false, error: 'targetLocale is required for action "translate"' });
        }
        const catalog = await this.onDemandService.getOrTranslateCatalog(target);
        const isRtl = this.localizationService.isRtl(target);
        return JSON.stringify(
          {
            ok: true,
            targetLocale: target,
            isRtl,
            categoriesTranslated: Object.keys(catalog).length,
            message: `Successfully generated and cached on-demand translation catalog for ${target}.`,
          },
          null,
          2,
        );
      }

      default:
        return JSON.stringify({ ok: false, error: `Unknown action: ${action}` });
    }
  }
}
