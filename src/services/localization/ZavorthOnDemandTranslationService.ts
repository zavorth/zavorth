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

  public constructor(options: OnDemandTranslationOptions = {}) {
    this.storageDir = options.storageDir || path.join(os.homedir(), '.zavorth', 'locales');
    this.providerBridge = options.providerBridge;
    this.jsonRepairService = options.jsonRepairService || new ZavorthJsonSchemaRepairService();
    this.memoryCache = new Map();
    this.dynamicStringCache = new Map();

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
