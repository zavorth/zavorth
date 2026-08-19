/**
 * Zavorth CLI Locale Management Subcommand.
 *
 * Lightweight secondary CLI namespace for inspecting, setting, and generating
 * native localization catalogs via the universal localization engine.
 */

import { ZavorthLocalizationService } from '../services/localization/ZavorthLocalizationService.js';
import { ZavorthOnDemandTranslationService } from '../services/localization/ZavorthOnDemandTranslationService.js';
import {
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
  type SupportedLocale,
} from '../services/localization/localeContracts.js';

export async function runLocaleCli(argv: string[], printFn: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): Promise<number> {
  const sub = String(argv[0] || 'list').toLowerCase();
  const target = String(argv[1] || '').trim().toLowerCase();
  const localizationService = new ZavorthLocalizationService();

  switch (sub) {
    case 'list':
    case 'ls': {
      printFn('\n\x1b[1m\x1b[36m🌐 Zavorth Supported Locales\x1b[0m\n');
      printFn('Code        Name / Endonym             RTL');
      printFn('──────────────────────────────────────────────');
      for (const loc of SUPPORTED_LOCALES) {
        const endonym = LOCALE_ENDONYMS[loc] || loc;
        const isRtl = RTL_LOCALES.has(loc) ? '✓ (RTL)' : '—';
        const isCurrent = localizationService.getLocale() === loc ? ' \x1b[32m(current)\x1b[0m' : '';
        printFn(`${loc.padEnd(12)}${endonym.padEnd(27)}${isRtl}${isCurrent}`);
      }
      printFn('\nTip: Run `zavorth locale add <code_or_language>` to generate a new language catalog via AI.\n');
      return 0;
    }

    case 'get':
    case 'current': {
      printFn(localizationService.getLocale());
      return 0;
    }

    case 'set': {
      if (!target) {
        printFn('Error: Please provide a locale code. Example: `zavorth locale set es`');
        return 1;
      }
      const normalized = localizationService.normalizeLocaleTag(target);
      localizationService.setLocale(normalized as SupportedLocale);
      printFn(`\x1b[32m✔ Active locale set to: ${normalized} (${LOCALE_ENDONYMS[normalized as SupportedLocale] || normalized})\x1b[0m`);
      return 0;
    }

    case 'add':
    case 'translate':
    case 'gen':
    case 'generate': {
      if (!target) {
        printFn('Error: Please specify the target language code or name. Example: `zavorth locale add sv`');
        return 1;
      }
      printFn(`\x1b[33m⏳ Generating localization catalog for "${target}" via AI translation engine...\x1b[0m`);
      const onDemandService = new ZavorthOnDemandTranslationService();
      const catalog = await onDemandService.getOrTranslateCatalog(target);
      const isRtl = localizationService.isRtl(target);
      printFn(`\x1b[32m✔ Successfully generated and cached catalog for "${target}"!\x1b[0m`);
      printFn(`  Keys translated: ${Object.keys(catalog.common).length + Object.keys(catalog.app).length + Object.keys(catalog.chat).length} top-level categories`);
      printFn(`  RTL detected: ${isRtl ? 'Yes' : 'No'}`);
      printFn(`  Saved to local disk cache for zero-latency runtime usage.`);
      return 0;
    }

    default: {
      printFn('Usage: zavorth locale <list|get|set|add> [target]');
      printFn('Commands:');
      printFn('  list             List all supported native and cached locales');
      printFn('  get              Print the active system/configured locale');
      printFn('  set <locale>     Set the active locale preference');
      printFn('  add <locale>     Generate and cache a new language catalog via AI');
      return 0;
    }
  }
}
