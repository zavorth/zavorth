import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';export type ZavorthSetupStudioProgress = {
  contractVersion: 'zavorth-setup-progress/1';
  updatedAt: string;
  providerId?: string | null;
  modelId?: string | null;
  webSearchProvider?: 'skip' | 'local' | 'ollama-web' | 'brave' | 'google' | 'grok' | 'kimi' | 'minimax' | 'perplexity' | 'tavily' | 'firecrawl';
  hooksEnabled?: boolean;
  lastPage?: string | null;
  lastChannelId?: string | null;
  safety: {
    rawSecretsStored: false;
  };
};

export class ZavorthSetupStudioProgressStore {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = path.join(path.resolve(projectRoot), '.zavorth', 'setup-progress.json');
  }

  public read(): ZavorthSetupStudioProgress | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (parsed?.contractVersion !== 'zavorth-setup-progress/1') {
        return null;
      }
      return {
        contractVersion: 'zavorth-setup-progress/1',
        updatedAt: String(parsed.updatedAt || new Date(0).toISOString()),
        providerId: nullableString(parsed.providerId),
        modelId: nullableString(parsed.modelId),
        webSearchProvider: normalizeWebSearchProvider(parsed.webSearchProvider),
        hooksEnabled: Boolean(parsed.hooksEnabled),
        lastPage: nullableString(parsed.lastPage),
        lastChannelId: nullableString(parsed.lastChannelId),
        safety: { rawSecretsStored: false },
      };
    } catch (error: unknown) {logger.warn('[Zavorth Setup Studio Progress Store] parsing failed', error); return null; }
  }

  public write(progress: Omit<ZavorthSetupStudioProgress, 'contractVersion' | 'updatedAt' | 'safety'>): ZavorthSetupStudioProgress {
    const payload: ZavorthSetupStudioProgress = {
      contractVersion: 'zavorth-setup-progress/1',
      updatedAt: new Date().toISOString(),
      ...progress,
      safety: { rawSecretsStored: false },
    };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
  }
}

function nullableString(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeWebSearchProvider(value: unknown): ZavorthSetupStudioProgress['webSearchProvider'] {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'skip'
    || normalized === 'brave'
    || normalized === 'ollama-web'
    || normalized === 'google'
    || normalized === 'grok'
    || normalized === 'kimi'
    || normalized === 'minimax'
    || normalized === 'perplexity'
    || normalized === 'tavily'
    || normalized === 'firecrawl'
    ? normalized
    : 'local';
}
