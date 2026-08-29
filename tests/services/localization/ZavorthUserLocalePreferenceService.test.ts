import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ZavorthUserLocalePreferenceService } from '../../../src/services/localization/ZavorthUserLocalePreferenceService.js';
import { ZavorthLocalizationService } from '../../../src/services/localization/ZavorthLocalizationService.js';

describe('ZavorthUserLocalePreferenceService', () => {
  let tempDir: string;
  let service: ZavorthUserLocalePreferenceService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-locale-test-'));
    service = new ZavorthUserLocalePreferenceService({ storageDir: tempDir });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('falls back to the detected system locale when no preference and no surface signal exist', async () => {
    const expected = new ZavorthLocalizationService().detectSystemLocale();
    const locale = await service.resolveUserLocale('user-none', null);
    expect(locale).toBe(expected);
  });

  it('learns and persists a valid surface signal on first sight', async () => {
    const locale = await service.resolveUserLocale('user-pt', 'pt-BR');
    expect(locale).toBe('pt');

    const stored = await service.getStoredLocale('user-pt');
    expect(stored).toBe('pt');

    const reloaded = new ZavorthUserLocalePreferenceService({ storageDir: tempDir });
    expect(await reloaded.getStoredLocale('user-pt')).toBe('pt');
  });

  it('gives persisted preference precedence over a later surface signal', async () => {
    await service.recordUserLocale('user-cross', 'pt');
    const locale = await service.resolveUserLocale('user-cross', 'en-US');
    expect(locale).toBe('pt');
  });

  it('ignores invalid locale tags and does not persist them', async () => {
    await service.recordUserLocale('user-invalid', 'not-a-real-locale');
    expect(await service.getStoredLocale('user-invalid')).toBeNull();
  });

  it('normalizes regional variants to base locales', async () => {
    const locale = await service.resolveUserLocale('user-zh', 'zh-CN');
    expect(locale).toBe('zh');
  });
});
