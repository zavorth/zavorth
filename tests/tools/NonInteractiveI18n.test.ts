import fs from 'fs';
import os from 'os';
import path from 'path';
import { NonInteractiveSetupService } from '../../src/services/plugins/NonInteractiveSetupService';
import { I18nService } from '../../src/services/plugins/I18nService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'non-interactive-'));

describe('NonInteractiveSetupService', () => {
  let svc: NonInteractiveSetupService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new NonInteractiveSetupService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });

  it('parses non-interactive args', () => {
    const config = svc.parseArgs(['--non-interactive', '--provider', 'openai', '--key', 'sk-test']);
    expect(config).toBeTruthy();
    expect(config!.provider).toBe('openai');
    expect(config!.apiKey).toBe('sk-test');
  });

  it('returns null without --non-interactive', () => {
    expect(svc.parseArgs(['--provider', 'openai'])).toBeNull();
  });

  it('parses skip-conversational flag', () => {
    const config = svc.parseArgs(['--non-interactive', '--skip-conversational']);
    expect(config!.skipConversational).toBe(true);
  });

  it('parses channels', () => {
    const config = svc.parseArgs(['--non-interactive', '--channels', 'telegram,discord']);
    expect(config!.channels).toEqual(['telegram', 'discord']);
  });

  it('executes setup', async () => {
    const result = await svc.execute({ provider: 'openai', apiKey: 'sk-test' });
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('validates provider', async () => {
    const result = await svc.execute({ provider: 'openai' });
    expect(result.steps.find((s) => s.name === 'provider')?.status).toBe('done');
  });

  it('rejects invalid provider', async () => {
    const result = await svc.execute({ provider: 'invalid' });
    expect(result.steps.find((s) => s.name === 'provider')?.status).toBe('error');
  });

  it('generates config file', async () => {
    const result = await svc.execute({ provider: 'openai' });
    expect(result.configPath).toBeTruthy();
    expect(fs.existsSync(result.configPath!)).toBe(true);
  });
});

describe('I18nService', () => {
  let svc: I18nService;
  beforeEach(() => { svc = new I18nService(); });

  it('creates instance', () => { expect(svc).toBeDefined(); });

  it('defaults to English', () => { expect(svc.getLocale()).toBe('en'); });

  it('translates to English', () => { expect(svc.t('welcome')).toBe('Welcome to Zavorth!'); });

  it('translates to Portuguese', () => {
    svc.setLocale('pt');
    expect(svc.t('welcome')).toBe('Bem-vindo ao Zavorth!');
  });

  it('translates to Spanish', () => {
    svc.setLocale('es');
    expect(svc.t('welcome')).toBe('¡Bienvenido a Zavorth!');
  });

  it('translates to French', () => {
    svc.setLocale('fr');
    expect(svc.t('welcome')).toBe('Bienvenue sur Zavorth!');
  });

  it('translates to German', () => {
    svc.setLocale('de');
    expect(svc.t('welcome')).toBe('Willkommen bei Zavorth!');
  });

  it('translates to Japanese', () => {
    svc.setLocale('ja');
    expect(svc.t('welcome')).toBe('Zavorthへようこそ！');
  });

  it('translates to Chinese', () => {
    svc.setLocale('zh');
    expect(svc.t('welcome')).toBe('欢迎使用 Zavorth！');
  });

  it('translates to Korean', () => {
    svc.setLocale('ko');
    expect(svc.t('welcome')).toBe('Zavorth에 오신 것을 환영합니다!');
  });

  it('translates to Russian', () => {
    svc.setLocale('ru');
    expect(svc.t('welcome')).toBe('Добро пожаловать в Zavorth!');
  });

  it('translates to Arabic', () => {
    svc.setLocale('ar');
    expect(svc.t('welcome')).toBe('مرحباً بك في Zavorth!');
  });

  it('handles params', () => {
    expect(svc.t('migrate.found', { name: 'legacy-agent', type: 'legacy-python' })).toContain('legacy-agent');
  });

  it('returns key for missing translation', () => {
    expect(svc.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('lists locales', () => {
    const locales = svc.listLocales();
    expect(locales.length).toBe(10);
    expect(locales.find((l) => l.code === 'pt')).toBeTruthy();
  });

  it('adds custom locale', () => {
    svc.addLocale({
      code: 'it',
      name: 'Italian',
      nativeName: 'Italiano',
      messages: { 'welcome': 'Benvenuto in Zavorth!' },
    });
    svc.setLocale('it');
    expect(svc.t('welcome')).toBe('Benvenuto in Zavorth!');
  });

  it('gets message count', () => {
    expect(svc.getMessageCount('en')).toBeGreaterThan(0);
  });
});
