import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeLearningRuntimeMode,
  resolveLearningRuntimePolicy,
  setLearningRuntimeMode,
} from '../../../src/services/ZavorthLearningRuntimePolicy.js';

describe('ZavorthLearningRuntimePolicy', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-learning-policy-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('normalizes mode aliases', () => {
    expect(normalizeLearningRuntimeMode('autonomous')).toBe('autonomous');
    expect(normalizeLearningRuntimeMode('governed')).toBe('governed');
    expect(normalizeLearningRuntimeMode('candidate-after-success')).toBe('governed');
    expect(normalizeLearningRuntimeMode('nope')).toBeNull();
  });

  it('uses explicit mode over environment', () => {
    const snapshot = resolveLearningRuntimePolicy({
      projectRoot: tempDir,
      mode: 'autonomous',
      env: { ZAVORTH_LEARNING_MODE: 'governed' },
    });
    expect(snapshot.mode).toBe('autonomous');
    expect(snapshot.source).toBe('explicit');
    expect(snapshot.autoWriteGreenPreferences).toBe(true);
    expect(snapshot.autoInstallSkills).toBe(false);
    expect(snapshot.canModifySecurityPolicy).toBe(false);
  });

  it('persists and reloads mode from state file', () => {
    const written = setLearningRuntimeMode('autonomous', { projectRoot: tempDir });
    expect(written.mode).toBe('autonomous');
    const reloaded = resolveLearningRuntimePolicy({
      projectRoot: tempDir,
      env: {},
    });
    expect(reloaded.mode).toBe('autonomous');
    expect(reloaded.autoMaterializeYellowSkillDrafts).toBe(true);
  });

  it('rejects invalid mode on set', () => {
    expect(() => setLearningRuntimeMode('invalid', { projectRoot: tempDir })).toThrow(/governed|autonomous/i);
  });

  it('scopes persisted mode per userId', () => {
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir, userId: 'op-a' });
    setLearningRuntimeMode('governed', { projectRoot: tempDir, userId: 'op-b' });

    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'op-a', env: {} }).mode).toBe('autonomous');
    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'op-b', env: {} }).mode).toBe('governed');

    const pathA = path.join(tempDir, 'data', 'runtime', 'learning', 'users', 'op-a', 'runtime-policy.json');
    const pathB = path.join(tempDir, 'data', 'runtime', 'learning', 'users', 'op-b', 'runtime-policy.json');
    expect(fs.existsSync(pathA)).toBe(true);
    expect(fs.existsSync(pathB)).toBe(true);
  });
});
