import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkinEngineService } from '../../src/services/plugins/SkinEngineService';

describe('SkinEngineService', () => {
  let service: SkinEngineService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skin-test-'));
    service = new SkinEngineService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('has default skin active', () => {
    const skin = service.getActiveSkin();
    expect(skin.id).toBe('default');
    expect(skin.name).toBe('Default');
  });

  it('lists all skins', () => {
    const result = service.listSkins();
    expect(result).toContain('default');
    expect(result).toContain('ares');
    expect(result).toContain('mono');
    expect(result).toContain('slate');
  });

  it('switches active skin', () => {
    const result = service.setActiveSkin('ares');
    expect(result).toContain('ares');
    const skin = service.getActiveSkin();
    expect(skin.id).toBe('ares');
  });

  it('returns error for non-existent skin', () => {
    const result = service.setActiveSkin('nonexistent');
    expect(result).toContain('nao encontrado');
  });

  it('installs a custom skin', () => {
    const customSkin = {
      id: 'custom',
      name: 'Custom',
      description: 'My custom skin',
      author: 'Test',
      version: '1.0.0',
      colors: {
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        success: '#00ff00', warning: '#ffff00', error: '#ff0000',
        info: '#00ffff', muted: '#888888', background: '#000000',
        foreground: '#ffffff', border: '#333333',
      },
      prompt: { prefix: '>', suffix: '$', separator: '|', thinking_indicator: '...', success_indicator: '+', error_indicator: '-' },
      typography: { font_family: 'monospace', heading_style: 'bold', code_style: 'normal' },
      layout: { max_width: 80, padding: 0, compact_mode: true, show_timestamps: false, show_tool_names: false },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: ['custom'] },
    };
    const result = service.installSkin(JSON.stringify(customSkin));
    expect(result).toContain('instalado');
    expect(service.listSkins()).toContain('custom');
  });

  it('removes a custom skin', () => {
    const customSkin = {
      id: 'removable', name: 'Removable', description: 'Test', author: 'Test', version: '1.0.0',
      colors: { primary: '#fff', secondary: '#fff', accent: '#fff', success: '#fff', warning: '#fff', error: '#fff', info: '#fff', muted: '#fff', background: '#000', foreground: '#fff', border: '#333' },
      prompt: { prefix: '>', suffix: '', separator: '', thinking_indicator: '.', success_indicator: '+', error_indicator: '-' },
      typography: { font_family: 'monospace', heading_style: 'normal', code_style: 'normal' },
      layout: { max_width: 80, padding: 0, compact_mode: false, show_timestamps: false, show_tool_names: false },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: [] },
    };
    service.installSkin(JSON.stringify(customSkin));
    const result = service.removeSkin('removable');
    expect(result).toContain('removido');
  });

  it('gets skin preview', () => {
    const result = service.getSkinPreview('ares');
    expect(result).toContain('ARES');
    expect(result).toContain('Preview');
  });

  it('exports a skin', () => {
    const exported = service.exportSkin('mono');
    const parsed = JSON.parse(exported);
    expect(parsed.id).toBe('mono');
  });

  it('returns error for invalid JSON on install', () => {
    const result = service.installSkin('not json');
    expect(result).toContain('Erro');
  });

  it('returns error for skin without id', () => {
    const result = service.installSkin(JSON.stringify({ name: 'Test' }));
    expect(result).toContain('Erro');
  });
});
