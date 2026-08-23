import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ZavorthOnDemandTranslationService } from '../../../src/services/localization/ZavorthOnDemandTranslationService';
import type { TranslationProviderBridge } from '../../../src/services/localization/ZavorthOnDemandTranslationService';

class FakeTranslationBridge implements TranslationProviderBridge {
  public calls = 0;

  public async completePrompt(prompt: string): Promise<string> {
    this.calls += 1;
    const sourceJson = prompt.slice(prompt.indexOf('SOURCE JSON:') + 'SOURCE JSON:'.length);
    const parsed = JSON.parse(sourceJson.trim()) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      translated[key] = `[fake] ${value}`;
    }
    return JSON.stringify(translated);
  }
}

function createTempStorage(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-strings-test-'));
}

describe('ZavorthOnDemandTranslationService.getOrTranslateStrings', () => {
  it('translates missing entries once and persists them for offline reuse', async () => {
    const storageDir = createTempStorage();
    const bridge = new FakeTranslationBridge();
    const service = new ZavorthOnDemandTranslationService({ storageDir, providerBridge: bridge });

    const first = await service.getOrTranslateStrings('nl', { 'nav.newChat': 'New chat' });
    expect(first['nav.newChat']).toBe('[fake] New chat');
    expect(bridge.calls).toBe(1);

    const persistedPath = path.join(storageDir, 'nl.strings.json');
    expect(fs.existsSync(persistedPath)).toBe(true);

    const offlineService = new ZavorthOnDemandTranslationService({ storageDir });
    const second = await offlineService.getOrTranslateStrings('nl', { 'nav.newChat': 'New chat' });
    expect(second['nav.newChat']).toBe('[fake] New chat');
  });

  it('merges newly requested keys into an existing persisted catalog', async () => {
    const storageDir = createTempStorage();
    const bridge = new FakeTranslationBridge();
    const service = new ZavorthOnDemandTranslationService({ storageDir, providerBridge: bridge });

    await service.getOrTranslateStrings('sv', { 'a': 'Alpha' });
    const merged = await service.getOrTranslateStrings('sv', { 'a': 'Alpha', 'b': 'Beta' });
    expect(merged).toEqual({ a: '[fake] Alpha', b: '[fake] Beta' });
    expect(bridge.calls).toBe(2);
  });

  it('persists nothing when no provider bridge is configured', async () => {
    const storageDir = createTempStorage();
    const service = new ZavorthOnDemandTranslationService({ storageDir });

    const result = await service.getOrTranslateStrings('de', { 'k': 'value' });
    expect(result).toEqual({});
    expect(fs.readdirSync(storageDir)).not.toContain('de.strings.json');
  });
});
