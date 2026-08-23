import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { LocalizationCatalog } from './localeContracts.js';
import { en } from './catalogs/en.js';
import { ZavorthJsonSchemaRepairService } from '../llm/repair/ZavorthJsonSchemaRepairService.js';

export interface TranslationProviderBridge {
  completePrompt(prompt: string): Promise<string>;
}

export interface OnDemandTranslationOptions {
  storageDir?: string;
  providerBridge?: TranslationProviderBridge;
  jsonRepairService?: ZavorthJsonSchemaRepairService;
}

export class ZavorthOnDemandTranslationService {
  private readonly storageDir: string;
  private readonly providerBridge?: TranslationProviderBridge;
  private readonly jsonRepairService: ZavorthJsonSchemaRepairService;
  private readonly memoryCache: Map<string, LocalizationCatalog>;
  private readonly dynamicStringCache: Map<string, string>;
  private readonly stringsMemoryCache: Map<string, Map<string, string>>;

  public constructor(options: OnDemandTranslationOptions = {}) {
    this.storageDir = options.storageDir || path.join(os.homedir(), '.zavorth', 'locales');
    this.providerBridge = options.providerBridge;
    this.jsonRepairService = options.jsonRepairService || new ZavorthJsonSchemaRepairService();
    this.memoryCache = new Map();
    this.dynamicStringCache = new Map();
    this.stringsMemoryCache = new Map();

    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch {
      // Gracefully operate in memory if filesystem access is constrained
    }
  }

  public async getOrSynthesizeCatalog(targetLocale: string): Promise<LocalizationCatalog> {
    const normalized = targetLocale.toLowerCase().trim();

    // 1. Check in-memory cache
    if (this.memoryCache.has(normalized)) {
      return this.memoryCache.get(normalized)!;
    }

    // 2. Check local disk cache (~/.zavorth/locales/<lang>.json)
    const diskPath = path.join(this.storageDir, `${normalized}.json`);
    if (fs.existsSync(diskPath)) {
      try {
        const raw = fs.readFileSync(diskPath, 'utf8');
        const parsed = JSON.parse(raw) as LocalizationCatalog;
        this.memoryCache.set(normalized, parsed);
        return parsed;
      } catch {
        // Corrupted file will be re-synthesized
      }
    }

    // 3. Fallback AI Synthesis (only if provider bridge is available)
    if (this.providerBridge) {
      const synthesized = await this.synthesizeCatalogViaProvider(normalized);
      if (synthesized) {
        this.memoryCache.set(normalized, synthesized);
        try {
          fs.writeFileSync(diskPath, JSON.stringify(synthesized, null, 2), 'utf8');
        } catch {/* empty */}
        return synthesized;
      }
    }

    // Default fallback to base English catalog
    return en;
  }

  public async getOrTranslateCatalog(targetLocale: string): Promise<LocalizationCatalog> {
    return this.getOrSynthesizeCatalog(targetLocale);
  }

  public async translateDynamicText(text: string, targetLocale: string): Promise<string> {
    const cacheKey = `${targetLocale}:${text}`;
    if (this.dynamicStringCache.has(cacheKey)) {
      return this.dynamicStringCache.get(cacheKey)!;
    }

    if (!this.providerBridge) {
      return text;
    }

    try {
      const prompt = `Translate the following user interface text into the language with ISO code "${targetLocale}". Output ONLY the translated text without commentary or quotation marks:\n${text}`;
      const response = await this.providerBridge.completePrompt(prompt);
      const translated = response.trim();
      this.dynamicStringCache.set(cacheKey, translated);
      return translated;
    } catch {
      return text;
    }
  }

  /**
   * Resolve UI strings for a locale: serve the persisted catalog when present,
   * translate only the missing entries once through the provider bridge, and
   * persist the merged map so later calls resolve offline.
   */
  public async getOrTranslateStrings(
    targetLocale: string,
    sourceEntries: Record<string, string>,
  ): Promise<Record<string, string>> {
    const normalized = targetLocale.toLowerCase().trim();

    const cached = this.stringsMemoryCache.get(normalized);
    const persisted = cached ?? this.readPersistedStrings(normalized);

    if (persisted) {
      this.stringsMemoryCache.set(normalized, persisted);
      const pendingEntries: Record<string, string> = {};
      for (const [key, value] of Object.entries(sourceEntries)) {
        if (!persisted.has(key)) pendingEntries[key] = value;
      }
      if (Object.keys(pendingEntries).length === 0) {
        return Object.fromEntries(persisted.entries());
      }
      const translations = await this.translateEntries(normalized, pendingEntries);
      const merged: Record<string, string> = {
        ...Object.fromEntries(persisted.entries()),
        ...translations,
      };
      this.stringsMemoryCache.set(normalized, new Map(Object.entries(merged)));
      this.persistStrings(normalized, merged);
      return merged;
    }

    const translations = await this.translateEntries(normalized, sourceEntries);
    if (Object.keys(translations).length > 0) {
      this.stringsMemoryCache.set(normalized, new Map(Object.entries(translations)));
      this.persistStrings(normalized, translations);
    }
    return translations;
  }

  private readPersistedStrings(normalized: string): Map<string, string> | null {
    const diskPath = path.join(this.storageDir, `${normalized}.strings.json`);
    try {
      if (!fs.existsSync(diskPath)) return null;
      const parsed = JSON.parse(fs.readFileSync(diskPath, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const entries = Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0,
      );
      return new Map(entries);
    } catch {
      return null;
    }
  }

  private persistStrings(normalized: string, merged: Record<string, string>): void {
    const diskPath = path.join(this.storageDir, `${normalized}.strings.json`);
    try {
      fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(diskPath, JSON.stringify(merged, null, 2), 'utf8');
    } catch {
      // Read-only filesystems keep translations memory-resident only.
    }
  }

  private async translateEntries(
    normalized: string,
    sourceEntries: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (!this.providerBridge || Object.keys(sourceEntries).length === 0) {
      return {};
    }
    const payload = JSON.stringify(sourceEntries, null, 2);
    const prompt = `Translate every value of the following JSON object into the language with ISO code "${normalized}".
IMPORTANT INVARIANTS:
1. Keep every JSON key exactly unchanged; keys are stable identifiers, not prose.
2. Translate values naturally as user-interface text.
3. Preserve placeholders such as {count} verbatim.
4. Output ONLY the resulting JSON object without markdown fences or commentary.

SOURCE JSON:
${payload}`;
    try {
      const rawOutput = await this.providerBridge.completePrompt(prompt);
      const repaired = this.jsonRepairService.repairJsonString(rawOutput);
      const parsed = JSON.parse(repaired) as Record<string, unknown>;
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim()) clean[key] = value.trim();
      }
      return clean;
    } catch {
      return {};
    }
  }

  private async synthesizeCatalogViaProvider(targetLocale: string): Promise<LocalizationCatalog | null> {
    if (!this.providerBridge) return null;

    const baseJsonString = JSON.stringify(en, null, 2);
    const prompt = `Translate all UI string values in the following JSON catalog into language code "${targetLocale}".
IMPORTANT INVARIANTS:
1. Preserve all JSON keys exactly as they are.
2. Output ONLY the valid JSON object without markdown code fences or conversational text.

SOURCE JSON:
${baseJsonString}`;

    try {
      const rawOutput = await this.providerBridge.completePrompt(prompt);
      const repaired = this.jsonRepairService.repairJsonString(rawOutput);
      const parsed = JSON.parse(repaired) as LocalizationCatalog;
      return parsed;
    } catch {
      return null;
    }
  }
}
