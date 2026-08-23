import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZavorthOnDemandTranslationService,
  type TranslationProviderBridge,
} from '../../../src/services/localization/ZavorthOnDemandTranslationService.js';
import { ZavorthJsonSchemaRepairService } from '../../../src/services/llm/repair/ZavorthJsonSchemaRepairService.js';
import { en } from '../../../src/services/localization/catalogs/en.js';

function makeStorageDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-on-demand-'));
}

function countingBridge(
  calls: { count: number },
  response: unknown,
): TranslationProviderBridge {
  return {
    async completePrompt() {
      calls.count += 1;
      return typeof response === 'string' ? response : JSON.stringify(response);
    },
  };
}

describe('ZavorthOnDemandTranslationService synthesis and persistence', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = makeStorageDir();
  });

  afterEach(() => {
    fs.rmSync(storageDir, { recursive: true, force: true });
  });

  it('returns the base English catalog when no provider bridge is present and nothing is persisted', async () => {
    const service = new ZavorthOnDemandTranslationService({ storageDir });
    const catalog = await service.getOrSynthesizeCatalog('is');
    expect(catalog).toBe(en);
    expect(fs.existsSync(path.join(storageDir, 'is.json'))).toBe(false);
  });

  it('synthesizes a missing catalog through the provider bridge once and persists it', async () => {
    const calls = { count: 0 };
    const service = new ZavorthOnDemandTranslationService({
      storageDir,
      jsonRepairService: new ZavorthJsonSchemaRepairService(),
      providerBridge: countingBridge(calls, {
        ...en,
        common: { ...en.common, save: 'Vista', cancel: 'Hætta við' },
      }),
    });

    const catalog = await service.getOrSynthesizeCatalog('is');
    expect(catalog.common.save).toBe('Vista');
    expect(calls.count).toBe(1);
    expect(fs.existsSync(path.join(storageDir, 'is.json'))).toBe(true);

    const secondCall = await service.getOrSynthesizeCatalog('is');
    expect(secondCall.common.save).toBe('Vista');
    expect(calls.count).toBe(1);
  });

  it('resolves previously synthesized catalogs offline from disk alone', async () => {
    const authoringService = new ZavorthOnDemandTranslationService({
      storageDir,
      jsonRepairService: new ZavorthJsonSchemaRepairService(),
      providerBridge: countingBridge({ count: 0 }, {
        ...en,
        common: { ...en.common, save: 'Spara' },
      }),
    });
    await authoringService.getOrSynthesizeCatalog('sv');

    const offlineService = new ZavorthOnDemandTranslationService({ storageDir });
    const catalog = await offlineService.getOrSynthesizeCatalog('sv');
    expect(catalog.common.save).toBe('Spara');
  });

  it('caches dynamic text translations in memory per locale pair', async () => {
    const calls = { count: 0 };
    const service = new ZavorthOnDemandTranslationService({
      storageDir,
      providerBridge: countingBridge(calls, 'Modo de depuração avançado'),
    });

    const first = await service.translateDynamicText('Advanced Debug Mode', 'pt');
    expect(first).toBe('Modo de depuração avançado');
    expect(calls.count).toBe(1);

    const second = await service.translateDynamicText('Advanced Debug Mode', 'pt');
    expect(second).toBe('Modo de depuração avançado');
    expect(calls.count).toBe(1);
  });

  it('synthesizes missing strings once and serves repeat requests from the persisted map', async () => {
    const calls = { count: 0 };
    const service = new ZavorthOnDemandTranslationService({
      storageDir,
      jsonRepairService: new ZavorthJsonSchemaRepairService(),
      providerBridge: countingBridge(calls, { 'greeting.title': 'Bonjour' }),
    });

    const first = await service.getOrTranslateStrings('fr', { 'greeting.title': 'Hello' });
    expect(first['greeting.title']).toBe('Bonjour');
    expect(calls.count).toBe(1);
    expect(fs.existsSync(path.join(storageDir, 'fr.strings.json'))).toBe(true);

    // Regression guard: repeat requests resolve from the persisted map and
    // must not re-invoke the translation backend.
    const second = await service.getOrTranslateStrings('fr', { 'greeting.title': 'Hello' });
    expect(second['greeting.title']).toBe('Bonjour');
    expect(calls.count).toBe(1);
  });

  it('translates only entries missing from the persisted map and merges the result', async () => {
    const calls = { count: 0 };
    const persistedPath = path.join(storageDir, 'fr.strings.json');
    fs.writeFileSync(persistedPath, JSON.stringify({ 'greeting.title': 'Bonjour' }), 'utf8');

    const service = new ZavorthOnDemandTranslationService({
      storageDir,
      jsonRepairService: new ZavorthJsonSchemaRepairService(),
      providerBridge: countingBridge(calls, { 'farewell.title': 'Au revoir' }),
    });

    const merged = await service.getOrTranslateStrings('fr', {
      'greeting.title': 'Hello',
      'farewell.title': 'Goodbye',
    });
    expect(merged['greeting.title']).toBe('Bonjour');
    expect(merged['farewell.title']).toBe('Au revoir');
    expect(JSON.parse(fs.readFileSync(persistedPath, 'utf8'))).toMatchObject({
      'greeting.title': 'Bonjour',
      'farewell.title': 'Au revoir',
    });
    expect(calls.count).toBe(1);
  });

  it('never calls a provider when no bridge is configured (offline-safe default)', async () => {
    const service = new ZavorthOnDemandTranslationService({ storageDir });
    const result = await service.getOrTranslateStrings('de', { 'a.b': 'Hello' });
    expect(result).toEqual({});
  });
});
