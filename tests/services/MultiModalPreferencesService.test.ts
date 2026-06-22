import fs from 'fs';
import os from 'os';
import path from 'path';
import { MultiModalPreferencesService } from '../../src/services/MultiModalPreferencesService';

describe('MultiModalPreferencesService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-multimodal-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero preferences when no MULTI-MODAL.md exists', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.preferenceCount).toBe(0);
    expect(status.enabledCount).toBe(0);
    expect(status.filePath).toBe(path.join(tempDir, 'MULTI-MODAL.md'));
  });

  it('sets a preference and persists it to MULTI-MODAL.md', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });

    const pref = service.setPreference('code', {
      enabled: true,
      whenToUse: 'When discussing code snippets',
    });

    expect(pref.modality).toBe('code');
    expect(pref.enabled).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'MULTI-MODAL.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'MULTI-MODAL.md'), 'utf8');
    expect(fileContent).toContain('[code] enabled:yes');
    expect(fileContent).toContain('When discussing code snippets');
  });

  it('overwrites preference for the same modality', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });
    service.setPreference('voice', { enabled: false, whenToUse: 'Never' });

    service.setPreference('voice', { enabled: true, whenToUse: 'For audio content' });

    const pref = service.getPreference('voice');
    expect(pref?.enabled).toBe(true);
    expect(pref?.whenToUse).toBe('For audio content');
  });

  it('counts enabled preferences correctly', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });
    service.setPreference('text', { enabled: true, whenToUse: 'Always' });
    service.setPreference('code', { enabled: true, whenToUse: 'Code contexts' });
    service.setPreference('voice', { enabled: false, whenToUse: 'Never' });

    const status = service.getStatus();

    expect(status.preferenceCount).toBe(3);
    expect(status.enabledCount).toBe(2);
  });

  it('getModalityHint returns empty when no preferences are enabled', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });
    service.setPreference('code', { enabled: false, whenToUse: 'Disabled' });

    const hint = service.getModalityHint('write a function');

    expect(hint).toBe('');
  });

  it('getModalityHint returns matching hint for code context', () => {
    const service = new MultiModalPreferencesService({ projectRoot: tempDir });
    service.setPreference('code', { enabled: true, whenToUse: 'Use code blocks with syntax highlighting' });

    const hint = service.getModalityHint('write a function');

    expect(hint).toContain('code');
    expect(hint).toContain('syntax highlighting');
  });
});
