import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthI18nService } from '../../src/i18n/ZavorthI18nService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-i18n-cli-test-'));
}

describe('i18n CLI translations', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should have instance translations in en-US', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.instance.title')).toBe('Zavorth Instance Profiles');
    expect(svc.t('cli.instance.description')).toBe('Manage isolated runtime instances.');
    expect(svc.t('cli.instance.commands.list')).toBe('List all instances');
    expect(svc.t('cli.instance.commands.current')).toBe('Show current instance');
    expect(svc.t('cli.instance.commands.create')).toBe('Create a new instance');
    expect(svc.t('cli.instance.commands.delete')).toBe('Delete an instance');
  });

  it('should have instance translations in pt-BR', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('pt-BR');
    expect(svc.t('cli.instance.title')).toBe('Perfis de Instância do Zavorth');
    expect(svc.t('cli.instance.description')).toBe('Gerencie instâncias de runtime isoladas.');
    expect(svc.t('cli.instance.commands.list')).toBe('Listar todas as instâncias');
    expect(svc.t('cli.instance.commands.current')).toBe('Mostrar instância atual');
    expect(svc.t('cli.instance.commands.create')).toBe('Criar uma nova instância');
    expect(svc.t('cli.instance.commands.delete')).toBe('Excluir uma instância');
  });

  it('should interpolate instance variables', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.instance.current_instance', { vars: { name: 'work' } })).toBe('Current instance: work');
    expect(svc.t('cli.instance.created', { vars: { name: 'dev', path: '/tmp/dev' } })).toContain('dev');
    expect(svc.t('cli.instance.deleted', { vars: { name: 'old' } })).toContain('old');
  });

  it('should interpolate pt-BR instance variables', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('pt-BR');
    expect(svc.t('cli.instance.current_instance', { vars: { name: 'trabalho' } })).toBe('Instância atual: trabalho');
    expect(svc.t('cli.instance.created', { vars: { name: 'dev', path: '/tmp/dev' } })).toContain('dev');
    expect(svc.t('cli.instance.deleted', { vars: { name: 'antigo' } })).toContain('antigo');
  });

  it('should have help text in both languages', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.help.title')).toBe('Zavorth CLI Help');
    svc.setLocale('pt-BR');
    expect(svc.t('cli.help.title')).toBe('Ajuda do CLI Zavorth');
  });

  it('should have error messages in both languages', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.errors.unknown_command', { vars: { command: 'foo' } })).toContain('foo');
    svc.setLocale('pt-BR');
    expect(svc.t('cli.errors.unknown_command', { vars: { command: 'foo' } })).toContain('foo');
  });

  it('should have setup messages in both languages', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.setup.success')).toBe('Setup completed successfully.');
    svc.setLocale('pt-BR');
    expect(svc.t('cli.setup.success')).toBe('Configuração concluída com sucesso.');
  });

  it('should have doctor messages in both languages', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.doctor.pass')).toBe('PASS');
    svc.setLocale('pt-BR');
    expect(svc.t('cli.doctor.pass')).toBe('PASSOU');
  });

  it('should have start messages in both languages', () => {
    const svc = new ZavorthI18nService({ homeRoot: tmpDir });
    svc.setLocale('en-US');
    expect(svc.t('cli.start.starting')).toBe('Starting Zavorth runtime...');
    svc.setLocale('pt-BR');
    expect(svc.t('cli.start.starting')).toBe('Iniciando runtime do Zavorth...');
  });
});
