import fs from 'fs';
import os from 'os';
import path from 'path';
import { LearningStyleService } from '../../src/services/LearningStyleService';

describe('LearningStyleService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-learning-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no LEARNING-STYLE.md exists', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.configured).toBe(false);
    expect(status.primaryStyle).toBe('examples-first');
    expect(status.filePath).toBe(path.join(tempDir, 'LEARNING-STYLE.md'));
  });

  it('sets preferences and persists them to LEARNING-STYLE.md', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });

    const prefs = service.setPreferences({
      primaryStyle: 'theory-first',
      depthPreference: 'deep',
    });

    expect(prefs.primaryStyle).toBe('theory-first');
    expect(prefs.depthPreference).toBe('deep');
    expect(fs.existsSync(path.join(tempDir, 'LEARNING-STYLE.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'LEARNING-STYLE.md'), 'utf8');
    expect(fileContent).toContain('theory-first');
    expect(fileContent).toContain('deep');
  });

  it('detects configured state when preferences differ from defaults', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });
    service.setPreferences({ primaryStyle: 'visual' });

    const status = service.getStatus();

    expect(status.configured).toBe(true);
    expect(status.primaryStyle).toBe('visual');
  });

  it('getPreferences returns defaults for missing file', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });

    const prefs = service.getPreferences();

    expect(prefs.primaryStyle).toBe('examples-first');
    expect(prefs.depthPreference).toBe('moderate');
    expect(prefs.documentationPreference).toBe('mixed');
    expect(prefs.handsOnPreference).toBe('mixed');
  });

  it('getLearningHint returns style-specific hint', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });
    service.setPreferences({ primaryStyle: 'hands-on', handsOnPreference: 'try-first' });

    const hint = service.getLearningHint();

    expect(hint).toContain('interactive exercises');
    expect(hint).toContain('try before reading');
  });

  it('getLearningHint returns read-first hint', () => {
    const service = new LearningStyleService({ projectRoot: tempDir });
    service.setPreferences({ primaryStyle: 'step-by-step', handsOnPreference: 'read-first' });

    const hint = service.getLearningHint();

    expect(hint).toContain('numbered sequential steps');
    expect(hint).toContain('Read documentation before attempting');
  });
});
