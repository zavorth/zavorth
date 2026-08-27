import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadGatewayMessages } from '../../../src/ai-gateway/i18n/catalogBridge.js';
import type { Locale } from '../../../src/ai-gateway/i18n/config.js';
import type { GatewayMessageSourceOptions } from '../../../src/ai-gateway/i18n/catalogBridge.js';

const REPO_EN_MESSAGES = path.join('src', 'ai-gateway', 'i18n', 'messages', 'en.json');

function createMessagesTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-catalog-bridge-'));
}

function readRepoEnglishMessages(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(REPO_EN_MESSAGES, 'utf8')) as Record<string, unknown>;
}

describe('GatewayI18nCatalogBridge', () => {
  let messagesDir: string;

  beforeEach(() => {
    messagesDir = createMessagesTempDir();
  });

  afterEach(() => {
    fs.rmSync(messagesDir, { recursive: true, force: true });
  });

  it('serves the materialized catalog without consulting the localization system', async () => {
    const english = readRepoEnglishMessages();
    fs.writeFileSync(path.join(messagesDir, 'en.json'), JSON.stringify(english, null, 2), 'utf8');
    const resolveLocalizedMessages = jest.fn();

    const messages = await loadGatewayMessages('en', { messagesDir, resolveLocalizedMessages });

    expect(messages).toEqual(english);
    expect(resolveLocalizedMessages).not.toHaveBeenCalled();
  });

  it('synthesizes a missing locale once through the localization system and materializes it', async () => {
    const synthesized = { common: { save: '保存' }, sidebar: { home: 'ホーム' } };
    const resolveLocalizedMessages = jest.fn().mockResolvedValue(synthesized);
    const options: GatewayMessageSourceOptions = { messagesDir, resolveLocalizedMessages };

    const first = await loadGatewayMessages('xx' as Locale, options);
    const second = await loadGatewayMessages('xx' as Locale, options);

    expect(first).toEqual(synthesized);
    expect(second).toEqual(first);
    expect(resolveLocalizedMessages).toHaveBeenCalledTimes(1);

    const materializedPath = path.join(messagesDir, 'xx.json');
    expect(fs.existsSync(materializedPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(materializedPath, 'utf8'))).toEqual(synthesized);
  });
});
