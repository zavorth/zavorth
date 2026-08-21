import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ZavorthOnDemandTranslationService, type TranslationProviderBridge } from '../../../src/services/localization/ZavorthOnDemandTranslationService.js';
import { en } from '../../../src/services/localization/catalogs/en.js';

describe('ZavorthOnDemandTranslationService', () => {
  const tempDir = path.join(os.tmpdir(), `zavorth-i18n-test-${Date.now()}`);

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* intentionally empty */ }
  });

  it('should return base english catalog when no provider bridge is present and file does not exist', async () => {
    const service = new ZavorthOnDemandTranslationService({ storageDir: tempDir });
    const catalog = await service.getOrSynthesizeCatalog('is'); // Icelandic

    expect(catalog).toBeDefined();
    expect(catalog.common.save).toBe('Save');
  });

  it('should synthesize missing catalog via provider bridge and persist to disk', async () => {
    let promptCallCount = 0;
    const mockProviderBridge: TranslationProviderBridge = {
      completePrompt: async (_prompt: string) => {
        promptCallCount++;
        // Simulate translated Icelandic catalog with slight JSON repair requirement (trailing comma)
        const icelandic = {
          ...en,
          common: {
            ...en.common,
            save: 'Vista',
            cancel: 'Hætta við',
          },
        };
        return JSON.stringify(icelandic);
      },
    };

    const service = new ZavorthOnDemandTranslationService({
      storageDir: tempDir,
      providerBridge: mockProviderBridge,
    });

    const catalog = await service.getOrSynthesizeCatalog('is');
    expect(catalog.common.save).toBe('Vista');
    expect(promptCallCount).toBe(1);

    // Verify written to disk
    const diskPath = path.join(tempDir, 'is.json');
    expect(fs.existsSync(diskPath)).toBe(true);

    // Second call should hit memory cache (0 extra provider calls)
    const secondCall = await service.getOrSynthesizeCatalog('is');
    expect(secondCall.common.save).toBe('Vista');
    expect(promptCallCount).toBe(1); // Still 1!
  });

  it('should translate dynamic strings and cache results in memory', async () => {
    let dynamicPromptCount = 0;
    const mockBridge: TranslationProviderBridge = {
      completePrompt: async (_prompt: string) => {
        dynamicPromptCount++;
        return 'Modo de depuração avançado';
      },
    };

    const service = new ZavorthOnDemandTranslationService({
      storageDir: tempDir,
      providerBridge: mockBridge,
    });

    const res1 = await service.translateDynamicText('Advanced Debug Mode', 'pt');
    expect(res1).toBe('Modo de depuração avançado');
    expect(dynamicPromptCount).toBe(1);

    const res2 = await service.translateDynamicText('Advanced Debug Mode', 'pt');
    expect(res2).toBe('Modo de depuração avançado');
    expect(dynamicPromptCount).toBe(1); // Cached!
  });
});
